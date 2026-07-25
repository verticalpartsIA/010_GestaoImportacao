/* ============================================================
   proposta-store.js
   Assinatura digital da Proposta Comercial — mesmo padrão de
   contrato-instalador-store.js / contrato-venda-store.js, pra reaproveitar
   a página pública unificada /assinar/:token. O cliente lê a proposta,
   assina (desenho ou nome digitado) sem login, e pode baixar sua própria
   cópia — sem precisar de nenhum cadastro separado.
   Expõe window.PropostaStore = { ... }
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
  function shortToken() { return uuid().split('-').join('').slice(0, 16); }

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

  /* ---------- Formatadores / links ---------- */
  function fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  }
  function signUrl(token) { return `${window.location.origin}/assinar/${encodeURIComponent(token)}`; }
  function prettyUrl(token) { return `verticalparts.com.br/assinar/${token}`; }
  function whatsAppHref(phone, message) {
    const p = (phone || '').replace(/\D/g, '');
    const base = p ? 'https://wa.me/' + p : 'https://wa.me/';
    return base + '?text=' + encodeURIComponent(message);
  }
  function mailtoHref(email, subject, body) {
    return `mailto:${email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  /* ---------- Notificação interna (Geral › Notificações) ---------- */
  async function pushNotification(rec, newStatus, meta) {
    const contraparte = (rec.recipient && rec.recipient.name) || (rec.data_json && rec.data_json.cliente && rec.data_json.cliente.nome) || 'Cliente';
    if (window.VPLog) {
      const MAP = {
        enviada:     { acao: 'enviou a proposta p/ assinatura' },
        visualizada: { acao: 'cliente visualizou a proposta', ator: contraparte, setor: 'externo' },
        aprovada:    { acao: 'proposta assinada', ator: (meta && meta.signerName) || contraparte, setor: 'externo' },
        recusada:    { acao: 'assinatura da proposta recusada', ator: contraparte, setor: 'externo' },
      };
      const m = MAP[newStatus];
      if (m) window.VPLog.registrar({
        ator_nome: m.ator, ator_setor: m.setor,
        modulo: 'Proposta Comercial', acao: m.acao,
        alvo: rec.numero_documento, alvo_id: rec.id,
        detalhe: meta && meta.channel ? { canal: meta.channel } : null,
      });
    }
    try {
      const map = {
        enviada:     { level: 'info',    title: `Proposta ${rec.numero_documento} enviada`, sub: `Para ${(rec.recipient && rec.recipient.name) || ''} · canal ${meta && meta.channel ? (meta.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail') : '—'}` },
        visualizada: { level: 'warning', title: `Proposta ${rec.numero_documento} foi VISUALIZADA`, sub: `Aberta por ${(rec.recipient && rec.recipient.name) || ''} · ${meta && meta.ip ? 'IP ' + meta.ip + ' · ' : ''}${fmtDateTime(Date.now())}` },
        aprovada:    { level: 'info',    title: `Proposta ${rec.numero_documento} ASSINADA`, sub: `Por ${meta && meta.signerName ? meta.signerName : ''} · ${meta && meta.ip ? 'IP ' + meta.ip : ''}` },
        recusada:    { level: 'danger',  title: `Proposta ${rec.numero_documento} foi RECUSADA`, sub: `Recusada pelo cliente em ${fmtDateTime(Date.now())}` },
      };
      const cfg = map[newStatus];
      if (!cfg) return;
      const c = sb(); if (!c) return;
      await c.from('alertas').insert({
        id: 'prop-' + uuid(), level: cfg.level, title: cfg.title, sub: cfg.sub, module: 'Comercial', resolved: false,
      });
    } catch (e) { console.warn('[PropostaStore] notification failed', e); }
  }

  /* ---------- CRUD mínimo pra assinatura ---------- */
  async function getById(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('propostas').select('*').eq('id', id).maybeSingle();
    return data || null;
  }
  async function getByToken(token) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('propostas').select('*').eq('token', token).maybeSingle();
    return data || null;
  }

  /* Garante um token público estável (não regenera se já existir). */
  async function garantirToken(id) {
    const c = sb(); if (!c) throw new Error('Supabase indisponível');
    const cur = await getById(id);
    if (!cur) throw new Error('Proposta não encontrada');
    if (cur.token) return cur.token;
    const token = shortToken();
    const { error } = await c.from('propostas').update({ token }).eq('id', id);
    if (error) throw error;
    return token;
  }

  /* Marca como enviado (gera notificação interna). */
  async function markSent(id, channel, recipient) {
    const c = sb();
    const cur = await getById(id);
    if (!cur) return null;
    const now = new Date();
    const expires = new Date(now.getTime() + 7*24*3600*1000);
    const log = (cur.log || []).slice();
    log.push({ status:'enviada', at: now.toISOString(), meta:{ channel } });
    const patch = {
      status: 'enviada', channel, recipient: recipient || cur.recipient || {},
      sent_at: now.toISOString(), expires_at: expires.toISOString(),
      enviada_em: cur.enviada_em || now.toISOString(),
      log, atualizado_em: now.toISOString(),
    };
    await c.from('propostas').update(patch).eq('id', id);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'enviada', { channel });
    return updated;
  }

  /* Página pública chama no mount. Só avança enviada→visualizada, nunca regride. */
  async function markViewed(token) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    if (cur.status !== 'enviada') return cur;

    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    const now = new Date();
    const audit = { ...(cur.audit || {}), viewedAt: now.toISOString(), viewIp: ip, viewUa: ua, viewDevice: device };
    const log = (cur.log || []).slice();
    log.push({ status:'visualizada', at: now.toISOString(), meta:{ ip, ua } });
    const patch = { status: 'visualizada', viewed_at: now.toISOString(), audit, log, atualizado_em: now.toISOString() };
    await c.from('propostas').update(patch).eq('token', token);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'visualizada', { ip });
    return updated;
  }

  /* Marca como assinada (status 'aprovada' — já existia na tabela). sig = { type:'draw'|'type', data, signerName } */
  async function markSigned(token, sig) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    const now = new Date();
    const hash = await sha256Hex(JSON.stringify(cur.data_json) + '|' + (sig.signerName || ''));
    const audit = {
      ...(cur.audit || {}),
      signedAt: now.toISOString(), signIp: ip, signUa: ua, signDevice: device,
      signerName: sig.signerName, signatureType: sig.type, signatureData: sig.data,
      consent: true, hash,
    };
    const log = (cur.log || []).slice();
    log.push({ status:'aprovada', at: now.toISOString(), meta:{ ip, ua, hash } });
    const patch = {
      status: 'aprovada', signed_at: now.toISOString(), aprovada_em: now.toISOString(),
      audit, log, atualizado_em: now.toISOString(),
    };
    await c.from('propostas').update(patch).eq('token', token);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'aprovada', { ip, signerName: sig.signerName });
    return updated;
  }

  async function refuse(token) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    const now = new Date();
    const log = (cur.log || []).slice();
    log.push({ status:'recusada', at: now.toISOString() });
    const patch = { status: 'recusada', log, atualizado_em: now.toISOString() };
    await c.from('propostas').update(patch).eq('token', token);
    const updated = { ...cur, ...patch };
    await pushNotification(updated, 'recusada', {});
    return updated;
  }

  window.PropostaStore = {
    uuid, shortToken, getPublicIP,
    fmtDateTime, signUrl, prettyUrl, whatsAppHref, mailtoHref,
    getById, getByToken, garantirToken,
    markSent, markViewed, markSigned, refuse,
  };
}());
