/* ============================================================
   vp-auth.js — sessão NATIVA do vpprd obtida a partir do login do vpsistema (segurança real, issue #571).
   Fluxo: o portal entrega o sso_token (JWT do vpsistema) na URL → a Edge Function `sso-exchange` confere esse
   token, exige perfil ativo e devolve um token_hash → aqui trocamos por uma sessão do vpprd (verifyOtp),
   guardada no navegador com renovação automática.

   MODOS (localStorage.vp_auth_mode): 'off' | 'shadow' (padrão) | 'on'.
   - shadow: cria/mantém a sessão e só OBSERVA. O cliente de dados do app (supabase.js) continua com a chave pública,
     então NADA muda para o usuário e nenhuma falha aqui pode quebrar o app (tudo é try/catch, nunca lança).
   - on: reservado para a Fase 4 (o cliente de dados passa a usar este token). Só ligar depois de as tabelas terem
     políticas para `authenticated`; hoje 15 tabelas só têm política para `anon`.
   Sem segredo no navegador: as chaves abaixo são as PÚBLICAS do app (as mesmas de supabase.js).
   ============================================================ */
(function () {
  'use strict';
  const URL_SB = 'https://jxtqwzmpgofwctqajewt.supabase.co';
  const ANON_SB = 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP';
  const FUNCAO = URL_SB + '/functions/v1/sso-exchange';

  function modo() {
    try { return localStorage.getItem('vp_auth_mode') || 'shadow'; } catch (e) { return 'shadow'; }
  }

  let cli = null;
  let estado = 'inicial'; // inicial | desligado | ok | sem_sessao | sem_acesso | falhou
  let motivo = null;
  let usuario = null;
  const ouvintes = [];

  function cliente() {
    if (!cli) {
      cli = window.supabase.createClient(URL_SB, ANON_SB, {
        auth: { persistSession: true, storageKey: 'vpprd-auth', autoRefreshToken: true, detectSessionInUrl: false },
      });
      try {
        cli.auth.onAuthStateChange(function (ev, s) {
          usuario = (s && s.user) || null;
          ouvintes.forEach(function (f) { try { f(ev, usuario); } catch (e) {} });
        });
      } catch (e) { /* sem ouvinte: segue */ }
    }
    return cli;
  }

  function emailDoToken(t) {
    try {
      const b64 = String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const p = JSON.parse(atob(b64));
      return String(p.email || '').trim().toLowerCase();
    } catch (e) { return ''; }
  }

  function marca(e, m) { estado = e; motivo = m || null; }

  async function init(opts) {
    const m = modo();
    if (m === 'off') { marca('desligado'); return null; }
    try {
      const c = cliente();
      const ssoToken = opts && opts.ssoToken;
      let sessao = null;
      try { const r = await c.auth.getSession(); sessao = (r && r.data && r.data.session) || null; } catch (e) {}

      if (ssoToken) {
        const emailPortal = emailDoToken(ssoToken);
        const emailSessao = sessao && sessao.user ? String(sessao.user.email || '').toLowerCase() : '';
        if (sessao && emailSessao && emailSessao === emailPortal) {
          usuario = sessao.user; marca('ok'); return usuario;           // já temos sessão desta pessoa
        }
        if (sessao) { try { await c.auth.signOut(); } catch (e) {} sessao = null; usuario = null; } // era de outra pessoa

        let resp;
        try {
          resp = await fetch(FUNCAO, { method: 'POST', headers: { Authorization: 'Bearer ' + ssoToken, apikey: ANON_SB } });
        } catch (e) { marca('falhou', 'rede'); return null; }
        let corpo = null;
        try { corpo = await resp.json(); } catch (e) {}
        if (resp.status === 403) { marca('sem_acesso', (corpo && corpo.error) || null); return null; }
        if (!resp.ok || !corpo || !corpo.token_hash) { marca('falhou', (corpo && corpo.error) || ('http ' + resp.status)); return null; }
        const v = await c.auth.verifyOtp({ token_hash: corpo.token_hash, type: 'magiclink' });
        if (v && v.error) { marca('falhou', v.error.message || 'verifyOtp'); return null; }
        const r2 = await c.auth.getSession();
        sessao = (r2 && r2.data && r2.data.session) || (v && v.data && v.data.session) || null;
      }

      usuario = (sessao && sessao.user) || null;
      marca(usuario ? 'ok' : 'sem_sessao');
      return usuario;
    } catch (e) {
      marca('falhou', String((e && e.message) || e));
      return null;
    }
  }

  async function getAccessToken() {
    if (modo() === 'off') return null;
    try {
      const r = await cliente().auth.getSession();
      return (r && r.data && r.data.session && r.data.session.access_token) || null;
    } catch (e) { return null; }
  }

  // Diagnóstico (modo sombra): pergunta ao banco quem ele acha que somos, usando a sessão nativa.
  async function quemSouEuNoBanco() {
    try { const r = await cliente().rpc('vp_whoami'); return r && r.data ? r.data : null; } catch (e) { return null; }
  }

  window.VpAuth = {
    init: init,
    getAccessToken: getAccessToken,
    getUser: function () { return usuario; },
    status: function () { return { modo: modo(), estado: estado, motivo: motivo }; },
    onChange: function (f) { ouvintes.push(f); },
    quemSouEuNoBanco: quemSouEuNoBanco,
    signOut: async function () { try { await cliente().auth.signOut(); } catch (e) {} usuario = null; marca('sem_sessao'); },
  };
})();
