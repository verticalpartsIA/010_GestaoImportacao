'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
window.__VP_SB = { timeAgo: () => 'há 1h' };
require('./notificacoes-processamento.js');
const M = window.NotificacoesProcessamento;

test('iconePara — mapeia módulo pro ícone certo, sem cair em "bell" à toa', () => {
  assert.equal(M.iconePara('Jurídico'), 'fileText');
  assert.equal(M.iconePara('Engenharia'), 'ruler');
  assert.equal(M.iconePara('Propostas'), 'proposal');
  assert.equal(M.iconePara('Comissões'), 'award');
  assert.equal(M.iconePara('Importação'), 'ship');
});

test('iconePara — módulo desconhecido cai em "bell"', () => {
  assert.equal(M.iconePara('Sistema'), 'bell');
  assert.equal(M.iconePara(undefined), 'bell');
});

test('rotaPara — mapeia módulo pra rota do app', () => {
  assert.equal(M.rotaPara('Cotações'), 'cotacoes-fornecedor');
  assert.equal(M.rotaPara('Financeiro'), 'financeiro');
});

test('rotaPara — módulo desconhecido cai em "dashboard"', () => {
  assert.equal(M.rotaPara('Outro'), 'dashboard');
});

test('paraNotificacao — marca unread quando id não está em readIds', () => {
  const n = M.paraNotificacao({ id: 5, title: 'X', module: 'Financeiro', created_at: '2026-08-17T10:00:00Z' }, [1, 2]);
  assert.equal(n.unread, true);
  assert.equal(n.icon, 'dollar');
});

test('paraNotificacao — marca lida quando id está em readIds', () => {
  const n = M.paraNotificacao({ id: 1, title: 'X', module: 'Financeiro' }, [1, 2]);
  assert.equal(n.unread, false);
});

test('processarAlertas — mapeia lista inteira preservando ordem', () => {
  const out = M.processarAlertas([{ id: 1, module: 'Importação' }, { id: 2, module: 'Propostas' }], []);
  assert.deepEqual(out.map((n) => n.id), [1, 2]);
  assert.deepEqual(out.map((n) => n.icon), ['ship', 'proposal']);
});

test('naoLidas — só devolve as com unread=true', () => {
  const out = M.naoLidas([{ id: 1, unread: true }, { id: 2, unread: false }, { id: 3, unread: true }]);
  assert.deepEqual(out.map((n) => n.id), [1, 3]);
});

// agruparPorPeriodo compara created_at real, não faz parsing da string
// já formatada (bug corrigido nesta extração).
test('agruparPorPeriodo — separa Hoje/Ontem/Anteriores por data real', () => {
  const agora = new Date('2026-08-17T15:00:00');
  const notifications = [
    { id: 1, createdAt: '2026-08-17T09:00:00' },   // hoje de manhã
    { id: 2, createdAt: '2026-08-16T23:59:00' },   // ontem à noite
    { id: 3, createdAt: '2026-08-10T12:00:00' },   // semana passada
  ];
  const grupos = M.agruparPorPeriodo(notifications, agora);
  assert.deepEqual(grupos.Hoje.map((n) => n.id), [1]);
  assert.deepEqual(grupos.Ontem.map((n) => n.id), [2]);
  assert.deepEqual(grupos.Anteriores.map((n) => n.id), [3]);
});

test('agruparPorPeriodo — não confunde "há 23h" (ainda hoje) com "ontem" por causa da letra h', () => {
  // Regressão do bug original: groupLabel fazia n.time.includes('h') e
  // classificava qualquer coisa com "h" como "Hoje", inclusive antes das
  // 00h — o teste real é por data de calendário, não por texto.
  const agora = new Date('2026-08-17T23:30:00');
  const notifications = [{ id: 1, createdAt: '2026-08-17T00:05:00' }];
  const grupos = M.agruparPorPeriodo(notifications, agora);
  assert.deepEqual(grupos.Hoje.map((n) => n.id), [1]);
});

test('agruparPorPeriodo — omite grupos vazios do resultado', () => {
  const agora = new Date('2026-08-17T12:00:00');
  const grupos = M.agruparPorPeriodo([{ id: 1, createdAt: '2026-08-17T08:00:00' }], agora);
  assert.deepEqual(Object.keys(grupos), ['Hoje']);
});

test('agruparPorPeriodo — sem created_at cai em Anteriores', () => {
  const grupos = M.agruparPorPeriodo([{ id: 1, createdAt: null }], new Date('2026-08-17T12:00:00'));
  assert.deepEqual(grupos.Anteriores.map((n) => n.id), [1]);
});
