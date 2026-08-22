'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};

/* Mock chainable estilo Supabase: .from(table).select(...).eq(...).limit(...)
   resolve via then() com o valor configurado por tabela em `byTable`. */
function mockSb(byTable) {
  function chain(table) {
    const result = byTable[table] || { data: [] };
    const builder = {
      select: () => builder,
      eq: () => builder,
      limit: () => builder,
      then: (resolve) => resolve(result),
    };
    return builder;
  }
  return { from: chain };
}

window.__VP_SB = { sb: mockSb({}) };
require('./project-gates.js');
const G = window.ProjectGates;

test('validarGatesImportacao — sem client ou sem projectId retorna erro', async () => {
  window.__VP_SB = { sb: null };
  const r = await G.validarGatesImportacao('P1');
  assert.equal(r.ok, false);
  assert.equal(r.erro, true);
  window.__VP_SB = { sb: mockSb({}) };
});

test('validarGatesImportacao — todos os 3 gates ok libera importação', async () => {
  window.__VP_SB.sb = mockSb({
    contratos_venda_equipamentos: { data: [{ id: 1, status: 'assinado' }] },
    instalacao_cronograma: { data: [{ id: 1, f1_status: 'Liberada' }] },
    equipamentos_spec: { data: [{ id: 1, projeto_pdf_recebido: true, anexos: null }] },
  });
  const r = await G.validarGatesImportacao('P1');
  assert.equal(r.ok, true);
  assert.deepEqual(r.blockedBy, []);
  assert.equal(r.gates.length, 3);
});

test('validarGatesImportacao — contrato não assinado bloqueia mesmo com os outros 2 ok', () => {
  return (async () => {
    window.__VP_SB.sb = mockSb({
      contratos_venda_equipamentos: { data: [{ id: 1, status: 'rascunho' }] },
      instalacao_cronograma: { data: [{ id: 1, f1_status: 'Liberada' }] },
      equipamentos_spec: { data: [{ id: 1, projeto_pdf_recebido: true }] },
    });
    const r = await G.validarGatesImportacao('P1');
    assert.equal(r.ok, false);
    assert.deepEqual(r.blockedBy, ['contrato_nao_assinado']);
  })();
});

test('validarGatesImportacao — PDF aceita via anexos.projeto_pdf quando projeto_pdf_recebido é falso', async () => {
  window.__VP_SB.sb = mockSb({
    contratos_venda_equipamentos: { data: [{ id: 1, status: 'assinado' }] },
    instalacao_cronograma: { data: [{ id: 1, f1_status: 'Liberada' }] },
    equipamentos_spec: { data: [{ id: 1, projeto_pdf_recebido: false, anexos: { projeto_pdf: 'x.pdf' } }] },
  });
  const r = await G.validarGatesImportacao('P1');
  // ok vem de `a === true || b`: quando cai no branch b, carrega o valor
  // truthy de anexos.projeto_pdf em vez de um boolean — comportamento real
  // da fonte, só verificamos truthiness aqui.
  assert.ok(r.gates.find((g) => g.nome === 'PDF Projeto').ok);
  assert.equal(r.ok, true);
});

test('validarGatesImportacao — nenhum registro em nenhuma tabela bloqueia os 3 gates', async () => {
  window.__VP_SB.sb = mockSb({
    contratos_venda_equipamentos: { data: [] },
    instalacao_cronograma: { data: [] },
    equipamentos_spec: { data: [] },
  });
  const r = await G.validarGatesImportacao('P1');
  assert.equal(r.ok, false);
  assert.deepEqual(r.blockedBy, ['contrato_nao_assinado', 'pagamento_f1_pendente', 'pdf_projeto_nao_recebido']);
});

test('validarGatesImportacao — erro de query cai no catch e retorna erro:true', async () => {
  window.__VP_SB.sb = {
    from: () => ({
      select: function () { return this; },
      eq: function () { return this; },
      limit: function () { return this; },
      then: () => { throw new Error('boom'); },
    }),
  };
  const r = await G.validarGatesImportacao('P1');
  assert.equal(r.erro, true);
  assert.equal(r.detalhe, 'boom');
});

test('mensagemBlockedBy — junta só as mensagens conhecidas, ignora chaves desconhecidas', () => {
  const msg = G.mensagemBlockedBy(['contrato_nao_assinado', 'chave_desconhecida', 'pdf_projeto_nao_recebido']);
  assert.match(msg, /Cliente ainda não assinou/);
  assert.match(msg, /PDF do projeto/);
  assert.equal(msg.split('\n').length, 2);
});

test('mensagemBlockedBy — lista vazia retorna string vazia', () => {
  assert.equal(G.mensagemBlockedBy([]), '');
});
