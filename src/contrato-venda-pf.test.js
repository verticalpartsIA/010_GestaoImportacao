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

/* ---- Cadastro primeiro, proposta como reserva (cotação 1004, opção A do Gelson) ---- */
const propostaWeng = { nome: 'Weng Meihuan', cnpj: 'CPF: 227.295.968-79', endereco: 'R. Vinte e Cinco de Março', numero: '970', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01021-100', email: '', telefone: '', responsavel: 'Weng' };
const cadastroWeng = { razao_social: 'WENG MEIHUAN', tipo_pessoa: 'PF', cpf: '22729596879', cnpj: null, email: null, telefone: '(11) 98194-0360', endereco_logradouro: 'Said Aiach, 277', endereco_bairro: 'Paraiso ', endereco_cep: '04003020', endereco_cidade: 'São Paulo (SP)', endereco_estado: 'SP', contato: null };

test('clienteComCadastro: endereço, telefone e CPF vêm do cadastro; "(SP)" some da cidade; endereço não mistura com a proposta', () => {
  const m = CV.clienteComCadastro(propostaWeng, cadastroWeng);
  assert.strictEqual(m.tipo_pessoa, 'PF');
  assert.strictEqual(m.nome, 'WENG MEIHUAN');
  assert.strictEqual(m.telefone, '(11) 98194-0360');
  assert.strictEqual(CV.montarEndereco(m), 'Said Aiach, 277, Paraiso, São Paulo/SP, CEP 04003-020');
  const d = CV.documentoDoCliente(m);
  assert.deepStrictEqual(d, { tipoPessoa: 'PF', cnpj: '', cpf: '22729596879' });
});

test('clienteComCadastro: campo vazio no cadastro cai para a proposta (e-mail, responsável)', () => {
  const m = CV.clienteComCadastro({ ...propostaWeng, email: 'w@x.com' }, cadastroWeng);
  assert.strictEqual(m.email, 'w@x.com');
  assert.strictEqual(m.responsavel, 'Weng');
});

test('clienteComCadastro: cadastro sem logradouro mantém o endereço da proposta inteiro', () => {
  const m = CV.clienteComCadastro(propostaWeng, { ...cadastroWeng, endereco_logradouro: '', endereco_bairro: 'Paraíso' });
  assert.match(CV.montarEndereco(m), /Vinte e Cinco de Março, nº 970, Centro/);
  assert.doesNotMatch(CV.montarEndereco(m), /Paraíso/);
});

test('clienteComCadastro: sem cadastro devolve o cliente da proposta intacto', () => {
  assert.strictEqual(CV.clienteComCadastro(propostaWeng, null), propostaWeng);
});

test('clienteComCadastro: PJ usa o CNPJ do cadastro e mantém tipo PJ', () => {
  const m = CV.clienteComCadastro({ nome: 'AGRA', cnpj: '01.623.480/0001-00' }, { razao_social: 'AGRA INCORPORADORA S.A.', tipo_pessoa: 'PJ', cnpj: '01623480000100', cpf: null });
  assert.strictEqual(CV.documentoDoCliente(m).tipoPessoa, 'PJ');
  assert.strictEqual(CV.documentoDoCliente(m).cnpj, '01623480000100');
});

/* ---- Cronograma e paradas herdados da Proposta (cotação 1004, 18/11/2026) ---- */
const valores1004 = {
  formaTipo: 'parcelado', qtdParcelas: '6',
  parcelas: [
    { desc: 'Sinal de 43,40% na assinatura do contrato', valor: '102.075,16' },
    { desc: '1ª Parcela 16,60%', valor: '39.053,96' },
    { desc: '2ª Parcela 10%', valor: '23.521,52' },
    { desc: '3ª Parcela 10%', valor: '23.521,52' },
    { desc: '4ª Parcela 15%', valor: '35.282,28' },
    { desc: '5ª Parcela 5%', valor: '11.760,77' },
  ],
};

test('cronogramaDaProposta: sinal vem do VALOR da 1ª linha (R$ 102.075,16), não de 40% fixo', () => {
  const c = CV.cronogramaDaProposta(valores1004, 235215.21);
  assert.strictEqual(c.parcelas, 5);
  assert.deepStrictEqual(c.parcelasDetalhe, [39053.96, 23521.52, 23521.52, 35282.28, 11760.77]);
  assert.ok(Math.abs(235215.21 * c.sinalPct / 100 - 102075.16) < 0.005);
});

test('contrato da 1004 sai com o cronograma da proposta: sinal 102.075,16 e as 5 parcelas desiguais', () => {
  const c = CV.cronogramaDaProposta(valores1004, 235215.21);
  const doc = CV.buildContract({ form: { ...CV.defaultState(), parcelasDetalhe: c.parcelasDetalhe }, comprador: CV.defaultState().comprador, valor: 235215.21, sinalPct: c.sinalPct, parcelas: c.parcelas, numero: 'VPCV-1004' });
  const tabela = doc.sections.find((x) => x.id === 's3').body.find((b) => b.table).table;
  assert.deepStrictEqual(tabela.map((l) => Number(l.valor.toFixed(2))), [102075.16, 39053.96, 23521.52, 23521.52, 35282.28, 11760.77]);
});

test('cronogramaDaProposta: com sinal de 40% redondo e à vista continua como antes', () => {
  const v40 = { formaTipo: 'parcelado', qtdParcelas: '3', parcelas: [{ desc: 'Sinal de 40%', valor: '400,00' }, { desc: '1ª', valor: '300,00' }, { desc: '2ª', valor: '300,00' }] };
  assert.ok(Math.abs(CV.cronogramaDaProposta(v40, 1000).sinalPct - 40) < 1e-9);
  assert.deepStrictEqual(CV.cronogramaDaProposta({ formaTipo: 'vista' }, 1000), { sinalPct: 100, parcelas: 0, parcelasDetalhe: null });
  assert.strictEqual(CV.cronogramaDaProposta({}, 1000), null);
});

test('cronogramaDaProposta: sem linha de sinal reconhecível cai nos 40% padrão', () => {
  const c = CV.cronogramaDaProposta({ formaTipo: 'parcelado', qtdParcelas: '2', parcelas: [{ desc: 'Entrada', valor: '500,00' }, { desc: 'Final', valor: '500,00' }] }, 1000);
  assert.strictEqual(c.sinalPct, 40);
  assert.strictEqual(c.parcelasDetalhe, null);
});

test('paradasDaEspecificacao: "04/04/04" vira "4"; sem número vira vazio', () => {
  assert.strictEqual(CV.paradasDaEspecificacao({ andaresParadasPortas: '04/04/04' }), '4');
  assert.strictEqual(CV.paradasDaEspecificacao({ andaresParadasPortas: '10/10/10' }), '10');
  assert.strictEqual(CV.paradasDaEspecificacao({}), '');
});

/* ---- Papel do comprador no bloco de assinaturas digitais (18/11/2026) ---- */
test('papelAssinaturaComprador: PF assina como "Comprador"; PJ segue "Representante legal do Comprador"', () => {
  const docPF = gerar(base({ tipoPessoa: 'PF', razao: 'Weng Meihuan', repCpf: '227.295.968-79', endereco: 'Rua A' }));
  const docPJ = gerar(base({ razao: 'ACME LTDA', cnpj: '01.623.480/0001-00', rep: 'Fulano', repCpf: '227.295.968-79' }));
  assert.strictEqual(CV.papelAssinaturaComprador(docPF), 'Comprador');
  assert.strictEqual(CV.papelAssinaturaComprador(docPJ), 'Representante legal do Comprador');
  assert.strictEqual(CV.papelAssinaturaComprador({ comprador: { tipoPessoa: 'PF' } }), 'Comprador'); // form_state do registro
  assert.strictEqual(CV.papelAssinaturaComprador({ comprador: { tipoPessoa: 'PJ' } }), 'Representante legal do Comprador');
  assert.strictEqual(CV.papelAssinaturaComprador(null), 'Representante legal do Comprador'); // contrato antigo/sem dado
});
