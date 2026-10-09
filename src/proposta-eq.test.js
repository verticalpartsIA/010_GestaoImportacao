/* ============================================================
   proposta-eq.test.js — resolverEq / normalizarEq (proposta-store.js)

   Por que estes testes existem: até 21/08 todo mundo decidia o tipo do
   equipamento com `proposal_type || 'elevador'`. Mas esse campo está
   NULO em 290 das 311 propostas (todas as importadas do sistema antigo)
   e, nas 21 que têm valor, foi gravado em 3 formatos diferentes
   ("elevador", "Elevador de Passageiros", "Escada Rolante"). Resultado:
   16 propostas de Escada e 24 de Esteira abriam — e geravam PDF — com o
   layout de ELEVADOR.
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

/* proposta-store.js é um IIFE de browser (usa window/Supabase), então
   extraímos só as 3 funções puras em vez de carregar o arquivo. Mesmo
   padrão já usado nos outros testes deste projeto. */
const src = fs.readFileSync(path.join(__dirname, 'proposta-store.js'), 'utf8');
function extrair(nome) {
  const i = src.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('função não encontrada em proposta-store.js: ' + nome);
  let d = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) break; }
  }
  return src.slice(i, j + 1);
}
eval(extrair('normalizarEq'));
eval(extrair('temUnidade'));
eval(extrair('resolverEq'));

/* ---------- normalizarEq: os 3 formatos realmente gravados ---------- */
test('normalizarEq — aceita os 3 formatos que existem no banco', () => {
  assert.equal(normalizarEq('elevador'), 'elevador');
  assert.equal(normalizarEq('Elevador de Passageiros'), 'elevador');
  assert.equal(normalizarEq('Escada Rolante'), 'escada');
});

test('normalizarEq — nulo/vazio/desconhecido não inventa tipo', () => {
  assert.equal(normalizarEq(null), null);
  assert.equal(normalizarEq(''), null);
  assert.equal(normalizarEq('Guindaste'), null);
});

/* ---------- o conteúdo manda mais que o campo ---------- */
test('resolverEq — legada de Escada com proposal_type NULO vira escada (o bug de 21/08)', () => {
  const convertido = { escada: { especificacoes: [{ id: 'E1' }] } };
  assert.equal(resolverEq({ proposal_type: null, titulo: 'CETENCO - Escada' }, convertido), 'escada');
});

test('resolverEq — legada de Esteira com proposal_type NULO vira esteira', () => {
  const convertido = { esteira: { especificacoes: [{ id: 'E1' }] } };
  assert.equal(resolverEq({ proposal_type: null, titulo: 'X - Esteira' }, convertido), 'esteira');
});

/* ---------- REGRESSÃO: proposta nova traz os 3 blocos preenchidos ----------
   Toda proposta nova nasce com elevador/escada/esteira já populados de
   textos padrão. Um teste de "tem alguma coisa preenchida?" acusaria
   escada numa proposta de elevador — por isso o critério é UNIDADE. */
test('resolverEq — proposta NOVA de elevador não vira escada por causa dos textos padrão', () => {
  const nova = {
    elevador: { especificacoes: [{ id: 'E1' }], garantia: { garantia: 'texto padrão' } },
    escada:   { especificacoes: [], garantia: { garantia: 'texto padrão da escada' }, valores: { parcelas: [] } },
    esteira:  { especificacoes: [], garantia: { garantia: 'texto padrão da esteira' }, valores: { parcelas: [] } },
  };
  assert.equal(resolverEq({ proposal_type: null, titulo: 'Cliente X' }, nova), 'elevador');
});

test('resolverEq — proposta nova de escada é detectada pela unidade', () => {
  const nova = {
    elevador: { especificacoes: [], garantia: { garantia: 'padrão' } },
    escada:   { especificacoes: [{ id: 'E1' }], garantia: { garantia: 'padrão' } },
    esteira:  { especificacoes: [], garantia: { garantia: 'padrão' } },
  };
  assert.equal(resolverEq({ proposal_type: null, titulo: 'Cliente X' }, nova), 'escada');
});

/* ---------- mesma ordem do converterPropostaLegado ----------
   As legadas guardam os 3 blocos no MESMO registro. O conversor testa
   elevador → escada → esteira; resolverEq tem que concordar com ele,
   senão a tela mostra um tipo e os dados são de outro. */
test('resolverEq — com mais de um bloco preenchido, segue a ordem do conversor (elevador primeiro)', () => {
  const ambos = {
    elevador: { especificacoes: [{ id: 'E1' }] },
    escada:   { especificacoes: [{ id: 'E2' }] },
  };
  assert.equal(resolverEq({ proposal_type: null, titulo: 'X - Escada' }, ambos), 'elevador');
});

/* ---------- sem unidade: cai pro campo, depois pro título ---------- */
test('resolverEq — sem unidade nenhuma, usa proposal_type', () => {
  const vazio = { elevador: { especificacoes: [] }, escada: { especificacoes: [] }, esteira: { especificacoes: [] } };
  assert.equal(resolverEq({ proposal_type: 'Escada Rolante', titulo: 'X' }, vazio), 'escada');
});

test('resolverEq — sem unidade e sem campo, usa o título (única pista das legadas)', () => {
  assert.equal(resolverEq({ proposal_type: null, titulo: 'CETENCO - Escada' }, null), 'escada');
  assert.equal(resolverEq({ proposal_type: null, titulo: 'X - Esteira' }, null), 'esteira');
});

test('resolverEq — sem nenhuma pista, elevador (maioria do catálogo)', () => {
  assert.equal(resolverEq({}, null), 'elevador');
  assert.equal(resolverEq(null, null), 'elevador');
});
