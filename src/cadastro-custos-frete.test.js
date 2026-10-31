'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./cadastro-custos-store.js');
const { sugerirFrete, normalizarTexto } = window.CadastroCustosStore;

// Mesmos formatos/valores da aba FRETE do Excel da cotação 963 (Brasília e São Paulo).
const linhas = [
  { destino: 'Brasília', uf: 'DF', transp1_l_rs: null, transp1_ls_rs: 19500, transp2_l_rs: 18500, transp2_ls_rs: 19800, ativo: true },
  { destino: 'São Paulo', uf: 'SP', transp1_l_rs: null, transp1_ls_rs: 2200, transp2_l_rs: 3600, transp2_ls_rs: 3600, ativo: true },
  { destino: 'Goiânia', uf: 'GO', transp1_l_rs: null, transp1_ls_rs: null, transp2_l_rs: 19200, transp2_ls_rs: null, ativo: true },
];

test('normalizarTexto — sem acento, minúscula e espaços', () => {
  assert.equal(normalizarTexto('  BRASÍLIA '), 'brasilia');
  assert.equal(normalizarTexto('São   Paulo'), 'sao paulo');
  assert.equal(normalizarTexto(null), '');
});

test('sugerirFrete — Brasília, 8 containers: LS mais barata (transportadora 1) × 8', () => {
  const s = sugerirFrete(linhas, { cidade: 'Brasilia', uf: 'DF', containers: 8 });
  assert.equal(s.destino.destino, 'Brasília');
  assert.equal(s.porUf, false);
  assert.deepEqual([s.escolhida.transportadora, s.escolhida.modalidade], [1, 'LS']);
  assert.equal(s.valorPorContainer, 19500);
  assert.equal(s.total, 156000);
});

test('sugerirFrete — modalidade LS é o padrão mesmo quando a L é mais barata (L = carga solta)', () => {
  const s = sugerirFrete(linhas, { cidade: 'Brasília', containers: 1 });
  assert.equal(s.escolhida.modalidade, 'LS');
  assert.ok(s.opcoes.some((o) => o.modalidade === 'L' && o.valor === 18500), 'a L continua disponível para o usuário trocar');
});

test('sugerirFrete — usuário escolhe transportadora e modalidade', () => {
  const s = sugerirFrete(linhas, { cidade: 'Brasília', containers: 2, transportadora: 2, modalidade: 'L' });
  assert.equal(s.valorPorContainer, 18500);
  assert.equal(s.total, 37000);
});

test('sugerirFrete — cidade fora da tabela cai na capital do estado e avisa (porUf)', () => {
  const s = sugerirFrete(linhas, { cidade: 'Praia Grande', uf: 'SP', containers: 3 });
  assert.equal(s.destino.destino, 'São Paulo');
  assert.equal(s.porUf, true);
  assert.equal(s.total, 6600);
});

test('sugerirFrete — "cotado caso a caso" (sem valor) não vira opção; sem LS cai na L', () => {
  const s = sugerirFrete(linhas, { cidade: 'Goiânia', containers: 2 });
  assert.deepEqual([s.escolhida.transportadora, s.escolhida.modalidade], [2, 'L']);
  assert.equal(s.total, 38400);
});

test('sugerirFrete — destino desconhecido não inventa valor', () => {
  const s = sugerirFrete(linhas, { cidade: 'Lugar Nenhum', uf: 'XX', containers: 5 });
  assert.equal(s.destino, null);
  assert.equal(s.total, 0);
  assert.equal(s.escolhida, null);
});
