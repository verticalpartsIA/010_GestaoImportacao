'use strict';
/* Checagem de cache-busting (?v=) — roda no CI (.github/workflows/ci.yml).

   Todo <script>/<link> local das páginas .html da raiz é servido com ?v=N.
   Se um arquivo referenciado assim muda e o ?v= da página não muda junto,
   quem já tinha o arquivo em cache continua rodando a versão antiga depois
   do deploy — quebra produção em silêncio (ver CLAUDE.md, "Cache-busting").

   Regra: para cada página .html da raiz e cada referência local com ?v=,
   se o arquivo referenciado mudou entre <base> e HEAD, o ?v= dessa
   referência tem que ser diferente do que era em <base>. Referência nova
   (página ou arquivo que não tinha ?v= em <base>) passa.

   Uso: node scripts/check-cache-bust.js <base-ref>
   Sem <base-ref> válido (ex.: primeiro push de um branch), avisa e sai 0. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const base = process.argv[2];

function git(args, cwd) {
  return execFileSync('git', args, { cwd: cwd || root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

const root = git(['rev-parse', '--show-toplevel'], process.cwd()).trim();

function baseValida(ref) {
  if (!ref || /^0+$/.test(ref)) return false;
  try { git(['cat-file', '-e', ref + '^{commit}']); return true; } catch (_) { return false; }
}

// { 'src/app.jsx': '77', ... } — só referências locais com ?v=
function refsVersionadas(html) {
  const out = {};
  const re = /(?:src|href)\s*=\s*["']([^"'?#]+)\?v=([^"'&#]*)/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    if (/^(?:[a-z]+:)?\/\//i.test(url)) continue;
    out[url.replace(/^\.?\//, '')] = m[2];
  }
  return out;
}

if (!baseValida(base)) {
  console.log(`⚠️  Base "${base || ''}" indisponível — checagem de ?v= pulada.`);
  process.exit(0);
}

const mudados = new Set(git(['diff', '--name-only', base, 'HEAD']).split('\n').filter(Boolean));
const paginas = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
const erros = [];

for (const pagina of paginas) {
  const atual = refsVersionadas(fs.readFileSync(path.join(root, pagina), 'utf8'));
  let anterior = {};
  try { anterior = refsVersionadas(git(['show', `${base}:${pagina}`])); } catch (_) { /* página nova */ }

  for (const [arquivo, v] of Object.entries(atual)) {
    if (!mudados.has(arquivo)) continue;
    if (!(arquivo in anterior)) continue;
    if (anterior[arquivo] === v) erros.push(`${pagina}: ${arquivo} mudou, mas continua ?v=${v}`);
  }
}

if (erros.length) {
  console.error('❌ Cache-busting: arquivo alterado sem incrementar o ?v= na página que o carrega.');
  for (const e of erros) console.error('   - ' + e);
  console.error('Incremente o ?v= dessas referências no mesmo commit (ver CLAUDE.md, "Cache-busting").');
  process.exit(1);
}
console.log(`✅ Cache-busting ok (${mudados.size} arquivo(s) alterado(s) desde ${base.slice(0, 7)}).`);
