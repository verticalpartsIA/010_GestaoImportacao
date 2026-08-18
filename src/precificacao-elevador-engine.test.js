'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./precificacao-elevador-engine.js');
const E = window.PrecificacaoElevadorEngine;

function closeTo(actual, expected, epsilon, msg) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${msg}: esperado ~${expected}, veio ${actual}`);
}

test('creditoElegivel — ICMS/IPI: todo regime aproveita crédito, exceto Simples', () => {
  assert.equal(E.creditoElegivel('Presumido', 'icms'), true);
  assert.equal(E.creditoElegivel('Real', 'icms'), true);
  assert.equal(E.creditoElegivel('Simples', 'icms'), false);
  assert.equal(E.creditoElegivel('Simples', 'ipi'), false);
});

test('creditoElegivel — PIS/COFINS: só Lucro Real aproveita crédito (não-cumulativo)', () => {
  assert.equal(E.creditoElegivel('Real', 'pis'), true);
  assert.equal(E.creditoElegivel('Real', 'cofins'), true);
  assert.equal(E.creditoElegivel('Presumido', 'pis'), false);
  assert.equal(E.creditoElegivel('Simples', 'cofins'), false);
});

test('calcular — entradas todas zeradas não quebra nem gera NaN', () => {
  const out = E.calcular({ parametros: {} });
  assert.equal(out.precificacao.precoVendaProposta, 0);
  assert.ok(!Number.isNaN(out.precificacao.margemFinalPct));
  assert.ok(!Number.isNaN(out.importacao.custoTotalMercadorias));
});

/* Caso de referência (regime Presumido, só ICMS-importação de 18% e
   markup de 20% não-zerados, sem comissões/serviços/DIFAL) — números
   calculados à mão a partir das mesmas fórmulas da planilha
   Modelo_Pricing_Elevador.xlsx, servem de regressão contra mudança
   silenciosa na cascata de impostos. */
const inputsBase = {
  vmleUsd: 1000, seguroUsd: 0, freteSeguroCapataziaUsd: 0, siscomexRs: 0,
  txCambial: 5, outrasDespesasImportacaoRs: 0,
  despachanteDesembaracoRs: 0, demurrageRs: 0, freteInternoRs: 0, armazenagemRs: 0,
  itensInstalacaoMontagem: [],
  quantidadeEquipamentos: 1, percentualServicos: 0,
  modelos: [],
  markUpPct: 0.2,
  parametros: {
    regimeTributario: 'Presumido',
    icmsImportacaoPct: 0.18, ipiImportacaoPct: 0, pisImportacaoPct: 0, cofinsImportacaoPct: 0, iiImportacaoPct: 0,
    icmsVendaPct: 0, ipiVendaPct: 0, pisVendaPct: 0, cofinsVendaPct: 0, irpjVendaPct: 0, csllVendaPct: 0, irpjAdicionalPct: 0,
    impostosPagarServicosPct: 0, comissaoConsultoriaPct: 0, comissaoVendedorPct: 0, comissaoIndicacaoPct: 0,
  },
};

test('calcular — VMLE em R$ é VMLE(USD) × câmbio', () => {
  const out = E.calcular(inputsBase);
  closeTo(out.importacao.vmleRs, 5000, 0.01, 'vmleRs');
});

test('calcular — crédito de ICMS (regime Presumido) cancela o próprio ICMS pago na importação', () => {
  const out = E.calcular(inputsBase);
  // Base Única, ICMS "por dentro": bcICMS = 5000 / (1 - 0.18)
  closeTo(out.importacao.icms, 5000 / (1 - 0.18) * 0.18, 0.01, 'icms');
  closeTo(out.importacao.custoTotalMercadorias, 5000, 0.01, 'custoTotalMercadorias — crédito de ICMS cancela o próprio ICMS');
});

test('calcular — preço de venda reflete custo + markup (sem impostos de venda)', () => {
  const out = E.calcular(inputsBase);
  // precoVendaPct = 1 - markUpPct = 0.8 -> precoVenda = custoTotalMercadorias / 0.8
  closeTo(out.precificacao.precoVendaProposta, 5000 / 0.8, 0.01, 'precoVendaProposta');
});

test('calcular — lucro final positivo quando markup cobre os custos', () => {
  const out = E.calcular(inputsBase);
  assert.ok(out.precificacao.lucroFinal > 0, 'lucroFinal deveria ser positivo com markup de 20%');
  assert.ok(out.precificacao.margemFinalPct > 0 && out.precificacao.margemFinalPct < 1, 'margem deveria estar entre 0 e 100%');
});

test('calcular — regressão: subir o markup aumenta o preço de venda e a margem final', () => {
  const baixo = E.calcular({ ...inputsBase, markUpPct: 0.1 });
  const alto = E.calcular({ ...inputsBase, markUpPct: 0.3 });
  assert.ok(alto.precificacao.precoVendaProposta > baixo.precificacao.precoVendaProposta, 'markup maior deveria gerar preço de venda maior');
  assert.ok(alto.precificacao.margemFinalPct > baixo.precificacao.margemFinalPct, 'markup maior deveria gerar margem final maior');
});

test('calcular — comissão de consultoria/vendedor/indicação saem do lucro, não do preço de venda', () => {
  const semComissao = E.calcular(inputsBase);
  const comComissao = E.calcular({
    ...inputsBase,
    parametros: { ...inputsBase.parametros, comissaoConsultoriaPct: 0.05, comissaoVendedorPct: 0.03, comissaoIndicacaoPct: 0.02 },
  });
  // precoVendaProposta não depende das comissões nas fórmulas do motor
  closeTo(comComissao.precificacao.precoVendaProposta, semComissao.precificacao.precoVendaProposta, 0.01, 'precoVendaProposta não muda com comissão');
  assert.ok(comComissao.precificacao.lucroFinal < semComissao.precificacao.lucroFinal, 'lucro final deveria cair quando há comissão a pagar');
});

test('calcular — regime Simples não aproveita crédito de ICMS, custo da mercadoria fica maior', () => {
  const presumido = E.calcular(inputsBase);
  const simples = E.calcular({ ...inputsBase, parametros: { ...inputsBase.parametros, regimeTributario: 'Simples' } });
  assert.ok(simples.importacao.custoTotalMercadorias > presumido.importacao.custoTotalMercadorias, 'sem crédito de ICMS, o custo total da mercadoria deveria ser maior no Simples');
});

test('calcular — rateio por modelo soma 100% do preço de venda proposto', () => {
  const out = E.calcular({
    ...inputsBase,
    modelos: [
      { unidadeId: 'E1', identificador: 'E1', modelo: 'A', quantidade: 1, valorUnitarioUsd: 600 },
      { unidadeId: 'E2', identificador: 'E2', modelo: 'B', quantidade: 1, valorUnitarioUsd: 400 },
    ],
  });
  const somaValorTotalRs = out.modelos.reduce((s, m) => s + m.valorTotalRs, 0);
  closeTo(somaValorTotalRs, out.precificacao.precoVendaProposta, 0.01, 'soma do rateio deveria bater com o preço de venda total');
  closeTo(out.modelos[0].percentual, 0.6, 0.001, 'E1 é 60% do valor USD total (600/1000)');
});
