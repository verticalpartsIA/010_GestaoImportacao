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

test('calcular — containers somam no mesmo bucket que Instalação e Montagem (reduz lucro, não muda preço de venda)', () => {
  const semContainers = E.calcular(inputsBase);
  const comContainers = E.calcular({
    ...inputsBase,
    containers: [{ tipo_tamanho: "40'HC", quantidade: 1, preco_rs: 500 }, { tipo_tamanho: "20'DV", quantidade: 1, preco_rs: 300 }],
  });
  closeTo(comContainers.importacao.containersRs, 800, 0.01, 'containersRs deveria ser 1×500 + 1×300');
  closeTo(comContainers.importacao.despesasExtrasTotal - semContainers.importacao.despesasExtrasTotal, 800, 0.01, 'containers deveriam entrar no total de despesas extras/operacionais');
  // 01/10/2026: container entra na base do AFRMM (8% sobre container + capatazia) — única parte
  // que chega ao custo da mercadoria; o valor do container em si continua despesa operacional.
  closeTo(comContainers.importacao.afrmm - semContainers.importacao.afrmm, 64, 0.01, 'AFRMM deveria somar 8% × (500 + 300)');
  assert.ok(comContainers.precificacao.precoVendaProposta > semContainers.precificacao.precoVendaProposta, 'só o AFRMM do container sobe o preço de venda');
  // No V1 o preço sobe um pouco (AFRMM), compensando parte dos 800 de container no lucro.
  const quedaLucro = semContainers.precificacao.lucroFinal - comContainers.precificacao.lucroFinal;
  assert.ok(quedaLucro > 0 && quedaLucro < 800, `lucro final deveria cair, mas menos que os 800 dos containers (o preço sobe pelo AFRMM): caiu ${quedaLucro}`);
});

test('calcular — capatazia soma como despesa operacional e entra na base do AFRMM', () => {
  const sem = E.calcular(inputsBase);
  const com = E.calcular({ ...inputsBase, containers: [{ tipo_tamanho: "40'HC", quantidade: 1, preco_rs: 1000, capatazia_rs: 250 }] });
  closeTo(com.importacao.capataziaRs, 250, 0.01, 'capataziaRs deveria ser 1×250');
  closeTo(com.importacao.despesasExtrasTotal - sem.importacao.despesasExtrasTotal, 1250, 0.01, 'container + capatazia entram nas despesas operacionais');
  closeTo(com.importacao.afrmm - sem.importacao.afrmm, 100, 0.01, 'AFRMM = 8% × (1000 + 250)');
});

test('calcular — containerRateioDivisor divide container e capatazia (card 120d compartilhado)', () => {
  const containers = [{ tipo_tamanho: "40'HC", quantidade: 1, preco_rs: 1000, capatazia_rs: 200 }];
  const inteiro = E.calcular({ ...inputsBase, containers });
  const metade = E.calcular({ ...inputsBase, containers, containerRateioDivisor: 2 });
  closeTo(metade.importacao.containersRs, inteiro.importacao.containersRs / 2, 0.01, 'container dividido por 2');
  closeTo(metade.importacao.capataziaRs, inteiro.importacao.capataziaRs / 2, 0.01, 'capatazia dividida por 2');
  closeTo(metade.importacao.afrmm - E.calcular(inputsBase).importacao.afrmm, 48, 0.01, 'AFRMM acompanha o valor dividido: 8% × (500 + 100)');
  const invalido = E.calcular({ ...inputsBase, containers, containerRateioDivisor: 0 });
  closeTo(invalido.importacao.containersRs, 1000, 0.01, 'divisor inválido (0) vale como 1');
});

test('calcular — itens avulsos de "Despesas Extras" somam no mesmo bucket que Instalação e Montagem/Containers', () => {
  const sem = E.calcular(inputsBase);
  const com = E.calcular({
    ...inputsBase,
    itensDespesasExtras: [{ descricao: 'Taxa bancária', valor: 120 }, { descricao: 'Seguro adicional', valor: 80 }],
  });
  closeTo(com.importacao.itensDespesasExtrasRs, 200, 0.01, 'itensDespesasExtrasRs deveria ser 120 + 80');
  closeTo(com.importacao.despesasExtrasTotal - sem.importacao.despesasExtrasTotal, 200, 0.01, 'itens avulsos deveriam entrar no total de despesas extras/operacionais');
  closeTo(sem.precificacao.lucroFinal - com.precificacao.lucroFinal, 200, 0.01, 'lucro final deveria cair exatamente o valor dos itens avulsos');
});

/* ============================================================
   V2 — bug replicado + correção (issue "Precificação real")
   ============================================================ */

test('BUG V1 — markup positivo pode conviver com margem/lucro negativo quando a instalação é cara', () => {
  // custoTotalMercadorias = 5000; markup 20% -> precoVenda = 6250, e o
  // crédito de ICMS da compra (~1097,56) ainda soma ao lucro (S46). Uma
  // instalação de 5000 (bem maior que 6250-5000+1097,56 = 2342,56) já
  // vira lucro negativo: o V1 subtrai a instalação do lucro DEPOIS de
  // formado o preço, sem ela ter entrado na base.
  const out = E.calcular({
    ...inputsBase,
    itensInstalacaoMontagem: [{ descricao: 'Instalação', valor: 5000 }],
  });
  closeTo(out.precificacao.precoVendaProposta, 6250, 0.01, 'precoVendaProposta não deveria mudar com a instalação (é o bug)');
  assert.ok(out.precificacao.lucroFinal < 0, 'BUG: lucro final negativo mesmo com markup de 20% positivo');
  assert.ok(out.precificacao.margemFinalPct < 0, 'BUG: margem final negativa mesmo com markup de 20% positivo');
});

test('V2 margem_sobre_venda — mesmo cenário do bug agora forma preço cobrindo a instalação, margem bate com a desejada', () => {
  const out = E.calcularV2({
    ...inputsBase,
    itensInstalacaoMontagem: [{ descricao: 'Instalação', valor: 2000 }],
    modoFormacaoPreco: 'margem_sobre_venda',
    margemDesejadaPct: 0.2,
  });
  // 5000 (mercadoria) + 2000 (instalação) + 5 (ad-valorem = VMLD*0,1%)
  closeTo(out.custoEconomicoCompleto, 7005, 0.01, 'custoEconomicoCompleto = 5000 (mercadoria) + 2000 (instalação) + 5 (ad-valorem)');
  // precoVenda = 7005 / (1 - 0.2) = 8756.25
  closeTo(out.precificacao.precoVendaProposta, 8756.25, 0.01, 'preço de venda deveria cobrir custo completo + margem desejada');
  closeTo(out.precificacao.margemEfetivaPct, 0.2, 0.001, 'margem efetiva deveria bater com a margem desejada (sem impostos/comissões no cenário)');
  assert.ok(out.precificacao.lucroFinal > 0, 'lucro final deveria ser positivo — instalação já está na base do preço');
});

test('V2 markup_sobre_custo — preço cobre custo completo × (1+markup), diferente do modo margem', () => {
  const inputsComInstalacao = { ...inputsBase, itensInstalacaoMontagem: [{ descricao: 'Instalação', valor: 2000 }] };
  const markup = E.calcularV2({ ...inputsComInstalacao, modoFormacaoPreco: 'markup_sobre_custo', markUpPct: 0.2 });
  const margem = E.calcularV2({ ...inputsComInstalacao, modoFormacaoPreco: 'margem_sobre_venda', margemDesejadaPct: 0.2 });
  // custoEconomicoCompleto = 7005 (5000 mercadoria + 2000 instalação + 5 ad-valorem)
  // markup: 7005 * 1.2 = 8406 | margem: 7005 / 0.8 = 8756.25 — resultados diferentes por desenho
  closeTo(markup.precificacao.precoVendaProposta, 8406, 0.01, 'modo markup: custo completo * (1+markup)');
  assert.notStrictEqual(markup.precificacao.precoVendaProposta, margem.precificacao.precoVendaProposta, 'markup e margem devem produzir preços diferentes pro mesmo percentual');
});

test('V2 — divisor inválido (margem >= 100%) não gera preço, sinaliza divisorValido=false', () => {
  const out = E.calcularV2({ ...inputsBase, modoFormacaoPreco: 'margem_sobre_venda', margemDesejadaPct: 1 });
  assert.equal(out.divisorValido, false, 'margem desejada de 100% deveria invalidar o divisor');
  assert.equal(out.precificacao.precoVendaProposta, 0, 'sem divisor válido, não deveria devolver preço calculado');
});

test('V2 — custo econômico completo soma containers e itens avulsos, não só instalação', () => {
  const out = E.calcularV2({
    ...inputsBase,
    itensInstalacaoMontagem: [{ descricao: 'Instalação', valor: 1000 }],
    containers: [{ tipo_tamanho: "40'HC", quantidade: 1, preco_rs: 500 }],
    itensDespesasExtras: [{ descricao: 'Taxa', valor: 300 }],
    modoFormacaoPreco: 'margem_sobre_venda', margemDesejadaPct: 0.2,
  });
  // 5000 (mercadoria) + 1000 (instalação) + 500 (containers) + 300 (itens avulsos) + 5 (ad-valorem)
  // + 40 (AFRMM = 8% × 500 de container, desde 01/10/2026)
  closeTo(out.custoEconomicoCompleto, 6845, 0.01, 'custoEconomicoCompleto = 5000 + 1000 + 500 + 300 + 5 (ad-valorem) + 40 (AFRMM do container)');
});

test('V2 — contingência e outros custos não recuperáveis entram na base do preço', () => {
  const out = E.calcularV2({
    ...inputsBase,
    contingenciaValor: 500,
    outrosCustosNaoRecuperaveisRs: 250,
    modoFormacaoPreco: 'margem_sobre_venda', margemDesejadaPct: 0.2,
  });
  // 5000 (mercadoria) + 5 (ad-valorem) + 500 (contingência) + 250 (outros custos)
  closeTo(out.custoEconomicoCompleto, 5755, 0.01, 'custoEconomicoCompleto = 5000 + 5 (ad-valorem) + 500 + 250');
});

test('V2 — comissões e impostos de venda entram no divisor (percentuaisSobreVenda), não são contados 2x', () => {
  const out = E.calcularV2({
    ...inputsBase,
    parametros: { ...inputsBase.parametros, icmsVendaPct: 0.1, comissaoVendedorPct: 0.05 },
    modoFormacaoPreco: 'margem_sobre_venda', margemDesejadaPct: 0.2,
  });
  closeTo(out.precificacao.percentuaisSobreVenda, 0.15, 0.001, 'percentuaisSobreVenda = icmsVenda(10%) + comissaoVendedor(5%)');
  // custoEconomicoCompleto = 5000 + 5 (ad-valorem) = 5005; divisor = 1 - 0.2 - 0.15 = 0.65 -> preco = 5005/0.65
  closeTo(out.precificacao.precoVendaProposta, 5005 / 0.65, 0.01, 'preço deveria usar o divisor completo (margem + percentuais de venda)');
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

test('calcular — GRI soma como despesa operacional, entra na base do AFRMM e acompanha o rateio', () => {
  const sem = E.calcular(inputsBase);
  const containers = [{ tipo_tamanho: "40'HC", quantidade: 1, preco_rs: 1000, capatazia_rs: 250, gri_rs: 150 }];
  const com = E.calcular({ ...inputsBase, containers });
  closeTo(com.importacao.griRs, 150, 0.01, 'griRs deveria ser 1×150');
  closeTo(com.importacao.despesasExtrasTotal - sem.importacao.despesasExtrasTotal, 1400, 0.01, 'container + capatazia + GRI entram nas despesas operacionais');
  closeTo(com.importacao.afrmm - sem.importacao.afrmm, 112, 0.01, 'AFRMM = 8% × (1000 + 250 + 150)');
  const metade = E.calcular({ ...inputsBase, containers, containerRateioDivisor: 2 });
  closeTo(metade.importacao.griRs, 75, 0.01, 'GRI dividida pelo rateio (card 120d compartilhado)');
});

test('ratearPorModelo — equipamento mais caro no fornecedor sai com preço de venda maior; soma fecha no total', () => {
  const modelos = [
    { unidadeId: 'a', quantidade: 1, valorUnitarioUsd: 16830 },
    { unidadeId: 'b', quantidade: 1, valorUnitarioUsd: 16830 },
    { unidadeId: 'c', quantidade: 1, valorUnitarioUsd: 17670 },
  ];
  const r = E.ratearPorModelo(modelos, 652551.14);
  assert.ok(r[2].valorUnitarioRs > r[0].valorUnitarioRs, 'o 3º é mais caro');
  assert.equal(r[0].valorUnitarioRs, r[1].valorUnitarioRs);
  closeTo(r.reduce((s, m) => s + m.valorUnitarioRs * m.quantidade, 0), 652551.14, 0.01, 'soma = total');
});

test('ratearPorModelo — quantidade > 1 devolve valor POR equipamento; sem custo USD divide por quantidade', () => {
  const r = E.ratearPorModelo([{ quantidade: 2, valorUnitarioUsd: 100 }, { quantidade: 1, valorUnitarioUsd: 200 }], 1000);
  closeTo(r[0].valorUnitarioRs, 250, 0.001, 'cada um dos 2');
  closeTo(r[1].valorUnitarioRs, 500, 0.001, 'o único');
  const igual = E.ratearPorModelo([{ quantidade: 1 }, { quantidade: 1 }], 1000);
  closeTo(igual[0].valorUnitarioRs, 500, 0.001, 'sem USD: igual');
  assert.deepEqual(E.ratearPorModelo(undefined, 100), []);
});

test('calcularV2 — devolve modelos rateados sobre o preço do próprio V2', () => {
  const out = E.calcularV2({
    parametros: {}, vmleUsd: 1000, txCambial: 5, quantidadeEquipamentos: 2,
    modoFormacaoPreco: 'markup_sobre_custo', markUpPct: 0.3,
    modelos: [{ quantidade: 1, valorUnitarioUsd: 400 }, { quantidade: 1, valorUnitarioUsd: 600 }],
  });
  closeTo(out.modelos.reduce((s, m) => s + m.valorTotalRs, 0), out.precificacao.precoVendaProposta, 0.01, 'soma = preço V2');
});
