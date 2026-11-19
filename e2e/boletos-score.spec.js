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

const hojeISO = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const somaDias = (n) => new Date(Date.UTC(+hojeISO.slice(0, 4), +hojeISO.slice(5, 7) - 1, +hojeISO.slice(8, 10)) + n * 86400000).toISOString().slice(0, 10);

test('card: calendário de início e fim pede exatamente essas datas ao banco; período no futuro mostra a carteira a vencer', async ({ page }) => {
  const erros = coletarErros(page);
  const ch = await preparar(page, { gerir: false });
  await page.goto('/adm-financeiro/boletos-avisos');
  await expect(page.getByText('Índice de inadimplência').first()).toBeVisible({ timeout: 45_000 });
  await expect.poll(() => ch.indice.length).toBeGreaterThan(0);
  const padrao = ch.indice[ch.indice.length - 1];
  expect(padrao.p_de < padrao.p_ate).toBe(true);
  expect(padrao.p_ate < hojeISO).toBe(true);                                        // o padrão (últimos 30 dias) termina ontem
  await expect(page.getByText('15%').first()).toBeVisible();

  // datas livres: de 01/01/2026 até daqui a 60 dias (passado e futuro no mesmo período)
  await page.getByLabel('Data de início').fill('2026-01-01');
  await page.getByLabel('Data de fim').fill(somaDias(60));
  await expect.poll(() => { const u = ch.indice[ch.indice.length - 1]; return u.p_de + '|' + u.p_ate; }).toBe('2026-01-01|' + somaDias(60));
  await expect(page.getByText('A vencer no período')).toBeVisible();
  await expect(page.getByText('15%').first()).toBeVisible();                        // a parte já vencida continua com índice

  // só futuro: sem índice, só a carteira
  await page.getByRole('link', { name: 'Próximos 30 dias' }).click();
  await expect.poll(() => ch.indice[ch.indice.length - 1].p_de).toBe(somaDias(1));
  await expect(page.getByText('A vencer no período')).toBeVisible();
  await expect(page.getByText('Pago em dia')).toHaveCount(0);

  // início depois do fim: avisa e NÃO consulta o banco
  await page.getByLabel('Data de início').fill(somaDias(10));
  await page.getByLabel('Data de fim').fill(somaDias(5));
  await expect(page.getByRole('alert')).toContainText('depois');
  const ultima = ch.indice[ch.indice.length - 1];
  expect(ultima.p_de <= ultima.p_ate).toBe(true);
  expect(erros).toEqual([]);
});

test('lista: setas nos títulos classificam do menor ao maior, do maior ao menor e voltam à ordem original', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { gerir: false });
  await page.goto('/adm-financeiro/boletos-avisos');
  const linhas = page.locator('table.pcp-grid tbody > tr').filter({ hasText: /CLIENTE (BOM|RUIM)/ });
  await expect(linhas).toHaveCount(2, { timeout: 45_000 });
  const th = page.locator('table.pcp-grid thead th').filter({ hasText: /Valor em aberto/ });
  await expect(th).toHaveAttribute('aria-sort', 'none');
  await th.click();
  await expect(th).toHaveAttribute('aria-sort', 'ascending');
  await expect(linhas.first()).toContainText('CLIENTE BOM');                        // R$ 500 antes de R$ 8.000
  await th.click();
  await expect(th).toHaveAttribute('aria-sort', 'descending');
  await expect(linhas.first()).toContainText('CLIENTE RUIM');
  await th.click();
  await expect(th).toHaveAttribute('aria-sort', 'none');
  await expect(linhas.first()).toContainText('CLIENTE BOM');                        // ordem original
  // por Razão Social, decrescente: RUIM antes de BOM
  const razao = page.locator('table.pcp-grid thead th').filter({ hasText: /Razão Social/ });
  await razao.click(); await razao.click();
  await expect(linhas.first()).toContainText('CLIENTE RUIM');
  expect(erros).toEqual([]);
});

test('lista: caixas na coluna Situação escolhem quais situações aparecem; nada marcado mostra todas', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { gerir: false });
  await page.goto('/adm-financeiro/boletos-avisos');
  const linhas = page.locator('table.pcp-grid tbody > tr').filter({ hasText: /CLIENTE (BOM|RUIM)/ });
  await expect(linhas).toHaveCount(2, { timeout: 45_000 });
  await page.getByRole('button', { name: 'Filtrar por situação' }).click();
  await page.getByRole('checkbox', { name: 'Atrasado' }).check();
  await expect(linhas).toHaveCount(1);
  await expect(linhas.first()).toContainText('CLIENTE RUIM');
  await expect(page).toHaveURL(/sit=atrasado/);
  await page.getByRole('checkbox', { name: 'Em dia' }).check();
  await expect(linhas).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Em dia' }).uncheck();
  await page.getByRole('checkbox', { name: 'Atrasado' }).uncheck();
  await expect(linhas).toHaveCount(2);                                              // nada marcado = todas
  await page.getByRole('checkbox', { name: 'Atrasado' }).check();
  await page.getByRole('link', { name: 'Mostrar todas' }).click();
  await expect(linhas).toHaveCount(2);
  await expect(page).not.toHaveURL(/sit=/);
  // clicar na caixa não classifica a coluna (o filtro não dispara a ordenação do título)
  await expect(page.locator('table.pcp-grid thead th').filter({ hasText: /Situação/ })).toHaveAttribute('aria-sort', 'none');
  expect(erros).toEqual([]);
});

test('lista: caixa em cada linha marca e conta (clientes, títulos, valor); marcar não abre o detalhe; "marcar todos" tem estado intermediário', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { gerir: false });
  await page.goto('/adm-financeiro/boletos-avisos');
  const linhas = page.locator('table.pcp-grid tbody > tr').filter({ hasText: /CLIENTE (BOM|RUIM)/ });
  await expect(linhas).toHaveCount(2, { timeout: 45_000 });
  const resumo = page.getByRole('status', { name: 'Clientes selecionados' });
  const todos = page.getByRole('checkbox', { name: 'Selecionar todos os clientes da lista' });
  await expect(resumo).toHaveCount(0);                                              // nada marcado: sem barra

  await page.getByRole('checkbox', { name: 'Selecionar CLIENTE RUIM SA' }).check();
  await expect(resumo).toContainText('1 cliente(s) selecionado(s)');
  await expect(resumo).toContainText('2 título(s)');
  await expect(resumo).toContainText('8.000,00');
  await expect(page.getByText('Boletos em aberto deste cliente').or(page.locator('table.pcp-grid tbody tr td[colspan]'))).toHaveCount(0);   // marcar não abriu o detalhe
  expect(await todos.evaluate(el => el.indeterminate)).toBe(true);                  // só uma de duas: estado intermediário

  await todos.check();
  await expect(resumo).toContainText('2 cliente(s) selecionado(s)');
  await expect(resumo).toContainText('8.500,00');
  expect(await todos.evaluate(el => el.indeterminate)).toBe(false);
  await expect(page.getByRole('checkbox', { name: 'Selecionar CLIENTE BOM LTDA' })).toBeChecked();

  // filtrar por situação: o marcado que sai da lista não é contado, mas é avisado
  await page.getByRole('button', { name: 'Filtrar por situação' }).click();
  await page.getByRole('checkbox', { name: 'Atrasado' }).check();
  await expect(linhas).toHaveCount(1);
  await expect(resumo).toContainText('1 cliente(s) selecionado(s)');
  await expect(resumo).toContainText('8.000,00');
  await expect(resumo).toContainText('+1 marcado(s) fora do filtro');

  await page.getByRole('link', { name: 'Limpar seleção' }).click();
  await expect(resumo).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Selecionar CLIENTE RUIM SA' })).not.toBeChecked();
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
