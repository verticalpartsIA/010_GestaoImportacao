'use strict';
/* Etapa 1 — fumaça: toda rota do sistema interno e toda página pública
   abre sem erro de JavaScript, sem cair no ErrorBoundary e sem falha de
   compilação de .jsx. Não clica em nada nem grava nada (Supabase simulado,
   ver helpers.js). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

// Lista de rotas = a mesma que o app usa (window.VpRouter.KNOWN_ROUTES).
function rotasConhecidas() {
  const sandbox = { window: { addEventListener() {}, location: { pathname: '/' }, history: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'router.js'), 'utf8'), sandbox);
  return sandbox.window.VpRouter.KNOWN_ROUTES;
}

const ERRO_BOUNDARY = 'Erro ao carregar o VP Gestão';

// Falha com a causa real no relatório (texto do ErrorBoundary + erros de JS),
// em vez de só "elemento não encontrado".
async function falharSeQuebrou(page, boundary, erros) {
  if (await boundary.count()) {
    const tela = (await page.locator('#root').innerText().catch(() => '')).slice(0, 1500);
    throw new Error(`Tela caiu no ErrorBoundary:\n${tela}\n${erros.join('\n')}`);
  }
  expect(erros, erros.join('\n')).toEqual([]);
}

test.describe('Sistema interno — todas as rotas', () => {
  for (const rota of rotasConhecidas()) {
    test(rota, async ({ page }) => {
      const erros = coletarErros(page);
      await page.goto(`/geral/${rota}`);
      const main = page.locator('.app .main');
      const boundary = page.getByText(ERRO_BOUNDARY);
      // 1ª rota do worker compila todos os .jsx (~20s); as seguintes usam o cache.
      try {
        await expect(main.or(boundary).first()).toBeVisible({ timeout: 45_000 });
      } catch (e) {
        throw new Error(`Tela não renderizou.\n${erros.join('\n') || '(nenhum erro de JS capturado)'}\n\n${e.message}`);
      }
      await page.waitForLoadState('networkidle').catch(() => {});
      await falharSeQuebrou(page, boundary, erros);
    });
  }
});

// Páginas públicas (link com token enviado a cliente/fornecedor/instalador).
// Token inexistente: a página tem que abrir e mostrar o próprio aviso, sem quebrar.
const PAGINAS_PUBLICAS = [
  { url: '/assinar/e2e-token', root: '#ci-sign-root' },
  { url: '/cotacao/e2e-token', root: '#co-root' },
  { url: '/formulario-cliente/e2e-token', root: '#fe-root' },
  { url: '/cotacao-elevador-fornecedor/e2e-token', root: '#cef-root' },
  { url: '/vistoria/e2e-token', root: '#ve-root' },
  { url: '/status-obra/e2e-token', root: '#so-root' },
  { url: '/status-obra-interno/e2e-token', root: '#so-root' }, // modo interno (equipe): outro caminho no status-obra-app.jsx
  { url: '/diario-obra/e2e-token', root: '#do-root' },
  { url: '/termo-entrega/e2e-token', root: '#te-root' },
];

test.describe('Páginas públicas', () => {
  for (const { url, root } of PAGINAS_PUBLICAS) {
    test(url.split('/')[1], async ({ page }) => {
      const erros = coletarErros(page);
      await page.goto(url);
      const el = page.locator(root);
      // O HTML já vem com um "Carregando…" dentro do root — não basta o root
      // ter conteúdo. Exige que o React tenha montado ali (createRoot marca o
      // elemento com __reactContainer…) e que a tela tenha saído do
      // "Carregando…" (com o Supabase simulado, token inexistente resolve na
      // hora pro aviso de link inválido). Se um script não carregar (ex.: CDN
      // 404), o app nunca monta e o teste falha em vez de passar em silêncio.
      await expect.poll(() => el.evaluate((n) => Object.keys(n).some((k) => k.startsWith('__reactContainer'))),
        { message: `app não montou em ${root}\n${erros.join('\n')}` }).toBe(true);
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(el, `tela presa em "Carregando…"\n${erros.join('\n')}`).not.toHaveText(/^\s*Carregando…?\s*$/);
      expect(erros, erros.join('\n')).toEqual([]);
    });
  }
});
