'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./rolagens-calc.js');
const R = window.RolagensCalc;

test('145º: nova data antes da prevista e comunicação fora de ordem', () => {
  const r = R.conferir([
    { data_anterior: '2026-08-26', nova_data: '2026-08-09', data_comunicacao: '2026-08-26', motivo: 'Tufão Dolphin' },
    { data_anterior: '2026-08-09', nova_data: '2026-09-17', data_comunicacao: '2026-08-09', motivo: 'Congestionamento' },
  ]);
  assert.equal(r.length, 2);
  assert.equal(r[0].indice, 0);
  assert.match(r[0].avisos[0], /anterior à data prevista/);
  assert.match(r[1].avisos[0], /comunicação/);
});

test('rolagens coerentes e campos vazios não geram aviso', () => {
  assert.deepEqual(R.conferir([
    { data_anterior: '2026-10-01', nova_data: '2026-10-09', data_comunicacao: '' },
    { data_anterior: '2026-10-09', nova_data: '2026-10-13', data_comunicacao: '2026-10-10' },
  ]), []);
  assert.deepEqual(R.conferir(null), []);
});

test('histórico do ETA: grava só mudança real, com motivo e quem', () => {
  assert.deepEqual(R.registrarMudancaEta([], '', '2026-10-19'), []);
  assert.deepEqual(R.registrarMudancaEta([], '2026-10-19', '2026-10-19'), []);
  const h = R.registrarMudancaEta([], '2026-10-19', '2026-10-24', { motivo: ' Fila no porto ', data_comunicacao: '2026-10-18', por: 'op@x', registrado_em: 'T' });
  assert.deepEqual(h, [{ data_anterior: '2026-10-19', nova_data: '2026-10-24', data_comunicacao: '2026-10-18', motivo: 'Fila no porto', por: 'op@x', registrado_em: 'T' }]);
  assert.equal(R.registrarMudancaEta(h, '2026-10-24', '2026-10-26').length, 2);
});
