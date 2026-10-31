'use strict';
/* salvar() — nova revisão de uma família já existente precisa respeitar os
   índices únicos PARCIAIS que "Revisões Comerciais Etapa 1" (migration
   20261022100000, PR #1054) já colocou em `propostas`: só 1 vigência=
   'vigente' por (numero_cotacao, tipo) e só 1 revisao_indice por família —
   os dois DEFAULT pra 'vigente'/0. Achado real do Codex no PR #1070: um
   insert cru da 2ª proposta da família colidiria com esses índices contra
   a proposta original. Este teste cobre que o insert passa a levar
   revisao_indice/vigencia/revisao_codigo/raiz corretos nesse caso — e que
   a família com 1 membro só (comportamento de sempre) não muda em nada. */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./master-id-engine.js');
require('./proposta-store.js');
const { salvar } = window.PropostaStore;

function chainOf(data) {
  const obj = {
    data, error: null,
    eq() { return obj; }, order() { return obj; }, limit() { return obj; }, is() { return obj; },
    maybeSingle: async () => ({ data: Array.isArray(data) ? (data[0] || null) : data, error: null }),
    single: async () => ({ data: Array.isArray(data) ? (data[0] || null) : data, error: null }),
  };
  return obj;
}

function makeFakeSbSalvar({ familiaDup = [], precificacoesParaCotacao = [{ id: 'PZ-1' }] } = {}) {
  const inseridos = [];
  return {
    from(tabela) {
      if (tabela === 'propostas') {
        return {
          select(cols) {
            return {
              eq(_col, _val) {
                if (cols === 'id') return chainOf([]); // numero_documento ainda livre
                if (cols && cols.indexOf('revisao_indice') >= 0) {
                  return { eq: () => chainOf(familiaDup) }; // .eq(numero_cotacao).eq(proposal_type)
                }
                return chainOf(null);
              },
            };
          },
          insert(arr) {
            const obj = { ...arr[0], id: 'novo-id', token: 'tok-novo' };
            return { select() { return { single: async () => { inseridos.push(obj); return { data: obj, error: null }; } }; } };
          },
        };
      }
      if (tabela === 'precificacoes_elevador') {
        return { select() { return { eq() { return { limit: () => chainOf(precificacoesParaCotacao) }; } }; } };
      }
      if (tabela === 'formularios_elevador') {
        return { select() { return { eq() { return { limit: () => chainOf([{ id: 'F1' }]) }; } }; } };
      }
      return { select() { return { eq() { return chainOf(null); } }; } };
    },
    _inseridos: () => inseridos,
  };
}

test('salvar(): PRIMEIRA proposta da família (sem irmã) — nada novo no payload, comportamento de sempre', async () => {
  window.__VP_USER = {};
  window.__VP_SB = { sb: makeFakeSbSalvar({ familiaDup: [] }) };
  const r = await salvar({
    data: { cliente: { nome: 'Cliente X' }, numero: 'VPPR-0990', numeroCotacao: 990 },
    eq: 'elevador', editId: null, valorTotal: 1000,
  });
  assert.equal(r.erro, undefined, r.erro);
  const inserido = window.__VP_SB.sb._inseridos()[0];
  assert.equal(inserido.revisao_indice, undefined, 'sem irmã — fica no default do banco (0), não forçamos nada');
  assert.equal(inserido.vigencia, undefined, 'sem irmã — fica no default do banco (vigente), não forçamos nada');
});

test('salvar(): SEGUNDA proposta da família (revisão B) — vigencia/revisao_indice/raiz preenchidos pra não colidir com o índice único', async () => {
  window.__VP_SB = { sb: makeFakeSbSalvar({
    familiaDup: [{ id: 'P-ORIGINAL', numero_documento: 'VPPR-0990', revisao_indice: 0 }],
  }) };
  const r = await salvar({
    data: { cliente: { nome: 'Cliente X' }, numero: 'VPPR-0990-B', numeroCotacao: 990 },
    eq: 'elevador', editId: null, valorTotal: 1000,
  });
  assert.equal(r.erro, undefined, r.erro);
  const inserido = window.__VP_SB.sb._inseridos()[0];
  assert.equal(inserido.revisao_indice, 1, 'próximo índice livre da família (original está em 0)');
  assert.equal(inserido.revisao_codigo, 'B');
  assert.equal(inserido.vigencia, 'em_negociacao', 'NUNCA "vigente" — colidiria com o índice único parcial contra a original');
  assert.equal(inserido.proposta_raiz_id, 'P-ORIGINAL', 'raiz = a irmã sem letra (a original da família)');
  assert.equal(inserido.proposta_base_id, 'P-ORIGINAL');
});

test('salvar(): tentar criar OUTRA proposta com a MESMA revisão (já existe) é barrado (trava de duplicata continua valendo)', async () => {
  window.__VP_SB = { sb: makeFakeSbSalvar({
    familiaDup: [
      { id: 'P-ORIGINAL', numero_documento: 'VPPR-0990', revisao_indice: 0 },
      { id: 'P-B', numero_documento: 'VPPR-0990-B', revisao_indice: 1 },
    ],
  }) };
  const r = await salvar({
    data: { cliente: { nome: 'Cliente X' }, numero: 'VPPR-0990-B', numeroCotacao: 990 },
    eq: 'elevador', editId: null, valorTotal: 1000,
  });
  assert.match(r.erro || '', /já tem a proposta VPPR-0990-B/);
});
