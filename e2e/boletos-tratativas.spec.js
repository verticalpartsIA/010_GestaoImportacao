'use strict';
/* Boletos Avisos › aba Tratativas (19/11/2026). Supabase simulado e COM ESTADO: as anotações e o caso mudam durante o teste.
   O banco real nunca é tocado. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const hojeISO = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const soma = (n) => new Date(Date.UTC(+hojeISO.slice(0, 4), +hojeISO.slice(5, 7) - 1, +hojeISO.slice(8, 10)) + n * 86400000).toISOString().slice(0, 10);
const AGORA = new Date().toISOString();
const ANTES = new Date(Date.now() - 3600e3).toISOString();

const LISTA = [
  { codigo_cliente_omie: 1, razao_social: 'ERGUE ELEVADORES LTDA', cnpj: '11.111.111/0001-11', situacao: 'vence_hoje', dias_atraso: 0, qtd_boletos: 1, qtd_sem_boleto: 0, valor_total: 500, emails: ['fin@erguea.com'], ultimo_aviso_em: ANTES, ultimo_aviso_etapa: 'D0', ultimo_aviso_status: 'enviado' },
  { codigo_cliente_omie: 2, razao_social: 'METRO DA BAHIA SA', cnpj: '22.222.222/0001-22', situacao: 'atrasado', dias_atraso: 5, qtd_boletos: 2, qtd_sem_boleto: 0, valor_total: 900, emails: ['x@metro.com'], ultimo_aviso_em: ANTES, ultimo_aviso_etapa: 'D+1', ultimo_aviso_status: 'enviado' },
  { codigo_cliente_omie: 3, razao_social: 'CLIENTE SEM CONVERSA LTDA', cnpj: '33.333.333/0001-33', situacao: 'em_dia', dias_atraso: 0, qtd_boletos: 1, qtd_sem_boleto: 0, valor_total: 100, emails: ['z@z.com'], ultimo_aviso_em: null, ultimo_aviso_etapa: null, ultimo_aviso_status: null },
];
const ENVIOS = [
  { id: 'e1', codigo_cliente_omie: 1, cliente_razao: 'ERGUE ELEVADORES LTDA', etapa: 'D0', origem: 'automatico', status: 'enviado', modo_teste: false, criado_em: ANTES, para: ['fin@erguea.com'], assunto: 'Seu boleto vence hoje — ERGUE', erro: null },
  { id: 'e2', codigo_cliente_omie: 2, cliente_razao: 'METRO DA BAHIA SA', etapa: 'D+1', origem: 'automatico', status: 'enviado', modo_teste: false, criado_em: ANTES, para: ['x@metro.com'], assunto: 'Boleto em aberto — METRO', erro: null },
];
const ENTRADAS = [
  { id: 'r1', referencia_id: 'e1', assunto: 'RE: Seu boleto vence hoje — ERGUE', de_email: 'fin@erguea.com', de_nome: 'Financeiro Ergue', corpo_texto: 'Boa tarde, já efetuamos o pagamento ontem. Segue o comprovante.', data_mensagem: AGORA },
  { id: 'd2', referencia_id: 'e2', assunto: 'Não é possível entregar: Boleto em aberto — METRO', de_email: 'postmaster@servidor.com', de_nome: 'Microsoft Outlook', corpo_texto: 'Falha', data_mensagem: AGORA },
];

async function preparar(page, { podeTratar = true, semTabelas = false } = {}) {
  const estado = { casos: [], tratativas: [], chamadas: [] };
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Financeiro Teste', email: 'financeiro.teste@verticalparts.com.br', iniciais: 'FT', id: 't' }));
  });
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const tabela = url.pathname.replace('/rest/v1/', '');
    const objeto = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const responder = (linhas) => (objeto ? (linhas.length ? json(linhas[0]) : json({ code: 'PGRST116' }, 406)) : json(linhas));
    const faltando = () => json({ code: 'PGRST205', message: "Could not find the table 'public." + tabela + "' in the schema cache" }, 404);

    if (req.method() === 'POST') {
      const corpo = JSON.parse(req.postData() || '{}');
      if (tabela === 'rpc/boletos_avisos_pode') return json(true);
      if (tabela === 'rpc/boletos_avisos_pode_gerir') return json(false);
      if (tabela === 'rpc/boletos_avisos_pode_atualizar') return json(false);
      if (tabela === 'rpc/boletos_avisos_pode_tratar') return json(!!podeTratar);
      if (tabela === 'rpc/boletos_avisos_caso_mudar') {
        estado.chamadas.push({ rpc: 'mudar', ...corpo });
        const antes = estado.casos.find((c) => c.codigo_cliente_omie === corpo.p_cliente);
        const novo = { codigo_cliente_omie: corpo.p_cliente, status: 'aberto', responsavel_email: null, promessa_pagamento: null, resolvido_em: null, atualizado_em: new Date().toISOString(), ...(antes || {}) };
        if ('status' in corpo.p_patch) novo.status = corpo.p_patch.status;
        if ('responsavel_email' in corpo.p_patch) novo.responsavel_email = corpo.p_patch.responsavel_email;
        if ('promessa_pagamento' in corpo.p_patch) novo.promessa_pagamento = corpo.p_patch.promessa_pagamento;
        estado.casos = estado.casos.filter((c) => c.codigo_cliente_omie !== corpo.p_cliente).concat(novo);
        for (const [tipo, k, rot] of [['status', 'status', 'Status do caso mudou'], ['atribuicao', 'responsavel_email', 'Responsável do caso mudou'], ['promessa', 'promessa_pagamento', 'Promessa de pagamento mudou']]) {
          if (k in corpo.p_patch) estado.tratativas.push({ id: 'm' + estado.tratativas.length, codigo_cliente_omie: corpo.p_cliente, tipo, texto: rot, autor: 'financeiro.teste@verticalparts.com.br', criado_em: new Date().toISOString(), meta: { de: antes ? antes[k] : null, para: corpo.p_patch[k] } });
        }
        return json(novo);
      }
      if (tabela === 'rpc/boletos_avisos_tratativa_nota') {
        estado.chamadas.push({ rpc: 'nota', ...corpo });
        if (!estado.casos.find((c) => c.codigo_cliente_omie === corpo.p_cliente)) estado.casos.push({ codigo_cliente_omie: corpo.p_cliente, status: 'em_tratativa', responsavel_email: null, promessa_pagamento: null, resolvido_em: null, atualizado_em: new Date().toISOString() });
        const linha = { id: 'n' + estado.tratativas.length, codigo_cliente_omie: corpo.p_cliente, tipo: 'nota', texto: corpo.p_texto, autor: 'financeiro.teste@verticalparts.com.br', criado_em: new Date().toISOString(), meta: {} };
        estado.tratativas.push(linha);
        return json(linha);
      }
      return route.fallback();
    }
    if (req.method() !== 'GET') return route.fallback();
    if (tabela === 'boletos_avisos_resumo_v') return responder(LISTA);
    if (tabela === 'boletos_avisos_config') return responder([{ id: true, envio_automatico: false, destino_teste: null, sincronizado_em: null }]);
    if (tabela === 'boletos_avisos_boletos') return json([{ codigo_lancamento_omie: 101, codigo_cliente_omie: 1, numero_documento: 'NF-1', numero_parcela: '1/1', data_vencimento: hojeISO, valor: 500, tem_boleto: true, numero_boleto: 'B1', aberto: true }]);
    if (tabela === 'boletos_avisos_envios') {
      const cli = (url.searchParams.get('codigo_cliente_omie') || '').replace('eq.', '');
      return json(cli ? ENVIOS.filter((e) => String(e.codigo_cliente_omie) === cli) : ENVIOS);
    }
    if (tabela === 'emails_projeto') return json(ENTRADAS);
    if (tabela === 'perfis') return json([{ email: 'joice@verticalparts.com.br', nome: 'Joice' }, { email: 'maximira@verticalparts.com.br', nome: 'Maximira' }]);
    if (tabela === 'boletos_avisos_casos') return semTabelas ? faltando() : json(estado.casos);
    if (tabela === 'boletos_avisos_tratativas') {
      if (semTabelas) return faltando();
      const cli = (url.searchParams.get('codigo_cliente_omie') || '').replace('eq.', '');
      return json(cli ? estado.tratativas.filter((t) => String(t.codigo_cliente_omie) === cli) : estado.tratativas);
    }
    return route.fallback();
  });
  return estado;
}

const linhas = (page) => page.locator('table.pcp-grid tbody > tr[data-cliente]');

test('a aba lista só quem pede atenção (respondeu ou teve e-mail devolvido), com o botão mostrando quantos', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page);
  await page.goto('/adm-financeiro/boletos-avisos');
  const botao = page.getByRole('button', { name: /^Tratativas \(2\)$/ });
  await expect(botao).toBeVisible({ timeout: 45_000 });
  await botao.click();
  await expect(page).toHaveURL(/\/boletos-avisos\/tratativas/);
  await expect(linhas(page)).toHaveCount(2);
  await expect(linhas(page).filter({ hasText: 'ERGUE ELEVADORES' })).toContainText('espera nossa resposta');
  await expect(linhas(page).filter({ hasText: 'ERGUE ELEVADORES' })).toContainText('comprovante');
  await expect(linhas(page).filter({ hasText: 'METRO DA BAHIA' })).toContainText('e-mail devolvido');
  await expect(page.getByText('CLIENTE SEM CONVERSA')).toHaveCount(0);
  // filtros
  await page.getByLabel('Filtrar por status').selectOption('novo');
  await expect(linhas(page)).toHaveCount(2);
  await page.getByPlaceholder('Buscar por razão social ou CNPJ…').fill('metro');
  await expect(linhas(page)).toHaveCount(1);
  expect(erros).toEqual([]);
});

test('abrir o caso mostra a linha do tempo; anotar, mudar status, responsável e promessa grava e atualiza a lista', async ({ page }) => {
  const erros = coletarErros(page);
  const estado = await preparar(page);
  await page.goto('/adm-financeiro/boletos-avisos/tratativas');
  await expect(linhas(page)).toHaveCount(2, { timeout: 45_000 });
  await linhas(page).filter({ hasText: 'ERGUE ELEVADORES' }).click();
  await expect(page).toHaveURL(/\/tratativas\/1$/);
  const tempo = page.getByLabel('Linha do tempo do caso');
  await expect(tempo.locator('[data-tipo="aviso"]')).toHaveCount(1);
  await expect(tempo.locator('[data-tipo="resposta"]')).toContainText('já efetuamos o pagamento');

  // anotação interna
  await page.getByLabel('Registrar tratativa').fill('Liguei para o financeiro, vão confirmar o pagamento amanhã.');
  await page.getByRole('button', { name: 'Registrar tratativa' }).click();
  await expect(tempo.locator('[data-tipo="nota"]')).toContainText('Liguei para o financeiro');
  expect(estado.chamadas.find((c) => c.rpc === 'nota')).toMatchObject({ p_cliente: 1 });

  // status, responsável e promessa
  await page.getByLabel('Status do caso').selectOption('aguardando_cliente');
  await page.getByLabel('Responsável').selectOption('joice@verticalparts.com.br');
  await page.getByLabel('Promessa de pagamento').fill(soma(3));
  await page.getByRole('button', { name: 'Salvar caso' }).click();
  await expect(tempo.locator('[data-tipo="promessa"]')).toBeVisible();
  const mudou = estado.chamadas.filter((c) => c.rpc === 'mudar').pop();
  expect(mudou.p_patch).toMatchObject({ status: 'aguardando_cliente', responsavel_email: 'joice@verticalparts.com.br', promessa_pagamento: soma(3) });

  // de volta à lista: o caso já não "espera nossa resposta" e mostra o novo estado
  await page.getByRole('button', { name: /Voltar aos casos/ }).click();
  const l = linhas(page).filter({ hasText: 'ERGUE ELEVADORES' });
  await expect(l).toContainText('Aguardando cliente');
  await expect(l).toContainText('joice@verticalparts.com.br');
  await expect(l).not.toContainText('espera nossa resposta');
  expect(erros).toEqual([]);
});

test('quem só lê vê o caso e a linha do tempo, sem campos para gravar', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { podeTratar: false });
  await page.goto('/adm-financeiro/boletos-avisos/tratativas/1');
  const tempo = page.getByLabel('Linha do tempo do caso');
  await expect(tempo.locator('[data-tipo="resposta"]')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByLabel('Registrar tratativa')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Salvar caso|Abrir caso|Registrar tratativa/ })).toHaveCount(0);
  await expect(page.getByLabel('Status do caso')).toBeDisabled();
  await expect(page.getByText(/Trata os casos/)).toBeVisible();
  expect(erros).toEqual([]);
});

test('sem as tabelas no banco a aba avisa e ainda mostra respostas e devoluções', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { semTabelas: true });
  await page.goto('/adm-financeiro/boletos-avisos/tratativas');
  await expect(page.getByRole('alert').filter({ hasText: 'ainda não foram criadas' })).toBeVisible({ timeout: 45_000 });
  await expect(linhas(page)).toHaveCount(2);
  expect(erros).toEqual([]);
});
