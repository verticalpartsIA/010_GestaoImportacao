'use strict';
/* ============================================================
   ims-store.test.js — issue #707

   Mesmo bug do rfq-store.js: _payload() nunca gravava numero_cotacao
   (só existe o campo livre "Projeto", sem número estruturado). criar()
   registra o evento IMS_CONTRATADO com `numeroCotacao: data.numero_cotacao`
   sempre undefined — o nó IMS_CONTRATADO/EQUIPAMENTO_RECEBIDO
   (gatilhos-engine.js) nunca fechava sozinho.
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./ims-store.js');
const { _payload } = window.IMSStore;

test('_payload — grava numero_cotacao quando informado', () => {
  const row = _payload({ solicitante: 'Fulano', projeto: 'Obra X', numero_cotacao: '955' });
  assert.equal(row.numero_cotacao, 955);
});

test('_payload — sem Nº de cotação informado, fica null (IMS avulso continua permitido)', () => {
  const row = _payload({ solicitante: 'Fulano', projeto: 'Obra X' });
  assert.equal(row.numero_cotacao, null);
});
