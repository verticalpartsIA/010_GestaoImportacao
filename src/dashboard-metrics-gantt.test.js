'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./dashboard-metrics-gantt.js');
const M = window.ProjetosGanttMetrics;

test('ganttStart — projeto mais antigo por start_date', () => {
  const projetos = [{ start_date: '2026-03-01' }, { start_date: '2026-01-15' }, { start_date: '2026-02-01' }];
  assert.equal(M.ganttStart(projetos), +new Date('2026-01-15'));
});

test('ganttStart — sem projetos cai pra "agora" (não quebra com array vazio)', () => {
  const antes = Date.now();
  const r = M.ganttStart([]);
  assert.ok(r >= antes);
});

test('ganttToday — dias desde o início da timeline', () => {
  const projetos = [{ start_date: '2026-08-01' }];
  const agora = +new Date('2026-08-11');
  assert.equal(M.ganttToday(projetos, agora), 10);
});

test('projetosComFases — 5 fases sintéticas por projeto, tamanho igual', () => {
  const projetos = [{ id: 'p1', start_date: '2026-01-01', end_date: '2026-01-31' }];
  const r = M.projetosComFases(projetos, +new Date('2026-01-01'));
  assert.equal(r.length, 1);
  assert.equal(r[0].phases.length, 5);
  assert.deepEqual(r[0].phases.map((p) => p.name), M.GANTT_PHASES);
});

test('projetosComFases — sem end_date usa +150 dias como padrão', () => {
  const projetos = [{ id: 'p1', start_date: '2026-01-01' }];
  const r = M.projetosComFases(projetos, +new Date('2026-01-01'));
  const ultimaFase = r[0].phases[4];
  assert.ok(ultimaFase.end > 100); // período mínimo respeitado
});

test('projetosComFases — marca a fase atual (current_phase) como "current"', () => {
  const projetos = [{ id: 'p1', start_date: '2026-01-01', end_date: '2026-06-01', current_phase: 'Importação' }];
  const r = M.projetosComFases(projetos, +new Date('2026-01-01'));
  const importacao = r[0].phases.find((p) => p.name === 'Importação');
  const projeto = r[0].phases.find((p) => p.name === 'Projeto');
  assert.equal(importacao.status, 'current');
  assert.equal(projeto.status, 'done');
});

test('compute — devolve ganttToday e ganttProjetos juntos', () => {
  const out = M.compute({ projetos: [{ id: 'p1', start_date: '2026-08-01' }], agora: +new Date('2026-08-17') });
  assert.equal(typeof out.ganttToday, 'number');
  assert.equal(out.ganttProjetos.length, 1);
});
