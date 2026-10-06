'use strict';
/* ============================================================
   proposta-heranca-campos-tecnicos.test.js — issue #704

   montarEspecificacoes() já herdava id/modelo/capacidade/velocidade/
   paradas/dimensões da caixa por equipamento, mas nunca repassava
   tensão de alimentação, tração nem dimensões da cabine — campos que
   existem e são obrigatórios no Formulário (formulario-elevador.jsx),
   sobrevivem no snapshot `dados_envio` da Cotação, mas nunca chegavam
   à Proposta. Este arquivo testa a função diretamente (exportada só
   para teste, mesmo padrão já usado para montarAtivos).
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./proposta-heranca.js');
const { montarEspecificacoes } = window.PropostaHeranca;

test('montarEspecificacoes — herda tensão/tração/dimensões da cabine por equipamento, sem misturar entre unidades', () => {
  const fontes = {
    unidades: [
      { id: 'U1', identificador: 'VPEL-EL0999-1', tensao_principal: '220V/3P/60Hz', tracao: '2:1', cabina_largura_mm: 1500, cabina_profundidade_mm: 1700 },
      { id: 'U2', identificador: 'VPEL-EL0999-2', tensao_principal: '380V/3P/60Hz', tracao: '4:1', cabina_largura_mm: 1600, cabina_profundidade_mm: 1800 },
    ],
    cotacao: null,
    precificacao: null,
  };
  const out = montarEspecificacoes(fontes);
  assert.equal(out.length, 2);
  assert.equal(out[0].tensao, '220V/3P/60Hz');
  assert.equal(out[0].tracao, '2:1');
  assert.equal(out[0].dimensoesCabine, '1500 x 1700mm');
  assert.equal(out[1].tensao, '380V/3P/60Hz');
  assert.equal(out[1].tracao, '4:1');
  assert.equal(out[1].dimensoesCabine, '1600 x 1800mm');
});

test('montarEspecificacoes — sem dado de tensão/tração/cabine, campos saem vazios (compatibilidade com cotação antiga)', () => {
  const out = montarEspecificacoes({ unidades: [{ id: 'U1', identificador: 'X' }], cotacao: null, precificacao: null });
  assert.equal(out[0].tensao, '');
  assert.equal(out[0].tracao, '');
  assert.equal(out[0].dimensoesCabine, '');
});

test('montarEspecificacoes — sem Unidade carregada, cai pro snapshot congelado em cotacao.dados_envio', () => {
  const fontes = {
    unidades: [],
    cotacao: { dados_envio: { unidades: [{ unidade_id: 'U1', identificador: 'VPEL-EL0998-1', tensao_principal: '220V', tracao: '2:1', cabina_largura_mm: 1400, cabina_profundidade_mm: 1600 }] } },
    precificacao: null,
  };
  const out = montarEspecificacoes(fontes);
  assert.equal(out[0].tensao, '220V');
  assert.equal(out[0].tracao, '2:1');
  assert.equal(out[0].dimensoesCabine, '1400 x 1600mm');
});

test('montarEspecificacoes — só largura OU só profundidade da cabine ainda monta a dimensão (mesmo padrão de dimensoesCaixa)', () => {
  const out = montarEspecificacoes({ unidades: [{ id: 'U1', identificador: 'X', cabina_largura_mm: 1500 }], cotacao: null, precificacao: null });
  assert.equal(out[0].dimensoesCabine, '1500 x ?mm');
});
