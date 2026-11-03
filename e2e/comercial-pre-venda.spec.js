'use strict';
/* Comercial | Pré-venda (módulo 4): Formulários, Controle de Cotações, Cotação a Fornecedor, Quadro de Comando, Propostas.
   Supabase simulado COM dados; o banco real nunca é tocado. */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const ANO = new Date().getFullYear();

async function preparar(page, st) {
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Gelson Simoes', email: 'gelson.simoes@verticalparts.com.br', iniciais: 'GS', id: 't' }));
  });
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request(); const url = new URL(req.url());
    const tabela = url.pathname.replace('/rest/v1/', ''); const m = req.method();
    const quer = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (s, b) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    st.chamadas.push({ m, tabela, url: req.url(), body: req.postData() });
    const linhas = st.tabelas[tabela];
    if (linhas && m === 'GET') {
      if (quer) return linhas.length ? json(200, linhas[0]) : json(406, { code: 'PGRST116', message: 'sem linha' });
      return json(200, linhas);
    }
    if (st.escrita && st.escrita[tabela] && (m === 'PATCH' || m === 'POST')) {
      const corpo = req.postData() ? JSON.parse(req.postData()) : null;
      (st.gravacoes[tabela] = st.gravacoes[tabela] || []).push({ m, url: req.url(), corpo });
      const base = Array.isArray(corpo) ? corpo[0] : corpo;
      const ret = { ...(st.escrita[tabela]), ...(base || {}) };
      return quer ? json(m === 'POST' ? 201 : 200, ret) : json(m === 'POST' ? 201 : 200, [ret]);
    }
    return route.fallback();
  });
}
const novoEstado = (extra) => ({ tabelas: {}, escrita: {}, gravacoes: {}, chamadas: [], ...extra });

/* No CI a 1ª tela de cada worker compila os .jsx (até ~45 s): espera a aplicação carregar com folga. */
async function abrir(page, url, espera) {
  await page.goto(url);
  await (espera ? page.locator(espera).first().waitFor({ timeout: 90_000 }) : page.waitForFunction(() => !!window.PropostaStore && !!window.PropostaOpcoes, null, { timeout: 90_000 }));
}

test.describe('Comercial | Pré-venda — telas abrem e mostram dados', () => {
  test('Formulários (hub), Formulário de Equipamento e Contratos Social abrem sem erro de JS', async ({ page }) => {
    const erros = coletarErros(page);
    await preparar(page, novoEstado());
    await abrir(page, '/comercial/formularios', 'h1');
    await expect(page.locator('h1').first()).toContainText(/Formul/i);
    await abrir(page, '/comercial/formulario-elevador', 'text=Formulário — Equipamento');
    await abrir(page, '/comercial/contratos-sociais', 'h1');
    expect(erros).toEqual([]);
  });

  test('as 3 URLs do Formulário abrem o mesmo componente e a de escada nasce com o tipo Escada', async ({ page }) => {
    const erros = coletarErros(page);
    await preparar(page, novoEstado());
    await abrir(page, '/comercial/formulario-escada', 'text=Formulário — Equipamento');
    await expect(page).toHaveURL(/\/comercial\/formulario-escada/);
    const tipo = await page.locator('select').evaluateAll((els) => els.map((e) => e.value));
    expect(tipo).toContain('escada');
    await abrir(page, '/comercial/formulario-esteira', 'text=Formulário — Equipamento');
    await expect(page).toHaveURL(/\/comercial\/formulario-esteira/);
    expect(erros).toEqual([]);
  });

  test('Controle de Cotações: junta planilha + formulários, filtra pela busca e avisa quando não há fornecedor', async ({ page }) => {
    const erros = coletarErros(page);
    const st = novoEstado({ tabelas: {
      cotacoes_elevador_historico: [
        { id: 'h1', numero_cotacao: 500, data: '2026-03-02', vendedor: 'GG', nome_cliente: 'Cliente da Planilha', cnpj_comprador: '11222333000181', estado_instalacao: 'SP', status: 'Conquistado', formulario_id: null },
      ],
      formularios_elevador: [
        { id: 'FE-1', numero_cotacao: 990, created_at: '2026-10-20T10:00:00Z', created_by: 'gelson.simoes@verticalparts.com.br', vendedor: 'GS', origem_venda: 'Site', status: 'enviado', local_obra_cidade: 'Santos', local_obra_estado: 'SP', clientes: { razao_social: 'Cliente do Formulário', cnpj: '99888777000166' } },
      ],
      cotacoes_elevador_fornecedor: [],
      perfis: [{ id: 'p1', nivel: 'Administrador', nome: 'Gelson', email: 'gelson.simoes@verticalparts.com.br' }], // Administrador vê a planilha e os formulários de todos
    } });
    await preparar(page, st);
    await abrir(page, '/comercial/controle-cotacoes', 'text=Cliente do Formulário');
    await expect(page.getByText('Cliente da Planilha')).toBeVisible();
    await expect(page.getByText('2 cotação(ões)')).toBeVisible();
    await page.getByPlaceholder(/Buscar por cliente/).fill('planilha');
    await expect(page.getByText('1 cotação(ões)')).toBeVisible();
    await page.getByPlaceholder(/Buscar por cliente/).fill('');
    await page.getByRole('button', { name: 'Tratativas' }).click();
    await expect(page.getByText(/ainda não foi enviada a nenhum fornecedor/)).toBeVisible();
    expect(erros).toEqual([]);
  });

  test('Quadro de Comando público abre e mostra o passo inicial', async ({ page }) => {
    const erros = coletarErros(page);
    await preparar(page, novoEstado());
    await page.goto('/formulario-quadro-comando-publico.html');
    await expect(page.locator('body')).toContainText(/Quadro de Comando/i, { timeout: 90_000 });
    expect(erros).toEqual([]);
  });
});

test.describe('Proposta — números e dados importados', () => {
  test('proposta NOVA com o número padrão VP-<ano>-001 não sobrescreve a proposta existente (de outro vendedor, mesmo enviada)', async ({ page }) => {
    const st = novoEstado({
      tabelas: { propostas: [{ id: 'P-EXISTENTE', status: 'enviada', vendedor_id: 'OUTRO', destravada_em: null, numero_cotacao: null, revisao_indice: 0 }], perfis: [{ id: 'EU', nivel: 'Vendedor' }] },
      escrita: { propostas: { id: 'P-EXISTENTE', token: 'tok' } },
    });
    await preparar(page, st);
    await abrir(page, '/comercial/proposta-editor');
    await expect(page.getByText(`VP-${ANO}-001`).first()).toBeVisible();
    const r = await page.evaluate(async (ano) => window.PropostaStore.salvar({
      data: { numero: `VP-${ano}-001`, cliente: { nome: 'Cliente NOVO' }, numeroCotacao: '' }, eq: 'elevador', editId: null, valorTotal: 1,
    }), ANO);
    expect(r.erro).toMatch(/Já existe a proposta/);
    expect(st.gravacoes.propostas || []).toEqual([]);
  });
});

test.describe('Proposta e Quadro de Comando — telas com dados', () => {
  test('Proposta já enviada abre travada: Salvar, Publicar e Enviar ficam desabilitados', async ({ page }) => {
    const erros = coletarErros(page);
    const st = novoEstado({ tabelas: {
      propostas: [], perfis: [{ id: 'p1', nivel: 'Vendedor', nome: 'Vend', email: 'gelson.simoes@verticalparts.com.br' }],
    } });
    await preparar(page, st);
    await abrir(page, '/comercial/proposta-editor');
    // o autosave grava o rascunho padrão (proposta nova) no localStorage em ~400 ms
    await page.waitForFunction(() => !!localStorage.getItem('vpprd.proposta-draft'));
    const padrao = await page.evaluate(() => JSON.parse(localStorage.getItem('vpprd.proposta-draft')));
    st.tabelas.propostas = [{ id: 'P-1', proposal_type: 'elevador', status: 'enviada', numero_documento: 'VPPR-0955', titulo: 'Cliente X · Obra', data_json: { ...padrao, cliente: { ...padrao.cliente, nome: 'Cliente X' } }, valor_total: 1000, token: 'tok', version: 1, publicado_em: '2026-10-20T10:00:00Z', destravada_em: null }];
    await page.goto('/comercial/proposta-editor/P-1');
    await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled({ timeout: 90_000 });
    await expect(page.getByRole('button', { name: /Enviar p\/ Cliente/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Republicar/ })).toBeDisabled();
    expect(erros).toEqual([]);
  });

  test('proposta com data_json vazio ({}) — as 125 importadas de 06/04/2026 — abre o editor (travada) em vez de derrubar a tela', async ({ page }) => {
    const erros = coletarErros(page);
    const st = novoEstado({ tabelas: {
      propostas: [{ id: 'P-VAZIA', proposal_type: null, status: 'enviada', numero_documento: 'VP-IMPORTADA', titulo: 'Cliente Importado', data_json: {}, valor_total: 5000, token: 'tok', version: 1 }],
      perfis: [],
    } });
    await preparar(page, st);
    await page.goto('/comercial/proposta-editor/P-VAZIA');
    await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled({ timeout: 90_000 });
    await expect(page.getByText('Erro ao carregar o VP Gestão')).toHaveCount(0);
    await expect(page.getByText('VP-IMPORTADA').first()).toBeVisible();
    expect(erros).toEqual([]);
  });

  test('Quadro de Comando: lista de pedidos e uma aba do detalhe abrem sem erro de JS', async ({ page }) => {
    const erros = coletarErros(page);
    const q = { id: 'QC-1', numero_pedido: 1090, numero_cotacao: null, status: 'rascunho', tipo_aplicacao: 'MRL', escopo_fornecimento: {}, configuracao: {}, excluido_em: null, created_at: '2026-10-20T10:00:00Z' };
    await preparar(page, novoEstado({ tabelas: { quadros_comando: [q] } }));
    await abrir(page, '/comercial/formulario-quadro-comando', 'h1');
    await page.goto('/comercial/formulario-quadro-comando/QC-1/geometria');
    await expect(page.locator('body')).toContainText(/Geometria|Última altura|Quadro/i, { timeout: 90_000 });
    expect(erros).toEqual([]);
  });
});
