'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./dashboard-metrics-engenharia.js');
const M = window.EngenhariaMetrics;

test('fichasDoMes — filtra fichas técnicas do mês corrente', () => {
  const hoje = new Date('2026-08-17T12:00:00Z');
  const fichas = [
    { id: 1, criado_em: '2026-08-01T10:00:00Z' },
    { id: 2, criado_em: '2026-07-31T10:00:00Z' },
  ];
  assert.deepEqual(M.fichasDoMes(fichas, hoje).map((f) => f.id), [1]);
});

test('catalogoAtivos — só produtos com situacao "ativado"', () => {
  const catalogo = [{ situacao: 'ativado' }, { situacao: 'rascunho' }, { situacao: 'ativado' }];
  assert.equal(M.catalogoAtivos(catalogo).length, 2);
});

test('alertasEngenharia — só alertas do módulo Engenharia', () => {
  const alertas = [{ module: 'Engenharia' }, { module: 'Financeiro' }];
  assert.equal(M.alertasEngenharia(alertas).length, 1);
});

// Regressão da issue #273: o widget de Pendências NCM recebia sempre um
// array vazio hardcoded — este teste garante que ncmPendentes() de fato
// repassa solicitações reais, filtrando só os status "em aberto".
test('ncmPendentes — mantém só EM_PREENCHIMENTO / AGUARD_JURIDICO / APROVADO', () => {
  const ncm = [
    { id: 1, status: 'EM_PREENCHIMENTO' },
    { id: 2, status: 'AGUARD_JURIDICO' },
    { id: 3, status: 'APROVADO' },
    { id: 4, status: 'APROVADO_PRONTO' },
    { id: 5, status: 'CADASTRADO' },
  ];
  assert.deepEqual(M.ncmPendentes(ncm).map((s) => s.id), [1, 2, 3]);
});

test('ncmPendentes — array vazio não quebra (regressão do bug original)', () => {
  assert.deepEqual(M.ncmPendentes([]), []);
  assert.deepEqual(M.ncmPendentes(undefined), []);
});

test('compute — devolve kpis (4 itens) e ncm pendente', () => {
  const out = M.compute({
    projetos: [],
    fichas: [{ id: 1, criado_em: '2026-08-01' }],
    catalogo: [{ situacao: 'ativado' }],
    alertas: [{ module: 'Engenharia' }],
    ncmSolicitacoes: [{ id: 1, status: 'EM_PREENCHIMENTO' }],
    hoje: new Date('2026-08-17T12:00:00Z'),
  });
  assert.equal(out.kpis.length, 4);
  assert.equal(out.ncm.length, 1);
});
