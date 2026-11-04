'use strict';
/* Solicitações de Produto — chat interno e devolução com pendência (8.3).

   Supabase simulado COM dados (solicitação, mensagens, perfis); a função `solicitacao_devolver` é respondida pelo
   teste. Demais leituras caem no isolamento padrão (lista vazia) e escritas em 403 (e2e/helpers.js).
   O banco de produção nunca é tocado. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const FICHA = '11111111-2222-3333-4444-555555555555';

function solicitacao(extra) {
  return Object.assign({
    id: 77, numero_solicitacao: 'SOL-20261104-00077', status: 'convertido_em_ficha', tipo_equipamento: 'elevador',
    categoria_sku: 'VPEL', cliente_nome: 'Cliente Teste', solicitante_nome: 'Guilherme Garcia', solicitante_email: 'guilherme@verticalparts.com.br',
    descricao_inicial: 'Placa de monitoramento', ficha_tecnica_id: FICHA, anexos: [], data_criacao: '2026-10-19T13:00:00Z',
    pendente_com: null, pendente_desde: null, pendente_prazo: null, pendente_motivo: null,
  }, extra || {});
}

async function preparar(page, { email, nome, sol, mensagens, nivel }) {
  const estado = { rpc: [], mensagensNovas: [] };
  await page.addInitScript(([e, n]) => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: n, email: e, iniciais: 'XX', id: 't' }));
  }, [email, nome]);
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const caminho = url.pathname.replace('/rest/v1/', '');
    const m = req.method();
    const objeto = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const responder = (linhas) => {
      if (objeto) return linhas.length ? json(200, linhas[0]) : json(406, { code: 'PGRST116', message: '0 rows' });
      return json(200, linhas);
    };
    if (caminho === 'solicitacoes_produto' && m === 'GET') return responder([sol]);
    if (caminho === 'solicitacao_produto_mensagens' && m === 'GET') return responder(mensagens.concat(estado.mensagensNovas));
    if (caminho === 'solicitacao_produto_mensagens' && m === 'POST') {
      estado.mensagensNovas.push(Object.assign({ id: 'novo-' + estado.mensagensNovas.length, criado_em: new Date().toISOString() }, JSON.parse(req.postData())[0]));
      return json(201, []);
    }
    if (caminho === 'perfis' && m === 'GET') return responder([{ nivel: nivel || 'Colaborador' }]);
    if (caminho === 'fichas_tecnicas' && m === 'GET') return responder([{ omie_publicado_em: null }]);
    if (caminho === 'rpc/solicitacao_devolver' && m === 'POST') { estado.rpc.push(JSON.parse(req.postData())); return json(204, null); }
    return route.fallback();
  });
  return estado;
}

const MSGS = [
  { id: 'm1', solicitacao_id: 77, autor_email: 'guilherme@verticalparts.com.br', autor_nome: 'Guilherme Garcia', setor: 'solicitante', tipo: 'mensagem', texto: 'Preciso dessa placa para a obra.', anexos: [], criado_em: '2026-10-19T13:05:00Z' },
];

test('chat: a aba Chat vai na URL, mostra as mensagens e a Importação consegue devolver à Engenharia', async ({ page }) => {
  const erros = coletarErros(page);
  const estado = await preparar(page, { email: 'bianca@verticalparts.com.br', nome: 'Bianca Mayumi', sol: solicitacao(), mensagens: MSGS });
  await page.goto('/engenharia/solicitacoes-produto/77');
  await expect(page.getByRole('tab', { name: /Chat/ })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('tab', { name: /Chat/ }).click();
  await expect(page).toHaveURL(/\/solicitacoes-produto\/77\/chat$/);
  await expect(page.getByText('Preciso dessa placa para a obra.')).toBeVisible();

  await page.getByRole('button', { name: /Devolver…/ }).click();
  await expect(page.getByText(/prazo de 4 horas comerciais/)).toBeVisible();
  await page.getByPlaceholder(/Explique com clareza/).fill('curto');
  await page.getByRole('button', { name: 'Devolver', exact: true }).click();
  await expect(page.getByText(/mínimo 10 letras/)).toBeVisible();
  await page.getByPlaceholder(/Explique com clareza/).fill('O NCM sugerido parece errado, favor conferir.');
  await page.getByRole('button', { name: 'Devolver', exact: true }).click();
  await expect.poll(() => estado.rpc.length, { timeout: 15_000 }).toBe(1);
  expect(estado.rpc[0]).toMatchObject({ p_id: 77, p_para: 'engenharia', p_setor_autor: 'importacao' });
  expect(new Date(estado.rpc[0].p_prazo).getTime()).toBeGreaterThan(Date.now());
  expect(erros).toEqual([]);
});

test('chat: link direto /chat abre a aba e a pendência para a Engenharia mostra a faixa e o botão de responder', async ({ page }) => {
  const erros = coletarErros(page);
  const prazoPassado = '2020-01-06T13:00:00Z';
  await preparar(page, {
    email: 'alexandre@verticalparts.com.br', nome: 'Alexandre Schmidt', mensagens: MSGS,
    sol: solicitacao({ pendente_com: 'engenharia', pendente_desde: '2020-01-06T12:00:00Z', pendente_prazo: prazoPassado, pendente_motivo: 'NCM parece errado' }),
  });
  await page.goto('/engenharia/solicitacoes-produto/77/chat');
  await expect(page.getByText(/Devolvida à Engenharia — pendente de resposta/).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/ATRASADA/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Responder e encerrar a pendência/ })).toBeVisible();
  expect(erros).toEqual([]);
});

test('chat: quem não é do departamento nem o solicitante só escreve mensagens (sem encerrar a pendência)', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, {
    email: 'outro.vendedor@verticalparts.com.br', nome: 'Outro Vendedor', mensagens: MSGS,
    sol: solicitacao({ status: 'em_analise', pendente_com: 'solicitante', pendente_prazo: '2099-01-01T12:00:00Z', pendente_motivo: 'Faltam fotos' }),
  });
  await page.goto('/engenharia/solicitacoes-produto/77/chat');
  await expect(page.getByText(/Devolvida ao Solicitante — pendente de resposta/).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: /Responder e encerrar a pendência/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar mensagem' })).toBeVisible();
  expect(erros).toEqual([]);
});

test('detalhe: Voltar do navegador sai do detalhe e a aba Informações limpa a URL', async ({ page }) => {
  const erros = coletarErros(page);
  await preparar(page, { email: 'bianca@verticalparts.com.br', nome: 'Bianca Mayumi', sol: solicitacao(), mensagens: MSGS });
  await page.goto('/engenharia/solicitacoes-produto');
  await expect(page.getByRole('button', { name: 'ABRIR' }).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'ABRIR' }).first().click();
  await expect(page).toHaveURL(/\/solicitacoes-produto\/77$/);
  await page.getByRole('tab', { name: /Chat/ }).click();
  await expect(page).toHaveURL(/\/77\/chat$/);
  await page.getByRole('tab', { name: /Informações/ }).click();
  await expect(page).toHaveURL(/\/77$/);
  await page.goBack(); // volta para /77/chat
  await expect(page).toHaveURL(/\/77\/chat$/);
  await expect(page.getByText('Preciso dessa placa para a obra.')).toBeVisible();
  await page.goBack(); // /77
  await page.goBack(); // lista
  await expect(page).toHaveURL(/\/solicitacoes-produto$/);
  await expect(page.getByText('+ NOVA SOLICITAÇÃO')).toBeVisible();
  expect(erros).toEqual([]);
});
