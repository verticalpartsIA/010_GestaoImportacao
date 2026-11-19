'use strict';
/* Boletos Avisos › os cards de valor viram botões que filtram a lista (18/11/2026, pedido do Gelson).
   Supabase simulado com dados montados em torno de "hoje" (data de Brasília); o banco real nunca é tocado. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const hojeISO = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const soma = (n) => new Date(Date.UTC(+hojeISO.slice(0, 4), +hojeISO.slice(5, 7) - 1, +hojeISO.slice(8, 10)) + n * 86400000).toISOString().slice(0, 10);
const diaUtilHoje = ![0, 6].includes(new Date(hojeISO + 'T12:00:00Z').getUTCDay());   // sem feriados no calendário simulado

/* Um título por faixa; o cliente 4 tem dois (um atrasado há mais de 30 dias e outro a vencer). */
const BOLETOS = [
  { codigo_lancamento_omie: 101, codigo_cliente_omie: 1, numero_documento: 'NF-A', numero_parcela: '1/1', data_vencimento: soma(20), valor: 100, tem_boleto: true, numero_boleto: 'B1', aberto: true },
  { codigo_lancamento_omie: 102, codigo_cliente_omie: 2, numero_documento: 'NF-B', numero_parcela: '1/1', data_vencimento: hojeISO, valor: 200, tem_boleto: true, numero_boleto: 'B2', aberto: true },
  { codigo_lancamento_omie: 103, codigo_cliente_omie: 3, numero_documento: 'NF-C', numero_parcela: '1/1', data_vencimento: soma(-10), valor: 300, tem_boleto: true, numero_boleto: 'B3', aberto: true },
  { codigo_lancamento_omie: 104, codigo_cliente_omie: 4, numero_documento: 'NF-D1', numero_parcela: '1/2', data_vencimento: soma(-60), valor: 400, tem_boleto: true, numero_boleto: 'B4', aberto: true },
  { codigo_lancamento_omie: 105, codigo_cliente_omie: 4, numero_documento: 'NF-D2', numero_parcela: '2/2', data_vencimento: soma(20), valor: 50, tem_boleto: true, numero_boleto: 'B5', aberto: true },
];
const LISTA = [
  { codigo_cliente_omie: 1, razao_social: 'CLIENTE UM A VENCER', cnpj: null, situacao: 'em_dia', dias_atraso: 0, qtd_boletos: 1, qtd_sem_boleto: 0, valor_total: 100, emails: ['um@x.com'], ultimo_aviso_em: null },
  { codigo_cliente_omie: 2, razao_social: 'CLIENTE DOIS HOJE', cnpj: null, situacao: 'vence_hoje', dias_atraso: 0, qtd_boletos: 1, qtd_sem_boleto: 0, valor_total: 200, emails: ['dois@x.com'], ultimo_aviso_em: null },
  { codigo_cliente_omie: 3, razao_social: 'CLIENTE TRES ATRASO CURTO', cnpj: null, situacao: 'atrasado', dias_atraso: 10, qtd_boletos: 1, qtd_sem_boleto: 0, valor_total: 300, emails: ['tres@x.com'], ultimo_aviso_em: null },
  { codigo_cliente_omie: 4, razao_social: 'CLIENTE QUATRO ATRASO LONGO', cnpj: null, situacao: 'atrasado', dias_atraso: 60, qtd_boletos: 2, qtd_sem_boleto: 0, valor_total: 450, emails: ['quatro@x.com'], ultimo_aviso_em: null },
];

async function preparar(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Financeiro Teste', email: 'financeiro.teste@verticalparts.com.br', iniciais: 'FT', id: 't' }));
  });
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const tabela = url.pathname.replace('/rest/v1/', '');
    const objeto = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    const responder = (linhas) => (objeto ? (linhas.length ? json(linhas[0]) : route.fulfill({ status: 406, contentType: 'application/json', body: '{"code":"PGRST116"}' })) : json(linhas));
    if (req.method() === 'POST' && (tabela === 'rpc/boletos_avisos_pode' || tabela === 'rpc/boletos_avisos_pode_gerir')) return json(false === (tabela.endsWith('gerir')) ? true : false);
    if (req.method() !== 'GET') return route.fallback();
    if (tabela === 'boletos_avisos_resumo_v') return responder(LISTA);
    if (tabela === 'boletos_avisos_config') return responder([{ id: true, envio_automatico: false, destino_teste: null, sincronizado_em: null }]);
    if (tabela === 'boletos_avisos_boletos') {
      const cli = (url.searchParams.get('codigo_cliente_omie') || '').replace('eq.', '');
      return json(cli ? BOLETOS.filter((b) => String(b.codigo_cliente_omie) === cli) : BOLETOS);
    }
    return route.fallback();
  });
}

const visivel = (page, nome) => page.getByText(nome, { exact: false }).first();
const linhasDaLista = (page) => page.locator('table.pcp-grid tbody > tr').filter({ hasText: /CLIENTE (UM|DOIS|TRES|QUATRO)/ });

test('sem filtro a lista mostra os 4 clientes e os cards têm os valores de cada faixa', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page);
  await page.goto('/adm-financeiro/boletos-avisos');
  await expect(visivel(page, 'CLIENTE UM A VENCER')).toBeVisible({ timeout: 45_000 });
  await expect(linhasDaLista(page)).toHaveCount(4);
  await expect(page.getByRole('button', { name: /Atrasado \(mais de 30 dias\)/ })).toContainText('400,00');
  expect(erros).toEqual([]);
});

test('clicar em "Atrasado (mais de 30 dias)" mostra só quem tem título nessa faixa, com o valor da faixa; clicar de novo limpa', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page);
  await page.goto('/adm-financeiro/boletos-avisos');
  await expect(visivel(page, 'CLIENTE QUATRO ATRASO LONGO')).toBeVisible({ timeout: 45_000 });
  const card = page.getByRole('button', { name: /Atrasado \(mais de 30 dias\)/ });
  await card.click();
  await expect(linhasDaLista(page)).toHaveCount(1);
  await expect(linhasDaLista(page).first()).toContainText('CLIENTE QUATRO');
  await expect(linhasDaLista(page).first()).toContainText('400,00');             // só o título da faixa, não os R$ 450 do cliente
  await expect(linhasDaLista(page).first()).not.toContainText('450,00');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(card).toContainText('filtrando');
  await expect(page).toHaveURL(/faixa=atrasadoMais30/);
  await expect(page.getByRole('button', { name: /Atrasado \(1 a 30 dias\)/ })).toContainText('300,00');   // os outros cards não zeram
  // o detalhe do cliente lista só o título da faixa
  await linhasDaLista(page).first().locator('td').nth(3).click();   // célula do nome (0 = caixa de seleção, 1 = setinha; o centro da linha cai na célula Score, que abre a consulta)
  await expect(page.getByText('NF-D1')).toBeVisible();
  await expect(linhasDaLista(page)).toHaveCount(1);                  // abrir o cliente não solta o filtro
  await expect(page.getByText('NF-D2')).toHaveCount(0);
  await card.click();
  await expect(linhasDaLista(page)).toHaveCount(4);
  await expect(page).not.toHaveURL(/faixa=/);
  expect(erros).toEqual([]);
});

test('"A vencer" traz o cliente que também está atrasado, mas só com o título a vencer; "Total" limpa o filtro', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page);
  await page.goto('/adm-financeiro/boletos-avisos');
  await expect(visivel(page, 'CLIENTE UM A VENCER')).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: /^A vencer/ }).click();
  await expect(linhasDaLista(page)).toHaveCount(2);                                // clientes 1 e 4
  await expect(linhasDaLista(page).filter({ hasText: 'CLIENTE QUATRO' })).toContainText('50,00');
  await page.getByRole('button', { name: /Total em aberto/ }).click();
  await expect(linhasDaLista(page)).toHaveCount(4);
  expect(erros).toEqual([]);
});

test('"Vence hoje" mostra só quem vence hoje (só em dia útil: fim de semana vale na segunda)', async ({ page }) => {
  test.skip(!diaUtilHoje, 'hoje não é dia útil: nada "vence hoje" por regra');
  const erros = coletarErros(page);
  await preparar(page);
  await page.goto('/adm-financeiro/boletos-avisos');
  await expect(visivel(page, 'CLIENTE DOIS HOJE')).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: /^Vence hoje/ }).click();
  await expect(linhasDaLista(page)).toHaveCount(1);
  await expect(linhasDaLista(page).first()).toContainText('CLIENTE DOIS HOJE');
  expect(erros).toEqual([]);
});
