// pedidoDaOp: número e tipo de obra de uma OP de quadro pelo texto (etiqueta de chicote).
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./etiquetas-store.js');
const { pedidoDaOp } = window.EtiquetasStore;

test('pedidoDaOp: OS do título da OP, da OP-mãe ou nº do pedido do Omie; sem número = sem pedido', () => {
  assert.deepEqual(pedidoDaOp('Montagem — OS 1212 (Modernização) — Quadro 1/9', null, null), { numero: '1212', obra: 'modernizacao' });
  assert.deepEqual(pedidoDaOp('Montagem — Quadro', 'OS 1300 — Modernização de Quadro de Comando', null), { numero: '1300', obra: 'modernizacao' });
  assert.deepEqual(pedidoDaOp('Montagem — VPEL-704b', 'OP-0002', 29972), { numero: '29972', obra: '' });
  assert.equal(pedidoDaOp('Montagem — VPEL-704b', null, null), null);
});
