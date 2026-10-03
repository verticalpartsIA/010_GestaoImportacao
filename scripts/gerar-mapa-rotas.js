'use strict';
/* Gera docs/MAPA_DE_ROTAS.md a partir do código — nada é escrito à mão, então o
   mapa não envelhece: rode de novo quando mexer em rotas, menu ou abas.

     node scripts/gerar-mapa-rotas.js

   Fontes: src/router.js (rotas + slug de módulo), src/shell.jsx (menu e
   breadcrumb), src/app.jsx (rota → componente e deep link por id) e os .jsx
   (abas via window.useRouteTab e chamadas setRoute). Só LÊ o código. */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const OUT = path.join(__dirname, '..', 'docs', 'MAPA_DE_ROTAS.md');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

const router = read('router.js');
const shell = read('shell.jsx');
const app = read('app.jsx');

/* ---- rotas e slug de módulo ---- */
const known = router.match(/KNOWN_ROUTES = \[([\s\S]*?)\];/)[1].match(/'([a-z0-9-]+)'/g).map((s) => s.replace(/'/g, ''));
const knownSet = new Set(known);
const moduleSlug = {};
for (const m of router.match(/MODULE_SLUG = \{([\s\S]*?)\};/)[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) moduleSlug[m[1]] = m[2];

/* ---- breadcrumb (módulo do breadcrumb + nome da página) ---- */
const bc = {};
const bcBlock = shell.match(/const BREADCRUMB_MAP = \{([\s\S]*?)\n\};/)[1];
for (const m of bcBlock.matchAll(/["']?([a-z0-9-]+)["']?\s*:\s*\{\s*module:\s*"([^"]+)",\s*page:\s*"([^"]+)"/g)) bc[m[1]] = { module: m[2], page: m[3] };
const urlBase = (route) => '/' + ((bc[route] && moduleSlug[bc[route].module]) || 'geral') + '/' + route;

/* ---- menu lateral ---- */
const navBlock = shell.slice(shell.indexOf('const NAV_GROUPS = ['));
const navEnd = navBlock.indexOf('\n];');
const groups = [];
for (const ln of navBlock.slice(0, navEnd).split('\n')) {
  const g = ln.match(/^\s*\{\s*label:\s*"([^"]+)",\s*items:\s*\[/);
  if (g) { groups.push({ label: g[1], items: [] }); continue; }
  const it = ln.match(/\{\s*id:\s*"([a-z0-9-]+)",\s*label:\s*"([^"]+)"/);
  if (it && groups.length) groups[groups.length - 1].items.push({ id: it[1], label: it[2] });
}
const inMenu = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));

/* ---- app.jsx: rota → componente e deep link por id ---- */
const route2comp = {};
for (const m of app.matchAll(/case "([a-z0-9-]+)":\s*return\s*<\s*(?:window\.)?([A-Za-z0-9_]+)/g)) route2comp[m[1]] = m[2];
const csv = (s) => (s.match(/"([^"]+)"/g) || []).map((x) => x.replace(/"/g, ''));
const passthrough = new Set(csv(app.match(/SYNC_PASSTHROUGH_ROUTES = new Set\(\[([^\]]*)\]/)[1]));
const wrapped = new Set(Object.keys(JSON.parse(app.match(/WRAPPED_ID_KEY = (\{[^}]*\})/)[1])));
const asyncFetch = new Set([...app.match(/ASYNC_FETCH_ROUTES = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s{2}"([a-z0-9-]+)":/gm)].map((m) => m[1]));
const fallback = {};
for (const m of app.match(/SUBSEL_FALLBACK_ROUTE = \{([\s\S]*?)\};/)[1].matchAll(/"([a-z0-9-]+)":\s*"([a-z0-9-]+)"/g)) fallback[m[1]] = m[2];
const idMode = (r) => (passthrough.has(r) ? 'id na URL (passthrough)' : wrapped.has(r) ? 'id na URL (envelope)' : asyncFetch.has(r) ? 'id na URL (busca no banco)' : '—');

/* ---- arquivos .jsx: componente → arquivo, abas e navegação ---- */
const jsxFiles = fs.readdirSync(SRC).filter((f) => /\.jsx$/.test(f));
const comp2file = {};
for (const f of jsxFiles) {
  const t = read(f);
  for (const m of t.matchAll(/^(?:async\s+)?function\s+([A-Z][A-Za-z0-9_]+)/gm)) comp2file[m[1]] = comp2file[m[1]] || f;
  for (const m of t.matchAll(/window\.([A-Z][A-Za-z0-9_]+)\s*=\s*[A-Za-z0-9_]+/g)) comp2file[m[1]] = comp2file[m[1]] || f;
}
const file2routes = {};
for (const [r, c] of Object.entries(route2comp)) { const f = comp2file[c]; if (f) (file2routes[f] = file2routes[f] || []).push(r); }
const comp2routes = {};
for (const [r, c] of Object.entries(route2comp)) (comp2routes[c] = comp2routes[c] || []).push(r);

const tabs = {};   // rota → { padrao, abas[], comId }
const navCalls = [];
for (const f of jsxFiles) {
  const lines = read(f).split('\n');
  const fnAt = (idx) => { for (let i = idx; i >= 0; i--) { const m = lines[i].match(/^(?:async\s+)?function\s+([A-Za-z0-9_]+)|^(?:const|let)\s+([A-Z][A-Za-z0-9_]+)\s*=\s*(?:\(|function|React\.memo|async)/); if (m) return m[1] || m[2]; } return '?'; };
  lines.forEach((ln, i) => {
    const t = ln.match(/useRouteTab\(\s*'([a-z0-9-]+)',\s*['"]([^'"]+)['"],\s*\[([^\]]*)\](,\s*true)?/);
    if (t) tabs[t[1]] = { padrao: t[2], abas: (t[3].match(/'([^']+)'|"([^"]+)"/g) || []).map((x) => x.replace(/['"]/g, '')), comId: !!t[4], arquivo: f };
    for (const m of ln.matchAll(/\bsetRoute\(\s*["'`]([a-z0-9-]+)["'`]\s*\)/g)) {
      /* O rótulo costuma vir nas linhas SEGUINTES (filhos do <Button>), às vezes
         depois de várias linhas de onClick. Anda até 8 linhas pra frente e para
         se achar outro onClick/setRoute (aí já é outro botão). */
      /* Conservador: só aceita o texto se a chamada está DENTRO de uma tag
         <Button|button|a> (aberta na própria linha ou até 2 acima) e o texto
         aparece em até 4 linhas depois. Melhor “sem rótulo” do que rótulo errado. */
      const abre = [lines[i - 2] || '', lines[i - 1] || '', ln].join(' ');
      let lab = null;
      if (/<(?:Button|button|a)\b/.test(abre)) {
        for (let k = 0; k <= 4 && !lab; k++) {
          const cand = lines[i + k];
          if (cand === undefined || (k > 0 && /onClick|setRoute\(/.test(cand))) break;
          lab = cand.match(/>\s*([A-Za-zÀ-ú0-9][^<>{}\n]{1,44}?)\s*<\/(?:Button|button|a)>/);
        }
        if (lab && /^(carregando|…)/i.test(lab[1])) lab = null;
      }
      const fn = fnAt(i);
      const origem = comp2routes[fn] ? comp2routes[fn].join(', ') : `(${fn} em ${f})`;
      navCalls.push({ origem, botao: lab ? lab[1].replace(/\s+/g, ' ') : '(acionado por um handler — ver o código)', alvo: m[1], onde: `${f}:${i + 1}` });
    }
  });
}

/* ---- estados de aba/visão que AINDA não estão na URL ---- */
const semUrl = [];
const rx = /const \[(aba|tab|activeTab|abaAtiva|view|modo|mode|section|secao|step|passo|subtab|subTab|tela|visao|painel|categoria|etapa)(?:[A-Z]\w*)?,\s*set\w+\]\s*=\s*(?:React\.)?_?\w*[Ss]tate\(([^)]*)\)/;
for (const f of jsxFiles) {
  const lines = read(f).split('\n');
  lines.forEach((ln, i) => {
    const m = ln.match(rx); if (!m) return;
    let fn = '?'; for (let k = i; k >= 0; k--) { const mm = lines[k].match(/^(?:async\s+)?function\s+([A-Za-z0-9_]+)/); if (mm) { fn = mm[1]; break; } }
    semUrl.push({ onde: `${f}:${i + 1}`, comp: fn, estado: ln.trim().match(/const \[(\w+)/)[1], inicial: (m[2] || '').trim().slice(0, 30), rotas: comp2routes[fn] || file2routes[f] || [] });
  });
}

/* ---- verificações de consistência ---- */
const casos = Object.keys(route2comp);
const problemas = [];
for (const r of casos) if (!knownSet.has(r)) problemas.push(`\`${r}\` tem \`case\` no app.jsx mas **não está em KNOWN_ROUTES** (a URL vira \`/\`).`);
for (const r of known) if (!route2comp[r]) problemas.push(`\`${r}\` está em KNOWN_ROUTES mas **não tem \`case\` no app.jsx**.`);
for (const g of groups) for (const i of g.items) if (!knownSet.has(i.id)) problemas.push(`Menu "${g.label} › ${i.label}" usa o id \`${i.id}\`, que **não está em KNOWN_ROUTES**.`);
for (const n of navCalls) if (!knownSet.has(n.alvo)) problemas.push(`\`setRoute('${n.alvo}')\` em ${n.onde} aponta para rota **inexistente**.`);
const nomes = {}; for (const g of groups) for (const i of g.items) (nomes[i.label] = nomes[i.label] || []).push(`${g.label} › ${i.id}`);
for (const [l, v] of Object.entries(nomes)) if (v.length > 1) problemas.push(`Rótulo de menu duplicado "${l}": ${v.join(' | ')}.`);

/* ---- saída ---- */
const L = [];
const esc = (s) => String(s).replace(/\|/g, '\\|');
L.push('# Mapa de rotas, módulos e botões — VP Gestão');
L.push('');
L.push('> **Gerado automaticamente** por `node scripts/gerar-mapa-rotas.js` a partir do código. Não edite à mão: rode o script de novo depois de mexer em rotas, menu ou abas.');
L.push('');
L.push('## Convenção de endereço');
L.push('');
L.push('```');
L.push('/<módulo>/<rota>                 tela              ex.: /logistica/pcp');
L.push('/<módulo>/<rota>/<aba>           tela com abas     ex.: /logistica/pcp/fila');
L.push('/<módulo>/<rota>/<id>            detalhe           ex.: /comercial/cotacao-fornecedor-detail/<uuid>');
L.push('/<módulo>/<rota>/<id>/<aba>      detalhe com abas  ex.: /comercial/formulario-quadro-comando/<uuid>/cabina');
L.push('```');
L.push('');
L.push('- O 1º segmento (**módulo**) vem do `BREADCRUMB_MAP` do `shell.jsx` via `MODULE_SLUG` do `router.js`; só o 2º segmento (a rota) decide o que abre.');
L.push('- A **aba padrão** deixa a URL limpa (sem o último segmento). Aba inválida na URL cai na padrão.');
L.push('- Abas entram na URL com `window.useRouteTab(rota, padrão, [válidas], comId?)` (em `router.js`).');
L.push(`- Rotas no roteador: **${known.length}** · itens de menu: **${inMenu.size}** · telas com abas na URL: **${Object.keys(tabs).length}**.`);
L.push('');
L.push('## Verificações automáticas');
L.push('');
if (problemas.length) problemas.forEach((p) => L.push(`- ⚠️ ${p}`)); else L.push('- ✅ Nenhuma inconsistência: todo `case` está em `KNOWN_ROUTES`, todo item de menu tem rota, todo `setRoute` literal aponta para rota existente e não há rótulo de menu duplicado.');
L.push('');
L.push('## Menu → rotas → endereços');
for (const g of groups) {
  L.push('');
  L.push(`### ${g.label}`);
  L.push('');
  L.push('| Item do menu | Rota | Endereço | Abas (padrão em **negrito**) | Detalhe por id |');
  L.push('|---|---|---|---|---|');
  for (const i of g.items) {
    const t = tabs[i.id];
    const abas = t ? t.abas.map((a) => (a === t.padrao ? `**${a}**` : a)).join(', ') : '—';
    L.push(`| ${esc(i.label)} | \`${i.id}\` | \`${urlBase(i.id)}${t && !t.comId ? '[/<aba>]' : ''}\` | ${esc(abas)} | ${idMode(i.id)} |`);
  }
}
const detalhes = known.filter((r) => !inMenu.has(r));
L.push('');
L.push('## Telas fora do menu (detalhes e destinos de botões)');
L.push('');
L.push('| Rota | Endereço | Abas | Como o F5 resolve | Se o registro não existe |');
L.push('|---|---|---|---|---|');
for (const r of detalhes) {
  const t = tabs[r];
  const abas = t ? t.abas.map((a) => (a === t.padrao ? `**${a}**` : a)).join(', ') : '—';
  const base = urlBase(r) + (idMode(r) !== '—' ? '/<id>' : '') + (t && t.comId ? '[/<aba>]' : '');
  L.push(`| \`${r}\` | \`${base}\` | ${esc(abas)} | ${idMode(r)} | ${fallback[r] ? 'volta para `' + fallback[r] + '`' : '—'} |`);
}
L.push('');
L.push('## Botões que levam a outra tela');
L.push('');
L.push('Navegação por `setRoute("destino")` com destino fixo no código. (Destinos calculados em tempo de execução — Notificações, Gatilhos/“Onde parou”, Central de Decisões, atalhos do PCP — usam tabelas próprias, conferidas contra `KNOWN_ROUTES` na verificação acima.)');
L.push('');
L.push('| De | Botão / rótulo | Para | Endereço de destino | Onde no código |');
L.push('|---|---|---|---|---|');
navCalls.sort((a, b) => a.origem.localeCompare(b.origem) || a.alvo.localeCompare(b.alvo));
for (const n of navCalls) L.push(`| ${esc(n.origem)} | ${esc(n.botao)} | \`${n.alvo}\` | \`${urlBase(n.alvo)}\` | \`${n.onde}\` |`);
L.push('');
L.push('## Estados internos que ainda NÃO têm endereço');
L.push('');
L.push('São abas de formulário/modal, filtros, modos de visualização e passos de assistente. Ficam fora da URL de propósito (não são “submódulos”: trocar não muda de tela nem se compartilha por link). Listados para que nada fique escondido:');
L.push('');
L.push('> Já têm endereço por implementação própria (por isso não aparecem abaixo): aba do Dossiê da Obra (`/engenharia/dossier-obra/<id>/<aba>`), aba de Configurações (`/admin/configuracoes/<aba>`), Ficha Técnica (`/engenharia/ficha-tecnica/<id>` e `/nova-ficha-tecnica`) e detalhe da Precificação (`/comercial/precificacao/<id>`).');
L.push('');
L.push('| Onde | Componente | Estado | Valor inicial | Rotas que o exibem |');
L.push('|---|---|---|---|---|');
/* Abas que já espelham a URL por implementação própria (não passam por useRouteTab). */
const jaNaUrlPropria = (s) => (s.comp === 'DossierObraPage' && s.estado === 'activeTab') || (s.comp === 'ConfiguracoesPage' && s.estado === 'tab');
for (const s of semUrl.filter((x) => !jaNaUrlPropria(x))) {
  L.push(`| \`${s.onde}\` | ${esc(s.comp)} | \`${s.estado}\` | \`${esc(s.inicial)}\` | ${s.rotas.length ? s.rotas.map((r) => '`' + r + '`').join(', ') : '(modal/componente interno)'} |`);
}
L.push('');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, L.join('\n'));
console.log(`Mapa gravado em ${path.relative(process.cwd(), OUT)} — ${known.length} rotas, ${inMenu.size} itens de menu, ${Object.keys(tabs).length} telas com aba na URL, ${navCalls.length} botões de navegação, ${problemas.length} inconsistência(s).`);
problemas.forEach((p) => console.log('  ! ' + p));
