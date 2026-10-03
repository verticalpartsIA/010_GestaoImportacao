'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./pcp-pedido-sla.js');
const S = window.PcpPedidoSLA;

test('dias úteis pulam fim de semana', () => {
  assert.equal(S.somarDiasUteis('2026-10-02', 1), '2026-10-05'); // sexta → segunda
  assert.equal(S.somarDiasUteis('2026-10-05', 1), '2026-10-06');
  assert.equal(S.somarDiasUteis('2026-10-03', 1), '2026-10-05'); // sábado → segunda
});

test('histórico não tem SLA', () => {
  const r = S.calcular({ historico: true, entrada_em: '2026-01-01' }, '2026-10-03');
  assert.equal(r.historico, true);
  assert.equal(r.etapas, null);
  assert.equal(r.atrasado, false);
});

test('OP não criada depois de 1 dia útil = atrasada', () => {
  const r = S.calcular({ entrada_em: '2026-10-01T10:00:00Z' }, '2026-10-05');
  assert.equal(r.etapas.op.estado, 'atrasada');
  assert.equal(r.atrasado, true);
});

test('fluxo no prazo e fora do prazo', () => {
  const r = S.calcular({
    entrada_em: '2026-10-01', opCriadaEm: '2026-10-02T09:00:00Z',
    producaoPrazo: '2026-10-09', producaoFeita: '2026-10-08',
    nfEm: '2026-10-12', // 8/10 + 1 útil = 9/10 → NF em 12/10 saiu fora do prazo
  }, '2026-10-13');
  assert.equal(r.etapas.op.estado, 'ok');
  assert.equal(r.etapas.producao.estado, 'ok');
  assert.equal(r.etapas.nf.estado, 'ok_atraso');
  assert.equal(r.etapas.despacho.estado, 'andamento'); // limite 13/10, hoje 13/10
  assert.equal(S.calcular({ entrada_em: '2026-10-01', opCriadaEm: '2026-10-02', producaoPrazo: '2026-10-09', producaoFeita: '2026-10-08', nfEm: '2026-10-12' }, '2026-10-14').etapas.despacho.estado, 'atrasada');
});
