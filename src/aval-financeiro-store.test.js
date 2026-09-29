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
const av = { id: 'a1', proposta_id: 'p1', contrato_venda_id: 'CVE-9', aval_pagamento_confirmado: true };

test('podeEnviarContrato — não bloqueia mais pelo aval de score', async () => {
  window.__VP_SB = { sb: fakeSb({ avais_financeiros: { status: 'pendente_consulta' } }) };
  assert.deepEqual(await window.AvalFinanceiroStore.podeEnviarContrato('p1'), { ok: true });
});

/* 29/09 (2ª rodada): compra na China = Aval de Pagamento + Aval Jurídico;
   CEO só com margem < 15%. Responsável, contrato assinado e Engenharia
   deixaram de travar. */
test('podeIniciarCompra — só os dois avais quando a margem está dentro da regra', async () => {
  window.DecisoesStore = { precisaAprovacaoCeo: async () => ({ precisa: false, margem: 0.259 }) };
  window.__VP_SB = { sb: fakeSb({ avais_financeiros: { ...av, aval_pagamento_confirmado: false }, avais_juridicos: { status: 'aprovado' } }) };
  const r1 = await window.AvalFinanceiroStore.podeIniciarCompra(955);
  assert.equal(r1.ok, false);
  assert.match(r1.motivo, /Aval de Pagamento/);

  window.__VP_SB = { sb: fakeSb({ avais_financeiros: av, avais_juridicos: { status: 'pendente' } }) };
  const r2 = await window.AvalFinanceiroStore.podeIniciarCompra(955);
  assert.equal(r2.ok, false);
  assert.match(r2.motivo, /Aval Jurídico/);

  // sem aprovação do CEO/responsável, sem contrato, sem projeto — libera
  window.__VP_SB = { sb: fakeSb({ avais_financeiros: av, avais_juridicos: { status: 'aprovado' } }) };
  assert.deepEqual(await window.AvalFinanceiroStore.podeIniciarCompra(955), { ok: true });
});

test('podeIniciarCompra — margem abaixo de 15% exige o CEO', async () => {
  window.DecisoesStore = { precisaAprovacaoCeo: async () => ({ precisa: true, margem: 0.12 }) };
  window.__VP_SB = { sb: fakeSb({ avais_financeiros: av, avais_juridicos: { status: 'aprovado' } }) };
  const r = await window.AvalFinanceiroStore.podeIniciarCompra(955);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /CEO/);
  assert.match(r.motivo, /12,0%/);

  window.__VP_SB = { sb: fakeSb({ avais_financeiros: { ...av, aprovacao_ceo_em: 'x' }, avais_juridicos: { status: 'aprovado' } }) };
  assert.deepEqual(await window.AvalFinanceiroStore.podeIniciarCompra(955), { ok: true });
});

test('podeIniciarCompra — sem DecisoesStore mantém o CEO por segurança', async () => {
  delete window.DecisoesStore;
  window.__VP_SB = { sb: fakeSb({ avais_financeiros: av, avais_juridicos: { status: 'aprovado' } }) };
  const r = await window.AvalFinanceiroStore.podeIniciarCompra(955);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /CEO/);
});

test('gatilhos — COMPRA_LIBERADA só nasce com Aval de Pagamento E Aval Jurídico', () => {
  const nodes = window.GatilhosEngine.NODES;
  const compra = nodes.find((n) => n.key === 'COMPRA_LIBERADA');
  assert.deepEqual(compra.requerEventos, ['AVAL_PAGAMENTO_CONFIRMADO', 'AVAL_JURIDICO_APROVADO']);
  const aj = nodes.find((n) => n.key === 'AVAL_JURIDICO');
  assert.equal(aj.fechamentoTipo, 'manual');
  assert.equal(aj.fecha, 'AVAL_JURIDICO_APROVADO');
  // abre junto com o Aval Financeiro, quando o cliente aprova a Proposta
  assert.equal(aj.nasce, 'CLIENTE_RESPONDEU_PROPOSTA');
  assert.equal(aj.condicaoNasce({ resposta: 'aprovada' }), true);
  assert.equal(aj.condicaoNasce({ resposta: 'recusada' }), false);
});

test('gatilhos — SLA da Precificação é 2h; responsável não nasce mais; CEO condicionado à margem', async () => {
  const E = window.GatilhosEngine;
  assert.equal(E.SLA_HORAS.PRECIFICACAO, 2);
  assert.match(E.NODES.find((n) => n.key === 'PRECIFICACAO').label, /2h/);
  assert.equal(E.NODES.find((n) => n.key === 'OWNER_APROVOU').nasce, null);
  const ceo = E.NODES.find((n) => n.key === 'CEO_APROVOU');
  window.DecisoesStore = { precisaAprovacaoCeo: async () => ({ precisa: false, margem: 0.2 }) };
  assert.equal(await ceo.condicaoCotacao(955), false);
  window.DecisoesStore = { precisaAprovacaoCeo: async () => ({ precisa: true, margem: 0.1 }) };
  assert.equal(await ceo.condicaoCotacao(955), true);
});
