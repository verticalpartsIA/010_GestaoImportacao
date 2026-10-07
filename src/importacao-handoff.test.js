'use strict';
/* ============================================================
   importacao-handoff.test.js — issue #707

   Leva o Nº da Cotação da tela de P.I. até "Criar RFQ"/"Criar IMS",
   via sessionStorage (mesmo racional do pcpIrPara já usado no PCP) —
   sem isso o campo numero_cotacao novo em RFQ/IMS dependeria 100% de
   digitação manual, que é o que o usuário apontou como baixo benefício
   prático (ninguém ia preencher sozinho).
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Node não tem sessionStorage — mock mínimo em memória, mesmo padrão
   de teste usado pros outros módulos de browser deste projeto. */
function criarSessionStorageFake() {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
}

global.window = global.window || {};
global.sessionStorage = criarSessionStorageFake();
require('./importacao-handoff.js');
const H = window.ImportacaoHandoff;

test('escrever + ler — leva o Nº da Cotação de uma tela pra outra', () => {
  H.escrever(955);
  const r = H.ler();
  assert.deepEqual(r, { numero_cotacao: 955 });
});

test('ler — consome a chave (2ª leitura seguida vem vazia, não reaplica em telas erradas)', () => {
  H.escrever(955);
  H.ler();
  assert.equal(H.ler(), null);
});

test('ler — sem nada escrito, devolve null (fluxo normal de "+ Nova" direto na tela)', () => {
  assert.equal(H.ler(), null);
});

test('sessionStorage indisponível (ex.: aba privada) nunca lança erro', () => {
  const real = global.sessionStorage;
  global.sessionStorage = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  assert.doesNotThrow(() => H.escrever(955));
  assert.equal(H.ler(), null);
  global.sessionStorage = real;
});
