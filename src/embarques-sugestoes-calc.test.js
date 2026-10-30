const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'embarques-sugestoes-calc.js'), 'utf8'), ctx);
const S = ctx.window.EmbSugestoesCalc;
const j = (x) => JSON.parse(JSON.stringify(x));

test('modalidade — um incoterm conhecido sugere; misto ou igual ao atual não', () => {
  assert.equal(S.modalidade(['FOB Shanghai'], '').valor, 'FOB');
  assert.equal(S.modalidade(['FOB', 'EXW'], ''), null);
  assert.equal(S.modalidade(['FOB'], 'FOB'), null);
  assert.equal(S.modalidade(['CIF'], ''), null);
});
test('tipoFrete — só com cotação e se ainda não for Marítimo', () => {
  assert.equal(S.tipoFrete([{}], '').valor, 'Marítimo');
  assert.equal(S.tipoFrete([], ''), null);
  assert.equal(S.tipoFrete([{}], 'Marítimo'), null);
});
test('ultimaDataFreeTime — presença + dias; não sobrescreve igual', () => {
  assert.equal(S.ultimaDataFreeTime('2026-11-10', '21', '').valor, '2026-12-01');
  assert.equal(S.ultimaDataFreeTime('2026-11-10', '21', '2026-12-01'), null);
  assert.equal(S.ultimaDataFreeTime('', '21', ''), null);
  assert.equal(S.ultimaDataFreeTime('2026-11-10', '', ''), null);
});
test('transitTimeTotal — ETD até presença de carga', () => {
  assert.equal(S.transitTimeTotal('2026-10-01', '2026-11-10', '').valor, '40');
  assert.equal(S.transitTimeTotal('2026-10-01', '2026-11-10', '40'), null);
  assert.equal(S.transitTimeTotal('2026-11-10', '2026-10-01', ''), null);
});
test('statusEtapa — avança, nunca volta', () => {
  assert.equal(j(S.statusEtapa({ navio: 'X' }, true, 'Pagamento')).valor, 'Embarque');
  assert.equal(S.statusEtapa({ navio: 'X' }, true, 'Desembaraço'), null);
  assert.equal(j(S.statusEtapa({ data_entrega: '2026-12-01' }, false, 'Embarque')).valor, 'Entrega');
  assert.equal(S.statusEtapa({}, false, 'Pagamento'), null);
});
