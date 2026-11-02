'use strict';
/* Documento do módulo em dia com o código (Arts. 42 e 46 da Constituição).

   Mudou um arquivo de um módulo? O documento daquele módulo (docs/modulos/NN_*.md) tem que mudar
   no MESMO conjunto de commits (o PR). Quem é o dono de cada arquivo vem dos próprios documentos —
   nada fica cadastrado à parte, então o mapa não envelhece:
     1. dono "primário" = documento que cita o arquivo no tema "Rota e arquivos" (x.x.2). SÓ ele faz o
        CI falhar: é a declaração explícita de "este arquivo é desta tela";
     2. dono "provável" = documento que cita o arquivo em qualquer outro lugar (de passagem). Só avisa,
        porque o backtest em commits reais mostrou que citação de passagem gera falso positivo;
     3. arquivo novo precisa estar citado em algum documento do HEAD; arquivo antigo sem dono só gera aviso.
   Edge Function (supabase/functions/<nome>) segue a mesma regra, pelo nome da pasta.
   Arquivo com mais de um dono: basta UM deles ter mudado.

   Escape: um commit do conjunto com a linha
       Docs: não se aplica — <motivo com pelo menos 10 letras>
   libera o conjunto inteiro (o motivo fica no histórico do Git, para auditar depois).

   Uso: node scripts/check-docs-em-dia.js <base-ref> [--modo aviso|falha] [--head <ref>] [--cwd <pasta>]
   --modo aviso (padrão): lista o que faltaria e sai 0.   --modo falha: sai 1 se faltar.
   Sem <base-ref> válido (ex.: primeiro push de um branch): avisa e sai 0, como check-cache-bust.js. */
const { execFileSync } = require('child_process');
const G = require('./gerar-rag.js');

const ROTA_PRIMARIA = /Rota e arquivos/;
const TRAILER = /^Docs:\s*n[ãa]o se aplica\s*[—–-]\s*(\S.{8,})$/im;
const ehCodigoDeModulo = (f) => /^src\/[^/]+\.(js|jsx)$/.test(f) && !/\.test\.js$/.test(f) && !/\.bundle\.js$/.test(f);
const funcaoDe = (f) => { const m = /^supabase\/functions\/([^/]+)\//.exec(f); return m && m[1] !== '_shared' ? m[1] : null; };
const ehDocModulo = (f) => /^docs\/modulos\/[^/]+\.md$/.test(f);

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
}
function refValida(ref, cwd) {
  if (!ref || /^0+$/.test(ref)) return false;
  try { git(['rev-parse', '--verify', '--quiet', ref + '^{commit}'], cwd); return true; } catch (_) { return false; }
}

/* ---------- mapa arquivo -> documentos (puro; recebe os textos) ---------- */
function mapear(docs, arquivosSrc, funcoes) {
  const srcSet = new Set(arquivosSrc);
  const fnSet = new Set(funcoes);
  const primarios = new Map();
  const provaveis = new Map();
  const soma = (mapa, chave, doc) => { if (!mapa.has(chave)) mapa.set(chave, new Set()); mapa.get(chave).add(doc); };
  const citados = (texto) => {
    const arquivos = new Set();
    const pastas = new Set();
    for (const m of texto.matchAll(/`([^`\n]+)`/g)) {
      const c = m[1].trim().replace(/^src\//, '');
      if (srcSet.has(c)) arquivos.add('src/' + c);
      else if (srcSet.has(c + '.js')) arquivos.add('src/' + c + '.js');
      else if (srcSet.has(c + '.jsx')) arquivos.add('src/' + c + '.jsx');
      const f = /^(?:supabase\/functions\/)?([a-z0-9_-]+)\/?$/i.exec(m[1].trim());
      if (f && fnSet.has(f[1])) pastas.add(f[1]);
    }
    for (const m of texto.matchAll(/\b([a-z0-9][a-z0-9_-]*\.(?:jsx|js))\b/g)) if (srcSet.has(m[1])) arquivos.add('src/' + m[1]);
    for (const m of texto.matchAll(/supabase\/functions\/([a-z0-9_-]+)/gi)) if (fnSet.has(m[1])) pastas.add(m[1]);
    return { arquivos, pastas };
  };
  for (const [rel, texto] of Object.entries(docs)) {
    const doc = G.parsear(texto);
    const tudo = doc.secoes.map((s) => s.blocos.map((b) => b.texto).join('\n')).join('\n');
    const prim = doc.secoes.filter((s) => ROTA_PRIMARIA.test(s.titulo)).map((s) => s.blocos.map((b) => b.texto).join('\n')).join('\n');
    const a = citados(tudo);
    const p = citados(prim);
    for (const f of a.arquivos) soma(provaveis, f, rel);
    for (const d of a.pastas) soma(provaveis, 'supabase/functions/' + d, rel);
    for (const f of p.arquivos) soma(primarios, f, rel);
    for (const d of p.pastas) soma(primarios, 'supabase/functions/' + d, rel);
  }
  return { primarios, provaveis };
}

/* ---------- regra (pura) ---------- */
function avaliar({ mapaBase, mapaHead, mudancas, docsMudados }) {
  const violacoes = [];
  const semDono = [];
  const provaveis = [];
  const jaVistos = new Set();
  for (const { status, arquivo } of mudancas) {
    const fn = funcaoDe(arquivo);
    if (!ehCodigoDeModulo(arquivo) && !fn) continue;
    const unidade = fn ? 'supabase/functions/' + fn : arquivo;
    if (jaVistos.has(unidade)) continue;
    jaVistos.add(unidade);
    const uniao = (mapa) => [...(mapaBase[mapa].get(unidade) || []), ...(mapaHead[mapa].get(unidade) || [])];
    const primarios = new Set(uniao('primarios'));
    if (primarios.size) {
      if (![...primarios].some((d) => docsMudados.has(d))) violacoes.push({ unidade, motivo: 'o documento do módulo não mudou', donos: [...primarios].sort(), origem: 'primário' });
      continue;
    }
    const prov = new Set(uniao('provaveis'));
    if (prov.size) {
      if (![...prov].some((d) => docsMudados.has(d))) provaveis.push({ unidade, donos: [...prov].sort() });
      continue;
    }
    if (status === 'A') violacoes.push({ unidade, motivo: 'arquivo novo que nenhum documento de módulo cita', donos: [] });
    else semDono.push(unidade);
  }
  return { violacoes, semDono, provaveis };
}

/* ---------- leitura do Git ---------- */
function lerDocsEArquivos(ref, cwd) {
  const arquivos = git(['ls-tree', '--name-only', ref, 'src/'], cwd).split('\n').filter(Boolean).filter(ehCodigoDeModulo).map((f) => f.replace(/^src\//, ''));
  let funcoes = [];
  try { funcoes = git(['ls-tree', '--name-only', ref, 'supabase/functions/'], cwd).split('\n').filter(Boolean).map((f) => f.replace(/^supabase\/functions\//, '')).filter((f) => f && f !== '_shared'); } catch (_) { /* sem pasta */ }
  const docs = {};
  for (const rel of git(['ls-tree', '--name-only', ref, 'docs/modulos/'], cwd).split('\n').filter(ehDocModulo)) docs[rel] = G.normalizar(git(['show', ref + ':' + rel], cwd));
  return { arquivos, funcoes, docs };
}
function mudancasEntre(base, head, cwd) {
  return git(['diff', '--name-status', '--no-renames', base, head], cwd).split('\n').filter(Boolean).map((l) => {
    const [s, ...r] = l.split('\t');
    return { status: s[0], arquivo: r.join('\t') };
  });
}
function conferir({ base, head = 'HEAD', cwd = process.cwd() }) {
  const mudancas = mudancasEntre(base, head, cwd);
  const b = lerDocsEArquivos(base, cwd);
  const h = lerDocsEArquivos(head, cwd);
  const mapaBase = mapear(b.docs, b.arquivos, b.funcoes);
  const mapaHead = mapear(h.docs, h.arquivos, h.funcoes);
  const docsMudados = new Set(mudancas.map((m) => m.arquivo).filter(ehDocModulo));
  const r = avaliar({ mapaBase, mapaHead, mudancas, docsMudados });
  const mensagens = git(['log', '--format=%B%x00', base + '..' + head], cwd).split('\0');
  const liberado = mensagens.map((m) => TRAILER.exec(m)).find(Boolean);
  const tocaModulo = mudancas.some((m) => ehCodigoDeModulo(m.arquivo) || funcaoDe(m.arquivo));
  return { ...r, docsMudados: [...docsMudados].sort(), liberado: liberado ? liberado[1].trim() : null, tocaModulo };
}

function main(argv) {
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const base = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
  const modo = arg('--modo') || 'aviso';
  const head = arg('--head') || 'HEAD';
  const cwd = arg('--cwd') || process.cwd();
  if (!['aviso', 'falha'].includes(modo)) { console.error('--modo deve ser "aviso" ou "falha".'); return 2; }
  if (!refValida(base, cwd)) { console.log('⚠️  Base "' + (base || '') + '" indisponível — checagem de documentos pulada.'); return 0; }
  const r = conferir({ base, head, cwd });
  if (!r.tocaModulo) { console.log('✅ Nenhum arquivo de módulo (src/ ou supabase/functions/) mudou: nada a conferir nos documentos.'); return 0; }
  if (r.provaveis.length) console.log('ℹ️  Arquivos alterados que um documento só cita de passagem (' + r.provaveis.length + '): ' + r.provaveis.map((p) => p.unidade + ' (' + p.donos.join(' ou ') + ')').join('; ') + '\n   Se a mudança altera o que a tela faz, atualize o documento; se o arquivo é mesmo de uma tela, cite-o no tema "Rota e arquivos".');
  if (r.semDono.length) console.log('ℹ️  Arquivos alterados que nenhum documento de módulo cita (' + r.semDono.length + '): ' + r.semDono.join(', ') + '\n   Cite-os no tema "Rota e arquivos" do módulo dono.');
  if (!r.violacoes.length) { console.log('✅ Todo arquivo de módulo alterado tem o documento do módulo alterado junto (' + r.docsMudados.length + ' documento(s) mudaram).'); return 0; }
  const linhas = r.violacoes.map((v) => '  - ' + v.unidade + ' → ' + (v.donos.length ? v.donos.join(' ou ') : '(nenhum documento cita)') + ' [' + v.motivo + (v.origem ? '; dono ' + v.origem : '') + ']');
  if (r.liberado) { console.log('✅ Documentos liberados por "Docs: não se aplica — ' + r.liberado + '" (' + r.violacoes.length + ' arquivo(s) sem documento alterado).'); return 0; }
  const cabeca = modo === 'falha' ? '❌' : '⚠️ ';
  console.log(cabeca + ' Arquivo de módulo alterado sem o documento do módulo (Arts. 42 e 46 da Constituição):\n' + linhas.join('\n'));
  console.log('Atualize o documento no tema certo (e rode `npm run rag`), ou declare num commit: "Docs: não se aplica — <motivo>".');
  return modo === 'falha' ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { mapear, avaliar, conferir, TRAILER, ehCodigoDeModulo, funcaoDe };
