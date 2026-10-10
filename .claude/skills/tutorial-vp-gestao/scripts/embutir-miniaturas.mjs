// Embute as miniaturas da Central de Ajuda (TreinamentoVP/index.html) como JPEG pequeno
// em data URI, para o hub não depender das pastas img/ (que não vão ao Git).
// Uso: node embutir-miniaturas.mjs <caminho/TreinamentoVP>
// Fatos: lê só o index.html gerado pelo indice.mjs e os PNG locais de cada tutorial;
// não é chamado por nenhum outro arquivo; gera JPEG com o Chromium do Playwright.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const pasta = path.resolve(process.argv[2] || 'TreinamentoVP');
const hubPath = path.join(pasta, 'index.html');
const hub = fs.readFileSync(hubPath, 'utf8');
const LARGURA = 480;
const QUALIDADE = 0.72;

const refs = [...new Set([...hub.matchAll(/url\('([^']+\/img\/[^']+\.png)'\)/g)].map((m) => m[1]))];
if (!refs.length) { console.log('nenhuma miniatura em url(...) encontrada'); process.exit(0); }

const browser = await chromium.launch();
const page = await browser.newPage();
const dataUris = {};
let total = 0;
for (const ref of refs) {
  const png = path.join(pasta, ref);
  if (!fs.existsSync(png)) { console.log('ausente, não embutido:', ref); continue; }
  const b64 = fs.readFileSync(png).toString('base64');
  const jpeg = await page.evaluate(async ({ src, w, q }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const h = Math.round(img.naturalHeight * (w / img.naturalWidth));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', q);
  }, { src: `data:image/png;base64,${b64}`, w: LARGURA, q: QUALIDADE });
  dataUris[ref] = jpeg;
  total += jpeg.length;
}
await browser.close();

let novo = hub;
for (const [ref, uri] of Object.entries(dataUris)) novo = novo.split(`url('${ref}')`).join(`url('${uri}')`);
fs.writeFileSync(hubPath, novo);
console.log(`✔ ${Object.keys(dataUris).length} miniatura(s) embutida(s) (${(total / 1024).toFixed(0)} KB em JPEG ${LARGURA}px)`);
