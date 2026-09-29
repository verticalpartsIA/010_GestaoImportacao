'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./contrato-instalador-engine.js');
require('./contrato-instalador-store.js');

function fakeSb(numeros) {
  return { from() { return { select() { return { ilike: async (_c, pat) => ({ data: numeros.filter((n) => n.startsWith(pat.replace('%', ''))).map((n) => ({ numero_documento: n })), error: null }) }; } }; } };
}

test('reservarNumero — usa a base se livre, senão -2, -3', async () => {
  window.__VP_SB = { sb: fakeSb([]) };
  assert.equal(await window.CIStore.reservarNumero('VPNI-0955'), 'VPNI-0955');
  window.__VP_SB = { sb: fakeSb(['VPNI-0955']) };
  assert.equal(await window.CIStore.reservarNumero('VPNI-0955'), 'VPNI-0955-2');
  window.__VP_SB = { sb: fakeSb(['VPNI-0955', 'VPNI-0955-2', 'VPNI-0956']) };
  assert.equal(await window.CIStore.reservarNumero('VPNI-0955'), 'VPNI-0955-3');
});
