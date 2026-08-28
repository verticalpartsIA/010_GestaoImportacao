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

  /* Parse best-effort do texto livre respostas.container_no (ex.: "1x40HC +
     1x20GP") em linhas estruturadas pro card "Despesas Operacionais" —
     preço sempre nasce 0 (o fornecedor do elevador não cota frete, só
     tamanho/quantidade de container; o preço vem depois do despachante).
     GP (General Purpose) mapeia pro mesmo tipo que EI_CONTAINER_TIPOS
     (embarques-importacao.jsx) chama de "DV" (Dry Van) — mesmo vocabulário
     usado depois no embarque físico. Trecho sem match reconhecível vira
     "Outro" com quantidade 1, pro Financeiro corrigir na mão.
     Exportado (window.PrecificacaoElevadorStore.parseContainerNo) só pra
     permitir teste unitário isolado. */
  function parseContainerNo(raw) {
    const txt = String(raw || '').trim();
    if (!txt) return [];
    const SUFIXO = { GP: 'DV', DV: 'DV', HC: 'HC', RF: 'RF', OT: 'OT', FR: 'FR' };
    return txt.split(/\s*\+\s*/).filter(Boolean).map((parte) => {
      const m = parte.match(/(\d+)\s*[xX]\s*(\d+)\s*'?\s*([A-Za-z]+)/);
      if (!m) return { tipo_tamanho: 'Outro', quantidade: 1, preco_rs: 0 };
      const quantidade = Number(m[1]) || 1;
      const sufixo = SUFIXO[m[3].toUpperCase()];
      return { tipo_tamanho: sufixo ? `${m[2]}'${sufixo}` : 'Outro', quantidade, preco_rs: 0 };
    });
  }

  /* ============================================================
     Busca automática de mão de obra (issue "Precificação real" Fase 3).
     custos_instalacao_elevador é indexada por tração × faixa de
     capacidade × paradas (ver cadastro-custos-store.js). Aqui só
     classificamos o resultado dessa busca: função pura, testável sem
     Supabase — window.PrecificacaoElevadorStore.classificarMaoDeObraUnidade.
     Situações seguem o vocabulário do documento de origem (regras_
     precificacao_real.json): confirmado (achou na tabela), pendente
     (falta tração/capacidade/paradas na Unidade) — projeto_especial=true
     quando a config existe mas caiu fora da cobertura da tabela (não
     retorna preço confirmado automaticamente, nunca extrapola). */
  function classificarMaoDeObraUnidade(modelo, custoTabela) {
    const unidadeId = modelo.unidadeId ?? null;
    const identificador = modelo.identificador ?? null;
    const tracao = modelo.tracao || null;
    const capacidadeKg = modelo.capacidadeKg != null && modelo.capacidadeKg !== '' ? Number(modelo.capacidadeKg) : null;
    const paradas = modelo.paradas != null && modelo.paradas !== '' ? Number(modelo.paradas) : null;
    const base = { unidadeId, identificador, tracao, capacidadeKg, paradas };

    if (!tracao || !paradas || !(capacidadeKg > 0)) {
      return {
        ...base, origem: 'manual', situacao: 'pendente', valorRs: 0,
        regraUsada: null, diasMontagem: null, qtdMontadores: null, dataBase: null,
        projetoEspecial: false,
        motivo: 'Falta tração, capacidade (kg) e/ou paradas na Unidade — preencha o Formulário de Elevadores.',
      };
    }
    if (!custoTabela) {
      return {
        ...base, origem: 'tabela_referencia', situacao: 'pendente', valorRs: 0,
        regraUsada: null, diasMontagem: null, qtdMontadores: null, dataBase: null,
        projetoEspecial: true,
        motivo: `Fora da cobertura da tabela de MO (tração ${tracao}, ${capacidadeKg}kg, ${paradas} paradas) — trate como projeto especial: exige estimativa versionada, justificativa e aprovação técnica/financeira antes de aprovar a precificação.`,
      };
    }
    return {
      ...base, origem: 'tabela_referencia', situacao: 'confirmado',
      valorRs: Number(custoTabela.valor_reajustado_rs) || 0,
      regraUsada: `tração ${tracao} × ${custoTabela.capacidade_min_kg}-${custoTabela.capacidade_max_kg}kg × ${paradas} paradas`,
      diasMontagem: custoTabela.dias_montagem ?? null,
      qtdMontadores: custoTabela.qtd_montadores ?? null,
      dataBase: custoTabela.atualizado_em || null,
      projetoEspecial: false,
      motivo: null,
    };
  }

  /* Orquestra a busca real (CadastroCustosStore.buscarCustoElevador, já
     existe desde Cadastros → Atualização de Custos) unidade por unidade
     e devolve a lista classificada — pronta pra virar o card "Mão de
     obra" da Precificação (Fase 4) e pra alimentar o motor V2
     (custo_economico_completo). Nunca lança: unidade sem tabela vira
     projeto especial, não erro. */
  async function buscarMaoDeObraAutomatica(modelos) {
    const store = window.CadastroCustosStore;
    const lista = Array.isArray(modelos) ? modelos : [];
    const resultados = [];
    for (const m of lista) {
      const capacidadeKg = m.capacidadeKg != null && m.capacidadeKg !== '' ? Number(m.capacidadeKg) : null;
      if (!store || !m.tracao || !m.paradas || !(capacidadeKg > 0)) {
        resultados.push(classificarMaoDeObraUnidade(m, null));
        continue;
      }
      let custoTabela = null;
      try { custoTabela = await store.buscarCustoElevador(m.tracao, capacidadeKg, Number(m.paradas)); }
      catch (e) { console.warn('[PrecificacaoElevadorStore] buscarMaoDeObraAutomatica falhou pra unidade', m.unidadeId, e); }
      resultados.push(classificarMaoDeObraUnidade(m, custoTabela));
    }
    return resultados;
  }

  /* pz.modelos é um snapshot congelado em montarRascunho() na hora em que a
     precificação foi criada — igual pz.dados_envio congela o que foi
     mandado pro fornecedor. Uma precificação criada antes de tracao/
     capacidade_kg/paradas entrarem em montarRascunho (ou antes do vendedor
     preencher isso no Formulário) fica com esses campos ausentes pra
     sempre, mesmo que o Formulário seja completado depois — "Recalcular"
     rodando só em cima do snapshot nunca via o dado novo. Esta função
     busca o valor ATUAL direto em formularios_elevador_unidades (fonte
     viva, não o snapshot) casando por unidadeId, antes de rodar a busca de
     MO — é o que faz o botão "Recalcular" (e reabrir depois de editar o
     Formulário) realmente refletir o que está lá agora. */
  async function refrescarSpecUnidades(modelos) {
    const c = sb(); if (!c) return modelos;
    const unidadeIds = (modelos || []).map((m) => m.unidadeId).filter(Boolean);
    if (!unidadeIds.length) return modelos;
    const { data: unidadesForm, error } = await c.from('formularios_elevador_unidades')
      .select('id, tracao, capacidade_kg, paradas').in('id', unidadeIds);
    if (error) { console.warn('[PrecificacaoElevadorStore] refrescarSpecUnidades falhou', error); return modelos; }
    const porId = {}; (unidadesForm || []).forEach((u) => { porId[u.id] = u; });
    return modelos.map((m) => {
      const u = porId[m.unidadeId];
      if (!u) return m;
      return {
        ...m,
        tracao: u.tracao || null,
        capacidadeKg: u.capacidade_kg != null ? Number(u.capacidade_kg) : null,
        paradas: u.paradas != null ? Number(u.paradas) : null,
      };
    });
  }

  /* Re-roda a busca sob demanda (ex.: vendedor completou tração/capacidade/
     paradas no Formulário depois da precificação já criada, ou Financeiro
     atualizou a tabela de MO em Cadastros) — sem recriar tudo do zero.
     Também atualiza pz.modelos com a spec fresca (ver refrescarSpecUnidades)
     antes de buscar; não mexe em itens_instalacao_montagem (lista manual,
     V1) nem dispara recálculo de preço sozinho. */
  async function atualizarMaoDeObra(id) {
    const pz = await obter(id);
    const modelos = await refrescarSpecUnidades(pz.modelos || []);
    const moLookup = await buscarMaoDeObraAutomatica(modelos);
    await salvar(id, { modelos, mo_lookup: moLookup });
    return moLookup;
  }

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

    let modelos, vmleUsd, freteSeguroCapataziaUsd, containersSeed = [];
    if (!cotacaoFornecedorId) {
      const { data: unidadesForm, error: e3 } = await c.from('formularios_elevador_unidades')
        .select('id, identificador, modelo, quantidade, tracao, capacidade_kg, paradas').eq('formulario_id', formularioElevadorId).order('indice_ativo');
      if (e3) throw e3;
      modelos = (unidadesForm || []).map((u) => ({
        unidadeId: u.id, identificador: u.identificador,
        modelo: u.modelo || '', quantidade: Number(u.quantidade) || 1,
        valorUnitarioUsd: 0,
        tracao: u.tracao || null,
        capacidadeKg: u.capacidade_kg != null ? Number(u.capacidade_kg) : null,
        paradas: u.paradas != null ? Number(u.paradas) : null,
      }));
      vmleUsd = 0;
      freteSeguroCapataziaUsd = 0;
    } else {
      const { data: cotFornecedor, error: e2 } = await c.from('cotacoes_elevador_fornecedor').select('*').eq('id', cotacaoFornecedorId).single();
      if (e2) throw e2;
      var cambioNaCotacao = cotFornecedor.cambio_na_resposta_usd_brl ?? null;

      const unidades = (cotFornecedor.dados_envio && cotFornecedor.dados_envio.unidades) || [];
      const itensResposta = (cotFornecedor.respostas && cotFornecedor.respostas.itens) || [];
      const itemPorUnidade = {}; itensResposta.forEach((it) => { itemPorUnidade[it.unidade_id] = it; });

      modelos = unidades.map((u) => {
        const item = itemPorUnidade[u.unidade_id] || {};
        return {
          unidadeId: u.unidade_id, identificador: u.identificador,
          modelo: item.modelo_fornecedor || u.modelo || '',
          quantidade: Number(u.quantidade) || 1,
          valorUnitarioUsd: window.parseMoeda(item.preco_unitario),
          tracao: u.tracao || null,
          capacidadeKg: u.capacidade_kg != null ? Number(u.capacidade_kg) : null,
          paradas: u.paradas != null ? Number(u.paradas) : null,
        };
      });
      vmleUsd = itensResposta.reduce((s, it) => s + window.parseMoeda(it.preco_total), 0);

      /* Frete internacional + outras taxas informados pelo fornecedor (USD) —
         agora campos estruturados na resposta — herdam pra o bucket USD de
         frete/seguro/capatazia da precificação (antes vinham zerados e o
         precificador tinha que digitar à mão, no campo errado). */
      const respostas = cotFornecedor.respostas || {};
      const freteInternacionalUsd = Number(respostas.frete_internacional_usd) || 0;
      const taxasExtrasUsd = Number(respostas.taxas_extras_usd) || 0;
      freteSeguroCapataziaUsd = freteInternacionalUsd + taxasExtrasUsd;

      containersSeed = parseContainerNo(respostas.container_no);
    }

    const parametros = await listarParametrosFiscais();
    const moLookup = await buscarMaoDeObraAutomatica(modelos);

    return {
      formulario_elevador_id: formularioElevadorId,
      numero_cotacao: formulario.numero_cotacao ?? null,
      cotacao_fornecedor_id: cotacaoFornecedorId || null,
      cambio_na_cotacao_usd_brl: typeof cambioNaCotacao !== 'undefined' ? cambioNaCotacao : null,
      vmle_usd: vmleUsd,
      frete_seguro_capatazia_usd: freteSeguroCapataziaUsd,
      containers: containersSeed,
      modelos,
      mo_lookup: moLookup,
      percentual_servicos: 0.30,
      parametros_fiscais_snapshot: parametros,
      mark_up_pct: parametros.mark_up_padrao_pct,
      // V2 (custo econômico completo) — motor oficial desde 29/08 (decisão
      // registrada em conversa, sem necessidade de aval formal do
      // Financeiro por enquanto). Nasce em modo markup_sobre_custo: mesma
      // alavanca de sempre (Markup sobre o custo, acima), só que aplicada
      // sobre o custo completo em vez de só a mercadoria — "aplicar 22%
      // precisa ser real". margem_desejada_pct fica preenchida como
      // referência caso o Financeiro troque de modo na tela.
      modo_formacao_preco: 'markup_sobre_custo',
      margem_desejada_pct: Number(parametros.margem_minima_pct) || 0.2,
      comissao_consultoria_pct: parametros.comissao_consultoria_pct,
      comissao_vendedor_pct: parametros.comissao_vendedor_pct,
      comissao_indicacao_pct: parametros.comissao_indicacao_pct,
      _formulario: formulario, // usado só em memória p/ montar o DIFAL — não é persistido
    };
  }

  /* Nº do documento (revisão 27/08): a Precificação NÃO tem mais numeração
     própria (RPC gerar_numero_precificacao_elevador, sequência independente
     "VPPZ-000X") — reaproveita o MESMO Nº da Cotação, só trocando o
     prefixo de etapa (VPPC-0950). Um único número acompanha o negócio do
     início ao fim; a sequência antiga fica só como fallback raríssimo
     (formulário sem numero_cotacao, o que não deveria acontecer). */
  async function criar(formularioElevadorId, cotacaoFornecedorId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const rascunho = await montarRascunho(formularioElevadorId, cotacaoFornecedorId);
    delete rascunho._formulario;
    let numero_documento;
    if (rascunho.numero_cotacao != null) {
      numero_documento = window.MasterIdEngine.etapaId('precificacao', rascunho.numero_cotacao);
    } else {
      const { data, error } = await c.rpc('gerar_numero_precificacao_elevador');
      if (error) throw error;
      numero_documento = data;
    }
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
      containers: pz.containers || [],
      itensDespesasExtras: pz.itens_despesas_extras || [],
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

    // V2 (custo econômico completo) roda lado a lado, mesmo baseInputs +
    // DIFAL da 2ª passada — nunca substitui o V1 (`resultado`, ainda o
    // motor oficial), só grava pra comparação/auditoria (Fase 4/5).
    // margem_desejada_pct fica null em toda precificação criada antes desta
    // coluna existir (a migration não tem default — só montarRascunho seta
    // pra registro novo); sem este fallback, calcularV2 tratava null como
    // 0% de margem desejada (Number(null)||0) e o preço/margem V2 saía
    // artificialmente baixo, sem o usuário nunca ter escolhido isso.
    const margemDesejadaPct = pz.margem_desejada_pct != null ? pz.margem_desejada_pct : (params.margemMinimaPct || 0.2);
    const resultadoV2 = window.PrecificacaoElevadorEngine.calcularV2({
      ...baseInputs, difalCustoRs,
      modoFormacaoPreco: pz.modo_formacao_preco,
      margemDesejadaPct,
      contingenciaValor: pz.contingencia_valor,
      outrosCustosNaoRecuperaveisRs: pz.outros_custos_nao_recuperaveis_rs,
    });

    await salvar(id, { resultado, resultado_v2: resultadoV2, difal, status: 'calculado' });
    return { resultado, resultadoV2, difal };
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
    // Motor oficial desde 29/08 é o V2 (custo econômico completo) — o V1
    // deixava markup positivo conviver com margem real negativa (issue
    // "Precificação real"). Precificação sem resultado_v2 ainda (nunca
    // recalculada após a migração) cai pro V1, não trava aprovação por
    // um dado que nunca existiu pra ela.
    const margemV2 = pz.resultado_v2 && pz.resultado_v2.precificacao ? Number(pz.resultado_v2.precificacao.margemEfetivaPct) : null;
    const margemFinal = margemV2 != null ? margemV2 : Number((pz.resultado.precificacao || {}).margemFinalPct) || 0;
    if (margemFinal < margemMinima && !forcarAbaixoMinima) {
      const err = new Error(`Margem ${margemV2 != null ? 'efetiva (V2)' : 'final (V1)'} (${(margemFinal * 100).toFixed(2)}%) abaixo da margem mínima (${(margemMinima * 100).toFixed(2)}%).`);
      err.margemAbaixoMinima = true;
      throw err;
    }
    const now = new Date().toISOString();
    // status usa o enum já existente na tabela ('rascunho'|'calculado'|'finalizado') — 'finalizado' é o estado de aprovado.
    const { error } = await c.from('precificacoes_elevador').update({
      status: 'finalizado', aprovado_em: now, aprovado_por: (window.__VP_USER || {}).email || null, updated_at: now,
    }).eq('id', id);
    if (error) throw error;

    /* Proposta nasce sozinha ao aprovar (pedido do usuário, 27/08) — puxa
       Lead/Cliente + o preço já calculado na Precificação (resultado.
       precoVendaPorEquipamento, via PropostaHeranca.montarPrefill, que já
       fazia isso pro fluxo manual). Nasce EDITÁVEL, pronta pra o vendedor
       revisar/ajustar e disparar manualmente — a trava (won_editable/
       destravada_em) só entra quando a PROPOSTA em si for aprovada, igual
       já funciona hoje. Idempotente: não duplica se já existe proposta
       pra esse Nº de Cotação (ex.: alguém já criou manualmente antes).
       Falha aqui não desfaz a aprovação da Precificação — só avisa. */
    try {
      await criarPropostaAutomatica({ ...pz, numero_cotacao: pz.numero_cotacao });
    } catch (e) {
      console.warn('[PrecificacaoElevadorStore] Falha ao criar proposta automática ao aprovar:', e);
    }
  }

  async function criarPropostaAutomatica(pz) {
    const c = sb();
    if (!c || pz.numero_cotacao == null || !window.PropostaHeranca || !window.PropostaStore || !window.MasterIdEngine) return;
    const { data: existente } = await c.from('propostas').select('id').eq('numero_cotacao', pz.numero_cotacao).maybeSingle();
    if (existente) return; // já tem proposta pra essa cotação — não duplica
    const r = await window.PropostaHeranca.prefillPorNumeroCotacao(pz.numero_cotacao);
    if (!r.encontrado) return;
    const numero = window.MasterIdEngine.etapaId('proposta', pz.numero_cotacao);
    const valorUnit = Number((r.prefill.elevador || {}).valores?.valorUnit) || 0;
    const quantidade = Number((r.prefill.elevador || {}).valores?.quantidade) || 1;
    const dadosCompletos = window.deepMergeHeranca(window.makeDefaultProposta(), { ...r.prefill, numero });
    await window.PropostaStore.salvar({ data: dadosCompletos, eq: 'elevador', editId: null, valorTotal: valorUnit * quantidade });
  }

  /* ---------- Ressincroniza modelos/vmle a partir da resposta do fornecedor ----------
     Cobre o caso comum: a precificação nasceu ANTES do fornecedor responder
     (ou a resposta veio em formato de texto tipo "$18,990" — bug corrigido
     27/08, ver window.parseMoeda), então valorUnitarioUsd ficou zerado e
     nunca foi atualizado sozinho depois. Só reescreve valorUnitarioUsd (por
     unidade, casando por unidadeId) e vmle_usd — preserva tudo mais que o
     Financeiro já tenha digitado (câmbio, frete, percentuais). Sem
     cotacao_fornecedor_id (fluxo "direto pra Precificação") não há o que
     ressincronizar — lança erro claro em vez de silenciar. */
  async function ressincronizarDoFornecedor(precificacaoId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const pz = await obter(precificacaoId);
    if (!pz.cotacao_fornecedor_id) throw new Error('Esta precificação não veio de uma Cotação a Fornecedor — nada para ressincronizar.');
    const { data: cotFornecedor, error } = await c.from('cotacoes_elevador_fornecedor').select('*').eq('id', pz.cotacao_fornecedor_id).single();
    if (error) throw error;
    const itensResposta = (cotFornecedor.respostas && cotFornecedor.respostas.itens) || [];
    if (!itensResposta.length) throw new Error('O fornecedor ainda não respondeu esta cotação.');
    const itemPorUnidade = {}; itensResposta.forEach((it) => { itemPorUnidade[it.unidade_id] = it; });

    const modelos = (pz.modelos || []).map((m) => {
      const item = itemPorUnidade[m.unidadeId];
      if (!item) return m;
      return { ...m, modelo: item.modelo_fornecedor || m.modelo, valorUnitarioUsd: window.parseMoeda(item.preco_unitario) };
    });
    const vmleUsd = itensResposta.reduce((s, it) => s + window.parseMoeda(it.preco_total), 0);
    // Câmbio congelado: só preenche se ainda não tinha (precificação nasceu
    // antes dessa coluna existir, ou antes do fornecedor ter câmbio salvo) —
    // depois de setado uma vez, nunca reescreve (é congelado por definição).
    const patch = { modelos, vmle_usd: vmleUsd };
    if (pz.cambio_na_cotacao_usd_brl == null && cotFornecedor.cambio_na_resposta_usd_brl != null) {
      patch.cambio_na_cotacao_usd_brl = cotFornecedor.cambio_na_resposta_usd_brl;
    }
    await salvar(precificacaoId, patch);
    return { modelos, vmle_usd: vmleUsd };
  }

  window.PrecificacaoElevadorStore = {
    listarParametrosFiscais, salvarParametrosFiscais,
    listarPendentes, criar, obter, salvar, calcularEsalvar,
    camposObrigatoriosFaltando, aprovar, ressincronizarDoFornecedor,
    parseContainerNo,
    classificarMaoDeObraUnidade, buscarMaoDeObraAutomatica, atualizarMaoDeObra,
  };
}());
