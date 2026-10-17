'use strict';
/* Etiquetas (Logística Interna) — teste de ponta a ponta com um "Zebra Browser Print" de mentira.
   O agente simulado responde como o programa real (GET /available -> {printer:[...]}, POST /write {device,data}) na porta 9100;
   o teste confere que a tela reconhece a impressora, escolhe o perfil da ZD220 e manda o ZPL certo (QR END:R2A4, cópias).
   Supabase é simulado (e2e/helpers.js): leitura vazia, escrita 403 — por isso a lista de endereços vem das regras e o histórico
   não grava (a tela avisa, e a impressão já saiu). Não toca em impressora nem em banco de verdade. */
const http = require('http');
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

function agenteSimulado() {
  const escritas = [];
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.url === '/available') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ printer: [{ name: 'ZDesigner ZD220-203dpi ZPL', uid: 'USB001', connection: 'usb', deviceType: 'printer', manufacturer: 'Zebra Technologies', version: 3 }] }));
      return;
    }
    if (req.url === '/write' && req.method === 'POST') {
      let corpo = '';
      req.on('data', (c) => { corpo += c; });
      req.on('end', () => { try { escritas.push(JSON.parse(corpo)); } catch (e) { escritas.push({ erro: corpo }); } res.writeHead(200); res.end(''); });
      return;
    }
    res.writeHead(404); res.end();
  });
  return new Promise((ok, no) => { server.once('error', no); server.listen(9100, () => ok({ server, escritas })); });
}

// Dá a alçada de imprimir sem depender do banco: troca temCapacidade assim que o store é definido.
const COM_ALCADA = () => {
  let valor;
  Object.defineProperty(window, 'EtiquetasStore', {
    configurable: true,
    get() { return valor; },
    set(v) { v.temCapacidade = async () => true; valor = v; },
  });
};

// O contexto do navegador é reaproveitado entre os testes (e2e/fixtures.js): começa cada um sem escolha de impressora guardada.
const LIMPA_ESCOLHA = () => { try { localStorage.removeItem('vp_etiquetas_impressora'); localStorage.removeItem('vp_etiquetas_dv'); } catch (e) { /* ok */ } };

test.describe('Etiquetas', () => {
  // O agente simulado usa a porta fixa 9100 (a mesma que a tela procura): os testes daqui rodam em sequência, num worker só.
  test.describe.configure({ mode: 'serial' });

  test('sem alçada: a tela avisa e não oferece impressão', async ({ page }) => {
    const erros = coletarErros(page);
    await page.goto('/logistica/etiquetas');
    await expect(page.getByText('Você não tem acesso a esta tela')).toBeVisible({ timeout: 60_000 });
    expect(erros, erros.join('\n')).toEqual([]);
  });

  test('reconhece a ZD220, mostra a prévia e imprime ZPL pelo agente local', async ({ page }) => {
    const { server, escritas } = await agenteSimulado();
    try {
      const erros = coletarErros(page);
      await page.addInitScript(LIMPA_ESCOLHA);
      await page.addInitScript(COM_ALCADA);
      await page.goto('/logistica/etiquetas');
      await expect(page.getByRole('heading', { name: 'Etiquetas' })).toBeVisible({ timeout: 60_000 });

      // reconheceu a impressora e casou o perfil de fábrica da ZD220, sem o usuário escolher nada
      const impressora = page.getByLabel('Impressora', { exact: true });
      await expect(impressora.locator('option', { hasText: 'ZD220' })).toHaveCount(1, { timeout: 20_000 });
      await expect(page.getByLabel('Perfil da impressora')).toHaveValue('zebra-zd220');
      await expect(page.getByLabel('Rolo carregado', { exact: true })).toHaveValue('100x50');
      await expect(page.getByText('Imprime direto na impressora')).toBeVisible();

      // lista de endereços (236 + EXP, das regras) e prévia com o código de barras desenhado
      await page.getByLabel('Rua', { exact: true }).selectOption('2');
      await expect(page.getByText('80 posição(ões) na lista')).toBeVisible();
      await page.getByRole('row', { name: /R2A4/ }).getByRole('checkbox').check();
      await expect(page.locator('svg[viewBox="0 0 100 50"]').first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('svg[viewBox="0 0 100 50"] text', { hasText: 'R2A4' })).toBeVisible();

      // 2 cópias da etiqueta R2A4 -> um bloco ZPL com QR END:R2A4 e ^PQ2, em 800 x 400 pontos
      await page.getByLabel('Cópias de cada').fill('2');
      await page.getByRole('button', { name: /Imprimir 2 etiquetas/ }).click();
      await expect.poll(() => escritas.length, { timeout: 20_000 }).toBe(1);
      const zpl = escritas[0].data;
      expect(escritas[0].device.uid).toBe('USB001');
      expect(zpl).toContain('^PW800');
      expect(zpl).toContain('^LL400');
      expect(zpl).toContain('^FDMA,END:R2A4^FS');
      expect(zpl).toMatch(/\^FD R2A4\^FS|\^FDR2A4\^FS/);
      expect(zpl).toContain('^PQ2');
      expect(zpl).not.toContain('DV ');          // DV nasce desligado

      // o dígito verificador só entra quando ligado, e nunca dentro do QR
      await page.getByLabel(/Imprimir o dígito verificador/).check();
      await page.getByRole('button', { name: /Imprimir 2 etiquetas/ }).click();
      await expect.poll(() => escritas.length, { timeout: 20_000 }).toBe(2);
      expect(escritas[1].data).toContain('^FDDV 9^FS');
      expect(escritas[1].data).toContain('^FDMA,END:R2A4^FS');

      // rolo diferente do modelo: não imprime
      await page.getByLabel('Rolo carregado', { exact: true }).selectOption('100x100');
      await expect(page.getByText(/não confere com o modelo/).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Imprimir 2 etiquetas/ })).toBeDisabled();

      // teste de bancada
      await page.getByLabel('Rolo carregado', { exact: true }).selectOption('100x50');
      await page.getByRole('button', { name: 'Etiqueta de teste' }).click();
      await expect.poll(() => escritas.length, { timeout: 20_000 }).toBe(3);
      expect(escritas[2].data).toContain('^FDMA,END:R2A4^FS');
      expect(escritas[2].data).toContain('_C3_A7');      // "ç" enviado como UTF-8 em hexadecimal

      expect(erros, erros.join('\n')).toEqual([]);
    } finally {
      await new Promise((ok) => server.close(ok));
    }
  });

  test('escolha automática do navegador (feita antes de a impressora aparecer) passa para a Zebra quando ela é detectada', async ({ page }) => {
    const { server } = await agenteSimulado();
    try {
      await page.addInitScript(() => {
        try { localStorage.setItem('vp_etiquetas_impressora', JSON.stringify({ adaptador: 'navegador', id: 'navegador', nome: 'Diálogo de impressão do navegador', bruto: null, perfilId: 'generica', utf8: true, rolo: '100x100', auto: true })); } catch (e) { /* ok */ }
      });
      await page.addInitScript(COM_ALCADA);
      await page.goto('/logistica/etiquetas');
      await expect(page.getByLabel('Perfil da impressora')).toHaveValue('zebra-zd220', { timeout: 60_000 });
      await expect(page.getByLabel('Rolo carregado', { exact: true })).toHaveValue('100x100');   // o que a pessoa já tinha informado não se perde
    } finally {
      await new Promise((ok) => server.close(ok));
    }
  });

  test('escolha feita pela pessoa nunca é trocada sozinha', async ({ page }) => {
    const { server } = await agenteSimulado();
    try {
      await page.addInitScript(() => {
        try { localStorage.setItem('vp_etiquetas_impressora', JSON.stringify({ adaptador: 'navegador', id: 'navegador', nome: 'Diálogo de impressão do navegador', bruto: null, perfilId: 'generica', utf8: true, rolo: '100x50', auto: false })); } catch (e) { /* ok */ }
      });
      await page.addInitScript(COM_ALCADA);
      await page.goto('/logistica/etiquetas');
      await expect(page.getByLabel('Impressora', { exact: true }).locator('option', { hasText: 'ZD220' })).toHaveCount(1, { timeout: 60_000 });
      await expect(page.getByLabel('Perfil da impressora')).toHaveValue('generica');
    } finally {
      await new Promise((ok) => server.close(ok));
    }
  });

  test('aba Modelos mostra os 3 modelos padrão com prévia', async ({ page }) => {
    await page.addInitScript(COM_ALCADA);
    await page.goto('/logistica/etiquetas/modelos');
    await expect(page.getByText('Endereço — viga horizontal', { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Item — código e descrição', { exact: true })).toBeVisible();
    await expect(page.getByText('Teste de bancada', { exact: true })).toBeVisible();
    await expect(page.locator('svg[viewBox="0 0 100 50"]')).toHaveCount(3, { timeout: 20_000 });
  });
});
