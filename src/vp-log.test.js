'use strict';
// Testa src/vp-log.js — o erro de gravação do PostgREST não pode passar em silêncio (#843 A5).
// Chamado por: scripts/run-tests.js (npm test). Banco falso em memória.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, 'vp-log.js'), 'utf8');

function carrega(erro) {
  const avisos = []; const inseridos = [];
  const win = { __VP_SB: { sb: { from: () => ({ insert: async (linha) => { inseridos.push(linha); return { error: erro || null }; } }) } }, __VP_USER: { nome: 'Fulano', email: 'f@x.test' } };
  const ctx = { window: win, console: { warn: (...a) => avisos.push(a.join(' ')) }, localStorage: { getItem: () => null }, sessionStorage: { getItem: () => null } };
  vm.runInNewContext(SRC, ctx);
  return { VPLog: win.VPLog, avisos, inseridos };
}

test('registrar grava o log e não avisa quando o banco aceita', async () => {
  const { VPLog, avisos, inseridos } = carrega(null);
  await VPLog.registrar({ modulo: 'Teste', acao: 'Fez algo', alvo: 'X' });
  assert.equal(inseridos.length, 1);
  assert.equal(avisos.length, 0);
});

test('registrar avisa (sem lançar) quando o banco recusa a gravação', async () => {
  const { VPLog, avisos } = carrega({ message: 'new row violates row-level security policy' });
  await assert.doesNotReject(() => VPLog.registrar({ modulo: 'Teste', acao: 'Fez algo' }));
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /row-level security/);
});
