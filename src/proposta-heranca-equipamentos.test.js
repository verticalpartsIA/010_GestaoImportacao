'use strict';
/* Cada equipamento físico é ÚNICO e tem o SEU código (Precificação, mo_lookup) — vale para 1, 2 ou 1.000
   equipamentos: especificações, itens de valores e tabela-resumo falam de cada um pelo código. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = global.window || {};
require('./proposta-heranca.js');
new Function('window', fs.readFileSync(path.join(__dirname, 'proposta-opcoes.js'), 'utf8'))(global.window);
const { montarPrefill } = window.PropostaHeranca;
const O = window.PropostaOpcoes;

function fontes(unidades, moLookup, modelosRs) {
  return {
    encontrado: true, numeroCotacao: 970,
    formulario: {}, cliente: { razao_social: 'X' }, unidades, cotacao: null,
    precificacao: {
      mo_lookup: moLookup, modelos: [],
      resultado_v2: { modelos: modelosRs, precificacao: { precoVendaPorEquipamento: 100 } },
    },
  };
}
const un = (id, ident, qtd, par) => ({ id, identificador: ident, quantidade: qtd, paradas: par, capacidade_kg: 630, modelo: 'GEP' });

test('1 equipamento: 1 item, 1 código, sem DIFAL misturado', () => {
  const p = montarPrefill(fontes([un('U1', 'VPEL-EL0970-1', 1, 4)], [{ unidadeId: 'U1', identificador: 'VPEL-EL0970-1', equipamentoIndice: 1 }], [{ unidadeId: 'U1', valorUnitarioRs: 500 }])).elevador;
  assert.deepEqual(O.resumoEquipamentos(p.especificacoes).map((r) => r.codigo), ['VPEL-EL0970-1']);
});

test('2 Unidades (1 + 3 equipamentos): 4 itens, 1 por código, na ordem -1…-4, cada Unidade com o seu valor', () => {
  const mo = [
    { unidadeId: 'U2', identificador: 'VPEL-EL0970-1', equipamentoIndice: 1 },
    { unidadeId: 'U1', identificador: 'VPEL-EL0970-2', equipamentoIndice: 1 },
    { unidadeId: 'U1', identificador: 'VPEL-EL0970-3', equipamentoIndice: 2 },
    { unidadeId: 'U1', identificador: 'VPEL-EL0970-4', equipamentoIndice: 3 },
  ];
  const p = montarPrefill(fontes([un('U1', 'VPEL-EL0970-1', 3, 8), un('U2', 'VPEL-EL0970-2', 1, 4)], mo,
    [{ unidadeId: 'U1', valorUnitarioRs: 300 }, { unidadeId: 'U2', valorUnitarioRs: 200 }])).elevador;
  const itens = p.valores.itens;
  assert.deepEqual(itens.map((i) => i.equipamento), ['VPEL-EL0970-1', 'VPEL-EL0970-2', 'VPEL-EL0970-3', 'VPEL-EL0970-4']);
  assert.deepEqual(itens.map((i) => i.valorUnit), ['200,00', '300,00', '300,00', '300,00']);
  assert.ok(itens.every((i) => i.quantidade === '1'));
  assert.deepEqual(O.resumoEquipamentos(p.especificacoes).map((r) => r.codigo), ['VPEL-EL0970-1', 'VPEL-EL0970-2', 'VPEL-EL0970-3', 'VPEL-EL0970-4']);
});

test('1.000 equipamentos de uma Unidade: 1.000 itens, códigos -1…-1000 sem repetir', () => {
  const mo = Array.from({ length: 1000 }, (_, k) => ({ unidadeId: 'U1', identificador: `VPEL-EL0970-${k + 1}`, equipamentoIndice: k + 1 }));
  const p = montarPrefill(fontes([un('U1', 'VPEL-EL0970-1', 1000, 4)], mo, [{ unidadeId: 'U1', valorUnitarioRs: 10 }])).elevador;
  assert.equal(p.valores.itens.length, 1000);
  assert.equal(new Set(p.valores.itens.map((i) => i.equipamento)).size, 1000);
  assert.equal(p.valores.itens[999].equipamento, 'VPEL-EL0970-1000');
});

test('paradasDe: 09/09/09 vira 9; texto livre fica como veio', () => {
  assert.equal(O.paradasDe('09/09/09'), '9');
  assert.equal(O.paradasDe('18 Paradas (-1, 0, 1 a 16)'), '18 Paradas (-1, 0, 1 a 16)');
});

/* 26/11/2026 — VPPR-1009-A (Formulário misto) e VPPR-1011-A (unidade nunca cotada): só entra na proposta de elevador
   o que a Precificação precificou; nada recebe o preço médio por falta de preço próprio. */
test('Formulário misto: escada e esteira não entram na proposta de elevador (VPPR-1009-A)', () => {
  const unidades = [
    { ...un('EL1', 'VPEL-EL1009-1', 1, 4), tipo_equipamento: 'elevador' },
    { ...un('ER1', 'VPER-ER1009-3', 2, 0), tipo_equipamento: 'escada' },
    { ...un('ES1', 'E5', 4, 0), tipo_equipamento: 'esteira' },
  ];
  const p = montarPrefill(fontes(unidades, [{ unidadeId: 'EL1', identificador: 'VPEL-EL1009-1', equipamentoIndice: 1 }],
    [{ unidadeId: 'EL1', valorUnitarioRs: 217501.04 }])).elevador;
  assert.deepEqual(p.especificacoes.map((e) => e.unidadeId), ['EL1']);
  assert.equal(p.valores.quantidade, '1');
  assert.ok(!p.valores.itens || p.valores.itens.every((i) => i.unidadeId === 'EL1'));
});

test('unidade de elevador que a Precificação não tem fica fora, sem preço médio (VPPR-1011-A)', () => {
  const unidades = [un('U1', 'VPEL-EL1011-1', 2, 4), un('U2', 'E2', 3, 4)];
  const mo = [{ unidadeId: 'U1', identificador: 'VPEL-EL1011-1', equipamentoIndice: 1 }, { unidadeId: 'U1', identificador: 'VPEL-EL1011-2', equipamentoIndice: 2 }];
  const p = montarPrefill(fontes(unidades, mo, [{ unidadeId: 'U1', valorUnitarioRs: 388595.44 }])).elevador;
  assert.deepEqual(p.valores.itens.map((i) => i.equipamento), ['VPEL-EL1011-1', 'VPEL-EL1011-2']);
  const total = p.valores.itens.reduce((s, i) => s + O._num(i.valorUnit) * Number(i.quantidade), 0);
  assert.equal(Math.round(total * 100) / 100, 777190.88);
});

test('sem unidade identificada na Precificação: ficam só os elevadores', () => {
  const unidades = [{ ...un('EL1', 'VPEL-EL0900-1', 1, 4), tipo_equipamento: 'elevador' }, { ...un('ER1', 'VPER-ER0900-2', 1, 0), tipo_equipamento: 'escada' }];
  const p = montarPrefill(fontes(unidades, [], [])).elevador;
  assert.deepEqual(p.especificacoes.map((e) => e.unidadeId), ['EL1']);
});
