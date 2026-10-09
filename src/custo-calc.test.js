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

const rec = (d, q, vu) => ({ situacao: 'recebido', data_pedido: d, quantidade: q, qtde_recebida: q, valor_unitario: vu });
const pen = (d, q, vu) => ({ situacao: 'pendente', data_pedido: d, quantidade: q, qtde_recebida: 0, valor_unitario: vu });

test('custoPorCompras: média PONDERADA pela quantidade (a linha minúscula de preço alto não distorce)', () => {
  // caso real VPEL-484: 7000 m × 3,5642 + 0,03 m × 8,86
  const r = C.custoPorCompras([rec('2025-02-26', 7000, 3.5642), rec('2025-05-13', 0.03, 8.86)], '2025-10-05');
  assert.equal(r.fonte, 'media_12m');
  assert.equal(r.n, 2);
  assert.equal(r.em, '2025-05-13');
  assert.ok(Math.abs(r.custo - 3.5642) < 0.001, 'esperava ~3,5642, veio ' + r.custo);
  // o "último preço" (8,86) estaria 2,5× errado: a regra não é essa
  assert.ok(r.custo < 4);
});

test('custoPorCompras: caso real VP-1389 fica perto do custo do Omie (37,18), não do "último preço" de R$ 280', () => {
  const r = C.custoPorCompras([rec('2023-06-05', 0.5, 18.61), rec('2025-05-13', 0.03, 280)], '2025-10-05', 36);
  assert.ok(r.custo > 30 && r.custo < 36, 'veio ' + r.custo);
});

test('custoPorCompras: só conta os últimos 12 meses', () => {
  const linhas = [rec('2024-01-10', 100, 1), rec('2026-06-01', 10, 5)];
  const r = C.custoPorCompras(linhas, '2026-10-05');
  assert.equal(r.custo, 5);
  assert.equal(r.n, 1);
  assert.equal(C.custoPorCompras([rec('2024-01-10', 100, 1)], '2026-10-05'), null);   // só compra antiga e nada pendente
});

test('custoPorCompras: preço 0 e quantidade 0 são ignorados (requisição sem preço)', () => {
  assert.equal(C.custoPorCompras([rec('2026-09-01', 8, 0)], '2026-10-05'), null);
  const r = C.custoPorCompras([rec('2026-09-01', 8, 0), rec('2026-09-02', 10, 2)], '2026-10-05');
  assert.equal(r.custo, 2);
  assert.equal(r.n, 1);
});

test('custoPorCompras: sem compra recebida, usa o preço do pedido PENDENTE (gaxeta: 100 MT × R$ 10,40)', () => {
  const r = C.custoPorCompras([pen('2026-09-28', 100, 10.4)], '2026-10-05');
  assert.equal(r.custo, 10.4);
  assert.equal(r.fonte, 'pedido_pendente');
  assert.equal(r.em, '2026-09-28');
});

test('custoPorCompras: compra recebida tem prioridade sobre o pedido pendente', () => {
  const r = C.custoPorCompras([rec('2026-07-31', 20, 5.13), pen('2026-09-28', 100, 9)], '2026-10-05');
  assert.equal(r.fonte, 'media_12m');
  assert.equal(r.custo, 5.13);
});

test('custoPorCompras: pendente com preço 0 não vira custo; sem linhas devolve null', () => {
  assert.equal(C.custoPorCompras([pen('2026-10-03', 8, 0)], '2026-10-05'), null);
  assert.equal(C.custoPorCompras([], '2026-10-05'), null);
  assert.equal(C.custoPorCompras(null, '2026-10-05'), null);
});

test('impacto: sem receita nenhuma não divide por zero', () => {
  const r = C.impacto({ X: new Set(['A']) }, {});
  assert.equal(r.X.pct, 0);
  assert.equal(r.X.receita, 0);
});
