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

test('compute — devolve kpis (5 itens, com Comissões) e alertasCriticos (array)', () => {
  const out = M.compute({ projetos: [], embarques: [], alertas: [], propostas: [], contratos: [], avais: [], comissoes: [] });
  assert.equal(out.kpis.length, 5);
  assert.ok(Array.isArray(out.alertasCriticos));
});

// A02 (auditoria 10/09): seletor de período do Dashboard mudava o rótulo
// sem filtrar nada. projetosPeriodo/propostasPeriodo/comissoesPeriodo são
// opcionais (default = array completo, mantém as 8 chamadas acima intactas).
test('kpis — sem *Periodo, usa os arrays completos (compat)', () => {
  const out = M.kpis({
    projetos: [{ id: 1 }, { id: 2 }], embarques: [], alertas: [],
    propostas: [{ status: 'aprovada', valor_total: 100 }], contratos: [], avais: [],
    comissoes: [{ comissao: 10 }, { comissao: 20 }],
  });
  assert.equal(out.find((k) => k.label === 'Projetos ativos').value, '2');
  assert.equal(out.find((k) => k.label.startsWith('Comissões')).sub, '2 registros');
});

test('kpis — com *Periodo, usa só o recorte filtrado (Projetos/Faturamento/Comissões)', () => {
  const out = M.kpis({
    projetos: [{ id: 1 }, { id: 2 }, { id: 3 }], embarques: [], alertas: [],
    propostas: [{ status: 'aprovada', valor_total: 999999 }], contratos: [], avais: [],
    comissoes: [{ comissao: 10 }, { comissao: 20 }, { comissao: 30 }],
    projetosPeriodo: [{ id: 1 }],
    propostasPeriodo: [{ status: 'aprovada', valor_total: 100000 }],
    comissoesPeriodo: [{ comissao: 10 }],
  });
  assert.equal(out.find((k) => k.label === 'Projetos ativos').value, '1');
  assert.equal(out.find((k) => k.label.startsWith('Faturamento')).value, 'R$ 100k');
  assert.equal(out.find((k) => k.label.startsWith('Comissões')).sub, '1 registros');
});

// #612: "Projetos ativos" dava 0 em "Hoje" (recorte por start_date >= hoje =
// "iniciados hoje") com 38 projetos em andamento no Gantt.
test('projetosAtivosNoPeriodo — projeto iniciado antes e ainda em andamento conta como ativo em "Hoje"', () => {
  const hojeZero = new Date('2026-10-03T00:00:00');
  const agora = '2026-10-03T12:00:00';
  const out = M.projetosAtivosNoPeriodo([
    { id: 'antigo', start_date: '2026-08-01', end_date: null },
    { id: 'novo', start_date: '2026-10-03', end_date: null },
  ], hojeZero, agora);
  assert.deepEqual(out.map((p) => p.id), ['antigo', 'novo']);
});

test('projetosAtivosNoPeriodo — terminou antes do período, ou ainda não começou, fica de fora', () => {
  const desde = new Date('2026-09-26T00:00:00');
  const agora = '2026-10-03T12:00:00';
  const out = M.projetosAtivosNoPeriodo([
    { id: 'terminou-antes', start_date: '2026-07-01', end_date: '2026-09-01' },
    { id: 'terminou-dentro', start_date: '2026-07-01', end_date: '2026-09-30' },
    { id: 'futuro', start_date: '2026-11-01', end_date: null },
    { id: 'sem-data', start_date: null, end_date: null },
  ], desde, agora);
  assert.deepEqual(out.map((p) => p.id), ['terminou-dentro', 'sem-data']);
});

test('projetosAtivosNoPeriodo — sem período devolve todos (e tolera lista vazia/nula)', () => {
  assert.equal(M.projetosAtivosNoPeriodo([{ id: 1 }, { id: 2 }], null).length, 2);
  assert.deepEqual(M.projetosAtivosNoPeriodo(null, new Date()), []);
});

test('kpis — Embarques em trânsito e Alertas críticos ignoram *Periodo de propósito (foto do estado atual)', () => {
  const out = M.kpis({
    projetos: [], embarques: [{ status: 'Em trânsito' }], alertas: [],
    propostas: [{ id: 'p1', status: 'aprovada', numero_cotacao: 1, valor_total: 500 }],
    contratos: [], avais: [],
    comissoes: [],
    propostasPeriodo: [], // faturamento zerado no período, mas o alerta de "sem contrato" continua
  });
  assert.equal(out.find((k) => k.label === 'Embarques em trânsito').value, '1');
  assert.equal(out.find((k) => k.label === 'Alertas críticos').value, '1');
  assert.equal(out.find((k) => k.label.startsWith('Faturamento')).value, 'R$ 0');
});
