// scripts/rls-matriz.mjs — Matriz de acesso para a issue #571 (autenticação real + RLS fechada).
// Uso: node scripts/rls-matriz.mjs <tabelas.txt> > docs/seguranca/matriz-acesso-rls.md
//   <tabelas.txt> = uma tabela por linha: as do schema public que ainda têm política aberta a anon/public
//   (consulta em pg_policies — ver docs/seguranca/matriz-acesso-rls.md). Só LÊ arquivos do repositório; não toca o banco.
// Mostra, por tabela: quais páginas PÚBLICAS (sem login) a usam, se há Realtime e a onda de fechamento (A/B/C).
import fs from 'node:fs';

const PUBLICAS = ['assinar', 'cotacao', 'cotacao-elevador-fornecedor', 'formulario-cliente', 'diario-obra', 'status-obra', 'termo-entrega', 'vistoria-execucao'];
const tabelas = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

const lerSrc = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
const scriptsDe = (html) => [...lerSrc(html).matchAll(/src="\/(src\/[^"?]+\.jsx?)/g)].map((m) => m[1]);
const usos = (arquivos, re) => new Set(arquivos.flatMap((f) => [...lerSrc(f).matchAll(re)].map((m) => m[1])));

const porPagina = Object.fromEntries(PUBLICAS.map((p) => [p, usos(scriptsDe(`${p}.html`), /\.from\('([a-z_]+)'\)/g)]));
const todos = fs.readdirSync('src').filter((f) => /\.jsx?$/.test(f)).map((f) => `src/${f}`);
const realtime = new Set(todos.filter((f) => /\.channel\(/.test(lerSrc(f))).flatMap((f) => [...lerSrc(f).matchAll(/table:\s*'([a-z_]+)'/g)].map((m) => m[1])));
const internas = usos(todos, /\.from\('([a-z_]+)'\)/g);   // tabelas que o app interno usa pelo navegador

const SENSIVEIS = new Set(['perfis', 'usuarios', 'alcadas_capacidade', 'colaboradores', 'colaboradores_vpsistema', 'convites', 'parametros_fiscais_elevador',
  'custos_containers', 'custos_instalacao_elevador', 'custos_instalacao_escada_esteira', 'difal_estados', 'comissoes', 'regras_comissionamento',
  'emails_projeto', 'vp_logs', 'avais_financeiros', 'avais_juridicos', 'decisoes_gerenciais', 'contract_drafts', 'minutas', 'contratos_sociais',
  'notificacoes_lidas', 'tarefas']);
const ehSensivelPorPrefixo = (t) => /^(importacao_varejo_|omie_|pi_omie|pcp_hh)/.test(t);

const linhas = ['| tabela | páginas públicas | realtime | usada no navegador | onda |', '|---|---|---|---|---|'];
const ondas = { A: [], B: [], C: [] };
for (const t of tabelas) {
  const pubs = PUBLICAS.filter((p) => porPagina[p].has(t));
  const rt = realtime.has(t);
  const onda = (pubs.length || rt) ? 'C' : (SENSIVEIS.has(t) || ehSensivelPorPrefixo(t)) ? 'B' : 'A';
  ondas[onda].push(t);
  linhas.push(`| ${t} | ${pubs.join(', ') || '—'} | ${rt ? 'sim' : '—'} | ${internas.has(t) ? 'sim' : 'não (só servidor/cron)'} | ${onda} |`);
}
console.log('# Matriz de acesso (gerada por scripts/rls-matriz.mjs)\n');
console.log(`Tabelas do schema public ainda abertas a anon/public: **${tabelas.length}**\n`);
console.log(linhas.join('\n'));
for (const [k, v] of Object.entries(ondas)) console.log(`\n**Onda ${k} (${v.length}):** ${v.join(' ')}`);
const soServidor = tabelas.filter((t) => !internas.has(t));
console.log(`\n**Sem uso no navegador (${soServidor.length}) — só Edge Function/cron/banco; podem fechar totalmente para anon sem afetar a tela:** ${soServidor.join(' ')}`);
