'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./solicitacoes-produto-timeline-calc.js');
const T = window.SolProdTimeline;

test('listas de quem pode ser avisado: 4 da Engenharia (Brayan = automacao@) e 3 da Importação', () => {
  assert.deepEqual(T.ENGENHARIA.map((p) => p.nome), ['Gelson Simoes', 'Alexandre Schmidt', 'Vinicius Leite', 'Brayan Souza']);
  assert.equal(T.pessoa(T.ENGENHARIA, 'AUTOMACAO@verticalparts.com.br').nome, 'Brayan Souza');
  assert.deepEqual(T.IMPORTACAO.map((p) => p.nome), ['Andreia Oliveira', 'Beatriz Anderson', 'Bianca Mayumi']);
});

test('escolhaValida: só aceita pessoa da lista da etapa', () => {
  assert.equal(T.escolhaValida(T.ENGENHARIA, 'alexandre@verticalparts.com.br'), true);
  assert.equal(T.escolhaValida(T.ENGENHARIA, 'beatriz@verticalparts.com.br'), false);
  assert.equal(T.escolhaValida(T.IMPORTACAO, ''), false);
  assert.equal(T.escolhaValida(T.IMPORTACAO, null), false);
});

test('frase: avisado e executor são pessoas diferentes e aparecem separados', () => {
  const aviso = { tipo: 'aviso_engenharia', ator_nome: 'Guilherme Garcia', alvo_nome: 'Brayan Souza' };
  assert.match(T.frase(aviso), /^Brayan Souza foi avisado\(a\) para criar a Ficha Técnica \(escolhido\(a\) por Guilherme Garcia\)$/);
  const criou = { tipo: 'ficha_criada', ator_nome: 'Alexandre Schmidt' };
  assert.equal(T.frase(criou), 'Alexandre Schmidt criou a Ficha Técnica');
  const impo = { tipo: 'aviso_importacao', ator_nome: 'Alexandre Schmidt', alvo_nome: 'Andreia Oliveira' };
  assert.match(T.frase(impo), /Andreia Oliveira foi avisado\(a\) para conferir o NCM e publicar no Omie \(escolhido\(a\) por Alexandre Schmidt\)/);
  const pub = { tipo: 'ficha_publicada', ator_nome: 'Beatriz Anderson', detalhe: { codigo_produto: 'VPEL-739' } };
  assert.equal(T.frase(pub), 'Beatriz Anderson publicou no Omie (VPEL-739)');
});

test('frase: aviso que não saiu não diz que a pessoa foi avisada', () => {
  const ev = { tipo: 'aviso_engenharia', ator_nome: 'Guilherme Garcia', alvo_nome: 'Brayan Souza', detalhe: { aviso_enviado: false } };
  assert.equal(T.frase(ev), 'O aviso para Brayan Souza NÃO saiu (escolhido(a) por Guilherme Garcia)');
});

test('frase: aviso antigo automático não diz que alguém escolheu', () => {
  const eng = { tipo: 'aviso_engenharia', ator_nome: 'Guilherme Garcia', alvo_nome: 'Mauricio Araujo', detalhe: { automatico: true } };
  assert.equal(T.frase(eng), 'Mauricio Araujo foi avisado(a) automaticamente para criar a Ficha Técnica (regra antiga, sem escolha)');
  const imp = { tipo: 'aviso_importacao', ator_nome: 'Guilherme Garcia', alvo_nome: 'Bianca Mayumi', detalhe: { automatico: true } };
  assert.ok(!/escolhido/.test(T.frase(imp)));
});

test('frase: republicação e nome ausente (cai no e-mail, depois em "Alguém")', () => {
  assert.equal(T.frase({ tipo: 'ficha_publicada', ator_nome: 'Andreia Oliveira', detalhe: { acao: 'republicou ficha no Omie' } }), 'Andreia Oliveira republicou no Omie');
  assert.equal(T.frase({ tipo: 'aberta', ator_nome: '', ator_email: 'x@verticalparts.com.br' }), 'x@verticalparts.com.br abriu a solicitação');
  assert.equal(T.frase({ tipo: 'analise_iniciada' }), 'Alguém iniciou a análise');
});

const estados = (sol, evs) => T.etapasDoCiclo(sol, evs).map((e) => e.estado).join(',');

test('etapasDoCiclo: Recebido sempre feito; a próxima etapa é a atual', () => {
  assert.equal(estados({ id: 1 }, []), 'feito,atual,pendente,pendente');
  assert.equal(estados({ id: 1, ficha_tecnica_id: 'f1' }, []), 'feito,feito,atual,pendente');
  assert.equal(estados({ id: 1, ficha_tecnica_id: 'f1' }, [{ tipo: 'aviso_importacao' }]), 'feito,feito,feito,atual');
  assert.equal(estados({ id: 1, ficha_tecnica_id: 'f1' }, [{ tipo: 'aviso_importacao' }, { tipo: 'ficha_publicada' }]), 'feito,feito,feito,feito');
});

test('etapasDoCiclo: publicar sem aviso registrado não deixa Importação como atual', () => {
  assert.equal(estados({ id: 1 }, [{ tipo: 'ficha_publicada' }]), 'feito,feito,feito,feito');
});

test('etapasDoCiclo: sem leitura dos eventos, Importação e Cadastro ficam desconhecidos', () => {
  assert.equal(estados({ id: 1, ficha_tecnica_id: 'f1' }, null), 'feito,feito,desconhecido,desconhecido');
  assert.equal(estados({ id: 1 }, null), 'feito,atual,desconhecido,desconhecido');
});

test('ordenar: do mais antigo para o mais novo, sem alterar a lista original', () => {
  const evs = [{ tipo: 'b', criado_em: '2026-10-27T10:00:00Z' }, { tipo: 'a', criado_em: '2026-10-19T10:00:00Z' }];
  assert.deepEqual(T.ordenar(evs).map((e) => e.tipo), ['a', 'b']);
  assert.equal(evs[0].tipo, 'b');
});

test('resumo: título do aviso difere entre pedidos e é cortado em palavra inteira', () => {
  assert.equal(T.resumo('Rolete para correia Poly-V'), 'Rolete para correia Poly-V');
  const longo = T.resumo('Placa de monitoramento EMS Otis modelo GCEB1 para elevador legado', 40);
  assert.ok(longo.length <= 40 && longo.endsWith('…'), longo);
  assert.notEqual(T.resumo('Rolete A'), T.resumo('Rolete B'));
});

/* ---- Devolução com pendência (chat interno) ---- */
const iso = (d) => d.toISOString();

test('rotuloPendencia: texto da marca por destino', () => {
  assert.equal(T.rotuloPendencia('engenharia'), 'Devolvida à Engenharia — pendente de resposta');
  assert.equal(T.rotuloPendencia('solicitante'), 'Devolvida ao Solicitante — pendente de resposta');
  assert.equal(T.rotuloPendencia('importacao'), 'Devolvida à Importação — pendente de resposta');
  assert.equal(T.rotuloPendencia(null), '');
});

test('podeDevolver: 1ª volta só antes da Ficha e só a Engenharia; uma pendência por vez', () => {
  const sol = { status: 'em_analise' };
  assert.equal(T.podeDevolver('solicitante', sol, 'alexandre@verticalparts.com.br', false).ok, true);
  assert.equal(T.podeDevolver('solicitante', sol, 'beatriz@verticalparts.com.br', false).ok, false);
  assert.equal(T.podeDevolver('solicitante', { status: 'convertido_em_ficha' }, 'alexandre@verticalparts.com.br', false).ok, false);
  assert.equal(T.podeDevolver('solicitante', { status: 'em_analise', pendente_com: 'solicitante' }, 'alexandre@verticalparts.com.br', false).ok, false);
});

test('podeDevolver: Importação → Engenharia só depois da Ficha e antes de publicar', () => {
  const sol = { status: 'convertido_em_ficha' };
  assert.equal(T.podeDevolver('engenharia', sol, 'bianca@verticalparts.com.br', false, false).ok, true);
  assert.equal(T.podeDevolver('engenharia', sol, 'bianca@verticalparts.com.br', false, true).ok, false);
  assert.equal(T.podeDevolver('engenharia', sol, 'alexandre@verticalparts.com.br', false, false).ok, false);
  assert.equal(T.podeDevolver('engenharia', { status: 'em_analise' }, 'bianca@verticalparts.com.br', false, false).ok, false);
  assert.equal(T.podeDevolver('importacao', sol, 'alexandre@verticalparts.com.br', false, false).ok, true);
  assert.equal(T.podeDevolver('engenharia', sol, 'qualquer@x.com', true, false).ok, true); // Administrador
});

test('podeResponder: só o solicitante na 1ª volta; qualquer um do departamento nas demais; Administrador passa', () => {
  const volta1 = { pendente_com: 'solicitante', solicitante_email: 'Guilherme@verticalparts.com.br' };
  assert.equal(T.podeResponder(volta1, 'guilherme@verticalparts.com.br', false), true);
  assert.equal(T.podeResponder(volta1, 'alexandre@verticalparts.com.br', false), false);
  assert.equal(T.podeResponder(volta1, 'outro@x.com', true), true);
  const volta2 = { pendente_com: 'engenharia', solicitante_email: 'g@x.com' };
  assert.equal(T.podeResponder(volta2, 'brayan-nao-existe@x.com', false), false);
  assert.equal(T.podeResponder(volta2, 'automacao@verticalparts.com.br', false), true);
  assert.equal(T.podeResponder({ pendente_com: 'importacao' }, 'andreia.oliveira@verticalparts.com.br', false), true);
  assert.equal(T.podeResponder({ pendente_com: null }, 'automacao@verticalparts.com.br', true), false);
});

test('prazoDevolucao: 4 h comerciais, 09–17 h de Brasília, seg–sex', () => {
  // Seg 03/11/2026 10:00 BRT (13:00Z) → 14:00 BRT mesmo dia
  assert.equal(iso(T.prazoDevolucao('2026-11-02T13:00:00Z')), '2026-11-02T17:00:00.000Z');
  // Seg 15:00 BRT (18:00Z): 2 h hoje (até 17h) + 2 h na terça às 09h → 11:00 BRT da terça
  assert.equal(iso(T.prazoDevolucao('2026-11-02T18:00:00Z')), '2026-11-03T14:00:00.000Z');
  // Antes das 09h: conta a partir das 09h (seg 07:00 BRT → 13:00 BRT)
  assert.equal(iso(T.prazoDevolucao('2026-11-02T10:00:00Z')), '2026-11-02T16:00:00.000Z');
  // Sexta 16:00 BRT (19:00Z): 1 h na sexta + 3 h na segunda 09h → 12:00 BRT da segunda
  assert.equal(iso(T.prazoDevolucao('2026-11-06T19:00:00Z')), '2026-11-09T15:00:00.000Z');
  // Sábado vai para segunda 09h → 13:00 BRT
  assert.equal(iso(T.prazoDevolucao('2026-11-07T15:00:00Z')), '2026-11-09T16:00:00.000Z');
});

test('prazoDevolucao: feriado que conta no SLA é pulado', () => {
  // Sexta 06/11 16:00 BRT; segunda 09/11 feriado → 1 h sexta + 3 h terça 09h = 12:00 BRT terça
  assert.equal(iso(T.prazoDevolucao('2026-11-06T19:00:00Z', ['2026-11-09'])), '2026-11-10T15:00:00.000Z');
});

test('emAtraso: só depois do prazo', () => {
  assert.equal(T.emAtraso('2026-11-02T17:00:00Z', '2026-11-02T16:59:00Z'), false);
  assert.equal(T.emAtraso('2026-11-02T17:00:00Z', '2026-11-02T17:01:00Z'), true);
  assert.equal(T.emAtraso(null, '2026-11-02T17:01:00Z'), false);
});

test('frase: devolução cita o destino e, se houver, o nome citado', () => {
  assert.equal(T.frase({ tipo: 'devolvida', ator_nome: 'Bianca Mayumi', detalhe: { para: 'engenharia' } }), 'Bianca Mayumi devolveu à Engenharia');
  assert.equal(T.frase({ tipo: 'devolvida', ator_nome: 'Alexandre Schmidt', alvo_nome: 'Andreia Oliveira', detalhe: { para: 'importacao' } }), 'Alexandre Schmidt devolveu à Importação (citou Andreia Oliveira)');
  assert.equal(T.frase({ tipo: 'devolucao_respondida', ator_nome: 'Guilherme Garcia' }), 'Guilherme Garcia respondeu a devolução');
});
