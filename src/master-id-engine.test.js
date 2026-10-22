'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./master-id-engine.js');
const { etapaId, proximaRevisao } = window.MasterIdEngine;

test('etapaId sem revisão — igual a sempre (retrocompatível, chamada com 2 args)', () => {
  assert.equal(etapaId('precificacao', 990), 'VPPC-0990');
  assert.equal(etapaId('proposta', 950), 'VPPR-0950');
});

test('etapaId com revisão — sufixo de letra pendurado no final', () => {
  assert.equal(etapaId('precificacao', 990, 'B'), 'VPPC-0990-B');
  assert.equal(etapaId('precificacao', 990, null), 'VPPC-0990', 'revisão nula/vazia não pendura traço sozinho');
  assert.equal(etapaId('precificacao', 990, ''), 'VPPC-0990');
});

test('proximaRevisao encadeia com etapaId pra andar pra próxima letra livre', () => {
  assert.equal(etapaId('precificacao', 990, proximaRevisao('B')), 'VPPC-0990-C');
});
