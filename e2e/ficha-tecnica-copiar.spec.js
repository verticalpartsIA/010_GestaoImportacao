'use strict';
/* Ficha Técnica — Copiar ficha e Trocar valores (8.4).
   Supabase simulado COM uma ficha; escritas continuam bloqueadas (403): o teste nunca grava. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const ID = 'f1f2ae91-dace-4d31-aba2-f8067ceef6b5';
const FICHA = {
  id: ID, numero_documento: 'VPFT20260611_135', nome_produto: 'Máquina de Tração', categoria_produto: 'ELEVADORES/MÁQUINAS',
  codigo_produto: 'VPMAC-48K-380V', sku: null, produto_id: 'ft-x', criado_em: '2026-06-11T10:00:00Z',
  identificacao: { nomeProduto: 'Máquina de Tração', codigoProduto: 'VPMAC-48K-380V', partNumber: 'FRD-380V', categoriaProduto: 'ELEVADORES/MÁQUINAS',
    descricaoTecnica: 'Motor 380Vac, corrente 20A. Tensão 380Vac.', descricaoComercial: '8,1KW 380VAC' },
  cats: [], midia: { foto: null, desenho: null }, omie_publicado_em: null,
};

test('ficha: Copiar abre editor novo sem código; Trocar valores mostra prévia e aplica', async ({ page }) => {
  const erros = coletarErros(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Eng Teste', email: 'eng@verticalparts.com.br', iniciais: 'ET', id: 't' }));
  });
  await page.route('**/*.supabase.co/rest/v1/fichas_tecnicas*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify([FICHA]) });
  });
  await page.goto('/engenharia/ficha-tecnica');
  await page.getByRole('button', { name: 'Copiar', exact: true }).first().click({ timeout: 60_000 });

  await expect(page.getByText(/Cópia de VPFT20260611_135 — ainda não salva/)).toBeVisible();
  await expect(page.locator('.ft-name input')).toHaveValue('Máquina de Tração');
  // código e part number NÃO vêm na cópia
  await expect(page.getByText('Código do Produto (Omie)').locator('..').locator('input')).toHaveValue(/^$/);
  await expect(page.getByText('Ainda não publicado no Omie')).toBeVisible();

  await page.getByRole('button', { name: /Trocar valores/ }).click();
  await page.getByLabel('Trocar 1').fill('380Vac');
  await page.getByLabel('Por 1').fill('220Vac');
  await expect(page.getByText(/2 ocorrência\(s\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Aplicar na ficha' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('textarea').filter({ hasText: '220Vac' }).first()).toBeVisible();
  expect(erros).toEqual([]);
});

test('ficha: salvar a cópia copia as fotos para a pasta nova e INSERE ficha nova (nunca altera a original)', async ({ page }) => {
  const erros = coletarErros(page);
  const ficha = { ...FICHA, midia: { foto: 'fichas/' + ID + '/foto-x.jpg', desenho: null },
    cats: [{ id: 'c1', nome: 'Elétricas', icon: 'bolt', campos: [{ k: 'tensao', nome: 'Tensão', ativo: true, valor: '380 Vac', ordem: 1 }] }] };
  const chamadas = [];
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Eng Teste', email: 'eng@verticalparts.com.br', iniciais: 'ET', id: 't' }));
  });
  await page.route('**/*.supabase.co/storage/v1/object/copy', async (route) => {
    chamadas.push(['copy', route.request().postDataJSON()]);
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"ok"}' });
  });
  await page.route('**/*.supabase.co/storage/v1/object/fichas-imagens/**', (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/*.supabase.co/rest/v1/rpc/next_doc_number', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ numero_documento: 'VPFT20261111_1', seq_mes: 1, ano_mes: '202611' }]) }));
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request(); const nome = new URL(req.url()).pathname.replace('/rest/v1/', '');
    if (req.method() === 'GET' && nome === 'fichas_tecnicas')
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify([ficha]) });
    if (req.method() !== 'GET' && (nome === 'fichas_tecnicas' || nome === 'catalogo_produtos')) {
      chamadas.push([req.method() + ' ' + nome, req.postDataJSON()]);
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    return route.fallback();
  });
  await page.goto('/engenharia/ficha-tecnica');
  await page.getByRole('button', { name: 'Copiar', exact: true }).first().click({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Salvar ficha' }).click();
  await expect.poll(() => chamadas.some((c) => c[0] === 'POST fichas_tecnicas')).toBe(true);

  const copy = chamadas.find((c) => c[0] === 'copy')[1];
  const ins = chamadas.find((c) => c[0] === 'POST fichas_tecnicas')[1];
  expect(copy.sourceKey).toBe('fichas/' + ID + '/foto-x.jpg');
  expect(copy.destinationKey).toBe('fichas/' + ins.id + '/foto-x.jpg');
  expect(ins.id).not.toBe(ID);
  expect(ins.midia.foto).toBe(copy.destinationKey);
  expect(ins.codigo_produto == null || ins.codigo_produto === '').toBe(true);
  expect(chamadas.some((c) => c[0].startsWith('PATCH'))).toBe(false);
  expect(erros).toEqual([]);
});
