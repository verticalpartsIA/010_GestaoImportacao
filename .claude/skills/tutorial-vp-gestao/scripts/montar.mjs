#!/usr/bin/env node
/* ============================================================
   montar.mjs — monta o tutorial final (HTML + Markdown) a partir do
   roteiro.json já capturado por capturar.mjs.
   ------------------------------------------------------------
   Uso:
     node montar.mjs <roteiro.json> [--relativo]

   Saídas (na pasta do roteiro):
     index.html  — página única no padrão visual VerticalParts, com as
                   imagens EMBUTIDAS (abre/compartilha sozinha). Com
                   --relativo, referencia img/*.png em vez de embutir.
     README.md   — mesma documentação em Markdown (para o GitHub/repo).
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (!args[0]) { console.log('Uso: node montar.mjs <roteiro.json> [--relativo]'); process.exit(1); }
const roteiroPath = path.resolve(args[0]);
const dir = path.dirname(roteiroPath);
const R = JSON.parse(fs.readFileSync(roteiroPath, 'utf8'));
const relativo = args.includes('--relativo');
const imgDir = path.resolve(dir, R.saida || 'img');

let manifesto = { passos: [] };
try { manifesto = JSON.parse(fs.readFileSync(path.join(imgDir, 'manifesto.json'), 'utf8')); } catch (e) {
  console.error('[montar] manifesto.json não encontrado — rode capturar.mjs antes.'); process.exit(1);
}
const porId = Object.fromEntries(manifesto.passos.map((p) => [p.id, p]));
const falhas = manifesto.passos.filter((p) => p.ok === false);
if (falhas.length) console.warn(`[montar] ⚠ ${falhas.length} passo(s) falharam na captura: ${falhas.map((f) => f.id).join(', ')} — corrija antes de publicar.`);

/* ---------- utilidades ---------- */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function md(s) {
  if (!s) return '';
  const blocos = String(s).trim().split(/\n{2,}/);
  return blocos.map((b) => {
    const linhas = b.split('\n');
    const inline = (t) => esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\[\[(.+?)\]\]/g, '<span class="ui">$1</span>')
      .replace(/\[(.+?)\]\((https?:\/\/[^)\s]+|\.{0,2}\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
    if (linhas.every((l) => /^\s*[-•]\s+/.test(l))) return '<ul>' + linhas.map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('') + '</ul>';
    if (linhas.every((l) => /^\s*\d+[.)]\s+/.test(l))) return '<ol>' + linhas.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('') + '</ol>';
    return `<p>${linhas.map(inline).join('<br>')}</p>`;
  }).join('\n');
}
const mdTexto = (s) => String(s ?? '').replace(/\[\[(.+?)\]\]/g, '**$1**');
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
function imgSrc(absoluto) {
  if (!fs.existsSync(absoluto)) return null;
  return relativo ? path.relative(dir, absoluto).split(path.sep).join('/') : b64(absoluto);
}
const logo = path.join(__dirname, '..', 'assets', 'logo-verticalparts-white.png');
const logoSrc = fs.existsSync(logo) ? b64(logo) : '';

/* ---------- conteúdo ---------- */
const passos = R.passos.map((p, i) => ({ ...p, id: p.id || String(i + 1).padStart(2, '0') })).filter((p) => !p.oculto).map((p, i) => {
  const id = p.id;
  const m = porId[id] || {};
  const abs = path.join(imgDir, `${id}.png`);
  return { ...p, id, n: i + 1, url: m.url || p.ir || '', img: imgSrc(abs), imgRel: path.relative(dir, abs).split(path.sep).join('/'), falhou: m.ok === false };
});
const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const PERFIL_ROTULO = { comercial: 'Comercial', engenharia: 'Engenharia', financeiro: 'Financeiro', admin: 'Administrador' };
const perfil = PERFIL_ROTULO[R.perfil] || R.perfil || 'Todos';

/* ---------- HTML ---------- */
const toc = (R.mapa ? '<li><a href="#mapa"><span class="toc-n">★</span>De onde vem e para onde vai</a></li>' : '') + passos.map((p) => `<li><a href="#passo-${p.n}"><span class="toc-n">${p.n}</span>${esc(p.titulo || 'Passo ' + p.n)}</a></li>`).join('');
const blocoPassos = passos.map((p) => `
<section class="step" id="passo-${p.n}">
  <div class="step-head"><span class="step-n">${p.n}</span><h2>${esc(p.titulo || 'Passo ' + p.n)}</h2></div>
  <div class="step-body">${md(p.texto)}</div>
  ${p.img ? `<figure class="shot">
    <div class="shot-bar"><span class="dots"><i></i><i></i><i></i></span><span class="shot-url">hub.vpsistema.com${esc(p.url)}</span></div>
    <img src="${p.img}" alt="${esc(p.alt || p.titulo || '')}" loading="lazy">
    ${p.legenda ? `<figcaption>${esc(p.legenda)}</figcaption>` : ''}
  </figure>` : (p.falhou ? '<div class="call call-warn"><b>Print pendente</b> — a captura deste passo falhou.</div>' : '')}
  ${p.dica ? `<div class="call call-tip"><b>Dica</b>${md(p.dica)}</div>` : ''}
  ${p.atencao ? `<div class="call call-warn"><b>Atenção</b>${md(p.atencao)}</div>` : ''}
</section>`).join('\n');

const lista = (titulo, itens, cls) => itens && itens.length ? `<div class="box ${cls}"><h3>${esc(titulo)}</h3><ul>${itens.map((i) => `<li>${md(i).replace(/^<p>|<\/p>$/g, '')}</li>`).join('')}</ul></div>` : '';
const faq = (R.problemas || []).map((q) => `<details><summary>${esc(q.pergunta)}</summary>${md(q.resposta)}</details>`).join('');
/* ---------- Mapa de dados: "De onde vem / Para onde vai" (campo opcional `mapa`) ----------
   mapa: { titulo?, intro?, nome, sub?, herda:[{de,dado,tipo?}], doa:[{para,dado,tipo?}], fluxo?:[texto], banco?:[{nome,uso}] }
   Vira: infográfico em 3 colunas (fluxograma), workflow em etapas e árvore (ramos e galhos). */
const M = R.mapa;
const noCard = (t, titulo, dado, tipo) => `<div class="no no-${t}">${tipo ? `<i>${esc(tipo)}</i>` : ''}<b>${esc(titulo)}</b><span>${md(dado).replace(/^<p>|<\/p>$/g, '')}</span></div>`;
const arvoreTxt = M ? (() => {
  const ln = [`${M.nome}${M.sub ? '  (' + M.sub + ')' : ''}`];
  const ramo = (rotulo, itens, chave, ultimo) => {
    ln.push(`${ultimo ? '└─' : '├─'} ${rotulo}`);
    (itens || []).forEach((it, i, a) => {
      const f = i === a.length - 1;
      ln.push(`${ultimo ? '   ' : '│  '}${f ? '└─' : '├─'} ${it[chave]}`);
      ln.push(`${ultimo ? '   ' : '│  '}${f ? '   ' : '│  '}   ↳ ${String(it.dado).replace(/\*\*|`|\[\[|\]\]/g, '')}`);
    });
  };
  ramo('HERDA DE (de onde os dados vêm)', M.herda, 'de', false);
  ramo('DOA PARA (para onde os dados vão)', M.doa, 'para', true);
  return ln.join('\n');
})() : '';
const blocoMapa = M ? `
<section class="mapa" id="mapa">
  <h3 class="sec" style="margin-top:0">${esc(M.titulo || 'De onde esta tela vem e para onde ela leva')}</h3>
  ${M.intro ? `<div class="mapa-intro">${md(M.intro)}</div>` : ''}
  <div class="mapa-grid">
    <div class="mapa-col"><h4>Herda de <small>de onde os dados vêm</small></h4>${(M.herda || []).map((h) => noCard('h', h.de, h.dado, h.tipo)).join('')}</div>
    <div class="mapa-seta" aria-hidden="true"><span>➜</span></div>
    <div class="mapa-centro"><div class="centro-card"><small>Esta tela</small><b>${esc(M.nome)}</b>${M.sub ? `<span>${esc(M.sub)}</span>` : ''}</div></div>
    <div class="mapa-seta" aria-hidden="true"><span>➜</span></div>
    <div class="mapa-col"><h4>Doa para <small>para onde os dados vão</small></h4>${(M.doa || []).map((d) => noCard('d', d.para, d.dado, d.tipo)).join('')}</div>
  </div>
  ${M.fluxo?.length ? `<h4 class="mapa-sub">Workflow: o caminho de um aviso, do começo ao fim</h4><ol class="mapa-fluxo">${M.fluxo.map((f) => `<li>${md(f).replace(/^<p>|<\/p>$/g, '')}</li>`).join('')}</ol>` : ''}
  <details class="mapa-arv"><summary>Ver como árvore (ramos e galhos)</summary><pre>${esc(arvoreTxt)}</pre></details>
  ${M.banco?.length ? `<details class="mapa-arv"><summary>Para quem é da área técnica: tabelas envolvidas</summary><ul>${M.banco.map((b) => `<li><code>${esc(b.nome)}</code> — ${esc(b.uso)}</li>`).join('')}</ul></details>` : ''}
  <p class="mapa-leg"><b>Como ler:</b> a coluna da <b>esquerda</b> mostra o que alimenta esta tela (ela <i>herda</i> esses dados, sem você digitar nada). A coluna da <b>direita</b> mostra o que acontece com o que você faz aqui (ela <i>doa</i> dados para outras partes do sistema).</p>
</section>` : '';
const relacionados = (R.relacionados || []).map((r) => `<a class="rel" href="${esc(r.link)}">${esc(r.titulo)} <span>→</span></a>`).join('');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(R.titulo)} · Ajuda VP Gestão</title>
<meta name="description" content="${esc(R.resumo || '')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
:root{--y:#F5C400;--y-press:#C99E00;--y-tint:#FFF6CC;--ink:#000;--g50:#F9F9F9;--g100:#F2F2F2;--g200:#E5E5E5;--g500:#808080;--g700:#4A4A4A;
  --ok:#2E7D32;--ok-t:#E8F5E9;--info:#1565C0;--info-t:#E3F2FD;--warn:#9A5A00;--warn-t:#FFF4E0;
  --sans:Inter,"Helvetica Neue",Arial,system-ui,sans-serif;--disp:"Barlow Condensed",Inter,Impact,sans-serif;--mono:"JetBrains Mono",Consolas,monospace}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:#fff;color:var(--ink);font:16px/1.65 var(--sans);-webkit-font-smoothing:antialiased}
a{color:var(--info)}
.top{background:#000;color:#fff;border-bottom:4px solid var(--y)}
.top-in{max-width:1180px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;gap:16px}
.top img{height:26px}.top .sep{width:1px;height:22px;background:#444}.top .area{font:700 15px/1 var(--disp);letter-spacing:.12em;text-transform:uppercase;color:var(--y)}
.hero{background:var(--g50);border-bottom:1px solid var(--g200)}
.hero-in{max-width:1180px;margin:0 auto;padding:36px 24px 30px}
.crumbs{font:500 12px var(--mono);color:var(--g500);margin-bottom:14px}.crumbs b{color:var(--ink);font-weight:500}
.eyebrow{display:flex;align-items:center;gap:10px;font:700 12px var(--sans);letter-spacing:.18em;text-transform:uppercase;color:var(--y-press)}
.eyebrow:before{content:"";width:34px;height:3px;background:var(--y)}
h1{font:800 clamp(34px,5vw,52px)/1.02 var(--disp);text-transform:uppercase;margin:10px 0 12px;letter-spacing:.01em}
.lead{font-size:18px;color:var(--g700);max-width:760px;margin:0 0 18px}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{font:600 12px var(--sans);padding:5px 10px;border:1px solid var(--g200);background:#fff;border-radius:999px;color:var(--g700)}
.chip b{color:var(--ink)}
.wrap{max-width:1180px;margin:0 auto;padding:32px 24px 80px;display:grid;grid-template-columns:240px minmax(0,1fr);gap:48px}
nav.toc{position:sticky;top:20px;align-self:start;font-size:14px}
nav.toc h4{font:700 11px var(--sans);letter-spacing:.16em;text-transform:uppercase;color:var(--g500);margin:0 0 10px}
nav.toc ol{list-style:none;margin:0;padding:0;border-left:2px solid var(--g200)}
nav.toc li a{display:flex;gap:10px;padding:6px 0 6px 14px;margin-left:-2px;border-left:2px solid transparent;color:var(--g700);text-decoration:none;line-height:1.35}
nav.toc li a:hover,nav.toc li a.on{border-left-color:var(--y);color:var(--ink)}
.toc-n{font:700 12px var(--mono);color:var(--y-press);min-width:16px}
main{min-width:0}
.box{border:1px solid var(--g200);border-radius:10px;padding:18px 22px;margin:0 0 22px;background:#fff}
.box h3{font:700 13px var(--sans);letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px}
.box ul{margin:0;padding-left:20px}.box li{margin:3px 0}
.box.pre{border-left:4px solid var(--info);background:var(--info-t)}
.box.res{border-left:4px solid var(--ok);background:var(--ok-t)}
.step{padding:30px 0;border-top:1px solid var(--g200);scroll-margin-top:16px}
.step-head{display:flex;align-items:center;gap:14px;margin-bottom:8px}
.step-n{flex:none;width:38px;height:38px;border-radius:50%;background:#000;color:var(--y);border:2px solid var(--y);display:grid;place-items:center;font:800 20px var(--disp)}
.step h2{font:800 26px/1.15 var(--disp);text-transform:uppercase;margin:0;letter-spacing:.01em}
.step-body{padding-left:52px}.step-body p{margin:6px 0 10px}
.ui{font-weight:700;background:var(--y-tint);border:1px solid #f0dd8a;border-radius:4px;padding:0 6px;white-space:nowrap}
code{font:500 .88em var(--mono);background:var(--g100);padding:1px 6px;border-radius:4px}
.shot{margin:16px 0 8px 52px;border:1px solid var(--g200);border-radius:12px;overflow:hidden;box-shadow:0 10px 30px -12px rgba(0,0,0,.25);background:#fff}
.shot-bar{display:flex;align-items:center;gap:12px;padding:9px 14px;background:var(--g100);border-bottom:1px solid var(--g200)}
.dots{display:flex;gap:6px}.dots i{width:10px;height:10px;border-radius:50%;background:#d0d0d0}
.shot-url{font:500 12px var(--mono);color:var(--g500);background:#fff;border:1px solid var(--g200);border-radius:6px;padding:3px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.shot img{display:block;width:100%;height:auto;cursor:zoom-in}
.shot figcaption{font-size:13px;color:var(--g500);padding:8px 14px;border-top:1px solid var(--g200)}
.call{margin:12px 0 0 52px;padding:12px 16px;border-radius:8px;font-size:15px}
.call b{display:block;font:700 11px var(--sans);letter-spacing:.16em;text-transform:uppercase;margin-bottom:2px}
.call p{margin:0}
.call-tip{background:var(--y-tint);border-left:4px solid var(--y)}.call-tip b{color:var(--y-press)}
.call-warn{background:var(--warn-t);border-left:4px solid #ED8C00}.call-warn b{color:var(--warn)}
.fim{margin-top:10px}
details{border:1px solid var(--g200);border-radius:8px;padding:12px 16px;margin:8px 0}
summary{font-weight:600;cursor:pointer}details[open] summary{margin-bottom:6px}
.rels{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.rel{display:flex;justify-content:space-between;border:1px solid var(--g200);border-radius:8px;padding:14px 16px;color:var(--ink);text-decoration:none;font-weight:600}
.rel:hover{border-color:var(--y)}.rel span{color:var(--y-press)}
h3.sec{font:800 22px var(--disp);text-transform:uppercase;margin:36px 0 10px}
.foot{border-top:1px solid var(--g200);margin-top:40px;padding-top:18px;font-size:13px;color:var(--g500);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
.zoom{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;place-items:center;padding:24px;z-index:9;cursor:zoom-out}
.zoom img{max-width:100%;max-height:100%;border-radius:8px}.zoom.on{display:grid}
.mapa{margin:0 0 30px;padding:22px 24px;border:1px solid var(--g200);border-radius:14px;background:linear-gradient(180deg,var(--g50),#fff)}
.mapa-intro p{margin:6px 0 10px;color:var(--g700)}
.mapa-grid{display:grid;grid-template-columns:1fr 34px minmax(170px,.8fr) 34px 1fr;gap:10px;align-items:center;margin:18px 0 8px}
.mapa-col h4{font:800 15px var(--disp);letter-spacing:.1em;text-transform:uppercase;margin:0 0 8px}.mapa-col h4 small{display:block;font:500 12px var(--sans);letter-spacing:0;text-transform:none;color:var(--g500)}
.no{position:relative;border:1px solid var(--g200);background:#fff;border-radius:10px;padding:10px 12px 10px 14px;margin:0 0 8px;font-size:13.5px;line-height:1.4}
.no b{display:block;font-size:14px}.no span{color:var(--g700)}
.no i{float:right;font:700 10px var(--sans);letter-spacing:.1em;text-transform:uppercase;color:var(--g500);font-style:normal;margin-left:8px}
.no-h{border-left:4px solid var(--info)}.no-d{border-left:4px solid var(--ok)}
.mapa-seta{display:grid;place-items:center;color:var(--y-press);font-size:26px}
.centro-card{background:#000;color:#fff;border:3px solid var(--y);border-radius:14px;padding:18px 14px;text-align:center;box-shadow:0 10px 30px -12px rgba(0,0,0,.4)}
.centro-card small{display:block;font:700 10px var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--y)}
.centro-card b{display:block;font:800 26px/1.1 var(--disp);text-transform:uppercase;margin:6px 0}.centro-card span{font-size:12px;color:#bbb}
.mapa-sub{font:800 15px var(--disp);letter-spacing:.1em;text-transform:uppercase;margin:22px 0 8px}
.mapa-fluxo{list-style:none;counter-reset:f;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.mapa-fluxo li:nth-child(3n):after{display:none}
.mapa-fluxo li{counter-increment:f;position:relative;background:#fff;border:1px solid var(--g200);border-top:3px solid var(--y);border-radius:8px;padding:12px 12px 10px;font-size:13.5px;line-height:1.4}
.mapa-fluxo li:before{content:counter(f);display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#000;color:var(--y);font:800 14px var(--disp);margin-bottom:6px}
.mapa-fluxo li:not(:last-child):after{content:"➜";position:absolute;right:-13px;top:50%;transform:translateY(-50%);color:var(--y-press);font-size:16px;background:var(--g50);line-height:1;z-index:1}
.mapa-arv{margin-top:14px;background:#fff}.mapa-arv pre{margin:8px 0 0;font:500 12.5px/1.55 var(--mono);white-space:pre-wrap;color:var(--g700)}
.mapa-arv ul{margin:6px 0 0;padding-left:20px;font-size:14px}
.mapa-leg{font-size:13.5px;color:var(--g700);margin:16px 0 0;padding:10px 14px;background:var(--y-tint);border-left:4px solid var(--y);border-radius:6px}
@media (max-width:900px){.mapa-fluxo{grid-template-columns:1fr}.mapa-grid{grid-template-columns:1fr}.mapa-seta span{transform:rotate(90deg)}.mapa-fluxo li:not(:last-child):after{display:none}}
@media (max-width:900px){.wrap{grid-template-columns:1fr;gap:0}nav.toc{position:static;margin-bottom:20px}.step-body,.shot,.call{margin-left:0;padding-left:0}.call{padding-left:16px}}
@media print{.top,nav.toc,.zoom{display:none}.wrap{display:block}.step{break-inside:avoid}.shot{box-shadow:none}details{display:block}}
</style>
</head>
<body>
<header class="top"><div class="top-in">${logoSrc ? `<img src="${logoSrc}" alt="VerticalParts">` : '<b>VERTICALPARTS</b>'}<span class="sep"></span><span class="area">Central de Ajuda · VP Gestão</span></div></header>
<section class="hero"><div class="hero-in">
  <div class="crumbs">Ajuda / ${esc(R.modulo || 'VP Gestão')} / <b>${esc(R.titulo)}</b></div>
  <div class="eyebrow">${esc(R.modulo || 'Tutorial')}</div>
  <h1>${esc(R.titulo)}</h1>
  ${R.resumo ? `<p class="lead">${esc(R.resumo)}</p>` : ''}
  <div class="chips"><span class="chip">Perfil: <b>${esc(perfil)}</b></span>${R.tempo ? `<span class="chip">Tempo: <b>${esc(R.tempo)}</b></span>` : ''}<span class="chip">${passos.length} passos</span><span class="chip">Atualizado em <b>${hoje}</b></span></div>
</div></section>
<div class="wrap">
  <nav class="toc"><h4>Neste tutorial</h4><ol>${toc}</ol></nav>
  <main>
    ${lista('Antes de começar', R.antes, 'pre')}
    ${blocoMapa}
    ${blocoPassos}
    ${R.resultado ? `<div class="box res fim"><h3>Pronto!</h3>${md(R.resultado)}</div>` : ''}
    ${faq ? `<h3 class="sec">Problemas comuns</h3>${faq}` : ''}
    ${relacionados ? `<h3 class="sec">Próximos passos</h3><div class="rels">${relacionados}</div>` : ''}
    <div class="foot"><span>VerticalParts · VP Gestão — dados dos prints são ilustrativos.</span><span>Dúvidas? <a href="mailto:suporte@verticalparts.com.br?subject=${encodeURIComponent('Ajuda VP Gestão — ' + R.titulo)}">suporte@verticalparts.com.br</a></span></div>
  </main>
</div>
<div class="zoom" id="zoom"><img alt=""></div>
<script>
(function(){
  var z=document.getElementById('zoom'),zi=z.querySelector('img');
  document.querySelectorAll('.shot img').forEach(function(i){i.addEventListener('click',function(){zi.src=i.src;z.classList.add('on')})});
  z.addEventListener('click',function(){z.classList.remove('on')});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')z.classList.remove('on')});
  var links=[].slice.call(document.querySelectorAll('nav.toc a'));
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(a){a.classList.toggle('on',a.getAttribute('href')==='#'+e.target.id)})}})},{rootMargin:'-20% 0px -70% 0px'});
  document.querySelectorAll('.step').forEach(function(s){io.observe(s)});}
})();
</script>
</body>
</html>`;
fs.writeFileSync(path.join(dir, 'index.html'), html);

/* ---------- Markdown ---------- */
const mdOut = [
  `# ${R.titulo}`, '',
  R.resumo ? `> ${R.resumo}` : '', '',
  `**Perfil:** ${perfil}${R.tempo ? ` · **Tempo:** ${R.tempo}` : ''} · **Atualizado em:** ${hoje}`, '',
  R.antes?.length ? '## Antes de começar\n\n' + R.antes.map((a) => `- ${mdTexto(a)}`).join('\n') + '\n' : '',
  M ? `## ${M.titulo || 'De onde esta tela vem e para onde ela leva'}\n\n${mdTexto(M.intro || '')}\n\n\`\`\`text\n${arvoreTxt}\n\`\`\`\n\n` + (M.fluxo?.length ? '**Workflow:**\n\n' + M.fluxo.map((f, i) => `${i + 1}. ${mdTexto(f)}`).join('\n') + '\n' : '') : '',
  ...passos.map((p) => [
    `## ${p.n}. ${p.titulo || 'Passo ' + p.n}`, '',
    mdTexto(p.texto || ''), '',
    fs.existsSync(path.join(imgDir, `${p.id}.png`)) ? `![${p.alt || p.titulo || ''}](${p.imgRel})` : '',
    p.dica ? `\n> 💡 **Dica:** ${mdTexto(p.dica)}` : '',
    p.atencao ? `\n> ⚠️ **Atenção:** ${mdTexto(p.atencao)}` : '', '',
  ].join('\n')),
  R.resultado ? `## ✅ Pronto!\n\n${mdTexto(R.resultado)}\n` : '',
  R.problemas?.length ? '## Problemas comuns\n\n' + R.problemas.map((q) => `**${q.pergunta}**\n${mdTexto(q.resposta)}\n`).join('\n') : '',
].filter((x) => x !== undefined).join('\n');
fs.writeFileSync(path.join(dir, 'README.md'), mdOut.replace(/\n{3,}/g, '\n\n'));

const kb = (f) => Math.round(fs.statSync(path.join(dir, f)).size / 1024);
console.log(`✔ index.html (${kb('index.html')} KB${relativo ? ', imagens relativas' : ', imagens embutidas'}) e README.md gerados em ${path.relative(process.cwd(), dir) || '.'}`);
