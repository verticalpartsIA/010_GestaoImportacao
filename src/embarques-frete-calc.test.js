'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
const C = require('./embarques-frete-calc.js');

test('totais: soma por moeda, USD e BRL separados, aceita "1.200,50" e "1200.5"', () => {
  const t = C.totais([
    { moeda: 'USD', valor: '1200.5' }, { moeda: 'USD', valor: 99.5 },
    { moeda: 'BRL', valor: '2.500,25' }, { moeda: 'BRL', valor: '' }, { moeda: 'USD', valor: 'abc' },
  ]);
  assert.deepEqual(t, { usd: 1300, brl: 2500.25 });
  assert.deepEqual(C.totais(null), { usd: 0, brl: 0 });
});

test('definirVencedor: só uma; clicar de novo desmarca', () => {
  const l = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const l1 = C.definirVencedor(l, 'b');
  assert.deepEqual(l1.map((c) => !!c.vencedor), [false, true, false]);
  const l2 = C.definirVencedor(l1, 'c');
  assert.deepEqual(l2.map((c) => !!c.vencedor), [false, false, true]);
  assert.equal(C.vencedor(C.definirVencedor(l2, 'c')), null);
});

test('resumoVencedor: copia agente, total em USD, prazos; sem vencedora = null', () => {
  assert.equal(C.resumoVencedor([{ id: 'a', taxas: [] }]), null);
  const r = C.resumoVencedor([{ id: 'a', vencedor: true, agente: 'Agente A', transit_time: '30', free_time: '14',
    taxas: [{ moeda: 'USD', valor: 1200 }, { moeda: 'BRL', valor: 2500 }] }]);
  assert.deepEqual(r, { agente_carga: 'Agente A', cotacao_frete: 1200, moeda_frete: 'USD', transit_time: 30, free_time: 14 });
});

test('resumoVencedor: só BRL usa o total em BRL; sem valor nenhum fica nulo', () => {
  const r = C.resumoVencedor([{ id: 'a', vencedor: true, agente: 'X', taxas: [{ moeda: 'BRL', valor: 900 }] }]);
  assert.equal(r.cotacao_frete, 900);
  assert.equal(r.moeda_frete, 'BRL');
  const v = C.resumoVencedor([{ id: 'a', vencedor: true, agente: 'X', taxas: [] }]);
  assert.equal(v.cotacao_frete, null);
  assert.equal(v.transit_time, null);
});

test('normalizar: embarque antigo (null, lixo) vira lista vazia; limita a 4 e completa campos', () => {
  assert.deepEqual(C.normalizar(null), []);
  assert.deepEqual(C.normalizar(undefined), []);
  assert.deepEqual(C.normalizar({}), []);
  const n = C.normalizar([{ id: 'x' }, null, { id: 'y' }, { id: 'z' }, { id: 'w' }, { id: 'v' }]);
  assert.equal(n.length, 4);
  assert.deepEqual(n[0].anexos, []);
  assert.deepEqual(n[0].envios, []);
  assert.deepEqual(n[0].taxas, []);
});

test('proximoId: formato FRT-xxxxxxxx e nunca repete um id já usado', () => {
  const a = C.proximoId([]);
  assert.match(a, /^FRT-[0-9a-f]{8}$/);
  const b = C.proximoId([{ id: a }]);
  assert.notEqual(a, b);
});
