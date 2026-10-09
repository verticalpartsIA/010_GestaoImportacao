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

const conhecida = (r) => ['almoxarifado', 'pcp', 'decisoes'].includes(r);

test('urlSegura — aceita caminho relativo de rota conhecida (com aba/item)', () => {
  assert.equal(M.urlSegura('/logistica/almoxarifado/reposicao', conhecida), '/logistica/almoxarifado/reposicao');
  assert.equal(M.urlSegura('/logistica/pcp/ordens/abc-123', conhecida), '/logistica/pcp/ordens/abc-123');
  assert.equal(M.urlSegura('/geral/decisoes', conhecida), '/geral/decisoes');
});

test('urlSegura — recusa o que não é caminho relativo seguro (sem redirecionamento aberto)', () => {
  assert.equal(M.urlSegura('https://evil.com/logistica/pcp', conhecida), null);
  assert.equal(M.urlSegura('//evil.com/logistica/pcp', conhecida), null);
  assert.equal(M.urlSegura('/\\evil.com/pcp', conhecida), null);
  assert.equal(M.urlSegura('javascript:alert(1)', conhecida), null);
  assert.equal(M.urlSegura('/logistica/rota-inexistente', conhecida), null);
  assert.equal(M.urlSegura('/so-um-segmento', conhecida), null);
  assert.equal(M.urlSegura('', conhecida), null);
  assert.equal(M.urlSegura(null, conhecida), null);
});

test('urlSegura — sem a lista de rotas conhecidas, recusa (falha fechada)', () => {
  assert.equal(M.urlSegura('/logistica/almoxarifado/reposicao', undefined), null);
});

test('paraNotificacao — carrega a rota do alerta; sem rota continua null', () => {
  assert.equal(M.paraNotificacao({ id: 'a', title: 't', module: 'Almoxarifado', rota: '/logistica/almoxarifado/reposicao' }, []).rota, '/logistica/almoxarifado/reposicao');
  assert.equal(M.paraNotificacao({ id: 'b', title: 't', module: 'Jurídico' }, []).rota, null);
});

test('rotaPara — Almoxarifado abre o módulo quando a notificação não tem rota própria', () => {
  assert.equal(M.rotaPara('Almoxarifado'), 'almoxarifado');
});

test('agruparPorPeriodo — sem created_at cai em Anteriores', () => {
  const grupos = M.agruparPorPeriodo([{ id: 1, createdAt: null }], new Date('2026-08-17T12:00:00'));
  assert.deepEqual(grupos.Anteriores.map((n) => n.id), [1]);
});

test('rotaPara — Comercial e Compras não caem mais no Dashboard', () => {
  assert.equal(M.rotaPara('Comercial'), 'propostas');
  assert.equal(M.rotaPara('Compras'), 'cotacoes-fornecedor');
});

test('visivelPorPreferencia — oculta só a categoria desligada', () => {
  const prefs = { financeiro: false, operacoes: true, comercial: true };
  assert.equal(M.visivelPorPreferencia({ module: 'Financeiro' }, prefs), false);
  assert.equal(M.visivelPorPreferencia({ module: 'Comissões' }, prefs), false);
  assert.equal(M.visivelPorPreferencia({ module: 'Comercial' }, prefs), true);
  assert.equal(M.visivelPorPreferencia({ module: 'Almoxarifado' }, prefs), true);
});

test('visivelPorPreferencia — Jurídico, Decisões e módulo desconhecido nunca somem', () => {
  const tudoOff = { financeiro: false, operacoes: false, comercial: false };
  assert.equal(M.visivelPorPreferencia({ module: 'Jurídico' }, tudoOff), true);
  assert.equal(M.visivelPorPreferencia({ module: 'Central de Decisões' }, tudoOff), true);
  assert.equal(M.visivelPorPreferencia({ module: 'Sistema' }, tudoOff), true);
});

test('visivelPorPreferencia — sem preferências salvas mostra tudo', () => {
  assert.equal(M.visivelPorPreferencia({ module: 'Financeiro' }, undefined), true);
  assert.equal(M.visivelPorPreferencia({ module: 'Engenharia' }, {}), true);
});

test('Inbox — ícone de e-mail e rota do Inbox; nunca oculto por preferência', () => {
  assert.equal(M.iconePara('Inbox'), 'mail');
  assert.equal(M.rotaPara('Inbox'), 'inbox');
  assert.equal(M.visivelPorPreferencia({ module: 'Inbox' }, { financeiro: false, operacoes: false, comercial: false }), true);
});
