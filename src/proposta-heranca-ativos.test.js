'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./proposta-heranca.js');
const { montarAtivos } = window.PropostaHeranca;

// Cotação 955 (real): 1 Unidade do Formulário com quantidade 2 → 2 equipamentos físicos
const fontes955 = {
  unidades: [{ id: 'FEU-MTXAM2N9', indice_ativo: 1, quantidade: 2, modelo: 'VP-200', identificador: 'VPEL-EL0955-1' }],
  cotacao: null,
  precificacao: {
    modelos: [{ unidadeId: 'FEU-MTXAM2N9', modelo: 'GEP-MRL', quantidade: 2 }],
    mo_lookup: [
      { unidadeId: 'FEU-MTXAM2N9', identificador: 'VPEL-EL0955-1', equipamentoIndice: 1, valorRs: 14300 },
      { unidadeId: 'FEU-MTXAM2N9', identificador: 'VPEL-EL0955-2', equipamentoIndice: 2, valorRs: 14300 },
    ],
  },
};

test('montarAtivos — Unidade com quantidade 2 vira 2 ativos, cada um com sua MO', () => {
  const a = montarAtivos(fontes955);
  assert.equal(a.length, 2);
  assert.deepEqual(a.map((x) => x.indice), [1, 2]);
  assert.deepEqual(a.map((x) => x.identificador), ['VPEL-EL0955-1', 'VPEL-EL0955-2']);
  assert.deepEqual(a.map((x) => x.custoInstalacaoMaoDeObraRs), [14300, 14300]);
  assert.equal(a[0].modelo, 'GEP-MRL'); // modelo da Precificação, não o do Formulário
});

test('montarAtivos — caso comum (1 equipamento por Unidade) mantém o formato antigo', () => {
  const a = montarAtivos({
    unidades: [{ id: 'U1', indice_ativo: 1, identificador: 'VPEL-EL0950-1', modelo: 'X' }, { id: 'U2', indice_ativo: 2, identificador: 'VPEL-EL0950-2', modelo: 'Y' }],
    cotacao: null,
    precificacao: { modelos: [], mo_lookup: [{ unidadeId: 'U1', valorRs: 100 }, { unidadeId: 'U2', valorRs: 200 }] },
  });
  assert.deepEqual(a.map((x) => x.indice), [1, 2]);
  assert.deepEqual(a.map((x) => x.custoInstalacaoMaoDeObraRs), [100, 200]);
  assert.equal(a[0].unidadeId, undefined);
});

test('montarAtivos — Unidade de qtd 2 seguida de outra Unidade: índices sequenciais sem colisão', () => {
  const a = montarAtivos({
    unidades: [{ id: 'U1', indice_ativo: 1, identificador: 'VPEL-EL0960-1' }, { id: 'U2', indice_ativo: 2, identificador: 'VPEL-EL0960-2' }],
    cotacao: null,
    precificacao: { modelos: [], mo_lookup: [
      { unidadeId: 'U1', identificador: 'VPEL-EL0960-1', equipamentoIndice: 1, valorRs: 10 },
      { unidadeId: 'U1', identificador: 'VPEL-EL0960-1-3', equipamentoIndice: 2, valorRs: 10 },
      { unidadeId: 'U2', identificador: 'VPEL-EL0960-2', equipamentoIndice: 1, valorRs: 20 },
    ] },
  });
  assert.deepEqual(a.map((x) => x.indice), [1, 2, 3]);
  assert.deepEqual(a.map((x) => x.custoInstalacaoMaoDeObraRs), [10, 10, 20]);
});
