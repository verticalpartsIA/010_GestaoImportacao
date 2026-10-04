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

/* ---- Fase 2 (JEV): sugestão de vínculo, responsável, aviso e lido por pessoa ---- */
const sug = (...c) => ({ candidatos: c, confianca: 0.7 });
const cand = (numero, score, probabilidade) => ({ numero, score, probabilidade });

test('politicaSugestao — uma candidata clara sugere forte; ambígua pergunta; fraca fica em silêncio', () => {
  assert.equal(T.politicaSugestao(sug(cand(955, 0.65, 1))), 'forte');
  assert.equal(T.politicaSugestao(sug(cand(955, 0.65, 0.5), cand(950, 0.65, 0.5))), 'perguntar');   // duas igualmente prováveis
  assert.equal(T.politicaSugestao(sug(cand(955, 0.3, 1))), 'silencio');                              // pouca evidência: não pergunta à toa
  assert.equal(T.politicaSugestao(sug()), 'silencio');
  assert.equal(T.politicaSugestao(null), 'silencio');
});

test('politicaSugestao — forte exige folga sobre a segunda candidata', () => {
  assert.equal(T.politicaSugestao(sug(cand(955, 0.8, 0.7), cand(950, 0.5, 0.3))), 'forte');          // folga 0,40 → destaca a 955
  assert.equal(T.politicaSugestao(sug(cand(955, 0.8, 0.55), cand(950, 0.7, 0.45))), 'perguntar');    // quase empate → deixa a pessoa escolher
});

test('sugerirResponsavel — líderes do departamento da classificação vêm primeiro', () => {
  const colaboradores = [
    { email: 'lider@x.com', nome: 'Líder', departamento: 'Adm/Financeiro', is_department_lead: true },
    { email: 'fin1@x.com', nome: 'Fin 1', departamento: 'Adm/Financeiro', is_department_lead: false },
    { email: 'vend@x.com', nome: 'Vend', departamento: 'Comercial', is_department_lead: false },
  ];
  const r = T.sugerirResponsavel({ decisao: { resumo: { departamento: 'financeiro' } }, colaboradores });
  assert.deepEqual(r.map((x) => x.email), ['lider@x.com', 'fin1@x.com']);
  assert.equal(r[0].probabilidade, 0.5);
  assert.deepEqual(T.sugerirResponsavel({ decisao: { resumo: { departamento: 'geral' } }, colaboradores }), []);
  assert.deepEqual(T.sugerirResponsavel({ decisao: null, colaboradores }), []);
});

test('avisoOutroDono — avisa só quando o responsável não sou eu (atribuição vence o dono)', () => {
  assert.equal(T.avisoOutroDono({ dono: 'ana@x.com', eu: 'ana@x.com' }), null);
  assert.equal(T.avisoOutroDono({ dono: 'ana@x.com', eu: 'bia@x.com' }), 'ana@x.com');
  assert.equal(T.avisoOutroDono({ dono: 'ana@x.com', atribuido: 'bia@x.com', eu: 'bia@x.com' }), null);   // atribuído a mim
  assert.equal(T.avisoOutroDono({ dono: 'ana@x.com', atribuido: 'bia@x.com', eu: 'ana@x.com' }), 'bia@x.com');
  assert.equal(T.avisoOutroDono({ dono: null, atribuido: null, eu: 'ana@x.com' }), null);                // sem responsável: nada a avisar
});

test('naoLidaPara — o que EU abri é lida para mim; o resto segue a caixa', () => {
  assert.equal(T.naoLidaPara(true, { lido: true }), false);
  assert.equal(T.naoLidaPara(true, null), true);
  assert.equal(T.naoLidaPara(false, null), false);
});

test('politicaSugestao — evidência diluída entre muitas cotações fica em silêncio', () => {
  assert.equal(T.politicaSugestao(sug(cand(955, 0.65, 0.21), cand(970, 0.65, 0.21), cand(960, 0.6, 0.19))), 'silencio');   // fornecedor que atende várias
  assert.equal(T.politicaSugestao(sug(cand(955, 0.65, 0.32), cand(970, 0.65, 0.3), cand(960, 0.6, 0.2))), 'perguntar');     // ainda dá para escolher
});
