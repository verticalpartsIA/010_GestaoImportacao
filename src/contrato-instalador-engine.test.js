'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('./contrato-instalador-engine.js');
const CI = window.CI;

test('CNPJ/CPF — valida dígito verificador, não só o tamanho', () => {
  assert.equal(CI.isCNPJValid('15.822.325/0001-27'), true);
  assert.equal(CI.isCNPJValid('15.822.325/0001-28'), false);
  assert.equal(CI.isCNPJValid('11.111.111/1111-11'), false);
  assert.equal(CI.isCPFValid('529.982.247-25'), true);
  assert.equal(CI.isCPFValid('529.982.247-24'), false);
  assert.equal(CI.isCPFValid('111.111.111-11'), false);
  assert.equal(CI.isCNPJContratante('15822325000127'), true);
  assert.equal(CI.isCNPJContratante('11.222.333/0001-81'), false);
});

test('dividirEmParcelas — soma sempre igual ao total, resto na última', () => {
  assert.deepEqual(CI.dividirEmParcelas(100, 3), [33.33, 33.33, 33.34]);
  assert.deepEqual(CI.dividirEmParcelas(100.01, 2), [50, 50.01]);
  for (const [v, n] of [[100, 3], [100.01, 2], [0.05, 3], [12345.67, 3]]) {
    const soma = Math.round(CI.dividirEmParcelas(v, n).reduce((t, x) => t + Math.round(x * 100), 0));
    assert.equal(soma, Math.round(v * 100));
  }
});

test('cláusula 5.1 — parcelas do texto somam o total', () => {
  const s = CI.defaultState();
  s.valorTotal = '100,00'; s.formaPagamento = '3';
  const it = CI.buildContract(s, 'X').clauses.find((c) => c.id === 'pagamento').items;
  assert.match(it[1].text, /R\$ 33,33/);
  assert.match(it[3].text, /R\$ 33,34/);
});

test('escopo — concordância de gênero/número em Escada e Esteira Rolante', () => {
  const s = CI.defaultState();
  s.equipamento = 'escada'; s.quantidade = 2;
  assert.match(CI.buildContract(s, 'X').clauses[0].items[1].text, /2 \(duas\) Escadas Rolantes/);
  s.quantidade = 1;
  assert.match(CI.buildContract(s, 'X').clauses[0].items[1].text, /1 \(uma\) Escada Rolante /);
  s.equipamento = 'esteira'; s.quantidade = 21;
  assert.match(CI.buildContract(s, 'X').clauses[0].items[1].text, /21 \(vinte e uma\) Esteiras Rolantes/);
  assert.equal(CI.inteiroExtensoGen(1000, true), 'mil');
});

test('logradouro — só prefixa "Rua" quando falta o tipo', () => {
  assert.equal(CI.logradouro('Avenida Paulista'), 'Avenida Paulista');
  assert.equal(CI.logradouro('Av. Brasil'), 'Av. Brasil');
  assert.equal(CI.logradouro('das Flores'), 'Rua das Flores');
  assert.equal(CI.logradouro(''), 'Rua XXX');
});
