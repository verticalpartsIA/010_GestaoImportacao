'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Carrega o store de verdade num window simulado e conta quantas vezes 'vpprd:user' é disparado.
function montar(usuario, avatar) {
  const ouvintes = {}; let disparos = 0; let consultas = 0;
  const query = (dados) => { const q = { select: () => q, eq: () => q, maybeSingle: async () => { consultas++; return { data: dados }; }, then: (f) => f({ data: [] }) }; return q; };
  const window = {
    __VP_USER: usuario,
    __VP_SB: { sb: { from: (t) => (t === 'colaboradores_vpsistema' ? query({ id: usuario.id, avatar_url: avatar, departamento: 'X' }) : query(null)) } },
    addEventListener: (n, f) => { (ouvintes[n] = ouvintes[n] || []).push(f); },
    dispatchEvent: (ev) => { disparos++; (ouvintes[ev.type] || []).forEach((f) => f(ev)); return true; },
  };
  const ctx = { window, sessionStorage: { setItem() {} }, CustomEvent: class { constructor(type, i) { this.type = type; this.detail = i && i.detail; } }, console, setTimeout };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'colaboradores-admin-store.js'), 'utf8'), ctx);
  return { window, contagem: () => ({ disparos, consultas }) };
}
const espera = () => new Promise((r) => setTimeout(r, 50));

test('usuário SEM foto: o evento vpprd:user não entra em loop (1 consulta, 1 disparo)', async () => {
  const m = montar({ id: 'u1', email: 'a@x.com' }, null);
  await espera();
  assert.deepEqual(m.contagem(), { disparos: 1, consultas: 1 });
});

test('usuário COM foto: continua enriquecendo uma vez só', async () => {
  const m = montar({ id: 'u2', email: 'b@x.com' }, 'https://f/x.png');
  await espera();
  assert.deepEqual(m.contagem(), { disparos: 1, consultas: 1 });
  assert.equal(m.window.__VP_USER.avatarUrl, 'https://f/x.png');
});
