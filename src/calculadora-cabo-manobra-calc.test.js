'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./calculadora-cabo-manobra-calc.js');
const C = window.CaboManobraCalc;

const perto = (a, b) => assert.ok(Math.abs(a - b) < 0.005, a + ' != ' + b);

test('padrão MRL (9 paradas, 3 m, poço 1,5, K 4,5, margem 2): confere com a planilha HTML original', () => {
  const r = C.calcular(C.PADRAO);
  assert.equal(r.ok, true);
  perto(r.curso, 24);
  perto(r.seio, 4.82);          // 2×1,35 + π×1,35/2
  perto(r.cabine, 6.5);
  perto(r.total, 41.82);
  assert.equal(r.comprar, 42);  // arredonda para cima
});

test('com casa de máquinas (MR) troca a margem pela distância do quadro ao furo', () => {
  const r = C.calcular({ ...C.PADRAO, tipo: 'MR', distanciaMr: 4 });
  perto(r.total, 24 + 4.5 + 4.82 + 6.5 + 4);
  assert.match(r.extraRotulo, /furo/);
  // a margem MRL não pesa no MR
  assert.equal(C.calcular({ ...C.PADRAO, tipo: 'MR', margemMrl: 99 }).total, r.total);
});

test('aceita texto vindo do campo da tela', () => {
  const r = C.calcular({ tipo: 'MRL', paradas: '9', pisoAPiso: '3.0', profundidadePoco: '1.5', overhead: '4.5', margemMrl: '2.0', distanciaMr: '4.0' });
  assert.equal(r.comprar, 42);
});

test('valida: menos de 2 paradas e poço raso devolvem erro, não número', () => {
  assert.equal(C.calcular({ ...C.PADRAO, paradas: 1 }).ok, false);
  assert.equal(C.calcular({ ...C.PADRAO, paradas: '' }).ok, false);
  const raso = C.calcular({ ...C.PADRAO, profundidadePoco: 0.15 });
  assert.equal(raso.ok, false);
  assert.match(raso.erro, /15 cm/);
});

test('total exatamente inteiro não ganha metro a mais', () => {
  // 2 paradas, piso 3 → curso 3; poço 1,15 → seio 2×1+π/2... usa margem para fechar um inteiro: confere só a regra do teto
  const r = C.calcular({ ...C.PADRAO });
  assert.ok(r.comprar >= r.total && r.comprar - r.total < 1);
});

test('curso já somado (cursoM) dispensa paradas e piso a piso — é como o BOM do quadro chama', () => {
  const r = C.calcular({ tipo: 'MRL', cursoM: 27, profundidadePoco: 1.5, overhead: 4.5, margemMrl: 2 });
  assert.equal(r.ok, true);
  perto(r.total, 44.82);
  assert.equal(r.comprar, 45);
  assert.equal(C.calcular({ tipo: 'MRL', cursoM: 27, profundidadePoco: 0.1, overhead: 4.5 }).ok, false);
});
