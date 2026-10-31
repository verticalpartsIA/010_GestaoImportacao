/* ============================================================
   fabricacao-oficina-store.js — Fabricação Corrimão e Fabricação Corte
   (22/10/2026). Tabelas fab_* são FECHADAS (só usuário ativo); o chão
   de fábrica fala só por RPC com token (public_fab_*). A tela interna lê
   as tabelas direto e escreve pelas mesmas RPCs (usando o token do link
   da OP), para ter UMA regra de flegar/pausar/concluir no banco.
   window.FabricacaoOficinaStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return window.__VP_SB && window.__VP_SB.sb; }

  function gerarToken() {
    const bytes = new Uint8Array(24);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function urlPublica(token) { return `${window.location.origin}/fabricacao-oficina/${token}`; }

  async function rpc(nome, args) {
    const { data, error } = await sb().rpc(nome, args);
    if (error) throw new Error(error.message || 'Falha na operação');
    return data;
  }

  /* Estado da OP pelo link (página pública e tela interna usam o mesmo formato). */
  async function obterPorToken(token) { return rpc('public_fab_obter', { p_token: token }); }

  function flegar(token, etapaId, flegado, por) {
    return rpc('public_fab_flegar', { p_token: token, p_etapa: etapaId, p_flegado: !!flegado, p_por: por || null });
  }
  function abrirOcorrencia(token, codigo, descricao, temFrente) {
    return rpc('public_fab_ocorrencia', { p_token: token, p_acao: 'abrir', p_codigo: codigo, p_descricao: descricao || null, p_tem_frente: !!temFrente });
  }
  function resolverOcorrencia(token, id) {
    return rpc('public_fab_ocorrencia', { p_token: token, p_acao: 'resolver', p_id: id });
  }
  function registrarSobra(token, quantidade, obs) {
    return rpc('public_fab_sobra', { p_token: token, p_quantidade: Number(quantidade), p_obs: obs || null });
  }

  /* Botão da Separação: cria a(s) OP(s)-unidade do item e o(s) link(s). */
  async function enviarDaSeparacao(codigoPedido, codigo, destino) {
    return rpc('separacao_enviar_fabricacao', { p_codigo_pedido: Number(codigoPedido), p_codigo: codigo, p_destino: destino });
  }

  /* Envia o item a "quadro" ou "expedicao" (separacao_destinos). Da Corte, passar a OP em ordemId. */
  async function enviarDestino(codigoPedido, codigo, destino, ordemId) {
    return rpc('separacao_enviar_destino', { p_codigo_pedido: Number(codigoPedido), p_codigo: codigo, p_destino: destino, p_ordem_id: ordemId || null });
  }
  /* "Onde está": { enviados, ops } de um pedido (ou de todos, sem argumento). */
  async function listarDestinos(codigoPedido) {
    return rpc('separacao_destinos_listar', { p_codigo_pedido: codigoPedido == null ? null : Number(codigoPedido) });
  }

  async function garantirLink(ordemId, destino, criadoPor) {
    const c = sb();
    const { data: ex } = await c.from('fab_links').select('token').eq('ordem_id', ordemId).maybeSingle();
    if (ex) return ex.token;
    const token = gerarToken();
    const { error } = await c.from('fab_links').insert({ ordem_id: ordemId, destino, token, criado_por: criadoPor || null });
    if (error) throw new Error(error.message);
    return token;
  }

  /* Lista as OPs do destino com etapas/ocorrências/sobra/link já montados. */
  async function listar(destino, opcoes) {
    const c = sb();
    const incluirConcluidas = !!(opcoes && opcoes.concluidas);
    let q = c.from('pcp_ordens')
      .select('id, numero, titulo, quantidade, cliente, prazo_entrega, status, pedido_codigo, item_codigo, unidade_seq, numero_pedido_omie, itens_pedido, data_finalizacao, created_at')
      .eq('frente', destino).order('created_at', { ascending: false }).limit(300);
    q = incluirConcluidas ? q.in('status', ['aguardando', 'em_producao', 'concluida']) : q.in('status', ['aguardando', 'em_producao']);
    const { data: ordens, error } = await q;
    if (error) throw new Error(error.message);
    const lista = ordens || [];
    const ids = lista.map((o) => o.id);
    const { data: etapasCat, error: e2 } = await c.from('fab_etapas').select('id, ordem, texto, peso').eq('destino', destino).order('ordem');
    if (e2) throw new Error(e2.message);
    if (!ids.length) return { ordens: [], etapasCat: etapasCat || [] };
    const [st, oc, lk, sb2, pedidos] = await Promise.all([
      c.from('fab_status').select('ordem_id, etapa_id, flegado, flegado_em, flegado_por').in('ordem_id', ids),
      c.from('fab_ocorrencias').select('*').in('ordem_id', ids).order('aberta_em', { ascending: false }),
      c.from('fab_links').select('ordem_id, token').in('ordem_id', ids),
      c.from('fab_sobras').select('*').in('ordem_id', ids),
      c.from('pcp_pedidos').select('codigo_pedido, numero_pedido').in('codigo_pedido', [...new Set(lista.map((o) => o.pedido_codigo).filter((x) => x != null))]),
    ]);
    [st, oc, lk, sb2, pedidos].forEach((r) => { if (r.error) throw new Error(r.error.message); });
    // Corte: descrição comercial do cadastro (PCP, senão catálogo de importação) — o dicionário do calc vence na tela.
    const descCad = {};
    if (destino === 'corte') {
      const cods = [...new Set(lista.map((o) => window.FabOficinaCalc.codigoDaOrdem(o)).filter(Boolean))];
      if (cods.length) {
        const [pp, iv] = await Promise.all([
          c.from('pcp_produtos').select('codigo, descricao').in('codigo', cods),
          c.from('importacao_varejo_produtos').select('codigo, descricao').in('codigo', cods),
        ]);
        (iv.data || []).forEach((r) => { if (r.descricao) descCad[r.codigo] = r.descricao; });
        (pp.data || []).forEach((r) => { if (r.descricao) descCad[r.codigo] = r.descricao; });
      }
    }
    const numPedido = {};
    (pedidos.data || []).forEach((p) => { numPedido[p.codigo_pedido] = p.numero_pedido; });
    const porOrdem = (rows) => { const m = {}; (rows || []).forEach((r) => { (m[r.ordem_id] = m[r.ordem_id] || []).push(r); }); return m; };
    const stM = porOrdem(st.data), ocM = porOrdem(oc.data);
    const lkM = {}; (lk.data || []).forEach((r) => { lkM[r.ordem_id] = r.token; });
    const sbM = {}; (sb2.data || []).forEach((r) => { sbM[r.ordem_id] = r; });
    return {
      etapasCat: etapasCat || [],
      ordens: lista.map((o) => {
        const feitos = {}; (stM[o.id] || []).forEach((s) => { feitos[s.etapa_id] = s; });
        return {
          ...o,
          numero_pedido: numPedido[o.pedido_codigo] || null,
          item_descricao: descCad[window.FabOficinaCalc.codigoDaOrdem(o)] || null,
          etapas: (etapasCat || []).map((e) => ({ id: e.id, ordem: e.ordem, texto: e.texto, peso: e.peso,
            flegado: !!(feitos[e.id] && feitos[e.id].flegado), flegado_em: feitos[e.id] ? feitos[e.id].flegado_em : null, flegado_por: feitos[e.id] ? feitos[e.id].flegado_por : null })),
          ocorrencias: ocM[o.id] || [],
          token: lkM[o.id] || null,
          sobra: sbM[o.id] || null,
        };
      }),
    };
  }

  window.FabricacaoOficinaStore = { obterPorToken, flegar, abrirOcorrencia, resolverOcorrencia, registrarSobra, enviarDaSeparacao, enviarDestino, listarDestinos, garantirLink, listar, urlPublica };
})();
