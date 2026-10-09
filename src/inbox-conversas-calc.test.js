'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./inbox-conversas-calc.js');

const m = (id, o) => ({ id, date: '2026-10-01T10:00:00Z', subject: 'Cotação técnica VPEL-EL0970', from: 'kimmy@glarie.com', to: ['suporte@vpsistema.com'], numeroCotacao: null, ...o });

test('normalizarAssunto — tira Re:/Fwd:/RES:/ENC:, acento e maiúscula', () => {
  assert.equal(C.normalizarAssunto('Re: Re: Cotação Técnica'), 'cotacao tecnica');
  assert.equal(C.normalizarAssunto('RES: ENC: cotacao tecnica'), 'cotacao tecnica');
  assert.equal(C.normalizarAssunto('Fwd[2]: Oi'), 'oi');
  assert.equal(C.normalizarAssunto(null), '');
});

test('pontasExternas — recebido usa o remetente, enviado usa os destinatários; interno é ignorado', () => {
  assert.deepEqual(C.pontasExternas({ from: 'Kimmy@Glarie.com' }), ['kimmy@glarie.com']);
  assert.deepEqual(C.pontasExternas({ _pasta: 'sent', to: ['kimmy@glarie.com', 'vagner@verticalparts.com.br'] }), ['kimmy@glarie.com']);
  assert.deepEqual(C.pontasExternas({ from: 'suporte@vpsistema.com' }), []);
});

test('agrupar — In-Reply-To liga resposta à mensagem original (certo), mesmo com assunto trocado', () => {
  const msgs = [m('a', { date: '2026-10-01T10:00:00Z' }), m('b', { subject: 'outro assunto', from: 'x@y.com', date: '2026-10-02T10:00:00Z' })];
  const r = C.agrupar(msgs, { a: { messageId: '<1@x>' }, b: { messageId: '<2@x>', inReplyTo: '<1@x>' } });
  assert.equal(r.conversas.length, 1);
  assert.equal(r.conversas[0].repId, 'b');                // a mais recente representa a conversa
  assert.equal(r.conversas[0].total, 2);
});

test('agrupar — mesmo assunto + mesma ponta externa junta; enviado e recebido da mesma pessoa também', () => {
  const msgs = [
    m('r1', { date: '2026-10-01T10:00:00Z' }),
    m('s1', { _pasta: 'sent', from: 'suporte@vpsistema.com', to: ['kimmy@glarie.com'], subject: 'Re: Cotação técnica VPEL-EL0970', date: '2026-10-02T10:00:00Z' }),
  ];
  const r = C.agrupar(msgs, {});
  assert.equal(r.conversas.length, 1);
  assert.equal(r.porId.r1.repId, 's1');
});

test('agrupar — mesmo assunto com gente diferente NÃO junta, nem com a mesma Cotação Nº (fornecedores distintos)', () => {
  const msgs = [m('a', { subject: 'Orçamento', from: 'a@x.com' }), m('b', { subject: 'Re: Orçamento', from: 'b@y.com' })];
  assert.equal(C.agrupar(msgs, {}).conversas.length, 2);
  const mesmaCot = [m('a', { subject: 'Orçamento', from: 'a@x.com', numeroCotacao: 7 }), m('b', { subject: 'Orçamento', from: 'b@y.com', numeroCotacao: 7 })];
  assert.equal(C.agrupar(mesmaCot, {}).conversas.length, 2);
});

test('agrupar — avisos internos da mesma cotação e assunto (sem ponta externa) viram uma conversa só', () => {
  const interno = (id) => m(id, { _pasta: 'sent', from: 'suporte@vpsistema.com', to: ['diego@verticalparts.com.br'], numeroCotacao: 955, subject: 'Contrato VPCV-0955' });
  assert.equal(C.agrupar([interno('a'), interno('b')], {}).conversas.length, 1);
});

test('agrupar — assunto curto/vazio nunca junta por assunto', () => {
  const msgs = [m('a', { subject: 'Oi', from: 'a@x.com' }), m('b', { subject: 'Re: Oi', from: 'a@x.com' }), m('c', { subject: '', from: 'a@x.com' }), m('d', { subject: '', from: 'a@x.com' })];
  assert.equal(C.agrupar(msgs, {}).conversas.length, 4);
});
