'use strict';
/* npm test — antes rodava um glob (node --test src, com um coringa duplo
   antes do sufixo .test.js), que só funciona porque o Node 24 (usado
   localmente) tem suporte nativo a glob nos argumentos do --test. O
   workflow de CI (.github/workflows/ci.yml) fixa Node 20, que não expande
   esse glob — trata a string como caminho literal e falha com "Could not
   find". Resolve a listagem aqui, com fs.readdirSync puro, pra rodar
   igual em qualquer versão de Node e qualquer shell (bash local, sh do
   runner do GitHub Actions, etc). */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const srcDir = path.join(__dirname, '..', 'src');
const testFiles = fs.readdirSync(srcDir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join('src', f));

if (!testFiles.length) {
  console.error('Nenhum arquivo *.test.js encontrado em src/.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], { stdio: 'inherit' });
process.exit(result.status == null ? 1 : result.status);
