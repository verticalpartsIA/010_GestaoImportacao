'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./contrato-venda-engine.js');
require('./contrato-venda-store.js');

test('proximoNumeroLivre — 2º contrato da mesma cotação vira VPCV-0955-2', () => {
  const { proximoNumeroLivre } = window.CVStore;
  assert.equal(proximoNumeroLivre('VPCV-0955', []), 'VPCV-0955');
  assert.equal(proximoNumeroLivre('VPCV-0955', ['VPCV-0955']), 'VPCV-0955-2');
  assert.equal(proximoNumeroLivre('VPCV-0955', ['VPCV-0955', 'VPCV-0955-2']), 'VPCV-0955-3');
  assert.equal(proximoNumeroLivre('VPCV-0955', ['VPCV-09551']), 'VPCV-0955');
});
