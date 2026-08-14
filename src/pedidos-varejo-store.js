/* ============================================================
   pedidos-varejo-store.js
   Almoxarifado — Pedidos de Compra de Varejo (insumos/peças pra estoque,
   NÃO equipamento de venda — esse segue o pipeline de Cotação a
   Fornecedor). Todo pedido nasce com uma decisão pendente do Chefe de
   Logística (Danilo) — ver decisoes-store.js.
   window.PedidosVarejoStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  async function gerarNumero() {
    const c = sb();
    const { data } = await c.from('pedidos_compra_varejo').select('numero_documento').order('criado_em', { ascending: false }).limit(1);
    const ultimo = data && data[0] && data[0].numero_documento;
    const n = ultimo ? (parseInt(ultimo.replace(/\D/g, ''), 10) || 0) + 1 : 1;
    return 'VPV-' + String(n).padStart(4, '0');
  }

  async function criarPedido({ item, quantidade, unidade, valorEstimado, urgencia, justificativa }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!item || !item.trim()) throw new Error('Informe o item.');
    const user = window.__VP_USER || {};
    const numero_documento = await gerarNumero();
    const row = {
      numero_documento, item: item.trim(), quantidade: Number(quantidade) || 1, unidade: unidade || null,
      valor_estimado: valorEstimado != null && valorEstimado !== '' ? Number(valorEstimado) : null,
      urgencia: urgencia || 'normal', justificativa: justificativa || null,
      solicitante_email: user.email || null, solicitante_nome: user.name || user.email || null,
      status: 'pendente',
    };
    const { data: pedido, error } = await c.from('pedidos_compra_varejo').insert(row).select().single();
    if (error) throw error;

    const decisao = await window.DecisoesStore.criarDecisaoCompraVarejo(pedido.id, {
      item: pedido.item, quantidade: pedido.quantidade, valor: pedido.valor_estimado,
      solicitante: pedido.solicitante_nome, urgencia: pedido.urgencia,
    });
    await c.from('pedidos_compra_varejo').update({ decisao_id: decisao.id }).eq('id', pedido.id);
    return { ...pedido, decisao_id: decisao.id };
  }

  /* Lê o status direto da decisão vinculada — sem isso, aprovar pela Central
     de Decisões (que não sabe nada sobre `pedidos_compra_varejo`) deixaria
     o pedido "pendente" pra sempre aos olhos do Almoxarifado, mesmo já
     decidido. Autocura a cada listagem, sem precisar de trigger/webhook. */
  async function listarPedidos() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('pedidos_compra_varejo').select('*, decisoes_gerenciais(status, decidido_por, decidido_em, motivo)').order('criado_em', { ascending: false });
    if (error) { console.warn('[PedidosVarejoStore] listarPedidos falhou', error); return []; }
    const pedidos = data || [];
    const paraCorrigir = [];
    const resultado = pedidos.map((p) => {
      const dec = p.decisoes_gerenciais;
      const statusReal = !dec ? p.status : dec.status === 'aprovada' ? 'aprovado' : dec.status === 'reprovada' ? 'reprovado' : 'pendente';
      if (statusReal !== p.status && !['comprado', 'cancelado'].includes(p.status)) paraCorrigir.push(p.id);
      return { ...p, status: p.status === 'comprado' || p.status === 'cancelado' ? p.status : statusReal, decidido_por: dec && dec.decidido_por, motivo: dec && dec.motivo };
    });
    if (paraCorrigir.length) {
      await Promise.all(resultado.filter((p) => paraCorrigir.includes(p.id))
        .map((p) => c.from('pedidos_compra_varejo').update({ status: p.status, atualizado_em: new Date().toISOString() }).eq('id', p.id)));
    }
    return resultado;
  }

  async function marcarComprado(pedidoId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: pedido } = await c.from('pedidos_compra_varejo').select('status').eq('id', pedidoId).maybeSingle();
    if (!pedido || pedido.status !== 'aprovado') throw new Error('Só é possível marcar como comprado um pedido aprovado.');
    const { error } = await c.from('pedidos_compra_varejo').update({ status: 'comprado', atualizado_em: new Date().toISOString() }).eq('id', pedidoId);
    if (error) throw error;
  }

  window.PedidosVarejoStore = { criarPedido, listarPedidos, marcarComprado };
}());
