'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./sidebar-busca-calc.js');
const S = window.SidebarBuscaCalc;

const GRUPOS = [
  { label: 'Comercial | Pré-venda', items: [
    { id: 'propostas', label: 'Propostas' },
    { id: 'formularios', label: 'Formulários' },
  ]},
  { label: 'Financeiro & Preços', items: [
    { id: 'precificacao', label: 'Precificação' },
    { id: 'comissoes', label: 'Comissões' },
  ]},
  { label: 'Suprimentos & Importação', items: [
    { label: 'Gestão Importação', subheader: true },
    { id: 'pi-importacao', label: 'P.I.' },
    { id: 'futuro', label: 'Em breve', planned: true },
  ]},
];

test('ignora acento e maiúscula', () => {
  assert.equal(S.buscar(GRUPOS, 'PRECIFICACAO')[0].id, 'precificacao');
  assert.equal(S.buscar(GRUPOS, 'formularios')[0].id, 'formularios');
});

test('nome que começa com o texto vem antes de quem só contém', () => {
  const r = S.buscar(GRUPOS, 'pro').map((x) => x.id);
  assert.equal(r[0], 'propostas');
});

test('casa pelo nome do módulo quando o nome da tela não casa', () => {
  const r = S.buscar(GRUPOS, 'financeiro').map((x) => x.id);
  assert.deepEqual(r, ['precificacao', 'comissoes']);
});

test('subcabeçalho e item planejado nunca aparecem', () => {
  const todos = S.buscar(GRUPOS, '').map((x) => x.id);
  assert.ok(!todos.includes('futuro'));
  assert.equal(todos.length, 5);
  assert.equal(S.buscar(GRUPOS, 'importacao').length, 1); // só o P.I., pelo módulo; o subcabeçalho não conta
});

test('sem resultado devolve lista vazia', () => {
  assert.deepEqual(S.buscar(GRUPOS, 'zzzz'), []);
});

test('só enxerga o que foi passado (permissão fica fora da busca)', () => {
  const semFinanceiro = GRUPOS.filter((g) => g.label !== 'Financeiro & Preços');
  assert.deepEqual(S.buscar(semFinanceiro, 'precif'), []);
});

test('respeita o limite', () => {
  assert.equal(S.buscar(GRUPOS, '', 2).length, 2);
});
