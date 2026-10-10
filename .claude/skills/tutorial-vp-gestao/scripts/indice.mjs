#!/usr/bin/env node
/* ============================================================
   indice.mjs — monta a página inicial da Central de Ajuda
   ------------------------------------------------------------
   Uso:
     node indice.mjs [pasta-dos-tutoriais]   (padrão: docs/tutoriais)

   Varre cada <pasta>/<tutorial>/roteiro.json e gera <pasta>/index.html com um card
   por tutorial, agrupado por módulo (na ordem do menu do VP Gestão),
   com busca instantânea por título/resumo.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pasta = path.resolve(process.argv[2] || 'docs/tutoriais');
if (!fs.existsSync(pasta)) { console.error(`[indice] pasta não existe: ${pasta}`); process.exit(1); }

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ORDEM = ['Geral', 'CRM', 'Cadastros', 'Comercial', 'Financeiro', 'Contratos', 'Jurídico', 'Importação', 'Engenharia', 'Obras', 'Entrega', 'Parceiros', 'Logística', 'Administração'];
const peso = (m) => { const i = ORDEM.findIndex((o) => String(m).toLowerCase().startsWith(o.toLowerCase())); return i < 0 ? 99 : i; };

// Estrutura: TreinamentoVP/<módulo>/ (visão do módulo) e TreinamentoVP/<módulo>/<tela>/ (uma pasta por tela).
// Varre até dois níveis e devolve o caminho relativo de cada pasta que tem roteiro.json (ex.: "geral/dashboard").
const coletar = (dirRel) => fs.readdirSync(path.join(pasta, dirRel), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'img' && d.name !== 'node_modules')
  .flatMap((d) => {
    const rel = dirRel ? `${dirRel}/${d.name}` : d.name;
    const achados = fs.existsSync(path.join(pasta, rel, 'roteiro.json')) ? [rel] : [];
    return [...achados, ...(dirRel.split('/').length < 2 ? coletar(rel) : [])];
  });

const tutoriais = coletar('')
  .map((rel) => {
    const r = JSON.parse(fs.readFileSync(path.join(pasta, rel, 'roteiro.json'), 'utf8'));
    // Capa = passo marcado, senão o primeiro passo cujo PNG existe (passos de aquecimento podem ter sido apagados)
    const pngDe = (p) => path.join(pasta, rel, r.saida || 'img', `${p.id}.png`);
    const capa = r.passos?.find((p) => p.capa && fs.existsSync(pngDe(p)))
      || r.passos?.find((p) => fs.existsSync(pngDe(p)));
    const img = capa && pngDe(capa);
    return { slug: rel, titulo: r.titulo, resumo: r.resumo || '', modulo: (r.modulo || 'Geral').split('·')[0].trim(), hub: /vis[aã]o do m[oó]dulo/i.test(r.modulo || ''), tempo: r.tempo, passos: r.passos?.length || 0,
      capa: img && fs.existsSync(img) ? path.relative(pasta, img).split(path.sep).join('/') : null, temHtml: fs.existsSync(path.join(pasta, rel, 'index.html')) };
  })
  .filter((t) => t.temHtml)
  .sort((a, b) => peso(a.modulo) - peso(b.modulo) || (b.hub - a.hub) || a.titulo.localeCompare(b.titulo, 'pt-BR'));   // a "Visão do módulo" abre o grupo

const grupos = {};
for (const t of tutoriais) (grupos[t.modulo] ||= []).push(t);
const logo = path.join(__dirname, '..', 'assets', 'logo-verticalparts-white.png');
const logoSrc = fs.existsSync(logo) ? 'data:image/png;base64,' + fs.readFileSync(logo).toString('base64') : '';

const cards = Object.entries(grupos).map(([mod, ts]) => `
<section class="grp"><h2>${esc(mod)}</h2><div class="grid">
${ts.map((t) => `<a class="card" href="${esc(t.slug)}/index.html" data-q="${esc((t.titulo + ' ' + t.resumo + ' ' + mod).toLowerCase())}">
  ${t.capa ? `<div class="thumb" style="background-image:url('${esc(t.capa)}')"></div>` : '<div class="thumb vazio"></div>'}
  <div class="txt"><h3>${esc(t.titulo)}</h3><p>${esc(t.resumo)}</p><span class="meta">${t.passos} passos${t.tempo ? ' · ' + esc(t.tempo) : ''}</span></div>
</a>`).join('')}
</div></section>`).join('');

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Central de Ajuda · VP Gestão</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{--disp:"Barlow Condensed","Arial Narrow",Impact,sans-serif;--y:#F5C400;--yp:#C99E00;--g200:#E5E5E5;--g500:#808080;--g700:#4A4A4A}
*{box-sizing:border-box}body{margin:0;font:16px/1.55 Inter,Arial,sans-serif;color:#000;background:#fff}
.top{background:#000;border-bottom:4px solid var(--y)}.top-in{max-width:1180px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;gap:16px}
.top img{height:26px}.top span{font:700 15px var(--disp);letter-spacing:.12em;text-transform:uppercase;color:var(--y)}
.hero{background:#000;color:#fff;padding:56px 24px 64px;text-align:center}
.hero h1{font:800 clamp(38px,6vw,64px)/1 var(--disp);text-transform:uppercase;margin:0 0 10px}.hero h1 b{color:var(--y)}
.hero p{color:#bbb;margin:0 0 26px}
.busca{max-width:620px;margin:0 auto;position:relative}
.busca input{width:100%;font:16px Inter;padding:16px 20px;border-radius:10px;border:2px solid var(--y);outline:none}
main{max-width:1180px;margin:0 auto;padding:40px 24px 80px}
.grp h2{font:800 24px var(--disp);text-transform:uppercase;display:flex;align-items:center;gap:10px;margin:28px 0 14px}
.grp h2:before{content:"";width:28px;height:3px;background:var(--y)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px}
.card{border:1px solid var(--g200);border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column;transition:border-color .15s,transform .15s}
.card:hover{border-color:var(--y);transform:translateY(-2px)}
.thumb{height:150px;background:#f2f2f2 center top/cover no-repeat;border-bottom:1px solid var(--g200)}
.txt{padding:14px 16px 16px}.txt h3{margin:0 0 4px;font-size:17px}.txt p{margin:0 0 10px;color:var(--g700);font-size:14px}
.meta{font-size:12px;color:var(--g500);font-weight:600}
.nada{display:none;text-align:center;color:var(--g500);padding:40px}
.foot{text-align:center;color:var(--g500);font-size:13px;padding:20px}
</style></head><body>
<header class="top"><div class="top-in">${logoSrc ? `<img src="${logoSrc}" alt="VerticalParts">` : ''}<span>Central de Ajuda · VP Gestão</span></div></header>
<section class="hero"><h1>Como podemos <b>ajudar?</b></h1><p>Tutoriais passo a passo do VP Gestão — da oportunidade ao equipamento entregue.</p>
<div class="busca"><input id="q" type="search" placeholder="Buscar tutorial: lead, cotação, proposta, embarque…" autofocus></div></section>
<main>${cards || '<p>Nenhum tutorial publicado ainda.</p>'}<p class="nada" id="nada">Nenhum tutorial encontrado. Fale com <a href="mailto:suporte@verticalparts.com.br">suporte@verticalparts.com.br</a>.</p></main>
<div class="foot">${tutoriais.length} tutoriais · VerticalParts</div>
<script>
var q=document.getElementById('q');q.addEventListener('input',function(){var t=q.value.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,''),n=0;
document.querySelectorAll('.card').forEach(function(c){var ok=!t||c.dataset.q.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').indexOf(t)>=0;c.style.display=ok?'':'none';if(ok)n++});
document.querySelectorAll('.grp').forEach(function(g){g.style.display=[].some.call(g.querySelectorAll('.card'),function(c){return c.style.display!=='none'})?'':'none'});
document.getElementById('nada').style.display=n?'none':'block'});
</script></body></html>`;
fs.writeFileSync(path.join(pasta, 'index.html'), html);
console.log(`✔ Central de Ajuda com ${tutoriais.length} tutorial(is) em ${path.relative(process.cwd(), path.join(pasta, 'index.html'))}`);
