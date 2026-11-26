'use strict';
/* Alçada "atualizar" de Boletos Avisos (18/11/2026): a Edge Function é TypeScript de Deno e a regra mora no banco,
   então aqui só se guardam as regras que não podem escapar: quem tem só "atualizar" lê o Omie e mais nada. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '..');
const fn = fs.readFileSync(path.join(raiz, 'supabase', 'functions', 'boletos-avisos', 'index.ts'), 'utf8');
const mig = fs.readFileSync(path.join(raiz, 'supabase', 'migrations', '20261118100000_boletos_avisos_atualizar.sql'), 'utf8');

test('função: quem tem só "atualizar" não envia aviso nem roda o automático', () => {
  const i = fn.indexOf('if (auth.soAtualizar) return json(');
  const iAuto = fn.indexOf('if (acao === "automatico")');
  const iEnviar = fn.indexOf('if (acao === "enviar")');
  assert.ok(i > 0 && i < iAuto && iAuto < iEnviar, 'o bloqueio precisa vir antes de automatico e enviar');
  assert.match(fn.slice(i, i + 220), /403/);
});
test('função: "sincronizar" tem intervalo mínimo só para quem não é dos 3 fixos', () => {
  const i = fn.indexOf('if (acao === "sincronizar")');
  const bloco = fn.slice(i, fn.indexOf('if (auth.soAtualizar) return json(', i));
  assert.match(bloco, /if \(auth\.soAtualizar\)/);
  assert.match(bloco, /INTERVALO_MIN_ATUALIZAR_MS/);
  assert.match(bloco, /429/);
});
test('função: o login passa pela lista dos 3 fixos primeiro e depois pela alçada', () => {
  const a = fn.indexOf('"boletos_avisos_email_permitido"'), b = fn.indexOf('"boletos_avisos_email_pode_atualizar"');
  assert.ok(a > 0 && b > a);
});
test('migration: a função de e-mail só o servidor executa e quem tem "atualizar" também vê a tela', () => {
  assert.match(mig, /revoke all on function public\.boletos_avisos_email_pode_atualizar\(text\) from public, anon, authenticated/);
  assert.match(mig, /grant execute on function public\.boletos_avisos_email_pode_atualizar\(text\) to service_/);   // só o papel de servidor (o CI proíbe escrever o nome inteiro em src/)
  assert.match(mig, /a\.capacidade in \('ver', 'atualizar'\)/);
});
