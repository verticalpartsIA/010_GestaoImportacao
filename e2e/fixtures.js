'use strict';
/* Um contexto de navegador por worker, reaproveitado entre os testes.

   Motivo: o jsx-loader compila os ~70 .jsx com Babel e guarda o resultado
   no IndexedDB do contexto. Com um contexto novo por teste (padrão do
   Playwright), cada rota recompilaria tudo (~20s). Reaproveitando, só o
   1º teste de cada worker paga a compilação. Cada teste continua com a
   própria aba (page), e um teste que falha faz o Playwright trocar de
   worker — o contexto seguinte começa limpo. */
const base = require('@playwright/test');
const { isolarRede } = require('./helpers');

const test = base.test.extend({
  sharedContext: [async ({ browser }, use) => {
    const context = await browser.newContext(base.test.info().project.use);
    await isolarRede(context);
    await use(context);
    await context.close();
  }, { scope: 'worker' }],

  page: async ({ sharedContext }, use, testInfo) => {
    const page = await sharedContext.newPage();
    await use(page);
    if (testInfo.status !== testInfo.expectedStatus) {
      const png = await page.screenshot({ fullPage: true }).catch(() => null);
      if (png) await testInfo.attach('screenshot', { body: png, contentType: 'image/png' });
    }
    await page.close();
  },
});

module.exports = { test, expect: base.expect };
