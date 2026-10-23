'use strict';
/* Trava: a proposta mantém no mínimo 2 equipamentos visíveis (23/10/2026). */
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./proposta-opcoes.js');
const O = window.PropostaOpcoes;

const prop = (n) => {
  const itens = Array.from({ length: n }, (_, i) => ({ id: `VPEL-EL0990-${i + 1}`, unidadeId: 'U', equipamento: `VPEL-EL0990-${i + 1}`, quantidade: '1', valorUnit: '100000,00', valorOriginal: '100000,00', desconto: null, descontoPendente: null, descontoLog: [] }));
  return { ativos: itens.map((i) => ({ codigo: i.id, unidadeId: 'U' })), elevador: { especificacoes: [], valores: { itens, formaTipo: 'parcelado', qtdParcelas: 5, parcelas: O.parcelasPadrao(5, n * 100000) } } };
};
const cod = (n) => `VPEL-EL0990-${n}`;

test('mínimo é 2 e qtdVisiveis conta os equipamentos visíveis', () => {
  assert.equal(O.MINIMO_VISIVEIS, 2);
  assert.equal(O.qtdVisiveis(prop(9)), 9);
  assert.equal(O.qtdVisiveis(O.alternarOculto(prop(9), cod(1), true).data), 8);
});

test('proposta com 2 equipamentos: não pode ocultar nenhum (botão some)', () => {
  assert.equal(O.podeOcultarMais(prop(2)), false);
  const r = O.alternarOculto(prop(2), cod(1), true);
  assert.match(r.erro, /Limite de oculta/);
  assert.match(r.erro, /dividido por 2/);
});

test('proposta com 3: pode ocultar 1 (fica com 2) e depois não mais', () => {
  assert.equal(O.podeOcultarMais(prop(3)), true);
  const r = O.alternarOculto(prop(3), cod(1), true);
  assert.equal(r.erro, undefined);
  assert.equal(O.qtdVisiveis(r.data), 2);
  assert.equal(O.podeOcultarMais(r.data), false);
  assert.match(O.alternarOculto(r.data, cod(2), true).erro, /Limite/);
});

test('9 equipamentos: ao tentar ocultar o 8º (sobraria 1) é recusado', () => {
  let d = prop(9);
  for (let n = 1; n <= 7; n++) d = O.alternarOculto(d, cod(n), true).data;
  assert.equal(O.qtdVisiveis(d), 2);
  const r = O.alternarOculto(d, cod(8), true);
  assert.match(r.erro, /pelo menos 2/);
  assert.equal(r.data, d);
});

test('reexibir sempre é permitido, mesmo no limite', () => {
  let d = prop(3);
  d = O.alternarOculto(d, cod(1), true).data;
  const r = O.alternarOculto(d, cod(1), false);
  assert.equal(r.erro, undefined);
  assert.equal(O.qtdVisiveis(r.data), 3);
});

test('ocultar de novo um já oculto não é bloqueado nem duplica', () => {
  const d = O.alternarOculto(prop(3), cod(1), true).data;
  const r = O.alternarOculto(d, cod(1), true);
  assert.equal(r.erro, undefined);
  assert.deepEqual(O.ocultosDe(r.data), [cod(1)]);
});
