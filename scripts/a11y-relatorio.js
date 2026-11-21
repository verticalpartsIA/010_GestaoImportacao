#!/usr/bin/env node
'use strict';
/* Gera src/qualidade-relatorio.json a partir do teste de acessibilidade.

   Uso: npm run a11y:relatorio   (roda e2e/acessibilidade.spec.js em modo aviso e
   junta o resultado de cada tela num arquivo só).

   Por que roda na máquina de quem mexeu e não no CI (spec 2026-11-08, ANALYZE A2):
   a `main` é protegida e o repositório evita credencial no CI, então o CI não
   consegue gravar o arquivo. Ele é commitado junto do PR, como docs/rag. A tela
   do hub (PR 2) mostra "gerado em <data>" para deixar claro o quão fresco está.

   Por que em src/: o servidor só serve src, styles, assets e TreinamentoVP. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const DIR_SAIDA = path.join(RAIZ, 'test-results', 'a11y');
const ARQ_RELATORIO = path.join(RAIZ, 'src', 'qualidade-relatorio.json');

fs.rmSync(DIR_SAIDA, { recursive: true, force: true });

const playwrightCli = path.join(RAIZ, 'node_modules', '@playwright', 'test', 'cli.js');
const rodou = spawnSync(process.execPath, [playwrightCli, 'test', 'e2e/acessibilidade.spec.js', '--reporter=line'], {
  cwd: RAIZ,
  stdio: 'inherit',
  env: { ...process.env, A11Y_MODO: 'aviso', CI: process.env.CI || '1' },
});
if (rodou.status !== 0) {
  console.error('\n[a11y-relatorio] O teste não terminou bem (código ' + rodou.status + '). Relatório NÃO gravado.');
  process.exit(rodou.status || 1);
}

if (!fs.existsSync(DIR_SAIDA)) {
  console.error('[a11y-relatorio] O teste não gerou resultados em ' + DIR_SAIDA + '. Relatório NÃO gravado.');
  process.exit(1);
}
const telas = fs.readdirSync(DIR_SAIDA).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(DIR_SAIDA, f), 'utf8')));
if (!telas.length) {
  console.error('[a11y-relatorio] Nenhuma tela medida. Relatório NÃO gravado.');
  process.exit(1);
}

function git(args) {
  const r = spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}
// O pacote não exporta o próprio package.json, então lê o arquivo direto.
const axeVersao = JSON.parse(fs.readFileSync(
  path.join(RAIZ, 'node_modules', '@axe-core', 'playwright', 'package.json'), 'utf8')).version;
const relatorio = {
  geradoEm: new Date().toISOString(),
  baseCommit: git(['rev-parse', '--short', 'HEAD']),
  ferramenta: '@axe-core/playwright ' + axeVersao,
  regras: 'WCAG 2.2 A/AA (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa); só gravidade crítica e séria',
  limites: [
    'Supabase simulado e vazio: só o estado inicial da tela (sem tabela preenchida, modal aberto ou erro).',
    'O axe cobre só parte do WCAG; teclado, leitor de tela, zoom e celular não são testados.',
    'Só as telas listadas abaixo foram medidas; as demais rotas do hub não.',
  ],
  totalTelas: telas.length,
  totalViolacoes: telas.reduce((s, t) => s + t.violacoes, 0),
  totalNovas: telas.reduce((s, t) => s + t.novas, 0),
  telas: telas.map(({ tela, rotulo, rota, violacoes, novas, achados }) => ({
    tela, rotulo, rota, violacoes, novas,
    achados: achados.map(({ regra, impacto, alvo, conhecida }) => ({ regra, impacto, alvo, conhecida })),
  })),
};
fs.writeFileSync(ARQ_RELATORIO, JSON.stringify(relatorio, null, 2) + '\n');
console.log('\n[a11y-relatorio] ' + relatorio.totalTelas + ' tela(s), ' + relatorio.totalViolacoes
  + ' violação(ões) grave(s), ' + relatorio.totalNovas + ' nova(s). Gravado em src/qualidade-relatorio.json');
