'use strict';
/* Central de Decisões (/geral/decisoes) — issue #1215.

   Supabase simulado COM dados (decisoes_gerenciais e perfis). Escrita continua bloqueada (403) pelo isolamento padrão
   (e2e/helpers.js); nenhum teste aprova ou reprova nada. O banco de produção nunca é tocado. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const EU = 'regiane.rocha@verticalparts.com.br';   // Gestor Comercial: aprovadora fixa de envio_proposta_gestor
const PEND = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const AGORA = new Date().toISOString();

const PENDENTES = [{ id: PEND, tipo: 'envio_proposta_gestor', papel_requerido: 'gestor_comercial', status: 'pendente', numero_cotacao: 9101,
  aprovadores_esperados: [EU], contexto: { cliente: 'Cliente Pendente' }, criado_em: AGORA }];
const DECIDIDAS = [{ id: DEC, tipo: 'envio_proposta_gestor', papel_requerido: 'gestor_comercial', status: 'aprovada', numero_cotacao: 9102,
  aprovadores_esperados: [EU], decidido_por: EU, decidido_em: AGORA, contexto: { cliente: 'Cliente Decidido' }, criado_em: AGORA }];

async function preparar(page, state) {
  await page.addInitScript((email) => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Regiane Teste', email, iniciais: 'RT', id: 't' }));
  }, EU);
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const tabela = url.pathname.replace('/rest/v1/', '');
    if (req.method() !== 'GET') return route.fallback();
    const objeto = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (tabela === 'perfis' && (url.searchParams.get('email') || '').includes(EU)) {
      const p = { id: 'p-reg', nivel: 'Comum', nome: 'Regiane Teste', email: EU };
      return objeto ? json(200, p) : json(200, [p]);
    }
    if (tabela === 'decisoes_gerenciais') {
      const st = url.searchParams.get('status') || '';
      if (st.includes('pendente')) return json(200, PENDENTES);
      if (st.includes('aprovada')) { state.urlDecididas = req.url(); return json(200, DECIDIDAS); }
    }
    if (tabela === 'propostas' && state.propostasErro) return json(500, { message: 'falha simulada' });
    if (tabela === 'propostas' && (url.searchParams.get('numero_cotacao') || '') === 'eq.9101') return json(200, [{ id: 'prop-e2e-9101' }]);
    return route.fallback();
  });
}

test('C.1 — o histórico é filtrado por pessoa no banco (antes do limite)', async ({ page }) => {
  const state = {};
  await preparar(page, state);
  await page.goto('/geral/decisoes');
  await expect(page.getByText('Cliente Pendente')).toBeVisible({ timeout: 45_000 });
  const u = decodeURIComponent(state.urlDecididas || '');
  expect(u).toContain('or=(decidido_por.eq."' + EU + '"');
  expect(u).toContain('aprovadores_esperados.cs.{"' + EU + '"}');
});

test('C.2 — link de decisão já decidida avisa, abre "Decididas" e limpa o modal da URL', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, {});
  await page.goto('/geral/decisoes/' + DEC + '/aprovar');
  await expect(page.getByText(/Esta decisão já foi decidida/)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Cliente Decidido')).toBeVisible();
  await expect(page).toHaveURL(/\/geral\/decisoes\/?$/);
  expect(erros).toEqual([]);
});

test('C.2 — link de decisão inexistente avisa e limpa a URL', async ({ page }) => {
  await preparar(page, {});
  await page.goto('/geral/decisoes/cccccccc-cccc-4ccc-8ccc-cccccccccccc/aprovar');
  await expect(page.getByText(/Decisão não encontrada entre as suas/)).toBeVisible({ timeout: 45_000 });
  await expect(page).toHaveURL(/\/geral\/decisoes\/?$/);
});

test('C.2 — link de decisão pendente continua abrindo o modal', async ({ page }) => {
  await preparar(page, {});
  await page.goto('/geral/decisoes/' + PEND + '/aprovar');
  await expect(page.getByText('Aprovar decisão')).toBeVisible({ timeout: 45_000 });
});

test('C.3 — "Ver documento" com falha na consulta avisa e não sai da Central', async ({ page }) => {
  await preparar(page, { propostasErro: true });
  await page.goto('/geral/decisoes');
  await expect(page.getByText('Cliente Pendente')).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Ver documento' }).first().click();
  await expect(page.getByText(/Não foi possível localizar a proposta desta cotação agora/)).toBeVisible();
  await expect(page).toHaveURL(/\/geral\/decisoes/);
});

test('Ver documento (área blindada) continua abrindo a proposta da cotação', async ({ page }) => {
  await preparar(page, {});
  await page.goto('/geral/decisoes');
  await expect(page.getByText('Cliente Pendente')).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Ver documento' }).first().click();
  await expect(page).toHaveURL(/\/proposta-editor\/prop-e2e-9101/);
});
