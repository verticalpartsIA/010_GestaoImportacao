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
    };
  }

  /* ---------- Lista de cotações de fornecedor já respondidas (fila da Precificação) ---------- */
  async function listarPendentes() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: cots, error } = await c.from('cotacoes_elevador_fornecedor')
      .select('id, numero_documento, fornecedor, formulario_elevador_id, status, responded_at')
      .eq('status', 'respondido').order('responded_at', { ascending: false });
    if (error) throw error;
    const formularioIds = [...new Set((cots || []).map((c2) => c2.formulario_elevador_id))];
    if (!formularioIds.length) return [];
    const { data: forms } = await c.from('formularios_elevador')
      .select('id, numero_cotacao, cliente_id, clientes(razao_social, cnpj)').in('id', formularioIds);
    const { data: precificacoes } = await c.from('precificacoes_elevador').select('id, cotacao_fornecedor_id, status');
    const formPorId = {}; (forms || []).forEach((f) => { formPorId[f.id] = f; });
    const pzPorCotacao = {}; (precificacoes || []).forEach((p) => { if (p.cotacao_fornecedor_id) pzPorCotacao[p.cotacao_fornecedor_id] = p; });
    return (cots || []).map((cot) => {
      const form = formPorId[cot.formulario_elevador_id] || {};
      const pz = pzPorCotacao[cot.id];
      return {
        cotacaoFornecedorId: cot.id, numeroDocumentoFornecedor: cot.numero_documento, fornecedor: cot.fornecedor,
        formularioElevadorId: cot.formulario_elevador_id, numeroCotacao: form.numero_cotacao ?? null,
        clienteNome: (form.clientes && form.clientes.razao_social) || null, clienteCnpj: (form.clientes && form.clientes.cnpj) || null,
        respondedAt: cot.responded_at, precificacaoId: pz ? pz.id : null, precificacaoStatus: pz ? pz.status : null,
      };
    });
  }

  /* ---------- Monta o snapshot inicial (modelos, quantidade, VMLE) a partir do
     Formulário + resposta do fornecedor — ponto de entrada "herdar o Cotação Nº" ---------- */
  async function montarRascunho(formularioElevadorId, cotacaoFornecedorId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: formulario, error: e1 } = await c.from('formularios_elevador').select('*').eq('id', formularioElevadorId).single();
    if (e1) throw e1;
    const { data: cotFornecedor, error: e2 } = await c.from('cotacoes_elevador_fornecedor').select('*').eq('id', cotacaoFornecedorId).single();
    if (e2) throw e2;

    const unidades = (cotFornecedor.dados_envio && cotFornecedor.dados_envio.unidades) || [];
    const itensResposta = (cotFornecedor.respostas && cotFornecedor.respostas.itens) || [];
    const itemPorUnidade = {}; itensResposta.forEach((it) => { itemPorUnidade[it.unidade_id] = it; });

    const modelos = unidades.map((u) => {
      const item = itemPorUnidade[u.unidade_id] || {};
      return {
        unidadeId: u.unidade_id, identificador: u.identificador,
        modelo: item.modelo_fornecedor || u.modelo || '',
        quantidade: Number(u.quantidade) || 1,
        valorUnitarioUsd: Number(item.preco_unitario) || 0,
      };
    });
    const quantidadeEquipamentos = modelos.reduce((s, m) => s + m.quantidade, 0) || 1;
    const vmleUsd = itensResposta.reduce((s, it) => s + (Number(it.preco_total) || 0), 0);

    const parametros = await listarParametrosFiscais();

    return {
      formulario_elevador_id: formularioElevadorId,
      numero_cotacao: formulario.numero_cotacao ?? null,
      cotacao_fornecedor_id: cotacaoFornecedorId,
      vmle_usd: vmleUsd,
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

  window.PrecificacaoElevadorStore = {
    listarParametrosFiscais, salvarParametrosFiscais,
    listarPendentes, criar, obter, salvar, calcularEsalvar,
  };
}());
