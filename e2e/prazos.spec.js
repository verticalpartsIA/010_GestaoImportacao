'use strict';
/* Prazos & Pendências (/adm-financeiro/financeiro) — issue #1214.

   Supabase simulado COM dados (tabelas gatilhos, avais_financeiros, avais_juridicos); a escrita do Aval de Pagamento
   é respondida pelo teste. Demais leituras caem no isolamento padrão (lista vazia) e escritas em 403 (e2e/helpers.js).
   O banco de produção nunca é tocado. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const COT = 9001;

function cadeia() {
  const t0 = '2026-10-20T12:00:00Z';
  return [
    { id: 'GT-9001-AGUARDA_BOLETO', numero_cotacao: COT, evento_key: 'AGUARDA_BOLETO', trigger_name: 'Aguardando boleto', origem: 'automatico',
      nascido_em: t0, concluido_em: '2026-10-21T12:00:00Z', status: 'ok', chain: [] },
    { id: 'GT-9001-AVAL_PAGAMENTO', numero_cotacao: COT, evento_key: 'AVAL_PAGAMENTO', trigger_name: 'Aval de Pagamento', origem: 'automatico',
      nascido_em: '2026-10-21T12:00:00Z', concluido_em: null, status: 'pendente', chain: [] },
  ];
}

async function preparar(page, state) {
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Financeiro Teste', email: 'financeiro.teste@verticalparts.com.br', iniciais: 'FT', id: 't' }));
  });
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const tabela = url.pathname.replace('/rest/v1/', '');
    const m = req.method();
    const objeto = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const responder = (linhas) => {
      if (objeto) return linhas.length ? json(200, linhas[0]) : json(406, { code: 'PGRST116', message: '0 rows' });
      return json(200, linhas);
    };
    if (tabela === 'gatilhos' && m === 'GET') {
      if (state.gatilhosErro) return json(500, { message: 'falha simulada do banco' });
      return responder(cadeia());
    }
    if (tabela === 'avais_financeiros' && m === 'GET') return responder([state.av]);
    if (tabela === 'avais_financeiros' && m === 'PATCH') {
      Object.assign(state.av, JSON.parse(req.postData() || '{}'));
      return responder([state.av]);
    }
    if (tabela === 'avais_juridicos' && m === 'GET') return responder([{ status: 'pendente' }]);
    return route.fallback();
  });
}

test('D.1/D.2 — falha ao ler as etapas mostra aviso com "Tentar novamente" (não fica em "Carregando…")', async ({ page }) => {
  const erros = coletarErros(page);
  const state = { gatilhosErro: true, av: {} };
  await preparar(page, state);
  await page.goto('/adm-financeiro/financeiro');
  await expect(page.getByText(/Não foi possível carregar as etapas agora/)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();

  state.gatilhosErro = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText(/Não foi possível carregar as etapas agora/)).toHaveCount(0);
  await expect(page.getByText(String(COT)).first()).toBeVisible();
  expect(erros).toEqual([]);
});

test('D.3 — Aval de Pagamento sem os outros avais avisa o que falta (não diz "compra liberada")', async ({ page }) => {
  const erros = coletarErros(page);
  const state = { av: { id: 'av-9001', numero_cotacao: COT, numero_documento: 'VPPR-9001', cliente_nome: 'Cliente Teste', aval_pagamento_confirmado: false } };
  await preparar(page, state);
  await page.goto('/adm-financeiro/financeiro');
  await expect(page.getByText(String(COT)).first()).toBeVisible({ timeout: 45_000 });
  await page.getByText(String(COT)).first().click();
  await page.getByRole('button', { name: 'Dar Aval de Pagamento' }).first().click();
  await expect(page.getByText(/três avais/)).toBeVisible();
  await page.locator('.modal, [role="dialog"]').getByRole('button', { name: 'Dar Aval de Pagamento' }).click();

  await expect(page.getByText(/Para liberar a compra ainda falta: .*Aval Jurídico/)).toBeVisible();
  await expect(page.getByText(/Aval de Pagamento confirmado — compra ao fornecedor liberada/)).toHaveCount(0);
  expect(state.av.aval_pagamento_confirmado).toBe(true);
  expect(erros).toEqual([]);
});

const btnAval = (page) => page.getByRole('button', { name: 'Dar Aval de Pagamento' });

test('D.5 — filtro e cotação aberta ficam na URL (link direto, F5 e Voltar)', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { av: {} });
  await page.goto('/adm-financeiro/financeiro/atrasada/' + COT);
  await expect(btnAval(page).first()).toBeVisible({ timeout: 45_000 });

  await page.reload();
  await expect(btnAval(page).first()).toBeVisible({ timeout: 45_000 });
  await expect(page).toHaveURL(new RegExp('/financeiro/atrasada/' + COT + '$'));

  await page.getByRole('button', { name: /^Todas/ }).click();
  await expect(page).toHaveURL(/\/financeiro\/todas$/);
  await expect(btnAval(page)).toHaveCount(0);
  await page.getByText('Cotação Nº ' + COT).click();
  await expect(page).toHaveURL(new RegExp('/financeiro/todas/' + COT + '$'));
  await expect(btnAval(page).first()).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/financeiro\/todas$/);
  await expect(btnAval(page)).toHaveCount(0);
  expect(erros).toEqual([]);
});

test('D.5 — link com filtro errado abre a cotação no filtro dela; cotação inexistente avisa', async ({ page }) => {
  await preparar(page, { av: {} });
  await page.goto('/adm-financeiro/financeiro/andamento/' + COT);
  await expect(page).toHaveURL(new RegExp('/financeiro/atrasada/' + COT + '$'), { timeout: 45_000 });
  await expect(btnAval(page).first()).toBeVisible();

  await page.goto('/adm-financeiro/financeiro/atrasada/9999');
  await expect(page.getByText(/Cotação Nº 9999 não tem cadeia de etapas/)).toBeVisible({ timeout: 45_000 });
  await expect(page).toHaveURL(/\/financeiro\/atrasada$/);
});
