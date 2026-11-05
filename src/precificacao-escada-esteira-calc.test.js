'use strict';
/* Precificação de Escada/Esteira (cotação 1009): sem motor, preço de venda lançado por equipamento. */
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./precificacao-escada-esteira-calc.js');
require('./proposta-heranca.js');
const C = window.PrecificacaoEscEstCalc;

test('categorias: só escada_rolante e esteira_rolante contam', () => {
  assert.ok(C.ehEscEst('escada_rolante'));
  assert.ok(C.ehEscEst('esteira_rolante'));
  assert.ok(!C.ehEscEst('elevador'));
  assert.equal(C.categoriaDoTipo('escada'), 'escada_rolante');
});

test('numeroDocumento: VPPC-ER1009 / VPPC-ES1009-A', () => {
  assert.equal(C.numeroDocumento('escada_rolante', 1009), 'VPPC-ER1009');
  assert.equal(C.numeroDocumento('esteira_rolante', 1009, 'A'), 'VPPC-ES1009-A');
  assert.equal(C.numeroDocumento('elevador', 1009), null);
});

test('itensDaCotacao: custo do fornecedor por unidade; sem resposta, custo 0', () => {
  const cot = { dados_envio: { unidades: [{ unidade_id: 'U1', identificador: 'VPER-ER1009-1', quantidade: 1 }, { unidade_id: 'U2', identificador: 'VPER-ER1009-2', quantidade: 2 }] },
    respostas: { itens: [{ unidade_id: 'U1', preco_unitario: '$18,990.50' }] } };
  const it = C.itensDaCotacao(cot);
  assert.equal(it.length, 2);
  assert.equal(it[0].custoUnitarioUsd, 18990.5);
  assert.equal(it[1].custoUnitarioUsd, 0);
  assert.equal(it[1].quantidade, 2);
});

test('totais e faltando: preço de venda obrigatório em todos os equipamentos', () => {
  const itens = [{ identificador: 'A', quantidade: 2, precoVendaUnit: '1.000,50' }, { identificador: 'B', quantidade: 1, precoVendaUnit: '' }];
  assert.equal(C.totais(itens).venda, 2001);
  assert.deepEqual(C.faltando({ itens }), ['Preço de venda de B']);
  assert.deepEqual(C.faltando({ itens: [{ identificador: 'A', quantidade: 1, precoVendaUnit: '10' }] }), []);
  assert.deepEqual(C.faltando({ itens: [] }), ['Equipamentos']);
});

test('Proposta: só a precificação finalizada alimenta valorUnit, sem sobrescrever o digitado', () => {
  const lista = [
    { categoria: 'escada_rolante', status: 'rascunho', created_at: '2026-11-05', itens: [] },
    { categoria: 'escada_rolante', status: 'finalizado', created_at: '2026-11-04', itens: [{ unidadeId: 'U1', precoVendaUnit: '250000' }, { unidadeId: 'U2', precoVendaUnit: '300000,5' }] },
  ];
  const pz = C.escolherParaProposta(lista, 'escada_rolante');
  assert.equal(pz.status, 'finalizado');
  assert.equal(C.escolherParaProposta(lista, 'esteira_rolante'), null);
  const r = C.aplicarPrecosNaProposta([{ unidadeId: 'U1', valorUnit: '' }, { unidadeId: 'U2', valorUnit: '999' }], pz);
  assert.equal(r[0].valorUnit, '250000,00');
  assert.equal(r[1].valorUnit, '999');
});

test('montarBlocoEscadaEsteira: usa o preço da precificação finalizada da própria categoria', () => {
  const fontes = {
    encontrado: true,
    unidades: [{ id: 'U1', identificador: 'VPER-ER1009-1', quantidade: 1, tipo_equipamento: 'escada', especificacoes: {} }],
    precificacoesEscEst: [{ categoria: 'escada_rolante', status: 'finalizado', created_at: '2026-11-05', itens: [{ unidadeId: 'U1', precoVendaUnit: '123456,78' }] }],
  };
  const r = window.PropostaHeranca.montarBlocoEscadaEsteira(fontes, 'escada');
  assert.equal(r.especificacoes[0].valorUnit, '123456,78');
  const semPz = window.PropostaHeranca.montarBlocoEscadaEsteira({ ...fontes, precificacoesEscEst: [] }, 'escada');
  assert.equal(semPz.especificacoes[0].valorUnit, '');
});
