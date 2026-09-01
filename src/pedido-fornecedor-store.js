/* ============================================================
   pedido-fornecedor-store.js
   CRUD + serviços do "Pedido a Fornecedor" (RFQ).
   - Numeração VPRF (RPC next_doc_number) — até 01/09 usava "VPPC", que
     colide com o prefixo que master-id-engine.js reserva pra etapa
     "Precificação" (VPPC-0950). VPRF ("Requisição/Pedido Fornecedor")
     não é usado por mais nenhuma etapa do fluxo VPCT/VPPC/VPPR/VPCV/VPCM/
     VPOB, então não colide com nada.
   - Foto vinda da Ficha Técnica vinculada (produto_id)
   - Tradução PT→EN via Edge Function vp-translate
   window.PFStore
   ============================================================ */
(function () {
  'use strict';

  const TRANSLATE_URL = 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/vp-translate';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4dHF3em1wZ29md2N0cWFqZXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODk3NzcsImV4cCI6MjA5NTA2NTc3N30.hoNuKfSaSLFDKqJ2F331QSDQkzsiphWhLk3xtZh6Bpc';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* ---------- IDs / token público ---------- */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function shortToken() { return uuid().split('-').join('').slice(0, 16); }

  /* ---------- Links do portal público ---------- */
  function cotacaoUrl(token) {
    const base = window.location.origin;
    return `${base}/cotacao/${encodeURIComponent(token)}`;
  }
  function prettyUrl(token) { return `vpprd.vpsistema.com/cotacao/${token}`; }
  function whatsAppHref(phone, message) {
    let p = (phone || '').replace(/\D/g, '');
    // Celular BR sem DDI: DDD (2) + "9" (nono dígito, prefixo de celular desde
    // 2016, sempre na 3ª posição) + 8 dígitos = 11 dígitos. Assinatura
    // específica pra não colidir com números internacionais de mesmo
    // tamanho (ex.: NANP +1 212 555 1234 vira "12125551234", 3ª posição ≠ 9)
    // — este store envia RFQ a fornecedores, que podem ser internacionais.
    if (p.length === 11 && p[2] === '9') p = '55' + p;
    const base = p ? 'https://wa.me/' + p : 'https://wa.me/';
    return base + '?text=' + encodeURIComponent(message);
  }
  function mailtoHref(email, subject, body) {
    return `mailto:${email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  /* ---------- IP / device (auditoria leve) ---------- */
  let _ipCache;
  async function getPublicIP() {
    if (_ipCache !== undefined) return _ipCache;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      const j = await r.json();
      _ipCache = j.ip || null;
    } catch (e) { _ipCache = null; }
    return _ipCache;
  }

  /* ---------- Status ---------- */
  const STATUS = {
    rascunho:    { id: 'rascunho',    label: 'Rascunho',    tone: 'gray',   order: 0 },
    enviado:     { id: 'enviado',     label: 'Enviado',     tone: 'blue',   order: 1 },
    visualizado: { id: 'visualizado', label: 'Visualizado', tone: 'yellow', order: 2 },
    respondido:  { id: 'respondido',  label: 'Respondido',  tone: 'green',  order: 3 },
    expirado:    { id: 'expirado',    label: 'Expirado',    tone: 'red',    order: 4 },
  };

  function fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- Notificação interna (Geral › Notificações) ---------- */
  async function pushNotification(rec, kind, meta) {
    try {
      const c = sb(); if (!c) return;
      meta = meta || {};
      const fornec = (rec.fornecedor && (rec.fornecedor.razao_social || rec.fornecedor.nome)) || 'fornecedor';
      const map = {
        visualizado: { level: 'info',    title: `Cotação ${rec.numero_documento} foi VISUALIZADA`, sub: `Aberta pelo ${fornec}${meta.ip ? ' · IP ' + meta.ip : ''} · ${fmtDateTime(Date.now())}` },
        respondido:  { level: 'info',    title: `Cotação ${rec.numero_documento} RESPONDIDA`, sub: `${fornec} preencheu os preços · ${fmtDateTime(Date.now())}` },
      };
      const cfg = map[kind]; if (!cfg) return;
      await c.from('alertas').insert({
        id: 'pf-' + uuid(),
        level: cfg.level, title: cfg.title, sub: cfg.sub,
        module: 'Compras', resolved: false,
      });
    } catch (e) { console.warn('[PFStore] notification failed', e); }
  }

  /* ---------- Numeração VPRF ---------- */
  async function gerarNumero() {
    const c = sb(); if (!c) throw new Error('Supabase indisponível');
    const { data, error } = await c.rpc('next_doc_number', { p_prefixo: 'VPRF' });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { numero_documento: row.numero_documento, seq_mes: row.seq_mes, ano_mes: row.ano_mes };
  }

  /* ---------- Foto do produto (via ficha técnica vinculada) ---------- */
  async function fotosDosProdutos(produtoIds) {
    const c = sb(); if (!c || !produtoIds.length) return {};
    const { data } = await c.from('fichas_tecnicas')
      .select('produto_id, midia').in('produto_id', produtoIds);
    const map = {};
    for (const f of (data || [])) {
      const ref = f.midia && (f.midia.foto || f.midia.desenho);
      if (!ref) continue;
      let url = ref;
      try { if (window.FTImg) url = await window.FTImg.resolveURL(ref); } catch (e) {}
      if (url) map[f.produto_id] = url;
    }
    return map;
  }

  /* ---------- Tradução PT→EN (lote) ---------- */
  async function traduzir({ intro, observacoes, itens }) {
    const payloadItems = (itens || []).map(it => ({
      k: it.produto_id,
      denominacao: it.denominacao,
      detalhamento: it.detalhamento,
      ncm_descricao: it.ncm_descricao,
      atributos: it.atributos,
    }));
    const res = await fetch(TRANSLATE_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'en', intro: intro || '', observacoes: observacoes || '', items: payloadItems }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error('Tradução falhou (HTTP ' + res.status + ') ' + t.slice(0, 120));
    }
    const out = await res.json();
    const byK = {};
    (out.items || []).forEach(x => { byK[x.k] = x; });
    return { intro_en: out.intro_en || '', observacoes_en: out.observacoes_en || '', byK };
  }

  /* ---------- Aplica tradução nos itens ---------- */
  function aplicarTraducao(itens, byK) {
    return (itens || []).map(it => {
      const t = byK[it.produto_id] || {};
      return {
        ...it,
        denominacao_en: t.denominacao_en || '',
        detalhamento_en: t.detalhamento_en || '',
        ncm_descricao_en: t.ncm_descricao_en || '',
        atributos_en: Array.isArray(t.atributos) ? t.atributos : [],
      };
    });
  }

  /* ---------- Salvar / atualizar ---------- */
  async function salvar(pedido) {
    const c = sb(); if (!c) throw new Error('Supabase indisponível');
    const row = {
      id: pedido.id,
      numero_documento: pedido.numero_documento,
      seq_mes: pedido.seq_mes, ano_mes: pedido.ano_mes,
      modo: pedido.modo || 'rfq',
      idioma: pedido.idioma || 'bilingue',
      fornecedor: pedido.fornecedor || {},
      itens: pedido.itens || [],
      intro_pt: pedido.intro_pt || null, intro_en: pedido.intro_en || null,
      observacoes_pt: pedido.observacoes_pt || null, observacoes_en: pedido.observacoes_en || null,
      doc: pedido.doc || null,
      status: pedido.status || 'rascunho',
      token: pedido.token || shortToken(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await c.from('pedidos_fornecedor').upsert(row, { onConflict: 'id' });
    if (error) throw error;
    return row;
  }

  async function listar() {
    const c = sb(); if (!c) return [];
    const { data } = await c.from('pedidos_fornecedor').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  async function marcarEnviado(id, channel, recipient) {
    const c = sb(); if (!c) return;
    await c.from('pedidos_fornecedor').update({
      status: 'enviado', channel: channel || null, recipient: recipient || null,
      sent_at: new Date().toISOString(),
    }).eq('id', id);
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Pedido a Fornecedor', acao: 'enviou ao fornecedor',
      alvo_id: id, detalhe: { canal: channel, para: recipient && recipient.nome },
    });
  }

  async function excluir(id) {
    const c = sb(); if (!c) return;
    await c.from('pedidos_fornecedor').delete().eq('id', id);
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Pedido a Fornecedor', acao: 'excluiu a cotação', alvo_id: id });
  }

  /* ---------- Portal público (página /cotacao/:token) ---------- */
  async function getByToken(token) {
    const c = sb(); if (!c || !token) return null;
    const { data } = await c.from('pedidos_fornecedor').select('*').eq('token', token).maybeSingle();
    return data || null;
  }

  /* Fornecedor abriu o link → avança enviado/rascunho p/ visualizado (nunca regride). */
  async function marcarVisualizado(token) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    if (cur.status !== 'enviado' && cur.status !== 'rascunho') return cur;
    const ip = await getPublicIP();
    const now = new Date().toISOString();
    const patch = { status: 'visualizado', viewed_at: now, updated_at: now };
    await c.from('pedidos_fornecedor').update(patch).eq('token', token);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'visualizado', { ip });
    return updated;
  }

  /* Fornecedor enviou a cotação preenchida.
     resposta = { moeda, validade, incoterm, porto, obs_geral,
                  itens:[{produto_id, preco_unit, moq, lead_time, obs}] } */
  async function salvarResposta(token, resposta) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    const ip = await getPublicIP();
    const now = new Date().toISOString();
    const payload = {
      ...resposta,
      _meta: { ip, ua: navigator.userAgent, respondido_em: now },
    };
    const patch = { status: 'respondido', resposta: payload, responded_at: now, updated_at: now };
    await c.from('pedidos_fornecedor').update(patch).eq('token', token);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'respondido', { ip });
    if (window.VPLog) window.VPLog.registrar({
      ator_nome: (cur.fornecedor && cur.fornecedor.nome) || 'Fornecedor', ator_setor: 'fornecedor',
      modulo: 'Pedido a Fornecedor', acao: 'respondeu a cotação',
      alvo: cur.numero_documento, alvo_id: cur.id,
      detalhe: { moeda: resposta.moeda, ip },
    });
    return updated;
  }

  /* ---------- Orquestra a geração completa de um pedido ----------
     produtos: linhas de catalogo_produtos selecionadas
     opts: { fornecedor, idioma, intro_pt, observacoes_pt, qtys:{produto_id:qty} } */
  async function gerar(produtos, opts) {
    const num = await gerarNumero();
    const itensBase = produtos.map(p => {
      const it = window.PFEngine.buildItem(p);
      if (opts.qtys && opts.qtys[p.id]) it.qty = Number(opts.qtys[p.id]) || 1;
      return it;
    });

    // fotos + tradução em paralelo
    const ids = produtos.map(p => p.id);
    const [fotos, trad] = await Promise.all([
      fotosDosProdutos(ids),
      (opts.idioma === 'pt')
        ? Promise.resolve({ intro_en: '', observacoes_en: '', byK: {} })
        : traduzir({ intro: opts.intro_pt, observacoes: opts.observacoes_pt, itens: itensBase }),
    ]);

    let itens = aplicarTraducao(itensBase, trad.byK);
    itens = itens.map(it => ({ ...it, foto: fotos[it.produto_id] || null }));

    const pedido = {
      id: 'PC-' + Date.now().toString(36),
      token: shortToken(),
      numero_documento: num.numero_documento, seq_mes: num.seq_mes, ano_mes: num.ano_mes,
      modo: 'rfq', idioma: opts.idioma || 'bilingue',
      fornecedor: opts.fornecedor || {},
      intro_pt: opts.intro_pt || '', intro_en: trad.intro_en || '',
      observacoes_pt: opts.observacoes_pt || '', observacoes_en: trad.observacoes_en || '',
      itens,
      status: 'rascunho',
    };
    pedido.doc = window.PFEngine.buildDoc(pedido);
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Pedido a Fornecedor', acao: 'gerou a cotação',
      alvo: pedido.numero_documento, alvo_id: pedido.id,
      detalhe: { itens: itens.length, fornecedor: (pedido.fornecedor || {}).nome, idioma: pedido.idioma },
    });
    return pedido;
  }

  window.PFStore = {
    STATUS,
    uuid, shortToken,
    cotacaoUrl, prettyUrl, whatsAppHref, mailtoHref, fmtDateTime,
    gerarNumero, fotosDosProdutos, traduzir, aplicarTraducao,
    salvar, listar, marcarEnviado, excluir, gerar,
    getByToken, marcarVisualizado, salvarResposta, getPublicIP,
  };
}());
