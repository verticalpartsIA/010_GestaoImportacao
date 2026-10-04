'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('./inbox-visibilidade.js');

/* Cadeia fictícia: diego (CEO) > regiane (gestora Comercial) > vendedor1/vendedor2; juliana (encarregada Financeiro) > fin1 */
const pessoas = [
  { id: 1, email: 'diego@x.com', manager_id: null },
  { id: 2, email: 'regiane@x.com', manager_id: 1 },
  { id: 3, email: 'vendedor1@x.com', manager_id: 2 },
  { id: 4, email: 'vendedor2@x.com', manager_id: 2 },
  { id: 5, email: 'juliana@x.com', manager_id: 1 },
  { id: 6, email: 'fin1@x.com', manager_id: 5 },
];
const depto = { 'diego@x.com': 'CEO', 'regiane@x.com': 'Comercial', 'vendedor1@x.com': 'Comercial', 'vendedor2@x.com': 'Comercial', 'juliana@x.com': 'Adm/Financeiro', 'fin1@x.com': 'Adm/Financeiro' };
const ctx = (eu, caps) => ({
  eu, caps: { areas: [], ...caps },
  equipe: V.subordinados(pessoas, eu), meuDepartamento: depto[eu], departamentoDe: (e) => depto[e] || null,
});

test('subordinados — direta e indireta, sem o próprio chefe', () => {
  assert.deepEqual([...V.subordinados(pessoas, 'diego@x.com')].sort(), ['fin1@x.com', 'juliana@x.com', 'regiane@x.com', 'vendedor1@x.com', 'vendedor2@x.com']);
  assert.deepEqual([...V.subordinados(pessoas, 'regiane@x.com')].sort(), ['vendedor1@x.com', 'vendedor2@x.com']);
  assert.equal(V.subordinados(pessoas, 'vendedor1@x.com').size, 0);
  assert.equal(V.subordinados(pessoas, 'desconhecido@x.com').size, 0);
});

test('subordinados — ciclo no cadastro não trava', () => {
  const ciclo = [{ id: 1, email: 'a@x.com', manager_id: 2 }, { id: 2, email: 'b@x.com', manager_id: 1 }];
  assert.deepEqual([...V.subordinados(ciclo, 'a@x.com')], ['b@x.com']);
});

test('podeVer — o dono sempre vê o próprio e-mail, mesmo sem nenhuma alçada', () => {
  assert.equal(V.podeVer('vendedor1@x.com', ctx('vendedor1@x.com', {})), true);
  assert.equal(V.podeVer('VENDEDOR1@x.com', ctx('vendedor1@x.com', {})), true);   // maiúsculas não importam
});

test('podeVer — sem alçada, não vê o e-mail de outro nem o sem dono', () => {
  assert.equal(V.podeVer('vendedor2@x.com', ctx('vendedor1@x.com', {})), false);
  assert.equal(V.podeVer(null, ctx('vendedor1@x.com', {})), false);
});

test('podeVer — ver_todos (CEO) vê tudo, inclusive o sem dono', () => {
  const c = ctx('diego@x.com', { ver_todos: true });
  assert.equal(V.podeVer('fin1@x.com', c), true);
  assert.equal(V.podeVer(null, c), true);
});

test('podeVer — gestora vê a equipe dela, mas não o Financeiro', () => {
  const c = ctx('regiane@x.com', { ver_equipe: true });
  assert.equal(V.podeVer('vendedor1@x.com', c), true);
  assert.equal(V.podeVer('fin1@x.com', c), false);
});

test('podeVer — gestora vê o Financeiro só se a área estiver marcada (interação entre áreas)', () => {
  const c = ctx('regiane@x.com', { ver_equipe: true, areas: ['financeiro'] });
  assert.equal(V.podeVer('fin1@x.com', c), true);
  assert.equal(V.podeVer('juliana@x.com', c), true);
});

test('podeVer — encarregada do Financeiro vê o departamento dela e as áreas marcadas', () => {
  const c = ctx('juliana@x.com', { ver_departamento: true, areas: ['engenharia'] });
  assert.equal(V.podeVer('fin1@x.com', c), true);          // mesmo departamento
  assert.equal(V.podeVer('vendedor1@x.com', c), false);    // Comercial não marcado
});

test('podeVer — sem dono só aparece para quem faz triagem', () => {
  assert.equal(V.podeVer(null, ctx('juliana@x.com', { triagem: true })), true);
  assert.equal(V.podeVer(null, ctx('juliana@x.com', { ver_departamento: true })), false);
});

test('areaDe — departamento do cadastro vira o sufixo da alçada', () => {
  assert.equal(V.areaDe('Adm/Financeiro'), 'financeiro');
  assert.equal(V.areaDe('Jurídico/Importação/Suprimentos'), 'juridico_importacao');
  assert.equal(V.areaDe('CEO'), null);
  assert.equal(V.areaDe(null), null);
});
