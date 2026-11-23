'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./solicitacoes-compra-calc.js');
const C = window.SolicitacoesCompraCalc;

test('seleção vira itens: código em maiúsculas, sem repetir, quantidade vem da sugestão', () => {
  const r = C.itensDaSelecao([
    { codigo: 'vpb-307', descricao: 'Botoeira', unidade: 'PC', sugestaoCompra: 10 },
    { codigo: 'VPB-307', sugestaoCompra: 99 },
    { codigo: 'VPB-499', sugestaoCompra: 0 },
  ]);
  assert.equal(r.length, 2);
  assert.deepEqual([r[0].codigo, r[0].quantidade], ['VPB-307', 10]);
  assert.equal(r[1].quantidade, 0);
});

test('envio exige quantidade maior que zero em todas as linhas', () => {
  assert.equal(C.validarEnvio([]).ok, false);
  const v = C.validarEnvio([{ codigo: 'A', quantidade: 2 }, { codigo: 'B', quantidade: 0 }]);
  assert.equal(v.ok, false);
  assert.match(v.erros[0], /^B:/);
  assert.equal(C.validarEnvio([{ codigo: 'A', quantidade: 2 }]).ok, true);
});

test('mensagem de erro do banco perde o prefixo técnico', () => {
  assert.equal(C.mensagemErro(new Error('sem_alcada: você não tem a alçada')), 'você não tem a alçada');
  assert.equal(C.mensagemErro(new Error('falha de rede')), 'falha de rede');
});

test('resumo ignora itens removidos e conta alocados', () => {
  const r = C.resumo({}, [{ lote_id: 'x' }, { lote_id: null }, { lote_id: 'y', removido_em: '2026-01-01' }]);
  assert.deepEqual(r, { total: 2, alocados: 1, pendentes: 1 });
});

test('só o solicitante edita, e só enquanto nada foi alocado', () => {
  const sol = { status: 'devolvida', solicitante_email: 'Guilherme@verticalparts.com.br' };
  assert.equal(C.podeEditar(sol, [{ lote_id: null }], 'guilherme@verticalparts.com.br'), true);
  assert.equal(C.podeEditar(sol, [{ lote_id: 'L1' }], 'guilherme@verticalparts.com.br'), false);
  assert.equal(C.podeEditar(sol, [], 'outro@verticalparts.com.br'), false);
  assert.equal(C.podeEditar({ ...sol, status: 'alocada' }, [], 'guilherme@verticalparts.com.br'), false);
});

test('item alocável: ativo e de solicitação em andamento; devolvida/cancelada não', () => {
  assert.equal(C.itemAlocavel({ status: 'enviada' }, {}), true);
  assert.equal(C.itemAlocavel({ status: 'alocada' }, { lote_id: 'L1' }), true);
  assert.equal(C.itemAlocavel({ status: 'devolvida' }, {}), false);
  assert.equal(C.itemAlocavel({ status: 'enviada' }, { removido_em: 'x' }), false);
});

test('soma por código junta pedidos de vendedores diferentes', () => {
  assert.deepEqual(C.somarPorCodigo([{ codigo: 'A', quantidade: 3 }, { codigo: 'A', quantidade: 2 }, { codigo: 'B', quantidade: 1 }]), { A: 5, B: 1 });
});
