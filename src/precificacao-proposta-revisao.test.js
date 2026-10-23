'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./master-id-engine.js');
require('./precificacao-elevador-store.js');
const { criarPropostaAutomatica } = window.PrecificacaoElevadorStore;

/* ============================================================
   criarPropostaAutomatica() — a Proposta herda a letra de revisão da
   Precificação (23/10, pedido do usuário: "deve chegar em propostas
   VPPR-990-'letra'" — mesma lógica já aplicada em criar() pra Precificação,
   ver precificacao-elevador-store.test.js). "Já tem proposta" passa a ser
   escopado POR REVISÃO (numero_documento com a mesma letra, via
   MasterIdEngine.parseRevisao) — não só por Nº da cotação, senão a
   reprecificação de uma revisão nova nunca criaria a Proposta dela, barrada
   pela Proposta já existente da revisão anterior.
   ============================================================ */

function makeFakeSbPropostaAuto({ revisaoCotacao, propostasExistentes = [] } = {}) {
  return {
    from(tabela) {
      if (tabela === 'cotacoes_elevador_fornecedor') {
        return { select() { return { eq() { return { maybeSingle: async () => ({ data: { revisao: revisaoCotacao }, error: null }) }; } }; } };
      }
      if (tabela === 'propostas') {
        return {
          select() {
            return {
              eq(_col1, numCot) {
                return { eq: (_col2, _tipo) => ({ data: propostasExistentes.filter((p) => p.numero_cotacao === numCot), error: null }) };
              },
            };
          },
        };
      }
      return { select() { return { eq() { return { maybeSingle: async () => ({ data: null, error: null }) }; } }; } };
    },
  };
}

function montarContexto() {
  let salvouCom = null;
  window.PropostaHeranca = {
    prefillPorNumeroCotacao: async () => ({ encontrado: true, prefill: { elevador: { valores: { valorUnit: 1000, quantidade: 1 } } } }),
  };
  window.deepMergeProposta = (base, cima) => ({ ...base, ...cima });
  window.makeDefaultProposta = () => ({});
  window.PropostaStore = { salvar: async (args) => { salvouCom = args; return { ok: true }; } };
  return { numeroSalvo: () => salvouCom && salvouCom.data && salvouCom.data.numero, salvouAlgo: () => salvouCom != null };
}

test('criarPropostaAutomatica(): Precificação na revisão B gera Proposta VPPR-0990-B', async () => {
  const fake = makeFakeSbPropostaAuto({ revisaoCotacao: 'B' });
  window.__VP_SB = { sb: fake };
  const ctx = montarContexto();
  await criarPropostaAutomatica({ numero_cotacao: 990, cotacao_fornecedor_id: 'COT-B' });
  assert.equal(ctx.numeroSalvo(), 'VPPR-0990-B');
});

test('criarPropostaAutomatica(): sem revisão (precificação original), número sai igual a antes (sem sufixo)', async () => {
  const fake = makeFakeSbPropostaAuto({ revisaoCotacao: null });
  window.__VP_SB = { sb: fake };
  const ctx = montarContexto();
  await criarPropostaAutomatica({ numero_cotacao: 990, cotacao_fornecedor_id: 'COT-ORIGINAL' });
  assert.equal(ctx.numeroSalvo(), 'VPPR-0990');
});

test('criarPropostaAutomatica(): já existe proposta da MESMA revisão — não duplica', async () => {
  const fake = makeFakeSbPropostaAuto({
    revisaoCotacao: 'B',
    propostasExistentes: [{ numero_cotacao: 990, numero_documento: 'VPPR-0990-B' }],
  });
  window.__VP_SB = { sb: fake };
  const ctx = montarContexto();
  await criarPropostaAutomatica({ numero_cotacao: 990, cotacao_fornecedor_id: 'COT-B' });
  assert.equal(ctx.salvouAlgo(), false, 'já tinha VPPR-0990-B — não chama PropostaStore.salvar de novo');
});

test('criarPropostaAutomatica(): existe proposta da revisão ANTERIOR — cria a da revisão nova, não barra', async () => {
  const fake = makeFakeSbPropostaAuto({
    revisaoCotacao: 'B',
    propostasExistentes: [{ numero_cotacao: 990, numero_documento: 'VPPR-0990' }], // revisão original, sem letra
  });
  window.__VP_SB = { sb: fake };
  const ctx = montarContexto();
  await criarPropostaAutomatica({ numero_cotacao: 990, cotacao_fornecedor_id: 'COT-B' });
  assert.equal(ctx.numeroSalvo(), 'VPPR-0990-B', 'a proposta da revisão original não impede a da revisão B');
});

test('criarPropostaAutomatica(): precificação direto-pra-precificação (sem cotacao_fornecedor_id) continua gerando VPPR sem letra', async () => {
  const fake = makeFakeSbPropostaAuto({ revisaoCotacao: 'Z' }); // não deveria nem ser consultado
  window.__VP_SB = { sb: fake };
  const ctx = montarContexto();
  await criarPropostaAutomatica({ numero_cotacao: 990, cotacao_fornecedor_id: null });
  assert.equal(ctx.numeroSalvo(), 'VPPR-0990');
});
