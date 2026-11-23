'use strict';
/* Copiar ficha e Trocar valores (ficha-tecnica-engine.js) */
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('./ficha-tecnica-engine.js');
const FT = global.window.FT;

const original = {
  id: 'orig-1', numero_documento: 'VPFT20260611_135',
  identificacao: {
    nomeProduto: 'Máquina de Tração 8,1Kw', codigoProduto: 'VPMAC-48K-1250-100-380V', partNumber: 'FRD48K-380V',
    sku: 'SKU-X', descricaoTecnica: 'Tensão 380Vac, 380Vac nominal. Capacidade 1250kg', descricaoComercial: '8,1KW, 380VAC', marca: 'BST',
  },
  cats: [{ id: 'c1', nome: 'Elétricas', campos: [{ k: 'tensao', nome: 'Tensão', ativo: true, valor: '380 Vac' }, { k: 'x', nome: 'Vazio', ativo: true, valor: '' }] }],
  midia: { foto: 'fichas/orig-1/foto.jpg', desenho: 'fichas/orig-1/desenho.jpg' },
  descricao_duimp: 'Máquina 380Vac', ncm_recomendado: '8428.10',
  omie_publicado_em: '2026-10-01', etapa: 'importacao', produto_id: 'ft-orig-1',
};

test('copiar: nasce com id novo, sem código/part number/SKU e sem publicação', () => {
  const c = FT.copiarFicha(original);
  assert.notEqual(c.__id, 'orig-1');
  assert.equal(c.identificacao.codigoProduto, '');
  assert.equal(c.identificacao.partNumber, '');
  assert.equal(c.identificacao.sku, '');
  assert.equal(c.omie_publicado_em, null);
  assert.equal(c.produto_id, undefined);
  assert.deepEqual(c.__copiaDe, { id: 'orig-1', numero: 'VPFT20260611_135' });
});

test('copiar: leva textos, valores dos campos, NCM e caminhos das fotos', () => {
  const c = FT.copiarFicha(original);
  assert.equal(c.identificacao.nomeProduto, 'Máquina de Tração 8,1Kw');
  assert.equal(c.identificacao.marca, 'BST');
  assert.equal(c.cats[0].campos[0].valor, '380 Vac');
  assert.equal(c.ncm_recomendado, '8428.10');
  assert.equal(c.midia.foto, 'fichas/orig-1/foto.jpg');
});

test('copiar: editar a cópia não altera a original (cópia profunda)', () => {
  const c = FT.copiarFicha(original);
  c.cats[0].campos[0].valor = 'outro';
  assert.equal(original.cats[0].campos[0].valor, '380 Vac');
});

test('trocar: troca em nome, descrições, campos e DUIMP, e conta as ocorrências', () => {
  const c = FT.copiarFicha(original);
  const r = FT.substituirEmFicha(c, [{ de: '380Vac', para: '220Vac' }]);
  assert.equal(r.state.identificacao.descricaoTecnica, 'Tensão 220Vac, 220Vac nominal. Capacidade 1250kg');
  assert.equal(r.state.descricao_duimp, 'Máquina 220Vac');
  assert.equal(r.total, 3);
  assert.equal(c.identificacao.descricaoTecnica.includes('380Vac'), true); // estado de entrada intacto
});

test('trocar: texto literal (parênteses e pontos não viram regex)', () => {
  const st = FT.copiarFicha({ identificacao: { descricaoTecnica: 'a (1.5) b 1x5' }, cats: [] });
  const r = FT.substituirEmFicha(st, [{ de: '(1.5)', para: '[2]' }]);
  assert.equal(r.state.identificacao.descricaoTecnica, 'a [2] b 1x5');
});

test('trocar: respeita maiúsculas por padrão e ignora quando pedido', () => {
  const st = FT.copiarFicha({ identificacao: { descricaoComercial: '380VAC e 380Vac' }, cats: [] });
  assert.equal(FT.substituirEmFicha(st, [{ de: '380Vac', para: 'X' }]).total, 1);
  assert.equal(FT.substituirEmFicha(st, [{ de: '380Vac', para: 'X' }], { ignorarCaixa: true }).total, 2);
});

test('trocar: nunca mexe no código do produto nem no SKU; par vazio é ignorado', () => {
  const st = FT.copiarFicha(original);
  st.identificacao.codigoProduto = 'VPMAC-380V';
  st.identificacao.sku = 'S-380V';
  const r = FT.substituirEmFicha(st, [{ de: '380V', para: '220V' }, { de: '', para: 'x' }]);
  assert.equal(r.state.identificacao.codigoProduto, 'VPMAC-380V');
  assert.equal(r.state.identificacao.sku, 'S-380V');
});
