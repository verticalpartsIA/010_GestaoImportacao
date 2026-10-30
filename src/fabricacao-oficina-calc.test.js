'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./fabricacao-oficina-calc.js');
const C = window.FabOficinaCalc;

const etapas = (feitas) => [17, 17, 17, 17, 16, 16].map((peso, i) => ({ id: 'e' + i, ordem: i + 1, peso, flegado: i < feitas }));

test('progresso: ponderado, teto 99 e 100 só com tudo feito', () => {
  assert.equal(C.progresso(etapas(0)), 0);
  assert.equal(C.progresso(etapas(2)), 34);
  assert.equal(C.progresso(etapas(5)), 84);
  assert.equal(C.progresso(etapas(6)), 100);
  assert.equal(C.progresso([]), 0);
});

test('progresso: pesos que não somam 100 nunca chegam a 100', () => {
  assert.equal(C.progresso([{ id: 'a', ordem: 1, peso: 30, flegado: true }, { id: 'b', ordem: 2, peso: 30, flegado: true }]), 60);
});

test('etapaAtualId: primeira não feita, por ordem', () => {
  const e = etapas(2).reverse();
  assert.equal(C.etapaAtualId(e), 'e2');
  assert.equal(C.etapaAtualId(etapas(6)), null);
});

test('pausado: só ocorrência aberta sem frente de trabalho', () => {
  assert.equal(C.pausado([{ status: 'aberta', tem_frente_trabalho: false }]), true);
  assert.equal(C.pausado([{ status: 'aberta', tem_frente_trabalho: true }]), false);
  assert.equal(C.pausado([{ status: 'resolvida', tem_frente_trabalho: false }]), false);
});

test('localizacaoDoItem: junta OPs de Corrimão/Corte e envios a Quadro/Expedição', () => {
  const d = {
    ops: [
      { item_codigo: 'VP-1699', frente: 'corrimao', status: 'concluida' },
      { item_codigo: 'VP-1699', frente: 'corrimao', status: 'em_producao' },
      { item_codigo: 'VPEL-692', frente: 'corte', status: 'concluida' },
      { item_codigo: 'VPEL-692', frente: 'corte', status: 'cancelada' },
    ],
    enviados: [
      { codigo: 'VPEL-692', destino: 'expedicao' }, { codigo: 'VPEL-692', destino: 'expedicao' },
      { codigo: 'VPB-086', destino: 'quadro' },
    ],
  };
  assert.deepEqual(C.localizacaoDoItem('VP-1699', d), ['Corrimão: 1 de 2 prontas']);
  assert.deepEqual(C.localizacaoDoItem('VPEL-692', d), ['Corte: pronto', 'Na Expedição']);
  assert.deepEqual(C.localizacaoDoItem('VPB-086', d), ['No Quadro de Comando']);
  assert.deepEqual(C.localizacaoDoItem('VPX-1', d), []);
  assert.deepEqual(C.localizacaoDoItem('VPX-1', null), []);
});

test('unidadeDoTitulo', () => {
  assert.deepEqual(C.unidadeDoTitulo('Corrimão X — unidade 2/3'), { n: 2, de: 3 });
  assert.equal(C.unidadeDoTitulo('Corrimão X'), null);
});

test('corte: escopo só cabo de aço, cinta de tração e cabo de manobra, com descrição comercial', () => {
  assert.equal(C.categoriaCorte('VPEL-692'), 'aco');
  assert.equal(C.categoriaCorte('vpel-234n'), 'cinta');
  assert.equal(C.categoriaCorte('SAO_OT06MB132420'), 'manobra');
  assert.equal(C.categoriaCorte('VPB-101'), 'manobra');
  assert.equal(C.descricaoCorte('VPB-101', 'Cabo BST X'), 'Cabo BST X');
  assert.equal(C.categoriaCorte('VPB-086'), 'manobra');
  assert.equal(C.categoriaCorte('VPEL-999', 'Cabo de Aço 8x19 10MM'), 'aco');
  assert.equal(C.categoriaCorte('VPEL-702b', 'Sistema de Comando para Elevador'), null);
  assert.equal(C.rotuloItemCorte('VPEL-692', 'x'), 'VPEL-692 — Cabo de Aço para Elevador 8*19S+FC 9,5MM (3/8 pol)');
  assert.equal(C.rotuloItemCorte('ABC', 'Descrição do cadastro'), 'ABC — Descrição do cadastro');
  assert.equal(C.rotuloItemCorte('ABC', ''), 'ABC');
  assert.equal(Object.keys(C.CORTE_DESCRICOES).length, 30);
});

test('corte: OP antiga sem item_codigo usa o código do título', () => {
  assert.equal(C.codigoDaOrdem({ item_codigo: 'VPEL-692', titulo: 'x' }), 'VPEL-692');
  assert.equal(C.codigoDaOrdem({ item_codigo: null, titulo: 'Corte — VPEL-529n' }), 'VPEL-529n');
  assert.equal(C.categoriaCorte(C.codigoDaOrdem({ titulo: 'Corte — VPEL-692' })), 'aco');
  assert.equal(C.categoriaCorte(C.codigoDaOrdem({ titulo: 'Corte — VPB-101' }), 'Corte — VPB-101'), 'manobra');
  assert.equal(C.categoriaCorte('VPB-107', 'Corte — VPB-107'), null);
});
