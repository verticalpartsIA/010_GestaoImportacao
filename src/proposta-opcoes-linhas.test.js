const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function carregar() {
  global.window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, 'proposta-opcoes.js'), 'utf8'))(global.window);
  return global.window.PropostaOpcoes;
}

test('linhasUnitarias: 1 linha por equipamento físico, com o código do ativo', () => {
  const O = carregar();
  const data = {
    ativos: [
      { codigo: 'VPEL-EL0963-1', unidadeId: 'U1', equipamentoIndice: 1 },
      { codigo: 'VPEL-EL0963-2', unidadeId: 'U1', equipamentoIndice: 2 },
      { codigo: 'VPEL-EL0963-3', unidadeId: 'U2', equipamentoIndice: 1 },
    ],
    elevador: { valores: { difal: '1000', itens: [
      { equipamento: 'A', quantidade: '2', valorUnit: '100000', unidadeId: 'U1' },
      { equipamento: 'B', quantidade: '1', valorUnit: '50000', unidadeId: 'U2' },
    ] } },
  };
  const l = O.linhasUnitarias(data);
  assert.deepStrictEqual(l.map((x) => x.equipamento), ['VPEL-EL0963-1', 'VPEL-EL0963-2', 'VPEL-EL0963-3']);
  assert.deepStrictEqual(l.map((x) => x.unit), [100000, 100000, 50000]);
});

test('totaisValores: DIFAL fica separado do total dos equipamentos', () => {
  const O = carregar();
  const t = O.totaisValores({ elevador: { valores: { difal: '1000', itens: [{ equipamento: 'A', quantidade: '3', valorUnit: '1000' }] } } });
  assert.strictEqual(t.totalEq, 3000);
  assert.strictEqual(t.difal, 1000);
  assert.strictEqual(t.totalGeral, 4000);
});

test('item sem códigos físicos (proposta antiga) vira 1 linha agregada, sem inventar numeração', () => {
  const O = carregar();
  const l = O.linhasUnitarias({ elevador: { valores: { itens: [{ equipamento: 'VPEL-EL0963-1', quantidade: '2', valorUnit: '10' }] } } });
  assert.deepStrictEqual(l.map((x) => x.equipamento), ['VPEL-EL0963-1 — 2 un.']);
  assert.strictEqual(l[0].total, 20);
});
