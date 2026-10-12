'use strict';
// Testa o fluxo de eventos de salvarDesenhos (src/projeto-elevador-store.js) — #843 A1.
// Chamado por: scripts/run-tests.js (npm test). Banco e storage falsos em memória.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, 'projeto-elevador-store.js'), 'utf8');

function carrega(desenhosExistentes, falhaNoUploadDe) {
  const tabela = desenhosExistentes.slice();
  const eventos = [];
  const consulta = () => {
    let rows = tabela.slice();
    const q = {
      select() { return q; },
      eq(c, v) { rows = rows.filter((r) => String(r[c]) === String(v)); return q; },
      is(c, v) { rows = rows.filter((r) => (v === null ? r[c] == null : r[c] === v)); return q; },
      then(res, rej) { return Promise.resolve({ data: rows, error: null }).then(res, rej); },
    };
    return q;
  };
  const sb = {
    from: () => ({ ...consulta(), insert: ([obj]) => ({ select: () => ({ single: async () => { const n = { id: 'd' + tabela.length, ...obj }; tabela.push(n); return { data: n, error: null }; } }) }) }),
    storage: { from: () => ({ upload: async (p) => ({ error: falhaNoUploadDe && p.includes(falhaNoUploadDe) ? { message: 'falhou' } : null }), getPublicUrl: () => ({ data: { publicUrl: 'https://x/y' } }), remove: async () => ({}) }) },
  };
  const win = { __VP_SB: { sb }, __VP_USER: { email: 'eng@x.test' }, EventosFluxo: { registrar: async (e) => { eventos.push(e.evento); } } };
  vm.runInNewContext(SRC, { window: win, console, crypto: { randomUUID: () => 'abcdef12-0000' } });
  return { store: win.ProjetoElevadorStore, eventos };
}
const arq = (nome) => ({ name: nome, size: 10, type: 'application/pdf' });
const base = { referencia: 'Obra X', numeroCotacao: 955, equipamentos: ['VPEL-EL0955-1'] };

test('1º Projeto de Instalação da cotação emite CRIADO e FINALIZADO', async () => {
  const { store, eventos } = carrega([]);
  await store.salvarDesenhos({ ...base, docs: [{ tipo: 'projeto_instalacao', files: [arq('p.pdf')] }] });
  assert.deepEqual(eventos, ['PROJETO_ELEVADOR_CRIADO', 'PROJETO_ELEVADOR_FINALIZADO']);
});

test('só ID-TAG como 1º documento emite apenas CRIADO', async () => {
  const { store, eventos } = carrega([]);
  await store.salvarDesenhos({ ...base, docs: [{ tipo: 'id_tag', files: [arq('t.pdf')] }] });
  assert.deepEqual(eventos, ['PROJETO_ELEVADOR_CRIADO']);
});

test('Projeto de Instalação depois do ID-TAG emite só FINALIZADO', async () => {
  const { store, eventos } = carrega([{ numero_cotacao: 955, tipo_documento: 'id_tag', excluido_em: null }]);
  await store.salvarDesenhos({ ...base, docs: [{ tipo: 'projeto_instalacao', files: [arq('p.pdf')] }] });
  assert.deepEqual(eventos, ['PROJETO_ELEVADOR_FINALIZADO']);
});

test('novo arquivo quando já existe Projeto de Instalação não repete eventos', async () => {
  const { store, eventos } = carrega([{ numero_cotacao: 955, tipo_documento: 'projeto_instalacao', excluido_em: null }]);
  await store.salvarDesenhos({ ...base, docs: [{ tipo: 'projeto_instalacao', files: [arq('p2.pdf')] }] });
  assert.deepEqual(eventos, []);
});

test('sem Nº de cotação não emite evento', async () => {
  const { store, eventos } = carrega([]);
  await store.salvarDesenhos({ ...base, numeroCotacao: null, docs: [{ tipo: 'projeto_instalacao', files: [arq('p.pdf')] }] });
  assert.deepEqual(eventos, []);
});

test('upload posterior que falha não perde o evento do que já foi salvo (nem suprime na nova tentativa)', async () => {
  const { store, eventos } = carrega([], 'id_tag');
  await assert.rejects(() => store.salvarDesenhos({ ...base, docs: [
    { tipo: 'projeto_instalacao', files: [arq('p.pdf')] }, { tipo: 'id_tag', files: [arq('t.pdf')] },
  ] }), /falhou/);
  assert.deepEqual(eventos, ['PROJETO_ELEVADOR_CRIADO', 'PROJETO_ELEVADOR_FINALIZADO']);
});
