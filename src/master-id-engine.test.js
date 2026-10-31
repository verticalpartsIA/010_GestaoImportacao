'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./master-id-engine.js');
const { etapaId, proximaRevisao, parseRevisao } = window.MasterIdEngine;

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

test('parseRevisao — extrai a letra de um numero_documento de etapa, inverso de etapaId', () => {
  assert.equal(parseRevisao('VPPR-0990-B'), 'B');
  assert.equal(parseRevisao('VPPC-0990-AA'), 'AA', 'overflow de letra (depois de Z) também é reconhecido');
  assert.equal(parseRevisao('VPPR-0990'), null, 'sem sufixo — revisão original');
  assert.equal(parseRevisao(null), null);
  assert.equal(parseRevisao(''), null);
  assert.equal(parseRevisao('VPEL-EL0990-B-1'), null, 'formato de ID de equipamento, não de etapa — fora do escopo desta função');
});

test('parseRevisao ida e volta com etapaId', () => {
  assert.equal(parseRevisao(etapaId('proposta', 990, 'C')), 'C');
  assert.equal(parseRevisao(etapaId('proposta', 990)), null);
});
