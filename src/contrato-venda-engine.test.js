'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./contrato-venda-engine.js');
const CV = window.CV;

function preamboloTexto(doc) {
  const preambulo = doc.sections.find((s) => s.id === 'preambulo');
  return preambulo.body.map((p) => p.text).join('\n');
}

test('buildContract — escapa payload de XSS no nome/endereço do comprador (preâmbulo)', () => {
  const doc = CV.buildContract({
    form: { tipoEquip: 'ELEVADOR', qtd: 1 },
    comprador: { razao: '<script>alert(1)</script>', endereco: '<img src=x onerror=alert(2)>' },
    valor: 100000,
  });
  const texto = preamboloTexto(doc);
  assert.ok(!texto.includes('<script>'), 'não deve conter <script> cru');
  assert.ok(!texto.includes('<img'), 'não deve conter <img> cru');
  assert.ok(texto.includes('&lt;script&gt;'), 'deve conter a versão escapada');
});

test('buildContract — escapa payload no cargo/e-mail de contato do comprador (cláusula 10.1)', () => {
  const doc = CV.buildContract({
    form: { tipoEquip: 'ELEVADOR', qtd: 1 },
    comprador: { rep: 'Fulano', repCargo: '"><svg onload=alert(1)>', email: 'a@a.com' },
    valor: 100000,
  });
  const clausula = doc.sections.flatMap((s) => s.body).find((p) => p.text && p.text.includes('Dados do COMPRADOR'));
  assert.ok(clausula, 'cláusula de contatos deve existir');
  assert.ok(!clausula.text.includes('<svg'), 'não deve conter <svg> cru');
});

test('buildContract — descrição do equipamento com payload é escapada na cláusula do objeto', () => {
  const doc = CV.buildContract({
    form: { tipoEquip: 'ELEVADOR', qtd: 1, modelo: '<script>x</script>' },
    comprador: { razao: 'Cliente Normal LTDA' },
    valor: 100000,
  });
  const objeto = doc.sections.flatMap((s) => s.body).find((p) => p.text && p.text.includes('Compra e venda de'));
  assert.ok(!objeto.text.includes('<script>x</script>'));
});

test('buildContract — texto normal (sem caracteres especiais) passa direto, sem alterar conteúdo', () => {
  const doc = CV.buildContract({
    form: { tipoEquip: 'ELEVADOR', qtd: 1 },
    comprador: { razao: 'Shopping Center Aricanduva Ltda.', endereco: 'Av. Aricanduva, 5555' },
    valor: 100000,
  });
  const texto = preamboloTexto(doc);
  assert.ok(texto.includes('Shopping Center Aricanduva Ltda.'));
  assert.ok(texto.includes('Av. Aricanduva, 5555'));
});

test('buildContract — doc.meta.descEq permanece SEM escape (consumido como texto puro em contrato-venda.jsx, não em html:true)', () => {
  const doc = CV.buildContract({
    form: { tipoEquip: 'ELEVADOR', qtd: 1, modelo: 'Elevador & Cia' },
    comprador: { razao: 'Cliente' },
    valor: 100000,
  });
  assert.ok(doc.meta.descEq.includes('&'), 'meta.descEq deve manter o "&" cru, não "&amp;"');
});
