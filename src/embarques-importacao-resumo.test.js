const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// O store é um script de navegador (IIFE que pendura em window): carrega num contexto isolado.
function carregar() {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'embarques-importacao-store.js'), 'utf8'), ctx);
  const st = ctx.window.EmbarquesImportacaoStore;
  // vm cria objetos de outro "realm": deepStrictEqual os acharia diferentes — passa por JSON.
  return { resumoPIs: (pis) => JSON.parse(JSON.stringify(st.resumoPIs(pis))) };
}

test('resumoPIs — mesma moeda: soma tudo, sem aviso', () => {
  const r = carregar().resumoPIs([
    { numero_pi: 'A', valor_total: 100, moeda: 'USD', numero_cotacao: 955 },
    { numero_pi: 'B', valor_total: 50, moeda: 'USD', numero_cotacao: 955 },
  ]);
  assert.equal(r.valorTotal, 150);
  assert.equal(r.moeda, 'USD');
  assert.equal(r.moedasMistas, false);
  assert.deepEqual(r.cotacoesDistintas, [955]);
});

test('resumoPIs — moedas mistas: total só da moeda da primeira P.I., o resto fica em totaisPorMoeda', () => {
  const r = carregar().resumoPIs([
    { numero_pi: 'A', valor_total: 100, moeda: 'USD' },
    { numero_pi: 'B', valor_total: 700, moeda: 'CNY' },
    { numero_pi: 'C', valor_total: 20, moeda: 'USD' },
  ]);
  assert.equal(r.valorTotal, 120);
  assert.equal(r.moeda, 'USD');
  assert.equal(r.moedasMistas, true);
  assert.deepEqual(r.totaisPorMoeda, { USD: 120, CNY: 700 });
});

test('resumoPIs — cotações diferentes: usa a primeira com Nº e lista as distintas', () => {
  const r = carregar().resumoPIs([
    { numero_pi: 'A', valor_total: 1, moeda: 'USD', numero_cotacao: null },
    { numero_pi: 'B', valor_total: 1, moeda: 'USD', numero_cotacao: 955 },
    { numero_pi: 'C', valor_total: 1, moeda: 'USD', numero_cotacao: 957 },
  ]);
  assert.equal(r.numeroCotacao, 955);
  assert.deepEqual(r.cotacoesDistintas, [955, 957]);
});

test('resumoPIs — sem P.I.: valores neutros', () => {
  const r = carregar().resumoPIs([]);
  assert.equal(r.valorTotal, 0);
  assert.equal(r.moeda, 'USD');
  assert.equal(r.moedasMistas, false);
  assert.equal(r.numeroCotacao, null);
});

test('resumoPIs — a base não depende da ordem em que as P.I. chegam', () => {
  const a = { id: '1', numero_pi: 'A', data_abertura: '2026-01-10', valor_total: 100, moeda: 'USD', numero_cotacao: 955 };
  const b = { id: '2', numero_pi: 'B', data_abertura: '2026-02-01', valor_total: 700, moeda: 'CNY', numero_cotacao: 957 };
  const r1 = carregar().resumoPIs([a, b]);
  const r2 = carregar().resumoPIs([b, a]);
  assert.equal(r1.moeda, 'USD');
  assert.equal(r2.moeda, 'USD');
  assert.equal(r2.valorTotal, 100);
  assert.equal(r2.numeroCotacao, 955);
});
