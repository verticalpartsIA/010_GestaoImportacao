'use strict';
/* listarPendentes() — a letra de revisão é obrigatória na fila da
   Precificação em toda família com 2+ versões, mesmo na ORIGINAL (23/10,
   pedido do usuário com print da tela: cotação 990 mostrava "VPEL-EL0990"
   sem letra e "VPEL-EL0990-B" — a original devia aparecer como "-A"). Só o
   RÓTULO exibido muda — numero_documento gravado no banco (o que foi
   literalmente mandado ao fornecedor) nunca é reescrito aqui. */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./master-id-engine.js');
require('./precificacao-elevador-store.js');
const { listarPendentes } = window.PrecificacaoElevadorStore;

function chainOf(data) {
  const obj = {
    data, error: null,
    select() { return obj; }, eq() { return obj; }, in() { return obj; }, order() { return obj; }, not() { return obj; }, is() { return obj; },
  };
  return obj;
}

function makeFakeSb({ cots, forms = [], precificacoes = [], irmas }) {
  const calls = [];
  return {
    from(tabela) {
      const vezAnterior = calls.includes(tabela);
      calls.push(tabela);
      if (tabela === 'cotacoes_elevador_fornecedor') return chainOf(vezAnterior ? irmas : cots); // 1ª = cots, 2ª = irmas
      if (tabela === 'formularios_elevador') return chainOf(vezAnterior ? forms : []); // 1ª = diretos (vazio aqui), 2ª = forms
      if (tabela === 'precificacoes_elevador') return chainOf(precificacoes);
      return chainOf([]);
    },
  };
}

test('listarPendentes(): original SEM letra, com irmã mais nova (B) — rótulo vira "-A", original não é reescrita', async () => {
  const cot1 = { id: 'C1', numero_documento: 'VPEL-EL0990', revisao: null, fornecedor: 'Glarie', formulario_elevador_id: 'F1', status: 'aprovada', responded_at: '2026-10-19T12:00:00Z', categoria_produto: 'elevador', created_at: '2026-10-19T12:00:00Z' };
  const cot2 = { id: 'C2', numero_documento: 'VPEL-EL0990-B', revisao: 'B', fornecedor: 'Glarie', formulario_elevador_id: 'F1', status: 'respondido', responded_at: '2026-10-22T09:00:00Z', categoria_produto: 'elevador', created_at: '2026-10-22T09:00:00Z' };
  const forms = [{ id: 'F1', numero_cotacao: 990, clientes: { razao_social: 'Condomínio X' } }];
  const fake = makeFakeSb({ cots: [cot2, cot1], forms, irmas: [cot1, cot2] });
  window.__VP_SB = { sb: fake };

  const lista = await listarPendentes();
  const r1 = lista.find((x) => x.cotacaoFornecedorId === 'C1');
  const r2 = lista.find((x) => x.cotacaoFornecedorId === 'C2');

  assert.equal(r1.numeroDocumentoFornecedor, 'VPEL-EL0990-A', 'original ganha "-A" só no rótulo exibido');
  assert.equal(r1.substituidaPor, 'VPEL-EL0990-B');
  assert.equal(r2.numeroDocumentoFornecedor, 'VPEL-EL0990-B', 'quem já tem letra própria não muda');
  assert.equal(r2.substituidaPor, null, 'a mais nova não é substituída por ninguém');
});

test('listarPendentes(): família LEGADA (regra antiga: 1º reenvio já nascia "A") — original NÃO ganha "-A" sintético, pra não colidir com a irmã real "-A"', async () => {
  /* achado real do Codex: famílias criadas ANTES desta mudança (20/10 em diante,
     antes de 23/10) tinham a regra "original sem letra, 1º reenvio nasce A" — a
     irmã aqui JÁ é literalmente "VPEL-EL0990-A" de verdade, gravada no banco.
     Sintetizar "-A" pra original colidiria (duas linhas com o mesmo rótulo). */
  const cot1 = { id: 'C1', numero_documento: 'VPEL-EL0990', revisao: null, fornecedor: 'Glarie', formulario_elevador_id: 'F3', status: 'aprovada', responded_at: '2026-10-20T12:00:00Z', categoria_produto: 'elevador', created_at: '2026-10-20T12:00:00Z' };
  const cot2 = { id: 'C4', numero_documento: 'VPEL-EL0991-A', revisao: 'A', fornecedor: 'Glarie', formulario_elevador_id: 'F3', status: 'respondido', responded_at: '2026-10-21T09:00:00Z', categoria_produto: 'elevador', created_at: '2026-10-21T09:00:00Z' };
  const forms = [{ id: 'F3', numero_cotacao: 991, clientes: { razao_social: 'Hotel Plaza' } }];
  const fake = makeFakeSb({ cots: [cot1, cot2], forms, irmas: [cot1, cot2] });
  window.__VP_SB = { sb: fake };

  const lista = await listarPendentes();
  const r1 = lista.find((x) => x.cotacaoFornecedorId === 'C1');
  assert.equal(r1.numeroDocumentoFornecedor, 'VPEL-EL0990', 'rótulo ambíguo é pior que nenhum — fica sem letra quando "A" já é de outra irmã de verdade');
});

test('listarPendentes(): família de 1 versão só — original continua sem letra (não é obrigatória sem "nova versão")', async () => {
  const cot = { id: 'C3', numero_documento: 'VPEL-EL0999', revisao: null, fornecedor: 'Glarie', formulario_elevador_id: 'F2', status: 'aprovada', responded_at: '2026-10-21T12:00:00Z', categoria_produto: 'elevador', created_at: '2026-10-21T12:00:00Z' };
  const forms = [{ id: 'F2', numero_cotacao: 999, clientes: { razao_social: 'Capital Elevadores' } }];
  const fake = makeFakeSb({ cots: [cot], forms, irmas: [cot] });
  window.__VP_SB = { sb: fake };

  const lista = await listarPendentes();
  const r = lista.find((x) => x.cotacaoFornecedorId === 'C3');
  assert.equal(r.numeroDocumentoFornecedor, 'VPEL-EL0999', 'sem irmã — fica exatamente como foi gravado');
});
