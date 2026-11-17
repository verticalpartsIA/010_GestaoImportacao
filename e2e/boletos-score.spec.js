'use strict';
/* Boletos Avisos › Índice de inadimplência e Consulta de cliente (score) — 17/11/2026.
   Supabase simulado COM dados; o banco de produção nunca é tocado. Demais leituras caem no isolamento padrão
   (lista vazia) e escritas em 403 (e2e/helpers.js). */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const score = (o) => ({ pagos_em_dia: 0, pagos_atrasados: 0, abertos_vencidos: 0, pagos_sem_data: 0, atraso_medio_dias: 0, maior_atraso_dias: 0,
  aberto_vencido_dias_max: 0, aberto_vencido_valor: 0, valor_pago_total: 0, ultimo_pagamento: null, primeiro_vencimento: '2024-02-10', titulos_total: 0, ...o });

const CLIENTES = [
  { codigo_cliente_omie: 11, razao_social: 'CLIENTE BOM LTDA', cnpj: '11.111.111/0001-11' },
  { codigo_cliente_omie: 22, razao_social: 'CLIENTE RUIM SA', cnpj: '22.222.222/0001-22' },
  { codigo_cliente_omie: 33, razao_social: 'CLIENTE NOVO ME', cnpj: '33.333.333/0001-33' },
];
const SCORES = [
  score({ codigo_cliente_omie: 11, razao_social: 'CLIENTE BOM LTDA', pagos_em_dia: 10, ultimo_pagamento: '2026-11-01', titulos_total: 10 }),
  score({ codigo_cliente_omie: 22, razao_social: 'CLIENTE RUIM SA', pagos_em_dia: 2, pagos_atrasados: 6, abertos_vencidos: 2, atraso_medio_dias: 25, maior_atraso_dias: 50,
    aberto_vencido_dias_max: 40, aberto_vencido_valor: 8000, titulos_total: 10 }),
];
const LISTA = [
  { codigo_cliente_omie: 11, razao_social: 'CLIENTE BOM LTDA', cnpj: '11.111.111/0001-11', situacao: 'em_dia', dias_atraso: 0, qtd_boletos: 1, qtd_sem_boleto: 0, valor_total: 500, emails: ['a@bom.com'], ultimo_aviso_em: null },
  { codigo_cliente_omie: 22, razao_social: 'CLIENTE RUIM SA', cnpj: '22.222.222/0001-22', situacao: 'atrasado', dias_atraso: 40, qtd_boletos: 2, qtd_sem_boleto: 0, valor_total: 8000, emails: ['a@ruim.com'], ultimo_aviso_em: null },
];
const INDICE = { vencido_valor: 10000, vencido_aberto_valor: 1500, pago_em_dia_valor: 7000, pago_atrasado_valor: 1500, titulos: 20, clientes: 6,
  a_vencer_valor: 5000, a_vencer_titulos: 4, a_vencer_clientes: 3 };
const TITULOS = [
  { codigo_lancamento_omie: 1, numero_documento: '100', numero_parcela: '1/1', data_vencimento: '2026-10-10', data_pagamento: '2026-10-10', valor: 500, valor_pago: 500, pago: true, status_omie: 'LIQUIDADO', atualizado_em: '2026-11-17T12:00:00Z' },
];

async function preparar(page, { gerir }) {
  const chamadas = { indice: [] };
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
    const responder = (linhas) => (objeto ? (linhas.length ? json(200, linhas[0]) : json(406, { code: 'PGRST116', message: '0 rows' })) : json(200, linhas));
    if (m === 'POST' && tabela === 'rpc/boletos_avisos_pode') return json(200, true);
    if (m === 'POST' && tabela === 'rpc/boletos_avisos_pode_gerir') return json(200, !!gerir);
    if (m === 'POST' && tabela === 'rpc/boletos_avisos_indice') { chamadas.indice.push(JSON.parse(req.postData() || '{}')); return json(200, INDICE); }
    if (m !== 'GET') return route.fallback();
    if (tabela === 'boletos_avisos_resumo_v') return responder(LISTA);
    if (tabela === 'boletos_avisos_config') return responder([{ id: true, envio_automatico: false, destino_teste: null, sincronizado_em: '2026-11-17T09:00:00Z' }]);
    if (tabela === 'boletos_avisos_score_config') return responder([{ id: true }]);
    if (tabela === 'boletos_avisos_score_v') return responder(SCORES);
    if (tabela === 'boletos_avisos_clientes') return responder(CLIENTES);
    if (tabela === 'boletos_avisos_historico') return responder(TITULOS);
    return route.fallback();
  });
  return chamadas;
}

test('quem só lê: vê o card do índice, o chip de classe e NENHUM botão de ação', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { gerir: false });
  await page.goto('/adm-financeiro/boletos-avisos');
  await expect(page.getByText('Índice de inadimplência').first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('15%').first()).toBeVisible();                       // 1.500 ÷ 10.000
  await expect(page.getByText('CLIENTE BOM LTDA').first()).toBeVisible();
  await expect(page.locator('tr', { hasText: 'CLIENTE BOM LTDA' }).getByText('Novo', { exact: true })).toHaveCount(0);
  // chip na lista: o bom é A, o ruim é D (a lista usa os mesmos limites da consulta)
  await expect(page.locator('tr', { hasText: 'CLIENTE BOM LTDA' }).getByText('A', { exact: true })).toBeVisible();
  await expect(page.locator('tr', { hasText: 'CLIENTE RUIM SA' }).getByText('D', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Consultar cliente (score)' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Atualizar do Omie/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Simular envio de hoje/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Enviar aviso/ })).toHaveCount(0);
  await expect(page.locator('input[type=checkbox]').first()).toBeDisabled();       // envio automático
  expect(erros).toEqual([]);
});

test('quem gerencia (3 fixos) continua vendo os botões de ação', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { gerir: true });
  await page.goto('/adm-financeiro/boletos-avisos');
  await expect(page.getByRole('button', { name: /Atualizar do Omie/ })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('button', { name: /Simular envio de hoje/ })).toBeVisible();
  expect(erros).toEqual([]);
});

test('card: Passado → Presente → Futuro pedem o período certo ao banco e o Futuro não mostra índice', async ({ page }) => {
  const erros = coletarErros(page);
  const ch = await preparar(page, { gerir: false });
  await page.goto('/adm-financeiro/boletos-avisos');
  await expect(page.getByText('Índice de inadimplência').first()).toBeVisible({ timeout: 45_000 });
  await expect.poll(() => ch.indice.length).toBeGreaterThan(0);
  const passado = ch.indice[ch.indice.length - 1];
  expect(passado.p_de < passado.p_ate).toBe(true);

  await page.getByRole('button', { name: 'Futuro', exact: true }).click();
  await expect(page.getByText(/não existe índice de inadimplência para o futuro/i)).toBeVisible();
  const futuro = ch.indice[ch.indice.length - 1];
  expect(futuro.p_de > passado.p_ate).toBe(true);                                   // o futuro começa depois do passado

  await page.getByRole('button', { name: 'Presente', exact: true }).click();
  await expect(page.getByText('15%').first()).toBeVisible();
  expect(erros).toEqual([]);
});

test('consulta: busca o cliente e mostra classe, conselho e títulos; cliente sem histórico aparece como novo', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { gerir: false });
  await page.goto('/adm-financeiro/boletos-avisos');
  await page.getByRole('button', { name: 'Consultar cliente (score)' }).click({ timeout: 45_000 });
  await expect(page).toHaveURL(/\/boletos-avisos\/score/);

  await page.getByPlaceholder(/Buscar cliente/).fill('ruim');
  await page.getByRole('button', { name: /CLIENTE RUIM SA/ }).click();
  await expect(page.getByText(/Alto risco: só vender à vista/)).toBeVisible();
  await expect(page).toHaveURL(/\/boletos-avisos\/score\/22/);

  await page.getByPlaceholder(/Buscar cliente/).fill('bom');
  await page.getByRole('button', { name: /CLIENTE BOM LTDA/ }).click();
  await expect(page.getByText(/Bom pagador: pode liberar/)).toBeVisible();

  await page.getByPlaceholder(/Buscar cliente/).fill('novo');
  await page.getByRole('button', { name: /CLIENTE NOVO ME/ }).click();
  await expect(page.getByText(/Cliente novo ou com pouco histórico/)).toBeVisible();
  await expect(page.getByText(/Alterar limites/)).toHaveCount(0);                   // só os 3 fixos alteram limites
  expect(erros).toEqual([]);
});
