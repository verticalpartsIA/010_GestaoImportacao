/* ============================================================
   contrato-instalador-store.js
   Persistência do Contrato Instalador no Supabase vpprd.
   Substitui o localStorage do gerador original. Tudo cross-device.
   Expõe window.CIStore = { ... }
   ============================================================ */
(function () {
  'use strict';

  /* sb: cliente Supabase do host. No assinar.html (página pública) o cliente
     é criado inline e atribuído a window.__VP_SB.sb antes de carregar este script. */
  function sb() { return (window.__VP_SB || {}).sb; }

  /* ---------- IDs / token público ---------- */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function shortToken() {
    // 16 chars hex — suficiente pra link público
    const a = uuid().split('-').join('');
    return a.slice(0, 16);
  }

  /* ---------- IP / UA / device (auditoria) ---------- */
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
  function deviceLabel(ua) {
    ua = ua || navigator.userAgent;
    let os = 'Desktop';
    if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/windows/i.test(ua)) os = 'Windows';
    else if (/mac os/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    let app = 'Navegador';
    if (/whatsapp/i.test(ua)) app = 'WhatsApp';
    else if (/edg/i.test(ua)) app = 'Edge';
    else if (/chrome/i.test(ua)) app = 'Chrome';
    else if (/firefox/i.test(ua)) app = 'Firefox';
    else if (/safari/i.test(ua)) app = 'Safari';
    return `${app} / ${os}`;
  }
  async function sha256Hex(text) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch (e) {
      let h = 0; for (let i = 0; i < text.length; i++) { h = (h<<5)-h+text.charCodeAt(i); h |= 0; }
      return 'fallback-' + (h>>>0).toString(16);
    }
  }

  /* ---------- Formatadores ---------- */
  function fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  }
  function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('pt-BR') : '—'; }
  function relative(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff/60000);
    if (m < 1) return 'agora';
    if (m < 60) return `há ${m} min`;
    const h = Math.floor(m/60); if (h < 24) return `há ${h} h`;
    const d = Math.floor(h/24); return `há ${d} d`;
  }
  function signUrl(token) {
    const base = window.location.origin;
    return `${base}/assinar/${encodeURIComponent(token)}`;
  }
  function prettyUrl(token) { return `verticalparts.com.br/assinar/${token}`; }
  function whatsAppHref(phone, message) {
    let p = (phone || '').replace(/\D/g, '');
    // Celular BR sem DDI: DDD (2) + "9" (nono dígito, prefixo de celular
    // desde 2016, sempre na 3ª posição) + 8 dígitos = 11 dígitos. Assinatura
    // específica pra não colidir com números internacionais de mesmo
    // tamanho (ex.: NANP +1 212 555 1234 vira "12125551234", 3ª posição ≠ 9).
    if (p.length === 11 && p[2] === '9') p = '55' + p;
    const base = p ? 'https://wa.me/' + p : 'https://wa.me/';
    return base + '?text=' + encodeURIComponent(message);
  }
  function mailtoHref(email, subject, body) {
    return `mailto:${email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  /* ---------- Status ---------- */
  const STATUS = {
    rascunho:    { id:'rascunho',    label:'Rascunho',    icon:'📝', tone:'gray',   order:0 },
    enviado:     { id:'enviado',     label:'Enviado',     icon:'📤', tone:'blue',   order:1 },
    visualizado: { id:'visualizado', label:'Visualizado', icon:'👁',  tone:'yellow', order:2 },
    assinado:    { id:'assinado',    label:'Assinado',    icon:'✍',  tone:'green',  order:3 },
    expirado:    { id:'expirado',    label:'Expirado',    icon:'⚠',  tone:'red',    order:4 },
    recusado:    { id:'recusado',    label:'Recusado',    icon:'✕',  tone:'red',    order:4 },
  };

  /* ---------- Notificação interna (Geral › Notificações) ---------- */
  async function pushNotification(rec, newStatus, meta) {
    /* Espelha no registro central (Admin > Logs) */
    if (window.VPLog) {
      const contraparte = (rec.recipient && rec.recipient.name) || rec.responsavel_nome || rec.contratada_nome || 'Contraparte';
      const MAP = {
        enviado:     { acao: 'enviou p/ assinatura' },
        visualizado: { acao: 'contraparte visualizou', ator: contraparte, setor: 'externo' },
        assinado:    { acao: 'contrato assinado', ator: (meta && meta.signerName) || contraparte, setor: 'externo' },
        recusado:    { acao: 'assinatura recusada', ator: contraparte, setor: 'externo' },
        expirado:    { acao: 'link de assinatura expirou', ator: 'Sistema', setor: 'sistema' },
      };
      const m = MAP[newStatus];
      if (m) window.VPLog.registrar({
        ator_nome: m.ator, ator_setor: m.setor,
        modulo: 'Contrato Instalador', acao: m.acao,
        alvo: rec.numero_documento, alvo_id: rec.id,
        detalhe: meta && meta.channel ? { canal: meta.channel } : null,
      });
    }
    try {
      const map = {
        enviado:     { level: 'info',    title: `Contrato instalador ${rec.numero_documento} enviado`, sub: `Para ${(rec.recipient && rec.recipient.name) || rec.responsavel_nome || ''} · canal ${meta && meta.channel ? (meta.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail') : '—'}` },
        visualizado: { level: 'warning', title: `Contrato instalador ${rec.numero_documento} foi VISUALIZADO`, sub: `Aberto por ${(rec.recipient && rec.recipient.name) || ''} · ${meta && meta.ip ? 'IP ' + meta.ip + ' · ' : ''}${fmtDateTime(Date.now())}` },
        assinado:    { level: 'info',    title: `Contrato instalador ${rec.numero_documento} ASSINADO`, sub: `Por ${meta && meta.signerName ? meta.signerName : (rec.responsavel_nome || '')} · ${meta && meta.ip ? 'IP ' + meta.ip : ''}` },
        recusado:    { level: 'danger',  title: `Contrato instalador ${rec.numero_documento} foi RECUSADO`, sub: `Recusado pelo destinatário em ${fmtDateTime(Date.now())}` },
        expirado:    { level: 'warning', title: `Contrato instalador ${rec.numero_documento} EXPIROU`, sub: `Link aguardando assinatura por 7 dias sem retorno` },
      };
      const cfg = map[newStatus];
      if (!cfg) return;
      const c = sb(); if (!c) return;
      await c.from('alertas').insert({
        id: 'ci-' + uuid(),
        level: cfg.level,
        title: cfg.title,
        sub: cfg.sub,
        module: 'Jurídico',
        resolved: false,
      });
    } catch (e) { console.warn('[CIStore] notification failed', e); }
  }

  /* ---------- CRUD ---------- */
  function _packToRow(rec) {
    return {
      id: rec.id,
      numero_documento: rec.numero_documento,
      seq_mes: rec.seq_mes,
      ano_mes: rec.ano_mes,
      token: rec.token,
      titulo: rec.titulo,
      contratada_nome: rec.contratada_nome,
      contratada_cnpj: rec.contratada_cnpj,
      responsavel_nome: rec.responsavel_nome,
      responsavel_cpf: rec.responsavel_cpf,
      valor_total: rec.valor_total,
      objeto_resumo: rec.objeto_resumo,
      vendedor_id: rec.vendedor_id || null,
      master_id: rec.master_id || null,
      proposta_id: rec.proposta_id || null,
      ativos_indices: rec.ativos_indices || [],
      status: rec.status,
      channel: rec.channel,
      recipient: rec.recipient || {},
      form_state: rec.form_state || {},
      doc: rec.doc || {},
      log: rec.log || [],
      audit: rec.audit || {},
      sent_at: rec.sent_at,
      viewed_at: rec.viewed_at,
      signed_at: rec.signed_at,
      expires_at: rec.expires_at,
      atualizado_em: new Date().toISOString(),
    };
  }

  /* Lista (com filtro/busca opcionais) */
  async function listAll() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('contratos_instalador').select('*').order('criado_em', { ascending: false });
    if (error) { console.warn('[CIStore] list error', error); return []; }
    return data || [];
  }
  async function getById(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('contratos_instalador').select('*').eq('id', id).maybeSingle();
    return data || null;
  }
  async function getByToken(token) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('contratos_instalador').select('*').eq('token', token).maybeSingle();
    return data || null;
  }

  /* Cria um novo registro de contrato a partir do estado do form.
     Gera numero_documento via RPC next_doc_number('VPNI'). */
  async function createDraft(formState, opts) {
    opts = opts || {};
    const c = sb();
    if (!c) throw new Error('Supabase indisponível');

    const { data: numRows, error: numErr } = await c.rpc('next_doc_number', { p_prefixo: 'VPNI' });
    if (numErr) throw numErr;
    const num = (Array.isArray(numRows) ? numRows[0] : numRows) || {};
    /* Nº exibido (revisão 27/08): reaproveita o Nº da Cotação da Proposta de
       origem (VPCM-0950 — Contrato de Montagem), em vez da sequência
       própria "VPNI-...". Sem propostaId (raro/legado), mantém o número
       gerado pelo RPC como está. */
    if (formState.propostaId) {
      const { data: prop } = await c.from('propostas').select('numero_cotacao').eq('id', formState.propostaId).maybeSingle();
      if (prop && prop.numero_cotacao != null) num.numero_documento = window.MasterIdEngine.etapaId('contrato_montagem', prop.numero_cotacao);
    }

    const valorTotal = window.CI.moedaParaNumero(formState.valorTotal);
    const eq = (window.CI.EQUIPAMENTOS.find(e => e.id === formState.equipamento) || {}).label || '';
    const modal = (window.CI.MODALIDADES.find(m => m.id === formState.modalidade) || {}).label || '';
    const objetoResumo = `${formState.quantidade || 1}× ${eq} · ${modal}`;

    const doc = window.CI.buildContract(formState, num.numero_documento);

    const rec = {
      id: uuid(),
      numero_documento: num.numero_documento,
      seq_mes: num.seq_mes,
      ano_mes: num.ano_mes,
      token: shortToken(),
      titulo: doc.titulo,
      contratada_nome: doc.contratada.razao,
      contratada_cnpj: doc.contratada.cnpj,
      responsavel_nome: doc.contratada.responsavel,
      responsavel_cpf: doc.contratada.cpf,
      valor_total: valorTotal,
      objeto_resumo: objetoResumo,
      vendedor_id: opts.vendedorId || null,
      master_id: formState.masterId || null,
      proposta_id: formState.propostaId || null,
      ativos_indices: formState.ativosIndices || [],
      status: 'rascunho',
      channel: null,
      recipient: { name: doc.contratada.responsavel, contact: '' },
      form_state: formState,
      doc,
      log: [{ status: 'rascunho', at: new Date().toISOString(), meta: null }],
      audit: {},
      sent_at: null, viewed_at: null, signed_at: null, expires_at: null,
    };

    const { error } = await c.from('contratos_instalador').insert(_packToRow(rec));
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Contrato Instalador', acao: 'criou o contrato', alvo: rec.numero_documento, alvo_id: rec.id, detalhe: { contratada: rec.contratada_nome } });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'CONTRATO_INSTALADOR_GERADO', numeroCotacao: formState.numeroCotacao ?? null,
      alvoLabel: rec.numero_documento, alvoId: rec.id,
    });
    if (window.AvalFinanceiroStore && formState.numeroCotacao != null) window.AvalFinanceiroStore.registrarCustoReal({
      numeroCotacao: formState.numeroCotacao, origem: 'contrato_instalador',
      descricao: 'Contrato Instalador ' + rec.numero_documento, valor: valorTotal,
    });
    return rec;
  }

  /* Atualiza um registro existente — útil pra reabrir rascunho e editar */
  async function updateFormState(id, formState) {
    const c = sb();
    const cur = await getById(id);
    if (!cur) return null;
    const doc = window.CI.buildContract(formState, cur.numero_documento);
    const valorTotal = window.CI.moedaParaNumero(formState.valorTotal);
    const eq = (window.CI.EQUIPAMENTOS.find(e => e.id === formState.equipamento) || {}).label || '';
    const modal = (window.CI.MODALIDADES.find(m => m.id === formState.modalidade) || {}).label || '';
    const patch = {
      titulo: doc.titulo,
      contratada_nome: doc.contratada.razao,
      contratada_cnpj: doc.contratada.cnpj,
      responsavel_nome: doc.contratada.responsavel,
      responsavel_cpf: doc.contratada.cpf,
      valor_total: valorTotal,
      objeto_resumo: `${formState.quantidade || 1}× ${eq} · ${modal}`,
      master_id: formState.masterId || null,
      proposta_id: formState.propostaId || null,
      ativos_indices: formState.ativosIndices || [],
      form_state: formState,
      doc,
      atualizado_em: new Date().toISOString(),
    };
    await c.from('contratos_instalador').update(patch).eq('id', id);
    return { ...cur, ...patch };
  }

  /* Marca como enviado e gera notificação interna */
  async function markSent(id, channel, recipient) {
    const c = sb();
    const cur = await getById(id);
    if (!cur) return null;
    const now = new Date();
    const expires = new Date(now.getTime() + 7*24*3600*1000);
    const log = (cur.log || []).slice();
    log.push({ status:'enviado', at: now.toISOString(), meta:{ channel } });
    const patch = {
      status: 'enviado',
      channel,
      recipient: recipient || cur.recipient || {},
      sent_at: now.toISOString(),
      expires_at: expires.toISOString(),
      log,
      atualizado_em: now.toISOString(),
    };
    await c.from('contratos_instalador').update(patch).eq('id', id);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'enviado', { channel });
    return updated;
  }

  /* Página pública chama no mount. Só avança rascunho→visualizado, nunca regride. */
  async function markViewed(token) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    if (cur.status !== 'enviado' && cur.status !== 'rascunho') return cur;

    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    const now = new Date();
    const audit = { ...(cur.audit || {}), viewedAt: now.toISOString(), viewIp: ip, viewUa: ua, viewDevice: device };
    const log = (cur.log || []).slice();
    log.push({ status:'visualizado', at: now.toISOString(), meta:{ ip, ua } });
    const patch = {
      status: 'visualizado',
      viewed_at: now.toISOString(),
      audit, log,
      atualizado_em: now.toISOString(),
    };
    await c.from('contratos_instalador').update(patch).eq('token', token);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'visualizado', { ip });
    return updated;
  }

  /* Marca como assinado. sig = { type:'draw'|'type', data, signerName } */
  async function markSigned(token, sig) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    const now = new Date();
    const hash = await sha256Hex(JSON.stringify(cur.form_state) + '|' + (sig.signerName || ''));
    const audit = {
      ...(cur.audit || {}),
      signedAt: now.toISOString(),
      signIp: ip,
      signUa: ua,
      signDevice: device,
      signerName: sig.signerName,
      signatureType: sig.type,
      signatureData: sig.data,
      consent: true,
      hash,
    };
    const log = (cur.log || []).slice();
    log.push({ status:'assinado', at: now.toISOString(), meta:{ ip, ua, hash } });
    const patch = {
      status: 'assinado',
      signed_at: now.toISOString(),
      audit, log,
      atualizado_em: now.toISOString(),
    };
    await c.from('contratos_instalador').update(patch).eq('token', token);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'assinado', { ip, signerName: sig.signerName });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'CONTRATO_INSTALADOR_ASSINADO', numeroCotacao: cur.form_state?.numeroCotacao ?? null,
      alvoLabel: cur.numero_documento, alvoId: cur.id,
    });
    return updated;
  }

  async function refuse(token) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    const now = new Date();
    const log = (cur.log || []).slice();
    log.push({ status:'recusado', at: now.toISOString(), meta:{ at: now.toISOString() } });
    const patch = { status:'recusado', log, atualizado_em: now.toISOString() };
    await c.from('contratos_instalador').update(patch).eq('token', token);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'recusado', {});
    return updated;
  }

  /* Expira contratos > 7 dias sem assinatura. Chamar no load do dashboard. */
  async function sweepExpired() {
    const c = sb();
    const now = new Date();
    const { data } = await c.from('contratos_instalador')
      .select('id,status,expires_at,log,numero_documento')
      .in('status', ['enviado', 'visualizado'])
      .lt('expires_at', now.toISOString());
    for (const r of (data || [])) {
      const log = (r.log || []).slice();
      log.push({ status:'expirado', at: now.toISOString(), meta: null });
      await c.from('contratos_instalador').update({ status:'expirado', log, atualizado_em: now.toISOString() }).eq('id', r.id);
      await pushNotification(r, 'expirado', {});
    }
  }

  async function remove(id) {
    const c = sb();
    await c.from('contratos_instalador').delete().eq('id', id);
  }

  /* ---------- expor ---------- */
  window.CIStore = {
    STATUS,
    uuid, shortToken,
    fmtDateTime, fmtDate, relative,
    signUrl, prettyUrl, whatsAppHref, mailtoHref,
    listAll, getById, getByToken,
    createDraft, updateFormState,
    markSent, markViewed, markSigned, refuse,
    sweepExpired, remove,
    getPublicIP, deviceLabel, sha256Hex,
  };
}());
