'use strict';
/* Inbox (/geral/inbox) — issue #1213.

   O Supabase é simulado COM dados: a Edge Function read-inbox devolve uma
   caixa montada pelo teste, e as tabelas que a tela lê (perfis, alçadas,
   emails_projeto) respondem como o teste mandar. Escrita continua bloqueada
   pelo isolamento padrão (e2e/helpers.js). O banco de produção nunca é tocado. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const EU = 'vendedor.teste@verticalparts.com.br';
const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';

function mensagens() {
  return [
    { id: ID1, from: 'fornecedor1@exemplo.com', fromName: 'Fornecedor Um', subject: 'Assunto um', date: '2026-10-30T12:00:00Z',
      unread: true, preview: 'Texto do primeiro e-mail', html: null, numeroCotacao: null, anexos: [], to: ['suporte@vpsistema.com'], cc: [] },
    { id: ID2, from: 'fornecedor2@exemplo.com', fromName: 'Fornecedor Dois', subject: 'Assunto dois', date: '2026-10-30T11:00:00Z',
      unread: true, preview: 'Texto do segundo e-mail', html: null, numeroCotacao: null, anexos: [], to: ['suporte@vpsistema.com'], cc: [] },
  ];
}

/* state.admin: perfil Administrador (vê tudo). Senão, perfil comum com as alçadas de state.caps.
   state.metaErro: a leitura de metadados (dono) do emails_projeto falha. */
async function preparar(page, state) {
  await page.addInitScript((email) => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Vendedor Teste', email, iniciais: 'VT', id: 't' }));
  }, EU);
  await page.route('**/*.supabase.co/functions/v1/read-inbox', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ messages: mensagens() }),
  }));
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const tabela = url.pathname.replace('/rest/v1/', '');
    if (req.method() !== 'GET') return route.fallback();
    const objeto = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const responder = (linhas) => {
      if (objeto) {
        if (!linhas.length) return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: '0 rows' }) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(linhas[0]) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/' + linhas.length }, body: JSON.stringify(linhas) });
    };
    if (tabela === 'perfis' && (url.searchParams.get('email') || '').includes(EU)) {
      return responder([{ id: 'p-teste', nivel: state.admin ? 'Administrador' : 'Comum', nome: 'Vendedor Teste', email: EU }]);
    }
    if (tabela === 'alcadas_capacidade' && url.searchParams.get('modulo') === 'eq.inbox') {
      const cap = (url.searchParams.get('capacidade') || '').replace('eq.', '');
      return responder((state.caps || []).includes(cap) ? [{ id: 'a-' + cap }] : []);
    }
    if (tabela === 'emails_projeto' && (url.searchParams.get('select') || '').includes('dono_email') && (url.searchParams.get('id') || '').startsWith('in.')) {
      if (state.metaErro) return route.fulfill({ status: 414, contentType: 'application/json', body: JSON.stringify({ message: 'URI Too Long (simulado)' }) });
      return responder([ID1, ID2].map((id) => ({ id, ia_decisao: null, dono_email: EU, atribuido_a: null, spam_em: null })));
    }
    return route.fallback();
  });
}

const pastaAtiva = (page) => page.locator('.inbox__folder.is-active');

test('E.1 — clicar num e-mail da Caixa de entrada não troca a pasta e grava o id na URL', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { admin: true });
  await page.goto('/geral/inbox');
  await expect(page.locator('.inbox__row', { hasText: 'Assunto dois' })).toBeVisible({ timeout: 45_000 });
  await expect(pastaAtiva(page)).toContainText('Caixa de entrada');

  await page.locator('.inbox__row', { hasText: 'Assunto dois' }).click();
  await expect(page.locator('.inbox__row.is-active')).toContainText('Assunto dois');
  await expect(page).toHaveURL(new RegExp('/geral/inbox/' + ID2));
  await page.waitForTimeout(500);
  await expect(pastaAtiva(page)).toContainText('Caixa de entrada');

  await page.locator('.inbox__row', { hasText: 'Assunto um' }).click();
  await expect(page).toHaveURL(new RegExp('/geral/inbox/' + ID1));
  await page.waitForTimeout(500);
  await expect(pastaAtiva(page)).toContainText('Caixa de entrada');
  expect(erros).toEqual([]);
});

test('E.1 — link direto /geral/inbox/<id> abre o e-mail', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { admin: true });
  await page.goto('/geral/inbox/' + ID2);
  await expect(page.locator('.inbox__row.is-active')).toContainText('Assunto dois', { timeout: 45_000 });
  await expect(page).toHaveURL(new RegExp('/geral/inbox/' + ID2));
  expect(erros).toEqual([]);
});

test('E.2 — falha ao ler o dono dos e-mails não esconde a caixa de quem não faz triagem', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { admin: false, caps: ['ver', 'criar', 'editar', 'excluir'], metaErro: true });
  await page.goto('/geral/inbox');
  await expect(page.locator('.inbox__row', { hasText: 'Assunto um' })).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.inbox__row', { hasText: 'Assunto dois' })).toBeVisible();
  await expect(page.getByText('Não foi possível conferir o responsável dos e-mails')).toBeVisible();
  expect(erros).toEqual([]);
});

test('E.2 — sem falha, a regra de dono continua valendo (e-mail meu aparece)', async ({ page }) => {
  await preparar(page, { admin: false, caps: ['ver', 'criar', 'editar', 'excluir'] });
  await page.goto('/geral/inbox');
  await expect(page.locator('.inbox__row', { hasText: 'Assunto um' })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Não foi possível conferir o responsável dos e-mails')).toHaveCount(0);
});
