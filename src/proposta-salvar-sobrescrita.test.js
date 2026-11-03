'use strict';
/* salvar() sem editId não pode sobrescrever uma proposta que já existe com o mesmo numero_documento (revisão do módulo 4,
   02/11/2026). A proposta nova nasce com o número padrão VP-<ano>-001; antes, quem salvasse sem mudar o número atualizava a
   proposta de outro vendedor, mesmo enviada/assinada (a trava só valia com editId). Só o próprio rascunho do vendedor passa. */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./master-id-engine.js');
require('./proposta-store.js');

function montar(linhas, meuId) {
  const atualizacoes = [], insercoes = [];
  const sb = {
    from(t) {
      if (t === 'perfis') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: meuId ? { id: meuId } : null, error: null }) }) }) };
      return {
        select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: linhas, error: null }) }) }) }),
        update: (p) => { atualizacoes.push(p); return { eq: () => ({ select: () => ({ single: async () => ({ data: { id: linhas[0].id, token: 't' }, error: null }) }) }) }; },
        insert: (r) => { insercoes.push(r); return { select: () => ({ single: async () => ({ data: { id: 'NOVA', token: 't' }, error: null }) }) }; },
      };
    },
  };
  window.__VP_SB = { sb };
  window.__VP_USER = { email: 'v@x.com', nome: 'V' };
  return { atualizacoes, insercoes };
}
const dados = { numero: 'VP-2026-001', cliente: { nome: 'Cliente Novo' }, numeroCotacao: '' };
const salvarNovo = () => window.PropostaStore.salvar({ data: dados, eq: 'elevador', editId: null, valorTotal: 1 });

test('proposta de outro vendedor com o mesmo número: recusa e não atualiza', async () => {
  const { atualizacoes } = montar([{ id: 'P1', status: 'rascunho', vendedor_id: 'OUTRO', destravada_em: null }], 'EU');
  const r = await salvarNovo();
  assert.match(r.erro, /Já existe a proposta VP-2026-001/);
  assert.equal(atualizacoes.length, 0);
});

test('proposta já enviada com o mesmo número: recusa mesmo sendo do próprio vendedor', async () => {
  const { atualizacoes } = montar([{ id: 'P1', status: 'enviada', vendedor_id: 'EU', destravada_em: null }], 'EU');
  const r = await salvarNovo();
  assert.match(r.erro, /não é um rascunho seu/);
  assert.equal(atualizacoes.length, 0);
});

test('o próprio rascunho do vendedor continua sendo atualizado (quem perdeu o id da tela)', async () => {
  const { atualizacoes } = montar([{ id: 'P1', status: 'rascunho', vendedor_id: 'EU', destravada_em: null }], 'EU');
  const r = await salvarNovo();
  assert.equal(r.erro, undefined);
  assert.equal(r.id, 'P1');
  assert.equal(atualizacoes.length, 1);
});

test('número livre: cria a proposta normalmente', async () => {
  const { insercoes } = montar([], 'EU');
  const r = await salvarNovo();
  assert.equal(r.erro, undefined);
  assert.equal(insercoes.length, 1);
});
