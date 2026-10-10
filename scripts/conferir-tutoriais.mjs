// scripts/conferir-tutoriais.mjs — confere os tutoriais publicados em TreinamentoVP/ (npm run tutoriais:conferir).
// 1) DESATUALIZADO: a tela mudou (último commit dos arquivos dela) DEPOIS da data "Atualizado em" do tutorial → regenerar.
// 2) DADO REAL: o texto do tutorial (público, sem login) tem e-mail fora de @exemplo.com, CNPJ ou CPF → remover antes de publicar.
// 3) LINK QUEBRADO: link "relacionado" para uma pasta de tutorial que ainda não existe (dá 404).
// 4) SEM MENU: tutorial pronto que não está ligado ao "?" (lista TUTORIAIS em src/shell.jsx) — só aviso, não é erro.
// Só LÊ arquivos e o histórico do git. Sai com código 1 se houver problema (serve de trava antes de subir).
// Limites: dia a dia (não horas); não enxerga o texto dentro das imagens (prints) — esses exigem conferência humana;
// arquivos alterados mas ainda não commitados contam como "agora".
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const shell = fs.readFileSync('src/shell.jsx', 'utf8');
const bloco = (shell.match(/const TUTORIAIS = \{([\s\S]*?)\};/) || [])[1] || '';
const noMenu = Object.fromEntries([...bloco.matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[2], m[1]]));   // pasta → rota

// pasta do tutorial → arquivos que compõem a tela (acrescente aqui ao publicar um tutorial novo)
// Chave = caminho do tutorial (pai/tela). Tela sem lista aqui aparece como aviso "desatualização não conferida".
const TELAS = {
  'geral/central-de-decisoes': ['src/decisoes.jsx', 'src/decisoes-store.js'],
  'geral/dashboard': ['src/dashboard.jsx'],
  'geral/notificacoes': ['src/notificacoes-processamento.js', 'src/notificacoes-lidas-store.js'],
  'geral/prazos-e-pendencias': ['src/gatilhos-engine.js'],
  'geral/inbox': ['src/logistica.jsx', 'src/inbox-gmail.jsx', 'src/inbox-triagem.jsx', 'src/inbox-organizar.jsx', 'src/inbox-conversas.jsx', 'src/inbox-decisao.jsx', 'src/inbox-preco.jsx', 'src/inbox-historico.jsx'],
  'crm/leads': ['src/comercial.jsx', 'src/leads-tooltips.js'],
  geral: [],   // visão do módulo: depende dos tutoriais de cada tela
};
const EMAILS_PERMITIDOS = /^(suporte@verticalparts\.com\.br|suporte@vpsistema\.com)$/i;
const meses = { janeiro: 0, fevereiro: 1, 'março': 2, abril: 3, maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11 };
const problemas = [];
const avisos = [];
const git = (cmd) => { try { return execSync(cmd, { encoding: 'utf8' }).trim(); } catch (_) { return ''; } };
const sujos = new Set(git('git status --porcelain').split('\n').map((l) => l.slice(3).trim()).filter(Boolean));

// pasta = caminho relativo a TreinamentoVP: "geral" (visão do módulo) ou "geral/dashboard" (tela do módulo)
const pastas = [];
(function varrer(rel, nivel) {
  const base = rel ? `TreinamentoVP/${rel}` : 'TreinamentoVP';
  for (const d of fs.readdirSync(base, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.') || d.name === 'img' || d.name === 'node_modules') continue;
    const caminho = rel ? `${rel}/${d.name}` : d.name;
    if (fs.existsSync(`TreinamentoVP/${caminho}/index.html`)) pastas.push(caminho);
    if (nivel < 2) varrer(caminho, nivel + 1);
  }
})('', 1);
for (const [pasta, rota] of Object.entries(noMenu)) if (!pastas.includes(pasta)) problemas.push(`${pasta}: a rota "${rota}" do menu "?" aponta para um tutorial que não existe`);

for (const pasta of pastas) {
  const html = fs.readFileSync(`TreinamentoVP/${pasta}/index.html`, 'utf8');
  const texto = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/data:[^"')\s]+/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

  // 1) data do tutorial × última alteração da tela
  const dm = texto.match(/Atualizado em\s+(\d{1,2}) de (\w+) de (\d{4})/i);
  if (!dm) problemas.push(`${pasta}: não achei "Atualizado em dd de mês de aaaa" no tutorial`);
  else if (TELAS[pasta] === undefined) avisos.push(`${pasta}: sem lista de arquivos da tela em TELAS (scripts/conferir-tutoriais.mjs) — desatualização não conferida`);
  else {
    const dataTutorial = new Date(Number(dm[3]), meses[dm[2].toLowerCase()], Number(dm[1]), 23, 59, 59);
    for (const f of TELAS[pasta].filter((x) => fs.existsSync(x))) {
      const iso = git(`git log -1 --format=%cI -- "${f}"`);
      if (sujos.has(f)) problemas.push(`${pasta}: DESATUALIZADO? — ${f} tem alterações ainda não commitadas (tela mudou depois do tutorial de ${dm[1]} de ${dm[2]})`);
      else if (iso && new Date(iso) > dataTutorial) problemas.push(`${pasta}: DESATUALIZADO — ${f} mudou em ${iso.slice(0, 10)}, o tutorial é de ${dm[1]} de ${dm[2]} de ${dm[3]} (regenerar pela sessão de tutoriais; não editar à mão)`);
    }
  }

  // 2) dado real no texto público
  const emails = [...new Set((texto.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []))].filter((e) => !/@exemplo\.com$/i.test(e) && !EMAILS_PERMITIDOS.test(e));
  if (emails.length) problemas.push(`${pasta}: DADO REAL? e-mail(s) fora de @exemplo.com no texto: ${emails.slice(0, 5).join(', ')}`);
  const docs = [...new Set((texto.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g) || []))];
  if (docs.length) problemas.push(`${pasta}: DADO REAL? CNPJ/CPF no texto: ${docs.slice(0, 5).join(', ')}`);

  // 3) links relacionados para tutoriais que não existem
  const alvos = [...new Set([...html.matchAll(/href="(\.\.?\/[^"#?]*)"/g)].map((m) => m[1]))];
  for (const h of alvos) {
    const dir = path.posix.normalize(path.posix.join(pasta, h.replace(/index\.html$/, '')));
    if (!fs.existsSync(`TreinamentoVP/${dir}/index.html`)) problemas.push(`${pasta}: link "${h}" aponta para um tutorial que ainda não existe (404 até ser publicado)`);
  }

  // 4) pronto mas fora do menu (visão do módulo não tem linha em TUTORIAIS: é ligada em MODULOS_TUTORIAL)
  if (pasta.includes('/') && !noMenu[pasta]) avisos.push(`${pasta}: tutorial pronto, ainda não ligado ao menu "?" (falta 1 linha em TUTORIAIS no src/shell.jsx)`);
}

console.log(`Tutoriais encontrados: ${pastas.length} (${pastas.join(', ')}) · ligados ao menu "?": ${Object.keys(noMenu).length}`);
if (avisos.length) console.log(`\nAvisos (não bloqueiam):\n- ` + avisos.join('\n- '));
if (!problemas.length) console.log('\nTudo certo: nenhum tutorial desatualizado, com dado real no texto ou com link quebrado.');
else { console.log(`\n${problemas.length} ponto(s) de atenção:\n- ` + problemas.join('\n- ')); process.exitCode = 1; }
