/* ============================================================
   vp-auth.js — sessão NATIVA do vpprd obtida a partir do login do vpsistema (segurança real, issue #571).
   Fluxo: o portal entrega o sso_token (JWT do vpsistema) na URL → a Edge Function `sso-exchange` confere esse
   token, exige perfil ativo e devolve um token_hash → aqui trocamos por uma sessão do vpprd (verifyOtp),
   guardada no navegador com renovação automática.

   MODOS (localStorage.vp_auth_mode): 'off' | 'shadow' (padrão) | 'on'.
   - shadow: cria/mantém a sessão e só OBSERVA. O cliente de dados do app (supabase.js) continua com a chave pública,
     então NADA muda para o usuário e nenhuma falha aqui pode quebrar o app (tudo é try/catch, nunca lança).
   - on: o cliente de dados (supabase.js) passa a mandar ESTE token nas consultas ao banco (/rest/v1) — o banco
     fica sabendo quem pede (papel `authenticated` + e-mail), base para as regras por pessoa (fase F0, Gelson 09/10/2026).
   Quem decide: localStorage.vp_auth_mode, se definido, manda (manual: 'off' | 'shadow' | 'on'); senão o BANCO
   decide pela lista de piloto (rpc vp_auth_modo → 'on' para quem está em vp_auth_piloto; '*' = todos).
   Desligar o piloto = tirar a pessoa da lista (vale no próximo carregamento, sem publicar o site).
   Rede de segurança: se o banco recusar um pedido feito com a sessão (401/403), o mesmo pedido é refeito com a
   chave pública e o recuo fica registrado (VpAuth.status().recuos) — o app nunca trava por causa da sessão.
   Exceção: recusa da trava de valores em R$ (hint 'vp_valores', fase F1) volta como está — refazer furaria a regra.
   Sem segredo no navegador: as chaves abaixo são as PÚBLICAS do app (as mesmas de supabase.js).
   ============================================================ */
(function () {
  'use strict';
  const URL_SB = 'https://jxtqwzmpgofwctqajewt.supabase.co';
  const ANON_SB = 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP';
  const FUNCAO = URL_SB + '/functions/v1/sso-exchange';

  function modoManual() {
    try { return localStorage.getItem('vp_auth_mode') || null; } catch (e) { return null; }
  }
  function modo() { return modoManual() || 'shadow'; }

  let remoto = null;   // o que a lista de piloto do banco disse ('on' | 'shadow' | null = não perguntou)
  let recuos = [];     // pedidos recusados com a sessão e refeitos com a chave pública
  let avisarPronto;
  const pronto = new Promise(function (r) { avisarPronto = r; });

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
    try { return await initSessao(opts); }
    finally {
      if (estado === 'ok' && !modoManual()) {
        try { const r = await cliente().rpc('vp_auth_modo'); remoto = (r && !r.error && r.data) || null; } catch (e) { remoto = null; }
      }
      avisarPronto();
    }
  }

  async function initSessao(opts) {
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

  // As consultas de dados devem ir com a sessão desta pessoa?
  function dadosComSessao() {
    const man = modoManual();
    if (man === 'off' || man === 'shadow') return false;
    if (estado !== 'ok') return false;
    return man === 'on' || remoto === 'on';
  }

  async function tokenParaDados() {
    await Promise.race([pronto, new Promise(function (r) { setTimeout(r, 4000); })]);
    if (!dadosComSessao()) return null;
    return getAccessToken();
  }

  // O banco marca a recusa por falta de liberação de valores com hint 'vp_valores' (vp_valores_guarda).
  async function ehRecusaDeValores(r) {
    try { const c = JSON.parse(await r.clone().text()); return !!(c && c.hint === 'vp_valores'); } catch (e) { return false; }
  }

  // fetch do cliente de dados (supabase.js): só /rest/v1 leva a sessão; o resto segue como sempre.
  async function fetchDados(input, init) {
    const url = typeof input === 'string' ? input : String((input && input.url) || '');
    if (url.indexOf('/rest/v1/') === -1) return fetch(input, init);
    let tok = null;
    try { tok = await tokenParaDados(); } catch (e) { tok = null; }
    if (!tok) return fetch(input, init);
    const h = new Headers((init && init.headers) || undefined);
    h.set('Authorization', 'Bearer ' + tok);
    const r = await fetch(input, Object.assign({}, init, { headers: h }));
    if (r.status === 401 || r.status === 403) {
      // Recusa da trava de valores (F1): é a regra funcionando, não falha da sessão — nunca refazer com a chave pública.
      if (r.status === 403 && await ehRecusaDeValores(r)) return r;
      const rec = { status: r.status, metodo: (init && init.method) || 'GET', url: url.split('?')[0], em: new Date().toISOString() };
      recuos.push(rec);
      if (recuos.length > 50) recuos = recuos.slice(-50);
      try { console.warn('[VpAuth] banco recusou com a sessão — refeito com a chave pública', rec); } catch (e) {}
      return fetch(input, init);
    }
    return r;
  }

  // Diagnóstico (modo sombra): pergunta ao banco quem ele acha que somos, usando a sessão nativa.
  async function quemSouEuNoBanco() {
    try { const r = await cliente().rpc('vp_whoami'); return r && r.data ? r.data : null; } catch (e) { return null; }
  }

  window.VpAuth = {
    init: init,
    getAccessToken: getAccessToken,
    getUser: function () { return usuario; },
    status: function () { return { modo: modo(), estado: estado, motivo: motivo, piloto: remoto, dados: dadosComSessao() ? 'sessao' : 'publica', recuos: recuos.slice() }; },
    tokenParaDados: tokenParaDados,
    fetchDados: fetchDados,
    onChange: function (f) { ouvintes.push(f); },
    quemSouEuNoBanco: quemSouEuNoBanco,
    signOut: async function () { try { await cliente().auth.signOut(); } catch (e) {} usuario = null; marca('sem_sessao'); },
  };
})();
