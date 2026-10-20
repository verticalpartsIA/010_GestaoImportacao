/* ============================================================
   etiquetas-store.js — Logística Interna · Etiquetas: leitura de endereços/itens e histórico de impressões.
   Spec: docs/superpowers/specs/2026-10-17-modulo-etiquetas-design.md
   Tabela: etiqueta_impressoes (migration 20261017160000) — insert-only (quem imprimiu, o quê, quando), nasce FECHADA:
   só usuário ativo com a alçada etiquetas.ver lê; só quem tem etiquetas.imprimir (ou .reimprimir) grava.
   Regras que existem por motivo:
   - Os endereços vêm de estoque_enderecos (a mesma tabela que o app de estoque usa para recusar endereço inexistente). Se a leitura
     falhar, usa-se a lista gerada pelas regras (EtiquetasCalc.todosEnderecos) e a tela avisa — nunca imprime endereço que não existe.
   - Reimpressão exige motivo (≥ 5 letras) e a alçada etiquetas.reimprimir; o banco confere de novo.
   - Falha ao gravar o histórico NUNCA desfaz uma impressão que já saiu: devolve { ok:false } e a tela avisa.
   window.EtiquetasStore
   ============================================================ */
(function () {
  'use strict';
  const sbCli = () => (window.__VP_SB && window.__VP_SB.sb) || null;

  async function temCapacidade(cap) {
    try { return !!(await window.PropostaStore?.temCapacidade?.('etiquetas', cap)); } catch (e) { return false; }
  }

  async function listarEnderecos() {
    const sb = sbCli();
    const plano = () => ({ origem: 'regras', enderecos: window.EtiquetasCalc.todosEnderecos() });
    if (!sb) return plano();
    try {
      const { data, error } = await sb.from('estoque_enderecos').select('codigo, tipo, rua, vao, nivel, lado').eq('ativo', true).order('codigo').limit(1000);
      if (error || !data || !data.length) return plano();
      return { origem: 'banco', enderecos: data };
    } catch (e) { return plano(); }
  }

  // Busca produto por código ou descrição. Sem texto, não lista nada (são ~1.700 itens).
  async function buscarItens(texto) {
    const sb = sbCli();
    const t = String(texto || '').replace(/[,()%*\\]/g, ' ').trim();
    if (!sb || t.length < 2) return { itens: [], erro: null };
    try {
      const { data, error } = await sb.from('pcp_produtos').select('codigo, descricao, unidade, familia, endereco').eq('ativo', true)
        .or(`codigo.ilike.%${t}%,descricao.ilike.%${t}%`).order('codigo').limit(40);
      if (error) return { itens: [], erro: error.message };
      return { itens: data || [], erro: null };
    } catch (e) { return { itens: [], erro: e.message }; }
  }

  // P.I. recentes com seus itens (para a etiqueta de Recebimento). Embarque vem de embarques_importacao.nome_embarque.
  async function listarPIs(texto) {
    const sb = sbCli();
    if (!sb) return { pis: [], erro: 'Supabase indisponível.' };
    try {
      const { data, error } = await sb.from('pi_importacao').select('id, numero_pi, fornecedor, embarque_id, itens, created_at').order('created_at', { ascending: false }).limit(200);
      if (error) return { pis: [], erro: error.message };
      const t = String(texto || '').trim().toLowerCase();
      let pis = (data || []).filter((p) => Array.isArray(p.itens) && p.itens.length);
      if (t) pis = pis.filter((p) => String(p.numero_pi || '').toLowerCase().includes(t) || String(p.fornecedor || '').toLowerCase().includes(t));
      const ids = Array.from(new Set(pis.map((p) => p.embarque_id).filter(Boolean)));
      let nomes = {};
      if (ids.length) {
        const r = await sb.from('embarques_importacao').select('id, nome_embarque').in('id', ids);
        (r.data || []).forEach((e) => { nomes[e.id] = e.nome_embarque; });
      }
      return { pis: pis.slice(0, 40).map((p) => ({ ...p, embarque: nomes[p.embarque_id] || '' })), erro: null };
    } catch (e) { return { pis: [], erro: e.message }; }
  }

  // Pedidos de venda do Omie já lidos pelo PCP (não cancelados). Um nº de pedido pode ter mais de um registro: agrupa por número.
  async function listarPedidos(texto) {
    const sb = sbCli();
    if (!sb) return { pedidos: [], erro: 'Supabase indisponível.' };
    try {
      const { data, error } = await sb.from('pcp_pedidos').select('numero_pedido, cliente_nome, etapa, volumes, data_previsao').eq('cancelado', false).order('data_previsao', { ascending: false }).limit(300);
      if (error) return { pedidos: [], erro: error.message };
      const t = String(texto || '').trim().toLowerCase();
      const mapa = new Map();
      (data || []).forEach((p) => { if (p.numero_pedido && !mapa.has(p.numero_pedido)) mapa.set(p.numero_pedido, p); });
      let lista = Array.from(mapa.values());
      if (t) lista = lista.filter((p) => String(p.numero_pedido).toLowerCase().includes(t) || String(p.cliente_nome || '').toLowerCase().includes(t));
      return { pedidos: lista.slice(0, 40), erro: null };
    } catch (e) { return { pedidos: [], erro: e.message }; }
  }

  // NFs já emitidas no Omie (pedido faturado com nº de NF), para a etiqueta de volume da Expedição. Um registro por NF: um mesmo
  // pedido com entrega parcial tem mais de uma NF. O nº de volumes e a transportadora vêm do próprio pedido.
  async function listarNotasFaturadas(texto) {
    const sb = sbCli();
    if (!sb) return { notas: [], erro: 'Supabase indisponível.' };
    try {
      const { data, error } = await sb.from('pcp_pedidos')
        .select('codigo_pedido, numero_pedido, numero_nf, cliente_nome, cliente_endereco, transportadora_nome, volumes, peso_bruto, data_faturamento')
        .eq('faturado', true).eq('cancelado', false).not('numero_nf', 'is', null)
        .order('data_faturamento', { ascending: false }).order('numero_nf', { ascending: false }).limit(300);
      if (error) return { notas: [], erro: error.message };
      const q = String(texto || '').trim().toLowerCase();
      let notas = data || [];
      if (q) notas = notas.filter((n) => [n.numero_nf, n.numero_pedido, n.cliente_nome].some((v) => String(v || '').toLowerCase().includes(q)));
      return { notas: notas.slice(0, 60), erro: null };
    } catch (e) { return { notas: [], erro: e.message }; }
  }

  // OPs de quadro de comando (PCP) abertas ou concluídas recentes, para a etiqueta de OP/série.
  async function listarOPsQuadro(texto) {
    const sb = sbCli();
    if (!sb) return { ops: [], erro: 'Supabase indisponível.' };
    try {
      const { data, error } = await sb.from('pcp_ordens').select('id, numero, titulo, produto, cliente, status, quantidade').eq('frente', 'quadro').neq('status', 'cancelada').order('created_at', { ascending: false }).limit(100);
      if (error) return { ops: [], erro: error.message };
      const t = String(texto || '').trim().toLowerCase();
      let ops = data || [];
      if (t) ops = ops.filter((o) => [o.numero, o.titulo, o.produto, o.cliente].some((v) => String(v || '').toLowerCase().includes(t)));
      const ids = ops.map((o) => o.id);
      let series = {};
      if (ids.length) {
        const r = await sb.from('mes_ordens').select('ordem_id, numero_serie').in('ordem_id', ids);
        (r.data || []).forEach((m) => { if (m.numero_serie) series[m.ordem_id] = m.numero_serie; });
      }
      return { ops: ops.slice(0, 40).map((o) => ({ ...o, serie: series[o.id] || '' })), erro: null };
    } catch (e) { return { ops: [], erro: e.message }; }
  }

  // Equipamentos (VPEL-EL0985-1…) de uma cotação, com a obra e o cliente. Usa a mesma busca da tela de Projeto de Elevadores
  // (que já aplica a regra de dono do formulário).
  async function buscarEquipamentos(numero) {
    try {
      const r = await window.ProjetoElevadorStore?.buscarObraPorCotacao?.(numero);
      return { obra: r || null, erro: null };
    } catch (e) { return { obra: null, erro: e.message }; }
  }

  /* ---------- Modelos da empresa (etiqueta_modelos) ---------- */
  async function listarModelos() {
    const sb = sbCli();
    if (!sb) return { modelos: [], erro: 'Supabase indisponível.' };
    try {
      const { data, error } = await sb.from('etiqueta_modelos').select('*').order('tipo').order('nome');
      if (error) return { modelos: [], erro: error.message };
      return { modelos: data || [], erro: null };
    } catch (e) { return { modelos: [], erro: e.message }; }
  }
  // Copia um modelo padrão (ou da empresa) com nome novo. Devolve { ok, modelo|erro }.
  async function copiarModelo(base, nome) {
    const sb = sbCli();
    if (!sb) return { ok: false, erro: 'Supabase indisponível.' };
    const linha = { tipo: base.tipo, nome: String(nome || '').trim(), base_id: base.base_id || base.id, largura_mm: base.largura_mm, altura_mm: base.altura_mm,
      campos: base.campos, elementos: JSON.parse(JSON.stringify(base.elementos)) };
    try {
      const { data, error } = await sb.from('etiqueta_modelos').insert(linha).select().single();
      if (error) return { ok: false, erro: /duplicate|unique/i.test(error.message) ? 'Já existe um modelo com esse nome neste tipo.' : error.message };
      try { window.VPLog?.registrar?.({ modulo: 'Etiquetas', acao: 'Copiou modelo de etiqueta', alvo: base.tipo, alvo_id: data.id, detalhe: { nome: linha.nome, base: linha.base_id } }); } catch (e) { /* log é complemento */ }
      return { ok: true, modelo: data };
    } catch (e) { return { ok: false, erro: e.message }; }
  }
  async function salvarModelo(id, patch) {
    const sb = sbCli();
    if (!sb) return { ok: false, erro: 'Supabase indisponível.' };
    try {
      const { data, error } = await sb.from('etiqueta_modelos').update(patch).eq('id', id).select('id');
      if (error) return { ok: false, erro: /duplicate|unique/i.test(error.message) ? 'Já existe um modelo com esse nome neste tipo.' : error.message };
      if (!data || !data.length) return { ok: false, erro: 'Nada foi alterado (sem permissão ou modelo apagado).' };
      try { window.VPLog?.registrar?.({ modulo: 'Etiquetas', acao: 'Alterou modelo de etiqueta', alvo: 'MODELO', alvo_id: id, detalhe: { campos: Object.keys(patch) } }); } catch (e) { /* idem */ }
      return { ok: true };
    } catch (e) { return { ok: false, erro: e.message }; }
  }
  async function excluirModelo(id) {
    const sb = sbCli();
    if (!sb) return { ok: false, erro: 'Supabase indisponível.' };
    try {
      const { data, error } = await sb.from('etiqueta_modelos').delete().eq('id', id).select('id');
      if (error) return { ok: false, erro: error.message };
      if (!data || !data.length) return { ok: false, erro: 'Nada foi apagado (sem permissão ou já apagado).' };
      try { window.VPLog?.registrar?.({ modulo: 'Etiquetas', acao: 'Apagou modelo de etiqueta', alvo: 'MODELO', alvo_id: id }); } catch (e) { /* idem */ }
      return { ok: true };
    } catch (e) { return { ok: false, erro: e.message }; }
  }

  /* reg: { tipo, modelo, referencia, dados:{itens:[{ref,dados,copias}],…}, quantidade, impressora, adaptador, sucesso, erro, reimpressao, motivo } */
  async function registrarImpressao(reg) {
    const sb = sbCli();
    if (!sb) return { ok: false, erro: 'Supabase indisponível.' };
    const linha = {
      tipo: reg.tipo, modelo: reg.modelo, referencia: reg.referencia || null, dados: reg.dados || {}, quantidade: reg.quantidade,
      impressora: reg.impressora || null, adaptador: reg.adaptador || null, sucesso: reg.sucesso !== false, erro: reg.erro || null,
      reimpressao: !!reg.reimpressao, motivo: reg.reimpressao ? String(reg.motivo || '').trim() : null,
    };  // `usuario` fica por conta do banco (default = e-mail do login, conferido pela política de INSERT)
    try {
      const { error } = await sb.from('etiqueta_impressoes').insert(linha);
      if (error) return { ok: false, erro: error.message };
    } catch (e) { return { ok: false, erro: e.message }; }
    try {
      window.VPLog?.registrar?.({ modulo: 'Etiquetas', acao: reg.reimpressao ? 'Reimprimiu etiquetas' : 'Imprimiu etiquetas', alvo: reg.tipo, alvo_id: reg.referencia || null,
        detalhe: { quantidade: reg.quantidade, modelo: reg.modelo, sucesso: reg.sucesso !== false, motivo: linha.motivo } });
    } catch (e) { /* o log global é complemento; o histórico próprio já gravou */ }
    return { ok: true };
  }

  async function listarHistorico(limite) {
    const sb = sbCli();
    if (!sb) return { linhas: [], erro: 'Supabase indisponível.' };
    try {
      const { data, error } = await sb.from('etiqueta_impressoes')
        .select('id, tipo, modelo, referencia, dados, quantidade, impressora, adaptador, sucesso, erro, reimpressao, motivo, usuario, impresso_em')
        .order('impresso_em', { ascending: false }).limit(limite || 200);
      if (error) return { linhas: [], erro: error.message };
      return { linhas: data || [], erro: null };
    } catch (e) { return { linhas: [], erro: e.message }; }
  }

  window.EtiquetasStore = { temCapacidade, listarEnderecos, buscarItens, listarPIs, listarPedidos, listarNotasFaturadas, listarOPsQuadro, buscarEquipamentos, listarModelos, copiarModelo, salvarModelo, excluirModelo, registrarImpressao, listarHistorico };
}());
