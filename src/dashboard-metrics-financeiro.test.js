'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./dashboard-metrics-financeiro.js');
const M = window.FinanceiroMetrics;

test('contratosAbertos — exclui só os já Assinados', () => {
  const contratos = [{ status: 'Em análise' }, { status: 'Assinado' }, { status: 'Enviado' }];
  assert.equal(M.contratosAbertos(contratos).length, 2);
});

test('aReceber — soma o value dos contratos abertos', () => {
  const contratos = [
    { status: 'Em análise', value: 1000 },
    { status: 'Assinado', value: 5000 }, // não conta
    { status: 'Enviado', value: 2000 },
  ];
  assert.equal(M.aReceber(contratos), 3000);
});

test('comissoesPendentesValor — soma só as "Aguardando"', () => {
  const comissoes = [
    { status: 'Aguardando', comissao: 100 },
    { status: 'Paga', comissao: 500 },
    { status: 'Aguardando', comissao: 50 },
  ];
  assert.equal(M.comissoesPendentesValor(comissoes), 150);
});

test('gatilhosProximos — filtra por days_left, default 7 dias', () => {
  const gatilhos = [{ days_left: 3 }, { days_left: 10 }, { days_left: 7 }];
  assert.equal(M.gatilhosProximos(gatilhos).length, 2);
  assert.equal(M.gatilhosProximos(gatilhos, 30).length, 3);
});

test('diasRestantes — recalcula ao vivo a partir de due_date, ignora days_left congelado', () => {
  const agora = new Date('2026-08-22T12:00:00Z');
  // days_left gravado (2) na criação do gatilho, mas due_date já passou —
  // valor real tem que ser negativo (atrasado), não o congelado.
  const g = { due_date: '2026-08-21', days_left: 2 };
  assert.equal(M.diasRestantes(g, agora), -1);
});

test('diasRestantes — sem due_date, cai no days_left gravado', () => {
  assert.equal(M.diasRestantes({ due_date: null, days_left: 5 }, new Date()), 5);
});

test('gatilhosProximos — regressão: gatilho atrasado (days_left congelado positivo) continua entrando no filtro', () => {
  const agora = new Date('2026-08-22T12:00:00Z');
  const gatilhos = [{ due_date: '2026-08-21', days_left: 2 }]; // atrasado de verdade
  assert.equal(M.gatilhosProximos(gatilhos, 7, agora).length, 1);
});

test('kpis — formato compacto de moeda (R$ 1.2M / R$ 5k), não o "cheio"', () => {
  const out = M.kpis({
    contratos: [{ status: 'Em análise', value: 1_250_000 }],
    comissoes: [],
    gatilhos: [],
  });
  const aReceberKpi = out.find((k) => k.label === 'A receber');
  assert.equal(aReceberKpi.value, 'R$ 1.3M');
});

test('compute — devolve 4 KPIs', () => {
  const out = M.compute({ contratos: [], comissoes: [], gatilhos: [] });
  assert.equal(out.kpis.length, 4);
});
