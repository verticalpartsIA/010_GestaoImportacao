'use strict';
/* scripts/check-docs-em-dia.js — mudou arquivo de um módulo, o documento do módulo muda junto (Arts. 42 e 46).
   Testa o mapa arquivo → documento (lido dos próprios documentos), a regra, o escape "Docs: não se aplica — …"
   e a leitura do Git num repositório de mentira. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const C = require('../scripts/check-docs-em-dia.js');

const DOC_A = [
  '# 1 Geral', '',
  '## 1.1 Tela A',
  '### 1.1.2 Rota e arquivos',
  '- Tela: `src/tela-a.jsx`; regras em `tela-a-calc.js`. Função: `supabase/functions/avisa`.',
  '### 1.1.8 Regras e armadilhas',
  '- Usa o `util.js` só de passagem.',
].join('\n');
const DOC_B = ['# 2 CRM', '', '## 2.1 Tela B', '### 2.1.2 Rota e arquivos', '- Tela: `src/tela-b.jsx` e também `src/tela-a.jsx`.'].join('\n');
const SRC = ['tela-a.jsx', 'tela-a-calc.js', 'tela-b.jsx', 'util.js', 'solto.js'];
const FN = ['avisa', 'outra'];

test('dono primário vem do tema "Rota e arquivos"; citação em outro tema vira dono provável; função pela pasta', () => {
  const m = C.mapear({ 'docs/modulos/01_a.md': DOC_A, 'docs/modulos/02_b.md': DOC_B }, SRC, FN);
  assert.deepEqual([...m.primarios.get('src/tela-a.jsx')].sort(), ['docs/modulos/01_a.md', 'docs/modulos/02_b.md']);
  assert.deepEqual([...m.primarios.get('src/tela-a-calc.js')], ['docs/modulos/01_a.md']);
  assert.equal(m.primarios.has('src/util.js'), false);
  assert.deepEqual([...m.provaveis.get('src/util.js')], ['docs/modulos/01_a.md']);
  assert.deepEqual([...m.primarios.get('supabase/functions/avisa')], ['docs/modulos/01_a.md']);
  assert.equal(m.provaveis.has('src/solto.js'), false);
});

const mapas = () => {
  const m = C.mapear({ 'docs/modulos/01_a.md': DOC_A, 'docs/modulos/02_b.md': DOC_B }, SRC, FN);
  return { mapaBase: m, mapaHead: m };
};
const mud = (arquivo, status = 'M') => ({ status, arquivo });

test('arquivo do módulo alterado sem o documento é violação; com o documento dono, passa', () => {
  const ctx = mapas();
  const sem = C.avaliar({ ...ctx, mudancas: [mud('src/tela-a-calc.js')], docsMudados: new Set() });
  assert.deepEqual(sem.violacoes.map((v) => [v.unidade, v.donos]), [['src/tela-a-calc.js', ['docs/modulos/01_a.md']]]);
  const com = C.avaliar({ ...ctx, mudancas: [mud('src/tela-a-calc.js')], docsMudados: new Set(['docs/modulos/01_a.md']) });
  assert.equal(com.violacoes.length, 0);
});

test('arquivo com mais de um dono: basta um dos documentos ter mudado', () => {
  const ctx = mapas();
  const r = C.avaliar({ ...ctx, mudancas: [mud('src/tela-a.jsx')], docsMudados: new Set(['docs/modulos/02_b.md']) });
  assert.equal(r.violacoes.length, 0);
});

test('só dono provável (citação de passagem) apenas avisa; arquivo antigo sem dono é aviso; arquivo novo sem dono é violação', () => {
  const ctx = mapas();
  const prov = C.avaliar({ ...ctx, mudancas: [mud('src/util.js')], docsMudados: new Set() });
  assert.deepEqual([prov.violacoes.length, prov.provaveis.map((p) => p.unidade)], [0, ['src/util.js']]);
  assert.equal(C.avaliar({ ...ctx, mudancas: [mud('src/util.js')], docsMudados: new Set(['docs/modulos/01_a.md']) }).provaveis.length, 0);
  const antigo = C.avaliar({ ...ctx, mudancas: [mud('src/solto.js')], docsMudados: new Set() });
  assert.deepEqual([antigo.violacoes.length, antigo.semDono], [0, ['src/solto.js']]);
  const novo = C.avaliar({ ...ctx, mudancas: [mud('src/solto.js', 'A')], docsMudados: new Set() });
  assert.match(novo.violacoes[0].motivo, /arquivo novo/);
});

test('teste, bundle, página, migration e documento não contam como arquivo de módulo; Edge Function conta pela pasta', () => {
  const ctx = mapas();
  const ignorados = ['src/tela-a.test.js', 'src/x.bundle.js', 'index.html', 'supabase/migrations/1.sql', 'docs/modulos/01_a.md', 'src/sub/dentro.js'].map((a) => mud(a));
  assert.equal(C.avaliar({ ...ctx, mudancas: ignorados, docsMudados: new Set() }).violacoes.length, 0);
  const fn = C.avaliar({ ...ctx, mudancas: [mud('supabase/functions/avisa/index.ts'), mud('supabase/functions/avisa/util.ts')], docsMudados: new Set() });
  assert.deepEqual(fn.violacoes.map((v) => v.unidade), ['supabase/functions/avisa']);
});

test('o escape exige o motivo: "Docs: não se aplica — texto"', () => {
  assert.equal(C.TRAILER.exec('fix\n\nDocs: não se aplica — só renomeei uma variável\n')[1], 'só renomeei uma variável');
  assert.equal(C.TRAILER.exec('Docs: nao se aplica - formatação do arquivo inteiro')[1], 'formatação do arquivo inteiro');
  assert.equal(C.TRAILER.test('Docs: não se aplica —'), false);
  assert.equal(C.TRAILER.test('Docs: não se aplica — curto'), false);
});

/* ---- repositório de mentira ---- */
function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-em-dia-'));
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8' });
  const grava = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), txt); };
  git('init', '-q', '-b', 'main');
  grava('docs/modulos/01_a.md', DOC_A);
  grava('src/tela-a.jsx', 'a');
  grava('src/tela-a-calc.js', 'a');
  git('add', '-A'); git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD').trim();
  return { dir, git, grava, base };
}

test('no Git: alterar o arquivo sem o documento é violação; com o documento ou com o escape, passa', () => {
  const r = repo();
  r.grava('src/tela-a-calc.js', 'b'); r.git('commit', '-qam', 'muda código');
  const sem = C.conferir({ base: r.base, cwd: r.dir });
  assert.deepEqual(sem.violacoes.map((v) => v.unidade), ['src/tela-a-calc.js']);
  assert.equal(sem.liberado, null);

  r.grava('docs/modulos/01_a.md', DOC_A + '\n- atualizado'); r.git('commit', '-qam', 'e o documento');
  assert.equal(C.conferir({ base: r.base, cwd: r.dir }).violacoes.length, 0);
});

test('no Git: o escape num dos commits libera o conjunto e fica registrado', () => {
  const r = repo();
  r.grava('src/tela-a-calc.js', 'b');
  r.git('commit', '-qam', 'ajuste\n\nDocs: não se aplica — formatação, sem mudar comportamento');
  const res = C.conferir({ base: r.base, cwd: r.dir });
  assert.equal(res.violacoes.length, 1);
  assert.equal(res.liberado, 'formatação, sem mudar comportamento');
});

test('no Git: arquivo novo citado no documento do HEAD passa; arquivo novo que ninguém cita não passa', () => {
  const r = repo();
  r.grava('src/nova.jsx', 'x'); r.grava('docs/modulos/01_a.md', DOC_A + '\n- Nova tela em `src/nova.jsx`.');
  r.git('add', '-A'); r.git('commit', '-qm', 'tela nova com documento');
  assert.equal(C.conferir({ base: r.base, cwd: r.dir }).violacoes.length, 0);
  r.grava('src/orfa.jsx', 'x'); r.git('add', '-A'); r.git('commit', '-qm', 'tela sem documento');
  assert.deepEqual(C.conferir({ base: r.base, cwd: r.dir }).violacoes.map((v) => v.unidade), ['src/orfa.jsx']);
});
