'use strict';
/* Sidebar — busca de telas (Ctrl K) e interruptores Vidro/Escuro (05/11/2026).
   Supabase simulado (e2e/helpers.js): nada toca o banco de produção. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

async function entrar(page, extra = {}) {
  await page.addInitScript((ex) => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify(Object.assign({ nome: 'Teste Sidebar', email: 'sidebar.teste@verticalparts.com.br', iniciais: 'TS', id: 't' }, ex)));
  }, extra);
}

test('Ctrl K abre a paleta, filtra e Enter navega até a tela', async ({ page }) => {
  const erros = coletarErros(page);
  await entrar(page);
  await page.goto('/geral/dashboard');
  await expect(page.locator('.sidebar__busca')).toBeVisible({ timeout: 45_000 });
  await page.keyboard.press('Control+k');
  const caixa = page.getByRole('dialog', { name: 'Ir para uma tela' });
  await expect(caixa).toBeVisible();
  await page.keyboard.type('propost');
  await expect(caixa.getByRole('option', { name: /Propostas/ }).first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(caixa).toHaveCount(0);
  await expect(page).toHaveURL(/\/comercial\/propostas/);
  expect(erros).toEqual([]);
});

test('Esc fecha a paleta e o botão da sidebar também abre', async ({ page }) => {
  await entrar(page);
  await page.goto('/geral/dashboard');
  await page.locator('.sidebar__busca').click({ timeout: 45_000 });
  const caixa = page.getByRole('dialog', { name: 'Ir para uma tela' });
  await expect(caixa).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(caixa).toHaveCount(0);
});

test('a busca não mostra tela de módulo que a pessoa não tem alocado', async ({ page }) => {
  await entrar(page, { gruposAlocados: ['Geral'] });
  await page.goto('/geral/dashboard');
  await expect(page.locator('.sidebar__busca')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.sidebar__group-label', { hasText: 'Comercial' })).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('propost');
  await expect(page.getByText('Nenhuma tela encontrada.')).toBeVisible();
});

test('Vidro e Escuro ligam por interruptor e ficam lembrados', async ({ page }) => {
  await entrar(page);
  await page.goto('/geral/dashboard');
  const vidro = page.getByRole('switch', { name: /Modo vidro/ });
  const escuro = page.getByRole('switch', { name: /Tema escuro/ });
  await expect(vidro).toHaveAttribute('aria-checked', 'false', { timeout: 45_000 });
  await vidro.click();
  await escuro.click();
  await expect(page.locator('html')).toHaveAttribute('data-vp-vidro', '1');
  await expect(page.locator('html')).toHaveAttribute('data-vp-escuro', '1');
  await page.reload();
  await expect(page.getByRole('switch', { name: /Modo vidro/ })).toHaveAttribute('aria-checked', 'true', { timeout: 45_000 });
  await page.getByRole('switch', { name: /Modo vidro/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-vp-vidro', '0');
});
