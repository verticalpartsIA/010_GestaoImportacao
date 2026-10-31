'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./decisoes-store.js');

/* Fake encadeável que registra toda escrita (insert/update). A leitura de
   `decisoes_gerenciais` devolve `linhas`; `precificacoes_elevador` vazia =
   margem desconhecida = CEO exigido. */
function fakeSb(linhas) {
  const escritas = [];
  return {
    escritas,
    from(nome) {
      const rows = nome === 'decisoes_gerenciais' ? linhas : [];
      const q = {
        select: () => q, eq: () => q, in: () => q, contains: () => q, order: () => q, limit: () => q,
        insert: (v) => { escritas.push(['insert', nome, v]); return q; },
        update: (v) => { escritas.push(['update', nome, v]); return q; },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        single: async () => ({ data: rows[0] ?? null, error: null }),
        then: (res, rej) => Promise.resolve({ data: rows, error: null }).then(res, rej),
      };
      return q;
    },
  };
}

const cancelada = { id: 'd9', tipo: 'compra_equipamento_ceo', numero_cotacao: 9, status: 'cancelada', motivo: 'Cotação inexistente', contexto: {} };

/* Issue #728: a prévia do formulário de Nova P.I. roda a cada tecla do
   "Nº Cotação" ("951" passa por 9 e 95) — não pode criar nem reabrir nada. */
test('verificarGateCompra somenteLeitura — não reabre decisão cancelada', async () => {
  const sb = fakeSb([cancelada]);
  window.__VP_SB = { sb };
  const r = await window.DecisoesStore.verificarGateCompra(9, { somenteLeitura: true });
  assert.equal(r.ok, false);
  assert.deepEqual(sb.escritas, []);
});

test('verificarGateCompra somenteLeitura — não cria decisão para cotação sem decisão', async () => {
  const sb = fakeSb([]);
  window.__VP_SB = { sb };
  const r = await window.DecisoesStore.verificarGateCompra(95, { somenteLeitura: true });
  assert.equal(r.ok, false);
  assert.deepEqual(sb.escritas, []);
});

test('podeComprarEquipamento somenteLeitura — aprovada libera', async () => {
  window.__VP_SB = { sb: fakeSb([{ ...cancelada, status: 'aprovada' }]) };
  assert.deepEqual(await window.DecisoesStore.podeComprarEquipamento(9, undefined, { somenteLeitura: true }), { ok: true });
});

test('podeComprarEquipamento sem opts — continua reabrindo a decisão cancelada (submit da P.I.)', async () => {
  const sb = fakeSb([cancelada]);
  window.__VP_SB = { sb };
  await window.DecisoesStore.podeComprarEquipamento(9);
  assert.ok(sb.escritas.some(([op, tabela, v]) => op === 'update' && tabela === 'decisoes_gerenciais' && v.status === 'pendente'));
});
