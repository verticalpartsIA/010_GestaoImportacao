'use strict';
// Testa src/tratativas-store.js — mão dupla Tratativas ⇄ Inbox (dados sintéticos, banco falso em memória).
// Chamado por: scripts/run-tests.js (npm test). Pedido do usuário (07/10/2026): "precisa ser mão dupla".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, 'tratativas-store.js'), 'utf8');

/* Banco falso: cada tabela é uma lista; .from(t).select().eq().is().not().order().limit() filtra de verdade. */
function bancoFalso(tabelas, invokes) {
  function consulta(linhas) {
    let rows = linhas.slice(); let unica = false;
    const q = {
      select() { return q; }, order() { return q; }, limit() { return q; },
      eq(c, v) { rows = rows.filter((r) => String(r[c]) === String(v)); return q; },
      is(c, v) { rows = rows.filter((r) => (v === null ? r[c] == null : r[c] === v)); return q; },
      not(c, op, v) { if (op === 'is' && v === null) rows = rows.filter((r) => r[c] != null); return q; },
      maybeSingle() { unica = true; return q; },
      then(res, rej) { return Promise.resolve({ data: unica ? (rows[0] || null) : rows, error: null }).then(res, rej); },
    };
    return q;
  }
  return {
    from: (t) => ({ ...consulta(tabelas[t] || []), insert: (obj) => ({ select: () => ({ single: async () => { const n = { id: 'novo', ...obj }; (tabelas[t] = tabelas[t] || []).push(n); return { data: n, error: null }; } }) }) }),
    functions: { invoke: async (nome, opts) => { invokes.push({ nome, opts }); return { data: { ok: true }, error: null }; } },
  };
}

function carrega(tabelas) {
  const invokes = [];
  const win = { __VP_SB: { sb: bancoFalso(tabelas, invokes) }, location: { origin: 'https://x.test' }, __VP_USER: { nome: 'Vagner' } };
  const ctx = { window: win, console, localStorage: { getItem: () => null }, sessionStorage: { getItem: () => null } };
  vm.runInNewContext(SRC, ctx);
  return { store: win.TratativasStore, invokes };
}

const plain = (x) => JSON.parse(JSON.stringify(x));   // objetos do vm têm outro protótipo
const COT = 'cot-1';
const FORM = 'FE-1';
const base = () => ({
  cotacoes_elevador_fornecedor: [{ id: COT, formulario_elevador_id: FORM, excluido_em: null, fornecedor: 'Glarie', recipient: { email: 'kimmy@glarie.com, sam@glarie.com' } }],
  fornecedores: [{ razao_social: 'GLARIE ELEVATOR CO.,LTD', nome_fantasia: 'GLARIE ELEVATOR CO.,LTD', email: 'cadastro@glarie.com' }],
  emails_projeto: [],
});

test('listarEmails: traz o que está ligado por referencia_id (entrada e saída) e some o aviso "Nova mensagem —"', async () => {
  const t = base();
  t.emails_projeto = [
    { id: 'a', direcao: 'saida', assunto: 'Cotação técnica 955', referencia_tipo: 'cotacao_fornecedor', referencia_id: COT, data_mensagem: '2026-09-11T19:00:00Z' },
    { id: 'b', direcao: 'entrada', assunto: 'Re: Cotação técnica 955', de_email: 'kimmy@glarie.com', referencia_tipo: 'cotacao_fornecedor', referencia_id: COT, data_mensagem: '2026-09-12T10:00:00Z' },
    { id: 'c', direcao: 'saida', assunto: 'Nova mensagem — Cotação Nº 955 — VerticalParts', referencia_tipo: 'tratativa_cotacao', referencia_id: COT, data_mensagem: '2026-09-14T18:00:00Z' },
    { id: 'd', direcao: 'saida', assunto: 'Re: ajuste', referencia_tipo: 'tratativa_cotacao', referencia_id: COT, data_mensagem: '2026-09-15T18:00:00Z' },
    { id: 'x', direcao: 'entrada', assunto: 'outro fornecedor', referencia_tipo: 'cotacao_fornecedor', referencia_id: 'cot-2', data_mensagem: '2026-09-16T18:00:00Z' },
  ];
  const { store } = carrega(t);
  const r = await store.listarEmails({ cotacaoFornecedorId: COT, numeroCotacao: 955, formularioId: FORM });
  assert.deepEqual(plain(r.map((e) => e.id)), ['a', 'b', 'd']);
});

test('listarEmails: e-mail só com o Nº entra quando há 1 fornecedor E o outro lado é contato da cotação; e-mail ao cliente não', async () => {
  const t = base();
  t.emails_projeto = [
    { id: 'n1', direcao: 'entrada', assunto: 'Re: price', de_email: 'Kimmy <kimmy@glarie.com>', referencia_id: null, numero_cotacao: 955, data_mensagem: '2026-09-20T10:00:00Z' },
    { id: 'n2', direcao: 'saida', assunto: 'TESTE', para: ['cliente@akai.com.br'], referencia_id: null, numero_cotacao: 955, data_mensagem: '2026-09-21T10:00:00Z' },
    { id: 'n3', direcao: 'saida', assunto: 'follow up', para: ['sam@glarie.com'], referencia_id: null, numero_cotacao: 955, data_mensagem: '2026-09-22T10:00:00Z' },
  ];
  const { store } = carrega(t);
  const r = await store.listarEmails({ cotacaoFornecedorId: COT, numeroCotacao: 955, formularioId: FORM });
  assert.deepEqual(plain(r.map((e) => e.id)), ['n1', 'n3']);
});

test('listarEmails: com 2+ fornecedores no formulário, e-mail só com o Nº NÃO entra (não dá pra saber de qual é)', async () => {
  const t = base();
  t.cotacoes_elevador_fornecedor.push({ id: 'cot-2', formulario_elevador_id: FORM, excluido_em: null, recipient: { email: 'x@outro.com' } });
  t.emails_projeto = [{ id: 'n1', direcao: 'entrada', de_email: 'kimmy@glarie.com', referencia_id: null, numero_cotacao: 955, data_mensagem: '2026-09-20T10:00:00Z' }];
  const { store } = carrega(t);
  assert.deepEqual(plain(await store.listarEmails({ cotacaoFornecedorId: COT, numeroCotacao: 955, formularioId: FORM })), []);
});

test('enviar: grava a tratativa e manda o e-mail com `body` (referência da cotação, vários contatos do RFQ)', async () => {
  const t = base();
  const { store, invokes } = carrega(t);
  const r = await store.enviar({ cotacaoFornecedorId: COT, numeroCotacao: 955, mensagem: 'Please update ST 304' });
  assert.equal(t.tratativas_cotacao.length, 1);
  assert.equal(r.__email.ok, true);
  assert.deepEqual(plain(r.__email.para), ['kimmy@glarie.com', 'sam@glarie.com']);
  const b = invokes[0].opts.body;
  assert.ok(b, 'o corpo do send-email tem que ir em `body` (antes ia solto e chegava vazio)');
  assert.equal(b.referenciaTipo, 'tratativa_cotacao');
  assert.equal(b.referenciaId, COT);
  assert.equal(b.numeroCotacao, 955);
  assert.match(b.subject, /Cotação Nº 955/);
  assert.match(b.text, /Please update ST 304/);
});

test('enviar: sem contato no RFQ, acha o cadastro por APROXIMAÇÃO ("Glarie" ~ "GLARIE ELEVATOR CO.,LTD")', async () => {
  const t = base();
  t.cotacoes_elevador_fornecedor[0].recipient = null;
  const { store } = carrega(t);
  const r = await store.enviar({ cotacaoFornecedorId: COT, numeroCotacao: 955, mensagem: 'oi' });
  assert.deepEqual(plain(r.__email.para), ['cadastro@glarie.com']);
});

test('enviar: sem nenhum e-mail, a mensagem fica registrada e o aviso diz que o e-mail NÃO saiu', async () => {
  const t = base();
  t.cotacoes_elevador_fornecedor[0].recipient = null; t.fornecedores = [];
  const { store, invokes } = carrega(t);
  const r = await store.enviar({ cotacaoFornecedorId: COT, numeroCotacao: 955, mensagem: 'oi' });
  assert.equal(t.tratativas_cotacao.length, 1);
  assert.equal(r.__email.ok, false);
  assert.equal(invokes.length, 0);
});
