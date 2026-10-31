'use strict';
/* CRM (Leads, Kanban, Detalhe, Canais, Conversão, Automação, Análise).

   Diferente da fumaça, aqui o Supabase é simulado COM dados: a tabela `leads`
   devolve uma lista montada pelo teste (paginada por Range/offset), e PATCH,
   dossier_obra e vp_logs respondem como o teste mandar. O banco de produção
   nunca é tocado. Cada teste instala seu próprio `state` com page.route
   (sobrepõe o isolamento padrão do contexto; o que não é do CRM cai nele
   por route.fallback()). */
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const STATUS = ['Em qualificação', 'Aguardando cotação', 'Proposta enviada', 'Negociação', 'Sem retorno'];

function montarLeads(n) {
  const l = [];
  for (let i = 1; i <= n; i++) {
    l.push({
      id: 'LD-T' + String(i).padStart(5, '0'), building: 'Prédio Teste ' + i, contact: 'Contato ' + i,
      role: 'Síndico', phone: '11 9' + String(10000000 + i), email: 'c' + i + '@exemplo.com',
      origin: i % 2 ? 'Site' : 'Indicação', status: STATUS[i % STATUS.length],
      owner: i % 3 ? 'Vagner' : 'Regiane', value: 1000 * i, priority: 'alta',
      date: '2026-10-' + String((i % 28) + 1).padStart(2, '0'),
      cliente_id: null, excluido_em: null, next_action: 'Ligar',
    });
  }
  return l;
}

function novoEstado(n = 40) {
  return {
    leads: montarLeads(n), leadsErro: false, patch: 'ok', dossies: [], dossieErro: false,
    logs: [], chamadas: [], paginasLidas: [],
  };
}

/* Instala login de Administrador e o Supabase simulado só para esta aba. */
async function preparar(page, state) {
  await page.addInitScript(() => {
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({
      nome: 'Gelson Simoes', email: 'gelson.simoes@verticalparts.com.br', iniciais: 'GS', id: 't',
    }));
  });
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const tabela = url.pathname.replace('/rest/v1/', '');
    const m = req.method();
    const json = (status, body, headers) => route.fulfill({
      status, contentType: 'application/json', headers: headers || {}, body: JSON.stringify(body),
    });
    state.chamadas.push(m + ' ' + tabela);

    if (tabela === 'leads') {
      if (m === 'GET') {
        if (state.leadsErro) return json(500, { message: 'falha simulada do banco' });
        let off = Number(url.searchParams.get('offset') || 0);
        let lim = url.searchParams.get('limit');
        const rg = req.headers()['range'];
        if (rg && /^\d+-\d+$/.test(rg)) { const [a, b] = rg.split('-').map(Number); off = a; lim = b - a + 1; }
        const idq = url.searchParams.get('id') || '';
        const base = idq.startsWith('eq.') ? state.leads.filter((x) => x.id === idq.slice(3)) : state.leads;
        const fatia = base.slice(off, lim != null ? off + Number(lim) : undefined);
        state.paginasLidas.push([off, fatia.length]);
        return json(200, fatia, { 'content-range': '*/' + state.leads.length });
      }
      if (m === 'PATCH') {
        if (state.patch === 'erro') return json(500, { message: 'falha simulada no update' });
        if (state.patch === 'zero') return json(200, []);
        const body = JSON.parse(req.postData() || '{}');
        const id = (url.searchParams.get('id') || '').replace('eq.', '');
        const l = state.leads.find((x) => x.id === id);
        if (l) Object.assign(l, body);
        return json(200, l ? [l] : []);
      }
    }
    if (tabela === 'dossier_obra' && m === 'GET') {
      if (state.dossieErro) return json(500, { message: 'falha simulada dossie' });
      return json(200, state.dossies);
    }
    if (tabela === 'vp_logs') {
      if (m === 'POST') { state.logs.push(JSON.parse(req.postData() || '{}')); return json(201, []); }
      if (m === 'GET') return json(200, state.logs.map((x, i) => ({ ...x, id: i + 1, criado_em: new Date().toISOString() })));
    }
    return route.fallback();
  });
}

/* wa.me é bloqueado na rede do teste: intercepta window.open e lê a URL. */
async function capturarOpen(page) {
  await page.evaluate(() => { window.__abertos = []; window.open = (u) => { window.__abertos.push(String(u)); return null; }; });
}
const urlAberta = (page) => page.evaluate(() => (window.__abertos || [])[0] || '');

test.describe('CRM', () => {
  test('Leads: KPI só de leads em aberto; filtro e busca voltam à página 1', async ({ page }) => {
    const erros = coletarErros(page);
    const st = novoEstado();
    st.leads[0].status = 'Convertido';
    st.leads[1].status = 'Convertido';
    await preparar(page, st);
    await page.goto('/crm/leads');
    await page.waitForSelector('text=Pipeline de Leads', { timeout: 60_000 });
    await page.waitForSelector('table.t tbody tr');

    const kpi = await page.locator('.kpi, [class*="kpi"]').filter({ hasText: 'Leads ativos' }).first().innerText();
    expect(kpi).toMatch(/38/);
    await expect(page.locator('.page-head__sub').first()).toContainText('38 leads em aberto');

    await page.locator('.row.sb button').last().click();
    await expect(page.locator('text=/Pág\\. 2 \\//')).toBeVisible();
    await page.locator('.seg button', { hasText: 'Negociação' }).click();
    await expect(page.locator('text=/Pág\\. 1 \\//')).toHaveCount(1);

    await page.locator('.seg button', { hasText: 'Em aberto' }).click();
    await page.locator('.row.sb button').last().click();
    await expect(page.locator('text=/Pág\\. 2 \\//')).toBeVisible();
    await page.fill('.search input', 'Prédio Teste');
    await expect(page.locator('text=/Pág\\. 1 \\//')).toHaveCount(1);
    expect(erros, erros.join('\n')).toEqual([]);
  });

  test('Kanban: falha de gravação reverte o card; sucesso muda de coluna e loga', async ({ page }) => {
    const erros = coletarErros(page);
    const st = novoEstado(6);
    st.leads.forEach((l) => { l.status = 'Em qualificação'; });
    await preparar(page, st);
    await page.goto('/crm/leads');
    await page.waitForSelector('text=Pipeline de Leads', { timeout: 60_000 });
    await page.waitForSelector('table.t tbody tr');
    await page.locator('.seg[aria-label="Modo de visualização"] button').nth(1).click();
    await page.waitForSelector('text=Arraste para cá');

    const coluna = (i) => page.locator('div[style*="flex: 0 0 260px"]').nth(i);
    const cards = (i) => coluna(i).locator('div[draggable="true"]');
    const arrastar = async () => {
      await page.locator('div[draggable="true"]').first().dragTo(coluna(3));
      await page.waitForTimeout(800);
    };

    st.patch = 'zero';
    await arrastar();
    await expect(page.locator('text=/Erro ao mover lead/').first()).toBeVisible();
    await expect(cards(0)).toHaveCount(6);

    st.patch = 'erro';
    await arrastar();
    await expect(cards(0)).toHaveCount(6);

    st.patch = 'ok';
    await arrastar();
    await expect(cards(0)).toHaveCount(5);
    await expect(cards(3)).toHaveCount(1);
    expect(st.logs.some((x) => /Lead movido/.test(x.acao || ''))).toBe(true);
    expect(erros, erros.join('\n')).toEqual([]);
  });

  test('Detalhe: URL direta, WhatsApp (55 só no BR) e dossiê sem duplicar', async ({ page }) => {
    const erros = coletarErros(page);
    const st = novoEstado();
    st.leads[0].phone = '+44 7911 123456'; // 12 dígitos, estrangeiro: sem 55
    st.dossies = [{ id: 'DOS-A' }, { id: 'DOS-B' }];
    await preparar(page, st);
    await page.goto('/crm/lead-detail/' + st.leads[0].id);
    await page.waitForSelector('text=' + st.leads[0].building, { timeout: 60_000 });
    await expect(page.locator('button:has-text("Abrir Dossier")')).toBeVisible({ timeout: 15_000 });
    await capturarOpen(page);
    await page.locator('button:has-text("WhatsApp")').first().click();
    expect(await urlAberta(page)).toMatch(/wa\.me\/447911123456\?text=/);
    expect(erros, erros.join('\n')).toEqual([]);
  });

  test('Detalhe: consulta de dossiê falhou → avisa e não cria; WhatsApp BR ganha 55', async ({ page }) => {
    const st = novoEstado();
    st.dossieErro = true;
    await preparar(page, st);
    await page.goto('/crm/lead-detail/' + st.leads[1].id);
    await page.waitForSelector('text=' + st.leads[1].building, { timeout: 60_000 });
    await page.waitForTimeout(1200);
    await page.locator('button:has-text("Qualificar")').first().click();
    await expect(page.locator('text=/Não foi possível verificar se este lead já tem Dossier/').first()).toBeVisible();
    expect(st.chamadas.some((c) => c === 'POST dossier_obra')).toBe(false);
    await capturarOpen(page);
    await page.locator('button:has-text("WhatsApp")').first().click();
    expect(await urlAberta(page)).toMatch(/wa\.me\/5511910000002\?text=/);
  });

  test('Edição: loga "Lead editado" sem telefone/e-mail e atualiza o histórico', async ({ page }) => {
    const st = novoEstado();
    await preparar(page, st);
    await page.goto('/crm/lead-detail/' + st.leads[2].id);
    await page.waitForSelector('text=' + st.leads[2].building, { timeout: 60_000 });
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("Editar Lead")').first().click();
    await page.waitForSelector('text=/Editar Lead|Salvar/i');
    // Contribuinte de ICMS é obrigatório: escolhe "Sim" no select que tem Sim/Não.
    const selects = page.locator('select.input');
    for (let i = 0; i < await selects.count(); i++) {
      const opts = await selects.nth(i).locator('option').allInnerTexts();
      if (opts.some((o) => /^Sim/.test(o)) && opts.some((o) => /^N[ãa]o/.test(o))) {
        await selects.nth(i).selectOption({ index: opts.findIndex((o) => /^Sim/.test(o)) });
        break;
      }
    }
    await page.locator('button:has-text("Salvar")').first().click();
    await expect.poll(() => st.logs.some((x) => x.acao === 'Lead editado'), { timeout: 8000 }).toBe(true);
    const log = st.logs.find((x) => x.acao === 'Lead editado');
    const txt = JSON.stringify(log.detalhe).replace(/"email":"[^"]*verticalparts[^"]*"/, '');
    expect(txt).not.toMatch(/9\d{7}|@exemplo/);
    await expect(page.locator('text=/Lead editado/').first()).toBeVisible();
  });

  test('Análise e Automação: leitura paginada, "Outros" no funil, vincular sem recarregar', async ({ page }) => {
    const erros = coletarErros(page);
    const st = novoEstado(1005);
    st.leads[0].status = 'Qualificado (antigo)';
    st.leads[1].status = 'Convertido';
    await preparar(page, st);
    await page.goto('/crm/crm-analise');
    await page.waitForSelector('text=Funil por status', { timeout: 60_000 });
    await expect(page.locator('text=Outros (status antigo)')).toHaveCount(1);
    expect(st.paginasLidas.length).toBeGreaterThanOrEqual(2);
    await expect(page.locator('body')).toContainText('1005');

    await page.goto('/crm/crm-automacao');
    await page.waitForSelector('text=Regra ativa', { timeout: 60_000 });
    await expect(page.locator('text=Sem vínculo')).toHaveCount(1);
    await page.evaluate(() => {
      window.__marca = 'mesma-pagina';
      window.CadastrosClientesStore = { criarOuVincularDeLead: async () => 'CLI-1' };
    });
    await page.locator('button:has-text("Vincular agora")').click();
    await expect(page.locator('text=Sem vínculo')).toHaveCount(0);
    await expect(page.locator('text=Vinculado').first()).toBeVisible();
    expect(await page.evaluate(() => window.__marca)).toBe('mesma-pagina');
    expect(erros, erros.join('\n')).toEqual([]);
  });

  test('Canais: WhatsApp usa o helper único', async ({ page }) => {
    const st = novoEstado();
    await preparar(page, st);
    await page.goto('/crm/crm-canais');
    await page.waitForSelector('text=Como funciona', { timeout: 60_000 });
    await page.waitForSelector('button:has-text("WhatsApp")');
    await capturarOpen(page);
    await page.locator('button:has-text("WhatsApp")').first().click();
    expect(await urlAberta(page)).toMatch(/wa\.me\/55\d{10,11}\?text=/);
  });

  for (const [rota, nome] of [['crm-canais', 'Canais'], ['crm-conversao', 'Conversão'], ['crm-automacao', 'Automação'], ['crm-analise', 'Análise']]) {
    test(`${nome}: falha de leitura mostra cartão de erro e "Tentar de novo" recupera`, async ({ page }) => {
      const erros = coletarErros(page);
      const st = novoEstado();
      st.leadsErro = true;
      await preparar(page, st);
      await page.goto('/crm/' + rota);
      await page.waitForSelector('text=Não foi possível carregar os leads', { timeout: 60_000 });
      await expect(page.locator('text=/Nenhum lead/')).toHaveCount(0);
      st.leadsErro = false;
      await page.locator('button:has-text("Tentar de novo")').click();
      await expect(page.locator('text=Não foi possível carregar os leads')).toHaveCount(0);
      expect(erros, erros.join('\n')).toEqual([]);
    });
  }
});
