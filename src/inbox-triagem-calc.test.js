'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./inbox-triagem-calc.js');

const dec = (assunto, prioridade, confianca, extra) => ({
  resumo: { assunto, departamento: 'geral', prioridade, confianca },
  reclamacao: { resposta: false }, exige_resposta: { resposta: false }, ...(extra || {}),
});

test('politica — sem decisão (não classificado) lista como sempre', () => {
  assert.equal(T.politica(null), 'normal');
  assert.equal(T.politica({}), 'normal');
});

test('politica — automático com confiança suficiente fica em silêncio; com pouca, aparece', () => {
  assert.equal(T.politica(dec('automatico_spam', 'baixa', 0.89)), 'silencioso');
  assert.equal(T.politica(dec('automatico_spam', 'baixa', 0.6)), 'normal');
});

test('politica — prioridade alta e reclamação pedem você', () => {
  assert.equal(T.politica(dec('avaria_pos_venda', 'alta', 0.83)), 'precisa_de_voce');
  assert.equal(T.politica(dec('outro', 'media', 0.5, { reclamacao: { resposta: true } })), 'precisa_de_voce');
});

test('politica — pede resposta chama você se for assunto de negócio ou estiver ligado a uma cotação', () => {
  const negocio = dec('resposta_fornecedor', 'media', 0.5, { exige_resposta: { resposta: true } });
  assert.equal(T.politica(negocio, { vinculado: false }), 'precisa_de_voce');   // ex.: fornecedor pergunta algo sem cotação
  const outro = dec('outro', 'baixa', 0.5, { exige_resposta: { resposta: true } });
  assert.equal(T.politica(outro, { vinculado: false }), 'normal');              // conversa solta não vira urgência
  assert.equal(T.politica(outro, { vinculado: true }), 'precisa_de_voce');      // mas ligada a cotação, sim
});

test('politica — automático nunca vira "precisa de você" mesmo com prioridade alta', () => {
  assert.equal(T.politica(dec('automatico_spam', 'alta', 0.9)), 'silencioso');
});

test('rotulo — texto curto do chip', () => {
  const d = { resumo: { assunto: 'avaria_pos_venda', departamento: 'pos_venda', prioridade: 'alta', confianca: 0.96 } };
  assert.equal(T.rotulo(d), 'Avaria · Pós-venda · Alta');
  assert.equal(T.rotulo(null), '');
});
