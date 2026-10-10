/* ============================================================
   fornecedor-rpc-publica.test.js — Segurança real (#571, F1): os portais públicos do fornecedor
   (cotacao-elevador-fornecedor.html e cotacao.html) falam com o banco por RPC `public_cef_*` /
   `public_pfo_*`, caem no caminho antigo (tabela direto) se a RPC falhar, e respeitam o interruptor
   localStorage.vp_public_rpc = 'off'. Carrega os IIFEs de browser num vm com um Supabase de mentira.
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function clienteFalso({ rpc, linha }) {
  const chamadas = { rpc: [], from: [] };
  const builder = (tabela) => {
    const b = {
      select() { return b; }, eq() { return b; }, order() { return b; },
      update(patch) { chamadas.from.push({ tabela, op: 'update', patch }); return b; },
      insert(row) { chamadas.from.push({ tabela, op: 'insert', row }); return b; },
      maybeSingle: async () => { chamadas.from.push({ tabela, op: 'select' }); return { data: linha || null }; },
      then(res) { return Promise.resolve({ data: null, error: null }).then(res); },
    };
    return b;
  };
  return {
    chamadas,
    rpc: async (nome, args) => { chamadas.rpc.push({ nome, args }); return rpc(nome, args); },
    from: (t) => builder(t),
  };
}

function carregar(arquivo, nomeGlobal, cliente, desligado) {
  const src = fs.readFileSync(path.join(__dirname, arquivo), 'utf8');
  const logs = [];
  const win = { __VP_SB: { sb: cliente }, MasterIdEngine: {}, VPLog: { registrar: (ev) => logs.push(ev) } };
  vm.runInNewContext(src, {
    window: win, console: { warn() {}, log() {}, error() {} }, AbortController, setTimeout, clearTimeout,
    fetch: async () => ({ ok: true, json: async () => ({ ip: '198.51.100.7' }) }),
    localStorage: { getItem: (k) => (k === 'vp_public_rpc' && desligado ? 'off' : null), setItem() {} },
    navigator: { userAgent: 'teste-ua' }, location: { origin: 'https://x' },
  });
  return { store: win[nomeGlobal], logs };
}

const TOKEN = 'abcdef0123456789';
const tabelasSensiveis = (ch) => ch.from.filter((x) => x.tabela === 'cotacoes_elevador_fornecedor' || x.tabela === 'pedidos_fornecedor');

/* ---------- cotação técnica de elevador ---------- */
test('CEF: getByToken / marcarVisualizado / salvarResposta usam só RPC quando ela existe', async () => {
  const rec = { id: 'c1', numero_documento: 'VPCF-1', fornecedor: 'Forn', status: 'respondido', dados_envio: { header: { numero_cotacao: 7 } } };
  const c = clienteFalso({ rpc: async (nome) => {
    if (nome === 'public_cef_obter') return { data: { ...rec, status: 'enviado' }, error: null };
    if (nome === 'public_cef_visualizado') return { data: { ok: true, mudou: true, rec: { ...rec, status: 'visualizado' } }, error: null };
    if (nome === 'public_cef_responder') return { data: { ok: true, rec, antes: {}, ip: '203.0.113.1' }, error: null };
    return { data: null, error: { message: 'x' } };
  } });
  const { store, logs } = carregar('cotacao-elevador-fornecedor-store.js', 'CotacaoElevadorFornecedorStore', c);
  assert.strictEqual((await store.getByToken(TOKEN)).status, 'enviado');
  assert.strictEqual((await store.marcarVisualizado(TOKEN)).status, 'visualizado');
  const out = await store.salvarResposta(TOKEN, { moeda: 'USD', itens: [{ unidade_id: 'U1', preco_unitario: 10 }] });
  assert.strictEqual(out.status, 'respondido');
  assert.deepStrictEqual(c.chamadas.rpc.map((x) => x.nome), ['public_cef_obter', 'public_cef_visualizado', 'public_cef_responder']);
  const args = c.chamadas.rpc[2].args;
  assert.strictEqual(args.p_token, TOKEN);
  assert.strictEqual(args.p_meta.ua, 'teste-ua');
  assert.strictEqual(tabelasSensiveis(c.chamadas).length, 0, 'não pode tocar a tabela direto');
  assert.ok(logs.some((l) => l.acao === 'respondeu a cotação de fornecedor' && l.detalhe.ip === '203.0.113.1'));
});

test('CEF: recusa do servidor (status/link) vira erro na tela, sem cair no caminho antigo', async () => {
  const c = clienteFalso({ rpc: async () => ({ data: { ok: false, erro: 'status_em_analise' }, error: null }) });
  const { store } = carregar('cotacao-elevador-fornecedor-store.js', 'CotacaoElevadorFornecedorStore', c);
  await assert.rejects(() => store.salvarResposta(TOKEN, { moeda: 'USD' }), /já foi respondida/);
  assert.strictEqual(tabelasSensiveis(c.chamadas).length, 0);
  assert.strictEqual(await store.marcarVisualizado(TOKEN), null);
});

test('CEF: RPC inexistente (migração ainda não aplicada) cai no caminho antigo', async () => {
  const linha = { id: 'c1', token: TOKEN, status: 'enviado', fornecedor: 'Forn', dados_envio: {} };
  const c = clienteFalso({ rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'not found' } }), linha });
  const { store } = carregar('cotacao-elevador-fornecedor-store.js', 'CotacaoElevadorFornecedorStore', c);
  assert.strictEqual((await store.getByToken(TOKEN)).id, 'c1');
  const out = await store.salvarResposta(TOKEN, { moeda: 'USD' });
  assert.strictEqual(out.status, 'respondido');
  assert.ok(c.chamadas.from.some((x) => x.tabela === 'cotacoes_elevador_fornecedor' && x.op === 'update'));
});

test("CEF: vp_public_rpc = 'off' nem tenta a RPC", async () => {
  const linha = { id: 'c1', token: TOKEN, status: 'enviado' };
  const c = clienteFalso({ rpc: async () => { throw new Error('não deveria chamar'); }, linha });
  const { store } = carregar('cotacao-elevador-fornecedor-store.js', 'CotacaoElevadorFornecedorStore', c, true);
  assert.strictEqual((await store.marcarVisualizado(TOKEN)).status, 'visualizado');
  assert.strictEqual(c.chamadas.rpc.length, 0);
});

/* ---------- pedido a fornecedor (RFQ de peças) ---------- */
test('PF: obter / visualizar / responder usam só RPC; aviso interno e log continuam', async () => {
  const rec = { id: 'PC-1', numero_documento: 'VPRF-1', fornecedor: { nome: 'Forn' }, status: 'respondido', itens: [] };
  const c = clienteFalso({ rpc: async (nome) => {
    if (nome === 'public_pfo_obter') return { data: { ...rec, status: 'enviado' }, error: null };
    if (nome === 'public_pfo_visualizado') return { data: { ok: true, mudou: true, rec: { ...rec, status: 'visualizado' } }, error: null };
    if (nome === 'public_pfo_responder') return { data: { ok: true, rec, ip: '203.0.113.2' }, error: null };
    return { data: null, error: { message: 'x' } };
  } });
  const { store, logs } = carregar('pedido-fornecedor-store.js', 'PFStore', c);
  assert.strictEqual((await store.getByToken(TOKEN)).status, 'enviado');
  assert.strictEqual((await store.marcarVisualizado(TOKEN)).status, 'visualizado');
  assert.strictEqual((await store.salvarResposta(TOKEN, { moeda: 'USD', itens: [] })).status, 'respondido');
  assert.deepStrictEqual(c.chamadas.rpc.map((x) => x.nome), ['public_pfo_obter', 'public_pfo_visualizado', 'public_pfo_responder']);
  assert.strictEqual(tabelasSensiveis(c.chamadas).length, 0, 'não pode tocar a tabela direto');
  assert.strictEqual(c.chamadas.from.filter((x) => x.tabela === 'alertas').length, 2, 'avisos de visualizado e respondido');
  assert.ok(logs.some((l) => l.acao === 'respondeu a cotação' && l.detalhe.ip === '203.0.113.2'));
});

test('PF: expirado vira erro; visualizar sem mudança não gera aviso', async () => {
  const c = clienteFalso({ rpc: async (nome) => (nome === 'public_pfo_responder'
    ? { data: { ok: false, erro: 'expirado' }, error: null }
    : { data: { ok: true, mudou: false, rec: { id: 'PC-1', status: 'respondido' } }, error: null }) });
  const { store } = carregar('pedido-fornecedor-store.js', 'PFStore', c);
  await assert.rejects(() => store.salvarResposta(TOKEN, { moeda: 'USD' }), /expirou/);
  await store.marcarVisualizado(TOKEN);
  assert.strictEqual(c.chamadas.from.length, 0);
});

test('PF: RPC falhando cai no caminho antigo', async () => {
  const linha = { id: 'PC-1', token: TOKEN, status: 'enviado', fornecedor: { nome: 'Forn' } };
  const c = clienteFalso({ rpc: async () => { throw new Error('rede'); }, linha });
  const { store } = carregar('pedido-fornecedor-store.js', 'PFStore', c);
  assert.strictEqual((await store.salvarResposta(TOKEN, { moeda: 'USD' })).status, 'respondido');
  assert.ok(c.chamadas.from.some((x) => x.tabela === 'pedidos_fornecedor' && x.op === 'update'));
});
