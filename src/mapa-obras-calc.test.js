'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./mapa-obras-calc.js');
const M = window.MapaObrasCalc;

test('classificar: concluída, em andamento e aguardando equipamentos', () => {
  assert.equal(M.classificar({ status_master: 'Entregue' }), 'concluida');
  assert.equal(M.classificar({ status_master: 'DataBook' }), 'concluida');
  assert.equal(M.classificar({ status_master: 'Manutenção preventiva' }), 'concluida');
  assert.equal(M.classificar({ status_master: 'Instalação' }), 'andamento');
  assert.equal(M.classificar({ status_master: 'Importação' }), 'aguardando');
  assert.equal(M.classificar({ status_master: 'Contrato assinado' }), 'aguardando');
  assert.equal(M.classificar({ status_master: 'Homologação instalador', equipamento_entregue: true }), 'andamento');
});

test('classificar: fases antes do contrato ficam fora do mapa', () => {
  assert.equal(M.classificar({ status_master: 'Análise técnica' }), null);
  assert.equal(M.classificar({ status_master: 'Dossier criado' }), null);
  assert.equal(M.classificar({}), null);
});

test('chaveCidade ignora acento, maiúscula e espaço sobrando', () => {
  assert.equal(M.chaveCidade('Santo André ', 'SP'), M.chaveCidade('santo andre', 'sp'));
  assert.equal(M.chaveCidade('', 'SP'), null);
});

test('espalhar: 1 obra fica no centro; várias ficam em pontos diferentes perto do centro', () => {
  const c = { lat: -23.55, lon: -46.63 };
  assert.deepEqual(M.espalhar(c, 0, 1), [c.lat, c.lon]);
  const pts = [0, 1, 2, 3].map((i) => M.espalhar(c, i, 4));
  assert.equal(new Set(pts.map((p) => p.join(','))).size, 4);
  pts.forEach((p) => { assert.ok(Math.abs(p[0] - c.lat) < 0.05 && Math.abs(p[1] - c.lon) < 0.05); });
  assert.equal(M.espalhar(null, 0, 1), null);
});
