'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./portas-vidro-calc.js');
const P = window.PortasVidro;

const U = (extra, pv) => ({
  paradas: 3, pavimentos_desc: 'Térreo, 1, 2', porta_oposta: 'Não',
  acabamento_porta_cabina: 'Aço 304', acabamento_porta_pavimento: 'Aço 304',
  especificacoes: { portas_vidro: pv }, ...extra,
});

test('sem vidro devolve o aço da coluna, igual a antes', () => {
  assert.equal(P.descricao(U({}, undefined), 'pavimento', 'pt'), 'Aço 304');
  assert.equal(P.descricao(U({}, null), 'cabina', 'pt'), 'Aço 304');
  assert.equal(P.descricao({ acabamento_porta_cabina: 'Pintado' }, 'cabina', 'tri'), 'Pintado');
});

test('vidro só no térreo, demais em aço (caso do Gelson)', () => {
  const u = U({}, { pavimento: { base: 'Aço 304', modo: 'alguns', andares: [{ n: 1, frente: true }] } });
  assert.equal(P.descricao(u, 'pavimento', 'pt'), 'Vidro nos pavimentos Térreo; demais portas em Aço 304');
  assert.equal(P.descricao(u, 'cabina', 'pt'), 'Aço 304'); // cabina continua aço
});

test('vidro em todos os pavimentos e na cabina', () => {
  const u = U({}, { cabina: { frente: true }, pavimento: { modo: 'todos', frente: true } });
  assert.equal(P.descricao(u, 'pavimento', 'pt'), 'Vidro em todos os pavimentos');
  assert.equal(P.descricao(u, 'cabina', 'pt'), 'Vidro');
});

test('porta oposta no 1º pavimento: as duas de vidro, ou uma de vidro e outra de aço', () => {
  const ambas = U({ porta_oposta: 'Sim - 180°' }, { pavimento: { base: 'Aço 430', modo: 'alguns', andares: [{ n: 1, frente: true, oposta: true }] } });
  assert.equal(P.descricao(ambas, 'pavimento', 'pt'), 'Vidro nos pavimentos Térreo (frente e oposta); demais portas em Aço 430');
  const uma = U({ porta_oposta: 'Sim' }, { pavimento: { base: 'Aço 430', modo: 'alguns', andares: [{ n: 1, frente: true, oposta: false }] } });
  assert.equal(P.descricao(uma, 'pavimento', 'pt'), 'Vidro nos pavimentos Térreo (frente); demais portas em Aço 430');
});

test('cabina com porta oposta: frente vidro e oposta aço', () => {
  const u = U({ porta_oposta: 'Sim' }, { cabina: { base: 'Aço 304', frente: true, oposta: false } });
  assert.match(P.descricao(u, 'cabina', 'pt'), /^Vidro \(porta de frente\); porta oposta em Aço 304$/);
  const duas = U({ porta_oposta: 'Sim' }, { cabina: { frente: true, oposta: true } });
  assert.equal(P.descricao(duas, 'cabina', 'pt'), 'Vidro (porta de frente e porta oposta)');
});

test('sem porta oposta, o lado oposto é ignorado mesmo se estiver gravado', () => {
  const u = U({ porta_oposta: 'Não' }, { pavimento: { base: 'Aço 304', modo: 'alguns', andares: [{ n: 2, frente: false, oposta: true }, { n: 3, frente: true, oposta: true }] } });
  assert.equal(P.descricao(u, 'pavimento', 'pt'), 'Vidro nos pavimentos 2; demais portas em Aço 304');
});

test('rótulo do pavimento: usa a descrição só se a contagem bate, senão "Pav. n"', () => {
  assert.deepEqual(P.andares(3, 'Térreo, 1, 2').map((a) => a.rotulo), ['Térreo', '1', '2']);
  assert.deepEqual(P.andares(3, 'Térreo, 1').map((a) => a.rotulo), ['Pav. 1', 'Pav. 2', 'Pav. 3']);
  assert.deepEqual(P.andares('', 'x'), []);
});

test('texto em inglês, chinês e os três juntos para o fornecedor', () => {
  const u = U({}, { pavimento: { base: 'Aço 304', modo: 'alguns', andares: [{ n: 1, frente: true }] } });
  assert.equal(P.descricao(u, 'pavimento', 'en'), 'Glass at landings Térreo; other doors in Stainless steel 304');
  assert.match(P.descricao(u, 'pavimento', 'zh'), /玻璃.*304不锈钢/);
  assert.equal(P.descricao(u, 'pavimento', 'tri').split(' / ').length, 3);
});

test('normalizar descarta lixo, pavimento repetido e andar sem vidro', () => {
  const n = P.normalizar({ pavimento: { modo: 'alguns', base: 'Inox', andares: [{ n: 2, frente: true }, { n: 2, frente: true }, { n: 3 }, { n: 'x', frente: true }] } });
  assert.deepEqual(n.pavimento.andares, [{ n: 2, frente: true, oposta: false }]);
  assert.equal(n.pavimento.base, ''); // "Inox" não é uma das opções de aço
  assert.deepEqual(P.normalizar('lixo'), { cabina: null, pavimento: null });
  assert.equal(P.normalizar({ pavimento: { modo: 'alguns', andares: [] } }).pavimento, null);
});

test('validar: vidro parcial exige o material das demais portas', () => {
  const sem = U({}, { pavimento: { modo: 'alguns', andares: [{ n: 1, frente: true }] } });
  assert.match(P.validar(sem)[0], /material das portas que não são de vidro/);
  const ok = U({}, { pavimento: { base: 'Aço 304', modo: 'alguns', andares: [{ n: 1, frente: true }] } });
  assert.deepEqual(P.validar(ok), []);
  // todos em vidro: não precisa de aço
  assert.deepEqual(P.validar(U({}, { pavimento: { modo: 'todos', frente: true } })), []);
});

test('validar: pavimento acima das paradas, "alguns" sem nenhum, e oposta de vidro sem porta oposta', () => {
  const alto = U({}, { pavimento: { base: 'Aço 304', modo: 'alguns', andares: [{ n: 9, frente: true }] } });
  assert.match(P.validar(alto)[0], /acima das 3 paradas/);
  const nenhum = U({}, { pavimento: { base: 'Aço 304', modo: 'alguns', andares: [] } });
  assert.match(P.validar(nenhum)[0], /marque onde o vidro/);
  const soOposta = U({ porta_oposta: 'Não' }, { cabina: { base: 'Aço 304', oposta: true } });
  assert.match(P.validar(soOposta)[0], /marque onde o vidro/);
});

test('cabina com porta oposta exige o aço quando só um lado é de vidro', () => {
  const u = U({ porta_oposta: 'Sim' }, { cabina: { frente: true, oposta: false } });
  assert.match(P.validar(u)[0], /material/);
});
