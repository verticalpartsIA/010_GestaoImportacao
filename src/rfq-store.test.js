'use strict';
/* ============================================================
   rfq-store.test.js — issue #707

   _payload() nunca gravava numero_cotacao — nem o formulário (rfq.jsx)
   pedia esse número ao usuário. Consequência real: criar() registra o
   evento RFQ_FRETE_ENVIADO com `numeroCotacao: data.numero_cotacao`
   (gatilhos-engine.js), mas como a coluna nunca era gravada, esse valor
   sempre saía undefined — e onEvento() descarta eventos sem
   numeroCotacao (`if (numeroCotacao == null) return;`), então o nó
   RFQ_FRETE do motor de Prazos & Pendências nunca fechava sozinho.
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./rfq-store.js');
const { _payload } = window.RFQStore;

test('_payload — grava numero_cotacao quando informado', () => {
  const row = _payload({ numero_rfq: 'RFQ-2026-0001', numero_cotacao: '955' });
  assert.equal(row.numero_cotacao, 955);
});

test('_payload — sem Nº de cotação informado, fica null (RFQ sem contexto ainda é permitida)', () => {
  const row = _payload({ numero_rfq: 'RFQ-2026-0001' });
  assert.equal(row.numero_cotacao, null);
});

test('_payload — número já veio como number, não quebra', () => {
  const row = _payload({ numero_rfq: 'RFQ-2026-0001', numero_cotacao: 955 });
  assert.equal(row.numero_cotacao, 955);
});
