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

/* REGRA (06/11/2026, só daqui pra frente): o Nº da proposta é o da cotação e não muda depois de criado. */
function montarNumero(linhaExistente) {
  const atualizacoes = [], insercoes = [];
  const sb = {
    from(t) {
      if (t === 'perfis') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'EU' }, error: null }) }) }) };
      return {
        select: (cols) => ({
          eq: () => ({
            maybeSingle: async () => ({ data: linhaExistente, error: null }),
            eq: () => ({ then: (f) => f({ data: [], error: null }) }),
            order: () => ({ limit: async () => ({ data: [], error: null }) }),
            limit: async () => ({ data: [{ id: 'F' }], error: null }),
          }),
        }),
        update: (p) => { atualizacoes.push(p); return { eq: () => ({ select: () => ({ single: async () => ({ data: { id: 'P1', token: 't' }, error: null }) }) }) }; },
        insert: (r) => { insercoes.push(r[0]); return { select: () => ({ single: async () => ({ data: { id: 'NOVA', token: 't' }, error: null }) }) }; },
      };
    },
  };
  window.__VP_SB = { sb };
  window.__VP_USER = { email: 'v@x.com', nome: 'V' };
  return { atualizacoes, insercoes };
}

test('número de proposta que já existe não é trocado por salvar() (caso "993 A")', async () => {
  const { atualizacoes } = montarNumero({ status: 'rascunho', destravada_em: null, numero_documento: 'VPPR-0993' });
  const r = await window.PropostaStore.salvar({ data: { numero: '993 A', cliente: { nome: 'X' }, numeroCotacao: '' }, eq: 'elevador', editId: 'P1', valorTotal: 1 });
  assert.equal(r.erro, undefined);
  assert.equal(atualizacoes.length, 1);
  assert.equal('numero_documento' in atualizacoes[0], false, 'não envia numero_documento ao atualizar');
  assert.equal(atualizacoes[0].data_json.numero, 'VPPR-0993', 'o data_json acompanha o número gravado');
  assert.equal(r.numero_documento, 'VPPR-0993');
});

test('número padrão da proposta nova: VPPR-<Nº da cotação>[-letra], igual ao que a Precificação gera', () => {
  const P = window.PropostaStore;
  assert.equal(P.numeroPadrao(993, null), 'VPPR-0993');
  assert.equal(P.numeroPadrao('1004', 'VPEL-EL1004-A'), 'VPPR-1004-A', 'letra vinda do Master ID de equipamento');
  assert.equal(P.numeroPadrao('VPCT-0990', 'VPCT-0990-B'), 'VPPR-0990-B', 'letra vinda do Master ID da cotação');
  assert.equal(P.numeroPadrao('', 'VPEL-EL1004-A'), null, 'sem Nº de cotação não há número padrão');
  assert.equal(/^VP-\d{4}-\d{3}$/.test('VP-2026-001'), true, 'o número padrão do editor é o que dispara a regra');
});
