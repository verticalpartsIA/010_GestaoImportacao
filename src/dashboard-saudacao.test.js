'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { nomeDaSaudacao } = require('./dashboard-saudacao.js');

test('saudação — nome simples vira inicial maiúscula', () => {
  assert.equal(nomeDaSaudacao('bianca@verticalparts.com.br'), 'Bianca');
  assert.equal(nomeDaSaudacao('almoxarifado@verticalparts.com.br'), 'Almoxarifado');
});

test('saudação — nome.sobrenome vira duas palavras, com o acento do dicionário', () => {
  assert.equal(nomeDaSaudacao('gelson.simoes@verticalparts.com.br'), 'Gelson Simões');
  assert.equal(nomeDaSaudacao('regiane.rocha@verticalparts.com.br'), 'Regiane Rocha');
});

test('saudação — separadores . _ - e caixa alta no e-mail', () => {
  assert.equal(nomeDaSaudacao('Maria_da-Silva@verticalparts.com.br'), 'Maria Da Silva');
});

test('saudação — regras de final de palavra (-ção, -ções, -ões)', () => {
  assert.equal(nomeDaSaudacao('expedicao@verticalparts.com.br'), 'Expedição');
  assert.equal(nomeDaSaudacao('producao@verticalparts.com.br'), 'Produção');
  assert.equal(nomeDaSaudacao('automacao@verticalparts.com.br'), 'Automação');
  assert.equal(nomeDaSaudacao('mauricio@verticalparts.com.br'), 'Maurício');
  assert.equal(nomeDaSaudacao('ana.antunes@verticalparts.com.br'), 'Ana Antunes');
});

test('saudação — sem login ou ambiente local devolve VP Gestão', () => {
  assert.equal(nomeDaSaudacao(''), 'VP Gestão');
  assert.equal(nomeDaSaudacao(null), 'VP Gestão');
  assert.equal(nomeDaSaudacao('dev@localhost'), 'VP Gestão');
});
