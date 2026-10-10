#!/usr/bin/env node
/* ============================================================
   capturar.mjs — captura os prints de um tutorial do VP Gestão
   ------------------------------------------------------------
   Uso:
     node capturar.mjs <roteiro.json> [--base http://localhost:3000] [--headed]

   Lê o roteiro (ver references/roteiro-formato.md), abre o VP Gestão
   rodando LOCALMENTE (o SSO só é dispensado em localhost), executa os
   passos e salva um PNG por passo com:
     • destaque numerado amarelo VerticalParts no(s) elemento(s) do passo
     • desfoque de dados sensíveis (CPF, CNPJ, e-mail, telefone, valores…)
     • recorte opcional em volta de um elemento (zoom estilo docs)
   Grava também <saida>/manifesto.json com o que aconteceu em cada passo.

   SEGURANÇA — o app local fala com o Supabase de PRODUÇÃO. Por isso toda
   requisição de escrita (POST/PATCH/PUT/DELETE) para Supabase ou /api é
   BLOQUEADA por padrão. Com "simularEscrita": true ela é respondida com um
   200 falso (a tela mostra o "depois", nada é gravado). Nunca desligue isso.
   ============================================================ */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadPlaywright() {
  const tries = [path.join(__dirname, 'package.json'), path.join(process.cwd(), 'package.json')];
  for (const t of tries) {
    try { return createRequire(t)('playwright'); } catch (e) { /* tenta o próximo */ }
  }
  console.error('\n[capturar] Playwright não encontrado. Instale só para a skill (não mexe no package.json do app):\n' +
    `  npm install --prefix "${__dirname}" playwright && npx --prefix "${__dirname}" playwright install chromium\n`);
  process.exit(2);
}

/* ---------- argumentos ---------- */
const args = process.argv.slice(2);
if (!args[0] || args.includes('--help')) {
  console.log('Uso: node capturar.mjs <roteiro.json> [--base http://localhost:3000] [--headed] [--so <id-do-passo>]');
  process.exit(args[0] ? 0 : 1);
}
const roteiroPath = path.resolve(args[0]);
const argVal = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const roteiro = JSON.parse(fs.readFileSync(roteiroPath, 'utf8'));
const base = (argVal('--base') || roteiro.baseUrl || 'http://localhost:3000').replace(/\/$/, '');
const headed = args.includes('--headed');
const soPasso = argVal('--so');

if (!/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(base)) {
  console.error(`[capturar] Recusado: "${base}" não é localhost. Capture sempre com o app rodando local (npm start).`);
  process.exit(1);
}

const saida = path.resolve(path.dirname(roteiroPath), roteiro.saida || 'img');
fs.mkdirSync(saida, { recursive: true });

const PERFIS = ['comercial', 'engenharia', 'financeiro', 'admin'];
const perfil = roteiro.perfil || 'admin';
if (!PERFIS.includes(perfil)) { console.error(`[capturar] perfil inválido: ${perfil} (use ${PERFIS.join('/')})`); process.exit(1); }

const viewport = { width: roteiro.largura || 1440, height: roteiro.altura || 900 };
const DESFOQUE_PADRAO = { cpf: true, cnpj: true, email: true, telefone: true, valores: false, nomesPessoas: false };
// com dadosDemo os dados já são fictícios: desfoque desligado, salvo se o roteiro pedir
const desfoque = roteiro.dadosDemo && !roteiro.desfocar
  ? Object.fromEntries(Object.keys(DESFOQUE_PADRAO).map((k) => [k, false]))
  : { ...DESFOQUE_PADRAO, ...(roteiro.desfocar || {}) };
const seletoresDesfoque = [...(roteiro.desfocarSeletores || [])];
// bolha do Copiloto VP (vp-copiloto.jsx) e avisos de nova versão poluem o print
const esconderPadrao = ['.vpc-bubble', '.vpc-panel', '[class*="version-banner"]', '[class*="update-toast"]'];
const esconder = [...esconderPadrao, ...(roteiro.esconder || [])];

/* ---------- código injetado na página ---------- */
function injetarEstilos(page) {
  return page.evaluate((css) => {
    if (document.getElementById('vp-tut-style')) return;
    const s = document.createElement('style');
    s.id = 'vp-tut-style'; s.textContent = css;
    document.head.appendChild(s);
  }, `
    #vp-tut-layer{position:fixed;inset:0;pointer-events:none;z-index:2147483647}
    .vp-tut-box{position:fixed;border:3px solid #F5C400;border-radius:8px;
      box-shadow:0 0 0 4px rgba(0,0,0,.55),0 0 0 9999px rgba(0,0,0,.18);}
    .vp-tut-box.semfoco{box-shadow:0 0 0 4px rgba(0,0,0,.55)}
    .vp-tut-num{position:fixed;width:30px;height:30px;border-radius:50%;background:#000;color:#F5C400;
      font:800 16px/30px "Barlow Condensed",Inter,Arial,sans-serif;text-align:center;
      border:2px solid #F5C400;box-shadow:0 2px 6px rgba(0,0,0,.35)}
    .vp-tut-tip{position:fixed;max-width:280px;background:#000;color:#fff;padding:8px 12px;border-radius:6px;
      font:600 13px/1.35 Inter,Arial,sans-serif;border-left:4px solid #F5C400;box-shadow:0 4px 14px rgba(0,0,0,.35)}
    .vp-tut-blur{filter:blur(6px)!important}
    ${esconder.join(',')}{visibility:hidden!important}
    *,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}
  `);
}

async function desfocarPagina(page) {
  await page.evaluate(({ desfoque, seletores }) => {
    const R = [];
    if (desfoque.cpf) R.push(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
    if (desfoque.cnpj) R.push(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
    if (desfoque.email) R.push(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (desfoque.telefone) R.push(/(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/);
    if (desfoque.valores) R.push(/(R\$|US\$|USD|¥|€)\s?[\d.,]+/);
    const bate = (t) => R.some((r) => r.test(t));
    for (const s of seletores) document.querySelectorAll(s).forEach((el) => el.classList.add('vp-tut-blur'));
    if (desfoque.nomesPessoas) document.querySelectorAll('[data-pessoa], .avatar + *, .user-name').forEach((el) => el.classList.add('vp-tut-blur'));
    if (!R.length) return;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const alvos = new Set();
    while (w.nextNode()) {
      const n = w.currentNode;
      if (n.parentElement && n.nodeValue && bate(n.nodeValue) && !n.parentElement.closest('#vp-tut-layer')) alvos.add(n.parentElement);
    }
    alvos.forEach((el) => el.classList.add('vp-tut-blur'));
    document.querySelectorAll('input,textarea').forEach((el) => { if (bate(el.value || '')) el.classList.add('vp-tut-blur'); });
  }, { desfoque, seletores: seletoresDesfoque });
}

async function limparCamada(page) {
  await page.evaluate(() => document.getElementById('vp-tut-layer')?.remove());
}

async function desenharDestaques(page, caixas, focar, limites) {
  await page.evaluate(({ caixas, focar, limites }) => {
    let layer = document.getElementById('vp-tut-layer');
    if (!layer) { layer = document.createElement('div'); layer.id = 'vp-tut-layer'; document.body.appendChild(layer); }
    const W = window.innerWidth, H = window.innerHeight, P = 6;
    // área onde número/balão podem ficar: o elemento recortado, ou a tela toda
    const L = limites || { x: 0, y: 0, width: W, height: H };
    const X0 = L.x, Y0 = L.y, X1 = L.x + L.width, Y1 = L.y + L.height;
    caixas.forEach((c, i) => {
      const x = c.x - P, y = c.y - P, w = c.width + P * 2, h = c.height + P * 2;
      const box = document.createElement('div');
      box.className = 'vp-tut-box' + (focar && i === 0 ? '' : ' semfoco');
      Object.assign(box.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      layer.appendChild(box);
      if (c.numero != null) {
        const n = document.createElement('div');
        n.className = 'vp-tut-num'; n.textContent = c.numero;
        // canto superior DIREITO: rótulos de campo ficam à esquerda, então não cobre texto
        const nx = Math.min(x + w - 15, X1 - 34);
        const ny = y - 15 < Y0 + 4 ? y + h - 15 : y - 15;
        Object.assign(n.style, { left: nx + 'px', top: ny + 'px' });
        layer.appendChild(n);
      }
      if (c.texto) {
        const t = document.createElement('div');
        t.className = 'vp-tut-tip'; t.textContent = c.texto;
        layer.appendChild(t);
        const tw = Math.min(280, t.offsetWidth), th = t.offsetHeight;
        let pos = c.posicao;
        if (!pos) {
          if (!limites && x + w < W * 0.25) pos = 'direita';               // item do menu lateral
          else if (y + h + th + 14 < Y1) pos = 'abaixo';
          else if (x - tw - 14 > X0) pos = 'esquerda';                       // ex.: botão no rodapé do modal
          else pos = 'acima';
        }
        let left = Math.min(Math.max(X0 + 8, x), X1 - tw - 8), top = y + h + 12;
        if (pos === 'acima') top = y - th - 12;
        if (pos === 'direita') { left = x + w + 12; top = y + h / 2 - th / 2; }
        if (pos === 'esquerda') { left = x - tw - 12; top = y + h / 2 - th / 2; }
        Object.assign(t.style, { left: left + 'px', top: Math.max(Y0 + 8, top) + 'px' });
      }
    });
  }, { caixas, focar, limites });
}

/* ---------- execução ---------- */
const { chromium } = loadPlaywright();
const launchOpts = { headless: !headed };
if (fs.existsSync('/opt/pw-browsers/chromium')) launchOpts.executablePath = '/opt/pw-browsers/chromium';
if (process.env.HTTPS_PROXY && !process.env.VP_TUT_SEM_PROXY) launchOpts.proxy = { server: process.env.HTTPS_PROXY, bypass: '<-loopback>,localhost,127.0.0.1' };
const browser = await chromium.launch(launchOpts).catch(async () => { delete launchOpts.executablePath; return chromium.launch(launchOpts); });
const context = await browser.newContext({ viewport, deviceScaleFactor: roteiro.escala || 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', ignoreHTTPSErrors: true });

await context.addInitScript((perfil) => {
  try {
    localStorage.setItem('vpprd.role', JSON.stringify(perfil));
    localStorage.setItem('vpprd.sidebarCollapsed', 'false');
    sessionStorage.setItem('vpprd_sso_ok', '1');
    sessionStorage.setItem('vpprd_user', JSON.stringify({ nome: 'Usuário Tutorial', email: 'tutorial@verticalparts.com.br', iniciais: 'UT', id: 'tutorial' }));
  } catch (e) {}
}, perfil);

/* Dados de demonstração (opcional): "dadosDemo": "demo.json" responde as
   leituras do Supabase com registros fictícios — print 100% sem dado real.
   Formato: { "<tabela>": [ {..linha..}, ... ] }. Tabela ausente → []. */
let demo = null;
if (roteiro.dadosDemo) demo = JSON.parse(fs.readFileSync(path.resolve(path.dirname(roteiroPath), roteiro.dadosDemo), 'utf8'));

/* Espelho local de CDN (opcional, só para máquinas sem acesso ao unpkg/jsdelivr):
   VP_TUT_CDN_LOCAL=<pasta> com <pacote>@<versão>/<arquivo> extraídos do npm. */
const cdnLocal = process.env.VP_TUT_CDN_LOCAL;
function arquivoCdn(u) {
  const m = u.match(/^https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net\/npm)\/(.+?)(?:\?.*)?$/);
  if (!m) return null;
  const f = path.join(cdnLocal, m[1]);
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}

/* "filtrarDemo": true no roteiro → as leituras do Supabase fictício respeitam os filtros comuns do PostgREST
   (col=eq.x, neq, in.(a,b), is.null, not.*, gt/gte/lt/lte), order e limit. Sem a flag, a tabela volta inteira
   (comportamento antigo). `or=`/`and=` e colunas com `->` não são avaliados (ficam de fora do filtro). */
function aplicarFiltrosDemo(linhas, params) {
  const valor = (r, col) => (r[col] === undefined ? null : r[col]);
  const igual = (a, b) => (a === null ? b === 'null' : String(a) === String(b));
  const lista = (s) => s.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''));
  const teste = (r, col, op) => {
    const neg = op.startsWith('not.');
    const o = neg ? op.slice(4) : op;
    const i = o.indexOf('.');
    const nome = o.slice(0, i), arg = o.slice(i + 1);
    const v = valor(r, col);
    let ok = true;
    if (nome === 'eq') ok = igual(v, arg);
    else if (nome === 'neq') ok = !igual(v, arg);
    else if (nome === 'in') ok = lista(arg).some((x) => igual(v, x));
    else if (nome === 'is') ok = arg === 'null' ? v === null : String(v) === arg;
    else if (nome === 'ilike') { const pat = arg.replace(/^"|"$/g, '').replace(/%/g, '').toLowerCase(); ok = v !== null && String(v).toLowerCase().includes(pat); }
    else if (['gt', 'gte', 'lt', 'lte'].includes(nome)) {
      if (v === null) ok = false;
      else { const a = isNaN(Number(v)) ? String(v) : Number(v), b = isNaN(Number(arg)) ? arg : Number(arg); ok = nome === 'gt' ? a > b : nome === 'gte' ? a >= b : nome === 'lt' ? a < b : a <= b; }
    }
    return neg ? !ok : ok;
  };
  let out = linhas.filter((r) => {
    for (const [k, v] of params.entries()) {
      if (k === 'or') {   // or=(col.op.arg,col.op.arg): vale se QUALQUER condição bater (só ilike/eq/is etc. simples)
        const partes = v.replace(/^\(|\)$/g, '').split(/,(?=[a-z_]+\.)/);
        if (!partes.some((p) => { const i = p.indexOf('.'); return teste(r, p.slice(0, i), p.slice(i + 1)); })) return false;
        continue;
      }
      if (['select', 'order', 'limit', 'offset', 'and', 'columns', 'on_conflict'].includes(k) || k.includes('->')) continue;
      if (!teste(r, k, v)) return false;
    }
    return true;
  });
  const ordem = params.get('order');
  if (ordem) {
    const cols = ordem.split(',').map((s) => { const [c, ...f] = s.split('.'); return { c, desc: f.includes('desc') }; });
    out = out.slice().sort((a, b) => {
      for (const { c, desc } of cols) {
        const x = valor(a, c), y = valor(b, c);
        if (x === y) continue;
        if (x === null) return 1; if (y === null) return -1;
        const r = x < y ? -1 : 1;
        return desc ? -r : r;
      }
      return 0;
    });
  }
  const lim = Number(params.get('limit'));
  return lim > 0 ? out.slice(0, lim) : out;
}

const bloqueadas = [];
const simular = !!roteiro.simularEscrita || !!demo;
await context.route('**/*', (route) => {
  const req = route.request();
  const m = req.method();
  const u = req.url();
  if (cdnLocal) {
    const f = arquivoCdn(u);
    if (f) return route.fulfill({ status: 200, path: f, headers: { 'access-control-allow-origin': '*' } });
  }
  if (demo && /supabase\.co\//.test(u) && m === 'OPTIONS') {
    return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  }
  if (demo && /supabase\.co\/(rest|functions|auth|storage|realtime)\//.test(u)) {
    const tab = (u.match(/\/rest\/v1\/([^?/]+)/) || [])[1];
    if (['GET', 'HEAD'].includes(m)) {
      let linhas = tab && Array.isArray(demo[tab]) ? demo[tab] : [];
      if (roteiro.filtrarDemo) linhas = aplicarFiltrosDemo(linhas, new URL(u).searchParams);
      const unico = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
      const corpo = unico ? JSON.stringify(linhas[0] || null) : JSON.stringify(linhas);
      return route.fulfill({ status: 200, contentType: 'application/json', body: corpo,
        headers: { 'content-range': `0-${Math.max(0, linhas.length - 1)}/${linhas.length}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' } });
    }
  }
  if (demo && m === 'POST') {
    // leituras que o app faz por POST (Edge Function / rpc): respondidas com `__funcoes` / `__rpc` do demo.json
    const fn = (u.match(/\/functions\/v1\/([^?/]+)/) || [])[1];
    const rpc = (u.match(/\/rest\/v1\/rpc\/([^?/]+)/) || [])[1];
    const resp = fn ? (demo.__funcoes || {})[fn] : rpc ? (demo.__rpc || {})[rpc] : undefined;
    if (resp !== undefined) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resp), headers: { 'access-control-allow-origin': '*' } });
    }
  }
  const ehEscrita = !['GET', 'HEAD', 'OPTIONS'].includes(m);
  const ehBackend = /supabase\.co|\/api\/|\/functions\/v1\//.test(u) || u.startsWith(base + '/api');
  const rpcLeitura = (roteiro.rpcLeitura || []).some((nome) => u.includes('/rpc/' + nome));
  if (ehEscrita && ehBackend && !rpcLeitura) {
    bloqueadas.push({ metodo: m, url: u.replace(/\?.*/, '') });
    if (simular) {
      const corpo = /\/functions\/v1\//.test(u) ? '{"ok":true}' : '[]';
      return route.fulfill({ status: 200, contentType: 'application/json', body: corpo, headers: { 'access-control-allow-origin': '*' } });
    }
    return route.abort('blockedbyclient');
  }
  return route.continue();
});

const page = await context.newPage();
const errosConsole = [];
page.on('console', (msg) => { if (msg.type() === 'error') errosConsole.push(msg.text().slice(0, 300)); });
page.on('dialog', (d) => d.dismiss().catch(() => {}));

const manifesto = { roteiro: path.basename(roteiroPath), base, perfil, viewport, geradoEm: new Date().toISOString(), passos: [] };
const loc = (sel) => page.locator(sel).first();

let n = 0;
for (const passo of roteiro.passos) {
  n += 1;
  const id = passo.id || String(n).padStart(2, '0');
  const reg = { id, ok: true, avisos: [] };
  try {
    await limparCamada(page);
    if (passo.ir) {
      await page.goto(base + passo.ir, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => reg.avisos.push('rede não ficou ociosa em 15s'));
      // splash "Bem-vindo ao Portal" (#vp-boot) cobre a tela até o app montar
      await page.locator('#vp-boot').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => reg.avisos.push('splash #vp-boot não sumiu em 30s'));
      await page.locator('.app').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => reg.avisos.push('.app não apareceu'));
      await injetarEstilos(page);
    }
    for (const a of passo.acoes || []) {
      if (a.clicar) await loc(a.clicar).click({ timeout: 10000 });
      if (a.preencher) await loc(a.preencher).fill(String(a.valor ?? ''), { timeout: 10000 });
      if (a.selecionar) await loc(a.selecionar).selectOption(a.valor, { timeout: 10000 });
      if (a.passarMouse) await loc(a.passarMouse).hover({ timeout: 10000 });
      if (a.tecla) await page.keyboard.press(a.tecla);
      if (a.rolarAte) await loc(a.rolarAte).scrollIntoViewIfNeeded({ timeout: 10000 });
      if (a.esperar) await loc(a.esperar).waitFor({ state: 'visible', timeout: 15000 });
      if (a.esperarMs) await page.waitForTimeout(a.esperarMs);
    }
    if (passo.esperar) await loc(passo.esperar).waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(passo.pausaMs ?? 400);
    await injetarEstilos(page);
    if (soPasso && soPasso !== id) { manifesto.passos.push({ id, pulado: true }); continue; }

    // tira o foco do último campo digitado (anel de foco amarelo polui o print)
    if (!passo.manterFoco) await page.evaluate(() => document.activeElement && document.activeElement !== document.body && document.activeElement.blur());
    await desfocarPagina(page);
    const caixas = [];
    for (const [i, d] of (passo.destacar || []).entries()) {
      const el = loc(d.alvo);
      if (!(await el.count())) { reg.avisos.push(`destaque não encontrado: ${d.alvo}`); continue; }
      await el.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      const b = await el.boundingBox();
      if (!b) { reg.avisos.push(`destaque invisível: ${d.alvo}`); continue; }
      caixas.push({ ...b, numero: d.numero ?? (passo.destacar.length > 1 ? i + 1 : null), texto: d.texto, posicao: d.posicao });
    }
    const limites = passo.recortar && passo.recortar !== 'destaque' ? await loc(passo.recortar).boundingBox().catch(() => null) : null;
    await desenharDestaques(page, caixas, passo.focar !== false && caixas.length === 1, limites);

    const arquivo = path.join(saida, `${id}.png`);
    const shot = { path: arquivo, animations: 'disabled' };
    if (passo.recortar === 'destaque') {
      // zoom estilo docs: recorta em volta dos destaques (caixa + número + balão)
      const r = await page.evaluate(() => {
        const els = [...document.querySelectorAll('#vp-tut-layer > *')];
        if (!els.length) return null;
        const rs = els.map((e) => e.getBoundingClientRect());
        const x = Math.min(...rs.map((q) => q.left)), y = Math.min(...rs.map((q) => q.top));
        return { x, y, width: Math.max(...rs.map((q) => q.right)) - x, height: Math.max(...rs.map((q) => q.bottom)) - y };
      });
      if (r) {
        const m = passo.margem ?? 140;
        const minW = Math.min(viewport.width, passo.larguraMin ?? 760), minH = Math.min(viewport.height, passo.alturaMin ?? 420);
        let w = Math.max(r.width + m * 2, minW), h = Math.max(r.height + m * 2, minH);
        let x = r.x + r.width / 2 - w / 2, y = r.y + r.height / 2 - h / 2;
        x = Math.max(0, Math.min(x, viewport.width - w)); y = Math.max(0, Math.min(y, viewport.height - h));
        shot.clip = { x, y, width: Math.min(w, viewport.width), height: Math.min(h, viewport.height) };
      } else reg.avisos.push('recortar "destaque" sem destaques — print da tela inteira');
    } else if (passo.recortar) {
      let r = await loc(passo.recortar).boundingBox();
      // garante que número/balão do destaque não fiquem fora do recorte
      if (r) r = await page.evaluate((r) => {
        const rs = [...document.querySelectorAll('#vp-tut-layer > *')].map((e) => e.getBoundingClientRect());
        if (!rs.length) return r;
        const x = Math.min(r.x, ...rs.map((q) => q.left)), y = Math.min(r.y, ...rs.map((q) => q.top));
        return { x, y, width: Math.max(r.x + r.width, ...rs.map((q) => q.right)) - x, height: Math.max(r.y + r.height, ...rs.map((q) => q.bottom)) - y };
      }, r);
      if (r) {
        const m = passo.margem ?? 24;
        const x = Math.max(0, r.x - m), y = Math.max(0, r.y - m);
        shot.clip = { x, y, width: Math.min(viewport.width - x, r.width + m * 2), height: Math.min(viewport.height - y, r.height + m * 2) };
      } else reg.avisos.push(`recorte não encontrado: ${passo.recortar}`);
    } else if (passo.paginaInteira) {
      shot.fullPage = true;
    }
    await page.screenshot(shot);
    reg.arquivo = path.relative(path.dirname(roteiroPath), arquivo);
    reg.url = page.url().replace(base, '');
    reg.destaques = caixas.length;
  } catch (e) {
    reg.ok = false;
    reg.erro = String(e.message || e).split('\n')[0];
    const arquivo = path.join(saida, `${id}-ERRO.png`);
    await page.screenshot({ path: arquivo }).catch(() => {});
    reg.arquivo = path.relative(path.dirname(roteiroPath), arquivo);
  }
  manifesto.passos.push(reg);
  console.log(`${reg.ok ? '✔' : '✘'} ${id}${reg.erro ? '  — ' + reg.erro : ''}${reg.avisos.length ? '  ⚠ ' + reg.avisos.join('; ') : ''}`);
}

manifesto.escritasBloqueadas = bloqueadas;
manifesto.errosConsole = [...new Set(errosConsole)].slice(0, 30);
fs.writeFileSync(path.join(saida, 'manifesto.json'), JSON.stringify(manifesto, null, 2));
await browser.close();

const falhas = manifesto.passos.filter((p) => p.ok === false).length;
console.log(`\n${manifesto.passos.length - falhas}/${manifesto.passos.length} passos ok · ${bloqueadas.length} escrita(s) ${simular ? 'simulada(s)' : 'bloqueada(s)'} · manifesto em ${path.relative(process.cwd(), path.join(saida, 'manifesto.json'))}`);
process.exit(falhas ? 1 : 0);
