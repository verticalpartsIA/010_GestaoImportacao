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

test('B.1 — Gantt, Lista e Kanban têm URL própria e sobrevivem ao F5', async ({ page }) => {
  await preparar(page, {});
  await page.goto('/geral/dashboard');
  await expect(page.getByRole('button', { name: 'Gantt' })).toHaveClass(/is-active/, { timeout: 45_000 });
  await page.getByRole('button', { name: 'Lista' }).click();
  await expect(page).toHaveURL(/\/geral\/dashboard\/lista$/);
  await page.getByRole('button', { name: 'Kanban' }).click();
  await expect(page).toHaveURL(/\/geral\/dashboard\/kanban$/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Kanban' })).toHaveClass(/is-active/, { timeout: 45_000 });
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Lista' })).toHaveClass(/is-active/);
  await page.getByRole('button', { name: 'Gantt' }).click();
  await expect(page).toHaveURL(/\/geral\/dashboard\/?$/);
});

test('C.1 — a saudação usa o nome tirado do e-mail do login', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Gelson Simoes', email: 'gelson.simoes@verticalparts.com.br', iniciais: 'GS', id: 't' }));
  });
  await page.goto('/geral/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^(Bom dia|Boa tarde|Boa noite), Gelson Simões\.$/, { timeout: 45_000 });
});

/* Visão por departamento + alçada (docs/modulos/01_geral.md 1.1.10). Supabase simulado: perfis, colaboradores_vpsistema e
   alcadas_capacidade respondem como o teste mandar; o resto segue vazio. */
const EMAIL_VISAO = 'visao.teste@verticalparts.com.br';
async function prepararVisao(page, { nivel = 'Comum', departamento = 'Comercial', caps = [], erroAlcadas = false } = {}) {
  await page.addInitScript((email) => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Visao Teste', email, iniciais: 'VT', id: 't' }));
  }, EMAIL_VISAO);
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request();
    const tabela = new URL(req.url()).pathname.replace('/rest/v1/', '');
    if (req.method() !== 'GET') return route.fallback();
    const objeto = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (corpo, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'content-range': '*/1' }, body: JSON.stringify(corpo) });
    if (tabela === 'perfis') return objeto ? json({ id: 'p-visao', nivel }) : json([{ id: 'p-visao', nivel }]);
    if (tabela === 'colaboradores_vpsistema') return json([{ departamento }]);
    if (tabela === 'alcadas_capacidade') {
      if (erroAlcadas) return json({ message: 'falha simulada' }, 500);
      return json(caps.map((c) => ({ modulo: c.split('.')[0], capacidade: c.split('.')[1] })));
    }
    return route.fallback();
  });
}
const titulo = (page, texto) => page.getByText(texto, { exact: false });

test('D.1 — comercial com alçada só de Leads vê os cartões de Leads e não vê Propostas, Onde Parou nem Projetos', async ({ page }) => {
  await prepararVisao(page, { caps: ['leads.ver', 'notificacoes.ver'] });
  await page.goto('/geral/dashboard');
  await expect(titulo(page, 'Leads novos').first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('dash-ocultos')).toBeVisible();
  await expect(titulo(page, 'Propostas enviadas').filter({ hasNotText: 'Minhas' })).toHaveCount(0);
  // sem propostas.ver_todas o total da empresa some, mas a pessoa vê as dela
  await expect(titulo(page, 'Minhas propostas enviadas').first()).toBeVisible();
  await expect(titulo(page, 'Onde Parou')).toHaveCount(0);
  await expect(titulo(page, 'Projetos em Andamento')).toHaveCount(0);
  await expect(titulo(page, 'Tarefas de Hoje').first()).toBeVisible();
  // não-administrador não escolhe a visão
  await expect(page.getByText('Visualizando como')).toHaveCount(0);
});

test('D.2 — sem nenhuma alçada de cartão a pessoa vê o Dashboard completo', async ({ page }) => {
  await prepararVisao(page, { departamento: 'Logística/Almoxarifado/Produção', caps: ['notificacoes.ver'] });
  await page.goto('/geral/dashboard');
  await expect(titulo(page, 'Onde Parou').first()).toBeVisible({ timeout: 45_000 });
  await expect(titulo(page, 'Projetos em Andamento').first()).toBeVisible();
  await expect(page.getByTestId('dash-ocultos')).toHaveCount(0);
});

test('D.3 — falha ao ler as alçadas mostra tudo, nunca esconde', async ({ page }) => {
  await prepararVisao(page, { caps: ['leads.ver'], erroAlcadas: true });
  await page.goto('/geral/dashboard');
  await expect(titulo(page, 'Onde Parou').first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('dash-ocultos')).toHaveCount(0);
});

test('D.4 — administrador vê tudo e continua escolhendo a visão', async ({ page }) => {
  await prepararVisao(page, { nivel: 'Administrador', caps: [] });
  await page.goto('/geral/dashboard');
  await expect(titulo(page, 'Onde Parou').first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Visualizando como')).toBeVisible();
  await expect(page.getByTestId('dash-ocultos')).toHaveCount(0);
});

test('D.5 — Logística tem perfil próprio: cartões de logística e nada de comercial', async ({ page }) => {
  await prepararVisao(page, { departamento: 'Logística/Almoxarifado/Produção', caps: ['separacao.ver', 'pcp.ver', 'notificacoes.ver'] });
  await page.goto('/geral/dashboard');
  await expect(titulo(page, 'OPs atrasadas').first()).toBeVisible({ timeout: 45_000 });
  await expect(titulo(page, 'Leads novos')).toHaveCount(0);
  await expect(titulo(page, 'Prontos para expedir')).toHaveCount(0); // sem a alçada de Expedição
});

test('D.6 — Importação tem perfil próprio: chegadas, lotes e avais jurídicos', async ({ page }) => {
  await prepararVisao(page, { departamento: 'Jurídico/Importação/Suprimentos', caps: ['importacao.ver', 'cotacoes-varejo.ver', 'aval-juridico.ver'] });
  await page.goto('/geral/dashboard');
  await expect(titulo(page, 'Chegadas em 30 dias').first()).toBeVisible({ timeout: 45_000 });
  await expect(titulo(page, 'Cotações de varejo em aberto').first()).toBeVisible();
  await expect(titulo(page, 'Avais jurídicos pendentes').first()).toBeVisible();
});
