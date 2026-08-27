'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function makeFakeWindow(initialPath) {
  const listeners = {};
  const win = {
    location: { pathname: initialPath, search: '' },
    history: {
      pushState(_state, _title, path) { win.location.pathname = path.split('?')[0]; },
      replaceState(_state, _title, path) { win.location.pathname = path.split('?')[0]; },
    },
    addEventListener(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
    BREADCRUMB_MAP: {
      dashboard: { module: 'Dashboard' },
      leads: { module: 'Comercial' },
      'lead-detail': { module: 'Comercial' },
      engenharia: { module: 'Engenharia' },
    },
  };
  return win;
}

function loadRouter(initialPath) {
  const win = makeFakeWindow(initialPath);
  global.window = win;
  delete require.cache[require.resolve('./router.js')];
  require('./router.js');
  return win.VpRouter;
}

test('buildPath — monta módulo + rota + id opcional', () => {
  const R = loadRouter('/');
  assert.equal(R.buildPath('dashboard'), '/geral/dashboard');
  assert.equal(R.buildPath('leads'), '/comercial/leads');
  assert.equal(R.buildPath('lead-detail', 42), '/comercial/lead-detail/42');
});

test('buildPath — rota desconhecida cai na raiz', () => {
  const R = loadRouter('/');
  assert.equal(R.buildPath('rota-que-nao-existe'), '/');
});

test('parseLocation — reconhece rota conhecida com e sem id', () => {
  const R = loadRouter('/comercial/leads');
  assert.deepEqual(R.parseLocation(), { route: 'leads', id: null, tab: null });
});

test('parseLocation — id vem decodificado', () => {
  const R = loadRouter('/comercial/lead-detail/42%20b');
  assert.deepEqual(R.parseLocation(), { route: 'lead-detail', id: '42 b', tab: null });
});

test('parseLocation — path desconhecido/raiz não vira rota', () => {
  const R = loadRouter('/');
  assert.deepEqual(R.parseLocation(), { route: null, id: null, tab: null });
});

test('parseLocation — segmento de módulo errado não impede reconhecer a rota', () => {
  // O 1º segmento é cosmético (deriva de BREADCRUMB_MAP); só o 2º importa.
  const R = loadRouter('/qualquer-coisa/dashboard');
  assert.deepEqual(R.parseLocation(), { route: 'dashboard', id: null, tab: null });
});

test('parseLocation — reconhece o 3º segmento (tab) decodificado', () => {
  const R = loadRouter('/engenharia/dossier-obra/42/documentos%20anexos');
  assert.deepEqual(R.parseLocation(), { route: 'dossier-obra', id: '42', tab: 'documentos anexos' });
});

test('navigate — não escreve na URL se já é a mesma (evita loop com popstate)', () => {
  const win = makeFakeWindow('/geral/dashboard');
  global.window = win;
  delete require.cache[require.resolve('./router.js')];
  require('./router.js');
  let pushed = false;
  const originalPush = win.history.pushState;
  win.history.pushState = (...args) => { pushed = true; originalPush(...args); };
  win.VpRouter.navigate('dashboard');
  assert.equal(pushed, false);
});
