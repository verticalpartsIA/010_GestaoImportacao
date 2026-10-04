'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./inbox-busca-calc.js');

const m = (o) => ({ from: 'glarie@x.cn', fromName: 'Kimmy Kuai', to: ['suporte@vpsistema.com'], cc: [], subject: 'Cotação técnica VPEL-EL0970',
  preview: 'Segue o preço unitário e o prazo de produção', anexos: [], date: '2026-10-03T12:00:00Z', numeroCotacao: 970, naoLida: false, estrela: false, ...o });
const acha = (texto, msg) => B.aplicar(msg, B.parseConsulta(texto));

test('parseConsulta — palavras soltas, frase exata e exclusão', () => {
  const q = B.parseConsulta('preço "prazo de produção" -spam');
  assert.deepEqual(q.termos, ['preco', 'prazo de producao']);
  assert.deepEqual(q.excluir, ['spam']);
});

test('parseConsulta — operadores em português e inglês', () => {
  const q = B.parseConsulta('de:kimmy from:glarie para:suporte assunto:cotação subject:VPEL cotacao:970 tem:anexo é:estrela depois:2026-10-01 antes:2026-10-31 em:enviados');
  assert.deepEqual(q.de, ['kimmy', 'glarie']);
  assert.deepEqual(q.para, ['suporte']);
  assert.deepEqual(q.assunto, ['cotacao', 'vpel']);
  assert.equal(q.cotacao, 970); assert.equal(q.anexo, true); assert.equal(q.estrela, true); assert.equal(q.em, 'sent');
  assert.equal(q.depois.getFullYear(), 2026); assert.equal(q.antes.getDate(), 31);
});

test('parseConsulta — valor com espaço entre aspas fica inteiro', () => {
  assert.deepEqual(B.parseConsulta('de:"Kimmy Kuai"').de, ['kimmy kuai']);
});

test('aplicar — sem acento e sem diferença de maiúsculas', () => {
  assert.equal(acha('PRECO', m()), true);
  assert.equal(acha('producao', m()), true);
  assert.equal(acha('inexistente', m()), false);
});

test('aplicar — de / para / assunto / cotação', () => {
  assert.equal(acha('de:kimmy', m()), true);
  assert.equal(acha('de:outra', m()), false);
  assert.equal(acha('para:suporte', m()), true);
  assert.equal(acha('assunto:vpel-el0970', m()), true);
  assert.equal(acha('cotacao:970', m()), true);
  assert.equal(acha('cotacao:955', m()), false);
});

test('aplicar — anexo, lida, estrela', () => {
  assert.equal(acha('tem:anexo', m()), false);
  assert.equal(acha('tem:anexo', m({ anexos: [{ filename: 'a.pdf' }] })), true);
  assert.equal(acha('é:nao-lida', m({ naoLida: true })), true);
  assert.equal(acha('é:nao-lida', m()), false);
  assert.equal(acha('é:lida', m()), true);
  assert.equal(acha('é:estrela', m({ estrela: true })), true);
  assert.equal(acha('é:estrela', m()), false);
});

test('aplicar — exclusão e datas', () => {
  assert.equal(acha('preço -produção', m()), false);
  assert.equal(acha('preço -fatura', m()), true);
  assert.equal(acha('depois:2026-10-01', m()), true);
  assert.equal(acha('depois:2026-10-05', m()), false);
  assert.equal(acha('antes:2026-10-03', m()), true);       // o dia inteiro conta
  assert.equal(acha('antes:2026-10-02', m()), false);
});

test('vazia — consulta sem nada não filtra', () => {
  assert.equal(B.vazia(B.parseConsulta('')), true);
  assert.equal(B.vazia(B.parseConsulta('   ')), true);
  assert.equal(B.vazia(B.parseConsulta('preço')), false);
  assert.equal(B.vazia(B.parseConsulta('em:enviados')), false);
});

test('montarConsulta — formulário avançado vira texto que a busca entende (ida e volta)', () => {
  const txt = B.montarConsulta({ de: 'Kimmy Kuai', assunto: 'cotação', contem: 'preço prazo', naoTem: 'spam', anexo: true, depois: '2026-10-01', em: 'enviados' });
  assert.equal(txt, 'de:"Kimmy Kuai" assunto:cotação preço prazo -spam tem:anexo depois:2026-10-01 em:enviados');
  const q = B.parseConsulta(txt);
  assert.deepEqual(q.de, ['kimmy kuai']); assert.deepEqual(q.excluir, ['spam']); assert.equal(q.anexo, true); assert.equal(q.em, 'sent');
});

test('montarConsulta — "em: todos" não gera operador', () => {
  assert.equal(B.montarConsulta({ em: 'todos' }), '');
});

test('ordenar — padrão é só por data; os outros tipos põem o grupo no topo (recentes primeiro)', () => {
  const l = [m({ id: 'a', date: '2026-10-01T10:00:00Z', estrela: true }), m({ id: 'b', date: '2026-10-03T10:00:00Z' }), m({ id: 'c', date: '2026-10-02T10:00:00Z', estrela: true })];
  const f = { naoLida: () => false, estrela: (x) => x.estrela, importante: () => false };
  assert.deepEqual(B.ordenar(l, 'padrao', f).map((x) => x.id), ['b', 'c', 'a']);
  assert.deepEqual(B.ordenar(l, 'estrela', f).map((x) => x.id), ['c', 'a', 'b']);
  assert.deepEqual(l.map((x) => x.id), ['a', 'b', 'c']);       // não altera a lista original
});

/* ---- Fase 4A: marcador:, em:spam, em:adiados ---- */
test('marcador: — casa pelo nome do marcador (sem acento, parcial); sem marcador não passa', () => {
  const com = m({ marcadoresNomes: ['Aguardando Fornecedor', 'Urgente'] });
  assert.equal(acha('marcador:aguardando', com), true);
  assert.equal(acha('label:urgente', com), true);
  assert.equal(acha('marcador:aguardando marcador:urgente', com), true);      // todos precisam existir
  assert.equal(acha('marcador:financeiro', com), false);
  assert.equal(acha('marcador:urgente', m()), false);
  assert.equal(B.vazia(B.parseConsulta('marcador:urgente')), false);
});

test('em:spam e em:adiados viram pastas', () => {
  assert.equal(B.parseConsulta('em:spam').em, 'spam');
  assert.equal(B.parseConsulta('em:adiados').em, 'adiados');
  assert.equal(B.parseConsulta('in:snoozed').em, 'adiados');
});
