/* ============================================================
   dashboard-metrics-comercial.test.js
   node --test src/dashboard-metrics-comercial.test.js
   (ou `npm test`, que roda node --test em todo src/)

   Sem framework externo — node:test é nativo (Node 18+), zero
   dependência nova no package.json.
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// dashboard-metrics-comercial.js é um script de browser (window.ComercialMetrics,
// sem module.exports) — carrega num window de mentira só pra rodar fora do browser.
global.window = global.window || {};
require('./dashboard-metrics-comercial.js');
const M = window.ComercialMetrics;

test('leadsDoMes — filtra só leads do mês corrente', () => {
  const hoje = new Date('2026-08-17T12:00:00Z');
  const leads = [
    { id: 1, date: '2026-08-01' },
    { id: 2, date: '2026-08-16' },
    { id: 3, date: '2026-07-31' }, // mês anterior — não conta
    { id: 4, date: '' },           // sem data — não conta
  ];
  const r = M.leadsDoMes(leads, hoje);
  assert.deepEqual(r.map((l) => l.id), [1, 2]);
});

test('cotacoesAbertas — só os status considerados "abertos"', () => {
  const cotacoes = [
    { status: 'Aguardando China' },
    { status: 'Recebida' },
    { status: 'Em análise' },
    { status: 'Fechada' },
    { status: 'Cancelada' },
  ];
  assert.equal(M.cotacoesAbertas(cotacoes).length, 3);
});

test('conversaoLeadProposta — sem leads não divide por zero', () => {
  assert.equal(M.conversaoLeadProposta([], []), 0);
});

test('conversaoLeadProposta — calcula percentual corretamente', () => {
  const leads = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const enviadas = [{ id: 1 }];
  assert.equal(M.conversaoLeadProposta(leads, enviadas), 25);
});

test('propostasAprovadas — só status "aprovada"', () => {
  const propostas = [
    { id: 'a', status: 'aprovada' },
    { id: 'b', status: 'enviada' },
    { id: 'c', status: 'aprovada' },
  ];
  assert.deepEqual(M.propostasAprovadas(propostas).map((p) => p.id), ['a', 'c']);
});

test('idsComContrato — Set dos proposta_id com contrato emitido', () => {
  const contratos = [{ proposta_id: 'a' }, { proposta_id: null }, { proposta_id: 'c' }];
  const s = M.idsComContrato(contratos);
  assert.equal(s.has('a'), true);
  assert.equal(s.has('b'), false);
  assert.equal(s.size, 2);
});

// Regressão do bug histórico documentado em supabase.js: pipeline zerado
// mesmo com proposta assinada real — o funil precisa refletir a esteira
// Leads → Propostas enviadas → Propostas assinadas → Contratos usando as
// tabelas de verdade (propostas/contratos), não a tabela órfã `cotacoes`.
test('pipeline — proposta aprovada SEM contrato conta em "Propostas assinadas"', () => {
  const stages = M.pipeline({
    leads: [{ id: 1 }],
    propostas: [{ id: 'p1', status: 'aprovada' }],
    contratos: [],
  });
  const assinadas = stages.find((s) => s.label === 'Propostas assinadas');
  assert.equal(assinadas.value, 1);
});

test('pipeline — proposta aprovada COM contrato sai de "assinadas" e conta em "Contratos"', () => {
  const stages = M.pipeline({
    leads: [{ id: 1 }],
    propostas: [{ id: 'p1', status: 'aprovada' }],
    contratos: [{ proposta_id: 'p1' }],
  });
  const assinadas = stages.find((s) => s.label === 'Propostas assinadas');
  const contratosStage = stages.find((s) => s.label === 'Contratos');
  assert.equal(assinadas.value, 0);
  assert.equal(contratosStage.value, 1);
});

test('propostasEnviadas — conta da tabela propostas, não de leads.status', () => {
  const propostas = [
    { id: 'p1', status: 'enviada' },
    { id: 'p2', status: 'rascunho' }, // ainda não enviada — não conta
    { id: 'p3', status: 'aprovada' }, // já saiu de rascunho — conta
  ];
  assert.deepEqual(M.propostasEnviadas(propostas).map((p) => p.id), ['p1', 'p3']);
});

test('KPI "Propostas enviadas" e o Funil Pipeline concordam (regressão do achado da auditoria)', () => {
  const leads = [{ id: 1 }];
  const propostas = [
    { id: 'p1', status: 'enviada' },
    { id: 'p2', status: 'rascunho' },
  ];
  const out = M.compute({ leads, cotacoes: [], propostas, contratos: [] });
  const kpi = out.kpis.find((k) => k.label === 'Propostas enviadas');
  const funil = out.pipelineStages.find((s) => s.label === 'Propostas enviadas');
  assert.equal(kpi.value, '1');
  assert.equal(funil.value, 1);
});

test('origemBars — volume e conversão por origem, ordenado por volume desc', () => {
  const leads = [
    { origin: 'Site', status: 'Convertido' },
    { origin: 'Site', status: 'Novo' },
    { origin: 'Indicação', status: 'Convertido' },
  ];
  const bars = M.origemBars(leads);
  assert.equal(bars[0].l, 'Site');
  assert.equal(bars[0].v, 2);
  assert.equal(bars[0].conv, 50);
  assert.equal(bars[1].l, 'Indicação');
  assert.equal(bars[1].conv, 100);
});

test('compute — devolve o shape completo esperado pelo Dashboard', () => {
  const out = M.compute({
    leads: [{ id: 1, date: '2026-08-01', origin: 'Site', status: 'Convertido' }],
    cotacoes: [{ status: 'Recebida' }],
    propostas: [{ id: 'p1', status: 'aprovada' }],
    contratos: [],
  });
  assert.ok(Array.isArray(out.kpis) && out.kpis.length === 4);
  assert.ok(Array.isArray(out.pipelineStages) && out.pipelineStages.length === 4);
  assert.ok(Array.isArray(out.originBars));
});
