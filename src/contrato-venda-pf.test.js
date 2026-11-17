/* Contrato de Venda — comprador Pessoa Física (cotação 1004, 17/11/2026). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, 'contrato-venda-engine.js'), 'utf8');
const win = {};
new Function('window', src)(win);
const CV = win.CV;

const textoPreambulo = (doc) => doc.sections[0].body.map((b) => b.text).join(' ');
const base = (comprador) => ({ ...CV.defaultState(), valor: '10.000,00', comprador: { ...CV.defaultState().comprador, ...comprador } });
const gerar = (f) => CV.buildContract({ form: f, comprador: f.comprador, valor: 10000, sinalPct: 30, parcelas: 5, numero: 'VPCV-1004' });

test('documentoDoCliente: texto "CPF: ..." no campo CNPJ vira PF com CPF só em dígitos', () => {
  const d = CV.documentoDoCliente({ cnpj: 'CPF: 227.295.968-79' });
  assert.deepStrictEqual(d, { tipoPessoa: 'PF', cnpj: '', cpf: '22729596879' });
});

test('documentoDoCliente: tipo_pessoa PF com campo cpf próprio', () => {
  const d = CV.documentoDoCliente({ tipo_pessoa: 'PF', cpf: '227.295.968-79', cnpj: null });
  assert.strictEqual(d.tipoPessoa, 'PF');
  assert.strictEqual(d.cpf, '22729596879');
});

test('documentoDoCliente: CNPJ de 14 dígitos continua PJ', () => {
  const d = CV.documentoDoCliente({ cnpj: '01623480000100' });
  assert.deepStrictEqual(d, { tipoPessoa: 'PJ', cnpj: '01623480000100', cpf: '' });
});

test('preâmbulo PF: nome, CPF e endereço; sem CNPJ, RG, estado civil nem representante', () => {
  const doc = gerar(base({ tipoPessoa: 'PF', razao: 'Weng Meihuan', repCpf: '227.295.968-79', endereco: 'R. Vinte e Cinco de Março, nº 970, Centro, São Paulo/SP' }));
  const t = textoPreambulo(doc);
  assert.match(t, /Weng Meihuan/);
  assert.match(t, /CPF sob o nº 227\.295\.968-79/);
  assert.match(t, /residente e domiciliado\(a\) na R\. Vinte e Cinco de Março/);
  const comprador = t.slice(t.indexOf('COMPRADOR:'));
  assert.doesNotMatch(comprador, /CNPJ|portador da cédula|neste ato representada|RG/);
  assert.strictEqual(doc.assinatura.comprador.pf, true);
  assert.strictEqual(doc.assinatura.comprador.nome, 'Weng Meihuan');
  assert.strictEqual(doc.assinatura.comprador.cpf, '227.295.968-79');
});

test('preâmbulo PJ não muda: CNPJ, representante, RG e CPF do representante', () => {
  const doc = gerar(base({ razao: 'ACME LTDA', cnpj: '01.623.480/0001-00', rep: 'Fulano', repCpf: '227.295.968-79', repRg: '12.345', endereco: 'Rua A' }));
  const t = textoPreambulo(doc);
  assert.match(t, /inscrito no CNPJ sob o nº 01\.623\.480\/0001-00/);
  assert.match(t, /portador da cédula de identidade RG de nº 12\.345/);
  assert.strictEqual(doc.assinatura.comprador.pf, false);
});

test('CPF da cotação 1004 passa na validação por dígito verificador', () => {
  assert.strictEqual(CV.isCPFValid('227.295.968-79'), true);
});
