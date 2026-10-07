'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./aval-financeiro-store.js');
require('./gatilhos-engine.js');
require('./aval-engenharia-store.js');

/* 08/10: o terceiro aval (assinatura do Projeto de Instalação) é lido por AvalEngenhariaStore.status — aqui um dublê. */
function engenharia(estado, assinados = 1, total = 1) { window.AvalEngenhariaStore.status = async () => ({ estado, assinados, total, itens: [] }); }
engenharia('ok');

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

  // sem aprovação do CEO/responsável e sem contrato — com o projeto assinado, libera
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

test('gatilhos — COMPRA_LIBERADA só nasce com os 3 avais (Pagamento, Jurídico e Projeto assinado)', () => {
  const nodes = window.GatilhosEngine.NODES;
  const compra = nodes.find((n) => n.key === 'COMPRA_LIBERADA');
  assert.deepEqual(compra.requerEventos, ['AVAL_PAGAMENTO_CONFIRMADO', 'AVAL_JURIDICO_APROVADO', 'PROJETO_INSTALACAO_ASSINADO']);
  const ae = nodes.find((n) => n.key === 'AVAL_ENGENHARIA');
  assert.equal(ae.fecha, 'PROJETO_INSTALACAO_ASSINADO');
  assert.equal(ae.nasce, 'CLIENTE_RESPONDEU_PROPOSTA');
  assert.equal(ae.condicaoNasce({ resposta: 'aprovada' }), true);
  assert.equal(ae.condicaoNasce({ resposta: 'recusada' }), false);
  assert.ok(compra.predecessores.some((p) => p.key === 'AVAL_ENGENHARIA'));
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

/* 08/10: terceiro aval — assinatura do Projeto de Instalação, por cotação. */
test('podeIniciarCompra — sem o Projeto de Instalação assinado a compra não é liberada', async () => {
  window.DecisoesStore = { precisaAprovacaoCeo: async () => ({ precisa: false, margem: 0.259 }) };
  window.__VP_SB = { sb: fakeSb({ avais_financeiros: av, avais_juridicos: { status: 'aprovado' } }) };
  engenharia('aguardando', 1, 2);
  let r = await window.AvalFinanceiroStore.podeIniciarCompra(955);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /assinatura do Projeto de Instalação/);
  assert.match(r.motivo, /1 de 2/);
  engenharia('sem_projeto', 0, 0);
  r = await window.AvalFinanceiroStore.podeIniciarCompra(955);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /ainda não foi salvo/);
  engenharia('recusado', 0, 1);
  assert.match((await window.AvalFinanceiroStore.podeIniciarCompra(955)).motivo, /recusou/);
  engenharia('erro', 0, 0);
  assert.equal((await window.AvalFinanceiroStore.podeIniciarCompra(955)).ok, false);
  engenharia('ok');
  assert.deepEqual(await window.AvalFinanceiroStore.podeIniciarCompra(955), { ok: true });
});

test('AvalEngenhariaStore.resumir — a cotação só fica OK com TODOS os Projetos de Instalação assinados; ID-TAG não conta', () => {
  const S = window.AvalEngenhariaStore;
  const d = [
    { id: 'p1', numero_cotacao: '955', tipo_documento: 'projeto_instalacao', referencia: 'Loja' },
    { id: 'p2', numero_cotacao: '955', tipo_documento: 'projeto_instalacao', referencia: 'Loja 2' },
    { id: 't1', numero_cotacao: '955', tipo_documento: 'id_tag' },
    { id: 'p3', numero_cotacao: '960', tipo_documento: null, referencia: 'Outra' },
  ];
  let r = S.resumir(d, [{ documento_id: 'p1', status: 'assinado' }, { documento_id: 'p2', status: 'visualizado' }]);
  assert.equal(r['955'].total, 2);
  assert.equal(r['955'].assinados, 1);
  assert.equal(r['955'].estado, 'aguardando');
  assert.equal(r['960'].itens[0].estado, 'sem_link'); // projeto salvo mas sem link de assinatura
  assert.equal(r['960'].estado, 'aguardando');
  r = S.resumir(d, [{ documento_id: 'p1', status: 'assinado' }, { documento_id: 'p2', status: 'assinado' }]);
  assert.equal(r['955'].estado, 'ok');
  r = S.resumir(d, [{ documento_id: 'p1', status: 'assinado' }, { documento_id: 'p2', status: 'recusado' }]);
  assert.equal(r['955'].estado, 'recusado');
  // link recusado e novo link criado: vale o novo (pendente), não o recusado
  r = S.resumir(d, [{ documento_id: 'p1', status: 'assinado' }, { documento_id: 'p2', status: 'recusado' }, { documento_id: 'p2', status: 'enviado' }]);
  assert.equal(r['955'].estado, 'aguardando');
});
