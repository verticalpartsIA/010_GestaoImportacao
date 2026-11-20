'use strict';
/* Boletos Avisos › "Atualizar do Omie" manda o LOGIN da pessoa à função (18/11/2026).
   Defeito de produção: a tela chamava a Edge Function `boletos-avisos` só com a chave pública e ela respondia
   401 "Não autorizado" para todo mundo (inclusive Gelson, Diego e Juliana). Supabase simulado; o banco real e o Omie
   nunca são tocados. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

async function preparar(page) {
  const chamadasFuncao = [];
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Gerente Teste', email: 'gelson.simoes@verticalparts.com.br', iniciais: 'GT', id: 't' }));
  });
  await page.route('**/*.supabase.co/functions/v1/boletos-avisos', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fallback();
    chamadasFuncao.push({ authorization: req.headers()['authorization'] || '', corpo: JSON.parse(req.postData() || '{}') });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, boletosAbertos: 3, clientes: 2 }) });
  });
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request();
    const tabela = new URL(req.url()).pathname.replace('/rest/v1/', '');
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() === 'POST' && (tabela === 'rpc/boletos_avisos_pode' || tabela === 'rpc/boletos_avisos_pode_gerir')) return json(true);
    if (req.method() !== 'GET') return route.fallback();
    if (tabela === 'boletos_avisos_resumo_v') return json([]);
    if (tabela === 'boletos_avisos_config') return json({ id: true, envio_automatico: false, destino_teste: null, sincronizado_em: null });
    return route.fallback();
  });
  return chamadasFuncao;
}

test('Atualizar do Omie leva o login da pessoa no cabeçalho (antes ia só a chave pública e dava 401)', async ({ page }) => {
  const erros = coletarErros(page);
  const chamadas = await preparar(page);
  await page.goto('/adm-financeiro/boletos-avisos');
  const botao = page.getByRole('button', { name: /Atualizar do Omie/ });
  await expect(botao).toBeVisible({ timeout: 45_000 });
  await page.evaluate(() => { window.VpAuth.getAccessToken = async () => 'TOKEN-DE-TESTE'; });
  await botao.click();
  await expect.poll(() => chamadas.length).toBe(1);
  expect(chamadas[0].authorization).toBe('Bearer TOKEN-DE-TESTE');
  expect(chamadas[0].corpo.acao).toBe('sincronizar');
  await expect(page.getByText(/Omie lido: 3 boletos/)).toBeVisible();
  expect(erros).toEqual([]);
});

test('sem sessão ativa não finge: avisa a pessoa e nem chama a função', async ({ page }) => {
  const erros = coletarErros(page);
  const chamadas = await preparar(page);
  await page.goto('/adm-financeiro/boletos-avisos');
  const botao = page.getByRole('button', { name: /Atualizar do Omie/ });
  await expect(botao).toBeVisible({ timeout: 45_000 });
  await page.evaluate(() => { window.VpAuth.getAccessToken = async () => null; });
  await botao.click();
  await expect(page.getByText(/Sua sessão não está ativa/)).toBeVisible();
  expect(chamadas.length).toBe(0);
  expect(erros).toEqual([]);
});
