const test = require('node:test');
const assert = require('node:assert');
global.window = {};
require('./instalador-acordos-store.js');
const S = window.InstaladorAcordosStore;

test('moedaParaNumero entende formatos BR e número', () => {
  assert.strictEqual(S.moedaParaNumero('18.000,50'), 18000.5);
  assert.strictEqual(S.moedaParaNumero(18000), 18000);
  assert.strictEqual(S.moedaParaNumero(''), 0);
});

test('validar exige dossiê, instalador, valor > 0 e parcelas 1–12', () => {
  assert.strictEqual(S.validar({ dossier_id: 'DOS-M013', parceiro_instalador_id: 'MNT-1', valor_combinado: '18000,00', parcelas_qtd: 2 }).length, 0);
  assert.strictEqual(S.validar({}).length, 4);
  assert.ok(S.validar({ dossier_id: 'D', parceiro_instalador_id: 'M', valor_combinado: 0, parcelas_qtd: 2 }).length === 1);
  assert.ok(S.validar({ dossier_id: 'D', parceiro_instalador_id: 'M', valor_combinado: 10, parcelas_qtd: 13 }).length === 1);
});
