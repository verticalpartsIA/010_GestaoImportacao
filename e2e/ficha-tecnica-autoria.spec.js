'use strict';
/* Ficha Técnica — rodapé mostra quem CRIOU e quem ATUALIZOU, nunca quem abriu (8.4).
   Supabase simulado; escritas continuam bloqueadas (403): o teste nunca grava. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const ID = '14fe0c60-a04f-4902-9eec-8ceec14742f6';
const FICHA = {
  id: ID, numero_documento: 'VPFT20261117_34', nome_produto: 'Produto X', categoria_produto: 'ELEVADORES', codigo_produto: 'VPEL-1',
  produto_id: 'ft-x', criado_em: '2026-11-17T18:52:23Z', atualizado_em: '2026-11-18T13:00:00Z',
  identificacao: { nomeProduto: 'Produto X', codigoProduto: 'VPEL-1', categoriaProduto: 'ELEVADORES', descricaoTecnica: 'Descrição técnica do produto.' },
  cats: [], midia: { foto: null, desenho: null }, omie_publicado_em: null,
};
const HIST = [
  { acao: 'criou', ator_nome: 'Vinicius Ramos', criado_em: '2026-11-17T18:52:24Z' },
  { acao: 'editou', ator_nome: 'Maria Souza', criado_em: '2026-11-18T13:00:00Z' },
];

test('ficha: rodapé cita criador, data/hora e quem atualizou — não o usuário que abriu', async ({ page }) => {
  const erros = coletarErros(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Quem Abriu', email: 'quem.abriu@verticalparts.com.br', iniciais: 'QA', id: 't' }));
  });
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request(); const nome = new URL(req.url()).pathname.replace('/rest/v1/', '');
    if (req.method() !== 'GET') return route.fallback();
    if (nome === 'fichas_tecnicas') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify([FICHA]) });
    if (nome === 'fichas_historico') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(HIST) });
    return route.fallback();
  });
  await page.goto('/engenharia/ficha-tecnica/' + ID);
  const rodape = page.locator('.ft-fz-footer').first();
  await expect(rodape).toContainText('Criada por Vinicius Ramos em 17/11/2026', { timeout: 60_000 });
  await expect(rodape).toContainText('Versão 2 — atualizada por Maria Souza em 18/11/2026');
  await expect(rodape).not.toContainText('quem.abriu');
  await expect(rodape).not.toContainText('Quem Abriu');
  expect(erros).toEqual([]);
});
