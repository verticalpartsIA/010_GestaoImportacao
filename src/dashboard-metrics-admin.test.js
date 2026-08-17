'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./dashboard-metrics-comercial.js'); // AdminMetrics compõe ComercialMetrics
require('./dashboard-metrics-admin.js');
const M = window.AdminMetrics;

test('embarquesEmTransito — só status "Em trânsito"', () => {
  const embarques = [{ status: 'Em trânsito' }, { status: 'Entregue' }];
  assert.equal(M.embarquesEmTransito(embarques).length, 1);
});

test('faturamentoTotal — soma valor_total das propostas aprovadas', () => {
  const propostas = [
    { status: 'aprovada', valor_total: 100000 },
    { status: 'enviada', valor_total: 999999 }, // não conta
    { status: 'aprovada', valor_total: 50000 },
  ];
  assert.equal(M.faturamentoTotal(propostas), 150000);
});

test('propostasSemContrato — aprovada sem contrato aparece, com contrato não', () => {
  const propostas = [{ id: 'p1', status: 'aprovada' }, { id: 'p2', status: 'aprovada' }];
  const contratos = [{ proposta_id: 'p1' }];
  const r = M.propostasSemContrato(propostas, contratos);
  assert.deepEqual(r.map((p) => p.id), ['p2']);
});

test('contratosValorZero — sem valor_total_num ou zerado', () => {
  const contratos = [{ valor_total_num: 0 }, { valor_total_num: null }, { valor_total_num: 5000 }];
  assert.equal(M.contratosValorZero(contratos).length, 2);
});

test('avaisSinalSemContrato — sinal pago sem contrato vinculado', () => {
  const avais = [
    { sinal_pago: true, contrato_venda_id: null },
    { sinal_pago: true, contrato_venda_id: 'c1' },
    { sinal_pago: false, contrato_venda_id: null },
  ];
  assert.equal(M.avaisSinalSemContrato(avais).length, 1);
});

// Regressão dos 2 bugs históricos de "Alertas críticos zerados" e
// "Faturamento zerado" documentados nos comentários originais do
// Dashboard — proposta assinada real, sem contrato, precisa aparecer
// nos dois lugares.
test('alertasCriticos — detecta proposta sem contrato mesmo sem alertas manuais', () => {
  const crit = M.alertasCriticos({
    alertas: [],
    propostas: [{ id: 'p1', status: 'aprovada', numero_cotacao: 904, valor_total: 185000 }],
    contratos: [],
    avais: [],
  });
  assert.equal(crit.length, 1);
  assert.equal(crit[0].tipo, 'proposta_sem_contrato');
  assert.equal(crit[0].ref, 904);
});

test('kpis — Faturamento reflete proposta aprovada real (regressão "R$0 com venda fechada")', () => {
  const out = M.kpis({
    projetos: [], embarques: [], alertas: [],
    propostas: [{ id: 'p1', status: 'aprovada', valor_total: 185000, numero_cotacao: 904 }],
    contratos: [], avais: [],
  });
  const faturamento = out.find((k) => k.label.startsWith('Faturamento'));
  assert.notEqual(faturamento.value, 'R$ 0');
  assert.equal(faturamento.value, 'R$ 185k');
});

test('compute — devolve kpis (4 itens) e alertasCriticos (array)', () => {
  const out = M.compute({ projetos: [], embarques: [], alertas: [], propostas: [], contratos: [], avais: [] });
  assert.equal(out.kpis.length, 4);
  assert.ok(Array.isArray(out.alertasCriticos));
});
