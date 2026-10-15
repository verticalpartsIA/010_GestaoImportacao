'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./instalador-recibos-store.js');
const S = window.InstaladorRecibosStore;

test('abatimento: só adiantamento assinado, parcela por parcela, sem tocar em parcela paga', () => {
  const parcelas = [
    { id: 'p1', numero: 1, valor: 6000, status: 'paga' },
    { id: 'p2', numero: 2, valor: 6000, status: 'pendente' },
    { id: 'p3', numero: 3, valor: 6000, status: 'pendente' },
  ];
  const recibos = [
    { tipo: 'adiantamento', status: 'assinado', valor: 7000 },
    { tipo: 'adiantamento', status: 'pendente', valor: 5000 },   // ainda não assinado: não abate
    { tipo: 'parcela', status: 'assinado', valor: 6000 },        // pagamento de parcela: não é adiantamento
  ];
  const r = S.aplicarAbatimento(parcelas, recibos);
  assert.deepEqual(r.porParcela.p1, { abatido: 0, aPagar: 6000 });
  assert.deepEqual(r.porParcela.p2, { abatido: 6000, aPagar: 0 });
  assert.deepEqual(r.porParcela.p3, { abatido: 1000, aPagar: 5000 });
  assert.equal(r.totalAbativel, 7000); assert.equal(r.excedente, 0);
});
test('abatimento: excedente quando o adiantamento passa do que resta', () => {
  const r = S.aplicarAbatimento([{ id: 'a', numero: 1, valor: 1000, status: 'pendente' }], [{ tipo: 'adiantamento', status: 'assinado', valor: 1500.5 }]);
  assert.equal(r.porParcela.a.aPagar, 0); assert.equal(r.excedente, 500.5);
});
test('validar', () => {
  assert.equal(S.validar({ tipo: 'adiantamento', parceiro_instalador_id: 'M', valor: 10, data_pagamento: '2026-10-15' }).length, 0);
  assert.equal(S.validar({ tipo: 'x' }).length, 4);
});
