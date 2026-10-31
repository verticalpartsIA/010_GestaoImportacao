'use strict';
/* Isolamento de rede dos testes de fumaça.

   - CDNs (React, Babel, Supabase JS, jsPDF…) passam de verdade: é o que
     produção carrega, e é justamente o que queremos ver compilar.
   - Supabase (*.supabase.co) é SIMULADO: toda leitura devolve lista vazia
     e toda escrita é recusada. O teste NUNCA toca no banco de produção.
   - Qualquer outro host externo (SSO do vpsistema, APIs de CEP/CNPJ,
     Omie…) é bloqueado. */
const CDN_HOSTS = [
  'unpkg.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'cdn.tailwindcss.com',
  'fonts.googleapis.com', 'fonts.gstatic.com',
];

// Cache em memória (por worker) dos arquivos de CDN: cada URL é baixada uma
// vez, com até 4 tentativas, e servida do cache nos testes seguintes. Tira a
// instabilidade de rede do caminho (um arquivo de CDN que não carrega vira
// "React is not defined" — falso positivo) e deixa a suíte bem mais rápida.
const cdnCache = new Map();

async function baixarCdn(route) {
  const key = route.request().url();
  if (!cdnCache.has(key)) {
    cdnCache.set(key, (async () => {
      let ultimoErro;
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        try {
          const resp = await route.fetch({ timeout: 30_000 });
          if (resp.status() >= 500) throw new Error(`HTTP ${resp.status()}`);
          return { status: resp.status(), headers: resp.headers(), body: await resp.body() };
        } catch (e) {
          ultimoErro = e;
          await new Promise((r) => setTimeout(r, 1000 * (tentativa + 1)));
        }
      }
      throw ultimoErro;
    })());
  }
  try {
    const r = await cdnCache.get(key);
    return route.fulfill(r);
  } catch (e) {
    cdnCache.delete(key);
    return route.abort('failed');
  }
}

function isLocal(url) {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

async function isolarRede(context) {
  await context.route('**/*', async (route) => {
    const req = route.request();
    let url;
    try { url = new URL(req.url()); } catch (_) { return route.abort(); }
    if (url.protocol === 'data:' || url.protocol === 'blob:' || isLocal(url)) return route.continue();
    if (CDN_HOSTS.includes(url.hostname)) return baixarCdn(route);

    if (url.hostname.endsWith('.supabase.co')) {
      const p = url.pathname;
      if (p.startsWith('/rest/v1/')) {
        if (req.method() !== 'GET' && req.method() !== 'HEAD') {
          return route.fulfill({ status: 403, contentType: 'application/json',
            body: JSON.stringify({ code: 'E2E', message: 'escrita bloqueada no teste de fumaça' }) });
        }
        // .single() pede objeto: sem linha, o PostgREST responde 406/PGRST116.
        if ((req.headers()['accept'] || '').includes('vnd.pgrst.object')) {
          return route.fulfill({ status: 406, contentType: 'application/json',
            body: JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows' }) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json',
          headers: { 'content-range': '*/0' }, body: '[]' });
      }
      if (p.startsWith('/functions/v1/')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    }
    return route.abort('blockedbyclient');
  });
}

/* Coleta erros que indicam tela quebrada: exceção não tratada (inclui erro
   de compilação do Babel) e falha do jsx-loader ao buscar/compilar/rodar
   um .jsx. console.error comum (fetch bloqueado etc.) não conta. */
function coletarErros(page) {
  const erros = [];
  page.on('pageerror', (err) => erros.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && msg.text().includes('[jsx-loader]')) erros.push(`console: ${msg.text()}`);
  });
  return erros;
}

module.exports = { isolarRede, coletarErros };
