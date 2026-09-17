'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
window.__VP_USER = { email: 'gelson.simoes@verticalparts.com.br' };

/* Fake Supabase client — cobre só as chamadas que decisoes-store.js faz
   nos 3 fluxos testados aqui (criar, aprovar, reprovar). */
function fakeSupabase({ decisaoExistente, invokeCalls }) {
  const from = (table) => {
    if (table === 'alcadas_capacidade') {
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) };
    }
    if (table === 'decisoes_gerenciais') {
      return {
        insert: (row) => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'dec-1', ...row }, error: null }),
          }),
        }),
        select: () => ({
          eq: (col, val) => {
            const chain = {
              maybeSingle: () => Promise.resolve({ data: null }),
              single: () => Promise.resolve({ data: decisaoExistente, error: null }),
              eq: () => chain,
              order: () => Promise.resolve({ data: [] }),
              contains: () => Promise.resolve({ data: [] }),
            };
            return chain;
          },
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        contains: () => Promise.resolve({ data: [] }),
      };
    }
    if (table === 'alertas') return { insert: () => Promise.resolve({ error: null }) };
    throw new Error('tabela não mockada: ' + table);
  };
  return {
    from,
    functions: { invoke: (name, opts) => { invokeCalls.push({ name, opts }); return Promise.resolve({ data: {}, error: null }); } },
  };
}

test('criarDecisao grava solicitado_por com o e-mail do usuário logado', async () => {
  const invokeCalls = [];
  window.__VP_SB = { sb: fakeSupabase({ invokeCalls }) };
  delete require.cache[require.resolve('./decisoes-store.js')];
  require('./decisoes-store.js');
  const D = window.DecisoesStore;

  const decisao = await D.criarDecisao({ tipo: 'compra_equipamento_ceo', papelRequerido: 'ceo', numeroCotacao: 917 });
  assert.equal(decisao.solicitado_por, 'gelson.simoes@verticalparts.com.br');
});

test('criarDecisao dispara whatsapp-notify (stage decisao_pendente) para os aprovadores', async () => {
  const invokeCalls = [];
  window.__VP_SB = { sb: fakeSupabase({ invokeCalls }) };
  delete require.cache[require.resolve('./decisoes-store.js')];
  require('./decisoes-store.js');
  const D = window.DecisoesStore;

  await D.criarDecisao({ tipo: 'compra_equipamento_ceo', papelRequerido: 'ceo', numeroCotacao: 917 });
  await new Promise((r) => setTimeout(r, 0)); // deixa o fire-and-forget rodar

  const call = invokeCalls.find((c) => c.name === 'whatsapp-notify');
  assert.ok(call, 'esperava uma chamada a whatsapp-notify');
  assert.equal(call.opts.body.stage, 'decisao_pendente');
  assert.deepEqual(call.opts.body.recipients, ['diego@verticalparts.com.br']);
});

test('aprovar dispara whatsapp-notify (stage decisao_resultado) para o solicitante', async () => {
  const invokeCalls = [];
  const decisaoExistente = {
    id: 'dec-1', status: 'pendente', tipo: 'compra_equipamento_ceo',
    aprovadores_esperados: ['gelson.simoes@verticalparts.com.br'],
    solicitado_por: 'regiane.rocha@verticalparts.com.br',
  };
  window.__VP_SB = { sb: fakeSupabase({ decisaoExistente, invokeCalls }) };
  delete require.cache[require.resolve('./decisoes-store.js')];
  require('./decisoes-store.js');
  const D = window.DecisoesStore;

  await D.aprovar('dec-1', 'ok pode comprar');
  await new Promise((r) => setTimeout(r, 0));

  const call = invokeCalls.find((c) => c.name === 'whatsapp-notify');
  assert.ok(call, 'esperava uma chamada a whatsapp-notify');
  assert.equal(call.opts.body.stage, 'decisao_resultado');
  assert.equal(call.opts.body.statusFinal, 'aprovada');
  assert.deepEqual(call.opts.body.recipients, ['regiane.rocha@verticalparts.com.br']);
});

test('falha em functions.invoke não impede aprovar() de completar', async () => {
  const decisaoExistente = {
    id: 'dec-1', status: 'pendente', tipo: 'compra_equipamento_ceo',
    aprovadores_esperados: ['gelson.simoes@verticalparts.com.br'],
    solicitado_por: 'regiane.rocha@verticalparts.com.br',
  };
  const sb = fakeSupabase({ decisaoExistente, invokeCalls: [] });
  sb.functions.invoke = () => Promise.reject(new Error('edge function fora do ar'));
  window.__VP_SB = { sb };
  delete require.cache[require.resolve('./decisoes-store.js')];
  require('./decisoes-store.js');
  const D = window.DecisoesStore;

  await assert.doesNotReject(() => D.aprovar('dec-1', 'ok'));
});
