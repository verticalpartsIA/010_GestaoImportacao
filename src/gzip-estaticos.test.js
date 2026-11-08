'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const express = require('express');
const { criar } = require('../server-lib/gzip-estaticos');

function subir(raiz) {
  const app = express();
  app.use(criar({ raiz, cacheControl: () => 'no-cache' }));
  app.use(express.static(raiz));
  return new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
}
function pedir(porta, caminho, headers, metodo) {
  return new Promise((ok, falha) => {
    const r = http.request({ port: porta, path: caminho, method: metodo || 'GET', headers: headers || {} }, (res) => {
      const partes = []; res.on('data', (d) => partes.push(d)); res.on('end', () => ok({ res, corpo: Buffer.concat(partes) }));
    });
    r.on('error', falha); r.end();
  });
}

test('gzip: arquivo de texto grande sai comprimido e volta igual ao original', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-'));
  const texto = 'const x = 1; // ' + 'abc '.repeat(2000);
  fs.writeFileSync(path.join(raiz, 'a.js'), texto);
  const s = await subir(raiz);
  try {
    const { res, corpo } = await pedir(s.address().port, '/a.js', { 'Accept-Encoding': 'gzip' });
    assert.strictEqual(res.headers['content-encoding'], 'gzip');
    assert.strictEqual(res.headers['vary'], 'Accept-Encoding');
    assert.ok(corpo.length < texto.length / 4);
    assert.strictEqual(zlib.gunzipSync(corpo).toString(), texto);
    assert.match(res.headers['content-type'], /javascript/);
  } finally { s.close(); }
});

test('gzip: sem Accept-Encoding o arquivo sai sem compressão', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-'));
  const texto = 'body { color: red; } /* ' + 'x'.repeat(3000) + ' */';
  fs.writeFileSync(path.join(raiz, 'a.css'), texto);
  const s = await subir(raiz);
  try {
    const { res, corpo } = await pedir(s.address().port, '/a.css', {});
    assert.strictEqual(res.headers['content-encoding'], undefined);
    assert.strictEqual(res.headers['vary'], 'Accept-Encoding');
    assert.strictEqual(corpo.toString(), texto);
  } finally { s.close(); }
});

test('gzip: segunda visita com If-None-Match recebe 304 e arquivo alterado recebe o conteúdo novo', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-'));
  const arq = path.join(raiz, 'a.js');
  fs.writeFileSync(arq, 'a'.repeat(3000));
  const s = await subir(raiz);
  try {
    const p = s.address().port;
    const um = await pedir(p, '/a.js', { 'Accept-Encoding': 'gzip' });
    const dois = await pedir(p, '/a.js', { 'Accept-Encoding': 'gzip', 'If-None-Match': um.res.headers.etag });
    assert.strictEqual(dois.res.statusCode, 304);
    fs.writeFileSync(arq, 'b'.repeat(4000));
    const tres = await pedir(p, '/a.js', { 'Accept-Encoding': 'gzip', 'If-None-Match': um.res.headers.etag });
    assert.strictEqual(tres.res.statusCode, 200);
    assert.strictEqual(zlib.gunzipSync(tres.corpo).toString(), 'b'.repeat(4000));
  } finally { s.close(); }
});

test('gzip: arquivo pequeno, tipo que não é texto, oculto e fora da raiz passam direto', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-'));
  fs.writeFileSync(path.join(raiz, 'p.js'), 'x');
  fs.writeFileSync(path.join(raiz, 'i.png'), Buffer.alloc(5000, 1));
  fs.writeFileSync(path.join(raiz, '.segredo.js'), 'x'.repeat(3000));
  const s = await subir(raiz);
  try {
    const p = s.address().port;
    const h = { 'Accept-Encoding': 'gzip' };
    assert.strictEqual((await pedir(p, '/p.js', h)).res.headers['content-encoding'], undefined);
    assert.strictEqual((await pedir(p, '/i.png', h)).res.headers['content-encoding'], undefined);
    assert.notStrictEqual((await pedir(p, '/.segredo.js', h)).res.statusCode, 200);
    assert.notStrictEqual((await pedir(p, '/..%2f..%2fetc%2fpasswd.js', h)).res.statusCode, 200);
  } finally { s.close(); }
});
