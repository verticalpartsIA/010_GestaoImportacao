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

test('prazoEfetivo — usa o gravado; sem prazo usa o SLA atual (Proposta pronta = 24h); lembrete não tem prazo', () => {
  const gravado = '2026-10-01T10:00:00.000Z';
  assert.equal(E().prazoEfetivo({ evento_key: 'PRECIFICACAO', prazo_em: gravado, nascido_em: '2026-09-01T00:00:00Z' }).toISOString(), gravado);
  const sem = E().prazoEfetivo({ evento_key: 'PROPOSTA_PREP', nascido_em: new Date(2026, 9, 5, 9).toISOString() });
  assert.deepEqual(sem, new Date(2026, 9, 6, 9));
  assert.equal(E().prazoEfetivo({ evento_key: 'FORMULARIO', nascido_em: '2026-09-01T00:00:00Z' }), null);
  assert.equal(E().prazoEfetivo({ evento_key: 'LEMBRETE__AGUARDA_CLIENTE', nascido_em: '2026-09-01T00:00:00Z' }), null);
});

test('emAtraso — só etapa aberta, não encerrada e com prazo vencido', () => {
  const velho = new Date(Date.now() - 30 * 86400000).toISOString();
  assert.equal(E().emAtraso({ evento_key: 'PROPOSTA_PREP', nascido_em: velho }), true);
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
