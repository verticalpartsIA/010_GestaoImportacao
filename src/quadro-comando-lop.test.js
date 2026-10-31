'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./quadro-comando-bom-engine.js');
const E = window.QuadroComandoBomEngine;

const qtd = (itens, sku) => (itens.find((i) => i.sku === sku) || {}).quantidade;

test('LOP: 4 paradas, intermediários com 2 botões = 1 Sobe + 1 Desce + 2 botoeiras de 2 botões', () => {
  const it = E.montarItensLop(4, 2);
  assert.equal(qtd(it, 'VPB-034'), 1);
  assert.equal(qtd(it, 'VPB-033'), 1);
  assert.equal(qtd(it, 'VPB-035'), 2);
  assert.equal(it.length, 3);
});

test('LOP: 5 paradas, 2 botões = 3 botoeiras de 2 botões', () => {
  assert.equal(qtd(E.montarItensLop(5, 2), 'VPB-035'), 3);
});

test('LOP: com display usa os modelos VTP 037/038/039', () => {
  const it = E.montarItensLop(4, 2, {}, true);
  assert.equal(qtd(it, 'VPB-039'), 1);
  assert.equal(qtd(it, 'VPB-038'), 1);
  assert.equal(qtd(it, 'VPB-037'), 2);
});

test('LOP: intermediários com 1 botão = só botoeiras de 1 botão (Seta Subida nos intermediários, estimado)', () => {
  const it = E.montarItensLop(4, 1);
  assert.equal(qtd(it, 'VPB-034'), 3);
  assert.equal(qtd(it, 'VPB-033'), 1);
  assert.equal(qtd(it, 'VPB-035'), undefined);
  assert.equal(it.find((i) => i.sku === 'VPB-034').confianca, 'estimado');
});

test('LOP: 2 paradas = só térreo e último', () => {
  const it = E.montarItensLop(2, 2);
  assert.equal(it.length, 2);
  assert.equal(qtd(it, 'VPB-035'), undefined);
});

test('LOP: sem nº de paradas válido não gera nada', () => {
  assert.equal(E.calcularLop(1, 2), null);
  assert.deepEqual(E.montarItensLop('abc', 2), []);
});

test('LOP: resumo de contagem e origem aceita pelo banco', () => {
  const r = E.calcularLop(4, 2);
  assert.equal(r.botoeiras1, 2);
  assert.equal(r.botoeiras2, 2);
  assert.equal(r.botoesTotal, 6);
  assert.ok(E.montarItensLop(4, 2).every((i) => i.origem === 'calculado_geometria'));
});

test('Inspeção: cabina (VPB-193) e poço (VPB-209) entram na BOM só quando "fornecer"', () => {
  const it = E.montarItensInspecao({ botoeira_inspecao_cabina: { decisao: 'fornecer' }, botoeira_inspecao_poco: { decisao: 'fornecer' } });
  assert.equal(qtd(it, 'VPB-193'), 1);
  assert.equal(qtd(it, 'VPB-209'), 1);
  const so = E.montarItensInspecao({ botoeira_inspecao_cabina: { decisao: 'fornecer' }, botoeira_inspecao_poco: { decisao: 'terceiro' } });
  assert.equal(so.length, 1);
  assert.deepEqual(E.montarItensInspecao({}), []);
});

const P = (f, t, extra) => ({ abertura_frontal: true, abertura_traseira: !!t, qtd_lop_frontal: f, qtd_lop_traseira: t || 0, ...extra });

test('LOP por paradas: frontal e traseira em 4 paradas = 2× a lista de um lado só', () => {
  const it = E.montarItensLopParadas([P(1, 1), P(1, 1), P(1, 1), P(1, 1)], 2);
  assert.equal(qtd(it, 'VPB-034'), 2);
  assert.equal(qtd(it, 'VPB-033'), 2);
  assert.equal(qtd(it, 'VPB-035'), 4);
});

test('LOP por paradas: traseira só em algumas paradas usa a ordem dentro da face traseira', () => {
  // traseira só nas paradas 2, 3 e 4 → térreo da face traseira = parada 2, último = parada 4
  const it = E.montarItensLopParadas([P(1, 0), P(1, 1), P(1, 1), P(1, 1)], 2);
  assert.equal(qtd(it, 'VPB-034'), 2);
  assert.equal(qtd(it, 'VPB-033'), 2);
  assert.equal(qtd(it, 'VPB-035'), 3);
});

test('LOP por paradas: quantidade manual por parada multiplica e 0 tira a parada da face', () => {
  const it = E.montarItensLopParadas([P(2, 0), P(0, 0, { abertura_frontal: true }), P(1, 0), P(1, 0)], 2);
  // face frontal: [2,1,1] → térreo ×2, intermediário ×1 (dois botões), último ×1
  assert.equal(qtd(it, 'VPB-034'), 2);
  assert.equal(qtd(it, 'VPB-035'), 1);
  assert.equal(qtd(it, 'VPB-033'), 1);
});

test('LOP por paradas: sem qtd informada assume 1 frontal (igual ao cálculo por nº de paradas)', () => {
  const a = E.montarItensLopParadas([{}, {}, {}, {}], 2).map((i) => [i.sku, i.quantidade]);
  const b = E.montarItensLop(4, 2).map((i) => [i.sku, i.quantidade]);
  assert.deepEqual(a.sort(), b.sort());
});
