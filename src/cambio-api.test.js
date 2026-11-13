'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./cambio-api.js');
const C = window.CambioAPI;

function fetchFalso(corpo, { ok = true } = {}) {
  const chamadas = [];
  global.fetch = async (url) => { chamadas.push(url); return { ok, json: async () => corpo }; };
  return chamadas;
}

test('PTAX de COMPRA do Banco Central (não a de venda, não o dólar comercial da AwesomeAPI) — 13/11/2026', async () => {
  const ch = fetchFalso({ value: [{ cotacaoCompra: 5.6512, cotacaoVenda: 5.6518, dataHoraCotacao: '2026-11-13 13:03:27.375047' }] });
  const r = await C.buscarUsdBrlHistorico(new Date(2026, 10, 13));
  assert.equal(r.valor, 5.6512);
  assert.equal(r.timestamp, '2026-11-13 13:03:27.375047');
  assert.match(ch[0], /olinda\.bcb\.gov\.br/);
  assert.match(ch[0], /@df='11-13-2026'/);
  assert.match(ch[0], /\$top=1/);
});

test('sem PTAX divulgada ou serviço com erro: lança erro explícito (nunca devolve zero em silêncio)', async () => {
  fetchFalso({ value: [] });
  await assert.rejects(() => C.buscarUsdBrlHistorico(new Date(2026, 10, 14)), /sem PTAX divulgada/);
  fetchFalso({}, { ok: false });
  await assert.rejects(() => C.buscarUsdBrlHistorico(new Date(2026, 10, 14)), /Banco Central retornou erro/);
  await assert.rejects(() => C.buscarUsdBrlHistorico('lixo'), /Data inválida/);
});
