/* ============================================================
   proposta-form-espec.test.js — issue #704

   S_EspecElevador (proposta-form.jsx) é componente JSX puro de UI —
   este projeto não tem harness de teste de componente React (nenhum
   dos componentes S_* tem teste próprio hoje; verificação de JSX é
   feita por build/transform + clique real, nunca node:test). Este
   teste cobre o que DÁ pra testar sem renderizar: que o formulário usa
   exatamente os mesmos nomes de campo (tensao/tracao/dimensoesCabine)
   que proposta-heranca.js produz e proposta-preview.jsx exibe — um
   nome de campo divergente entre os 3 arquivos deixaria o dado
   herdado silenciosamente invisível no formulário.
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const formSrc = fs.readFileSync(path.join(__dirname, 'proposta-form.jsx'), 'utf8');

function trechoDe(nomeFuncao) {
  const i = formSrc.indexOf('function ' + nomeFuncao + '(');
  assert.ok(i >= 0, `função ${nomeFuncao} não encontrada em proposta-form.jsx`);
  /* Os componentes S_* desestruturam os parâmetros (ex.: `({ d, set })`),
     então a 1ª `{` depois do nome é a dos parâmetros, não a do corpo da
     função — tem que achar o `{` do corpo só DEPOIS do `)` que fecha a
     lista de parâmetros, senão o corte termina cedo demais. */
  const fechaParams = formSrc.indexOf(')', formSrc.indexOf('(', i));
  let d = 0, j = formSrc.indexOf('{', fechaParams);
  for (; j < formSrc.length; j++) {
    if (formSrc[j] === '{') d++;
    else if (formSrc[j] === '}') { d--; if (!d) break; }
  }
  return formSrc.slice(i, j + 1);
}

test('S_EspecElevador — tem campo editável para tensão, tração e dimensões da cabine', () => {
  const corpo = trechoDe('S_EspecElevador');
  assert.match(corpo, /it\.tensao\b/, 'falta ligação com it.tensao');
  assert.match(corpo, /it\.tracao\b/, 'falta ligação com it.tracao');
  assert.match(corpo, /it\.dimensoesCabine\b/, 'falta ligação com it.dimensoesCabine');
});

test('S_EspecElevador — "+ Adicionar Unidade" nasce já com os 3 campos novos (senão o 1º save teria undefined)', () => {
  const corpo = trechoDe('S_EspecElevador');
  const addFn = corpo.slice(corpo.indexOf('const add ='));
  assert.match(addFn, /tensao:\s*""/, 'objeto padrão de nova unidade não inicializa tensao');
  assert.match(addFn, /tracao:\s*""/, 'objeto padrão de nova unidade não inicializa tracao');
  assert.match(addFn, /dimensoesCabine:\s*""/, 'objeto padrão de nova unidade não inicializa dimensoesCabine');
});
