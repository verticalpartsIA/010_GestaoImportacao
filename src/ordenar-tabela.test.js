const test = require('node:test');
const assert = require('node:assert');
global.window = {};
require('./ordenar-tabela.js');
const { ordenar } = global.window.OrdenarTabela;

const L = [{ c: 'B10', q: 5 }, { c: 'B2', q: null }, { c: 'A1', q: 20 }, { c: 'C', q: 1 }];
const g = { c: (l) => l.c, q: (l) => l.q };

test('texto ordena com números naturais e sentido crescente/decrescente', () => {
  assert.deepStrictEqual(ordenar(L, { chave: 'c', dir: 1 }, g).map((l) => l.c), ['A1', 'B2', 'B10', 'C']);
  assert.deepStrictEqual(ordenar(L, { chave: 'c', dir: -1 }, g).map((l) => l.c), ['C', 'B10', 'B2', 'A1']);
});
test('número ordena como número e vazio vai sempre ao fim', () => {
  assert.deepStrictEqual(ordenar(L, { chave: 'q', dir: 1 }, g).map((l) => l.q), [1, 5, 20, null]);
  assert.deepStrictEqual(ordenar(L, { chave: 'q', dir: -1 }, g).map((l) => l.q), [20, 5, 1, null]);
});
test('sem coluna escolhida mantém a ordem original', () => {
  assert.strictEqual(ordenar(L, { chave: null, dir: 1 }, g), L);
});
