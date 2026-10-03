'use strict';
/* O alerta automático (Edge Function alerta-pcp-compras) usa uma CÓPIA dos cálculos da Reposição e da Necessidade que rodam no
   navegador. Estes testes garantem que as cópias não divergem: o alerta nunca pode dizer uma coisa e a tela outra. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');
// Blocos entre "BEGIN CALC" e "END CALC" (cada arquivo do navegador tem 1; a função tem 2, na ordem Reposição → Necessidade).
function blocos(texto) {
  const out = [];
  const re = /\/\/ BEGIN CALC[^\n]*\n([\s\S]*?)\/\/ END CALC/g;
  let m;
  while ((m = re.exec(texto))) out.push(m[1].split('\n').map((l) => l.trim()).filter(Boolean).join('\n'));
  return out;
}

const funcao = blocos(ler('supabase/functions/alerta-pcp-compras/index.ts'));

test('a função tem os 2 blocos de cálculo marcados', () => {
  assert.equal(funcao.length, 2);
});

test('cálculo da Reposição na função == src/reposicao-calc.js', () => {
  const tela = blocos(ler('src/reposicao-calc.js'));
  assert.equal(tela.length, 1);
  assert.equal(funcao[0], tela[0]);
});

test('cálculo da Necessidade na função == src/necessidade-calc.js', () => {
  const tela = blocos(ler('src/necessidade-calc.js'));
  assert.equal(tela.length, 1);
  assert.equal(funcao[1], tela[0]);
});
