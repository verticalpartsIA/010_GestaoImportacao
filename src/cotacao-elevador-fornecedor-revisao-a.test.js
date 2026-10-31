'use strict';
/* gerar() — a PRIMEIRA cotação de uma categoria/formulário passa a nascer
   já com letra "A" (23/10, pedido do usuário: "desde quando o formulário
   volte VPCT-990-A, B..."), não mais sem letra.

   Achado real do Codex (PR #1073, verificado contra o schema): a sequência
   de letra tem que continuar ESCOPADA SÓ POR formulário+categoria, nunca
   por fornecedor — numero_documento é UNIQUE GLOBAL na tabela (migration
   20260722250000_cotacao_elevador_fornecedor.sql: "numero_documento text
   not null unique") e masterId() não leva o nome do fornecedor no código
   gerado (só categoria+Nº cotação+revisão). Se 2 fornecedores cotando a
   MESMA categoria do MESMO formulário tivessem sequências de letra
   independentes, o 1º envio de cada um geraria o MESMO numero_documento
   ("VPEL-EL0990-A" pros dois) e o 2º insert quebraria violando a
   constraint única — por isso a letra é uma sequência ÚNICA
   compartilhada entre todos os fornecedores que cotam ali. (Uma versão
   anterior deste teste chegou a cobrir um escopo por fornecedor — foi
   revertido depois de confirmar a constraint real no banco.) */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./master-id-engine.js');
require('./cotacao-elevador-fornecedor-store.js');
const { gerar } = window.CotacaoElevadorFornecedorStore;

function makeFakeSbGerar({ existentes = [] } = {}) {
  const inseridos = [];
  return {
    from(tabela) {
      if (tabela === 'cotacoes_elevador_fornecedor') {
        return {
          select() { return { eq() { return { eq() { return { data: existentes, error: null }; } }; } }; },
          insert(row) {
            return { select() { return { single: async () => { const obj = { ...row, id: 'nova-id' }; inseridos.push(obj); return { data: obj, error: null }; } }; } };
          },
        };
      }
      return { select() { return { eq() { return { eq() { return { data: [], error: null }; } }; } }; } };
    },
    _inseridos: () => inseridos,
  };
}

const unidades = [{ id: 'U1', tipo: 'Elevador', identificador: 'VPEL-EL0990-1' }];

test('gerar(): 1ª cotação desta categoria/formulário (nenhuma existente) nasce já com letra "A", não mais sem letra', async () => {
  window.__VP_SB = { sb: makeFakeSbGerar({ existentes: [] }) };
  const cot = await gerar('F1', unidades, 'Glarie', 990, 'elevador');
  assert.equal(cot.revisao, 'A');
  assert.equal(cot.numero_documento, 'VPEL-EL0990-A');
});

test('gerar(): reenvio ao MESMO fornecedor (família já tinha "A") avança pra "B" normalmente', async () => {
  window.__VP_SB = { sb: makeFakeSbGerar({ existentes: [{ revisao: 'A' }] }) };
  const cot = await gerar('F1', unidades, 'Glarie', 990, 'elevador');
  assert.equal(cot.revisao, 'B');
  assert.equal(cot.numero_documento, 'VPEL-EL0990-B');
});

test('gerar(): 1º envio a um fornecedor NOVO continua a MESMA sequência de outro fornecedor da mesma categoria/formulário — nunca gera numero_documento repetido', async () => {
  /* Glarie já usou A/B/C nesta categoria/formulário; o 1º envio a um fornecedor
     novo (Thyssen) tem que pegar "D", não "A" de novo — "A" já é
     VPEL-EL0990-A da Glarie, e numero_documento é UNIQUE: gerar outro
     "VPEL-EL0990-A" pra Thyssen quebraria a gravação no banco. */
  window.__VP_SB = { sb: makeFakeSbGerar({ existentes: [{ revisao: 'A' }, { revisao: 'B' }, { revisao: 'C' }] }) };
  const cot = await gerar('F1', unidades, 'Thyssen', 990, 'elevador');
  assert.equal(cot.revisao, 'D', 'sequência é por formulário+categoria, compartilhada entre fornecedores — garante numero_documento sempre único');
  assert.equal(cot.numero_documento, 'VPEL-EL0990-D');
});
