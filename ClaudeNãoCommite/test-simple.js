const { chromium } = require('@playwright/test');

async function main() {
  let browser;
  try {
    console.log('🚀 Teste: Carregamento de /comercial/leads\n');

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    console.log('📍 Navegando para http://localhost:3000/comercial/leads...');
    await page.goto('http://localhost:3000/comercial/leads', { waitUntil: 'domcontentloaded', timeout: 15000 });

    console.log('⏳ Aguardando render (3s)...');
    await page.waitForTimeout(3000);

    const pageText = await page.textContent('body');
    const hasTitle = pageText.includes('Pipeline de Leads');
    const hasElements = await page.$$('button, table, [role="grid"]');

    console.log('\n✅ Resultados:');
    console.log(`  ${hasTitle ? '✅' : '❌'} Título "Pipeline de Leads" encontrado`);
    console.log(`  ${hasElements.length > 0 ? '✅' : '❌'} ${hasElements.length} elementos UI encontrados`);
    console.log(`  ${errors.length === 0 ? '✅' : '❌'} Console limpo (${errors.length} erros)`);

    if (errors.length > 0) {
      console.log('\n  ⚠️  Erros de console:');
      errors.slice(0, 3).forEach(e => console.log(`     - ${e.slice(0, 70)}...`));
    }

    await page.screenshot({ path: 'ClaudeNãoCommite/leads-screenshot.png' });
    console.log('\n  📸 Screenshot: ClaudeNãoCommite/leads-screenshot.png');

    console.log(`\n${hasTitle && hasElements.length > 0 && errors.length === 0 ? '✅ PASSOU' : '❌ FALHOU'}\n`);

    await browser.close();

  } catch (error) {
    console.error('💥 ERRO:', error.message);
    if (browser) await browser.close();
  }
}

main();
