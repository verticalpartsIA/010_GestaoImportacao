'use strict';
/* Segurança real (#571, F1) — página pública /assinar: o desenho do Projeto de Instalação e as assinaturas do PDF do
   Contrato de Venda vêm por RPC com o TOKEN; se a RPC falhar/não existir (ou vp_public_rpc='off'), cai na leitura antiga. */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
const _ls = {};
global.localStorage = { getItem: (k) => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: (k) => { delete _ls[k]; } };
require('./contrato-venda-engine.js');
require('./documento-signatarios-store.js');
require('./contrato-venda-store.js');

/* Cliente falso: registra cada chamada (rpc / from) e responde conforme `cfg`. */
function fakeSb(cfg) {
  const chamadas = [];
  const sb = {
    chamadas,
    async rpc(nome, args) {
      chamadas.push({ tipo: 'rpc', nome, args });
      if (cfg.rpcLanca) throw new Error('rede');
      if (cfg.rpcErro) return { data: null, error: { message: 'function does not exist' } };
      return { data: cfg.rpc ? cfg.rpc(nome, args) : null, error: null };
    },
    from(tabela) {
      chamadas.push({ tipo: 'from', tabela });
      const filtros = {};
      const q = {
        select() { return q; },
        eq(col, val) { filtros[col] = val; return q; },
        order() { return Promise.resolve({ data: (cfg.tabelas && cfg.tabelas[tabela]) || [], error: null }); },
        maybeSingle() { return Promise.resolve({ data: ((cfg.tabelas && cfg.tabelas[tabela]) || [])[0] || null, error: null }); },
      };
      return q;
    },
  };
  return sb;
}
function usar(sb) { window.__VP_SB = { sb }; }
const DESENHO = { id: 'd1', referencia: 'Obra X', arquivo_url: 'https://exemplo.com/x.pdf' };

test('obterDesenhoProjeto — usa a RPC com o token e não lê a tabela', async () => {
  delete _ls.vp_public_rpc;
  const sb = fakeSb({ rpc: (nome, a) => (nome === 'public_projeto_desenho_obter' && a.p_token === 'tok-projeto-1' ? DESENHO : null) });
  usar(sb);
  const d = await window.DocumentoSignatariosStore.obterDesenhoProjeto('tok-projeto-1', 'd1');
  assert.deepEqual(d, DESENHO);
  assert.equal(sb.chamadas.filter((c) => c.tipo === 'from').length, 0);
});

test('obterDesenhoProjeto — RPC devolve nulo (token de outro tipo) → nulo, sem cair na tabela', async () => {
  const sb = fakeSb({ rpc: () => null, tabelas: { projetos_elevador_desenhos: [DESENHO] } });
  usar(sb);
  assert.equal(await window.DocumentoSignatariosStore.obterDesenhoProjeto('tok-invalido-x', 'd1'), null);
  assert.equal(sb.chamadas.filter((c) => c.tipo === 'from').length, 0);
});

test('obterDesenhoProjeto — RPC inexistente (migração ainda não aplicada) → caminho antigo', async () => {
  const sb = fakeSb({ rpcErro: true, tabelas: { projetos_elevador_desenhos: [DESENHO] } });
  usar(sb);
  assert.deepEqual(await window.DocumentoSignatariosStore.obterDesenhoProjeto('tok-projeto-1', 'd1'), DESENHO);
  assert.deepEqual(sb.chamadas.map((c) => c.tipo + ':' + (c.nome || c.tabela)), ['rpc:public_projeto_desenho_obter', 'from:projetos_elevador_desenhos']);
});

test("obterDesenhoProjeto — vp_public_rpc='off' → nem tenta a RPC", async () => {
  _ls.vp_public_rpc = 'off';
  const sb = fakeSb({ rpc: () => DESENHO, tabelas: { projetos_elevador_desenhos: [DESENHO] } });
  usar(sb);
  assert.deepEqual(await window.DocumentoSignatariosStore.obterDesenhoProjeto('tok-projeto-1', 'd1'), DESENHO);
  assert.equal(sb.chamadas.filter((c) => c.tipo === 'rpc').length, 0);
  delete _ls.vp_public_rpc;
});

const EXTRA = { papel: 'Sócio', nome: 'A', status: 'assinado', audit: { signerName: 'A', signedAt: '2026-10-01T10:00:00Z' } };
const GEN = { papel: null, nome: 'B', status: 'assinado', audit: { signerName: 'B', signedAt: '2026-10-02T10:00:00Z' } };

test('assinaturasDoContrato — usa a RPC com o token e não lê as tabelas de signatários', async () => {
  const sb = fakeSb({ rpc: (nome, a) => (nome === 'public_cv_assinaturas' && a.p_token === 'tok-rep-123' ? { ok: true, extras: [EXTRA], genericos: [GEN] } : null) });
  usar(sb);
  const r = await window.CVStore.assinaturasDoContrato('tok-rep-123', 'CVE-1');
  assert.deepEqual(r, { extras: [EXTRA], genericos: [GEN] });
  assert.equal(sb.chamadas.filter((c) => c.tipo === 'from').length, 0);
});

test('assinaturasDoContrato — RPC falha por rede → lê as duas tabelas pelo ID (caminho antigo)', async () => {
  window.CVSignatarioStore = { listarPorContrato: async (id) => (id === 'CVE-1' ? [EXTRA] : []) };
  const sb = fakeSb({ rpcLanca: true, tabelas: { documento_signatarios: [GEN] } });
  usar(sb);
  const r = await window.CVStore.assinaturasDoContrato('tok-rep-123', 'CVE-1');
  assert.deepEqual(r, { extras: [EXTRA], genericos: [GEN] });
  delete window.CVSignatarioStore;
});

test('assinaturasDoContrato — token desconhecido na RPC (null) → caminho antigo; sem ID → listas vazias', async () => {
  const sb = fakeSb({ rpc: () => null, tabelas: { documento_signatarios: [GEN] } });
  usar(sb);
  assert.deepEqual(await window.CVStore.assinaturasDoContrato('tok-xxxxxxxx', 'CVE-1'), { extras: [], genericos: [GEN] });
  assert.deepEqual(await window.CVStore.assinaturasDoContrato('tok-xxxxxxxx', null), { extras: [], genericos: [] });
});
