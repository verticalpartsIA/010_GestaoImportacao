'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./cotacoes-varejo-calc.js');
const C = window.CotacoesVarejoCalc;

const faixas = [{ min: 500, preco: 3.8 }, { min: 1, preco: 4.1 }, { min: 100, preco: 3.95 }];

test('preço por faixa: vale a faixa de maior mínimo que cabe na quantidade', () => {
  assert.equal(C.precoNaQuantidade(faixas, 75).preco, 4.1);
  assert.equal(C.precoNaQuantidade(faixas, 100).preco, 3.95);
  assert.equal(C.precoNaQuantidade(faixas, 499).preco, 3.95);
  assert.equal(C.precoNaQuantidade(faixas, 500).preco, 3.8);
  assert.equal(C.precoNaQuantidade(faixas, 5000).preco, 3.8);
});

test('quantidade abaixo do mínimo da 1ª faixa usa a 1ª faixa e avisa', () => {
  const p = C.precoNaQuantidade([{ min: 100, preco: 2 }], 40);
  assert.deepEqual(p, { preco: 2, min: 100, abaixoMin: true });
  assert.equal(C.precoNaQuantidade([{ min: 100, preco: 2 }], 100).abaixoMin, false);
});

test('sem preço válido = não cotou', () => {
  assert.equal(C.precoNaQuantidade([], 10), null);
  assert.equal(C.precoNaQuantidade([{ min: 1, preco: 0 }], 10), null);
  assert.equal(C.precoNaQuantidade(undefined, 10), null);
});

test('melhor convite depende da quantidade (comprar mais pode inverter o vencedor)', () => {
  const resp = { A: { faixas: [{ min: 1, preco: 4.0 }] }, B: { faixas: [{ min: 1, preco: 4.5 }, { min: 200, preco: 3.6 }] }, C: undefined };
  assert.equal(C.melhorConvite(resp, 75), 'A');
  assert.equal(C.melhorConvite(resp, 200), 'B');
  assert.equal(C.melhorConvite({ X: undefined }, 10), null);
});

test('conversão: USD exige câmbio, BRL passa, outra moeda não converte', () => {
  assert.equal(C.paraReais(10, 'USD', 5.5), 55);
  assert.equal(C.paraReais(10, 'USD', 0), null);
  assert.equal(C.paraReais(10, 'BRL'), 10);
  assert.equal(C.paraReais(10, 'EUR', 6), null);
});

test('divisão da compra entre fornecedores e total do lote', () => {
  const itens = [{ id: 'i1', codigo: 'VPEL-031', descricao: 'Polia', quantidade_pedida: 75 }];
  const decisoes = [{ item_id: 'i1', convite_id: 'A', quantidade: 50 }, { item_id: 'i1', convite_id: 'B', quantidade: 100 }];
  const respostas = { 'A|i1': { faixas: [{ min: 1, preco: 4 }] }, 'B|i1': { faixas: [{ min: 1, preco: 4.5 }, { min: 100, preco: 3.6 }] } };
  const convites = [{ id: 'A', moeda: 'USD' }, { id: 'B', moeda: 'USD' }];
  const r = C.consolidarPorFornecedor(itens, decisoes, respostas, convites, 5);
  assert.equal(r.porConvite.A.totalOriginal, 200);
  assert.equal(r.porConvite.B.totalOriginal, 360);
  assert.equal(r.totalBRL, (200 + 360) * 5);
  assert.equal(C.resumoItem(itens[0], decisoes).comprada, 150);
  assert.equal(C.resumoItem(itens[0], decisoes).diferenca, 75);
});

test('sem câmbio o total em R$ fica indefinido (nunca inventa)', () => {
  const itens = [{ id: 'i1', codigo: 'X', quantidade_pedida: 1 }];
  const r = C.consolidarPorFornecedor(itens, [{ item_id: 'i1', convite_id: 'A', quantidade: 2 }],
    { 'A|i1': { faixas: [{ min: 1, preco: 3 }] } }, [{ id: 'A', moeda: 'USD' }], 0);
  assert.equal(r.totalBRL, null);
  assert.equal(r.porConvite.A.totalOriginal, 6);
});
