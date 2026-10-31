'use strict';
/* Notificações (/geral/notificacoes) — issue #1217.

   Supabase simulado COM dados (alertas e notificacoes_lidas); escrita continua bloqueada (403) pelo isolamento padrão
   (e2e/helpers.js) — é assim que o teste simula a falha ao marcar como lidas. O banco de produção nunca é tocado. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const AGORA = new Date().toISOString();
const ALERTAS = [
  { id: 'e2e-fin-1', title: 'Aviso do Financeiro', sub: 'detalhe', module: 'Financeiro', level: 'warning', created_at: AGORA, resolved: false, destinatario_email: null },
  { id: 'e2e-com-1', title: 'Aviso do Comercial', sub: 'detalhe', module: 'Comercial', level: 'info', created_at: AGORA, resolved: false, destinatario_email: null },
];

async function preparar(page, state) {
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Teste Notif', email: 'notif.teste@verticalparts.com.br', iniciais: 'TN', id: 't' }));
    try { localStorage.removeItem('vpprd.notificacoes.preferencias'); } catch (_) { /* sem storage */ }
  });
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request();
    const tabela = new URL(req.url()).pathname.replace('/rest/v1/', '');
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() !== 'GET') return route.fallback();
    if (tabela === 'alertas') return json(200, ALERTAS);
    if (tabela === 'notificacoes_lidas') return json(200, (state.arquivadas || []).map((id) => ({ alerta_id: id, arquivada: true })));
    if ((state.erroEm || []).includes(tabela)) return json(500, { message: 'falha simulada' });
    return route.fallback();
  });
}

const linha = (page, txt) => page.locator('.notif-row', { hasText: txt });

test('B.1 — filtro de módulo não fica preso ao trocar de aba', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { arquivadas: ['e2e-com-1'] });
  await page.goto('/geral/notificacoes');
  await expect(linha(page, 'Aviso do Financeiro')).toBeVisible({ timeout: 45_000 });

  await page.locator('.tbar select').selectOption('Financeiro');
  await expect(linha(page, 'Aviso do Comercial')).toHaveCount(0);

  // A aba Arquivadas só tem o aviso do Comercial: o filtro "Financeiro" precisa voltar para "Todos".
  await page.locator('.tbar .seg button', { hasText: 'Arquivadas' }).click();
  await expect(linha(page, 'Aviso do Comercial')).toBeVisible();
  await expect(page.locator('.tbar select')).toHaveValue('Todos');
  expect(erros).toEqual([]);
});

test('B.2 — falha ao marcar todas como lidas não mostra sucesso', async ({ page }) => {
  await preparar(page, {});
  await page.goto('/geral/notificacoes');
  await expect(linha(page, 'Aviso do Financeiro')).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Marcar todas como lidas' }).click();
  await expect(page.getByText(/Erro ao marcar notificações como lidas/)).toBeVisible();
  await expect(page.getByText('Notificações marcadas como lidas')).toHaveCount(0);
  await expect(page.locator('.notif-row.unread')).toHaveCount(2);
});

test('B.3 — avisos calculados indisponíveis mostram aviso de lista incompleta', async ({ page }) => {
  await preparar(page, { erroEm: ['propostas'] });
  await page.goto('/geral/notificacoes');
  await expect(linha(page, 'Aviso do Financeiro')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/não puderam ser calculados agora/)).toBeVisible();
});

const modal = (page) => page.getByText('Detalhe da Notificação');

test('URL — aba, notificação aberta e módulo sobrevivem ao F5 e ao link', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, {});
  await page.goto('/geral/notificacoes');
  await expect(linha(page, 'Aviso do Financeiro')).toBeVisible({ timeout: 45_000 });

  await page.locator('.tbar .seg button', { hasText: 'Não lidas' }).click();
  await expect(page).toHaveURL(/\/geral\/notificacoes\/nao-lidas$/);
  await page.locator('.tbar select').selectOption('Financeiro');
  await expect(page).toHaveURL(/\/geral\/notificacoes\/nao-lidas\?modulo=Financeiro$/);
  await linha(page, 'Aviso do Financeiro').click();
  await expect(modal(page)).toBeVisible();
  await expect(page).toHaveURL(/\/geral\/notificacoes\/nao-lidas\/e2e-fin-1\?modulo=Financeiro$/);

  await page.reload();
  await expect(modal(page)).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.tbar .seg button.is-active')).toHaveText('Não lidas');
  await expect(page.locator('.tbar select')).toHaveValue('Financeiro');
  await expect(linha(page, 'Aviso do Comercial')).toHaveCount(0);
  // abrir pelo link não marca como lida
  await expect(page.locator('.notif-row.unread', { hasText: 'Aviso do Financeiro' })).toHaveCount(1);

  await page.goBack();
  await expect(modal(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/geral\/notificacoes\/nao-lidas/);
  expect(erros).toEqual([]);
});

test('URL — aviso arquivado abre na aba Arquivadas; aviso inexistente avisa e volta à lista', async ({ page }) => {
  await preparar(page, { arquivadas: ['e2e-com-1'] });
  await page.goto('/geral/notificacoes/todas/e2e-com-1');
  await expect(modal(page)).toBeVisible({ timeout: 45_000 });
  await expect(page).toHaveURL(/\/geral\/notificacoes\/arquivadas\/e2e-com-1$/);

  await page.goto('/geral/notificacoes/todas/nao-existe-123');
  await expect(page.getByText(/Esta notificação não está mais disponível/)).toBeVisible({ timeout: 45_000 });
  await expect(page).toHaveURL(/\/geral\/notificacoes\/?$/);
  await expect(modal(page)).toHaveCount(0);
});
