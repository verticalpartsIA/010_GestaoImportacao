'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
const F = require('./fiacao-quadro-engine.js');

const cfg = {
  bitolaBase: 6,
  bitolaGrossaPorVariante: { '30_380': 10, '7.5_220': 10, '15_380': 6 },
  fios: [{ cor: 'PT', bitola: 0.75, codigo: 'VPMP-057' }, { cor: 'PT', bitola: 6, codigo: 'VPMP-263' }, { cor: 'PT', bitola: 10, codigo: 'VPMP-702' }, { cor: 'VD+AM', bitola: 6, codigo: 'VPMP-884' }, { cor: 'VD+AM', bitola: 10, codigo: 'VPMP-886' }, { cor: 'VD+AM', bitola: 0.75, codigo: 'VPMP-883' }],
  terminais: [{ tipo: 'Tubular', bitola: 0.75, codigo: 'VPMP-084' }, { tipo: 'Tubular', bitola: 6, codigo: 'VPMP-393' }, { tipo: 'Tubular', bitola: 10, codigo: 'VPMP-663' }, { tipo: 'Tubular duplo', bitola: 0.75, codigo: 'VPMP-390' }, { tipo: 'Mini fit', codigo: 'VPMP-795' }],
  conectores: [{ nome: 'KY9', vias: 4, codigo: 'VPMP-797' }],
};
const fio = (o, d, cor, b, cm) => ({ origem: o, destino: d, cor, bitola: b, comprimentoCm: cm });
const T = (tipo, borne) => ({ tipo, borne: borne || '1' });

test('soma metros por cor+bitola e conta pontas', () => {
  const r = F.calcular([fio(T('Tubular'), T('Tubular'), 'PT', 0.75, 16), fio(T('Tubular'), T('Mini fit', 'KY9/4'), 'PT', 0.75, 112)], '30_380', cfg);
  assert.equal(r.ok, true);
  const f = r.itens.find(i => i.tipo === 'fio');
  assert.equal(f.quantidade, 1.28); assert.equal(f.codigo, 'VPMP-057');
  assert.equal(r.itens.find(i => i.tipoTerminal === 'tubular').quantidade, 3);
  assert.equal(r.itens.find(i => i.tipoTerminal === 'minifit').quantidade, 1);
});

test('terminal duplo: 1 peça para 2 pontas (arredonda para cima)', () => {
  const r = F.calcular([fio(T('Tubular duplo'), T('Tubular duplo'), 'PT', 0.75, 10), fio(T('Tubular duplo'), T('Tubular'), 'PT', 0.75, 10)], '30_380', cfg);
  const d = r.itens.find(i => i.tipoTerminal === 'tubular_duplo');
  assert.equal(d.pontas, 3); assert.equal(d.quantidade, 2);
});

test('bitola grossa muda com a variante; a fina não', () => {
  const lista = [fio(T('Tubular'), T('Tubular'), 'PT', 6, 100), fio(T('Tubular'), T('Tubular'), 'PT', 0.75, 100)];
  const a = F.calcular(lista, '30_380', cfg), b = F.calcular(lista, '15_380', cfg);
  assert.deepEqual(a.itens.filter(i => i.tipo === 'fio').map(i => i.bitola), [0.75, 10]);
  assert.deepEqual(b.itens.filter(i => i.tipo === 'fio').map(i => i.bitola), [0.75, 6]);
  assert.equal(a.itens.find(i => i.tipoTerminal === 'tubular' && i.bitola === 10).codigo, 'VPMP-663');
});

test('variante sem bitola grossa: não aplica a lista', () => {
  const r = F.calcular([fio(T('Tubular'), T('Tubular'), 'PT', 6, 100)], '7.5_380', cfg);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /7\.5_380/);
});

test('1 conector por conector distinto (borne KY9/4 e KY9/2 = KY9)', () => {
  const r = F.calcular([fio(T('Tubular'), T('Mini fit', 'KY9/4'), 'PT', 0.75, 10), fio(T('Tubular'), T('Mini fit', 'KY9/2'), 'PT', 0.75, 10), fio(T('Tubular'), T('Mini fit', 'KY2/1'), 'PT', 0.75, 10)], '30_380', cfg);
  const c = r.itens.filter(i => i.tipo === 'conector');
  assert.equal(c.length, 2);
  assert.equal(c.find(i => i.nome === 'KY9').codigo, 'VPMP-797');
  assert.ok(r.avisos.some(a => /KY2/.test(a)));
});

test('a lista manda: remove do Omie os códigos que cobre e soma os novos', () => {
  const r = F.calcular([fio(T('Tubular'), T('Tubular'), 'PT', 0.75, 100)], '30_380', cfg);
  const { materiais, aplicado } = F.aplicarAosMateriais([{ codigo: 'VPMP-057', quantidade_unit: 99 }, { codigo: 'VPMP-999', quantidade_unit: 1 }], r);
  assert.equal(aplicado, true);
  assert.equal(materiais.find(m => m.codigo === 'VPMP-057').necessario, 1);
  assert.ok(materiais.find(m => m.codigo === 'VPMP-999'));
});

test('lista não aplicada mantém os materiais como estão', () => {
  const m = [{ codigo: 'X' }];
  assert.equal(F.aplicarAosMateriais(m, { ok: false }).materiais, m);
});

test('planilha real: 125 fios, 70,04 m de 0,75, 65 pontas Mini-Fit, 18 conectores', () => {
  let rows; try { rows = require('fs').readFileSync(process.env.FIOS_JSON || '/nonexistent', 'utf8'); } catch (e) { return; }
  const L = JSON.parse(rows).slice(2).filter(r => r.J).map(r => fio({ tipo: r.E, borne: r.D }, { tipo: r.H, borne: r.G }, r.I, r.J, r.K));
  const r = F.calcular(L, '15_380', cfg);
  assert.equal(r.totais.fios, 125);
  assert.equal(r.totais.conectores, 18);
  assert.equal(r.itens.find(i => i.tipoTerminal === 'minifit').quantidade, 65);
  const fino = r.itens.filter(i => i.tipo === 'fio' && i.bitola === 0.75).reduce((s, i) => s + i.quantidade, 0);
  assert.equal(Math.round(fino * 100) / 100, 70.04);
});
