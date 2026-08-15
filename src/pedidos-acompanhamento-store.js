/* ============================================================
   pedidos-acompanhamento-store.js
   Pedidos — acompanhamento de status de pedidos de compra (Nacional/
   Importação). NÃO é pedidos_fornecedor (esse é o envio de RFQ nacional
   com rastreamento de visualização/resposta) — são coisas diferentes.

   window.PedidosAcompanhamentoStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  async function listarTodos() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('pedidos_acompanhamento').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[PedidosAcompanhamentoStore] listarTodos falhou', error); return []; }
    return data || [];
  }

  function _payload(form) {
    return {
      numero_pedido: form.numero_pedido || null, setor: form.setor || 'Nacional',
      fornecedor: form.fornecedor || null, descricao: form.descricao || null,
      status: form.status || 'Aberto', data_pedido: form.data_pedido || null,
      data_prevista: form.data_prevista || null, data_recebimento: form.data_recebimento || null,
      valor_total: form.valor_total !== '' && form.valor_total != null ? Number(form.valor_total) : null,
      moeda: form.moeda || 'BRL', observacoes: form.observacoes || null,
    };
  }

  async function criar(form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const row = { ..._payload(form), created_by: (window.__VP_USER || {}).email || null };
    const { data, error } = await c.from('pedidos_acompanhamento').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function atualizar(id, form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const row = { ..._payload(form), updated_at: new Date().toISOString() };
    const { data, error } = await c.from('pedidos_acompanhamento').update(row).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function remover(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('pedidos_acompanhamento').delete().eq('id', id);
    if (error) throw error;
  }

  window.PedidosAcompanhamentoStore = { listarTodos, criar, atualizar, remover };
}());
