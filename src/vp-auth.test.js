'use strict';
// Testa src/vp-auth.js (sessão nativa do vpprd obtida pela troca de token `sso-exchange`, modo sombra) — dados sintéticos.
// Chamado por: scripts/run-tests.js (npm test). Instrução do usuário: "Pode seguir com a Fase 2".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, 'vp-auth.js'), 'utf8');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (email) => `h.${b64({ email, sub: 'u1' })}.s`;

function ambiente({ modo, sessao = null, resposta = { ok: true, status: 200, json: { token_hash: 'th', email: 'a@exemplo.com' } }, verifyErro = null } = {}) {
  const chamadas = { fetch: [], verifyOtp: [], signOut: 0 };
  let atual = sessao;
  const store = new Map(modo ? [['vp_auth_mode', modo]] : []);
  const ctx = {
    console: { warn() {}, log() {} },
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    fetch: async (url, opts) => { chamadas.fetch.push({ url, opts }); return { ok: resposta.ok, status: resposta.status, json: async () => resposta.json }; },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) },
    window: {
      supabase: { createClient: () => ({ auth: {
        getSession: async () => ({ data: { session: atual } }),
        verifyOtp: async (p) => { chamadas.verifyOtp.push(p); if (verifyErro) return { error: { message: verifyErro } }; atual = { access_token: 'tok', user: { email: 'a@exemplo.com' } }; return { data: { session: atual }, error: null }; },
        signOut: async () => { chamadas.signOut++; atual = null; },
        onAuthStateChange: () => {},
      } }) },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { ctx, V: ctx.window.VpAuth, chamadas };
}

test('modo off não chama nada', async () => {
  const { V, chamadas } = ambiente({ modo: 'off' });
  await V.init({ ssoToken: jwt('a@exemplo.com') });
  assert.equal(chamadas.fetch.length, 0);
  assert.equal(V.status().estado, 'desligado');
});

test('troca o token do vpsistema por sessão nativa (verifyOtp com o token_hash)', async () => {
  const { V, chamadas } = ambiente();
  await V.init({ ssoToken: jwt('a@exemplo.com') });
  assert.match(chamadas.fetch[0].url, /\/functions\/v1\/sso-exchange$/);
  assert.equal(chamadas.fetch[0].opts.headers.Authorization, 'Bearer ' + jwt('a@exemplo.com'));
  assert.deepEqual(JSON.parse(JSON.stringify(chamadas.verifyOtp[0])), { token_hash: 'th', type: 'magiclink' });
  assert.equal(V.status().estado, 'ok');
  assert.equal(V.getUser().email, 'a@exemplo.com');
  assert.equal(await V.getAccessToken(), 'tok');
});

test('sessão já existente do mesmo e-mail não troca de novo', async () => {
  const { V, chamadas } = ambiente({ sessao: { access_token: 'x', user: { email: 'A@exemplo.com' } } });
  await V.init({ ssoToken: jwt('a@exemplo.com') });
  assert.equal(chamadas.fetch.length, 0);
  assert.equal(V.status().estado, 'ok');
});

test('sessão de OUTRA pessoa é encerrada antes de trocar', async () => {
  const { V, chamadas } = ambiente({ sessao: { access_token: 'x', user: { email: 'outra@exemplo.com' } } });
  await V.init({ ssoToken: jwt('a@exemplo.com') });
  assert.equal(chamadas.signOut, 1);
  assert.equal(chamadas.fetch.length, 1);
});

test('sem acesso (403) não lança e marca o estado', async () => {
  const { V } = ambiente({ resposta: { ok: false, status: 403, json: { error: 'sem acesso ao VP Gestão' } } });
  await V.init({ ssoToken: jwt('a@exemplo.com') });
  assert.equal(V.status().estado, 'sem_acesso');
  assert.equal(await V.getAccessToken(), null);
});

test('falha de rede ou verifyOtp nunca lança (modo sombra não pode quebrar o app)', async () => {
  const a = ambiente({ verifyErro: 'x' });
  await a.V.init({ ssoToken: jwt('a@exemplo.com') });
  assert.equal(a.V.status().estado, 'falhou');
  const b = ambiente();
  b.ctx.fetch = async () => { throw new Error('offline'); };
  await b.V.init({ ssoToken: jwt('a@exemplo.com') });
  assert.equal(b.V.status().estado, 'falhou');
});

test('sem token SSO na URL só restaura a sessão guardada', async () => {
  const { V, chamadas } = ambiente({ sessao: { access_token: 'x', user: { email: 'a@exemplo.com' } } });
  await V.init({});
  assert.equal(chamadas.fetch.length, 0);
  assert.equal(V.getUser().email, 'a@exemplo.com');
});
