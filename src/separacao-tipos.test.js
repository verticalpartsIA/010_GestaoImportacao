'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./separacao-tipos.js');
const T = window.SeparacaoTipos;

test('tipos conhecidos e rótulos', () => {
  assert.deepEqual(Object.keys(T.TIPOS).sort(), ['cabo_aco', 'cabo_aco_porta', 'cabo_manobra', 'cabo_modular', 'corrimao']);
  assert.equal(T.rotulo('cabo_manobra'), 'Cabo de manobra');
  assert.equal(T.rotulo('xyz'), '—');
});

test('só cabo de aço e cabo de manobra passam por corte no Almoxarifado', () => {
  assert.equal(T.TIPOS.cabo_aco.corte, true);
  assert.equal(T.TIPOS.cabo_manobra.corte, true);
  assert.equal(T.TIPOS.cabo_modular.corte, false);
  assert.equal(T.TIPOS.cabo_aco_porta.corte, false);
  assert.equal(T.TIPOS.corrimao.corte, false);
});

test('índice por código ignora maiúsculas, espaços e inativos', () => {
  const idx = T.indice([
    { codigo: 'vpel-529n ', tipo: 'cabo_manobra', ativo: true },
    { codigo: 'VPB-097', tipo: 'cabo_modular', ativo: true },
    { codigo: 'VPEL-999', tipo: 'cabo_aco', ativo: false },
  ]);
  assert.equal(T.tipoDoCodigo(idx, 'VPEL-529N'), 'cabo_manobra');
  assert.equal(T.tipoDoCodigo(idx, ' vpb-097'), 'cabo_modular');
  assert.equal(T.tipoDoCodigo(idx, 'VPEL-999'), null);
  assert.equal(T.tipoDoCodigo(idx, ''), null);
  assert.equal(T.tipoDoCodigo(idx, null), null);
});

test('sugerirTipo pela descrição (modular antes de manobra/comando)', () => {
  assert.equal(T.sugerirTipo('Cabo de Aço de Elevador 8*19S+FC 13MM (1/2 pol)'), 'cabo_aco');
  assert.equal(T.sugerirTipo('Cabo Elétrico Modular para Conexão entre o Quadro de Comando e o Display'), 'cabo_modular');
  assert.equal(T.sugerirTipo('Cabo de Comando Elétrico com 24 Vias para Elevador'), 'cabo_manobra');
  assert.equal(T.sugerirTipo('Cabo de Manobra 9 Linhas 0,75mm² 750V'), 'cabo_manobra');
  assert.equal(T.sugerirTipo('Corrimão de Escada Rolante - VPP1879'), 'corrimao');
  assert.equal(T.sugerirTipo('Parafuso M8'), null);
});

test('peças que só citam cabo/corrimão não são suspeitas', () => {
  assert.equal(T.ehSuspeito('Cabo de Aço de Elevador 8*19S+FC 9,5MM'), true);
  assert.equal(T.ehSuspeito('Corrimão de Borracha - VP1379'), true);
  assert.equal(T.ehSuspeito('Polia Tensora do Cabo do Limitador de Velocidade'), false);
  assert.equal(T.ehSuspeito('Tirante para Cabo de Aço 8mm Completo'), false);
  assert.equal(T.ehSuspeito('Rolete do Corrimão (75 x 35mm)'), false);
  assert.equal(T.ehSuspeito('Protetor de Entrada do Corrimão'), false);
  assert.equal(T.ehSuspeito('Corrente de Pressão do Corrimão (6 Roletes)'), false);
  assert.equal(T.ehSuspeito('CABO FLEXÍVEL 750V - 2,5MM - PRETO'), false);
  assert.equal(T.ehSuspeito('Parafuso'), false);
  assert.equal(T.ehSuspeito(null), false);
});

test('sugestões: itens suspeitos fora da lista, sem repetir código', () => {
  const idx = T.indice([{ codigo: 'VPB-097', tipo: 'cabo_modular', ativo: true }]);
  const itens = [
    { codigo: 'VPB-097', descricao: 'Cabo Elétrico Modular X' },
    { codigo: 'vpel-300', descricao: 'Cabo de Aço de Elevador 10MM' },
    { codigo: 'VPEL-300', descricao: 'Cabo de Aço de Elevador 10MM' },
    { codigo: 'VPEL-235', descricao: 'Tirante para Cabo de Aço 8mm' },
    { codigo: 'VPER-1', descricao: 'Parafuso' },
  ];
  const s = T.sugestoes(itens, idx);
  assert.deepEqual(s.map((x) => [x.codigo, x.tipo_sugerido]), [['VPEL-300', 'cabo_aco']]);
});
