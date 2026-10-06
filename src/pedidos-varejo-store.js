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

  // Pedido a partir deste valor exige justificativa (o aprovador decide só com o que está escrito).
  const JUSTIFICATIVA_MIN_VALOR = 500;
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
    if (val != null && val >= JUSTIFICATIVA_MIN_VALOR && !String(justificativa || '').trim()) throw new Error(`Pedido de R$ ${JUSTIFICATIVA_MIN_VALOR} ou mais exige justificativa.`);
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
    const { data, error } = await c.from('pedidos_compra_varejo').select('*, decisoes_gerenciais(status, decidido_por, decidido_em, motivo, contexto)').order('criado_em', { ascending: false });
    if (error) { console.warn('[PedidosVarejoStore] listarPedidos falhou', error); return []; }
    const pedidos = data || [];
    const paraCorrigir = [];
    const resultado = pedidos.map((p) => {
      const dec = p.decisoes_gerenciais;
      const statusReal = !dec ? p.status : dec.status === 'aprovada' ? 'aprovado' : dec.status === 'reprovada' ? 'reprovado' : dec.status === 'cancelada' ? 'cancelado' : 'pendente';
      if (statusReal !== p.status && !['comprado', 'cancelado'].includes(p.status)) paraCorrigir.push(p.id);
      return { ...p, status: p.status === 'comprado' || p.status === 'cancelado' ? p.status : statusReal, decidido_por: dec && dec.decidido_por, decidido_em: dec && dec.decidido_em, motivo: dec && dec.motivo, decisao_edicoes: (dec && dec.contexto && dec.contexto.edicoes) || [] };
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

  /* Duplicidade: pedido interno em aberto do mesmo item e requisição enviada pelo PCP ao Omie nos últimos 7 dias. Só avisa. */
  async function verificarDuplicidade({ codigoProduto, item }) {
    const c = sb(); const out = { internos: [], requisicoes: [] };
    if (!c) return out;
    try {
      let q = c.from('pedidos_compra_varejo').select('numero_documento, item, quantidade, unidade, status, criado_em').in('status', ['pendente', 'aprovado']).limit(10);
      q = codigoProduto ? q.eq('codigo_produto', codigoProduto) : q.ilike('item', String(item || '').trim());
      const r = await q; out.internos = r.data || [];
      if (codigoProduto) {
        const desde = new Date(Date.now() - 7 * 864e5).toISOString();
        const f = await c.from('pcp_omie_fila').select('criado_em, enviado_em, solicitante_email, payload').eq('tipo', 'requisicao_compra').eq('status', 'enviado').gte('criado_em', desde).limit(50);
        out.requisicoes = (f.data || []).map((x) => ({ x, it: ((x.payload && x.payload.meta && x.payload.meta.itens) || []).find((i) => i.codigo === codigoProduto) }))
          .filter((y) => y.it).map((y) => ({ em: y.x.enviado_em || y.x.criado_em, por: y.x.solicitante_email, quantidade: y.it.quantidade }));
      }
    } catch (e) { console.warn('[PedidosVarejoStore] verificarDuplicidade', e); }
    return out;
  }

  /* Edita um pedido AINDA PENDENTE (só o solicitante): atualiza o pedido e o contexto da decisão, guardando a versão anterior no
     histórico (contexto.edicoes) para o aprovador ver o que mudou. Não reabre decisão já tomada. */
  async function editarPedido(pedidoId, { item, quantidade, unidade, valorEstimado, urgencia, justificativa, codigoProduto }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: p } = await c.from('pedidos_compra_varejo').select('*').eq('id', pedidoId).maybeSingle();
    if (!p) throw new Error('Pedido não encontrado.');
    if (p.status !== 'pendente') throw new Error('Só dá para editar pedido que ainda aguarda decisão.');
    if (String(p.solicitante_email || '').toLowerCase() !== meuEmail()) throw new Error('Só o solicitante pode editar o pedido.');
    const qtd = Number(quantidade); if (!(qtd > 0)) throw new Error('A quantidade precisa ser maior que zero.');
    if (!item || !String(item).trim()) throw new Error('Informe o item.');
    const val = valorEstimado != null && valorEstimado !== '' ? Number(valorEstimado) : null;
    if (val != null && !(val >= 0)) throw new Error('O valor estimado não pode ser negativo.');
    if (val != null && val >= JUSTIFICATIVA_MIN_VALOR && !String(justificativa || '').trim()) throw new Error(`Pedido de R$ ${JUSTIFICATIVA_MIN_VALOR} ou mais exige justificativa.`);
    const novo = { item: String(item).trim(), quantidade: qtd, unidade: unidade || null, valor_estimado: val, urgencia: urgencia || 'normal', justificativa: justificativa || null, codigo_produto: codigoProduto || null, atualizado_em: new Date().toISOString() };
    const r = await c.from('pedidos_compra_varejo').update(novo).eq('id', pedidoId).eq('status', 'pendente').select('id');
    if (r.error) throw r.error;
    if (!r.data || !r.data.length) throw new Error('O pedido mudou de situação; atualize a tela.');
    if (p.decisao_id) {
      const d = await c.from('decisoes_gerenciais').select('contexto, status').eq('id', p.decisao_id).maybeSingle();
      if (d.data && d.data.status === 'pendente') {
        const ctx = d.data.contexto || {};
        const antes = { item: p.item, quantidade: p.quantidade, valor: p.valor_estimado, urgencia: p.urgencia, em: new Date().toISOString(), por: meuEmail() };
        await c.from('decisoes_gerenciais').update({ contexto: { ...ctx, item: novo.item, quantidade: qtd, valor: val, urgencia: novo.urgencia, edicoes: [...(ctx.edicoes || []), antes] } }).eq('id', p.decisao_id).eq('status', 'pendente');
      }
    }
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Almoxarifado', acao: 'Editou pedido de varejo', alvo: p.numero_documento, alvo_id: pedidoId, detalhe: { de: { item: p.item, quantidade: p.quantidade, valor: p.valor_estimado }, para: { item: novo.item, quantidade: qtd, valor: val } } });
  }

  /* Confere o nº do pedido do Omie digitado contra os pedidos de compra já lidos (sync-pcp-compras). */
  async function conferirPedidoOmie(numero) {
    const c = sb(); const n = String(numero || '').replace(/\D/g, '');
    if (!c || !n) return null;
    const r = await c.from('pcp_compras_itens').select('numero_pedido, codigo, fornecedor_cod, data_pedido').eq('numero_pedido', n).limit(20);
    const linhas = r.data || [];
    if (!linhas.length) return { achado: false, numero: n };
    let fornecedor = null;
    if (linhas[0].fornecedor_cod) { const f = await c.from('pcp_fornecedores_omie').select('nome').eq('codigo', linhas[0].fornecedor_cod).maybeSingle(); fornecedor = f.data && f.data.nome; }
    return { achado: true, numero: n, fornecedor, itens: linhas.map((x) => x.codigo), data: linhas[0].data_pedido };
  }

  window.PedidosVarejoStore = { criarPedido, listarPedidos, marcarComprado, cancelarPedido, podeCancelar, verificarDuplicidade, editarPedido, conferirPedidoOmie, JUSTIFICATIVA_MIN_VALOR };
}());
