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
