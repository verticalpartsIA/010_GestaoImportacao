/* ============================================================
   precificacao-elevador-store.js
   CRUD da Precificação de Elevador (ADM/Financeiro) — herda o Cotação Nº
   do Formulário de Elevadores e os custos já respondidos pelo fornecedor,
   orquestra o motor de cálculo (PrecificacaoElevadorEngine) e o motor de
   DIFAL (DifalEngine). window.PrecificacaoElevadorStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  async function listarParametrosFiscais() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('parametros_fiscais_elevador').select('*').eq('id', 'default').single();
    if (error) throw error;
    return data;
  }

  async function salvarParametrosFiscais(patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('parametros_fiscais_elevador')
      .update({ ...patch, updated_at: new Date().toISOString(), updated_by: (window.__VP_USER || {}).email || null })
      .eq('id', 'default');
    if (error) throw error;
  }

  function paramsCamelCase(p) {
    return {
      regimeTributario: p.regime_tributario,
      icmsImportacaoPct: p.icms_importacao_pct, ipiImportacaoPct: p.ipi_importacao_pct,
      pisImportacaoPct: p.pis_importacao_pct, cofinsImportacaoPct: p.cofins_importacao_pct, iiImportacaoPct: p.ii_importacao_pct,
      icmsVendaPct: p.icms_venda_pct, ipiVendaPct: p.ipi_venda_pct, pisVendaPct: p.pis_venda_pct, cofinsVendaPct: p.cofins_venda_pct,
      irpjVendaPct: p.irpj_venda_pct, csllVendaPct: p.csll_venda_pct, irpjAdicionalPct: p.irpj_adicional_pct,
      impostosPagarServicosPct: p.impostos_pagar_servicos_pct, markUpPct: p.mark_up_padrao_pct,
      comissaoConsultoriaPct: p.comissao_consultoria_pct, comissaoVendedorPct: p.comissao_vendedor_pct, comissaoIndicacaoPct: p.comissao_indicacao_pct,
      margemMinimaPct: p.margem_minima_pct,
    };
  }

  /* ---------- Lista de cotações de fornecedor já respondidas (fila da Precificação) ----------
     Inclui respondido/em_analise/aprovada — não só respondido — porque o time
     comercial/ADM pode avançar a decisão de compra (ver cotacoes-fornecedor.jsx)
     antes ou depois do Financeiro abrir a precificação. Filtrar só por
     "respondido" fazia a cotação sumir da fila assim que alguém decidia
     comprar, mesmo sem a precificação ter sido feita ainda (issue #161). */
  async function listarPendentes() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: cots, error } = await c.from('cotacoes_elevador_fornecedor')
      .select('id, numero_documento, fornecedor, formulario_elevador_id, status, responded_at, categoria_produto')
      .in('status', ['respondido', 'em_analise', 'aprovada']).eq('categoria_produto', 'elevador').order('responded_at', { ascending: false });
    if (error) throw error;

    /* "Direto pra Precificação" (pedido do usuário, 19/08): preço já veio
       combinado por fora, formulário nunca passa por Cotação a Fornecedor.
       São formulários marcados com envio_direto_precificacao_em que ainda
       não viraram uma precificacoes_elevador. */
    const { data: diretos } = await c.from('formularios_elevador')
      .select('id, numero_cotacao, cliente_id, clientes(razao_social, cnpj), envio_direto_precificacao_em')
      .not('envio_direto_precificacao_em', 'is', null).order('envio_direto_precificacao_em', { ascending: false });

    const formularioIds = [...new Set((cots || []).map((c2) => c2.formulario_elevador_id))];
    const { data: forms } = formularioIds.length
      ? await c.from('formularios_elevador').select('id, numero_cotacao, cliente_id, clientes(razao_social, cnpj)').in('id', formularioIds)
      : { data: [] };
    const { data: precificacoes } = await c.from('precificacoes_elevador').select('id, cotacao_fornecedor_id, formulario_elevador_id, status');
    const formPorId = {}; (forms || []).forEach((f) => { formPorId[f.id] = f; });
    const pzPorCotacao = {}; (precificacoes || []).forEach((p) => { if (p.cotacao_fornecedor_id) pzPorCotacao[p.cotacao_fornecedor_id] = p; });
    const pzPorFormulario = {}; (precificacoes || []).forEach((p) => { if (!p.cotacao_fornecedor_id) pzPorFormulario[p.formulario_elevador_id] = p; });

    const daCotacao = (cots || []).map((cot) => {
      const form = formPorId[cot.formulario_elevador_id] || {};
      const pz = pzPorCotacao[cot.id];
      return {
        cotacaoFornecedorId: cot.id, numeroDocumentoFornecedor: cot.numero_documento, fornecedor: cot.fornecedor,
        formularioElevadorId: cot.formulario_elevador_id, numeroCotacao: form.numero_cotacao ?? null,
        clienteNome: (form.clientes && form.clientes.razao_social) || null, clienteCnpj: (form.clientes && form.clientes.cnpj) || null,
        respondedAt: cot.responded_at, precificacaoId: pz ? pz.id : null, precificacaoStatus: pz ? pz.status : null,
        statusCotacao: cot.status, direto: false,
      };
    });
    const diretosResultado = (diretos || [])
      .filter((form) => !pzPorFormulario[form.id]) // já virou precificação → some daqui, aparece na lista normal de precificações
      .map((form) => ({
        cotacaoFornecedorId: null, numeroDocumentoFornecedor: null, fornecedor: null,
        formularioElevadorId: form.id, numeroCotacao: form.numero_cotacao ?? null,
        clienteNome: (form.clientes && form.clientes.razao_social) || null, clienteCnpj: (form.clientes && form.clientes.cnpj) || null,
        respondedAt: form.envio_direto_precificacao_em, precificacaoId: null, precificacaoStatus: null,
        statusCotacao: null, direto: true,
      }));
    return [...diretosResultado, ...daCotacao];
  }

  /* ---------- Monta o snapshot inicial (modelos, quantidade, VMLE) a partir do
     Formulário + resposta do fornecedor — ponto de entrada "herdar o Cotação Nº".
     cotacaoFornecedorId nulo = caminho "direto pra Precificação" (pedido do
     usuário, 19/08): preço já veio combinado por fora (CEO/Financeiro por
     e-mail, telefone etc.), não faz sentido esperar resposta de fornecedor
     que nunca vai chegar. Modelos nascem das próprias unidades do
     Formulário, com valor zerado — o Financeiro digita à mão na tela de
     cálculo de sempre, igual já faz com VMLE/frete quando falta algo. */
  async function montarRascunho(formularioElevadorId, cotacaoFornecedorId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: formulario, error: e1 } = await c.from('formularios_elevador').select('*').eq('id', formularioElevadorId).single();
    if (e1) throw e1;

    let modelos, vmleUsd, freteSeguroCapataziaUsd;
    if (!cotacaoFornecedorId) {
      const { data: unidadesForm, error: e3 } = await c.from('formularios_elevador_unidades')
        .select('id, identificador, modelo, quantidade').eq('formulario_id', formularioElevadorId).order('indice_ativo');
      if (e3) throw e3;
      modelos = (unidadesForm || []).map((u) => ({
        unidadeId: u.id, identificador: u.identificador,
        modelo: u.modelo || '', quantidade: Number(u.quantidade) || 1,
        valorUnitarioUsd: 0,
      }));
      vmleUsd = 0;
      freteSeguroCapataziaUsd = 0;
    } else {
      const { data: cotFornecedor, error: e2 } = await c.from('cotacoes_elevador_fornecedor').select('*').eq('id', cotacaoFornecedorId).single();
      if (e2) throw e2;

      const unidades = (cotFornecedor.dados_envio && cotFornecedor.dados_envio.unidades) || [];
      const itensResposta = (cotFornecedor.respostas && cotFornecedor.respostas.itens) || [];
      const itemPorUnidade = {}; itensResposta.forEach((it) => { itemPorUnidade[it.unidade_id] = it; });

      modelos = unidades.map((u) => {
        const item = itemPorUnidade[u.unidade_id] || {};
        return {
          unidadeId: u.unidade_id, identificador: u.identificador,
          modelo: item.modelo_fornecedor || u.modelo || '',
          quantidade: Number(u.quantidade) || 1,
          valorUnitarioUsd: Number(item.preco_unitario) || 0,
        };
      });
      vmleUsd = itensResposta.reduce((s, it) => s + (Number(it.preco_total) || 0), 0);

      /* Frete internacional + outras taxas informados pelo fornecedor (USD) —
         agora campos estruturados na resposta — herdam pra o bucket USD de
         frete/seguro/capatazia da precificação (antes vinham zerados e o
         precificador tinha que digitar à mão, no campo errado). */
      const respostas = cotFornecedor.respostas || {};
      const freteInternacionalUsd = Number(respostas.frete_internacional_usd) || 0;
      const taxasExtrasUsd = Number(respostas.taxas_extras_usd) || 0;
      freteSeguroCapataziaUsd = freteInternacionalUsd + taxasExtrasUsd;
    }

    const parametros = await listarParametrosFiscais();

    return {
      formulario_elevador_id: formularioElevadorId,
      numero_cotacao: formulario.numero_cotacao ?? null,
      cotacao_fornecedor_id: cotacaoFornecedorId || null,
      vmle_usd: vmleUsd,
      frete_seguro_capatazia_usd: freteSeguroCapataziaUsd,
      modelos,
      percentual_servicos: 0.30,
      parametros_fiscais_snapshot: parametros,
      mark_up_pct: parametros.mark_up_padrao_pct,
      comissao_consultoria_pct: parametros.comissao_consultoria_pct,
      comissao_vendedor_pct: parametros.comissao_vendedor_pct,
      comissao_indicacao_pct: parametros.comissao_indicacao_pct,
      _formulario: formulario, // usado só em memória p/ montar o DIFAL — não é persistido
    };
  }

  async function gerarNumero() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.rpc('gerar_numero_precificacao_elevador');
    if (error) throw error;
    return data;
  }

  async function criar(formularioElevadorId, cotacaoFornecedorId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const rascunho = await montarRascunho(formularioElevadorId, cotacaoFornecedorId);
    delete rascunho._formulario;
    const numero_documento = await gerarNumero();
    const { data, error } = await c.from('precificacoes_elevador').insert({ ...rascunho, numero_documento }).select().single();
    if (error) throw error;
    return data;
  }

  async function obter(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('precificacoes_elevador').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async function salvar(id, patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('precificacoes_elevador').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  /* ---------- Calcula (2 passadas por causa do DIFAL — ver nota abaixo) e salva ---------- */
  async function calcularEsalvar(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const pz = await obter(id);
    const { data: formulario, error: e1 } = await c.from('formularios_elevador').select('*').eq('id', pz.formulario_elevador_id).single();
    if (e1) throw e1;
    // contribuinte_icms e o UF fiscal do cliente ficam em `clientes`, não em formularios_elevador.
    let cliente = null;
    if (formulario.cliente_id) {
      const { data } = await c.from('clientes').select('contribuinte_icms, endereco_estado').eq('id', formulario.cliente_id).maybeSingle();
      cliente = data;
    }

    const params = paramsCamelCase(pz.parametros_fiscais_snapshot || {});
    const baseInputs = {
      vmleUsd: pz.vmle_usd, seguroUsd: pz.seguro_usd, freteSeguroCapataziaUsd: pz.frete_seguro_capatazia_usd,
      siscomexRs: pz.siscomex_rs, txCambial: pz.tx_cambial, outrasDespesasImportacaoRs: pz.outras_despesas_importacao_rs,
      despachanteDesembaracoRs: pz.despachante_desembaraco_rs, demurrageRs: pz.demurrage_rs,
      freteInternoRs: pz.frete_interno_rs, armazenagemRs: pz.armazenagem_rs,
      itensInstalacaoMontagem: pz.itens_instalacao_montagem || [],
      quantidadeEquipamentos: (pz.modelos || []).reduce((s, m) => s + (Number(m.quantidade) || 0), 0) || 1,
      percentualServicos: pz.percentual_servicos, modelos: pz.modelos || [],
      markUpPct: pz.mark_up_pct, comissaoConsultoriaPct: pz.comissao_consultoria_pct,
      comissaoVendedorPct: pz.comissao_vendedor_pct, comissaoIndicacaoPct: pz.comissao_indicacao_pct,
      parametros: params,
    };

    // 1ª passada — sem DIFAL, só pra ter um "Valor da Operação" de referência.
    const pass1 = window.PrecificacaoElevadorEngine.calcular({ ...baseInputs, difalCustoRs: 0 });

    const ufFaturamento = cliente ? cliente.endereco_estado : null;
    const ufDestino = formulario.local_obra_estado || ufFaturamento;
    const estadoDestino = await window.DifalEngine.buscarEstado(ufDestino);
    const difal = window.DifalEngine.calcular({
      ufFaturamento, ufEntrega: formulario.local_obra_estado,
      finalidadeCompra: formulario.finalidade_compra, contribuinteIcms: cliente ? cliente.contribuinte_icms : null,
      valorOperacao: pass1.precificacao.precoVendaProposta, estadoDestino,
    });
    const difalCustoRs = difal.responsavel_recolhimento === 'emitente_verticalparts' ? difal.valor_difal : 0;

    // 2ª passada — já com o custo do DIFAL (quando é da VerticalParts) refletido no lucro.
    const resultado = window.PrecificacaoElevadorEngine.calcular({ ...baseInputs, difalCustoRs });

    await salvar(id, { resultado, difal, status: 'calculado' });
    return { resultado, difal };
  }

  /* ---------- Aprovação (issue #4) ----------
     "Calcular" só grava o resultado — nada travava preço abaixo da margem
     mínima nem campo obrigatório vazio, e a Proposta puxava a última
     precificação encontrada (calculada ou não) sem revisão nenhuma. Aprovar
     congela o snapshot que a Proposta vai usar (ver proposta-heranca.js,
     que agora prioriza status 'aprovado'). */
  function camposObrigatoriosFaltando(pz) {
    const faltando = [];
    if (!(Number(pz.vmle_usd) > 0)) faltando.push('VMLE (USD)');
    if (!(Number(pz.tx_cambial) > 0)) faltando.push('Câmbio (R$/US$)');
    if (!(pz.modelos || []).length) faltando.push('Unidades/modelos');
    /* 23/08 (Gelson): o custoTotalMercadorias calculado aqui vira o "teto de
       custo" que o CEO aprova mais adiante (ver aval-financeiro-store.js) —
       se a lista de custos de instalação/montagem estiver vazia, o teto
       fica artificialmente baixo (ART, Andaime/Munck, Frete etc. nunca
       entraram na conta), e o alerta de estouro vira ruído. Por isso passa
       a ser obrigatório listar pelo menos 1 item aqui antes de aprovar. */
    if (!(pz.itens_instalacao_montagem || []).length) faltando.push('Custos de instalação/montagem (ART, andaime/munck, frete, instalador…)');
    /* 23/08 (Gelson): comissão de vendedor é regra clara (padrão 2%, ver
       parametros_fiscais_elevador), mas nada impedia zerar sem querer —
       e ela agora conta pro teto de custo do CEO (ver
       aval-financeiro-store.js), então precisa estar preenchida. */
    if (!(Number(pz.comissao_vendedor_pct) > 0)) faltando.push('Comissão do vendedor (%)');
    return faltando;
  }

  async function aprovar(id, { forcarAbaixoMinima } = {}) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const pz = await obter(id);
    if (!pz.resultado) throw new Error('Calcule a precificação antes de aprovar.');
    const faltando = camposObrigatoriosFaltando(pz);
    if (faltando.length) throw new Error(`Campos obrigatórios sem valor: ${faltando.join(', ')}.`);
    const margemMinima = Number((pz.parametros_fiscais_snapshot || {}).margem_minima_pct) || 0;
    const margemFinal = Number((pz.resultado.precificacao || {}).margemFinalPct) || 0;
    if (margemFinal < margemMinima && !forcarAbaixoMinima) {
      const err = new Error(`Margem final (${(margemFinal * 100).toFixed(2)}%) abaixo da margem mínima (${(margemMinima * 100).toFixed(2)}%).`);
      err.margemAbaixoMinima = true;
      throw err;
    }
    const now = new Date().toISOString();
    // status usa o enum já existente na tabela ('rascunho'|'calculado'|'finalizado') — 'finalizado' é o estado de aprovado.
    const { error } = await c.from('precificacoes_elevador').update({
      status: 'finalizado', aprovado_em: now, aprovado_por: (window.__VP_USER || {}).email || null, updated_at: now,
    }).eq('id', id);
    if (error) throw error;
  }

  window.PrecificacaoElevadorStore = {
    listarParametrosFiscais, salvarParametrosFiscais,
    listarPendentes, criar, obter, salvar, calcularEsalvar,
    camposObrigatoriosFaltando, aprovar,
  };
}());
