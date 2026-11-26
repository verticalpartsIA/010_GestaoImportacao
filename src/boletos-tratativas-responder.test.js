'use strict';
// Etapa 2 das tratativas (20/11/2026): resposta ao cliente por e-mail.
// Testa (a) o que a tela oferece (calc) e (b) a trava de destinatário da função, extraída do index.ts (bloco BEGIN/END RESPONDER).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = global.window || {};
require('./boletos-avisos-calc.js');
require('./boletos-tratativas-calc.js');
const T = window.BoletosTratativasCalc;

const fonte = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'boletos-avisos', 'index.ts'), 'utf8');
const bloco = fonte.slice(fonte.indexOf('// BEGIN RESPONDER'), fonte.indexOf('// END RESPONDER'));
assert.ok(bloco.includes('function validarResposta'), 'bloco RESPONDER não encontrado no index.ts');
const { validarResposta, REMETENTE_AUTOMATICO_RE } = new Function(bloco + '; return { validarResposta, REMETENTE_AUTOMATICO_RE };')();

const PERMITIDOS = ['financeiro@cliente.com', 'dono@cliente.com'];
const ok = (extra) => ({ para: ['financeiro@cliente.com'], assunto: 'Re: Boleto', texto: 'Segue a segunda via.', ...(extra || {}) });

test('trava: aceita e-mail do cliente e normaliza caixa e duplicados', () => {
  const r = validarResposta(ok({ para: ['Financeiro@Cliente.com', 'financeiro@cliente.com'] }), PERMITIDOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.para, ['financeiro@cliente.com']);
});

test('trava: recusa endereço que não é do cliente nem de quem respondeu', () => {
  const r = validarResposta(ok({ para: ['financeiro@cliente.com', 'alguem@outro.com'] }), PERMITIDOS);
  assert.equal(r.ok, false);
  assert.match(r.erro, /alguem@outro\.com/);
});

test('trava: sem destinatário, mais de 5, assunto e texto fora do limite', () => {
  assert.equal(validarResposta(ok({ para: [] }), PERMITIDOS).ok, false);
  const seis = Array.from({ length: 6 }, (_, i) => 'u' + i + '@cliente.com');
  assert.equal(validarResposta(ok({ para: seis }), seis).ok, false);
  assert.equal(validarResposta(ok({ assunto: 'a' }), PERMITIDOS).ok, false);
  assert.equal(validarResposta(ok({ assunto: 'x'.repeat(201) }), PERMITIDOS).ok, false);
  assert.equal(validarResposta(ok({ texto: '  ' }), PERMITIDOS).ok, false);
  assert.equal(validarResposta(ok({ texto: 'x'.repeat(8001) }), PERMITIDOS).ok, false);
});

test('trava: quebra de linha no assunto não passa (injeção de cabeçalho)', () => {
  const r = validarResposta(ok({ assunto: 'Re: Boleto\r\nBcc: fora@outro.com' }), PERMITIDOS);
  assert.equal(r.ok, true);
  assert.ok(!/[\r\n]/.test(r.assunto));
});

test('trava: corpo sem lista de permitidos não deixa passar ninguém', () => {
  assert.equal(validarResposta(ok(), []).ok, false);
  assert.equal(validarResposta(null, PERMITIDOS).ok, false);
});

test('remetente automático (devolução) nunca conta como destinatário possível', () => {
  assert.ok(REMETENTE_AUTOMATICO_RE.test('postmaster@cliente.com'));
  assert.ok(REMETENTE_AUTOMATICO_RE.test('MicrosoftExchange329e71ec88ae4615bbc36ab6ce41109e@x.com'));
  assert.ok(!REMETENTE_AUTOMATICO_RE.test('financeiro@cliente.com'));
});

test('tela: quem respondeu por último vem marcado; sem resposta, os e-mails do cliente', () => {
  const itens = [
    { tipo: 'resposta', quando: '2026-11-18T10:00:00Z', deEmail: 'antigo@cliente.com' },
    { tipo: 'resposta', quando: '2026-11-19T10:00:00Z', deEmail: 'Novo@Cliente.com' },
    { tipo: 'devolucao', quando: '2026-11-19T11:00:00Z', deEmail: 'postmaster@cliente.com' },
  ];
  const ops = T.opcoesDestinatarios(['financeiro@cliente.com'], itens);
  assert.deepEqual(ops.map(o => o.email), ['novo@cliente.com', 'financeiro@cliente.com', 'antigo@cliente.com']);
  assert.deepEqual(ops.filter(o => o.marcado).map(o => o.email), ['novo@cliente.com']);
  const semResposta = T.opcoesDestinatarios(['a@x.com', 'b@x.com', 'A@x.com'], []);
  assert.deepEqual(semResposta.map(o => [o.email, o.marcado]), [['a@x.com', true], ['b@x.com', true]]);
  assert.deepEqual(T.opcoesDestinatarios([], []), []);
});

test('tela: o assunto da resposta parte do último aviso, sem Re: repetido nem marca de teste', () => {
  const itens = [
    { tipo: 'aviso', quando: '2026-11-17T10:00:00Z', texto: 'Boleto antigo' },
    { tipo: 'aviso', quando: '2026-11-18T10:00:00Z', texto: '[MODO TESTE] Re: Seu boleto vence hoje' },
  ];
  assert.equal(T.assuntoDaResposta(itens), 'Re: Seu boleto vence hoje');
  assert.equal(T.assuntoDaResposta([]), 'Re: Boletos em aberto');
});
