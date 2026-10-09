'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../server-lib/feedback-issue.js');

const base = {
  tipo: 'erro', gravidade: 'atrapalha', resumo: 'Botão Aprovar não responde',
  tela: 'Central de Decisões', rota: 'decisoes', caminho: '/geral/decisoes?x=1',
  fazendo: 'Tentando aprovar o envio da proposta', aconteceu: 'Cliquei em Aprovar e nada aconteceu',
  esperava: 'A decisão sair da lista', livre: '', contato: true, email: 'maria.souza@verticalparts.com.br',
};

test('primeiroNome usa só a primeira parte do e-mail', () => {
  assert.equal(F.primeiroNome('gelson.simoes@verticalparts.com.br'), 'Gelson');
  assert.equal(F.primeiroNome('JOAO_PAULO@x.com'), 'Joao');
  assert.equal(F.primeiroNome('ana-clara@x.com'), 'Ana');
  assert.equal(F.primeiroNome('vagner@x.com'), 'Vagner');
  assert.equal(F.primeiroNome('11.22@x.com'), 'Colaborador');
  assert.equal(F.primeiroNome(''), 'Colaborador');
  assert.equal(F.primeiroNome(null), 'Colaborador');
});

test('a issue nunca contém o e-mail completo nem o sobrenome', () => {
  const v = F.validar(base);
  assert.equal(v.ok, true);
  const { title, body } = F.montarIssue(v.dados, { versao: 'abc1234', navegador: 'Chrome' });
  assert.ok(body.includes('| **Colaborador** | Maria |'));
  assert.ok(!body.includes('souza') && !title.includes('souza'));
  assert.ok(!body.includes('verticalparts.com.br'));
});

test('menções e referências do texto livre são neutralizadas', () => {
  const v = F.validar({ ...base, aconteceu: 'Falei com @fulano sobre a #123 e <script>alert(1)</script>' });
  assert.equal(v.ok, true);
  assert.ok(!/@fulano/.test(v.dados.aconteceu));
  assert.ok(!/#123/.test(v.dados.aconteceu));
  assert.ok(!v.dados.aconteceu.includes('<script>'));
});

test('validação: tipo, gravidade (só para erro), resumo e descrição', () => {
  assert.equal(F.validar({ ...base, tipo: 'xx' }).ok, false);
  assert.equal(F.validar({ ...base, gravidade: 'zzz' }).ok, false);
  assert.equal(F.validar({ ...base, tipo: 'sugestao', gravidade: undefined }).ok, true);   // sugestão não exige gravidade
  assert.equal(F.validar({ ...base, resumo: 'abc' }).ok, false);
  assert.equal(F.validar({ ...base, aconteceu: '', livre: '' }).ok, false);
  assert.equal(F.validar({ ...base, aconteceu: '', livre: 'Texto livre com mais de dez letras' }).ok, true);
  assert.equal(F.validar(null).ok, false);
});

test('limites de tamanho são aplicados', () => {
  const v = F.validar({ ...base, resumo: 'x'.repeat(500), aconteceu: 'y'.repeat(9000) });
  assert.equal(v.ok, true);
  assert.equal(v.dados.resumo.length, F.LIMITES.resumo);
  assert.equal(v.dados.aconteceu.length, F.LIMITES.aconteceu);
});

test('caminho: só caminho do próprio app, sem query', () => {
  assert.equal(F.caminhoSeguro('/geral/decisoes?x=1#a'), '/geral/decisoes');
  assert.equal(F.caminhoSeguro('https://evil.com/x'), '');
  assert.equal(F.caminhoSeguro('javascript:alert(1)'), '');
});

test('endereço completo da tela entra na issue (origem do servidor + caminho)', () => {
  assert.equal(F.enderecoCompleto('https://vpgestaoimportacao.vpsistema.com', '/geral/decisoes'), 'https://vpgestaoimportacao.vpsistema.com/geral/decisoes');
  assert.equal(F.enderecoCompleto('http://localhost:3111', '/geral/decisoes'), 'http://localhost:3111/geral/decisoes');
  assert.equal(F.enderecoCompleto('javascript:alert(1)', '/geral/decisoes'), '/geral/decisoes');   // origem inválida: só o caminho
  assert.equal(F.enderecoCompleto('https://x.com/path', '/a'), '/a');                                // origem com caminho não vale
  assert.equal(F.enderecoCompleto('https://x.com', ''), '');
  const v = F.validar(base);
  const { body } = F.montarIssue(v.dados, { baseUrl: 'https://vpgestaoimportacao.vpsistema.com' });
  assert.ok(body.includes('| **Endereço da tela** | https://vpgestaoimportacao.vpsistema.com/geral/decisoes |'));
  assert.ok(!body.includes('x=1'));   // a query do formulário (?x=1) nunca vai
});

test('etiquetas e título da issue', () => {
  const v = F.validar(base);
  const { title, labels } = F.montarIssue(v.dados, {});
  assert.equal(title, '[Feedback] Central de Decisões — Botão Aprovar não responde');
  assert.deepEqual(labels, ['feedback', 'aguardando-gestor', 'bug', 'gravidade:atrapalha', 'tela:decisoes']);
  const d = F.validar({ ...base, tipo: 'duvida' });
  assert.deepEqual(F.montarIssue(d.dados).labels, ['feedback', 'aguardando-gestor', 'question', 'tela:decisoes']);
});

test('seções vazias não aparecem no corpo', () => {
  const v = F.validar({ ...base, fazendo: '', esperava: '' });
  const { body } = F.montarIssue(v.dados, {});
  assert.ok(body.includes('### O que aconteceu'));
  assert.ok(!body.includes('### O que a pessoa estava fazendo'));
  assert.ok(!body.includes('### O que esperava'));
});

test('títulos das seções acompanham o tipo (dúvida e sugestão não falam em "o que aconteceu")', () => {
  const d = F.validar({ ...base, tipo: 'duvida', esperava: '' });
  const b = F.montarIssue(d.dados, {}).body;
  assert.ok(b.includes('### Qual é a dúvida') && b.includes('### O que a pessoa está tentando fazer'));
  assert.ok(!b.includes('### O que aconteceu'));
  const s = F.validar({ ...base, tipo: 'sugestao', esperava: '' });
  assert.ok(F.montarIssue(s.dados, {}).body.includes('### Qual é a ideia'));
});

test('limitador: bloqueia depois do máximo e libera quando a janela passa', () => {
  const lim = F.criarLimitador({ max: 2, janelaMs: 1000 });
  assert.equal(lim('ip', 0), true);
  assert.equal(lim('ip', 10), true);
  assert.equal(lim('ip', 20), false);
  assert.equal(lim('outro', 20), true);
  assert.equal(lim('ip', 1500), true);
});
