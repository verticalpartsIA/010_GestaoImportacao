'use strict';
/* A Edge Function sync-pcp-compras (que grava o custo por compras) usa uma CÓPIA do cálculo de src/custo-calc.js.
   Estes testes garantem que as duas cópias não divergem: o custo gravado no banco nunca pode ser diferente do que a tela calcularia. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');
function blocos(texto) {
  const out = [];
  const re = /\/\/ BEGIN CALC[^\n]*\n([\s\S]*?)\/\/ END CALC/g;
  let m;
  while ((m = re.exec(texto))) out.push(m[1].split('\n').map((l) => l.trim()).filter(Boolean).join('\n'));
  return out;
}

test('a função e o módulo têm 1 bloco de cálculo marcado cada', () => {
  assert.equal(blocos(ler('supabase/functions/sync-pcp-compras/index.ts')).length, 1);
  assert.equal(blocos(ler('src/custo-calc.js')).length, 1);
});

test('custoPorCompras na função == src/custo-calc.js', () => {
  const funcao = blocos(ler('supabase/functions/sync-pcp-compras/index.ts'));
  const tela = blocos(ler('src/custo-calc.js'));
  assert.equal(funcao[0], tela[0]);
});
