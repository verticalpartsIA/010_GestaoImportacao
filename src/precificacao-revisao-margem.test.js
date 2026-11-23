'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./precificacao-elevador-engine.js');
require('./precificacao-revisao-margem.js');
const E = window.PrecificacaoElevadorEngine;
const M = window.PrecificacaoRevisaoMargem;

const closeTo = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg}: esperado ~${b}, veio ${a}`);

/* Mesmos insumos do "golden 963" do motor (insumos da planilha do Financeiro). */
const BASE = {
  vmleUsd: 351100, seguroUsd: 0, freteSeguroCapataziaUsd: 96589.79, siscomexRs: 214.5, txCambial: 5.5, outrasDespesasImportacaoRs: 0,
  despachanteDesembaracoRs: 2702.7, demurrageRs: 0, freteInternoRs: 279400, armazenagemRs: 15910.8,
  itensInstalacaoMontagem: [{ descricao: 'Instalação e montagem', valor: 669831 }],
  containers: [], containerRateioDivisor: 1, itensDespesasExtras: [],
  quantidadeEquipamentos: 27, percentualServicos: 0, modelos: [],
  markUpPct: 0.53, comissaoConsultoriaPct: 0, comissaoVendedorPct: 0.01, comissaoIndicacaoPct: 0.01,
  parametros: {
    regimeTributario: 'Presumido', icmsImportacaoPct: 0.12, ipiImportacaoPct: 0, pisImportacaoPct: 0.021, cofinsImportacaoPct: 0.1025, iiImportacaoPct: 0.2,
    icmsVendaPct: 0.04, ipiVendaPct: 0, pisVendaPct: 0.0065, cofinsVendaPct: 0.03, irpjVendaPct: 0.0132, csllVendaPct: 0.01188, irpjAdicionalPct: 0, impostosPagarServicosPct: 0.16,
  },
};
const EXTRAS = { modoFormacaoPreco: 'planilha', margemDesejadaPct: 0.2 };
const calcula = (difalCustoRs) => E.calcularV2({ ...BASE, difalCustoRs, ...EXTRAS });

test('previaMargem — o total pedido vira o preço e a margem é a efetiva do motor oficial (sem DIFAL)', () => {
  const res = calcula(0);
  const alvo = res.precificacao.precoVendaProposta * 1.05;
  const p = M.previaMargem({ E, baseInputs: BASE, extras: EXTRAS, res, alvo, difalAtualRs: 0 });
  closeTo(p.precoRs, alvo, 0.05, 'o preço da prévia fecha no total pedido');
  assert.ok(p.markUpPct > BASE.markUpPct, 'pedir mais exige mark-up maior');
  assert.ok(p.margemPct > res.precificacao.margemEfetivaPct, 'e a margem sobe');
  // é exatamente o que o motor devolve com esse mark-up
  const direto = E.calcularV2({ ...BASE, difalCustoRs: 0, ...EXTRAS, markUpPct: p.markUpPct });
  closeTo(p.margemPct, direto.precificacao.margemEfetivaPct, 1e-12, 'mesma margem do motor');
  closeTo(p.lucroRs, direto.precificacao.lucroFinal, 1e-6, 'mesmo lucro do motor');
});

test('previaMargem — pedido que reduz o preço reduz a margem (não existe "margem mínima": 13/11/2026)', () => {
  const res = calcula(0);
  const base = res.precificacao.precoVendaProposta;
  const p = M.previaMargem({ E, baseInputs: BASE, extras: EXTRAS, res, alvo: base * 0.93, difalAtualRs: 0 });
  assert.ok(p.margemPct < res.precificacao.margemEfetivaPct, 'preço menor, margem menor');
  assert.equal(p.abaixoDaMinima, undefined, 'a prévia não carrega mais o sinal de "abaixo da mínima"');
});

test('previaMargem — o DIFAL da VerticalParts acompanha o preço e reduz a margem', () => {
  const comDifalAtual = 1433824.4;
  const res = calcula(comDifalAtual);
  const alvo = res.precificacao.precoVendaProposta * 1.05;
  const semDifal = M.previaMargem({ E, baseInputs: BASE, extras: EXTRAS, res: calcula(0), alvo, difalAtualRs: 0 });
  const comDifal = M.previaMargem({ E, baseInputs: BASE, extras: EXTRAS, res, alvo, difalAtualRs: comDifalAtual });
  assert.ok(comDifal.margemPct < semDifal.margemPct, 'com DIFAL a margem é menor');
  closeTo(comDifal.precoRs, alvo, 0.05, 'e o preço ainda fecha no total pedido');
  // o custo do DIFAL cresce com o preço (razão custo/equipamento constante): lucro cai mais do que sem acompanhar
  const congelado = E.calcularV2({ ...BASE, difalCustoRs: comDifalAtual, ...EXTRAS, markUpPct: comDifal.markUpPct });
  assert.ok(comDifal.lucroRs < congelado.precificacao.lucroFinal, 'DIFAL maior no preço maior => lucro menor que com o DIFAL congelado');
});

test('previaMargem — sem alavanca válida (total abaixo do custo) ou sem dados, devolve null', () => {
  const res = calcula(0);
  assert.equal(M.previaMargem({ E, baseInputs: BASE, extras: EXTRAS, res, alvo: 1000, difalAtualRs: 0 }), null);
  assert.equal(M.previaMargem({ E, baseInputs: BASE, extras: EXTRAS, res: null, alvo: 5e6, difalAtualRs: 0 }), null);
  assert.equal(M.previaMargem({ E: null, baseInputs: BASE, extras: EXTRAS, res, alvo: 5e6, difalAtualRs: 0 }), null);
});
