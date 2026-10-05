'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./custo-calc.js');
const C = window.PcpCusto;

test('parseValor: ponto decimal NÃO vira milhar (o erro que gravava 12.50 como 1250)', () => {
  assert.equal(C.parseValor('12.50').valor, 12.5);
  assert.equal(C.parseValor('9.5').valor, 9.5);
  assert.equal(C.parseValor('0.75').valor, 0.75);
  assert.equal(C.parseValor('0.750').valor, 0.75);          // zero à esquerda: decimal, não milhar
  assert.equal(C.parseValor('12.5000').valor, 12.5);
  assert.equal(C.parseValor('12.50').aviso, undefined);
});

test('parseValor: vírgula é o decimal; ponto só como milhar', () => {
  assert.equal(C.parseValor('350').valor, 350);
  assert.equal(C.parseValor('9,5').valor, 9.5);
  assert.equal(C.parseValor('0,75').valor, 0.75);
  assert.equal(C.parseValor('1.234,56').valor, 1234.56);
  assert.equal(C.parseValor('123.456,78').valor, 123456.78);
  assert.equal(C.parseValor('999.999').valor, 999999);
  assert.ok(C.parseValor('1.234.567').erro);               // milhões: acima do limite, pede conferência
  assert.equal(C.parseValor('R$ 12,50').valor, 12.5);
  assert.equal(C.parseValor(',5').valor, 0.5);
});

test('parseValor: "1.234" é ambíguo → lê como milhar e AVISA', () => {
  const r = C.parseValor('1.234');
  assert.equal(r.valor, 1234);
  assert.match(r.aviso, /milhar/);
});

test('parseValor: vazio, inválido e fora do razoável', () => {
  assert.equal(C.parseValor('').vazio, true);
  assert.equal(C.parseValor('   ').vazio, true);
  assert.equal(C.parseValor(null).vazio, true);
  assert.ok(C.parseValor('abc').erro);
  assert.ok(C.parseValor('1,2,3').erro);
  assert.ok(C.parseValor('1,23.4').erro);
  assert.ok(C.parseValor('12.34.5').erro);        // pontos de milhar fora de lugar
  assert.ok(C.parseValor('0').erro);
  assert.ok(C.parseValor('0,00').erro);
  assert.ok(C.parseValor('-5').erro);
  assert.ok(C.parseValor('2000000').erro);        // > R$ 1.000.000
});

test('impacto: receita dos produtos vendidos que dependem de cada componente', () => {
  const usadoEm = { 'VPMP-918': new Set(['Q1', 'Q2', 'Q3']), 'VPB-320': new Set(['Q3']), 'SEM-VENDA': new Set() };
  const receita = { Q1: 100, Q2: 200, Q3: 700 };      // total 1000
  const r = C.impacto(usadoEm, receita);
  assert.equal(r['VPMP-918'].receita, 1000);
  assert.equal(r['VPMP-918'].pct, 1);
  assert.equal(r['VPMP-918'].produtos, 3);
  assert.equal(r['VPB-320'].receita, 700);
  assert.equal(r['VPB-320'].pct, 0.7);
  assert.equal(r['SEM-VENDA'].receita, 0);
});

test('impacto: sem receita nenhuma não divide por zero', () => {
  const r = C.impacto({ X: new Set(['A']) }, {});
  assert.equal(r.X.pct, 0);
  assert.equal(r.X.receita, 0);
});
