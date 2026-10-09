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

/* ---- Aba (submódulo) na URL: tabFromLocation + useRouteTab ---- */
test('tabFromLocation — aba de tela de lista vem do 2º segmento', () => {
  const R = loadRouter('/comercial/leads/kanban');
  assert.equal(R.tabFromLocation('leads', 'lista', ['lista', 'kanban']), 'kanban');
});

test('tabFromLocation — sem aba na URL, rota diferente ou aba inválida caem no padrão', () => {
  assert.equal(loadRouter('/comercial/leads').tabFromLocation('leads', 'lista', ['lista', 'kanban']), 'lista');
  assert.equal(loadRouter('/geral/dashboard/kanban').tabFromLocation('leads', 'lista', ['lista', 'kanban']), 'lista');
  assert.equal(loadRouter('/comercial/leads/inventada').tabFromLocation('leads', 'lista', ['lista', 'kanban']), 'lista');
});

test('tabFromLocation — sem lista de válidas aceita qualquer aba; com id lê o 3º segmento', () => {
  assert.equal(loadRouter('/comercial/leads/qualquer').tabFromLocation('leads', 'lista'), 'qualquer');
  const R = loadRouter('/comercial/lead-detail/42/tratativas');
  assert.equal(R.tabFromLocation('lead-detail', 'detalhes', ['detalhes', 'tratativas'], true), 'tratativas');
  assert.equal(R.tabFromLocation('lead-detail', 'detalhes', ['detalhes'], true), 'detalhes');
});

test('tabFromLocation — aba decodificada (ex.: "Importação" em pedidos-acompanhamento)', () => {
  const R = loadRouter('/comercial/leads/Importa%C3%A7%C3%A3o');
  assert.equal(R.tabFromLocation('leads', 'Nacional', ['Nacional', 'Importação']), 'Importação');
});

/* React de mentira: o suficiente pra exercitar o hook sem DOM. */
function loadHook(path) {
  const win = makeFakeWindow(path);
  const state = [];
  let cursor = 0;
  win.React = {
    useState(init) {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof init === 'function' ? init() : init;
      return [state[i], (v) => { state[i] = v; }];
    },
    useEffect(fn) { fn(); },
    useCallback(fn) { return fn; },
  };
  global.window = win;
  delete require.cache[require.resolve('./router.js')];
  require('./router.js');
  const run = (...args) => { cursor = 0; return win.useRouteTab(...args); };
  return { win, run };
}

test('useRouteTab — começa na aba da URL e clicar grava na URL (aba padrão deixa a URL limpa)', () => {
  const { win, run } = loadHook('/comercial/leads/kanban');
  let [tab, setTab] = run('leads', 'lista', ['lista', 'kanban']);
  assert.equal(tab, 'kanban');
  setTab('lista');
  assert.equal(win.location.pathname, '/comercial/leads');
  setTab('kanban');
  assert.equal(win.location.pathname, '/comercial/leads/kanban');
  [tab] = run('leads', 'lista', ['lista', 'kanban']);
  assert.equal(tab, 'kanban');
});

test('useRouteTab — com id preserva o id e grava a aba no 3º segmento', () => {
  const { win, run } = loadHook('/comercial/lead-detail/42');
  const [tab, setTab] = run('lead-detail', 'detalhes', ['detalhes', 'tratativas'], true);
  assert.equal(tab, 'detalhes');
  setTab('tratativas');
  assert.equal(win.location.pathname, '/comercial/lead-detail/42/tratativas');
  setTab('detalhes');
  assert.equal(win.location.pathname, '/comercial/lead-detail/42');
});
