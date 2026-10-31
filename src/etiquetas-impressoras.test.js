'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global.window || {};
require('./etiquetas-impressoras.js');
const I = window.EtiquetasImpressoras;

const resp = (status, corpo) => ({ ok: status >= 200 && status < 300, status, text: async () => corpo });

test('perfil: casa o nome reportado com o perfil de fábrica', () => {
  assert.equal(I.casarPerfil({ nome: 'ZDesigner ZD220-203dpi ZPL' }).id, 'zebra-zd220');
  assert.equal(I.casarPerfil({ nome: 'ZD230' }).id, 'zebra-zd230');
  assert.equal(I.casarPerfil({ nome: 'ZT421' }).id, 'zebra-zt421');
  assert.equal(I.casarPerfil({ nome: 'ZDesigner ZT230-300dpi ZPL' }).id, 'zebra-zt230');
  assert.equal(I.perfilPorId('zebra-zt230').dpi, 300);
  assert.equal(I.casarPerfil({ nome: 'Impressora X', fabricante: 'Zebra Technologies' }).id, 'zebra-generica');
  assert.equal(I.casarPerfil({ nome: 'L42 Pro', fabricante: 'Elgin' }).id, 'elgin-l42-pro');
  assert.equal(I.casarPerfil({ nome: 'Argox OS-214 Plus' }).id, 'argox-os214plus');
  assert.equal(I.casarPerfil({ nome: 'HP LaserJet' }).id, 'generica');
});

test('perfis: ZPL implementado para Zebra e Elgin; Argox e genérica só pelo navegador', () => {
  assert.equal(I.perfilPorId('zebra-zd220').implementado, true);
  assert.equal(I.perfilPorId('elgin-l42-pro').linguagem, 'zpl');
  assert.equal(I.perfilPorId('argox-os214plus').implementado, false);
  assert.equal(I.perfilPorId('generica').implementado, false);
  assert.equal(I.perfilPorId('zebra-zd220').dpi, 203);
});

test('Browser Print: lista a impressora e usa https 9101 primeiro', async () => {
  I._resetarBase();
  const chamadas = [];
  const f = async (url, opts) => { chamadas.push(url); return resp(200, JSON.stringify({ printer: [{ name: 'ZDesigner ZD220', uid: 'USB001', connection: 'usb', deviceType: 'printer', manufacturer: 'Zebra Technologies' }] })); };
  const lista = await I.detectarBrowserPrint(f);
  assert.deepEqual(chamadas, ['https://localhost:9101/available']);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].adaptador, 'zebra-browser-print');
  assert.equal(lista[0].nome, 'ZDesigner ZD220');
  assert.equal(lista[0].bruto.uid, 'USB001');
});

test('Browser Print: cai para http 9100 quando o https falha e lembra a base que funcionou', async () => {
  I._resetarBase();
  const chamadas = [];
  const f = async (url) => {
    chamadas.push(url);
    if (url.startsWith('https://')) throw new Error('Failed to fetch');
    return resp(200, JSON.stringify({ printer: [{ name: 'ZD220' }] }));
  };
  await I.detectarBrowserPrint(f);
  await I.detectarBrowserPrint(f);
  assert.deepEqual(chamadas, ['https://localhost:9101/available', 'http://localhost:9100/available', 'http://localhost:9100/available']);
});

test('Browser Print: programa fechado vira mensagem clara; resposta inválida também', async () => {
  I._resetarBase();
  await assert.rejects(() => I.detectarBrowserPrint(async () => { throw new Error('Failed to fetch'); }), /Browser Print não respondeu .*programa está aberto/);
  I._resetarBase();
  await assert.rejects(() => I.detectarBrowserPrint(async () => resp(200, 'não é json')), /Resposta inesperada/);
  I._resetarBase();
  const vazia = await I.detectarBrowserPrint(async () => resp(200, '{"printer":[]}'));
  assert.deepEqual(vazia, []);
});

test('Browser Print: /write recebe {device, data} como texto', async () => {
  I._resetarBase();
  let visto = null;
  const f = async (url, opts) => { visto = { url, opts }; return resp(200, ''); };
  const dev = { name: 'ZD220', uid: 'USB001' };
  await I.enviarBrowserPrint({ bruto: dev }, '^XA^XZ', f);
  assert.equal(visto.url, 'https://localhost:9101/write');
  assert.equal(visto.opts.method, 'POST');
  assert.match(visto.opts.headers['Content-Type'], /^text\/plain/);
  assert.deepEqual(JSON.parse(visto.opts.body), { device: dev, data: '^XA^XZ' });
  await assert.rejects(() => I.enviarBrowserPrint({ bruto: null }, 'x', f), /detecte de novo/);
});

test('detectarTodas: sempre oferece o navegador; erro de um adaptador não derruba os outros', async () => {
  I._resetarBase();
  const r = await I.detectarTodas(async () => { throw new Error('Failed to fetch'); });
  assert.deepEqual(r.impressoras.map((i) => i.adaptador), ['navegador']);
  assert.ok(r.erros['zebra-browser-print']);
});

test('perfil lembrado por impressora tem prioridade sobre o palpite pelo nome', () => {
  const mem = {}; global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  const imp = { adaptador: 'zebra-browser-print', id: '52j151101840', nome: '52j151101840', fabricante: 'Zebra Technologies' };
  assert.equal(I.perfilDaImpressora(imp).id, 'zebra-generica');
  I.lembrarPerfil(imp, 'zebra-zt230');
  assert.equal(I.perfilDaImpressora(imp).id, 'zebra-zt230');
  assert.equal(I.perfilDaImpressora({ adaptador: 'zebra-browser-print', id: 'outra', nome: 'outra' }).id, 'generica');
  I.lembrarPerfil(imp, 'perfil-que-nao-existe');
  assert.equal(I.perfilDaImpressora(imp).id, 'zebra-zt230', 'perfil inválido é ignorado');
  delete global.localStorage;
});
