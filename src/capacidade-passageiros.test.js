'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./capacidade-passageiros.js');
const C = window.CapacidadePassageiros;

test('kg ÷ 75, arredondado para baixo', () => {
  assert.equal(C.passageiros(750, 'Passageiro'), 10);
  assert.equal(C.passageiros(630, 'Passageiro'), 8);   // 8,4
  assert.equal(C.passageiros(1000, 'Hospitalar'), 13); // 13,33
  assert.equal(C.passageiros('450', 'Panorâmico'), 6);
});
test('elevador de carga não leva pessoas (qualquer grafia)', () => {
  assert.equal(C.passageiros(1000, 'Carga'), null);
  assert.equal(C.passageiros(1000, ' carga '), null);
  assert.equal(C.textoCapacidade(1000, 'Carga'), '1000Kg');
});
test('sem capacidade ou menos de uma pessoa: sem passageiros', () => {
  assert.equal(C.passageiros('', 'Passageiro'), null);
  assert.equal(C.passageiros(0, 'Passageiro'), null);
  assert.equal(C.passageiros(60, 'Passageiro'), null);
  assert.equal(C.textoCapacidade('', 'Passageiro'), '');
});
test('texto da capacidade para a Proposta', () => {
  assert.equal(C.textoCapacidade(750, 'Passageiro'), '10 Passageiros x 750Kg');
  assert.equal(C.textoCapacidade(630), '8 Passageiros x 630Kg'); // tipo desconhecido = tratado como pessoas
});
