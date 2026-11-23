'use strict';
/* Entrega os arquivos de texto do front (js, jsx, css, html, json, svg) comprimidos em gzip quando o navegador aceita.
   Motivo: a produção respondia o logistica.jsx (186 KB) e os outros ~4,4 MB de .jsx sem compressão (conferido por
   curl com Accept-Encoding: gzip, 08/11/2026) — a primeira abertura baixava tudo "cru".
   Sem dependência nova (usa o zlib do Node). Fica ANTES do express.static e DEPOIS da lista de permissão do
   server.js, então só arquivos públicos chegam aqui. A versão comprimida de cada arquivo fica em memória e é
   refeita quando o arquivo muda (data/tamanho). Respeita 304 (ETag/Last-Modified) e HEAD. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const EXTENSOES = new Set(['.js', '.jsx', '.css', '.html', '.json', '.svg']);
const TAMANHO_MINIMO = 1024; // abaixo disso a compressão não compensa

function criar({ raiz, cacheControl }) {
  const raizAbs = path.resolve(raiz);
  const memoria = new Map(); // caminho absoluto -> { mtimeMs, size, gz, etag }

  return function gzipEstaticos(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const ext = path.extname(req.path).toLowerCase();
    if (!EXTENSOES.has(ext)) return next();
    res.setHeader('Vary', 'Accept-Encoding');
    if (!/\bgzip\b/i.test(req.headers['accept-encoding'] || '')) return next();

    let relativo;
    try { relativo = decodeURIComponent(req.path); } catch (e) { return next(); }
    if (relativo.split('/').some((parte) => parte.startsWith('.'))) return next(); // arquivos ocultos: quem decide é o express.static
    const arquivo = path.resolve(raizAbs, '.' + relativo);
    if (!arquivo.startsWith(raizAbs + path.sep)) return next();

    let st;
    try { st = fs.statSync(arquivo); } catch (e) { return next(); }
    if (!st.isFile() || st.size < TAMANHO_MINIMO) return next();

    let item = memoria.get(arquivo);
    if (!item || item.mtimeMs !== st.mtimeMs || item.size !== st.size) {
      let gz;
      try { gz = zlib.gzipSync(fs.readFileSync(arquivo), { level: 6 }); } catch (e) { return next(); }
      item = { mtimeMs: st.mtimeMs, size: st.size, gz, etag: 'W/"gz-' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"' };
      memoria.set(arquivo, item);
    }

    res.type(ext);
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('ETag', item.etag);
    res.setHeader('Last-Modified', st.mtime.toUTCString());
    res.setHeader('Cache-Control', cacheControl(arquivo));
    if (req.fresh) return res.status(304).end();
    res.setHeader('Content-Length', item.gz.length);
    if (req.method === 'HEAD') return res.end();
    return res.end(item.gz);
  };
}

module.exports = { criar, EXTENSOES };
