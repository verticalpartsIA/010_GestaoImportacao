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

test('montarResumoCompleto: seções, fiação por extenso, distâncias entre pavimentos e "Não informado"', () => {
  const f = { ...base, f_l1: '3.5', f_ua: '3,5', f_tr: '2', f_bp: '', f_lim: '3.5', f_fp: '3.5', fiacao_omitida: false,
    dist: [{ de: '1', ate: '2', m: '3' }, { de: '2', ate: '3', m: '' }], obs_fiacao: 'poço estreito' };
  const r = C.montarResumoCompleto(f, { maquinas: [{ codigo: 'VPMAC-1', descricao: 'Máquina 15 kW' }] }, 10);
  const m = Object.fromEntries(r);
  assert.ok(r.some((p) => p[0] === '§ Fiação de poço' && p[1] === ''), 'tem título de seção');
  assert.equal(m['Quadro até a entrada do poço (L1)'], '3,5 m');
  assert.equal(m['Contato de TRICO até a calha (TR)'], '2 m');
  assert.equal(m['Botoeira até a calha (BP)'], 'Não informado');
  assert.equal(m['Distância entre pavimentos: do 1 ao 2'], '3 m');
  assert.equal(m['Distâncias entre pavimentos'], '1 intervalo(s) sem medida');
  assert.equal(m['Observações da fiação'], 'poço estreito');
  assert.equal(m['CNPJ'], '11.222.333/0001-81');
  assert.equal(m['Máquina de tração'], 'Máquina 15 kW');
  assert.equal(m['Porta de cabina'], 'Não solicitado');
});

test('montarResumoCompleto: fiação omitida e tabela de distâncias toda em branco', () => {
  const m1 = Object.fromEntries(C.montarResumoCompleto({ ...base, fiacao_omitida: true }, {}, 0));
  assert.match(m1['Dados da fiação'], /valores padrão/);
  assert.equal(m1['Quadro até a entrada do poço (L1)'], undefined);
  const m2 = Object.fromEntries(C.montarResumoCompleto({ ...base, fiacao_omitida: false, dist: [{ de: '', ate: '', m: '' }, { de: '', ate: '', m: '' }] }, {}, 0));
  assert.equal(m2['Distâncias entre pavimentos'], 'Não informado (2 intervalo(s) sem medida)');
  assert.equal(m2['E-mail'], 'Não informado');
});
