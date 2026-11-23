'use strict';
/* Gera docs/rag/ — a camada de curadoria do "Super RAG" do VP Gestão — a partir de
   docs/modulos/*.md, CLAUDE.md e README.md. Nada é escrito à mão e NADA É COPIADO:
   cada item aponta para o arquivo e a âncora do documento de origem (Art. 44) e mostra
   o selo de verificação (Art. 6) e DE ONDE ele veio.

     node scripts/gerar-rag.js              gera/atualiza docs/rag/
     node scripts/gerar-rag.js --conferir   não escreve: falha (código 1) se docs/rag/ estiver
                                            diferente do que seria gerado agora (usado no CI)
     --saida <pasta>   escreve/confere em outra pasta (testes)
     --raiz  <pasta>   lê as fontes de outra raiz de repositório (testes)

   Selo (regra do Gelson, 02/11/2026): cada bloco (parágrafo, item de lista, tabela ou
   citação) carrega o selo do próprio texto; sem selo, herda o da seção; sem selo na seção,
   herda o de uma seção-pai; sem selo em nenhuma, herda o do cabeçalho do documento ("Fonte
   da verdade: ... conferidos em <data> (origin/main <hash>)"). Só vira "Não verificado"
   quando não houver selo em nenhum nível. Faltar selo NUNCA falha o CI: o índice apenas
   mostra de onde veio o selo de cada bloco.

   Determinismo: o resultado não depende do sistema (CRLF/LF), da data nem da ordem de
   leitura do disco, para dar o mesmo arquivo no Windows e no Linux do CI. */
const fs = require('fs');
const path = require('path');

const MARCA = '<!-- GERADO por scripts/gerar-rag.js — não edite à mão. Rode: npm run rag -->';
const ORDEM_FORCA = { 'Não verificado': 0, 'Herdado': 1, 'Conferido': 2 };
const SELOS = ['Conferido', 'Herdado', 'Não verificado'];
const SECAO_META = /^(Como esta numeração|Índice|Glossário|Nota de histórico|Sumário)/i;
const NAO_SE_APLICA = 'n/a';

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const normalizar = (t) => String(t).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
const maisFraco = (lista) => lista.slice().sort((a, b) => ORDEM_FORCA[a] - ORDEM_FORCA[b])[0];
const celula = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/* ---------- âncora (mesma regra do GitHub) ---------- */
function limparTitulo(t) {
  return String(t)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, (m) => (m === '_' ? '_' : ''))
    .replace(/\s+/g, ' ')
    .trim();
}
function slugBase(titulo) {
  return limparTitulo(titulo)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '') // o GitHub mantém o seletor de variação (U+FE0F, categoria M) que vem depois de alguns emojis

    .replace(/\s/g, '-');
}
function criarAncoras() {
  const usados = new Map();
  return (titulo) => {
    const base = slugBase(titulo);
    const n = usados.get(base) || 0;
    usados.set(base, n + 1);
    return n === 0 ? base : base + '-' + n;
  };
}

/* ---------- selos ---------- */
function selosDoTexto(texto) {
  const sem = String(texto).replace(/`[^`]*`/g, '');
  const achados = new Set();
  const re = /\b(Conferido|Herdado|Não verificado)\b/g;
  let m;
  while ((m = re.exec(sem))) achados.add(m[1]);
  return Array.from(achados);
}
function seloExplicitoDaSecao(texto) {
  const sem = String(texto).replace(/`[^`]*`/g, '');
  const m = /Selo:\**\s*\**\s*(Conferido|Herdado|Não verificado)\b/.exec(sem);
  return m ? m[1] : null;
}

/* ---------- parser ---------- */
function parsear(textoBruto) {
  const texto = normalizar(textoBruto);
  const linhas = texto.split('\n');
  const ancora = criarAncoras();
  const secoes = [];
  const novaSecao = (nivel, titulo) => {
    const s = { indice: secoes.length, nivel, titulo: limparTitulo(titulo), ancora: ancora(titulo), pai: -1, blocos: [] };
    for (let k = secoes.length - 1; k >= 0; k--) if (secoes[k].nivel < nivel) { s.pai = k; break; }
    secoes.push(s);
    return s;
  };
  let secao = null;
  let cur = null;
  let vazia = false;
  let cerca = null;
  const novoBloco = (tipo, linha) => {
    if (!secao) secao = novaSecao(0, '(início do arquivo)');
    cur = { tipo, linhas: [linha] };
    secao.blocos.push(cur);
  };
  for (const linha of linhas) {
    const abre = /^\s{0,3}(`{3,}|~{3,})/.exec(linha);
    if (cerca) { if (abre && abre[1][0] === cerca[0] && abre[1].length >= cerca.length) cerca = null; cur = null; continue; }
    if (abre) { cerca = abre[1]; cur = null; continue; }
    /* O GitHub também dá âncora a título dentro de citação ("> ## Título", como no topo do CLAUDE.md) e a título em HTML
       (<h1 align="center">…</h1>, como no README): conferido contra o HTML renderizado pelo próprio GitHub. */
    const h = /^\s{0,3}(?:>\s?)*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(linha);
    const hh = h ? null : /^\s*<h([1-6])\b[^>]*>(.*?)<\/h\1>\s*$/i.exec(linha);
    if (h || hh) { secao = novaSecao(h ? h[1].length : Number(hh[1]), h ? h[2] : hh[2].replace(/<[^>]+>/g, '')); cur = null; vazia = false; continue; }
    if (/^\s*$/.test(linha)) { vazia = true; continue; }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(linha)) { cur = null; vazia = true; continue; } // linha horizontal (---): separador, não é conteúdo
    if (/^\s{0,3}>\s*$/.test(linha)) { cur = null; vazia = false; continue; }
    const recuo = /^ */.exec(linha)[0].length;
    const lista = /^(\s*)([-*+]|\d+[.)])\s+/.exec(linha);
    const continua = cur && !vazia;
    if (/^\s{0,3}>/.test(linha)) { if (continua && cur.tipo === 'citacao') cur.linhas.push(linha); else novoBloco('citacao', linha); }
    else if (/^\s*\|/.test(linha)) { if (continua && cur.tipo === 'tabela') cur.linhas.push(linha); else novoBloco('tabela', linha); }
    else if (lista && lista[1].length <= 1) novoBloco('item', linha);
    else if (cur && cur.tipo === 'item' && (recuo >= 2 || !vazia)) cur.linhas.push(linha);
    else if (continua && cur.tipo === 'paragrafo') cur.linhas.push(linha);
    else novoBloco('paragrafo', linha);
    vazia = false;
  }
  for (const s of secoes) for (const b of s.blocos) { b.texto = b.linhas.join('\n'); delete b.linhas; }
  const palavras = (texto.match(/\S+/g) || []).length;
  return { secoes, palavras, linhas: linhas.length };
}

/* ---------- selo do cabeçalho do documento ---------- */
/* O cabeçalho dos 14 primeiros documentos diz "**Fonte da verdade:** ... conferidos em <data> (`origin/main` `<hash>`)";
   o do 16_servicos diz "**Fonte da verdade e selos:** ... `origin/main` `<hash>`, tudo em **<data>**". */
function seloDoCabecalho(doc) {
  const topo = doc.secoes.filter((s) => s.nivel <= 1);
  for (const s of topo) {
    for (const b of s.blocos) {
      if (!/Fonte da verdade( e selos)?:/.test(b.texto)) continue;
      const data = /conferid[oa]s?\s+(?:em\s+)?(\d{2}\/\d{2}\/\d{4})/i.exec(b.texto) || /(\d{2}\/\d{2}\/\d{4})/.exec(b.texto);
      const hash = /origin\/main`?\s*`([0-9a-f]{7,40})`/.exec(b.texto);
      return { presente: true, selo: 'Conferido', data: data ? data[1] : null, hash: hash ? hash[1] : null };
    }
  }
  return { presente: false, selo: 'Não verificado', data: null, hash: null };
}

/* ---------- herança bloco -> seção -> seção-pai -> cabeçalho ---------- */
function seloProprioDaSecao(s) {
  if (s.meta) return null;
  for (const b of s.blocos) {
    const e = seloExplicitoDaSecao(b.texto);
    if (e) return { selo: e, como: 'selo explícito da seção' };
  }
  const noTitulo = selosDoTexto(s.titulo);
  if (noTitulo.length) return { selo: maisFraco(noTitulo), como: 'selo no título' };
  const todos = new Set();
  for (const b of s.blocos) for (const x of b.proprios) todos.add(x);
  if (todos.size === 1) return { selo: Array.from(todos)[0], como: 'uniforme' };
  if (todos.size > 1) return { selo: maisFraco(Array.from(todos)), como: 'misto (vale o mais fraco)' };
  return null;
}
function resolver(doc, ehModulo) {
  const cab = ehModulo ? seloDoCabecalho(doc) : null;
  for (const s of doc.secoes) {
    s.meta = SECAO_META.test(s.titulo) || s.nivel <= 1; // título e cabeçalho do documento só descrevem a regra do selo
    for (const b of s.blocos) b.proprios = s.meta ? [] : selosDoTexto(b.texto);
  }
  for (const s of doc.secoes) s.seloSecao = seloProprioDaSecao(s);
  const contagem = { bloco: 0, secao: 0, pai: 0, cabecalho: 0, nenhum: 0, meta: 0 };
  const efetivo = { Conferido: 0, Herdado: 0, 'Não verificado': 0 };
  for (const s of doc.secoes) {
    s.porOrigem = { bloco: 0, secao: 0, pai: 0, cabecalho: 0, nenhum: 0, meta: 0 };
    for (const b of s.blocos) {
      let origem;
      let selo;
      if (!ehModulo) { origem = 'meta'; selo = NAO_SE_APLICA; }
      else if (s.meta) { origem = 'meta'; selo = NAO_SE_APLICA; }
      else if (b.proprios.length) { origem = 'bloco'; selo = maisFraco(b.proprios); }
      else if (s.seloSecao) { origem = 'secao'; selo = s.seloSecao.selo; }
      else {
        let k = s.pai;
        let achou = null;
        while (k >= 0 && !achou) { achou = doc.secoes[k].meta ? null : doc.secoes[k].seloSecao; k = doc.secoes[k].pai; }
        if (achou) { origem = 'pai'; selo = achou.selo; }
        else if (cab && cab.presente) { origem = 'cabecalho'; selo = cab.selo; }
        else { origem = 'nenhum'; selo = 'Não verificado'; }
      }
      b.selo = selo; b.origem = origem;
      s.porOrigem[origem]++; contagem[origem]++;
      if (selo !== NAO_SE_APLICA) efetivo[selo]++;
    }
  }
  const total = doc.secoes.reduce((n, s) => n + s.blocos.length, 0);
  const secoesComSelo = doc.secoes.filter((s) => !s.meta && s.nivel >= 2 && s.seloSecao).length;
  const secoesTotal = doc.secoes.filter((s) => !s.meta && s.nivel >= 2).length;
  return { cab, contagem, efetivo, total, secoesComSelo, secoesTotal };
}

/* ---------- fontes ---------- */
function listarFontes(raiz) {
  const dir = path.join(raiz, 'docs', 'modulos');
  const modulos = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort(cmp).map((f) => ({ rel: 'docs/modulos/' + f, modulo: true }))
    : [];
  const extras = ['CLAUDE.md', 'README.md'].filter((f) => fs.existsSync(path.join(raiz, f))).map((f) => ({ rel: f, modulo: false }));
  return modulos.concat(extras);
}
const nomeIndice = (rel) => 'indice/' + path.posix.basename(rel);
const rotulo = (o) => ({ bloco: 'b', secao: 's', pai: 'p', cabecalho: 'c', nenhum: 'n', meta: 'm' }[o]);

/* ---------- saída ---------- */
function paginaIndice(fonte, doc, r) {
  const L = [];
  L.push(MARCA, '');
  L.push('# Índice RAG — `' + fonte.rel + '`', '');
  L.push('> Derivado, **nunca é fonte da verdade** (Art. 44): cada linha aponta para `' + fonte.rel + '#âncora`. Em divergência vale a origem.', '');
  if (fonte.modulo) {
    const c = r.cab;
    L.push('- **Selo do cabeçalho:** ' + (c.presente ? 'Conferido' + (c.data ? ' em ' + c.data : '') + (c.hash ? ' (origin/main `' + c.hash + '`)' : '') : '**ausente** — blocos sem selo próprio ficam "Não verificado"'));
    L.push('- **Palavras:** ' + doc.palavras + ' · **blocos:** ' + r.total + ' · **seções com selo próprio:** ' + r.secoesComSelo + ' de ' + r.secoesTotal);
    L.push('- **Origem do selo dos blocos:** próprio ' + r.contagem.bloco + ' · da seção ' + r.contagem.secao + ' · da seção-pai ' + r.contagem.pai + ' · do cabeçalho ' + r.contagem.cabecalho + ' · nenhum (Não verificado) ' + r.contagem.nenhum + ' · meta (numeração, índice, glossário) ' + r.contagem.meta);
    L.push('- **Selo efetivo dos blocos:** Conferido ' + r.efetivo.Conferido + ' · Herdado ' + r.efetivo.Herdado + ' · Não verificado ' + r.efetivo['Não verificado']);
  } else {
    L.push('- **Selo:** não se aplica (' + fonte.rel + ' não é documento de módulo; o Art. 6 vale para `docs/modulos/`).');
    L.push('- **Palavras:** ' + doc.palavras + ' · **blocos:** ' + r.total);
  }
  L.push('', 'Legenda de "Blocos por origem do selo": `b` próprio do bloco · `s` herdado da seção · `p` herdado de seção-pai · `c` herdado do cabeçalho · `n` nenhum (Não verificado) · `m` meta.', '');
  L.push('| Seção | Âncora | Nível | Selo da seção | Blocos | Blocos por origem do selo |');
  L.push('|---|---|---|---|---|---|');
  for (const s of doc.secoes) {
    if (s.nivel <= 1) continue;
    const orig = ['bloco', 'secao', 'pai', 'cabecalho', 'nenhum', 'meta'].filter((o) => s.porOrigem[o]).map((o) => rotulo(o) + s.porOrigem[o]).join(' ');
    const selo = s.meta ? 'meta' : s.seloSecao ? s.seloSecao.selo + ' (' + s.seloSecao.como + ')' : '—';
    L.push('| ' + celula(s.titulo) + ' | `' + fonte.rel + '#' + s.ancora + '` | ' + s.nivel + ' | ' + celula(selo) + ' | ' + s.blocos.length + ' | ' + (orig || '—') + ' |');
  }
  return L.join('\n') + '\n';
}

/* Rotas conhecidas do roteador (src/router.js, KNOWN_ROUTES) — o mesmo array que scripts/gerar-mapa-rotas.js lê.
   Serve para o mapa dizer se a rota citada no documento existe de fato no código. Sem o arquivo: null (coluna "—"). */
function rotasConhecidas(raiz) {
  try {
    const t = normalizar(fs.readFileSync(path.join(raiz, 'src', 'router.js'), 'utf8'));
    const bloco = /KNOWN_ROUTES = \[([\s\S]*?)\];/.exec(t);
    if (!bloco) return null;
    return new Set((bloco[1].match(/'([a-z0-9-]+)'/g) || []).map((x) => x.replace(/'/g, '')));
  } catch (e) { return null; }
}
/* Do tema "Rota e arquivos" tira: o id da rota (``Rota `decisoes` ``) e a URL citada (primeiro `/caminho`), sem as partes
   opcionais entre colchetes nem a query string. */
function rotaDaTela(filho) {
  let id = ''; let url = '';
  if (!filho) return { id, url };
  for (const b of filho.blocos) {
    const t = b.texto;
    if (!id) { const m = /\bRotas?\s+`([a-z0-9-]+)`/.exec(t); if (m) id = m[1]; }
    if (!url) { const m = /`(\/[A-Za-z0-9\-_/.:]+)/.exec(t); if (m) url = m[1].replace(/\/$/, ''); }
    if (id && url) break;
  }
  if (!id && url) { const partes = url.split('/').filter(Boolean); if (partes.length >= 2) id = partes[1]; }
  return { id, url };
}
function mapaDeTelas(analises, conhecidas) {
  const L = [MARCA, '', '# Mapa de telas (módulo → tela → rota)', ''];
  L.push('> Derivado dos títulos `N.k` (ou `S<n>`) e do tema "Rota e arquivos" de cada documento de módulo. "Rota" é o id citado (``Rota `x` ``) ou, na falta, o 2º trecho da primeira URL citada; "URL citada" é a primeira `/caminho` do tema, sem as partes opcionais. "No roteador" confere o id com `KNOWN_ROUTES` de `src/router.js`: **não** quer dizer que a tela está certa, só que a rota existe no código. Vazio = o tema não cita rota. Em divergência vale o documento de origem (e `docs/MAPA_DE_ROTAS.md`, gerado do código).', '');
  L.push('| Documento | Tela | Rota | URL citada | No roteador | Âncora |');
  L.push('|---|---|---|---|---|---|');
  let n = 0; let comRota = 0; let foraDoRoteador = 0;
  for (const { fonte, doc } of analises) {
    if (!fonte.modulo) continue;
    for (const s of doc.secoes) {
      if (s.nivel !== 2 || !/^(\d+\.\d+|S\d+)\s+\S/.test(s.titulo)) continue;
      const filho = doc.secoes.find((x) => x.pai === s.indice && /^[\w.]*\s*Rota e arquivos/.test(x.titulo));
      const { id, url } = rotaDaTela(filho);
      let no = '—';
      if (id && conhecidas) { no = conhecidas.has(id) ? 'sim' : 'não'; if (no === 'não') foraDoRoteador++; }
      if (id) comRota++;
      L.push('| `' + path.posix.basename(fonte.rel) + '` | ' + celula(s.titulo) + ' | ' + (id ? '`' + id + '`' : '') + ' | ' + (url ? '`' + url + '`' : '') + ' | ' + no + ' | `' + fonte.rel + '#' + s.ancora + '` |');
      n++;
    }
  }
  L.splice(2, 0, '**' + n + ' telas; ' + comRota + ' citam rota; ' + foraDoRoteador + ' citam rota que não está em `KNOWN_ROUTES`.**', '');
  return L.join('\n') + '\n';
}

function leiame(fontes) {
  const L = [MARCA, '', '# docs/rag — camada de curadoria do Super RAG', ''];
  L.push('Esta pasta é **gerada** por `node scripts/gerar-rag.js` (`npm run rag`). O conteúdo é derivado: **nunca é fonte da verdade, nunca se edita à mão e não copia o texto** dos documentos. Cada item aponta para o arquivo e a âncora de origem. Em divergência, vale a origem.', '');
  L.push('## O que há aqui', '');
  L.push('- `mapa-de-telas.md` — módulo, tela, rota citada e âncora.');
  L.push('- `indice/<arquivo>.md` — uma página por fonte, com todas as seções (âncora), o selo de cada seção e **de onde veio o selo** de cada bloco.', '');
  L.push('## Fontes lidas (' + fontes.length + ')', '');
  for (const f of fontes) L.push('- `' + f.rel + '`' + (f.modulo ? '' : ' (sem selos: não é documento de módulo)'));
  L.push('', '## Como o selo é decidido (Art. 6)', '');
  L.push('1. **Bloco** (parágrafo, item de lista, tabela ou citação) com `Conferido`, `Herdado` ou `Não verificado` no texto: vale o selo do bloco (se houver mais de um, o mais fraco). Texto entre crases não conta.');
  L.push('2. Sem selo no bloco: herda o da **seção** (`Selo:` explícito, selo no título ou selo único/mais fraco dos blocos dela).');
  L.push('3. Sem selo na seção: herda o de uma **seção-pai**.');
  L.push('4. Sem selo em nenhuma: herda o do **cabeçalho** do documento ("Fonte da verdade: … conferidos em <data> (origin/main <hash>)").');
  L.push('5. Sem nada disso: **Não verificado**. Faltar selo nunca falha o CI.');
  L.push('', 'Seções "Como esta numeração funciona", "Índice" e "Glossário" são **meta** (explicam as regras) e não entram na contagem de selos.');
  return L.join('\n') + '\n';
}

function gerar(raiz) {
  const fontes = listarFontes(raiz);
  const analises = fontes.map((fonte) => {
    const doc = parsear(fs.readFileSync(path.join(raiz, fonte.rel), 'utf8'));
    const r = resolver(doc, fonte.modulo);
    return { fonte, doc, r };
  });
  const arquivos = new Map();
  arquivos.set('LEIAME.md', leiame(fontes));
  arquivos.set('mapa-de-telas.md', mapaDeTelas(analises, rotasConhecidas(raiz)));
  for (const a of analises) arquivos.set(nomeIndice(a.fonte.rel), paginaIndice(a.fonte, a.doc, a.r));
  return { arquivos, analises };
}

/* ---------- escrita e conferência ---------- */
function arquivosExistentes(saida) {
  const achados = new Map();
  const visita = (dir, prefixo) => {
    if (!fs.existsSync(dir)) return;
    for (const nome of fs.readdirSync(dir).sort(cmp)) {
      const abs = path.join(dir, nome);
      const rel = prefixo ? prefixo + '/' + nome : nome;
      if (fs.statSync(abs).isDirectory()) visita(abs, rel);
      else achados.set(rel, normalizar(fs.readFileSync(abs, 'utf8')));
    }
  };
  visita(saida, '');
  return achados;
}
function comparar(saida, arquivos) {
  const atuais = arquivosExistentes(saida);
  const faltam = []; const diferem = []; const sobram = [];
  for (const [rel, conteudo] of arquivos) {
    if (!atuais.has(rel)) faltam.push(rel);
    else if (atuais.get(rel) !== conteudo) diferem.push(rel);
  }
  for (const rel of atuais.keys()) if (!arquivos.has(rel)) sobram.push(rel);
  return { faltam, diferem, sobram, ok: !faltam.length && !diferem.length && !sobram.length };
}
function escrever(saida, arquivos) {
  for (const [rel, conteudo] of arquivos) {
    const abs = path.join(saida, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, conteudo, 'utf8');
  }
  const atuais = arquivosExistentes(saida);
  for (const rel of atuais.keys()) {
    if (!arquivos.has(rel) && atuais.get(rel).startsWith(MARCA)) fs.unlinkSync(path.join(saida, rel)); // só apaga o que este script gerou
  }
}

function resumo(analises) {
  const linhas = ['Documento                       blocos  c/selo próprio  seções c/selo  Conferido  Herdado  NãoVerif'];
  let tb = 0; let tp = 0; let ts = 0; let tt = 0;
  for (const { fonte, r } of analises) {
    if (!fonte.modulo) continue;
    tb += r.total; tp += r.contagem.bloco; ts += r.secoesComSelo; tt += r.secoesTotal;
    linhas.push(path.posix.basename(fonte.rel).padEnd(32) + String(r.total).padStart(6) + String(r.contagem.bloco).padStart(16) + (r.secoesComSelo + '/' + r.secoesTotal).padStart(15) + String(r.efetivo.Conferido).padStart(11) + String(r.efetivo.Herdado).padStart(9) + String(r.efetivo['Não verificado']).padStart(10));
  }
  linhas.push('TOTAL (módulos)'.padEnd(32) + String(tb).padStart(6) + String(tp).padStart(16) + (ts + '/' + tt).padStart(15));
  return linhas.join('\n');
}

function main(argv) {
  const arg = (nome) => { const i = argv.indexOf(nome); return i >= 0 ? argv[i + 1] : null; };
  const raiz = path.resolve(arg('--raiz') || path.join(__dirname, '..'));
  const saida = path.resolve(arg('--saida') || path.join(raiz, 'docs', 'rag'));
  const { arquivos, analises } = gerar(raiz);
  if (argv.includes('--conferir')) {
    const c = comparar(saida, arquivos);
    if (c.ok) { console.log('✅ docs/rag/ idêntico ao que o gerador produz agora (' + arquivos.size + ' arquivos).'); return 0; }
    console.error('❌ docs/rag/ está desatualizado em relação a docs/modulos/, CLAUDE.md ou README.md.');
    if (c.faltam.length) console.error('  faltam: ' + c.faltam.join(', '));
    if (c.diferem.length) console.error('  diferem: ' + c.diferem.join(', '));
    if (c.sobram.length) console.error('  sobram (não são mais gerados): ' + c.sobram.join(', '));
    console.error("Rode 'npm run rag' e commite docs/rag/.");
    return 1;
  }
  escrever(saida, arquivos);
  console.log(resumo(analises));
  console.log('\n' + arquivos.size + ' arquivos em ' + path.relative(process.cwd(), saida).replace(/\\/g, '/'));
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { normalizar, slugBase, criarAncoras, selosDoTexto, parsear, resolver, seloDoCabecalho, gerar, comparar, escrever, listarFontes, MARCA };
