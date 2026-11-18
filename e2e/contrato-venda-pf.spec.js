'use strict';
/* Contrato de Venda — comprador Pessoa Física (cotação 1004). Supabase simulado; o banco real nunca é tocado. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

test('Passo 1 do Contrato de Venda: PF mostra Nome/CPF/Endereço e esconde CNPJ e qualificação do representante', async ({ page }) => {
  test.setTimeout(150_000);
  const erros = coletarErros(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Gelson Simoes', email: 'gelson.simoes@verticalparts.com.br', iniciais: 'GS', id: 't' }));
  });
  await page.goto('/juridico/contrato-venda-equipamentos');
  await page.getByRole('button', { name: /novo contrato/i }).click({ timeout: 90_000 });
  const rotulo = (re) => page.locator('.cv-field label', { hasText: re });
  const tipo = page.locator('select.cv-select').first();
  await tipo.waitFor();
  await expect(rotulo(/Razão social/)).toHaveCount(1);
  await expect(rotulo(/^CNPJ/)).toHaveCount(1);

  await tipo.selectOption('PF');
  await expect(rotulo(/Nome completo/)).toHaveCount(1);
  await expect(rotulo(/^CPF/)).toHaveCount(1);
  await expect(rotulo(/Razão social/)).toHaveCount(0);
  await expect(rotulo(/^CNPJ/)).toHaveCount(0);
  await expect(rotulo(/RG do representante/)).toHaveCount(0);
  await expect(page.locator('.cv-group-title', { hasText: /Qualificação do representante/ })).toHaveCount(0);

  /* O nome digitado vai para a pré-visualização como COMPRADOR pessoa física. */
  await page.locator('.cv-field', { has: page.locator('label', { hasText: /Nome completo/ }) }).locator('input').fill('Weng Meihuan');
  await page.locator('.cv-field', { has: page.locator('label', { hasText: /^CPF/ }) }).locator('input').fill('22729596879');
  await expect(page.getByText(/inscrito\(a\) no CPF sob o nº 227\.295\.968-79/)).toBeVisible();

  await tipo.selectOption('PJ');
  await expect(rotulo(/Razão social/)).toHaveCount(1);
  expect(erros.length, erros.join('\n')).toBe(0);
});

/* Cotação 1004: a proposta traz o texto antigo (CPF digitado no campo CNPJ, endereço da 25 de Março) e o cliente
   cadastrado (Weng, PF) tem outro endereço/telefone. Decisão do Gelson: cadastro primeiro. */
test('Criar contrato da proposta 1004: nome, CPF, endereço e telefone vêm do Cadastro (PF), não do texto da proposta', async ({ page }) => {
  test.setTimeout(150_000);
  const erros = coletarErros(page);
  const proposta = {
    id: 'prop-1004', master_id: 'VPEL-EL1004-A', numero_documento: 'VPPR-1004', titulo: 'Elevador', valor_total: 235215.21,
    aprovada_em: '2026-11-13T16:56:38Z', cliente_id: 'cli-weng',
    data_json: { cliente: { nome: 'Weng Meihuan', cnpj: 'CPF: 227.295.968-79', endereco: 'R. Vinte e Cinco de Março', numero: '970', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01021-100', email: '', telefone: '', responsavel: 'Weng' }, obra: {}, elevador: { valores: {}, especificacoes: [{}] } },
  };
  const weng = { id: 'cli-weng', razao_social: 'WENG MEIHUAN', tipo_pessoa: 'PF', cpf: '22729596879', cnpj: null, email: null, telefone: '(11) 98194-0360', endereco_logradouro: 'Said Aiach, 277', endereco_bairro: 'Paraiso', endereco_cep: '04003020', endereco_cidade: 'São Paulo (SP)', endereco_estado: 'SP' };
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Gelson Simoes', email: 'gelson.simoes@verticalparts.com.br', iniciais: 'GS', id: 't' }));
  });
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request(); const url = new URL(req.url());
    const tabela = url.pathname.replace('/rest/v1/', '');
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (req.method() === 'GET' && tabela === 'propostas') return json([proposta]);
    if (req.method() === 'GET' && tabela === 'clientes') return json([weng]);
    return route.fallback();
  });
  await page.goto('/juridico/contrato-venda-equipamentos');
  await page.getByRole('button', { name: /^Criar contrato$/ }).click({ timeout: 90_000 });
  const campo = (re) => page.locator('.cv-field', { has: page.locator('label', { hasText: re }) }).locator('input');
  await expect(campo(/^Nome completo/)).toHaveValue('WENG MEIHUAN', { timeout: 20_000 });
  await expect(campo(/^CPF/)).toHaveValue('227.295.968-79');
  await expect(campo(/^Telefone/)).toHaveValue('(11) 98194-0360');
  await expect(campo(/^Endereço/)).toHaveValue('Said Aiach, 277, Paraiso, São Paulo/SP, CEP 04003-020');
  await expect(page.getByText(/inscrito\(a\) no CPF sob o nº 227\.295\.968-79, residente e domiciliado\(a\) na Said Aiach, 277/)).toBeVisible();
  expect(erros.length, erros.join('\n')).toBe(0);
});
