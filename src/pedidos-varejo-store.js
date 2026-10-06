/* ============================================================
   pedidos-varejo-store.js
   Almoxarifado — Pedidos de Compra de Varejo (insumos/peças pra estoque,
   NÃO equipamento de venda — esse segue o pipeline de Cotação a
   Fornecedor). Todo pedido nasce com uma decisão pendente do Chefe de
   Logística (Danilo) — ver decisoes-store.js.
   Regras que existem por motivo real:
   - Número VPV-NNNN tem índice único no banco; se dois pedidos nascerem juntos, o segundo tenta o número seguinte.
   - Se a decisão de aprovação não puder ser criada, o pedido NÃO fica pendente sem dono: é cancelado com o motivo e o erro sobe.
   - Quantidade precisa ser > 0 e valor estimado >= 0 (antes 0 virava 1 sem aviso).
   - Cancelar: só o solicitante ou quem tem a alçada Excluir do Almoxarifado; cancela também a decisão ainda pendente.
   - "Comprado" registra quem, quando, fornecedor, nº do pedido no Omie e valor real.
   window.PedidosVarejoStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }
  const meuEmail = () => String((window.__VP_USER || {}).email || '').toLowerCase();

  async function gerarNumero() {
    const c = sb();
    const { data } = await c.from('pedidos_compra_varejo').select('numero_documento').order('numero_documento', { ascending: false }).limit(1);
    const ultimo = data && data[0] && data[0].numero_documento;
    const n = ultimo ? (parseInt(ultimo.replace(/\D/g, ''), 10) || 0) + 1 : 1;
    return 'VPV-' + String(n).padStart(4, '0');
  }

  async function criarPedido({ item, quantidade, unidade, valorEstimado, urgencia, justificativa, codigoProduto }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!item || !item.trim()) throw new Error('Informe o item.');
    const qtd = Number(quantidade);
    if (!(qtd > 0)) throw new Error('A quantidade precisa ser maior que zero.');
    const val = valorEstimado != null && valorEstimado !== '' ? Number(valorEstimado) : null;
    if (val != null && !(val >= 0)) throw new Error('O valor estimado não pode ser negativo.');
    const user = window.__VP_USER || {};
    const base = {
      item: item.trim(), quantidade: qtd, unidade: unidade || null, valor_estimado: val, codigo_produto: codigoProduto || null,
      urgencia: urgencia || 'normal', justificativa: justificativa || null,
      solicitante_email: user.email || null, solicitante_nome: user.name || user.email || null,
      status: 'pendente',
    };
    let pedido = null, ultimoErro = null;
    for (let tentativa = 0; tentativa < 5 && !pedido; tentativa++) {
      const numero_documento = await gerarNumero();
      const r = await c.from('pedidos_compra_varejo').insert({ ...base, numero_documento }).select().single();
      if (!r.error) { pedido = r.data; break; }
      ultimoErro = r.error;
      if (r.error.code !== '23505') break;                              // só repete se o número já foi usado por outro pedido
    }
    if (!pedido) throw ultimoErro || new Error('Não foi possível criar o pedido.');
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Almoxarifado', acao: 'Criou pedido de compra varejo', alvo: pedido.numero_documento, alvo_id: pedido.id,
      detalhe: { item: pedido.item, quantidade: pedido.quantidade },
    });

    let decisao;
    try {
      decisao = await window.DecisoesStore.criarDecisaoCompraVarejo(pedido.id, {
        item: pedido.item, quantidade: pedido.quantidade, valor: pedido.valor_estimado,
        solicitante: pedido.solicitante_nome, urgencia: pedido.urgencia,
      });
      if (!decisao || !decisao.id) throw new Error('decisão não criada');
    } catch (e) {
      await c.from('pedidos_compra_varejo').update({
        status: 'cancelado', cancelado_em: new Date().toISOString(), cancelado_por: 'sistema',
        cancelado_motivo: 'Falha ao criar a decisão de aprovação: ' + (e.message || e), atualizado_em: new Date().toISOString(),
      }).eq('id', pedido.id);
      throw new Error('Não foi possível enviar o pedido para aprovação (' + (e.message || e) + '). Tente de novo.');
    }
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
      const statusReal = !dec ? p.status : dec.status === 'aprovada' ? 'aprovado' : dec.status === 'reprovada' ? 'reprovado' : dec.status === 'cancelada' ? 'cancelado' : 'pendente';
      if (statusReal !== p.status && !['comprado', 'cancelado'].includes(p.status)) paraCorrigir.push(p.id);
      return { ...p, status: p.status === 'comprado' || p.status === 'cancelado' ? p.status : statusReal, decidido_por: dec && dec.decidido_por, decidido_em: dec && dec.decidido_em, motivo: dec && dec.motivo };
    });
    if (paraCorrigir.length) {
      await Promise.all(resultado.filter((p) => paraCorrigir.includes(p.id))
        .map((p) => c.from('pedidos_compra_varejo').update({ status: p.status, atualizado_em: new Date().toISOString() }).eq('id', p.id)));
    }
    return resultado;
  }

  // Quem pode cancelar: o próprio solicitante ou quem tem a alçada Excluir do Almoxarifado (assíncrono).
  async function podeCancelar(p) {
    if (!p || !['pendente', 'aprovado'].includes(p.status)) return false;
    if (p.solicitante_email && String(p.solicitante_email).toLowerCase() === meuEmail()) return true;
    try { return !!(await window.PropostaStore?.temCapacidade?.('almoxarifado', 'excluir')); } catch { return false; }
  }

  async function cancelarPedido(pedidoId, motivo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!motivo || !String(motivo).trim()) throw new Error('Informe o motivo do cancelamento.');
    const { data: p } = await c.from('pedidos_compra_varejo').select('id, status, solicitante_email, decisao_id, numero_documento').eq('id', pedidoId).maybeSingle();
    if (!p) throw new Error('Pedido não encontrado.');
    if (!(await podeCancelar(p))) throw new Error('Só o solicitante ou quem tem a alçada de exclusão pode cancelar este pedido.');
    const agora = new Date().toISOString();
    const { data: linhas, error } = await c.from('pedidos_compra_varejo').update({
      status: 'cancelado', cancelado_em: agora, cancelado_por: meuEmail() || null, cancelado_motivo: String(motivo).trim(), atualizado_em: agora,
    }).eq('id', pedidoId).in('status', ['pendente', 'aprovado']).select('id');
    if (error) throw error;
    if (!linhas || !linhas.length) throw new Error('O pedido mudou de situação; atualize a tela.');
    if (p.decisao_id) await c.from('decisoes_gerenciais').update({ status: 'cancelada' }).eq('id', p.decisao_id).eq('status', 'pendente');
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Almoxarifado', acao: 'Cancelou pedido de varejo', alvo: p.numero_documento, alvo_id: pedidoId, detalhe: String(motivo).trim() });
  }

  async function marcarComprado(pedidoId, { omiePedido, fornecedor, valorReal, dataCompra } = {}) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const nOmie = String(omiePedido || '').trim(), forn = String(fornecedor || '').trim();
    if (!nOmie && !forn) throw new Error('Informe o nº do pedido no Omie ou o fornecedor.');
    const val = valorReal != null && valorReal !== '' ? Number(valorReal) : null;
    if (val != null && !(val >= 0)) throw new Error('O valor real não pode ser negativo.');
    const { data: pedido } = await c.from('pedidos_compra_varejo').select('status, numero_documento').eq('id', pedidoId).maybeSingle();
    if (!pedido || pedido.status !== 'aprovado') throw new Error('Só é possível marcar como comprado um pedido aprovado.');
    const quando = dataCompra ? new Date(dataCompra + 'T12:00:00').toISOString() : new Date().toISOString();
    const { data: linhas, error } = await c.from('pedidos_compra_varejo').update({
      status: 'comprado', comprado_em: quando, comprado_por: meuEmail() || null, comprado_omie_pedido: nOmie || null,
      comprado_fornecedor: forn || null, comprado_valor: val, atualizado_em: new Date().toISOString(),
    }).eq('id', pedidoId).eq('status', 'aprovado').select('id');
    if (error) throw error;
    if (!linhas || !linhas.length) throw new Error('O pedido mudou de situação; atualize a tela.');
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Almoxarifado', acao: 'Marcou pedido de varejo como comprado', alvo: pedido.numero_documento, alvo_id: pedidoId,
      detalhe: { omie: nOmie || null, fornecedor: forn || null, valor: val },
    });
  }

  window.PedidosVarejoStore = { criarPedido, listarPedidos, marcarComprado, cancelarPedido, podeCancelar };
}());
