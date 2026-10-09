'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./inbox-preco-calc.js');

const U = [
  { unidade_id: 'FEU-1', identificador: 'VPEL-EL0957-1', indice_ativo: 1, quantidade: 6 },
  { unidade_id: 'FEU-2', identificador: 'VPEL-EL0957-2', indice_ativo: 2, quantidade: 1 },
];

test('numeroDe — formatos EUA, BR e sem separador', () => {
  assert.equal(P.numeroDe('12,820.00'), 12820);
  assert.equal(P.numeroDe('12.820,50'), 12820.5);
  assert.equal(P.numeroDe('12820'), 12820);
  assert.equal(P.numeroDe('12,820'), 12820);       // 3 dígitos depois = milhar
  assert.equal(P.numeroDe('US$ 9.140'), 9140);
  assert.equal(P.numeroDe('sem número'), null);
});

test('limparCitacao — corta a RFQ citada e linhas com ">"', () => {
  const t = 'Price: USD 12,820\n> Capacidade 1050 kg\nOn Mon, 3 Oct 2026, VerticalParts wrote:\nUSD 99,999 antigo';
  const r = P.limparCitacao(t);
  assert.ok(r.includes('12,820'));
  assert.ok(!r.includes('99,999'));
  assert.ok(!r.includes('1050'));
});

test('extrair — linha com o identificador da unidade vincula com confiança alta; unitário × total', () => {
  const texto = 'Dear Victoria,\nVPEL-EL0957-1 unit price: USD 12,820.00\nVPEL-EL0957-2 total USD 11,000\nBest regards';
  const r = P.extrair(texto, U);
  assert.equal(r.moeda, 'USD');
  const a = r.valores.find((v) => v.valor === 12820);
  assert.equal(a.unidadeId, 'FEU-1'); assert.equal(a.confianca, 'alta'); assert.equal(a.tipo, 'unitario');
  const b = r.valores.find((v) => v.valor === 11000);
  assert.equal(b.unidadeId, 'FEU-2'); assert.equal(b.tipo, 'total');
});

test('extrair — "Item 2" liga pelo índice (confiança média); valor sem unidade fica sem vínculo (baixa)', () => {
  const r = P.extrair('Item 2 - price USD 11000\nOptional extra: USD 2500', U);
  assert.equal(r.valores.find((v) => v.valor === 11000).unidadeId, 'FEU-2');
  const extra = r.valores.find((v) => v.valor === 2500);
  assert.equal(extra.unidadeId, null); assert.equal(extra.confianca, 'baixa');
  assert.ok(r.avisos.length >= 1);
});

test('extrair — ignora ano, prazo, medida, percentual e números pequenos', () => {
  const r = P.extrair('Delivery 2026\nLead time 30 days\nGuide rail 2000mm\nDeposit 30%\nQty 6 sets', U);
  assert.equal(r.valores.length, 0);
  assert.ok(r.avisos[0].includes('Não achei'));
});

test('extrair — uma unidade só e um valor solto: propõe com confiança média', () => {
  const r = P.extrair('Our price is USD 9,860 per set', [U[0]]);
  assert.equal(r.valores.length, 1);
  assert.equal(r.valores[0].unidadeId, 'FEU-1'); assert.equal(r.valores[0].confianca, 'media');
});

test('extrair — condições: incoterm, container, prazo, validade, garantia, pagamento, frete', () => {
  const t = ['Price term: FOB Shanghai', 'Container: 8 x 40HC', 'Lead time: 30 days after T/T prepayment', 'Validity 30 days', 'Warranty: 24 months',
    'Payment terms: 30% T/T in advance, 70% before shipment', 'Ocean freight USD 4,200'].join('\n');
  const r = P.extrair(t, U);
  assert.match(r.termos.incoterm_porto, /^FOB Shanghai/);
  assert.match(r.termos.container_no, /8\s*x\s*40HC/i);
  assert.match(r.termos.prazo_fabricacao, /30 days/);
  assert.equal(r.termos.validade_dias, '30');
  assert.match(r.termos.garantia, /24 months/);
  assert.match(r.termos.condicoes_pagamento, /30% T\/T/);
  assert.equal(r.termos.frete_internacional_usd, '4200');
});

test('montarRespostas — formato do formulário: total = unitário × quantidade; preserva o que já existia', () => {
  const r = P.montarRespostas({
    atual: { garantia: '12 months', itens: [{ unidade_id: 'FEU-1', modelo_fornecedor: 'GEP-MRL', divergencias: { overhead: '4100' } }] },
    unidades: U, precos: { 'FEU-1': { preco_unitario: 12820 }, 'FEU-2': { preco_unitario: 11000 } },
    termos: { moeda: 'USD', container_no: '8 x 40HC', garantia: '' },
  });
  assert.equal(r.moeda, 'USD');
  assert.equal(r.garantia, '12 months');                 // campo vazio nos termos não apaga o que já havia
  assert.equal(r.container_no, '8 x 40HC');
  const i1 = r.itens.find((i) => i.unidade_id === 'FEU-1');
  assert.equal(i1.preco_unitario, 12820); assert.equal(i1.preco_total, 76920);
  assert.equal(i1.modelo_fornecedor, 'GEP-MRL'); assert.deepEqual(i1.divergencias, { overhead: '4100' });
  assert.equal(r.itens.find((i) => i.unidade_id === 'FEU-2').preco_total, 11000);
});
