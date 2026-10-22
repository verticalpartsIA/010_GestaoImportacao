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
      await expect(page.getByLabel('Largura da etiqueta (mm)', { exact: true })).toHaveValue('100');
      await expect(page.getByLabel('Comprimento da etiqueta (mm)', { exact: true })).toHaveValue('50');
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

      // rolo mais largo do que a impressora aceita (ZD220 = 104 mm): não imprime
      await page.getByLabel('Largura da etiqueta (mm)', { exact: true }).fill('120');
      await expect(page.getByText(/a impressora aceita até 104 mm/).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Imprimir 2 etiquetas/ })).toBeDisabled();

      // etiqueta de outro tamanho: o modelo se ajusta (prévia e ZPL no tamanho novo) e imprime
      await page.getByLabel('Largura da etiqueta (mm)', { exact: true }).fill('100');
      await page.getByLabel('Comprimento da etiqueta (mm)', { exact: true }).fill('150');
      await expect(page.locator('svg[viewBox="0 0 100 150"]').first()).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: /Imprimir 2 etiquetas/ }).click();
      await expect.poll(() => escritas.length, { timeout: 20_000 }).toBe(3);
      expect(escritas[2].data).toContain('^LL1200');      // 150 mm a 203 dpi

      // teste de bancada
      await page.getByLabel('Comprimento da etiqueta (mm)', { exact: true }).fill('50');
      await page.getByRole('button', { name: 'Etiqueta de teste' }).click();
      await expect.poll(() => escritas.length, { timeout: 20_000 }).toBe(4);
      expect(escritas[3].data).toContain('^FDMA,END:R2A4^FS');
      expect(escritas[3].data).toContain('_C3_A7');      // "ç" enviado como UTF-8 em hexadecimal

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
      await expect(page.getByLabel('Comprimento da etiqueta (mm)', { exact: true })).toHaveValue('100');   // o que a pessoa já tinha informado (formato antigo 100x100) não se perde
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

  test('aba Modelos mostra os 14 modelos padrão com prévia', async ({ page }) => {
    await page.addInitScript(COM_ALCADA);
    await page.goto('/logistica/etiquetas/modelos');
    await expect(page.getByText('Endereço — viga horizontal', { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Item — código e descrição', { exact: true })).toBeVisible();
    await expect(page.getByText('Teste de bancada', { exact: true })).toBeVisible();
    await expect(page.getByText('Recebimento — carga que chegou', { exact: true })).toBeVisible();
    await expect(page.getByText('Separação — volume do pedido', { exact: true })).toBeVisible();
    for (const n of ['Palete — conteúdo e origem', 'ID-TAG do equipamento', 'OP do quadro — número de série', 'Avaria — material retido', 'Chicote do quadro (50 × 30, 2 colunas)', 'Fabricação da OP (50 × 30, 2 colunas)']) await expect(page.getByText(n, { exact: true })).toBeVisible();
    // só o SVG de cada prévia (div > svg); o SVG aninhado da etiqueta dentro dele não conta
    await expect(page.locator('div > svg[viewBox="0 0 100 50"]')).toHaveCount(9, { timeout: 20_000 });   // 8 padrão + Separação deitada
    await expect(page.locator('div > svg[viewBox="0 0 100 100"]')).toHaveCount(1);
    await expect(page.locator('div > svg[viewBox="0 0 100 150"]')).toHaveCount(2);   // Separação 100 × 150 + Expedição (girada)
    await expect(page.getByText('Expedição — volume da NF (100 × 150)', { exact: true })).toBeVisible();
  });

  test('Expedição: escolhe a NF, pega os volumes dela e mostra a etiqueta girada no rolo 100 × 150', async ({ page }) => {
    await page.addInitScript(() => {
      let valor;
      Object.defineProperty(window, 'EtiquetasStore', {
        configurable: true,
        get() { return valor; },
        set(v) {
          v.temCapacidade = async () => true;
          v.listarNotasFaturadas = async () => ({ erro: null, notas: [{ codigo_pedido: 1, numero_pedido: '28988', numero_nf: '22019', cliente_nome: 'BAR DO CUSCUZ E RESTAURANTE LTDA',
            cliente_endereco: 'RUA DOUTOR SEVERINO RIBEIRO CRUZ, 771, CENTRO, CAMPINA GRANDE (PB)/PB, 58400258', transportadora_nome: 'CLIENTE RETIRA', volumes: 19, data_faturamento: '2026-10-20' }] });
          valor = v;
        },
      });
    });
    await page.goto('/logistica/etiquetas/gerar');
    await page.getByRole('button', { name: 'Expedição (NF)', exact: true }).click({ timeout: 60_000 });
    await page.getByLabel('Largura da etiqueta (mm)', { exact: true }).fill('100');
    await page.getByLabel('Comprimento da etiqueta (mm)', { exact: true }).fill('150');
    await page.locator('tr', { hasText: '22019' }).click();
    await expect(page.getByLabel('Total de volumes da NF')).toHaveValue('19');
    await expect(page.getByRole('button', { name: /Imprimir 19 etiquetas/ })).toBeEnabled();
    const previa = page.locator('div > svg[viewBox="0 0 100 150"]').first();
    await expect(previa).toContainText('22019');
    await expect(previa).toContainText('VOLUME 1 / 19');
    await expect(previa).toContainText('28988');
    await expect(page.getByLabel('Sentido da impressão')).toBeVisible();
  });

  test('Chicote do quadro: escolhe o pedido que existe, uma etiqueta por chicote, POW1 só com casa de máquinas', async ({ page }) => {
    await page.addInitScript(() => {
      let valor;
      Object.defineProperty(window, 'EtiquetasStore', {
        configurable: true,
        get() { return valor; },
        set(v) {
          v.temCapacidade = async () => true;
          v.listarPedidosQuadro = async () => ({ erro: null, pedidos: [
            { id: 'q1', numero_pedido: 1212, tipo_aplicacao: 'MR', novo_ou_modernizacao: 'modernizacao', cliente: 'CLIENTE A' },
            { id: 'q2', numero_pedido: 1070, tipo_aplicacao: 'MRL', novo_ou_modernizacao: 'novo', cliente: 'CLIENTE B' },
            { id: 'op:1500|modernizacao', numero_pedido: '1500', tipo_aplicacao: null, novo_ou_modernizacao: 'modernizacao', cliente: 'CLIENTE C', origem: 'op', ops: ['OP-0003-Q1', 'OP-0003-Q2'] },
          ] });
          valor = v;
        },
      });
    });
    await page.goto('/logistica/etiquetas/gerar');
    await page.getByRole('button', { name: 'Chicote do quadro', exact: true }).click({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: /Imprimir/ })).toBeDisabled();   // sem pedido não há etiqueta
    await page.locator('tr', { hasText: '1212' }).click();
    await expect(page.getByText('POW1', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Imprimir 23 etiquetas/ })).toBeEnabled();
    // prévia com 2 colunas: cada coluna mostra uma etiqueta DIFERENTE (QC e OS), não a mesma repetida
    await page.getByLabel('Largura da etiqueta (mm)', { exact: true }).fill('50');
    await page.getByLabel('Comprimento da etiqueta (mm)', { exact: true }).fill('30');
    await page.getByLabel('Etiquetas por linha', { exact: true }).fill('2');
    const previa2 = page.locator('div > svg[viewBox*="0 0 103"]').first();
    await expect(previa2).toContainText('QC | 1212');
    await expect(previa2).toContainText('OS | 1212');
    await page.locator('tr', { hasText: '1070' }).click();
    await expect(page.getByText('POW1', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Imprimir 22 etiquetas/ })).toBeEnabled();
    // quadro vindo da Evolução da Fabricação (OP sem cadastro de aplicação): POW1 só se marcar casa de máquinas
    await page.locator('tr', { hasText: '1500' }).click();
    await expect(page.getByText('Use Cópias = 2', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: /Imprimir 22 etiquetas/ })).toBeEnabled();
    await page.getByLabel(/tem casa de máquinas/).check();
    await expect(page.getByRole('button', { name: /Imprimir 23 etiquetas/ })).toBeEnabled();
    await page.getByLabel(/tem porta oposta/).check();
    await expect(page.getByRole('button', { name: /Imprimir 27 etiquetas/ })).toBeEnabled();   // + GS2, EDP2, DC2, DEN2
  });

  test('Chicote avulso: pedido e cliente digitados à mão e chicote acrescentado manualmente', async ({ page }) => {
    await page.addInitScript(COM_ALCADA);
    await page.goto('/logistica/etiquetas/gerar/chicote-quadro');
    await page.getByLabel('Etiqueta avulsa', { exact: false }).check({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: /Imprimir/ })).toBeDisabled();   // sem número de pedido não imprime
    await page.getByLabel('Nº do pedido').fill('9999');
    await page.getByLabel('Cliente', { exact: true }).fill('CLIENTE AVULSO');
    await expect(page.getByRole('button', { name: /Imprimir 22 etiquetas/ })).toBeEnabled();
    await page.getByPlaceholder('Código (ex. DZ2)').fill('xy9');
    await page.getByRole('button', { name: 'Acrescentar', exact: true }).click();
    await expect(page.getByRole('button', { name: /Imprimir 23 etiquetas/ })).toBeEnabled();
    await expect(page.getByText('QC | 9999').first()).toBeVisible();
  });

  test('o rolo e o ajuste ficam salvos por tipo de etiqueta e voltam sozinhos ao trocar de tipo', async ({ page }) => {
    await page.addInitScript(COM_ALCADA);
    await page.goto('/logistica/etiquetas/gerar/chicote-quadro');
    const larg = page.getByLabel('Largura da etiqueta (mm)', { exact: true });
    const comp = page.getByLabel('Comprimento da etiqueta (mm)', { exact: true });
    await expect(larg).toBeVisible({ timeout: 60_000 });
    await larg.fill('50'); await comp.fill('30');
    await page.getByLabel('Etiquetas por linha', { exact: true }).fill('2');
    await expect(page.getByText('Rolo e ajuste de posição lembrados', { exact: false })).toBeVisible();
    // outro tipo, outro rolo
    await page.getByRole('button', { name: 'Item', exact: true }).click();
    await larg.fill('100'); await comp.fill('50');
    await page.getByLabel('Etiquetas por linha', { exact: true }).fill('1');
    // volta ao Chicote: o rolo 50 x 30 em 2 colunas volta sozinho
    await page.getByRole('button', { name: 'Chicote do quadro', exact: true }).click();
    await expect(larg).toHaveValue('50');
    await expect(comp).toHaveValue('30');
    await expect(page.getByLabel('Etiquetas por linha', { exact: true })).toHaveValue('2');
    await page.getByRole('button', { name: 'Esquecer' }).click();
    await expect(page.getByText('Ao ajustar o rolo ou a posição', { exact: false })).toBeVisible();
  });

  test('Expedição na Zebra: sai direto como imagem (^GFA) em 800 × 1200 pontos, um formato por volume', async ({ page }) => {
    const { server, escritas } = await agenteSimulado();
    try {
      const erros = coletarErros(page);
      await page.addInitScript(LIMPA_ESCOLHA);
      await page.addInitScript(() => {
        let valor;
        Object.defineProperty(window, 'EtiquetasStore', {
          configurable: true,
          get() { return valor; },
          set(v) {
            v.temCapacidade = async () => true;
            v.listarNotasFaturadas = async () => ({ erro: null, notas: [{ codigo_pedido: 1, numero_pedido: '28988', numero_nf: '22019', cliente_nome: 'BAR DO CUSCUZ E RESTAURANTE LTDA',
              cliente_endereco: 'RUA DOUTOR SEVERINO RIBEIRO CRUZ, 771, CENTRO, CAMPINA GRANDE (PB)/PB, 58400258', transportadora_nome: 'CLIENTE RETIRA', volumes: 3, data_faturamento: '2026-10-20' }] });
            valor = v;
          },
        });
      });
      await page.goto('/logistica/etiquetas/gerar');
      const impressora = page.getByLabel('Impressora', { exact: true });
      await expect(impressora.locator('option', { hasText: 'ZD220' })).toHaveCount(1, { timeout: 60_000 });
      await page.getByRole('button', { name: 'Expedição (NF)', exact: true }).click();
      await page.getByLabel('Largura da etiqueta (mm)', { exact: true }).fill('100');
      await page.getByLabel('Comprimento da etiqueta (mm)', { exact: true }).fill('150');
      await page.locator('tr', { hasText: '22019' }).click();
      await expect(page.getByLabel('Total de volumes da NF')).toHaveValue('3');
      await page.getByRole('button', { name: /Imprimir 3 etiquetas/ }).click();
      await expect.poll(() => escritas.length, { timeout: 30_000 }).toBe(1);
      const zpl = escritas[0].data;
      expect(zpl.match(/\^XA/g).length).toBe(3);                 // um formato por volume (cada um é diferente)
      expect(zpl).toContain('^PW800');
      expect(zpl).toContain('^LL1200');
      expect(zpl).toContain('^GFA,120000,120000,100,');          // 800 × 1200 pontos = 100 bytes por linha × 1200
      expect(zpl.length).toBeLessThan(400_000);                   // compactado: nada perto do limite de 2 MB do Browser Print
      expect(erros, erros.join('\n')).toEqual([]);
    } finally {
      await new Promise((ok) => server.close(ok));
    }
  });

  test('tipos da fase 2 e 4 abrem sem erro na aba Gerar', async ({ page }) => {
    await page.addInitScript(COM_ALCADA);
    await page.goto('/logistica/etiquetas/gerar');
    await expect(page.getByRole('button', { name: 'Palete', exact: true })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Palete', exact: true }).click();
    await expect(page.getByPlaceholder('Buscar P.I. por número ou fornecedor…')).toBeVisible();
    await page.getByRole('button', { name: 'ID-TAG', exact: true }).click();
    await expect(page.getByPlaceholder('Nº da cotação (ex.: 985)')).toBeVisible();
    await page.getByRole('button', { name: 'OP / série do quadro', exact: true }).click();
    await expect(page.getByPlaceholder('Buscar OP por número, produto ou cliente…')).toBeVisible();
    await page.getByRole('button', { name: 'Avaria', exact: true }).click();
    await expect(page.getByText('Escolha o produto, informe a quantidade e o motivo.')).toBeVisible();
    await page.getByRole('button', { name: 'Separação', exact: true }).last().click();
    await expect(page.getByPlaceholder('Buscar pedido por número ou cliente…')).toBeVisible();
  });

  test('editor de modelo da empresa: abre pela URL, protege o QR, valida e salva', async ({ page }) => {
    await page.addInitScript(() => {
      let valor;
      Object.defineProperty(window, 'EtiquetasStore', {
        configurable: true,
        get() { return valor; },
        set(v) {
          v.temCapacidade = async () => true;
          v.listarModelos = async () => {
            const base = window.EtiquetasCalc.modeloPorId('ITEM_100x50');
            return { erro: null, modelos: [{ id: 'u1', tipo: 'ITEM', nome: 'Item da casa', base_id: 'ITEM_100x50', largura_mm: 100, altura_mm: 50, campos: base.campos, elementos: JSON.parse(JSON.stringify(base.elementos)), ativo: true }] };
          };
          window.__salvos = [];
          v.salvarModelo = async (id, patch) => { window.__salvos.push({ id, patch }); return { ok: true }; };
          valor = v;
        },
      });
    });
    await page.goto('/logistica/etiquetas/modelos/u1');
    await expect(page.getByRole('button', { name: '← Modelos' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel('Nome do modelo')).toHaveValue('Item da casa');
    await expect(page.getByText('✓ Modelo válido.')).toBeVisible();
    // o QR é obrigatório: o botão Apagar da linha dele fica desabilitado
    const linhaQr = page.locator('tr', { hasText: '2. QR' });
    await expect(linhaQr.getByRole('button', { name: 'Apagar' })).toBeDisabled();
    // tirar o elemento do papel invalida e bloqueia o salvamento
    await page.locator('tr', { hasText: '3. Texto {codigo}' }).locator('td').first().click();
    await page.locator('label', { hasText: /^x/ }).locator('input').fill('120');
    await expect(page.getByText(/sai da etiqueta/)).toBeVisible();
    await page.getByRole('button', { name: 'Salvar modelo' }).click();
    await expect(page.getByText(/Corrija antes de salvar/)).toBeVisible();
    expect(await page.evaluate(() => window.__salvos.length)).toBe(0);
    // volta para uma posição válida e salva
    await page.locator('label', { hasText: /^x/ }).locator('input').fill('36');
    await expect(page.getByText('✓ Modelo válido.')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar modelo' }).click();
    await expect.poll(() => page.evaluate(() => window.__salvos.length)).toBe(1);
    const salvo = await page.evaluate(() => window.__salvos[0]);
    expect(salvo.id).toBe('u1');
    expect(salvo.patch.elementos.find((e) => e.campo === '{codigo}').x).toBe(36);
  });
});
