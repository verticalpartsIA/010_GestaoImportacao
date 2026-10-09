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

function ambiente({ modo, sessao = null, resposta = { ok: true, status: 200, json: { token_hash: 'th', email: 'a@exemplo.com' } }, verifyErro = null, piloto = 'shadow' } = {}) {
  const chamadas = { fetch: [], verifyOtp: [], signOut: 0, rpc: [] };
  let atual = sessao;
  const store = new Map(modo ? [['vp_auth_mode', modo]] : []);
  const ctx = {
    console: { warn() {}, log() {} },
    Headers, setTimeout,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    fetch: async (url, opts) => { chamadas.fetch.push({ url, opts }); return { ok: resposta.ok, status: resposta.status, json: async () => resposta.json }; },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) },
    window: {
      supabase: { createClient: () => ({ auth: {
        getSession: async () => ({ data: { session: atual } }),
        verifyOtp: async (p) => { chamadas.verifyOtp.push(p); if (verifyErro) return { error: { message: verifyErro } }; atual = { access_token: 'tok', user: { email: 'a@exemplo.com' } }; return { data: { session: atual }, error: null }; },
        signOut: async () => { chamadas.signOut++; atual = null; },
        onAuthStateChange: () => {},
      }, rpc: async (nome) => { chamadas.rpc.push(nome); return { data: piloto, error: null }; } }) },
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

// ---- F0: dados com a sessão individual (piloto decidido pelo banco) ----
const SESSAO = { access_token: 'tok-pessoa', user: { email: 'a@exemplo.com' } };
const REST = 'https://x.supabase.co/rest/v1/propostas?select=*';

test('F0: quem está no piloto manda a própria sessão nas consultas', async () => {
  const { V, chamadas } = ambiente({ sessao: SESSAO, piloto: 'on' });
  await V.init({});
  assert.deepEqual(chamadas.rpc, ['vp_auth_modo']);
  assert.equal(V.status().dados, 'sessao');
  await V.fetchDados(REST, { method: 'GET', headers: { apikey: 'pub', Authorization: 'Bearer pub' } });
  const h = chamadas.fetch[0].opts.headers;
  assert.equal(h.get('Authorization'), 'Bearer tok-pessoa');
  assert.equal(h.get('apikey'), 'pub');
});

test('F0: fora do piloto tudo continua com a chave pública', async () => {
  const { V, chamadas } = ambiente({ sessao: SESSAO, piloto: 'shadow' });
  await V.init({});
  assert.equal(V.status().dados, 'publica');
  const opts = { headers: { Authorization: 'Bearer pub' } };
  await V.fetchDados(REST, opts);
  assert.equal(chamadas.fetch[0].opts, opts);
});

test('F0: escolha manual no navegador vence o banco (shadow desliga mesmo no piloto)', async () => {
  const a = ambiente({ modo: 'shadow', sessao: SESSAO, piloto: 'on' });
  await a.V.init({});
  assert.equal(a.chamadas.rpc.length, 0);
  assert.equal(a.V.status().dados, 'publica');
  const b = ambiente({ modo: 'on', sessao: SESSAO, piloto: 'shadow' });
  await b.V.init({});
  assert.equal(b.V.status().dados, 'sessao');
});

test('F0: sem sessão válida (sem acesso / falhou) nunca manda token', async () => {
  const { V, chamadas } = ambiente({ modo: 'on', resposta: { ok: false, status: 403, json: { error: 'sem acesso' } } });
  await V.init({ ssoToken: jwt('a@exemplo.com') });
  assert.equal(V.status().dados, 'publica');
  assert.equal(await V.tokenParaDados(), null);
  assert.equal(chamadas.fetch.length, 1); // só a chamada do sso-exchange
});

test('F0: só /rest/v1 leva a sessão (funções e arquivos seguem como sempre)', async () => {
  const { V, chamadas } = ambiente({ sessao: SESSAO, piloto: 'on' });
  await V.init({});
  const opts = { headers: { Authorization: 'Bearer pub' } };
  await V.fetchDados('https://x.supabase.co/functions/v1/send-email', opts);
  await V.fetchDados('https://x.supabase.co/storage/v1/object/a.png', opts);
  assert.equal(chamadas.fetch[0].opts, opts);
  assert.equal(chamadas.fetch[1].opts, opts);
});

test('F0: banco recusou com a sessão (401/403) → refaz com a chave pública e registra o recuo', async () => {
  const { ctx, V, chamadas } = ambiente({ sessao: SESSAO, piloto: 'on' });
  await V.init({});
  const respostas = [{ status: 403 }, { status: 200 }];
  ctx.fetch = async (url, opts) => { chamadas.fetch.push({ url, opts }); return respostas.shift(); };
  const opts = { method: 'PATCH', headers: { Authorization: 'Bearer pub' }, body: '{}' };
  const r = await V.fetchDados(REST, opts);
  assert.equal(r.status, 200);
  assert.equal(chamadas.fetch.length, 2);
  assert.equal(chamadas.fetch[1].opts, opts);
  const rec = V.status().recuos;
  assert.equal(rec.length, 1);
  assert.equal(rec[0].status, 403);
  assert.equal(rec[0].metodo, 'PATCH');
  assert.equal(rec[0].url, 'https://x.supabase.co/rest/v1/propostas');
});
