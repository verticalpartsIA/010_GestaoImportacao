'use strict';
/* Dashboard (/geral/dashboard) — issue #1216.

   Supabase simulado: por padrão tudo vazio (e2e/helpers.js); cada teste força erro ou atraso numa tabela.
   O banco de produção nunca é tocado. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

async function preparar(page, state) {
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Teste Dashboard', email: 'dash.teste@verticalparts.com.br', iniciais: 'TD', id: 't' }));
  });
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request();
    const tabela = new URL(req.url()).pathname.replace('/rest/v1/', '');
    if (req.method() !== 'GET') return route.fallback();
    if ((state.erroEm || []).includes(tabela)) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'falha simulada' }) });
    }
    if (state.atrasoMs && tabela === 'gatilhos') await new Promise((r) => setTimeout(r, state.atrasoMs));
    return route.fallback();
  });
}

test('A.1 — consulta com erro avisa quais dados não carregaram', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { erroEm: ['leads', 'alertas'] });
  await page.goto('/geral/dashboard');
  await expect(page.getByText(/Alguns dados não carregaram \(leads, alertas\)/)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  expect(erros).toEqual([]);
});

test('A.2 — enquanto carrega não mostra zeros falsos', async ({ page }) => {
  await preparar(page, { atrasoMs: 8000 });
  await page.goto('/geral/dashboard');
  await expect(page.getByText(/Ainda carregando seus números/)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/Você tem 0 alertas/)).toHaveCount(0);
  // terminada a carga, aparecem os números de verdade (vazios no simulado)
  await expect(page.getByText(/Você tem 0 alertas críticos/)).toBeVisible({ timeout: 20_000 });
});

test('A.4 — link de projeto inexistente avisa e limpa a URL', async ({ page }) => {
  await preparar(page, {});
  await page.goto('/geral/dashboard/PROJETO-QUE-NAO-EXISTE');
  await expect(page.getByText('Este projeto não está mais entre os projetos em andamento.')).toBeVisible({ timeout: 45_000 });
  await expect(page).toHaveURL(/\/geral\/dashboard\/?$/);
});
