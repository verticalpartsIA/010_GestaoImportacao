'use strict';
/* Cadastros Mestres (Clientes e Fornecedores). Supabase simulado COM dados; o banco real nunca é tocado. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const LEGADO = {
  id: 'c-legado', codigo: 'VPCLI-0100', razao_social: 'Cliente Legado', nome_fantasia: null, tipo_pessoa: 'PJ', cnpj: null, cpf: null,
  inscricao_estadual: null, contribuinte_icms: true, documento_pendente: false, email: null, telefone: '11999990000', contato: 'Ana',
  endereco: 'Rua Velha 10', cidade: 'Guarulhos', estado: 'SP',
  endereco_logradouro: null, endereco_complemento: null, endereco_bairro: null, endereco_cep: null, endereco_cidade: null, endereco_estado: null,
  ativo: true, criado_em: '2026-08-19T11:33:00Z',
};

async function preparar(page, st) {
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Gelson Simoes', email: 'gelson.simoes@verticalparts.com.br', iniciais: 'GS', id: 't' }));
  });
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request(); const url = new URL(req.url());
    const tabela = url.pathname.replace('/rest/v1/', ''); const m = req.method();
    const json = (s, b) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    st.chamadas.push({ m, tabela, url: req.url(), body: req.postData() });
    if (tabela === 'clientes') {
      if (m === 'GET') return json(200, st.clientes);
      if (m === 'PATCH') { st.patch = JSON.parse(req.postData()); return json(200, { ...LEGADO, ...st.patch }); }
    }
    if (tabela === 'leads' && m === 'GET') return json(200, st.leads);
    if (tabela === 'fornecedores' && m === 'GET') return json(200, []);
    return route.fallback();
  });
}

test.describe('Cadastros › Clientes', () => {
  test('lista abre sem erro de JS e mostra o cliente; "—" na cidade quando só há coluna antiga', async ({ page }) => {
    const erros = coletarErros(page);
    const st = { clientes: [LEGADO], leads: [], chamadas: [] };
    await preparar(page, st);
    await page.goto('/cadastros/cadastro-clientes');
    await expect(page.getByText('Cliente Legado')).toBeVisible();
    await expect(page.locator('tbody tr').first()).toContainText('—');
    expect(erros).toEqual([]);
  });

  test('editar cliente que só tem cidade/UF/endereço nas colunas antigas preserva esses dados ao salvar', async ({ page }) => {
    const st = { clientes: [LEGADO], leads: [], chamadas: [], patch: null };
    await preparar(page, st);
    await page.goto('/cadastros/cadastro-clientes/' + LEGADO.id);
    await expect(page.getByText('Editar cliente VPCLI-0100')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect.poll(() => st.patch).not.toBeNull();
    expect(st.patch.cidade).toBe('Guarulhos');
    expect(st.patch.estado).toBe('SP');
    expect(st.patch.endereco).toContain('Rua Velha 10');
  });

  test('histórico consulta só leads não excluídos (filtra excluido_em)', async ({ page }) => {
    const st = { clientes: [LEGADO], leads: [{ id: 'LD-1', building: 'Lead apagado', origin: 'Site', owner: 'X', status: 'Sem retorno', date: '2026-01-02', excluido_em: '2026-02-01' }], chamadas: [] };
    await preparar(page, st);
    await page.goto('/cadastros/cadastro-clientes/' + LEGADO.id + '/historico');
    await expect(page.getByText('Score de relacionamento')).toBeVisible();
    const q = st.chamadas.find((c) => c.tabela === 'leads');
    expect(q.url).toContain('excluido_em=is.null');
  });

  test('link de cliente inexistente mostra "não encontrado" e não abre formulário', async ({ page }) => {
    const st = { clientes: [LEGADO], leads: [], chamadas: [] };
    await preparar(page, st);
    await page.goto('/cadastros/cadastro-clientes/nao-existe');
    await expect(page.getByText('Cliente não encontrado.')).toBeVisible();
    await expect(page.getByText('Novo cliente', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cadastrar cliente' })).toHaveCount(0);
  });

  test('busca por CNPJ com pontuação acha o cliente', async ({ page }) => {
    const st = { clientes: [{ ...LEGADO, cnpj: '11222333000181' }], leads: [], chamadas: [] };
    await preparar(page, st);
    await page.goto('/cadastros/cadastro-clientes');
    await page.getByPlaceholder(/Buscar por código/).fill('11.222.333/0001-81');
    await expect(page.getByText('1 cliente(s) encontrado(s)')).toBeVisible();
  });
});

test.describe('Cadastros › Fornecedores', () => {
  test('lista abre sem erro de JS', async ({ page }) => {
    const erros = coletarErros(page);
    await preparar(page, { clientes: [], leads: [], chamadas: [] });
    await page.goto('/cadastros/cadastro-fornecedores');
    await expect(page.getByText('Nenhum fornecedor encontrado.')).toBeVisible();
    expect(erros).toEqual([]);
  });
});
