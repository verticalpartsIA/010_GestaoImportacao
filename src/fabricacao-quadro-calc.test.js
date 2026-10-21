'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./fabricacao-quadro-calc.js');

test('resumoProgresso: ponderado, 100% só com tudo flegado', () => {
  const rows = (pesos, flegados) => pesos.map((peso, i) => ({ item_id: 'i' + i, flegado: flegados[i], fabricacao_quadro_itens: { ordem: i + 1, peso } }));
  assert.equal(window.FabricacaoQuadroCalc.resumoProgresso(rows([17,17,17,17,16,16], [true,true,false,false,false,false])).pct, 34);
  // Nota de implementação: o brief original deste teste trazia `99` aqui. Com pesos
  // [17,17,17,17,16,16] (soma 100) e só o último item (peso 16) em aberto, a soma
  // ponderada dos itens flegados é 17+17+17+17+16 = 84 — matematicamente, excluir
  // qualquer item único desta lista nunca ultrapassa 100 - min(pesos) = 84, então
  // `99` é inatingível pelo algoritmo ponderado real (acompanhamento-obra-store.js:
  // resumoProgresso) que este módulo replica fielmente. Corrigido para 84, mantendo
  // o espírito do comentário original: falta 1 item, teto abaixo de 100, nunca 100.
  assert.equal(window.FabricacaoQuadroCalc.resumoProgresso(rows([17,17,17,17,16,16], [true,true,true,true,true,false])).pct, 84); // falta 1 item: nunca 100 (ver nota acima sobre o valor corrigido de 99 para 84)
  assert.equal(window.FabricacaoQuadroCalc.resumoProgresso(rows([17,17,17,17,16,16], [true,true,true,true,true,true])).pct, 100);
});

test('resumoProgresso: sem linhas devolve 0', () => {
  assert.equal(window.FabricacaoQuadroCalc.resumoProgresso([]).pct, 0);
});

test('etapaAtualId: primeiro item não flegado, por ordem (não por posição no array)', () => {
  const rows = [
    { item_id: 'c', flegado: false, fabricacao_quadro_itens: { ordem: 3, peso: 17 } },
    { item_id: 'a', flegado: true, fabricacao_quadro_itens: { ordem: 1, peso: 17 } },
    { item_id: 'b', flegado: false, fabricacao_quadro_itens: { ordem: 2, peso: 17 } },
  ];
  assert.equal(window.FabricacaoQuadroCalc.etapaAtualId(rows), 'b');
});

test('etapaAtualId: tudo flegado devolve null', () => {
  const rows = [{ item_id: 'a', flegado: true, fabricacao_quadro_itens: { ordem: 1, peso: 100 } }];
  assert.equal(window.FabricacaoQuadroCalc.etapaAtualId(rows), null);
});

// Review Focus: rework — progresso de uma OP não vaza pra outra (cada chamada só recebe as linhas da própria ordem_id; teste confirma que a função não agrega nada global).
test('resumoProgresso: 2 OPs do mesmo quadro, chamadas separadas, não se misturam', () => {
  const rowsOpA = [{ item_id: 'a1', flegado: true, fabricacao_quadro_itens: { ordem: 1, peso: 17 } }];
  const rowsOpB = [{ item_id: 'b1', flegado: false, fabricacao_quadro_itens: { ordem: 1, peso: 17 } }];
  assert.equal(window.FabricacaoQuadroCalc.resumoProgresso(rowsOpA).pct, 17);
  assert.equal(window.FabricacaoQuadroCalc.resumoProgresso(rowsOpB).pct, 0);
});

// Review Focus: despausar quando a ocorrência bloqueante resolve, mesmo com outra ocorrência aberta "com frente de trabalho".
test('estaPausado: só true quando existe ABERTA com tem_frente_trabalho=false', () => {
  assert.equal(window.FabricacaoQuadroCalc.estaPausado([
    { status: 'aberta', tem_frente_trabalho: true },
    { status: 'resolvida', tem_frente_trabalho: false },
  ]), false);
  assert.equal(window.FabricacaoQuadroCalc.estaPausado([
    { status: 'aberta', tem_frente_trabalho: true },
    { status: 'aberta', tem_frente_trabalho: false },
  ]), true);
  assert.equal(window.FabricacaoQuadroCalc.estaPausado([]), false);
});
