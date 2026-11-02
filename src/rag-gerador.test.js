'use strict';
/* scripts/gerar-rag.js — gerador de docs/rag/ (camada de curadoria do Super RAG).
   Regra de negócio testada: âncoras iguais às do GitHub, blocos, selo (bloco → seção → seção-pai → cabeçalho),
   resultado idêntico com CRLF e LF (o CI roda no Linux, o Gelson no Windows) e a conferência "RAG em dia". */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const G = require('../scripts/gerar-rag.js');

const modulo = (corpo) => [
  '# 9 Teste — documento do módulo',
  '',
  '> **Fonte da verdade:** o código e o banco, conferidos em 31/10/2026 (`origin/main` `abc1234`). **Conferido** quer dizer lido no código.',
  '',
  '## Como esta numeração funciona',
  '- Sem selo, vale como Não verificado.',
  '',
  corpo,
].join('\n');

function repo(arquivos) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-teste-'));
  for (const [rel, conteudo] of Object.entries(arquivos)) {
    fs.mkdirSync(path.dirname(path.join(raiz, rel)), { recursive: true });
    fs.writeFileSync(path.join(raiz, rel), conteudo, 'utf8');
  }
  return raiz;
}
function analisar(texto, ehModulo = true) {
  const doc = G.parsear(texto);
  const r = G.resolver(doc, ehModulo);
  return { doc, r };
}
const blocosDe = (doc, titulo) => doc.secoes.find((s) => s.titulo === titulo).blocos;

test('âncora segue a regra do GitHub: minúsculas, sem pontuação nem emoji, repetidas ganham -1, -2', () => {
  assert.equal(G.slugBase('S2.5 Regras e janelas'), 's25-regras-e-janelas');
  assert.equal(G.slugBase('1.3 Central de Decisões 🔒'), '13-central-de-decisões-');
  assert.equal(G.slugBase('Prazos & Pendências'), 'prazos--pendências');
  const gerar = G.criarAncoras();
  assert.deepEqual([gerar('Índice'), gerar('Índice'), gerar('Índice')], ['índice', 'índice-1', 'índice-2']);
});

test('título dentro de citação ("> ## T") e título em HTML (<h1>) viram seção, como no GitHub; repetido ganha -1', () => {
  const doc = G.parsear(['<h1 align="center">VP Gestão</h1>', '', '> ## 🔒 Área blindada', '> - regra', '', '## Área blindada', '## Área blindada'].join('\n'));
  assert.deepEqual(doc.secoes.map((s) => s.nivel), [1, 2, 2, 2]);
  assert.deepEqual(doc.secoes.map((s) => s.ancora), ['vp-gestão', '-área-blindada', 'área-blindada', 'área-blindada-1']);
});

test('linha horizontal (---) separa blocos e não conta como bloco', () => {
  const doc = G.parsear(['## T', 'primeiro', '', '---', '', '***', 'segundo', '- item', '---', '| a |', '|---|', '| 1 |'].join('\n'));
  assert.deepEqual(doc.secoes[0].blocos.map((b) => b.tipo), ['paragrafo', 'paragrafo', 'item', 'tabela']);
});

test('item de lista com continuação e subitem é um bloco só; tabela e parágrafos são blocos à parte; código é ignorado', () => {
  const { doc } = analisar(modulo([
    '## 9.1 Tela',
    '### 9.1.1 O que é',
    'Primeiro parágrafo.',
    '',
    'Segundo parágrafo.',
    '- item um',
    '  continuação do item um',
    '  - subitem',
    '- item dois',
    '',
    '| a | b |',
    '|---|---|',
    '| 1 | 2 |',
    '',
    '```js',
    '// Conferido dentro de código não conta',
    '```',
  ].join('\n')));
  const b = blocosDe(doc, '9.1.1 O que é');
  assert.deepEqual(b.map((x) => x.tipo), ['paragrafo', 'paragrafo', 'item', 'item', 'tabela']);
  assert.match(b[2].texto, /subitem/);
  assert.equal(b.some((x) => /dentro de código/.test(x.texto)), false);
});

test('selo do bloco vale o do bloco; texto entre crases não conta; vários no mesmo bloco valem o mais fraco', () => {
  assert.deepEqual(G.selosDoTexto('Lido no código. **Conferido** (31/10/2026).'), ['Conferido']);
  assert.deepEqual(G.selosDoTexto('o valor `Conferido` é literal'), []);
  const { doc } = analisar(modulo(['## 9.1 Tela', '### 9.1.1 A', '- X **Conferido** e Y **Herdado**'].join('\n')));
  const b = blocosDe(doc, '9.1.1 A')[0];
  assert.equal(b.selo, 'Herdado');
  assert.equal(b.origem, 'bloco');
});

test('bloco sem selo herda o da seção; a seção usa o selo único dos blocos dela (uniforme) ou o mais fraco (misto)', () => {
  const { doc, r } = analisar(modulo([
    '## 9.1 Tela',
    '### 9.1.1 Uniforme',
    '- a **Conferido**',
    '- b sem selo',
    '### 9.1.2 Misto',
    '- a **Conferido**',
    '- b **Não verificado**',
    '- c sem selo',
  ].join('\n')));
  const u = blocosDe(doc, '9.1.1 Uniforme');
  assert.deepEqual([u[0].origem, u[1].origem, u[1].selo], ['bloco', 'secao', 'Conferido']);
  const m = blocosDe(doc, '9.1.2 Misto');
  assert.deepEqual([m[2].origem, m[2].selo], ['secao', 'Não verificado']);
  assert.equal(doc.secoes.find((s) => s.titulo === '9.1.2 Misto').seloSecao.como, 'misto (vale o mais fraco)');
  assert.ok(r.total >= 5);
});

test('selo explícito "Selo:" da seção vale para os blocos sem selo, mesmo havendo outros selos nos blocos', () => {
  const { doc } = analisar(modulo(['## 9.1 Tela', '### 9.1.1 A', '- a **Conferido**', '- b sem selo', '- **Selo:** Herdado 01/11/2026.'].join('\n')));
  const b = blocosDe(doc, '9.1.1 A');
  assert.equal(b[1].selo, 'Herdado');
  assert.equal(b[1].origem, 'secao');
});

test('sem selo na seção herda de uma seção-pai; sem selo em nenhuma herda do cabeçalho; só vira Não verificado sem cabeçalho', () => {
  const corpo = ['## 9.1 Tela', '- pai **Herdado**', '### 9.1.1 Filha', '- sem selo', '## 9.2 Outra', '- sem selo nenhum'].join('\n');
  const com = analisar(modulo(corpo));
  assert.deepEqual([blocosDe(com.doc, '9.1.1 Filha')[0].origem, blocosDe(com.doc, '9.1.1 Filha')[0].selo], ['pai', 'Herdado']);
  assert.deepEqual([blocosDe(com.doc, '9.2 Outra')[0].origem, blocosDe(com.doc, '9.2 Outra')[0].selo], ['cabecalho', 'Conferido']);
  assert.equal(com.r.cab.data, '31/10/2026');
  assert.equal(com.r.cab.hash, 'abc1234');
  const semCab = analisar(modulo(corpo).replace('Fonte da verdade', 'Origem'));
  assert.equal(semCab.r.cab.presente, false);
  assert.deepEqual([blocosDe(semCab.doc, '9.2 Outra')[0].origem, blocosDe(semCab.doc, '9.2 Outra')[0].selo], ['nenhum', 'Não verificado']);
});

test('cabeçalho aceita a grafia "Fonte da verdade e selos:" do 15_servicos, sem a frase "conferidos em"', () => {
  const t = ['# 15 Serviços', '', '> **Fonte da verdade e selos:** o código e o repositório em `origin/main` `ae64ebf`, tudo em **01/11/2026**.', '', '## S1 Algo', '- sem selo'].join('\n');
  const { r } = analisar(t);
  assert.deepEqual([r.cab.presente, r.cab.data, r.cab.hash], [true, '01/11/2026', 'ae64ebf']);
});

test('seções de numeração, índice e glossário e o cabeçalho são meta: não entram na contagem de selos', () => {
  const { doc, r } = analisar(modulo('## 9.1 Tela\n- a **Conferido**'));
  assert.equal(doc.secoes.find((s) => s.titulo === 'Como esta numeração funciona').blocos[0].origem, 'meta');
  assert.ok(r.contagem.meta >= 2);
  assert.equal(r.contagem.bloco, 1);
});

test('documento que não é de módulo (CLAUDE.md, README.md) não recebe selo', () => {
  const { doc } = analisar('# T\n## Seção\n- texto Conferido', false);
  assert.equal(doc.secoes[1].blocos[0].selo, 'n/a');
});

test('o mesmo repositório com CRLF e com LF gera arquivos idênticos', () => {
  const corpo = modulo(['## 9.1 Tela', '### 9.1.2 Rota e arquivos', '- Rota `tela-x` → `/modulo/tela-x[/<aba>]`. **Conferido**.', '### 9.1.1 A', '- a'].join('\n'));
  const lf = repo({ 'docs/modulos/09_t.md': corpo, 'CLAUDE.md': '# C\n## S\ntexto\n', 'README.md': '# R\n' });
  const crlf = repo({ 'docs/modulos/09_t.md': corpo.replace(/\n/g, '\r\n'), 'CLAUDE.md': '# C\r\n## S\r\ntexto\r\n', 'README.md': '# R\r\n' });
  const a = G.gerar(lf).arquivos;
  const b = G.gerar(crlf).arquivos;
  assert.deepEqual(Array.from(a.keys()), Array.from(b.keys()));
  for (const [k, v] of a) assert.equal(b.get(k), v, k);
  for (const v of a.values()) assert.equal(v.includes('\r'), false);
});

test('mapa de telas tira id e URL da rota, ignora partes opcionais e confere com KNOWN_ROUTES do roteador', () => {
  const doc = modulo(['## 9.1 Tela X', '### 9.1.2 Rota e arquivos', '- Rota `tela-x` → `/modulo/tela-x[/<aba>[/<id>]][?q=<v>]`.', '## 9.2 Tela Y', '### 9.2.2 Rota e arquivos', '- Rota `inexistente` → `/modulo/inexistente`.'].join('\n'));
  const raiz = repo({ 'docs/modulos/09_t.md': doc, 'src/router.js': "const KNOWN_ROUTES = [\n 'tela-x', 'outra',\n];\n" });
  const mapa = G.gerar(raiz).arquivos.get('mapa-de-telas.md');
  assert.match(mapa, /\| `tela-x` \| `\/modulo\/tela-x` \| sim \|/);
  assert.match(mapa, /\| `inexistente` \| `\/modulo\/inexistente` \| não \|/);
  assert.match(mapa, /2 telas; 2 citam rota; 1 citam rota que não está/);
});

test('--conferir: igual passa; arquivo alterado, faltando ou sobrando falha; CRLF no disco não conta como diferença', () => {
  const raiz = repo({ 'docs/modulos/09_t.md': modulo('## 9.1 Tela\n- a **Conferido**'), 'CLAUDE.md': '# C\n', 'README.md': '# R\n' });
  const saida = path.join(raiz, 'docs', 'rag');
  const { arquivos } = G.gerar(raiz);
  assert.equal(G.comparar(saida, arquivos).ok, false); // nada gerado ainda: faltam
  G.escrever(saida, arquivos);
  assert.equal(G.comparar(saida, arquivos).ok, true);
  const alvo = path.join(saida, 'indice', '09_t.md');
  fs.writeFileSync(alvo, fs.readFileSync(alvo, 'utf8').replace(/\n/g, '\r\n'), 'utf8');
  assert.equal(G.comparar(saida, arquivos).ok, true); // só terminação de linha
  fs.appendFileSync(alvo, 'editado à mão\n');
  assert.deepEqual(G.comparar(saida, arquivos).diferem, ['indice/09_t.md']);
  fs.writeFileSync(path.join(saida, 'indice', 'velho.md'), 'x');
  assert.deepEqual(G.comparar(saida, arquivos).sobram, ['indice/velho.md']);
});

test('escrever só apaga o que o próprio gerador criou (tem a marca GERADO)', () => {
  const raiz = repo({ 'docs/modulos/09_t.md': modulo('## 9.1 Tela\n- a'), 'CLAUDE.md': '# C\n', 'README.md': '# R\n' });
  const saida = path.join(raiz, 'docs', 'rag');
  fs.mkdirSync(path.join(saida, 'indice'), { recursive: true });
  fs.writeFileSync(path.join(saida, 'indice', 'antigo-gerado.md'), G.MARCA + '\nvelho\n');
  fs.writeFileSync(path.join(saida, 'indice', 'nota-do-gelson.md'), 'escrito à mão\n');
  G.escrever(saida, G.gerar(raiz).arquivos);
  assert.equal(fs.existsSync(path.join(saida, 'indice', 'antigo-gerado.md')), false);
  assert.equal(fs.existsSync(path.join(saida, 'indice', 'nota-do-gelson.md')), true);
});

test('repositório real: as 17 fontes são lidas, a âncora de cada seção é única e todo módulo tem selo de cabeçalho', () => {
  const raiz = path.join(__dirname, '..');
  const { arquivos, analises } = G.gerar(raiz);
  const modulos = analises.filter((a) => a.fonte.modulo);
  assert.ok(modulos.length >= 15, 'esperava 15 documentos de módulo, achei ' + modulos.length);
  assert.ok(arquivos.has('indice/CLAUDE.md') && arquivos.has('indice/README.md'));
  for (const { fonte, doc } of analises) {
    const ancoras = doc.secoes.map((s) => s.ancora);
    assert.equal(new Set(ancoras).size, ancoras.length, 'âncora repetida em ' + fonte.rel);
  }
  for (const { fonte, r } of modulos) assert.equal(r.cab.presente, true, 'sem "Fonte da verdade" no cabeçalho de ' + fonte.rel);
});
