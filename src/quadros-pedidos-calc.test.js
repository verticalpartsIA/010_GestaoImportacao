'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./quadros-pedidos-calc.js');
const C = window.QuadrosPedidosCalc;

test('progressoFabricacao: média das OPs; quadro sem OP conta como 0%', () => {
  assert.deepEqual(C.progressoFabricacao([100], 1), { pct: 100, ops: 1, esperado: 1 });
  assert.equal(C.progressoFabricacao([100], 2).pct, 50);           // 2 quadros no pedido, só 1 com OP
  assert.equal(C.progressoFabricacao([], 1).pct, 0);               // nenhum quadro com OP ainda
  assert.equal(C.progressoFabricacao([34, 67], 2).pct, 50);        // arredonda para baixo (50,5)
  assert.equal(C.progressoFabricacao([100, 100, 99], 3).pct, 99);  // 100% só com todos a 100
});

test('progressoFabricacao: sem quadro esperado e sem OP não tem % (null)', () => {
  assert.equal(C.progressoFabricacao([], 0), null);
  assert.equal(C.progressoFabricacao(undefined, undefined), null);
});

test('progressoFabricacao: mais OPs que o esperado usa o número de OPs', () => {
  assert.equal(C.progressoFabricacao([100, 0, 0], 1).esperado, 3);
});

test('classificarItem: quadro, cabo (vai com o quadro), matéria-prima, serviço e separação', () => {
  const q = ['VPEL-735a'];
  assert.equal(C.classificarItem({ codigo: 'vpel-735A', descricao: 'Quadro de Comando para Elevador' }, q), 'quadro');
  assert.equal(C.classificarItem({ codigo: 'VPEL-529n', descricao: 'Cabo Manobra Elétrico com 23 Vias' }, q), 'cabo');
  assert.equal(C.classificarItem({ codigo: 'VPB-097', descricao: 'Cabo Elétrico Modular para Conexão do Circuito' }, q), 'cabo');
  assert.equal(C.classificarItem({ codigo: 'VPMP-303', descricao: 'Parafuso' }, q), 'materia_prima');
  assert.equal(C.classificarItem({ codigo: 'VPSVC-033', descricao: 'Serviço de Modernização de Quadro de Comando' }, q), 'servico');
  assert.equal(C.classificarItem({ codigo: 'VPB-347', descricao: 'Botão de Chamada Aço Inox "Seta Subida"' }, q), 'separacao');
  assert.equal(C.classificarItem({ codigo: 'VPB-333', descricao: 'Placa para Display Indicador de Posição TFT 7"' }, q), 'separacao');
  assert.equal(C.classificarItem({ codigo: 'VPB-116', descricao: 'Encoder AB Incremental' }, q), 'separacao');
});

test('resumoItens: pedido 30614 (22 linhas) → 2 quadros, 9 itens de kit, 12 linhas / 23 un. para separar', () => {
  const botao = (codigo) => ({ codigo, descricao: 'Botão de Chamada Aço Inox', quantidade: 2 });
  const itens = [
    { codigo: 'VPEL-735a', descricao: 'Quadro de Comando para Elevador 7,5 kW / 380V', quantidade: 2 },
    { codigo: 'VPEL-529n', descricao: 'Cabo Manobra Elétrico com 23 Vias', quantidade: 40 },
    ...['VPB-097', 'VPB-098', 'VPB-099', 'VPB-100', 'VPB-101', 'VPB-102', 'VPB-105', 'VPB-106'].map((codigo) => ({ codigo, descricao: 'Cabo Elétrico Modular', quantidade: 2 })),
    ...['VPB-347', 'VPB-340', 'VPB-367', 'VPB-369', 'VPB-368', 'VPB-358', 'VPB-359', 'VPB-370', 'VPB-360'].map(botao),
    { codigo: 'VPB-333', descricao: 'Placa para Display Indicador de Posição', quantidade: 2 },
    { codigo: 'VPB-336', descricao: 'Placa de Ligação dos Botões de Cabina', quantidade: 2 },
    { codigo: 'VPB-116', descricao: 'Encoder AB Incremental', quantidade: 1 },
  ];
  assert.equal(itens.length, 22);
  assert.deepEqual(C.resumoItens(itens, ['VPEL-735a']), { quadros: 2, cabos: 9, separacao: { linhas: 12, unidades: 23 } });
});

test('resumoItens: linha repetida com quantidade 0 não conta (pedido 29972) e o mesmo código soma uma linha só', () => {
  const itens = [
    { codigo: 'VPB-148', descricao: 'Botoeira de Pavimento B3', quantidade: 1 },
    { codigo: 'VPB-148', descricao: 'Botoeira de Pavimento B3', quantidade: 0 },
    { codigo: 'VPB-149', descricao: 'Botoeira de Pavimento B3', quantidade: 3 },
    { codigo: 'VPB-404', descricao: 'Botão de Chamada', quantidade: 0 },
  ];
  assert.deepEqual(C.resumoItens(itens, []), { quadros: 0, cabos: 0, separacao: { linhas: 2, unidades: 4 } });
});

test('itensParaSeparar: só o que o almoxarifado separa, por código, na mesma conta de resumoItens', () => {
  const itens = [
    { codigo: 'VPEL-735a', descricao: 'Quadro de Comando', unidade: 'PC', quantidade: 2 },
    { codigo: 'VPB-097', descricao: 'Cabo Elétrico Modular', unidade: 'PC', quantidade: 2 },
    { codigo: 'VPB-347', descricao: 'Botão de Chamada', unidade: 'PC', quantidade: 2 },
    { codigo: 'VPB-347', descricao: 'Botão de Chamada', unidade: 'PC', quantidade: 0 },
    { codigo: 'VPB-116', descricao: 'Encoder AB Incremental', unidade: 'PC', quantidade: 1 },
    { codigo: 'VPMAC-48K', descricao: 'Máquina de Tração para Elevador', unidade: 'UN', quantidade: 1 },
  ];
  const lista = C.itensParaSeparar(itens, ['VPEL-735a']);
  assert.deepEqual(lista.map((i) => [i.codigo, i.quantidade]), [['VPB-116', 1], ['VPB-347', 2], ['VPMAC-48K', 1]]);
  const r = C.resumoItens(itens, ['VPEL-735a']);
  assert.equal(r.separacao.linhas, lista.length);
  assert.equal(r.separacao.unidades, lista.reduce((a, i) => a + i.quantidade, 0));
});

test('itensDoKit: só os cabos (cabo de manobra e cabos modulares), por código — pedido 30614 tem 9', () => {
  const itens = [
    { codigo: 'VPEL-735a', descricao: 'Quadro de Comando', unidade: 'PC', quantidade: 2 },
    { codigo: 'VPEL-529n', descricao: 'Cabo Manobra Elétrico com 23 Vias', unidade: 'PC', quantidade: 40 },
    ...['VPB-097', 'VPB-098', 'VPB-099', 'VPB-100', 'VPB-101', 'VPB-102', 'VPB-105', 'VPB-106'].map((codigo) => ({ codigo, descricao: 'Cabo Elétrico Modular', unidade: 'PC', quantidade: 2 })),
    { codigo: 'VPB-347', descricao: 'Botão de Chamada', unidade: 'PC', quantidade: 2 },
    { codigo: 'VPB-097', descricao: 'Cabo Elétrico Modular', unidade: 'PC', quantidade: 0 },
  ];
  const kit = C.itensDoKit(itens, ['VPEL-735a']);
  assert.equal(kit.length, 9);
  assert.deepEqual(kit.map((i) => i.codigo).slice(0, 3), ['VPB-097', 'VPB-098', 'VPB-099']);
  assert.equal(kit.find((i) => i.codigo === 'VPEL-529n').quantidade, 40);
  assert.equal(kit.length, C.resumoItens(itens, ['VPEL-735a']).cabos);
  assert.ok(!kit.some((i) => i.codigo === 'VPB-347' || i.codigo === 'VPEL-735a'));
});

const OBS_30614 = [
  'Inversor de Frequência Trifásico, 7,5KW/380V - Ref.: NC30-1Peça (PC)', 'Placa principal do quadro de comando C3 do elevador - Ref.: MC01-1Peça (PC)',
  'Placa Leitora Encoder Sin/Cos do Comando Monarch de Elevador - Ref.: MC02-1Peça (PC)', 'Placa do freio do quadro de comando de elevador - Ref.: NC30-1Peça (PC)',
  'Placa para interface de ligações do quadro de comando de elevador - Ref.: MC04-1Peça (PC)', 'Quadro de Comando para Elevador - MS - 7,5KW/380V -  Sem Inversor - Ref.: NC30-1Peça (PC)',
  'Interruptor de Serviço de Bombeiro de Elevador-1Peça (PC)', 'Interfone de 5 Vias de Elevador para Casa de Máquinas-1Peça (PC)', 'Interfone de 5 Vias de Elevador para Portaria-1Peça (PC)',
  'Tomada Elétrica para Poço de Elevador-1Peça (PC)', 'Suporte para Cabo de Comando de Elevador-2Peça (PC)', 'Alarme Sonoro e Luminoso de Elevador-2Peça (PC)',
  'Sensor Indutivo para Pesador de Carga de Elevador-1Peça (PC)', 'Sensor Fotoelétrico de Nivelamento em Formato U de Elevador-4Peça (PC)',
  'Suporte para 4 Sensores Fotoelétricos de Nivelamento em Formato U de Elevador-1Peça (PC)', 'Chave de Fim de Curso Contato Fechado (NF) de Elevador -6Peça (PC)',
  'Botoeira de Inspeção sobre a Cabina de Elevador -1Peça (PC)', 'Botoeira de Inspeção do Poço de Elevador-1Peça (PC)', 'Botoeira de Stop para Acesso ao Poço de Elevador-1Peça (PC)',
  'Iluminação de Poço de Elevador-2Peça (PC)', 'Programador para Comando de Elevador-1Peça (PC)',
  'Fiação Elétrica Completa para Elevador incluindo cabo de potência- 7,5KW/380V - Ref.: NC30-1Unidade (UN)',
].join('|');

test('lerLinhaComponente: descrição, quantidade e unidade (aceita hífen dentro da descrição e acento estragado)', () => {
  assert.deepEqual(C.lerLinhaComponente('Suporte para Cabo de Comando de Elevador-2Peça (PC)'), { descricao: 'Suporte para Cabo de Comando de Elevador', quantidade: 2, unidade: 'PC' });
  assert.deepEqual(C.lerLinhaComponente('Placa principal do quadro de comando C3 do elevador - Ref.: MC01-1Peça (PC)'), { descricao: 'Placa principal do quadro de comando C3 do elevador - Ref.: MC01', quantidade: 1, unidade: 'PC' });
  assert.deepEqual(C.lerLinhaComponente('Fiação Elétrica Completa incluindo cabo de potência- 7,5KW/380V - Ref.: NC30-1Unidade (UN)'), { descricao: 'Fiação Elétrica Completa incluindo cabo de potência- 7,5KW/380V - Ref.: NC30', quantidade: 1, unidade: 'UN' });
  assert.deepEqual(C.lerLinhaComponente('Tomada El\uFFFDtrica para Po\uFFFDo de Elevador-1Pe\uFFFDa (PC)'), { descricao: 'Tomada El\uFFFDtrica para Po\uFFFDo de Elevador', quantidade: 1, unidade: 'PC' });
  assert.equal(C.lerLinhaComponente('texto sem quantidade'), null);
  assert.equal(C.lerLinhaComponente(''), null);
});

test('componentesDoQuadro: pedido 30614 (obs_item real, 22 linhas, 2 quadros) → 22 componentes, quantidade × 2, códigos ITEM#n', () => {
  const itens = [
    { codigo: 'VPEL-735a', descricao: 'Quadro de Comando', quantidade: 2, obs_item: OBS_30614 },
    { codigo: 'VPB-097', descricao: 'Cabo Elétrico Modular', quantidade: 2, obs_item: 'Texto qualquer-1Peça (PC)' },   // não é quadro: ignorado
  ];
  const comp = C.componentesDoQuadro(itens, ['VPEL-735a']);
  assert.equal(comp.length, 22);
  assert.equal(comp[0].codigo, 'VPEL-735A#1');
  assert.equal(comp[21].codigo, 'VPEL-735A#22');
  assert.equal(comp[10].descricao, 'Suporte para Cabo de Comando de Elevador');
  assert.equal(comp[10].quantidade, 4);                                  // 2 por quadro × 2 quadros
  assert.equal(comp[15].quantidade, 12);                                 // chave de fim de curso: 6 × 2
  assert.equal(comp.reduce((a, c) => a + c.quantidade, 0), 66);          // 33 por quadro × 2
  assert.equal(comp[21].unidade, 'UN');
  assert.deepEqual(C.componentesDoQuadro([{ codigo: 'VPEL-735a', quantidade: 1 }], ['VPEL-735a']), []);   // sem observação: nada
});

test('resumoItens: Ordem de Serviço (só serviço) não tem nada a separar', () => {
  const r = C.resumoItens([{ codigo: 'VPSVC-033', descricao: 'Serviço de Modernização de Quadro de Comando', quantidade: 9 }], []);
  assert.deepEqual(r, { quadros: 0, cabos: 0, separacao: { linhas: 0, unidades: 0 } });
});

test('chaveDaOp: pedido da OP, senão o da OP-mãe (OS), senão a própria OP', () => {
  assert.equal(C.chaveDaOp({ numero: 'OP-0004-Q1', pedido_codigo: 9226338511 }, 9226338511), '9226338511');
  assert.equal(C.chaveDaOp({ numero: 'OP-0003-Q1', pedido_codigo: null }, 9224550374), '9224550374');
  assert.equal(C.chaveDaOp({ numero: 'OP-0016-Q', pedido_codigo: null }, null), 'op:OP-0016-Q');
});
