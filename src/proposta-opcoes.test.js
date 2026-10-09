'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./proposta-opcoes.js');
const O = window.PropostaOpcoes;

const proposta = (extra) => ({
  numero: 'VPPR-0961',
  elevador: {
    valores: {
      equipamento: 'VPEL-EL0961-1', quantidade: '1', valorUnit: '191546', difal: '24178', formaTipo: 'parcelado', qtdParcelas: 5,
      forma: '40% à vista e 4 parcelas', parcelas: [{ desc: 'Sinal de 40% na assinatura do contrato', valor: '86.289,60' }],
      opcao90: { valorUnit: '224913', difal: '24178', formaTipo: 'parcelado', qtdParcelas: 5, forma: '40% à vista e 4 parcelas', parcelas: [{ desc: 'Sinal de 40% na assinatura do contrato', valor: '99.636,40' }] },
      ...extra,
    },
  },
});

test('temOpcoes — só com opcao90 válida e sem escolha feita', () => {
  assert.equal(O.temOpcoes(proposta()), true);
  assert.equal(O.temOpcoes(proposta({ escolhaEntrega: '90' })), false, 'já escolheu → não mostra mais as duas');
  assert.equal(O.temOpcoes(proposta({ opcao90: null })), false);
  assert.equal(O.temOpcoes(proposta({ opcao90: { valorUnit: '0' } })), false);
  assert.equal(O.temOpcoes({}), false);
  assert.equal(O.temOpcoes(null), false);
});

test('opcoes — par [120, 90] com total = equipamento + DIFAL e características de cada modalidade', () => {
  const [a, b] = O.opcoes(proposta());
  assert.equal(a.id, '120'); assert.equal(b.id, '90');
  assert.equal(a.total, 191546 + 24178);
  assert.equal(b.total, 224913 + 24178);
  assert.match(a.caracteristicas.join(' '), /120 dias/);
  assert.match(b.caracteristicas.join(' '), /90 dias/);
  assert.equal(O.opcoes(proposta({ opcao90: null })), null);
});

test('aplicarEscolha 90 — valores oficiais passam a ser os da opção 90 (o que o Contrato herda); original não é mutado', () => {
  const orig = proposta();
  const novo = O.aplicarEscolha(orig, '90');
  assert.equal(novo.elevador.valores.valorUnit, '224913');
  assert.equal(novo.elevador.valores.parcelas[0].valor, '99.636,40');
  assert.equal(novo.elevador.valores.escolhaEntrega, '90');
  assert.equal(orig.elevador.valores.valorUnit, '191546', 'não muta o original');
  assert.equal(O.temOpcoes(novo), false, 'depois de escolher, só uma modalidade aparece');
  assert.equal(O.modalidadeEscolhida(novo).id, '90');
});

test('aplicarEscolha 120 — só marca a escolha, valores oficiais continuam os de 120 dias', () => {
  const novo = O.aplicarEscolha(proposta(), '120');
  assert.equal(novo.elevador.valores.valorUnit, '191546');
  assert.equal(novo.elevador.valores.escolhaEntrega, '120');
  assert.equal(O.temOpcoes(novo), false);
});

test('aplicarEscolha — idempotente, ignora escolha inválida e proposta sem opção', () => {
  const uma = O.aplicarEscolha(proposta(), '90');
  assert.equal(O.aplicarEscolha(uma, '120'), uma, 'escolha já aplicada não é trocada de novo');
  const p = proposta();
  assert.equal(O.aplicarEscolha(p, 'xx'), p);
  const sem = proposta({ opcao90: null });
  assert.equal(O.aplicarEscolha(sem, '90'), sem);
});

test('totalOficial — acompanha a modalidade aplicada (alimenta valor_total)', () => {
  assert.equal(O.totalOficial(proposta()), 191546);
  assert.equal(O.totalOficial(O.aplicarEscolha(proposta(), '90')), 224913);
});

test('montarOpcao90 — arredonda, gera parcelas pelo template e rejeita preço zerado', () => {
  const o = O.montarOpcao90({
    precoVendaPorEquipamento: 224912.66, difal: 24177.53, qtdParcelas: 5,
    parcelasFn: (qtd, total) => [{ desc: 'x', valor: String(Math.round(total)) }],
  });
  assert.equal(o.valorUnit, '224913');
  assert.equal(o.difal, '24178');
  assert.equal(o.forma, '40% à vista e 4 parcelas');
  assert.equal(o.parcelas[0].valor, String(224913 + 24178));
  assert.equal(O.montarOpcao90({ precoVendaPorEquipamento: 0 }), null);
});
