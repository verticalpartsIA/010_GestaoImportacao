'use strict';
/* Testes de fumaça do frontend (Playwright) — ver e2e/smoke.spec.js.
   Local: npm run test:e2e (sobe o node server.js sozinho). */
const { defineConfig } = require('@playwright/test');

const PORT = Number(process.env.E2E_PORT || 3100);
// Sandbox do Claude Code: saída HTTPS passa por um proxy com CA própria.
// No GitHub Actions não existe HTTPS_PROXY, então nada disso se aplica.
const proxy = process.env.HTTPS_PROXY
  ? { server: process.env.HTTPS_PROXY, bypass: '<-loopback>,localhost,127.0.0.1' }
  : undefined;

module.exports = defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  // Os scripts vêm de CDN (unpkg/jsDelivr/cdnjs): 1 nova tentativa no CI
  // absorve falha de rede passageira sem esconder erro de verdade (um erro
  // real de código falha igual nas duas tentativas).
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: !!proxy,
    launchOptions: proxy ? { proxy } : {},
  },
  webServer: {
    command: 'node server.js',
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
