const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const editor = fs.readFileSync(path.join(__dirname, 'proposta-editor.jsx'), 'utf8');
const entryPdf = fs.readFileSync(path.join(__dirname, '..', 'pdf-bundle', 'proposta-reactpdf.entry.js'), 'utf8');

test('texto-padrão: serviços valem 30% fixo do preço total', () => {
  assert.ok(editor.includes('A parcela correspondente a serviços será de 30% (trinta por cento) do preço total do fornecimento.'));
  assert.ok(!editor.includes('pode chegar em até 30%'));
});

test('texto-padrão: exclusões não citam DIFAL (a proposta nunca mostra DIFAL)', () => {
  const m = /taxasExcluidas: "([^"]*)"/.exec(editor);
  assert.ok(m, 'taxasExcluidas padrão existe');
  assert.ok(!/difal/i.test(m[1]));
  assert.ok(m[1].includes('o preço será revisto na proporção do impacto comprovado'));
});

test('texto-padrão: itens de exemplo não nascem dentro de proposta real', () => {
  assert.ok(!/gearless de alta eficiência|MAX-3000|NBR 16858|central 24h/.test(editor));
});

test('PDF: instrução interna dos acabamentos nunca é impressa para o cliente', () => {
  assert.ok(!entryPdf.includes('Preencha os acabamentos'));
});
