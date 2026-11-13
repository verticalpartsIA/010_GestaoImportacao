'use strict';
/* Formulário de Elevador › portas de vidro (cabina e pavimento). Supabase simulado; nada é gravado. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

async function abrir(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Gelson Simoes', email: 'gelson.simoes@verticalparts.com.br', iniciais: 'GS', id: 't' }));
  });
  await page.goto('/comercial/formulario-elevador');
  await page.getByLabel('Paradas *').waitFor({ timeout: 90_000 });
  await page.getByLabel('Paradas *').fill('3');
  await page.getByLabel('Descrição dos pavimentos *').fill('Térreo, 1, 2');
}

test.describe('Formulário de Elevador › portas de vidro', () => {
  test('pavimento: escolher Vidro pergunta onde; só no térreo, demais em aço', async ({ page }) => {
    const erros = coletarErros(page);
    await abrir(page);
    const sel = page.getByLabel('Acabamento porta pavimento');
    await expect(sel.locator('option')).toHaveText(['— escolha —', 'Aço 304', 'Aço 430', 'Pintado', 'Vidro']);
    await sel.selectOption('Vidro');
    await expect(page.getByText('Porta de pavimento em vidro')).toBeVisible();
    await page.getByLabel(/Só em alguns pavimentos/).check();
    await expect(page.getByText('Marque os pavimentos com vidro:')).toBeVisible();
    await page.locator('div', { hasText: /^Térreo/ }).last().getByRole('checkbox').check();
    // sem material das demais portas ainda: avisa
    await expect(page.getByText(/informe o material das portas que não são de vidro/)).toBeVisible();
    await page.getByLabel('Material das portas que não forem de vidro').selectOption('Aço 304');
    await expect(page.getByText('Sairá assim: Vidro nos pavimentos Térreo; demais portas em Aço 304')).toBeVisible();
    // sem porta oposta não existe o lado "Oposta"
    await expect(page.getByRole('checkbox', { name: 'Oposta' })).toHaveCount(0);
    // voltar para aço limpa o vidro
    await sel.selectOption('Aço 430');
    await expect(page.getByText('Porta de pavimento em vidro')).toHaveCount(0);
    expect(erros, erros.join('\n')).toEqual([]);
  });

  test('porta oposta: cada lado do pavimento e da cabina é vidro ou aço de forma independente', async ({ page }) => {
    const erros = coletarErros(page);
    await abrir(page);
    await page.getByLabel('Porta oposta / múltiplas entradas *').fill('Sim - 180°');
    await page.getByLabel('Acabamento porta pavimento').selectOption('Vidro');
    await page.getByLabel(/Só em alguns pavimentos/).check();
    const linha = page.locator('div.row', { hasText: /^Térreo/ }).last();
    await linha.getByRole('checkbox', { name: 'Frente' }).check();
    await linha.getByRole('checkbox', { name: 'Oposta' }).check();
    await page.getByLabel('Material das portas que não forem de vidro').first().selectOption('Aço 430');
    await expect(page.getByText('Sairá assim: Vidro nos pavimentos Térreo (frente e oposta); demais portas em Aço 430')).toBeVisible();
    await linha.getByRole('checkbox', { name: 'Oposta' }).uncheck();
    await expect(page.getByText('Sairá assim: Vidro nos pavimentos Térreo (frente); demais portas em Aço 430')).toBeVisible();

    // cabina: frente de vidro, oposta de aço
    await page.getByLabel('Acabamento porta cabina').selectOption('Vidro');
    await expect(page.getByRole('checkbox', { name: 'Porta oposta em vidro' })).toBeVisible();
    await page.getByLabel('Material das portas que não forem de vidro').first().selectOption('Aço 430');
    await expect(page.getByText('Sairá assim: Vidro (porta de frente); porta oposta em Aço 430')).toBeVisible();
    expect(erros, erros.join('\n')).toEqual([]);
  });
});
