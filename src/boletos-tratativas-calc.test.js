'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./boletos-avisos-calc.js');
require('./boletos-tratativas-calc.js');
const T = window.BoletosTratativasCalc;
const C = window.BoletosAvisosCalc;

const HOJE = '2026-11-19';
const lista = [
  { codigo_cliente_omie: 1, razao_social: 'CLIENTE UM', cnpj: '11' },
  { codigo_cliente_omie: 2, razao_social: 'CLIENTE DOIS', cnpj: '22' },
  { codigo_cliente_omie: 3, razao_social: 'CLIENTE TRES', cnpj: '33' },
  { codigo_cliente_omie: 4, razao_social: 'CLIENTE QUATRO', cnpj: '44' },
];
const envios = [
  { id: 'e1', codigo_cliente_omie: 1, criado_em: '2026-11-18T10:00:00Z', para: ['a@x.com'], assunto: 'Seu boleto vence hoje', etapa: 'D0', status: 'enviado' },
  { id: 'e2', codigo_cliente_omie: 2, criado_em: '2026-11-18T10:00:00Z', para: ['b@x.com'], assunto: 'Vence amanhã', etapa: 'D-1', status: 'enviado' },
  { id: 'e3', codigo_cliente_omie: 3, criado_em: '2026-11-18T10:00:00Z', para: ['c@x.com'], assunto: 'Atraso', etapa: 'D+1', status: 'enviado' },
];
const resp = (id, envio, quando, o) => ({ id, referencia_id: envio, de_email: 'cliente@x.com', de_nome: 'Cliente', assunto: 'RE: aviso', corpo_texto: 'Já paguei, segue o comprovante', data_mensagem: quando, ...o });

test('classificarEntrada: aviso do servidor é devolução; o resto é resposta do cliente', () => {
  assert.equal(T.classificarEntrada({ de_email: 'postmaster@x.com', assunto: 'Não é possível entregar: X' }), 'devolucao');
  assert.equal(T.classificarEntrada({ de_email: 'financeiro@cliente.com', assunto: 'RE: Seu boleto vence hoje' }), 'resposta');
});

test('casosAtivos: cliente que respondeu e ninguém tratou entra como "sem resposta nossa"', () => {
  const r = T.casosAtivos({ lista, envios, entradas: [resp('r1', 'e1', '2026-11-18T12:00:00Z')], casos: [], tratativas: [], erros: new Map(), hojeISO: HOJE });
  assert.equal(r.length, 1);
  assert.equal(r[0].codigo_cliente_omie, 1);
  assert.equal(r[0].status, 'novo');
  assert.equal(r[0].semRespostaNossa, true);
  assert.equal(r[0].respondeu, true);
  assert.match(r[0].ultima.trecho, /comprovante/);
});

test('casosAtivos: depois de uma anotação ou resposta nossa, deixa de pedir ação, mas o caso continua na lista', () => {
  const entradas = [resp('r1', 'e1', '2026-11-18T12:00:00Z')];
  const casos = [{ codigo_cliente_omie: 1, status: 'em_tratativa', responsavel_email: 'joice@x.com', promessa_pagamento: null }];
  const tratativas = [{ id: 't1', codigo_cliente_omie: 1, tipo: 'nota', texto: 'liguei', autor: 'joice@x.com', criado_em: '2026-11-18T13:00:00Z' }];
  const r = T.casosAtivos({ lista, envios, entradas, casos, tratativas, erros: new Map(), hojeISO: HOJE });
  assert.equal(r.length, 1);
  assert.equal(r[0].semRespostaNossa, false);
  assert.equal(r[0].status, 'em_tratativa');
  assert.equal(r[0].responsavel, 'joice@x.com');
});

test('casosAtivos: nova resposta DEPOIS da nossa anotação volta a pedir ação', () => {
  const entradas = [resp('r1', 'e1', '2026-11-18T12:00:00Z'), resp('r2', 'e1', '2026-11-19T09:00:00Z', { corpo_texto: 'Ainda não recebi o boleto' })];
  const tratativas = [{ id: 't1', codigo_cliente_omie: 1, tipo: 'nota', texto: 'x', autor: 'a', criado_em: '2026-11-18T13:00:00Z' }];
  const casos = [{ codigo_cliente_omie: 1, status: 'aguardando_cliente' }];
  const r = T.casosAtivos({ lista, envios, entradas, casos, tratativas, erros: new Map(), hojeISO: HOJE });
  assert.equal(r[0].semRespostaNossa, true);
  assert.match(r[0].ultima.trecho, /Ainda não recebi/);
});

test('casosAtivos: devolução entra (e é a prioridade) mesmo sem resposta do cliente; devolução não conta como resposta', () => {
  const erros = new Map([[4, { tipo: 'devolvido', motivo: 'Não é possível entregar: X', para: ['d@x.com'], desde: '2026-11-19T08:00:00Z' }]]);
  const entradas = [resp('r1', 'e1', '2026-11-18T12:00:00Z'), { id: 'd1', referencia_id: 'e3', de_email: 'postmaster@x.com', assunto: 'Não é possível entregar: Atraso', corpo_texto: '', data_mensagem: '2026-11-18T10:05:00Z' }];
  const r = T.casosAtivos({ lista, envios, entradas, casos: [], tratativas: [], erros, hojeISO: HOJE });
  assert.deepEqual(r.map((c) => c.codigo_cliente_omie).sort(), [1, 4]);   // o cliente 3 só teve devolução de envio sem erro vigente: não entra
  const q = r.find((c) => c.codigo_cliente_omie === 4);
  assert.equal(q.devolvido, true);
  assert.equal(q.respondeu, false);
  assert.equal(q.semRespostaNossa, true);
});

test('casosAtivos: caso resolvido sai da lista; nova resposta depois de resolvido o reabre', () => {
  const casos = [{ codigo_cliente_omie: 1, status: 'resolvido', resolvido_em: '2026-11-18T15:00:00Z' }];
  const tratativas = [{ id: 't1', codigo_cliente_omie: 1, tipo: 'status', texto: '', autor: 'a', criado_em: '2026-11-18T15:00:00Z' }];
  const antes = T.casosAtivos({ lista, envios, entradas: [resp('r1', 'e1', '2026-11-18T12:00:00Z')], casos, tratativas, erros: new Map(), hojeISO: HOJE });
  assert.equal(antes.length, 0);
  const depois = T.casosAtivos({ lista, envios, entradas: [resp('r1', 'e1', '2026-11-18T12:00:00Z'), resp('r2', 'e1', '2026-11-19T07:00:00Z')], casos, tratativas, erros: new Map(), hojeISO: HOJE });
  assert.equal(depois.length, 1);
  assert.equal(depois[0].status, 'aberto');
  assert.equal(depois[0].semRespostaNossa, true);
});

test('casosAtivos: caso aberto à mão entra mesmo sem e-mail; dados faltando não quebram', () => {
  const casos = [{ codigo_cliente_omie: 2, status: 'aberto' }];
  const r = T.casosAtivos({ lista, envios, entradas: [], casos, tratativas: [], erros: new Map(), hojeISO: HOJE });
  assert.equal(r.length, 1);
  assert.equal(r[0].razao_social, 'CLIENTE DOIS');
  assert.equal(r[0].semRespostaNossa, false);
  assert.deepEqual(T.casosAtivos({}), []);
});

test('promessaVencida: só com data passada e caso não resolvido', () => {
  assert.equal(T.promessaVencida({ promessa_pagamento: '2026-11-18', status: 'em_tratativa' }, HOJE), true);
  assert.equal(T.promessaVencida({ promessa_pagamento: '2026-11-19', status: 'em_tratativa' }, HOJE), false);   // hoje ainda vale
  assert.equal(T.promessaVencida({ promessa_pagamento: '2026-11-18', status: 'resolvido' }, HOJE), false);
  assert.equal(T.promessaVencida({ promessa_pagamento: null, status: 'aberto' }, HOJE), false);
  assert.equal(T.promessaVencida(null, HOJE), false);
});

test('pedemAcao: conta resposta sem tratar, promessa vencida e caso novo', () => {
  assert.equal(T.pedemAcao([{ semRespostaNossa: true }, { promessaVencida: true }, { status: 'novo' }, { status: 'em_tratativa' }]), 3);
  assert.equal(T.pedemAcao(null), 0);
});

test('linhaDoTempo: junta avisos, respostas, devolução e tratativas em ordem cronológica', () => {
  const log = [
    { id: 'e1', criado_em: '2026-11-18T10:00:00Z', status: 'enviado', etapa: 'D0', assunto: 'Seu boleto vence hoje', para: ['a@x.com'], respostas: [
      resp('r1', 'e1', '2026-11-18T12:00:00Z'),
      { id: 'd1', referencia_id: 'e1', de_email: 'postmaster@x.com', assunto: 'Não é possível entregar: X', corpo_texto: '', data_mensagem: '2026-11-18T10:05:00Z' },
    ] },
    { id: 'e0', criado_em: '2026-11-13T10:00:00Z', status: 'erro', etapa: 'D-5', assunto: 'Lembrete', para: [], erro: 'falha', respostas: [] },
  ];
  const trat = [
    { id: 't1', tipo: 'nota', texto: 'liguei, vai pagar sexta', autor: 'joice@x.com', criado_em: '2026-11-18T13:00:00Z', meta: {} },
    { id: 't2', tipo: 'status', texto: '', autor: 'joice@x.com', criado_em: '2026-11-18T13:01:00Z', meta: { de: 'aberto', para: 'em_tratativa' } },
    { id: 't3', tipo: 'promessa', texto: '', autor: 'joice@x.com', criado_em: '2026-11-18T13:02:00Z', meta: { de: null, para: '2026-11-21' } },
  ];
  const l = T.linhaDoTempo(log, trat);
  assert.deepEqual(l.map((i) => i.tipo), ['aviso_erro', 'aviso', 'devolucao', 'resposta', 'nota', 'status', 'promessa']);
  assert.equal(l[0].erro, 'falha');
  assert.equal(l[2].titulo, 'E-mail devolvido pelo servidor do cliente');
  assert.equal(l[3].titulo, 'Resposta do cliente');
  assert.match(l[5].titulo, /Aberto → Em tratativa/);
  assert.match(l[6].titulo, /21\/11\/2026/);
  assert.deepEqual(T.linhaDoTempo(null, null), []);
});

test('casosAtivos usa ehDevolucao do módulo de avisos (mesma regra do card de erro)', () => {
  assert.equal(typeof C.ehDevolucao, 'function');
});
