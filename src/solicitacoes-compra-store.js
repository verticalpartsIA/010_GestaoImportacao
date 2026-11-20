/* ============================================================
   solicitacoes-compra-store.js — Solicitações de Compra do vendedor (window.SolicitacoesCompraStore).
   Leitura direta (RLS: o solicitante vê as suas; o comprador vê todas). Toda escrita passa pelas funções do banco
   iv_solicitacao_* (conferem alçada e regra). Tabelas iv_solicitacoes / _itens / _hist (migration 20261117100000).
   Erro nunca é silencioso: as funções lançam e a tela mostra a mensagem (SolicitacoesCompraCalc.mensagemErro).
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }
  function cli() { const c = sb(); if (!c) throw new Error('Supabase não carregado'); return c; }
  function emailAtual() { return String((window.__VP_USER || {}).email || '').toLowerCase(); }

  async function rpc(nome, args) {
    const { data, error } = await cli().rpc(nome, args);
    if (error) throw new Error(window.SolicitacoesCompraCalc ? window.SolicitacoesCompraCalc.mensagemErro(error) : error.message);
    return data;
  }

  /* Lista as solicitações visíveis para o usuário (a RLS filtra) com os itens ativos de cada uma. */
  async function listar() {
    const c = cli();
    const { data: sols, error } = await c.from('iv_solicitacoes').select('*').order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    const ids = (sols || []).map((s) => s.id);
    if (!ids.length) return [];
    const { data: itens, error: e2 } = await c.from('iv_solicitacao_itens').select('*').in('solicitacao_id', ids).is('removido_em', null).order('ordem');
    if (e2) throw e2;
    const loteIds = [...new Set((itens || []).map((i) => i.lote_id).filter(Boolean))];
    let lotes = {};
    if (loteIds.length) {
      const { data: ls, error: e3 } = await c.from('iv_cotacao_lotes').select('id, numero, titulo, status').in('id', loteIds);
      if (e3) throw e3;
      (ls || []).forEach((l) => { lotes[l.id] = l; });
    }
    const porSol = {};
    (itens || []).forEach((i) => { (porSol[i.solicitacao_id] = porSol[i.solicitacao_id] || []).push({ ...i, lote: i.lote_id ? lotes[i.lote_id] || null : null }); });
    return sols.map((s) => ({ ...s, itens: porSol[s.id] || [] }));
  }

  async function historico(solicitacaoId) {
    const { data, error } = await cli().from('iv_solicitacao_hist').select('*').eq('solicitacao_id', solicitacaoId).order('em', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /* Lotes que aceitam itens (rascunho) para o comprador escolher onde alocar. */
  async function lotesAbertos() {
    const { data, error } = await cli().from('iv_cotacao_lotes').select('id, numero, titulo, criado_por_nome, status').eq('status', 'rascunho').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  }

  async function enviar(itens, dados) {
    const r = await rpc('iv_solicitacao_enviar', { p_itens: itens, p_dados: dados || {} });
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Solicitações de Compra', acao: 'Enviou a solicitação de compra', alvo: r && r.numero, alvo_id: r && r.id, detalhe: { itens: r && r.itens } });
    return r;
  }
  async function editar(id, itens, dados) {
    const r = await rpc('iv_solicitacao_editar', { p_id: id, p_itens: itens, p_dados: dados || {} });
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Solicitações de Compra', acao: 'Editou/reenviou a solicitação de compra', alvo: r && r.numero, alvo_id: id });
    return r;
  }
  async function cancelar(id) {
    await rpc('iv_solicitacao_cancelar', { p_id: id });
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Solicitações de Compra', acao: 'Cancelou a solicitação de compra', alvo_id: id });
  }
  async function devolver(id, motivo) {
    await rpc('iv_solicitacao_devolver', { p_id: id, p_motivo: motivo });
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Solicitações de Compra', acao: 'Devolveu a solicitação ao vendedor', alvo_id: id, detalhe: { motivo } });
  }
  /* loteId nulo = cria lote novo (rascunho) com o título informado. */
  async function alocar(itemIds, loteId, titulo) {
    const r = await rpc('iv_solicitacao_alocar', { p_item_ids: itemIds, p_lote_id: loteId || null, p_titulo: titulo || null });
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Solicitações de Compra', acao: 'Alocou itens de solicitações em cotação', alvo: r && r.numero, alvo_id: r && r.lote_id, detalhe: { adicionados: r && r.adicionados, somados: r && r.somados } });
    return r;
  }

  /* Origem dos itens de um lote: { lote_item_id: [{ numero, vendedor, quantidade }] } (um item pode juntar pedidos de vários vendedores).
     Falha de leitura (ex.: sem permissão) = sem selo, nunca erro na tela da cotação. */
  async function origemDosItens(itensDoLote) {
    const ids = (itensDoLote || []).map((i) => i.id).filter(Boolean);
    if (!ids.length) return {};
    try {
      const c = cli();
      const { data: its, error } = await c.from('iv_solicitacao_itens').select('lote_item_id, solicitacao_id, quantidade').in('lote_item_id', ids).is('removido_em', null);
      if (error || !its || !its.length) return {};
      const solIds = [...new Set(its.map((x) => x.solicitacao_id))];
      const { data: ss, error: e2 } = await c.from('iv_solicitacoes').select('id, numero, vendedor_nome, solicitante_nome').in('id', solIds);
      if (e2 || !ss) return {};
      const porId = {}; ss.forEach((s) => { porId[s.id] = s; });
      const out = {};
      its.forEach((x) => {
        const s = porId[x.solicitacao_id]; if (!s) return;
        (out[x.lote_item_id] = out[x.lote_item_id] || []).push({ numero: s.numero, vendedor: s.vendedor_nome || s.solicitante_nome || '—', quantidade: x.quantidade });
      });
      return out;
    } catch (e) { return {}; }
  }

  async function podeSolicitar() {
    try { const { data } = await cli().rpc('iv_solicitacao_pode_solicitar'); return !!data; } catch (e) { return false; }
  }
  async function podeTratar() {
    try { const { data } = await cli().rpc('iv_solicitacao_pode_tratar'); return !!data; } catch (e) { return false; }
  }

  window.SolicitacoesCompraStore = { emailAtual, listar, historico, lotesAbertos, origemDosItens, enviar, editar, cancelar, devolver, alocar, podeSolicitar, podeTratar };
}());
