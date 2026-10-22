'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./fabricacao-oficina-calc.js');
const C = window.FabOficinaCalc;

const etapas = (feitas) => [17, 17, 17, 17, 16, 16].map((peso, i) => ({ id: 'e' + i, ordem: i + 1, peso, flegado: i < feitas }));

test('progresso: ponderado, teto 99 e 100 só com tudo feito', () => {
  assert.equal(C.progresso(etapas(0)), 0);
  assert.equal(C.progresso(etapas(2)), 34);
  assert.equal(C.progresso(etapas(5)), 84);
  assert.equal(C.progresso(etapas(6)), 100);
  assert.equal(C.progresso([]), 0);
});

test('progresso: pesos que não somam 100 nunca chegam a 100', () => {
  assert.equal(C.progresso([{ id: 'a', ordem: 1, peso: 30, flegado: true }, { id: 'b', ordem: 2, peso: 30, flegado: true }]), 60);
});

test('etapaAtualId: primeira não feita, por ordem', () => {
  const e = etapas(2).reverse();
  assert.equal(C.etapaAtualId(e), 'e2');
  assert.equal(C.etapaAtualId(etapas(6)), null);
});

test('pausado: só ocorrência aberta sem frente de trabalho', () => {
  assert.equal(C.pausado([{ status: 'aberta', tem_frente_trabalho: false }]), true);
  assert.equal(C.pausado([{ status: 'aberta', tem_frente_trabalho: true }]), false);
  assert.equal(C.pausado([{ status: 'resolvida', tem_frente_trabalho: false }]), false);
});

test('unidadeDoTitulo', () => {
  assert.deepEqual(C.unidadeDoTitulo('Corrimão X — unidade 2/3'), { n: 2, de: 3 });
  assert.equal(C.unidadeDoTitulo('Corrimão X'), null);
});
