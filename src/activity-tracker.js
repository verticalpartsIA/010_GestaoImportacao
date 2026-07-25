/* ============================================================
   activity-tracker.js — Rastro de acesso cross-sistema (portal vpsistema).

   Envia eventos "enter"/"exit" para a edge function pública
   `track-activity` do projeto vpsistema (ubdkoqxfwcraftesgmbw), que
   alimenta a timeline central de acesso — quando cada colaborador
   entra e sai de cada sistema satélite.

   Fire-and-forget: nunca trava nem quebra a UI se a chamada falhar.

   A chave `track_key` NÃO é embutida no bundle (este app não tem etapa
   de build/Vite) — ela é lida no servidor via `process.env.TRACK_ACTIVITY_KEY`
   (ver server.js) e exposta ao client só em runtime pelo endpoint
   GET /api/track-config. Se a env var não estiver configurada no deploy,
   o endpoint devolve chave vazia e este tracker fica inativo — sem erro,
   sem log de warning, sem quebrar nada.

   Identidade do usuário: window.__VP_USER / evento 'vpprd:user', ambos
   populados pelo SSO guard em src/supabase.js. Carregar depois dele.
   ============================================================ */
(function () {
  'use strict';

  const TRACK_URL   = 'https://ubdkoqxfwcraftesgmbw.supabase.co/functions/v1/track-activity';
  const APP_NAME    = 'vpgestaoimportacao';
  const SESSION_KEY = 'vpprd_track_session_id';

  let trackKey = null;
  let entered  = false;

  function getSessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = (window.crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : (String(Date.now()) + Math.random().toString(16).slice(2));
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) { return null; }
  }

  function currentUser() {
    let u = window.__VP_USER;
    if (!u) { try { u = JSON.parse(sessionStorage.getItem('vpprd_user')); } catch (e) {} }
    return u || null;
  }

  function buildPayload(eventType) {
    const u = currentUser();
    if (!u || !u.email) return null;
    const sessionId = getSessionId();
    if (!sessionId) return null;
    return {
      app: APP_NAME,
      event_type: eventType,
      user_email: u.email,
      user_name: u.nome || '',
      session_id: sessionId,
      track_key: trackKey,
    };
  }

  function trackEnter() {
    if (!trackKey || entered) return;
    const body = buildPayload('enter');
    if (!body) return;
    entered = true; // evita duplicar "enter" em re-disparos do evento vpprd:user
    try {
      fetch(TRACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(function () { /* fire-and-forget */ });
    } catch (e) { /* fire-and-forget: nunca quebra a UI */ }
  }

  function trackExit() {
    if (!trackKey) return;
    const body = buildPayload('exit');
    if (!body) return;
    try {
      const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(TRACK_URL, blob);
      } else {
        fetch(TRACK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          keepalive: true,
        }).catch(function () { /* fire-and-forget */ });
      }
    } catch (e) { /* fire-and-forget: nunca quebra a UI */ }
  }

  function init() {
    fetch('/api/track-config')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (!cfg || !cfg.key) return; // sem chave configurada no deploy → tracker inativo
        trackKey = cfg.key;
        if (currentUser()) trackEnter();
      })
      .catch(function () { /* endpoint indisponível → tracker inativo, sem quebrar a UI */ });
  }

  // A identidade pode chegar de forma assíncrona (decode local do sso_token,
  // depois confirmação via Auth do vpsistema) — cobrimos os dois casos.
  window.addEventListener('vpprd:user', function () { trackEnter(); });
  window.addEventListener('pagehide', trackExit);

  init();
}());
