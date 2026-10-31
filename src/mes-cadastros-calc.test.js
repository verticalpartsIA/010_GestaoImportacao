'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./mes-cadastros-calc.js');
const C = window.MesCadastrosCalc;

test('validarFrente exige nome e código em minúsculas sem acento', () => {
  assert.deepEqual(C.validarFrente({ codigo: 'quadro', nome: 'Quadro de Comando' }), []);
  assert.equal(C.validarFrente({ codigo: '', nome: '' }).length, 2);
  assert.equal(C.validarFrente({ codigo: 'Fiação', nome: 'x' }).length, 1);
});

test('jornada 08:00–17:00 com 1 h de intervalo dá 8 horas úteis', () => {
  const j = { inicio: '08:00', fim: '17:00', intervalo_min: 60, dias_semana: [1, 2, 3, 4, 5] };
  assert.equal(C.horasUteisDia(j), 8);
  assert.deepEqual(C.validarJornada(j), []);
  assert.equal(C.horasUteisDia({ ...j, intervalo_min: 0 }), 9);
  assert.equal(C.horasUteisDia({ ...j, inicio: '08:00:00', fim: '12:30:00', intervalo_min: 30 }), 4);
});

test('validarJornada barra fim antes do início, intervalo absurdo e sem dias', () => {
  const ok = { inicio: '08:00', fim: '17:00', intervalo_min: 60, dias_semana: [1] };
  assert.equal(C.validarJornada({ ...ok, fim: '07:00' }).length > 0, true);
  assert.equal(C.validarJornada({ ...ok, intervalo_min: -5 }).length, 1);
  assert.equal(C.validarJornada({ ...ok, intervalo_min: 600 }).length, 1);
  assert.equal(C.validarJornada({ ...ok, dias_semana: [] }).length, 1);
  assert.equal(C.validarJornada({ ...ok, inicio: '' }).length > 0, true);
  assert.equal(C.horasUteisDia({ ...ok, fim: '07:00' }), 0);
});

test('resumoDias lista na ordem seg→dom', () => {
  assert.equal(C.resumoDias([1, 2, 3, 4, 5]), 'Seg, Ter, Qua, Qui, Sex');
  assert.equal(C.resumoDias([0, 6]), 'Sáb, Dom');
  assert.equal(C.resumoDias([]), '—');
});

test('validarEtapa e validarPosto', () => {
  assert.deepEqual(C.validarEtapa({ nome: 'Montagem', tipo: 'producao', operadores: 2 }), []);
  assert.equal(C.validarEtapa({ nome: '', tipo: 'x', operadores: 0 }).length, 3);
  assert.equal(C.validarEtapa({ nome: 'a', tipo: 'inspecao', operadores: 1.5 }).length, 1);
  assert.deepEqual(C.validarPosto({ codigo: 'BQ-01', nome: 'Bancada 1', tipo: 'mao_de_obra', frente_codigo: 'quadro' }), []);
  assert.equal(C.validarPosto({ codigo: '', nome: '', tipo: 'outro', frente_codigo: '' }).length, 4);
});
