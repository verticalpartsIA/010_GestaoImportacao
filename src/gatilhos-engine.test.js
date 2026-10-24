'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./gatilhos-engine.js');
const E = () => window.GatilhosEngine;

test('somarHorasUteis — pula sábado e domingo', () => {
  // sexta 02/10/2026 12:00 + 48h úteis = terça 06/10 12:00 (sex 12h + seg 24h + ter 12h)
  assert.deepEqual(E().somarHorasUteis(new Date(2026, 9, 2, 12), 48), new Date(2026, 9, 6, 12));
  // dentro da semana, soma direto
  assert.deepEqual(E().somarHorasUteis(new Date(2026, 9, 6, 8), 2), new Date(2026, 9, 6, 10));
  // começando no sábado, conta a partir de segunda 00:00
  assert.deepEqual(E().somarHorasUteis(new Date(2026, 9, 3, 15), 24), new Date(2026, 9, 6, 0));
});

test('prazoEfetivo — usa o gravado; sem prazo usa o SLA atual; Proposta pronta e lembrete não têm prazo', () => {
  const gravado = '2026-10-01T10:00:00.000Z';
  assert.equal(E().prazoEfetivo({ evento_key: 'PRECIFICACAO', prazo_em: gravado, nascido_em: '2026-09-01T00:00:00Z' }).toISOString(), gravado);
  const sem = E().prazoEfetivo({ evento_key: 'PROPOSTA_PREP', nascido_em: new Date(2026, 9, 5, 9).toISOString() });
  assert.equal(sem, null);
  assert.equal(E().prazoEfetivo({ evento_key: 'FORMULARIO', nascido_em: '2026-09-01T00:00:00Z' }), null);
  assert.equal(E().prazoEfetivo({ evento_key: 'LEMBRETE__AGUARDA_CLIENTE', nascido_em: '2026-09-01T00:00:00Z' }), null);
});

test('emAtraso — só etapa aberta, não encerrada e com prazo vencido', () => {
  const velho = new Date(Date.now() - 30 * 86400000).toISOString();
  assert.equal(E().emAtraso({ evento_key: 'PRECIFICACAO', nascido_em: velho }), true);
  assert.equal(E().emAtraso({ evento_key: 'PROPOSTA_PREP', nascido_em: velho }), false);   // Q-11: sem SLA
  assert.equal(E().emAtraso({ evento_key: 'PROPOSTA_PREP', nascido_em: velho, concluido_em: velho }), false);
  assert.equal(E().emAtraso({ evento_key: 'PROPOSTA_PREP', nascido_em: velho, status: 'encerrado' }), false);
  assert.equal(E().emAtraso({ evento_key: 'FORMULARIO', nascido_em: velho }), false);   // sem SLA nunca atrasa
  assert.equal(E().emAtraso({ evento_key: 'PROPOSTA_PREP', nascido_em: new Date().toISOString() }), false);
});

test('ehRetroativo — marca do banco ou etapa de espera fechada em < 3s; etapa normal não', () => {
  assert.equal(E().ehRetroativo({ evento_key: 'AGUARDA_ASSINATURA', nascido_em: '2026-09-29T17:58:43.163Z', concluido_em: '2026-09-29T17:58:43.327Z' }), true);
  assert.equal(E().ehRetroativo({ evento_key: 'AGUARDA_ASSINATURA', conclusao_tipo: 'retroativo', nascido_em: '2026-09-01T00:00:00Z', concluido_em: '2026-09-09T00:00:00Z' }), true);
  assert.equal(E().ehRetroativo({ evento_key: 'AGUARDA_ASSINATURA', nascido_em: '2026-09-01T00:00:00Z', concluido_em: '2026-09-03T00:00:00Z' }), false);
  assert.equal(E().ehRetroativo({ evento_key: 'DOSSIE_CRIADO', nascido_em: '2026-09-29T17:58:43.538Z', concluido_em: '2026-09-29T17:58:43.732Z' }), false);  // sem SLA: não é "espera"
  assert.equal(E().ehRetroativo({ evento_key: 'PRECIFICACAO', nascido_em: '2026-09-01T00:00:00Z' }), false);                                            // ainda aberta
});

test('etapas opcionais — score e aval de venda não contam como pendência', () => {
  assert.equal(E().nodeByKey('FIN_SCORE').opcional, true);
  assert.equal(E().nodeByKey('FIN_AVAL_VENDA').opcional, true);
  assert.equal(E().nodeByKey('AVAL_PAGAMENTO').opcional, undefined);
});

/* issue #706 — handoff automático da compra liberada pra Gestão de
   Importação: nasce já em "compra liberada" (decidirComprar, evento
   COMPRA_FORNECEDOR_INICIADA), ANTES de confirmar com o fornecedor
   (aprovar, COMPRA_FORNECEDOR_CONFIRMADA) — decisão explícita do
   usuário. Fecha sozinho quando a P.I. real é registrada (PI_CRIADA,
   já emitido por pi-store.js) — sem inventar P.I. nenhuma. */
test('IMPORTACAO_A_INICIAR — nasce na compra liberada, fecha na P.I. real, predecessor é COMPRA_LIBERADA', () => {
  const node = E().nodeByKey('IMPORTACAO_A_INICIAR');
  assert.ok(node, 'nó IMPORTACAO_A_INICIAR não está no catálogo NODES');
  assert.equal(node.nasce, 'COMPRA_FORNECEDOR_INICIADA');
  assert.equal(node.fecha, 'PI_CRIADA');
  assert.equal(node.fechamentoTipo, 'automatico');
  assert.equal((node.predecessores[0] || {}).key, 'COMPRA_LIBERADA');
});

test('EMBARQUE_CHEGADA (SLA 90 dias) — fecha quando o embarque chega ao Brasil, não fica aberto para sempre', () => {
  const node = E().nodeByKey('EMBARQUE_CHEGADA');
  assert.equal(node.fecha, 'EMBARQUE_CHEGOU_BRASIL');
  assert.equal(node.fechamentoTipo, 'automatico');
});

/* ---- SLA em horário comercial (24/10/2026): 08:00–18:00 BRT (UTC-3), seg–sex, sem feriados ---- */
const z = (s) => new Date(s);  // instantes em UTC; BRT = UTC-3

test('somarHorasComerciais — dentro do expediente soma direto (seg 09:00 BRT + 4h = 13:00)', () => {
  assert.deepEqual(E().somarHorasComerciais(z('2026-10-26T12:00:00Z'), 4), z('2026-10-26T16:00:00Z'));
});

test('somarHorasComerciais — sexta 16:00 BRT + 4h = segunda 10:00 BRT', () => {
  assert.deepEqual(E().somarHorasComerciais(z('2026-10-23T19:00:00Z'), 4), z('2026-10-26T13:00:00Z'));
});

test('somarHorasComerciais — quinta 23:58 BRT (o aviso das 23:58) conta só a partir de sexta 08:00 = sexta 12:00', () => {
  assert.deepEqual(E().somarHorasComerciais(z('2026-10-23T02:58:00Z'), 4), z('2026-10-23T15:00:00Z'));
});

test('somarHorasComerciais — antes das 08:00 começa às 08:00; sábado e domingo começam na segunda', () => {
  assert.deepEqual(E().somarHorasComerciais(z('2026-10-26T09:00:00Z'), 4), z('2026-10-26T15:00:00Z'));   // seg 06:00 BRT
  assert.deepEqual(E().somarHorasComerciais(z('2026-10-24T13:00:00Z'), 4), z('2026-10-26T15:00:00Z'));   // sáb 10:00 BRT
});

test('somarHorasComerciais — feriado não conta: sexta 16:00 + 4h com segunda feriada = terça 10:00', () => {
  const f = new Set(['2026-10-26']);
  assert.deepEqual(E().somarHorasComerciais(z('2026-10-23T19:00:00Z'), 4, f), z('2026-10-27T13:00:00Z'));
});

test('somarHorasComerciais — exatamente 18:00 BRT já é fora do expediente (vai para o próximo dia 08:00)', () => {
  assert.deepEqual(E().somarHorasComerciais(z('2026-10-26T21:00:00Z'), 1), z('2026-10-27T12:00:00Z'));   // seg 18:00 BRT + 1h = ter 09:00 BRT
});

test('Precificação: SLA de 4h em horário comercial (prazo sem gravação usa o calendário)', () => {
  assert.equal(E().SLA_HORAS.PRECIFICACAO, 4);
  const p = E().prazoEfetivo({ evento_key: 'PRECIFICACAO', nascido_em: '2026-10-23T02:58:00Z' });
  assert.deepEqual(p, z('2026-10-23T15:00:00Z'));
});

test('definirFeriados — a etapa Precificação pula o feriado carregado; os demais SLAs não mudam de regra', () => {
  E().definirFeriados(new Set(['2026-10-26']));
  try {
    const p = E().prazoEfetivo({ evento_key: 'PRECIFICACAO', nascido_em: '2026-10-23T19:00:00Z' });   // sex 16:00 BRT
    assert.deepEqual(p, z('2026-10-27T13:00:00Z'));
    // fornecedor: só acompanhamento, nunca prazo (24/10)
    assert.equal(E().prazoEfetivo({ evento_key: 'SLA_FORNECEDOR', nascido_em: new Date(2026, 9, 2, 12).toISOString() }), null);
  } finally { E().definirFeriados(new Set()); }
});

test('Precificação aberta (iniciado_em) cumpre o prazo; fornecedor muito atrasado não gera atraso', () => {
  const velho = new Date(Date.now() - 400 * 86400000).toISOString();
  assert.equal(E().emAtraso({ evento_key: 'PRECIFICACAO', nascido_em: velho }), true);
  assert.equal(E().emAtraso({ evento_key: 'PRECIFICACAO', nascido_em: velho, iniciado_em: velho }), false);
  assert.equal(E().emAtraso({ evento_key: 'SLA_FORNECEDOR', nascido_em: velho }), false);
});
