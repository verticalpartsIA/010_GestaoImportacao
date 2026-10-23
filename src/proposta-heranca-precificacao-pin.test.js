'use strict';
/* buscarFontes()/prefillPorNumeroCotacao() com opts.precificacaoId (23/10,
   achado real do Codex no PR #1070): sem o pin, a função sempre preferia
   a precificação 'finalizado' mais recente da família — abrir a REVISÃO B
   (ainda só 'calculado') pra gerar a Proposta dela devolvia os preços da
   ORIGINAL, mesmo a Proposta nascendo rotulada "VPPR-...-B". */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./master-id-engine.js');
require('./proposta-heranca.js');
const { buscarFontes } = window.PropostaHeranca;

function makeFakeSbFontes({ formulario, unidades = [], cotacoes = [], precificacoes = [] }) {
  const tabela = (nome, data) => ({
    select() { return { eq() { return { maybeSingle: async () => ({ data, error: null }), order: () => ({ data, error: null }) }; } }; },
  });
  return {
    from(nome) {
      if (nome === 'formularios_elevador') return tabela(nome, formulario);
      if (nome === 'formularios_elevador_unidades') return tabela(nome, unidades);
      if (nome === 'cotacoes_elevador_fornecedor') return tabela(nome, cotacoes);
      if (nome === 'precificacoes_elevador') return tabela(nome, precificacoes);
      return tabela(nome, null);
    },
  };
}

test('sem precificacaoId: prefere a precificação "finalizado" (comportamento de sempre, regressão)', async () => {
  const precificacoes = [
    { id: 'PZ-B', status: 'calculado', cotacao_fornecedor_id: 'COT-B' },      // mais recente (array já vem created_at desc)
    { id: 'PZ-ORIGINAL', status: 'finalizado', cotacao_fornecedor_id: 'COT-ORIGINAL' },
  ];
  const cotacoes = [{ id: 'COT-B' }, { id: 'COT-ORIGINAL' }];
  const sb = makeFakeSbFontes({ formulario: { id: 'F1', clientes: {} }, cotacoes, precificacoes });
  window.__VP_SB = { sb };
  const fontes = await buscarFontes(990);
  assert.equal(fontes.precificacao.id, 'PZ-ORIGINAL');
  assert.equal(fontes.cotacao.id, 'COT-ORIGINAL');
});

test('com precificacaoId: pina NESSA precificação, mesmo com outra "finalizado" mais madura na família', async () => {
  const precificacoes = [
    { id: 'PZ-B', status: 'calculado', cotacao_fornecedor_id: 'COT-B' },
    { id: 'PZ-ORIGINAL', status: 'finalizado', cotacao_fornecedor_id: 'COT-ORIGINAL' },
  ];
  const cotacoes = [{ id: 'COT-B' }, { id: 'COT-ORIGINAL' }];
  const sb = makeFakeSbFontes({ formulario: { id: 'F1', clientes: {} }, cotacoes, precificacoes });
  window.__VP_SB = { sb };
  const fontes = await buscarFontes(990, { precificacaoId: 'PZ-B' });
  assert.equal(fontes.precificacao.id, 'PZ-B', 'pinou a revisão B, não a original finalizada');
  assert.equal(fontes.cotacao.id, 'COT-B', 'cotação do fornecedor é a DESSA precificação, não a mais madura da família');
});

test('com precificacaoId que não existe mais na família: não inventa cotação da família inteira', async () => {
  const precificacoes = [{ id: 'PZ-ORIGINAL', status: 'finalizado', cotacao_fornecedor_id: 'COT-ORIGINAL' }];
  const cotacoes = [{ id: 'COT-ORIGINAL' }];
  const sb = makeFakeSbFontes({ formulario: { id: 'F1', clientes: {} }, cotacoes, precificacoes });
  window.__VP_SB = { sb };
  const fontes = await buscarFontes(990, { precificacaoId: 'PZ-SUMIU' });
  assert.equal(fontes.precificacao, null);
  assert.equal(fontes.cotacao, null, 'sem a precificação pinada, não cai pro "melhor" da família — null é mais seguro que adivinhar');
});
