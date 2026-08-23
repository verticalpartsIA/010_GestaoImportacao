/* ============================================================
   embarques-importacao-store.js
   Gestão Importação · Embarques — Fase 4 da consolidação de importação
   dentro do VP Gestão.

   Não confundir com a tabela `embarques` (rastreamento AIS / mapa de
   navios, item "Importação" > "Mapa de navios" na Logística) — essa
   continua separada e intocada, por decisão explícita. Este módulo é o
   Embarques rico da Gestão Importação, vinculado às P.I. (pi_importacao)
   via embarque_id.

   window.EmbarquesImportacaoStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  async function listarTodas() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('embarques_importacao').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[EmbarquesImportacaoStore] listarTodas falhou', error); return []; }
    return data || [];
  }

  async function obter(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('embarques_importacao').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  /* PIs vinculadas a este embarque — fonte automática de fornecedor,
     incoterms, categorias, nºs de série, pagamentos e produção (mesma
     lógica do Base44 original: a P.I. é a fonte da verdade, o Embarque só
     agrega/exibe). */
  async function listarPIsVinculadas(embarqueId) {
    const c = sb(); if (!c || !embarqueId) return [];
    const { data, error } = await c.from('pi_importacao').select('*').eq('embarque_id', embarqueId);
    if (error) { console.warn('[EmbarquesImportacaoStore] listarPIsVinculadas falhou', error); return []; }
    return data || [];
  }

  function unique(arr) { return [...new Set((arr || []).filter(Boolean))]; }

  function resumoPIs(pis) {
    const piNumbers = unique(pis.map((p) => p.numero_pi));
    const fornecedores = unique(pis.map((p) => p.fornecedor));
    const incoterms = unique(pis.map((p) => p.incoterms));
    const categorias = unique(pis.flatMap((p) => p.categorias || []));
    const numerosSerie = unique(pis.flatMap((p) => p.numeros_serie || []));
    const numerosRequisicao = unique(pis.map((p) => p.numero_requisicao));
    const datasAbertura = pis.map((p) => p.data_abertura).filter(Boolean).sort();
    const valorTotal = pis.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
    const moeda = (pis[0] && pis[0].moeda) || 'USD';
    return { piNumbers, fornecedores, incoterms, categorias, numerosSerie, numerosRequisicao, dataPi: datasAbertura[0] || '', valorTotal, moeda };
  }

  function _payload(form, pis) {
    const containers = (form.containers || []).map((c) => ({ ...c, peso: c.peso !== '' && c.peso != null ? Number(c.peso) : null })).filter((c) => c.numero);
    const nfes = (form.nfes || []).map((n) => ({ ...n, valor: n.valor !== '' && n.valor != null ? Number(n.valor) : null })).filter((n) => n.numero);
    const resumo = resumoPIs(pis || []);
    const num = (v) => (v === '' || v == null ? null : Number(v));
    return {
      nome_embarque: form.nome_embarque || null, status_etapa: form.status_etapa || 'Pagamento',
      valor_total: resumo.valorTotal || null, moeda_valor_total: resumo.moeda || form.moeda_valor_total || 'USD',
      referencia_embarque: form.referencia_embarque || null, porto_origem: form.porto_origem || null, porto_destino: form.porto_destino || null,
      navio: form.navio || null, awb_bl: form.awb_bl || null, redestinacao: form.redestinacao || null,
      data_pedido_redestinacao: form.data_pedido_redestinacao || null,
      etd_original: form.etd_original || null, etd_atual: form.etd_atual || null, houve_rolagem: !!form.houve_rolagem,
      historico_rolagens: form.historico_rolagens || [], containers,
      tipo_frete: form.tipo_frete || null, modalidade_frete: form.modalidade_frete || null, agente_carga: form.agente_carga || null,
      cotacao_frete: num(form.cotacao_frete), moeda_frete: form.moeda_frete || 'USD', aprovacao_frete: form.aprovacao_frete || 'Pendente',
      pedido_booking: form.pedido_booking || null, transit_time: num(form.transit_time), free_time: num(form.free_time),
      referencia_despachante: form.referencia_despachante || null, custos_estimativa: num(form.custos_estimativa),
      documentos_marimex: form.documentos_marimex || null, transit_time_total: num(form.transit_time_total),
      di: form.di || null, data_registro_di: form.data_registro_di || null, canal_parametrizacao: form.canal_parametrizacao || null,
      ultima_data_free_time: form.ultima_data_free_time || null, eta_santos: form.eta_santos || null, historico_eta: form.historico_eta || [],
      conferencia_status: form.conferencia_status || null, conferencia_motivo: form.conferencia_motivo || null, conferencia_data: form.conferencia_data || null,
      empresa_desembaraco: form.empresa_desembaraco || null, faturamento_desembaraco: num(form.faturamento_desembaraco),
      numerario_desembaraco: num(form.numerario_desembaraco), valor_reembolso: num(form.valor_reembolso),
      status_reembolso: form.status_reembolso || 'Não solicitado', data_solicitacao_reembolso: form.data_solicitacao_reembolso || null,
      data_recebimento_reembolso: form.data_recebimento_reembolso || null, observacoes_financeiras: form.observacoes_financeiras || null,
      data_limite_entrega: form.data_limite_entrega || null, local_entrega: form.local_entrega || null,
      data_carregamento: form.data_carregamento || null, data_entrega: form.data_entrega || null, devolucao_container: form.devolucao_container || null,
      nfes, observacoes: form.observacoes || null, historico: form.historico || [], arquivado: !!form.arquivado,
    };
  }

  async function criar(form, pis) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const user = window.__VP_USER || {};
    const historico = [{ data: new Date().toISOString(), descricao: 'Embarque criado', usuario: user.nome || user.email || 'Sistema' }];
    const row = { ..._payload({ ...form, historico }, pis), created_by: user.email || null };
    const { data, error } = await c.from('embarques_importacao').insert(row).select().single();
    if (error) throw error;
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'EMBARQUE_CRIADO', numeroCotacao: data.numero_cotacao, alvoLabel: data.nome || data.id, alvoId: data.id,
    });
    return data;
  }

  async function atualizar(id, form, pis) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const user = window.__VP_USER || {};
    const historico = [...(form.historico || []), { data: new Date().toISOString(), descricao: 'Embarque atualizado', usuario: user.nome || user.email || 'Sistema' }];
    const row = { ..._payload({ ...form, historico }, pis), updated_at: new Date().toISOString() };
    const { data, error } = await c.from('embarques_importacao').update(row).eq('id', id).select().single();
    if (error) throw error;
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'EMBARQUE_ATUALIZADO', numeroCotacao: data.numero_cotacao, alvoLabel: data.nome || data.id, alvoId: data.id,
    });
    return data;
  }

  async function remover(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('embarques_importacao').delete().eq('id', id);
    if (error) throw error;
  }

  async function arquivar(id, arquivado) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('embarques_importacao').update({ arquivado, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  window.EmbarquesImportacaoStore = { listarTodas, obter, listarPIsVinculadas, resumoPIs, criar, atualizar, remover, arquivar };
}());
