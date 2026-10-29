'use strict';
/* Embarques de Importação › aba Frete: cotações de frete marítimo (até 4), taxas em USD/BRL com totais,
   vencedora única e a URL da aba. Supabase simulado (e2e/helpers.js): sem leitura/escrita real. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

test.describe('Embarques › Frete', () => {
  test('nova cotação: taxas, totais por moeda, vencedor e URL da aba', async ({ page }) => {
    const erros = coletarErros(page);
    await page.goto('/gestao-importacao/embarques-importacao');
    await page.getByRole('button', { name: /Novo embarque/i }).click({ timeout: 60_000 });
    await page.getByText('Frete', { exact: true }).first().click();
    await expect(page).toHaveURL(/\/embarques-importacao\/frete$/);

    await expect(page.getByText('Cotações de frete marítimo')).toBeVisible();
    await page.getByRole('button', { name: /Nova cotação/i }).click();
    await expect(page.getByText('Cotação 1', { exact: true })).toBeVisible();

    // 1ª taxa já vem como "Frete marítimo" em USD
    const valores = page.locator('table.t input[type=number]');
    await valores.first().fill('1200.5');
    await page.getByRole('button', { name: /Adicionar taxa/i }).click();
    const linhas = page.locator('table.t tbody tr');
    await linhas.nth(1).locator('select').selectOption('BRL');
    await linhas.nth(1).locator('input[type=number]').fill('2500');
    await expect(page.getByText('Total USD: $ 1.200,50')).toBeVisible();
    await expect(page.getByText('Total BRL: R$ 2.500,00')).toBeVisible();

    // sem embarque salvo: anexar e e-mail ficam travados
    await expect(page.getByText('Salve o embarque para poder anexar arquivos e enviar o e-mail.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Enviar pedido de cotação/i })).toBeDisabled();

    // limite de 4 e vencedora única
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /Nova cotação/i }).click();
    await expect(page.getByRole('button', { name: /Nova cotação/i })).toBeDisabled();
    await expect(page.getByText('4 de 4')).toBeVisible();
    const vencedores = page.getByRole('button', { name: /Definir como vencedor/i });
    await vencedores.nth(0).click();
    await vencedores.nth(0).click(); // a 2ª vira a vencedora; a 1ª perde a marca
    await expect(page.getByRole('button', { name: /^🏆 Vencedor$/ })).toHaveCount(1);

    // vencedora preenche (e trava) os campos únicos do embarque
    await expect(page.getByText(/vêm da cotação vencedora/)).toBeVisible();

    // voltar à aba Identificação limpa o sufixo da URL
    await page.getByText('Identificação', { exact: true }).first().click();
    await expect(page).toHaveURL(/\/embarques-importacao$/);
    expect(erros, erros.join('\n')).toEqual([]);
  });
});
