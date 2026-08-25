/* ============================================================
   router.js — VP Gestão · Roteamento por URL (Fase 1 da série de
   roteirização, issues #278-#282)

   Espelha `route` (+ id de detalhe, quando existir) na URL via
   window.history.pushState/popstate. Zero dependência nova: este
   projeto é React UMD + Babel Standalone via CDN, sem bundler — uma
   lib como react-router-dom v6+ não tem build UMD instalável aqui
   (decisão registrada na issue #278).

   Carrega DEPOIS de supabase.js e ANTES de shell.jsx/app.jsx. O
   guard de SSO em supabase.js só mexe na query string (sso_token),
   nunca no pathname (window.history.replaceState({}, '', pathname)),
   então este router pode usar o pathname livremente sem conflito.

   window.VpRouter
   ============================================================ */
(function () {
  'use strict';

  /* Lista de rotas válidas — precisa ficar em sincronia com o switch(route)
     de src/app.jsx. Se uma rota nova for adicionada lá, adicionar aqui
     também (checklist já existe pro ?v= do index.html; este é o mesmo
     tipo de lembrete). */
  const KNOWN_ROUTES = [
    'dashboard', 'notificacoes', 'decisoes', 'financeiro',
    'leads', 'lead-detail', 'formularios', 'formulario-elevador', 'controle-cotacoes',
    'cotacoes-fornecedor', 'cotacao-fornecedor-detail', 'precificacao', 'propostas', 'proposta-editor',
    'aval-financeiro',
    'cadastro-clientes', 'cadastro-fornecedores', 'ncm-catalogo', 'cadastro-instaladores',
    'juridico', 'contrato-venda-equipamentos', 'contrato-instalador', 'contrato-editor',
    'importacao', 'importacao-detail', 'importacao-rastreamento', 'importacao-email',
    'gi-painel', 'pi-importacao', 'rfq-importacao', 'ims-importacao', 'embarques-importacao', 'gi-analise-precos',
    'compras', 'compras-email', 'pedidos-acompanhamento',
    'engenharia', 'eng-projeto-elevadores', 'eng-configurador', 'desenho-tecnico', 'ficha-tecnica',
    'ncm-kanban', 'ncm-detail',
    'status-obras', 'linha-do-tempo', 'dossier-obra', 'vistorias', 'instalacao',
    'art', 'cronograma', 'databook', 'handover',
    'rh-homologacao',
    'almoxarifado',
    'logs', 'configuracoes', 'comissoes',
  ];
  const KNOWN_ROUTES_SET = new Set(KNOWN_ROUTES);

  /* Módulo (grupo do menu, via BREADCRUMB_MAP de shell.jsx) -> slug da
     URL. Só o 1º segmento; o 2º é o próprio id de rota (já é kebab-case).
     shell.jsx carrega DEPOIS deste arquivo, então window.BREADCRUMB_MAP
     só existe quando estas funções são chamadas em runtime — nunca no
     carregamento deste script. */
  const MODULE_SLUG = {
    'Dashboard': 'geral',
    'Notificações': 'geral',
    'Comercial': 'comercial',
    'Operações': 'engenharia',
    'Jurídico': 'juridico',
    'Cadastros': 'cadastros',
    'Engenharia': 'engenharia',
    'Logística': 'logistica',
    'Importação': 'logistica',
    'Suprimentos': 'logistica',
    'Instalação & Entrega': 'engenharia',
    'Financeiro': 'adm-financeiro',
    'RH Operacional': 'rh',
    'Admin': 'admin',
  };
  const DEFAULT_MODULE_SLUG = 'geral';

  function moduleSlugFor(routeId) {
    const bc = (window.BREADCRUMB_MAP || {})[routeId];
    const moduleLabel = bc && bc.module;
    return MODULE_SLUG[moduleLabel] || DEFAULT_MODULE_SLUG;
  }

  function isKnownRoute(routeId) {
    return KNOWN_ROUTES_SET.has(routeId);
  }

  function buildPath(routeId, id) {
    if (!routeId || !isKnownRoute(routeId)) return '/';
    let path = '/' + moduleSlugFor(routeId) + '/' + routeId;
    if (id !== undefined && id !== null && id !== '') path += '/' + encodeURIComponent(String(id));
    return path;
  }

  /* Lê a URL atual -> { route, id }. `route` só vem preenchido se for
     uma rota conhecida (protege contra path arbitrário/digitado à mão). */
  function parseLocation() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return { route: null, id: null };
    const routeId = parts[1];
    if (!isKnownRoute(routeId)) return { route: null, id: null };
    const id = parts.length > 2 ? decodeURIComponent(parts[2]) : null;
    return { route: routeId, id: id };
  }

  let listeners = [];
  function notify() {
    const loc = parseLocation();
    listeners.forEach(function (fn) { try { fn(loc); } catch (e) { /* isola erro de um listener */ } });
  }
  window.addEventListener('popstate', notify);

  /* Atualiza a URL pra refletir route/id atuais. Não dispara popstate
     (browser só dispara em navegação real, back/forward) — quem chama
     já está de posse do estado novo. Sem-op se a URL já é a mesma,
     o que também evita loop quando esta função é chamada em reação a
     um popstate que o próprio browser já aplicou. */
  function navigate(routeId, id, opts) {
    opts = opts || {};
    const path = buildPath(routeId, id);
    if (path === window.location.pathname) return;
    if (opts.replace) window.history.replaceState({}, '', path);
    else window.history.pushState({}, '', path);
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function unsubscribe() {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }

  window.VpRouter = {
    KNOWN_ROUTES: KNOWN_ROUTES,
    isKnownRoute: isKnownRoute,
    buildPath: buildPath,
    parseLocation: parseLocation,
    navigate: navigate,
    subscribe: subscribe,
  };
}());
