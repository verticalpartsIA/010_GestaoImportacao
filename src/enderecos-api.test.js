'use strict';
// Testa a validação de CPF/CNPJ de src/enderecos-api.js (IIFE que grava window.EnderecoAPI) — números sintéticos conhecidos.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ctx = { window: {}, console, fetch: async () => { throw new Error('sem rede nos testes'); }, setTimeout, clearTimeout, AbortController };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, 'enderecos-api.js'), 'utf8'), ctx);
const A = ctx.window.EnderecoAPI;

test('CPF — confere dígitos verificadores; recusa sequência repetida e tamanho errado', () => {
  assert.equal(A.isCpfValido('529.982.247-25'), true);
  assert.equal(A.isCpfValido('52998224725'), true);
  assert.equal(A.isCpfValido('529.982.247-26'), false);     // último dígito errado
  assert.equal(A.isCpfValido('111.111.111-11'), false);
  assert.equal(A.isCpfValido('1234567890'), false);
});

test('CNPJ — confere dígitos verificadores; recusa sequência repetida e tamanho errado', () => {
  assert.equal(A.isCnpjValido('11.222.333/0001-81'), true);
  assert.equal(A.isCnpjValido('11444777000161'), true);
  assert.equal(A.isCnpjValido('11.222.333/0001-82'), false);
  assert.equal(A.isCnpjValido('00.000.000/0000-00'), false);
  assert.equal(A.isCnpjValido('1122233300018'), false);
});

test('validarDocumento — o número precisa combinar com o tipo escolhido na lista', () => {
  assert.equal(JSON.stringify(A.validarDocumento('PF', '529.982.247-25')), JSON.stringify({ ok: true, digitos: '52998224725', msg: '' }));
  assert.equal(JSON.stringify(A.validarDocumento('PJ', '11.222.333/0001-81')), JSON.stringify({ ok: true, digitos: '11222333000181', msg: '' }));
  assert.equal(A.validarDocumento('PJ', '').ok, true);                           // vazio = documento pendente
  const pfComCnpj = A.validarDocumento('PF', '11.222.333/0001-81');
  assert.equal(pfComCnpj.ok, false); assert.match(pfComCnpj.msg, /parece um CNPJ/); assert.match(pfComCnpj.msg, /Pessoa Jurídica/);
  const pjComCpf = A.validarDocumento('PJ', '529.982.247-25');
  assert.equal(pjComCpf.ok, false); assert.match(pjComCpf.msg, /parece um CPF/); assert.match(pjComCpf.msg, /Pessoa Física/);
  const dvErrado = A.validarDocumento('PJ', '11.222.333/0001-82');
  assert.equal(dvErrado.ok, false); assert.match(dvErrado.msg, /dígitos verificadores/);
  assert.equal(A.validarDocumento('PF', '123').ok, false);
});
