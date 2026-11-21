const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function carregarStore(arquivo, opts = {}) {
  const code = fs.readFileSync(path.join(__dirname, arquivo), 'utf8');
  const toasts = [];
  const win = {
    __VP_SB: { sb: opts.sb },
    __VP_USER: { email: 'tester@verticalparts.com.br' },
    toast: (msg, tipo) => toasts.push({ msg, tipo }),
    DecisoesStore: opts.DecisoesStore,
    PropostaStore: opts.PropostaStore,
  };
  global.window = win;
  new Function('window', code)(win);
  return { win, toasts };
}

function fakeSbErro(errorObj) {
  const chain = {
    select: () => chain,
    in: () => chain,
    eq: () => chain,
    or: () => chain,
    order: () => chain,
    limit: () => chain,
    then: (res) => res({ data: null, error: errorObj }),
  };
  return { from: () => chain };
}

test('DecisoesStore: erro 42501/permission denied devolve [] e limita toast a 1 a cada 5 min', async () => {
  const { win, toasts } = carregarStore('decisoes-store.js', { sb: fakeSbErro({ code: '42501', message: 'permission denied for table decisoes_gerenciais' }) });
  const r1 = await win.DecisoesStore.listarPendentesParaMim();
  const r2 = await win.DecisoesStore.listarTodasEmAberto();
  assert.deepEqual(r1, []);
  assert.deepEqual(r2, []);
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].tipo, 'error');
});

test('DecisoesStore: erro genérico devolve lista vazia sem toast', async () => {
  const { win, toasts } = carregarStore('decisoes-store.js', { sb: fakeSbErro({ code: '500', message: 'timeout' }) });
  const r = await win.DecisoesStore.listarPendentesParaMim();
  assert.deepEqual(r, []);
  assert.equal(toasts.length, 0);
});

test('AvalFinanceiroStore: erro 42501 em listarFila dispara toast (limitado) e devolve []', async () => {
  const { win, toasts } = carregarStore('aval-financeiro-store.js', { sb: fakeSbErro({ code: '42501', message: 'permission denied' }) });
  const r1 = await win.AvalFinanceiroStore.listarFila();
  const r2 = await win.AvalFinanceiroStore.listarFila();
  assert.deepEqual(r1, []);
  assert.deepEqual(r2, []);
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].tipo, 'error');
});

test('AvalJuridicoStore: erro 42501 em listarFila dispara toast (limitado) e devolve []', async () => {
  const { win, toasts } = carregarStore('aval-juridico-store.js', { sb: fakeSbErro({ code: '42501', message: 'permission denied' }) });
  const r1 = await win.AvalJuridicoStore.listarFila();
  const r2 = await win.AvalJuridicoStore.listarFila();
  assert.deepEqual(r1, []);
  assert.deepEqual(r2, []);
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].tipo, 'error');
});
