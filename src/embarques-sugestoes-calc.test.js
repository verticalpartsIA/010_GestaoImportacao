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

test('ajusteEtaPorRolagem - soma os dias da rolagem ao ETA', () => {
  assert.deepEqual(j(S.ajusteEtaPorRolagem('2026-10-01', '2026-10-08', '2026-11-20')), { dias: 7, de: '2026-11-20', para: '2026-11-27' });
  assert.equal(S.ajusteEtaPorRolagem('2026-10-01', '2026-10-01', '2026-11-20'), null);
  assert.equal(S.ajusteEtaPorRolagem('2026-10-01', '2026-10-08', ''), null);
});
test('containersDiff/reconciliar - compara por tipo e preserva o preenchido', () => {
  const atual = [{ tipo_tamanho: "40'HC", numero: 'A1' }, { tipo_tamanho: "40'HC", numero: 'A2' }];
  assert.equal(S.containersDiff(atual, [{ tipo_tamanho: "40'HC", quantidade: 2 }]), null);
  const d = j(S.containersDiff(atual, [{ tipo_tamanho: "40'HC", quantidade: 1 }]));
  assert.equal(d.atual, "2x 40'HC"); assert.equal(d.cotacao, "1x 40'HC");
  const r = j(S.reconciliarContainers(atual, { "40'HC": 1, "20'DV": 1 }, { numero: '' }));
  assert.equal(r.lista.length, 2); assert.equal(r.lista[0].numero, 'A1'); assert.equal(r.lista[1].tipo_tamanho, "20'DV");
  assert.equal(r.removidos.length, 1); assert.equal(r.removidos[0].numero, 'A2');
  assert.equal(S.containersDiff(atual, []), null);
});
test('numerario e faturamento sugeridos', () => {
  assert.equal(S.numerarioSugerido('1500', '').valor, '1500');
  assert.equal(S.numerarioSugerido('1500', '1500'), null);
  assert.equal(S.numerarioSugerido('', ''), null);
  assert.equal(S.faturamentoFrete({ moeda_frete: 'BRL', cotacao_frete: 800 }, '').valor, '800');
  assert.equal(S.faturamentoFrete({ moeda_frete: 'USD', cotacao_frete: 800 }, ''), null);
});
