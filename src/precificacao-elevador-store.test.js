'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./precificacao-elevador-store.js');
const { parseContainerNo } = window.PrecificacaoElevadorStore;

test('parseContainerNo — "1x40HC + 1x20GP" (resposta real da Glarie, VPCT-0950)', () => {
  const out = parseContainerNo('1x40HC + 1x20GP');
  assert.deepEqual(out, [
    { tipo_tamanho: "40'HC", quantidade: 1, preco_rs: 0 },
    { tipo_tamanho: "20'DV", quantidade: 1, preco_rs: 0 },
  ]);
});

test('parseContainerNo — vazio/nulo vira lista vazia', () => {
  assert.deepEqual(parseContainerNo(''), []);
  assert.deepEqual(parseContainerNo(null), []);
  assert.deepEqual(parseContainerNo(undefined), []);
});

test('parseContainerNo — texto sem padrão reconhecível vira "Outro"', () => {
  assert.deepEqual(parseContainerNo('a combinar com o despachante'), [
    { tipo_tamanho: 'Outro', quantidade: 1, preco_rs: 0 },
  ]);
});

test('parseContainerNo — quantidade > 1 e sufixo RF/OT/FR reconhecidos', () => {
  assert.deepEqual(parseContainerNo('2x40RF'), [{ tipo_tamanho: "40'RF", quantidade: 2, preco_rs: 0 }]);
});
