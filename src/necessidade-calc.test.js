'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./necessidade-calc.js');
const N = window.PcpNecessidade;

const cfg = { prazo_importado_dias: 90, prazo_nacional_dias: 15 };
const hoje = '2026-10-03';
const sem = { fisico: 0, aCaminho: 0 };

test('explode a estrutura e abate estoque e o que está a caminho', () => {
  // 2 quadros Q = cada um 1 inversor A e 4 contatores B
  const filhos = { Q: [{ codigo_filho: 'A', quantidade: 1 }, { codigo_filho: 'B', quantidade: 4 }] };
  const estoque = { Q: sem, A: { fisico: 1, aCaminho: 0 }, B: { fisico: 0, aCaminho: 3 } };
  const r = N.calcular({ demanda: [{ codigo: 'Q', qtd: 2, ref: 'P1', previsao: '2027-06-01' }], filhos, estoque, hoje, cfg });
  const q = r.fabricados.find(x => x.codigo === 'Q');
  assert.equal(q.produzir, 2);
  assert.equal(r.comprados.find(x => x.codigo === 'A').falta, 1);   // 2 − 1 em mãos
  assert.equal(r.comprados.find(x => x.codigo === 'B').falta, 5);   // 8 − 3 a caminho
});

test('acabado em estoque abate o que falta produzir', () => {
  const filhos = { Q: [{ codigo_filho: 'A', quantidade: 1 }] };
  const r = N.calcular({ demanda: [{ codigo: 'Q', qtd: 3, ref: 'P1' }], filhos, estoque: { Q: { fisico: 2, aCaminho: 0 }, A: sem }, hoje, cfg });
  assert.equal(r.fabricados[0].produzir, 1);
  assert.equal(r.comprados[0].necessario, 1);
});

test('item compartilhado: soma tudo antes de abater o estoque, uma vez só', () => {
  // Q1 e Q2 usam o kit K (1 e 2 por quadro); K usa 3 de M. Estoque de M = 10.
  const filhos = { Q1: [{ codigo_filho: 'K', quantidade: 1 }], Q2: [{ codigo_filho: 'K', quantidade: 2 }], K: [{ codigo_filho: 'M', quantidade: 3 }] };
  const r = N.calcular({
    demanda: [{ codigo: 'Q1', qtd: 1, ref: 'P1' }, { codigo: 'Q2', qtd: 1, ref: 'P2' }],
    filhos, estoque: { Q1: sem, Q2: sem, K: sem, M: { fisico: 10, aCaminho: 0 } }, hoje, cfg,
  });
  assert.equal(r.fabricados.find(x => x.codigo === 'K').necessario, 3);
  const m = r.comprados.find(x => x.codigo === 'M');
  assert.equal(m.necessario, 9);
  assert.equal(m.falta, 0);
  assert.equal(m.status, 'coberto');
  assert.deepEqual(m.refs.sort(), ['P1', 'P2']);
});

test('perda da estrutura aumenta a necessidade', () => {
  const filhos = { Q: [{ codigo_filho: 'A', quantidade: 10, perda_pct: 10 }] };
  const r = N.calcular({ demanda: [{ codigo: 'Q', qtd: 1, ref: 'P1' }], filhos, estoque: { Q: sem, A: sem }, hoje, cfg });
  assert.ok(Math.abs(r.comprados[0].necessario - 11) < 1e-9);
});

test('prazo: previsão em 60 dias com 90 de prazo = atrasado; em 120 dias = comprar até daqui a 30', () => {
  const dem = (previsao) => [{ codigo: 'X', qtd: 5, ref: 'P1', previsao }];
  const atrasado = N.calcular({ demanda: dem('2026-12-02'), filhos: {}, estoque: { X: sem }, hoje, cfg }).comprados[0];
  assert.equal(atrasado.status, 'atrasado');
  assert.equal(atrasado.diasAtePrevisao, 60);
  const ok = N.calcular({ demanda: dem('2027-01-31'), filhos: {}, estoque: { X: sem }, hoje, cfg }).comprados[0];
  assert.equal(ok.status, 'comprar');
  assert.equal(ok.comprarAte, '2026-11-02');
  const semData = N.calcular({ demanda: dem(null), filhos: {}, estoque: { X: sem }, hoje, cfg }).comprados[0];
  assert.equal(semData.status, 'sem_data');
});

test('nacional usa o prazo menor', () => {
  const r = N.calcular({ demanda: [{ codigo: 'VP-9n', qtd: 1, ref: 'P1', previsao: '2026-10-28' }], filhos: {}, estoque: { 'VP-9n': sem }, hoje, cfg }).comprados[0];
  assert.equal(r.prazo, 15);
  assert.equal(r.status, 'comprar');         // 25 dias até a previsão, prazo 15
});

test('a previsão mais cedo e os pedidos acompanham os componentes', () => {
  const filhos = { Q: [{ codigo_filho: 'A', quantidade: 1 }] };
  const r = N.calcular({
    demanda: [{ codigo: 'Q', qtd: 1, ref: 'P1', previsao: '2027-03-01' }, { codigo: 'Q', qtd: 1, ref: 'P2', previsao: '2027-01-15' }],
    filhos, estoque: { Q: sem, A: sem }, hoje, cfg,
  });
  assert.equal(r.comprados[0].previsao, '2027-01-15');
  assert.equal(r.comprados[0].necessario, 2);
});

test('ciclo na estrutura não trava', () => {
  const filhos = { A: [{ codigo_filho: 'B', quantidade: 1 }], B: [{ codigo_filho: 'A', quantidade: 1 }] };
  const r = N.calcular({ demanda: [{ codigo: 'A', qtd: 1, ref: 'P1' }], filhos, estoque: { A: sem, B: sem }, hoje, cfg });
  assert.ok(r.ciclos.length > 0);
});
