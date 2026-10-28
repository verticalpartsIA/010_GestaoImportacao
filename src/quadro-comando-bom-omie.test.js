const test = require('node:test');
const assert = require('node:assert');
global.window = {};
require('./quadro-comando-bom-engine.js');
const E = window.QuadroComandoBomEngine;

test('chaveVarianteQuadro aceita 30 kW e rejeita combinação desconhecida', () => {
  assert.strictEqual(E.chaveVarianteQuadro(30, 380), '30_380');
  assert.strictEqual(E.chaveVarianteQuadro(7.5, 220), '7.5_220');
  assert.strictEqual(E.chaveVarianteQuadro(22, 380), null);
  assert.strictEqual(E.chaveVarianteQuadro(null, 380), null);
});

test('montarBomDaEstrutura soma repetidos, usa descrição do Omie e separa a caixa', () => {
  const linhas = [
    { codigo_filho: 'VPMP-842', quantidade: 1 }, { codigo_filho: 'VPMP-057', quantidade: 70 },
    { codigo_filho: 'VPMP-057', quantidade: 7 }, { codigo_filho: 'VPMP-918', quantidade: 0.24 },
    { codigo_filho: 'VPMP-999', quantidade: 0 },
  ];
  const prod = {
    'VPMP-842': { descricao: 'Caixa para QC Tampa - 1 - Ref.: VerticalParts (A)', unidade: 'PC' },
    'VPMP-057': { descricao: 'CABO FLEXIVEL 750V - 0,75MM - PRETO', unidade: 'M' },
    'VPMP-918': { descricao: 'Gaxeta Flexform', unidade: 'MT' },
  };
  const r = E.montarBomDaEstrutura(linhas, prod, {}, 'VPEL-710a');
  assert.strictEqual(r.length, 3);
  const por = Object.fromEntries(r.map((i) => [i.sku, i]));
  assert.strictEqual(por['VPMP-057'].quantidade, 77);
  assert.strictEqual(por['VPMP-057'].unidade, 'm');
  assert.strictEqual(por['VPMP-842'].grupo_separacao, 'caixa');
  assert.strictEqual(por['VPMP-918'].quantidade, 0.24);
  assert.strictEqual(por['VPMP-918'].grupo_separacao, 'componentes');
  assert.ok(r.every((i) => i.origem === 'fixo_variante' && i.confianca === 'confirmado'));
});
