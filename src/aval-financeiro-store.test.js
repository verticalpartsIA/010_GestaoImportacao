'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./aval-financeiro-store.js');
require('./gatilhos-engine.js');

/* Fake encadeável: qualquer método devolve o próprio objeto; maybeSingle()
   resolve a linha da "tabela". */
function fakeSb(tabelas) {
  return {
    from(nome) {
      const q = { select: () => q, eq: () => q, order: () => q, limit: () => q,
        maybeSingle: async () => ({ data: tabelas[nome] ?? null, error: null }) };
      return q;
    },
  };
}
const av = { id: 'a1', contrato_venda_id: 'CVE-9', aprovacao_ceo_em: 'x', aprovacao_owner_em: 'x', sinal_pago: true, aval_pagamento_confirmado: true };

test('podeEnviarContrato — não bloqueia mais pelo aval de score', async () => {
  window.__VP_SB = { sb: fakeSb({ avais_financeiros: { status: 'pendente_consulta' } }) };
  assert.deepEqual(await window.AvalFinanceiroStore.podeEnviarContrato('p1'), { ok: true });
});

test('podeIniciarCompra — exige o Aval Jurídico além do Aval de Pagamento', async () => {
  const base = { avais_financeiros: av, contratos_venda_equipamentos: { status: 'assinado' }, projetos_elevador: { status: 'finalizado' } };
  window.__VP_SB = { sb: fakeSb({ ...base, avais_juridicos: { status: 'pendente' } }) };
  const r1 = await window.AvalFinanceiroStore.podeIniciarCompra(955);
  assert.equal(r1.ok, false);
  assert.match(r1.motivo, /Aval Jurídico/);

  window.__VP_SB = { sb: fakeSb({ ...base, avais_juridicos: { status: 'aprovado' } }) };
  assert.deepEqual(await window.AvalFinanceiroStore.podeIniciarCompra(955), { ok: true });
});

test('gatilhos — COMPRA_LIBERADA só nasce com Aval de Pagamento E Aval Jurídico', () => {
  const nodes = window.GatilhosEngine.NODES;
  const compra = nodes.find((n) => n.key === 'COMPRA_LIBERADA');
  assert.deepEqual(compra.requerEventos, ['AVAL_PAGAMENTO_CONFIRMADO', 'AVAL_JURIDICO_APROVADO']);
  const aj = nodes.find((n) => n.key === 'AVAL_JURIDICO');
  assert.equal(aj.fechamentoTipo, 'manual');
  assert.equal(aj.fecha, 'AVAL_JURIDICO_APROVADO');
});
