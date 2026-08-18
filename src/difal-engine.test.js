'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
window.__VP_SB = { sb: null };
require('./difal-engine.js');
const D = window.DifalEngine;

const estadoBaseUnica = { categoria: 'Base Única', aliquota_interestadual_estrangeira: 0.04, aliquota_interestadual_nacional: 0.07, aliquota_interna: 0.18, fundo_combate: 0 };
const estadoBaseUnicaFcp = { ...estadoBaseUnica, fundo_combate: 0.02 };
const estadoBaseDuplaSimples = { categoria: 'Base Dupla Simples', aliquota_interestadual_estrangeira: 0.04, aliquota_interestadual_nacional: 0.07, aliquota_interna: 0.18, fundo_combate: 0 };
const estadoBaseDuplaComposta = { categoria: 'Base Dupla Composta', aliquota_interestadual_estrangeira: 0.04, aliquota_interestadual_nacional: 0.07, aliquota_interna: 0.18, fundo_combate: 0 };

test('calcular — mesma UF de origem e destino, sem DIFAL', () => {
  const r = D.calcular({ ufOrigem: 'SP', ufFaturamento: 'SP', finalidadeCompra: 'uso_consumo_ativo', valorOperacao: 1000 });
  assert.equal(r.difal_aplicavel, false);
  assert.match(r.mensagem, /Operação interna/);
});

test('calcular — revenda nunca gera DIFAL', () => {
  const r = D.calcular({ ufOrigem: 'SP', ufFaturamento: 'RJ', finalidadeCompra: 'revenda', valorOperacao: 1000, estadoDestino: estadoBaseUnica });
  assert.equal(r.difal_aplicavel, false);
  assert.equal(r.alerta, null);
});

test('calcular — revenda + não-contribuinte gera alerta (mas continua sem DIFAL)', () => {
  const r = D.calcular({ ufOrigem: 'SP', ufFaturamento: 'RJ', finalidadeCompra: 'revenda', contribuinteIcms: false, valorOperacao: 1000, estadoDestino: estadoBaseUnica });
  assert.equal(r.difal_aplicavel, false);
  assert.match(r.alerta, /Não Contribuintes/);
});

test('calcular — sem UF de destino, pede pra informar', () => {
  const r = D.calcular({ ufOrigem: 'SP', finalidadeCompra: 'uso_consumo_ativo', valorOperacao: 1000 });
  assert.match(r.mensagem, /Informe a UF de entrega/);
});

test('calcular — UF de destino sem estado cadastrado', () => {
  const r = D.calcular({ ufOrigem: 'SP', ufFaturamento: 'RJ', finalidadeCompra: 'uso_consumo_ativo', valorOperacao: 1000 });
  assert.match(r.mensagem, /não encontrado na tabela/);
});

test('calcular — uso/consumo sem informar contribuinte, pede antes de decidir responsável', () => {
  const r = D.calcular({ ufOrigem: 'SP', ufFaturamento: 'RJ', finalidadeCompra: 'uso_consumo_ativo', valorOperacao: 1000, estadoDestino: estadoBaseUnica });
  assert.match(r.mensagem, /Informe se o cliente é Contribuinte/);
});

test('calcular — Base Única: DIFAL = valor × (aliq interna − aliq interestadual)', () => {
  const r = D.calcular({ ufOrigem: 'SP', ufFaturamento: 'RJ', finalidadeCompra: 'uso_consumo_ativo', contribuinteIcms: true, valorOperacao: 1000, origemMercadoria: 'Estrangeira', estadoDestino: estadoBaseUnica });
  assert.equal(r.difal_aplicavel, true);
  assert.ok(Math.abs(r.valor_difal - 140) < 0.01);
});

test('calcular — Base Única com FCP soma o fundo de combate à pobreza', () => {
  const r = D.calcular({ ufOrigem: 'SP', ufFaturamento: 'RJ', finalidadeCompra: 'uso_consumo_ativo', contribuinteIcms: true, valorOperacao: 1000, origemMercadoria: 'Estrangeira', estadoDestino: estadoBaseUnicaFcp });
  assert.ok(Math.abs(r.valor_difal - 160) < 0.01);
});

test('calcular — Base Dupla Simples', () => {
  const r = D.calcular({ ufOrigem: 'SP', ufFaturamento: 'RJ', finalidadeCompra: 'uso_consumo_ativo', contribuinteIcms: true, valorOperacao: 1000, origemMercadoria: 'Estrangeira', estadoDestino: estadoBaseDuplaSimples });
  assert.ok(Math.abs(r.valor_difal - 163.9024390) < 0.01);
});

test('calcular — Base Dupla Composta', () => {
  const r = D.calcular({ ufOrigem: 'SP', ufFaturamento: 'RJ', finalidadeCompra: 'uso_consumo_ativo', contribuinteIcms: true, valorOperacao: 1000, origemMercadoria: 'Estrangeira', estadoDestino: estadoBaseDuplaComposta });
  assert.ok(Math.abs(r.valor_difal - 170.7317073) < 0.01);
});

test('calcular — contribuinte=true: DIFAL é responsabilidade do cliente, sem bloqueio', () => {
  const r = D.calcular({ ufOrigem: 'SP', ufFaturamento: 'RJ', finalidadeCompra: 'uso_consumo_ativo', contribuinteIcms: true, valorOperacao: 1000, estadoDestino: estadoBaseUnica });
  assert.equal(r.responsavel_recolhimento, 'destinatario_cliente');
  assert.equal(r.exige_gnre_emitente, false);
  assert.equal(r.bloqueio_faturamento, false);
});

// Regressão do caso mais delicado do motor: cliente não-contribuinte —
// a VerticalParts fica responsável pelo DIFAL e o faturamento deve
// travar até a GNRE ser paga. Se essa trava quebrar silenciosamente,
// a empresa fatura sem recolher um imposto que é dela.
test('calcular — contribuinte=false: DIFAL vira responsabilidade da VerticalParts e BLOQUEIA faturamento', () => {
  const r = D.calcular({ ufOrigem: 'SP', ufFaturamento: 'RJ', finalidadeCompra: 'uso_consumo_ativo', contribuinteIcms: false, valorOperacao: 1000, estadoDestino: estadoBaseUnica });
  assert.equal(r.responsavel_recolhimento, 'emitente_verticalparts');
  assert.equal(r.exige_gnre_emitente, true);
  assert.equal(r.bloqueio_faturamento, true);
  assert.match(r.alerta, /GNRE/);
});

test('calcular — categoria desconhecida retorna mensagem de erro em vez de calcular errado', () => {
  const r = D.calcular({ ufOrigem: 'SP', ufFaturamento: 'RJ', finalidadeCompra: 'uso_consumo_ativo', valorOperacao: 1000, estadoDestino: { categoria: 'Categoria Inexistente' } });
  assert.match(r.mensagem, /Categoria de cálculo desconhecida/);
});
