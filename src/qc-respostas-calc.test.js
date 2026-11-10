'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./qc-respostas-calc.js');

const base = {
  tipo_servico: 'modernizacao', empresa: 'ACME LTDA', cnpj: '11.222.333/0001-81', solicitante: 'Ana', telefone: '1199999',
  identificacao: 'Obra X', num_paradas: '8', variante_quadro: '15_380', tensao_rede: '380',
  tipo_porta: 'automatica', operador_porta: 'vvvf', tipo_freio: 'tipo_bs', tensao_freio: '110',
  acionamento: 'vf', casa_maquinas: 'sem_casa', acessorios: { cop: true, lop: true }, cop_display: 'com',
  lop_material: 'vidro', lop_botoes: '2', lop_display: 'sem', porta_oposta: 'sim', porta_oposta_paradas: [1, 8],
  maquina_codigo: 'VPMAC-1', fiacao_omitida: true,
};

test('montarResumo: traduz rótulos, junta acessórios e inclui o que o cliente marcou', () => {
  const m = Object.fromEntries(C.montarResumo(base, { maquinas: [{ codigo: 'VPMAC-1', descricao: 'Máquina 15 kW' }] }, 10));
  assert.equal(m['Modelo do Quadro'], '15 kW / 380 V');
  assert.equal(m['Tipo de Serviço'], 'Modernização');
  assert.equal(m['Acessórios'], 'COP — Botoeira de Cabina · LOP — Botoeira de Pavimento');
  assert.equal(m['LOP — total de botoeiras'], '10');
  assert.equal(m['Porta oposta'], 'Sim — andares 1, 8');
  assert.equal(m['Máquina de Tração'], 'Máquina 15 kW');
  assert.equal(m['Fiação de Poço'], 'Omitida — valores padrão');
});

test('montarResumo: sem acessório LOP/COP não mostra as linhas deles; campo vazio some', () => {
  const m = Object.fromEntries(C.montarResumo({ ...base, acessorios: {}, maquina_codigo: '' }, {}, 0));
  assert.equal(m['Acessórios'], 'Nenhum');
  assert.equal(m['COP'], undefined);
  assert.equal(m['Máquina de Tração'], undefined);
});

test('normalizarResumo: só aceita pares, corta tamanho e descarta lixo', () => {
  assert.deepEqual(C.normalizarResumo('x'), []);
  assert.deepEqual(C.normalizarResumo([['A', 1], 'lixo', ['', 'sem rótulo'], ['B']]), [['A', '1']]);
  assert.equal(C.normalizarResumo([['A', 'x'.repeat(5000)]])[0][1].length, 2000);
  assert.equal(C.normalizarResumo(Array.from({ length: 200 }, (_, i) => ['k' + i, 'v'])).length, 80);
});

test('nomeArquivoPdf: usa o nº do pedido do Omie e limpa caracteres', () => {
  assert.equal(C.nomeArquivoPdf('30570'), 'Quadro-de-Comando-Pedido-30570.pdf');
  assert.equal(C.nomeArquivoPdf('30/570 ../'), 'Quadro-de-Comando-Pedido-30570.pdf');
  assert.equal(C.nomeArquivoPdf(''), 'Quadro-de-Comando-Pedido-sem-numero.pdf');
});
