'use strict';
/* gerar() — a PRIMEIRA cotação a um fornecedor passa a nascer já com letra
   "A" (23/10, pedido do usuário: "desde quando o formulário volte
   VPCT-990-A, B..."), não mais sem letra. Achado real ao implementar: a
   busca de "maior revisão já usada" nunca filtrava por FORNECEDOR, só por
   formulário+categoria — com 2 fornecedores na mesma categoria do mesmo
   formulário, o 1º envio a um fornecedor novo herdava a letra do OUTRO
   fornecedor em vez de nascer em "A". */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./master-id-engine.js');
require('./cotacao-elevador-fornecedor-store.js');
const { gerar } = window.CotacaoElevadorFornecedorStore;

function chainOf(data) {
  const obj = { data, error: null, select() { return obj; }, eq() { return obj; } };
  return obj;
}

/* existentesPorFornecedor: { "Glarie": [{revisao:'A'},{revisao:'B'}], "Thyssen": [] }
   — a query real filtra por fornecedor (.eq('fornecedor', fornecedor)); este fake
   SÓ devolve o conjunto certo quando os 3 .eq() (formulário/categoria/fornecedor)
   batem com os argumentos passados — prova de verdade o escopo por fornecedor,
   não só confia que o código chama .eq() (que não garantiria nada sozinho). */
function makeFakeSbGerar({ existentesPorFornecedor = {} } = {}) {
  const inseridos = [];
  return {
    from(tabela) {
      if (tabela === 'cotacoes_elevador_fornecedor') {
        let fornecedorFiltrado;
        const chain = {
          select() { return chain; },
          eq(col, val) { if (col === 'fornecedor') fornecedorFiltrado = val; return chain; },
          get data() { return existentesPorFornecedor[fornecedorFiltrado] || []; },
          error: null,
        };
        return {
          select: chain.select,
          insert(row) {
            return { select() { return { single: async () => { const obj = { ...row, id: 'nova-id' }; inseridos.push(obj); return { data: obj, error: null }; } }; } };
          },
        };
      }
      return chainOf([]);
    },
    _inseridos: () => inseridos,
  };
}

const unidades = [{ id: 'U1', tipo: 'Elevador', identificador: 'VPEL-EL0990-1' }];

test('gerar(): 1º envio a este fornecedor (nenhuma existente) nasce já com letra "A", não mais sem letra', async () => {
  window.__VP_SB = { sb: makeFakeSbGerar({ existentesPorFornecedor: { Glarie: [] } }) };
  const cot = await gerar('F1', unidades, 'Glarie', 990, 'elevador');
  assert.equal(cot.revisao, 'A');
  assert.equal(cot.numero_documento, 'VPEL-EL0990-A');
});

test('gerar(): 2º envio ao MESMO fornecedor (já tinha "A") avança pra "B" normalmente', async () => {
  window.__VP_SB = { sb: makeFakeSbGerar({ existentesPorFornecedor: { Glarie: [{ revisao: 'A' }] } }) };
  const cot = await gerar('F1', unidades, 'Glarie', 990, 'elevador');
  assert.equal(cot.revisao, 'B');
  assert.equal(cot.numero_documento, 'VPEL-EL0990-B');
});

test('gerar(): 1º envio a um fornecedor NOVO não herda a letra de outro fornecedor da mesma categoria/formulário', async () => {
  /* achado real corrigido junto: a query de "revisão já usada" nunca filtrava
     por fornecedor, só formulário+categoria — Glarie já em "C" vazava pro 1º
     envio de um fornecedor novo (Thyssen), que devia nascer em "A". */
  window.__VP_SB = { sb: makeFakeSbGerar({ existentesPorFornecedor: { Glarie: [{ revisao: 'A' }, { revisao: 'B' }, { revisao: 'C' }], Thyssen: [] } }) };
  const cot = await gerar('F1', unidades, 'Thyssen', 990, 'elevador');
  assert.equal(cot.revisao, 'A', 'fornecedor novo sempre começa em "A", nunca continua a sequência de outro fornecedor');
});
