/* ============================================================
   jsx-loader.js — Cache de compilação JSX no navegador
   ------------------------------------------------------------
   O sistema interno carrega ~40 arquivos .jsx transpilados pelo
   Babel Standalone no próprio navegador. Fazer isso a CADA carga
   trava a thread principal por vários segundos (achado E2E #6:
   "timeout ao voltar da URL pública pro sistema"). Este loader
   compila cada arquivo uma vez e guarda o resultado em IndexedDB,
   chaveado pela URL COM o ?v=. Cargas seguintes (inclusive voltar
   do formulário público) pulam o Babel e executam o JS já pronto.

   Como substitui o auto-runner do Babel:
   - Os <script> dos .jsx no index.html usam type="text/vp-jsx"
     (em vez de "text/babel"), então o Babel NÃO os toca.
   - O navegador também não busca/executa scripts de tipo
     desconhecido — este loader é o único responsável por eles.

   Invariantes preservadas do comportamento antigo:
   - Todos os .js puros já rodaram (parser-blocking) antes do
     DOMContentLoaded; este loader roda no DOMContentLoaded, então
     todo .jsx continua vendo qualquer global definido por .js.
   - Os .jsx executam na MESMA ordem do DOM, sequencialmente, em
     escopo GLOBAL (sourceType 'script') — igual ao Babel antigo.

   Degradação graciosa: sem IndexedDB (aba privada etc.) ou em
   qualquer erro de cache, cai pra compilar-sempre (comportamento
   antigo). Falha de fetch/compile/exec de um arquivo é logada com
   o nome do arquivo, não engolida.
   ============================================================ */
(function () {
  'use strict';

  var DB_NAME = 'vp-jsx-cache';
  var STORE = 'compiled';
  var SELECTOR = 'script[type="text/vp-jsx"]';
  // Versão do COMPILADOR. Faz parte da chave de cache: qualquer mudança na
  // função compile() (presets/plugins) precisa incrementar isto pra invalidar
  // todo o cache antigo (senão reusa JS compilado pela regra velha). O GC no
  // fim do boot apaga as entradas de versões antigas.
  var CACHE_VERSION = 'c2';

  function keyFor(url) { return CACHE_VERSION + '::' + url; }

  function openDB() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) return resolve(null);
      var req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { return resolve(null); }
      req.onupgradeneeded = function () {
        try { req.result.createObjectStore(STORE); } catch (e) { /* já existe */ }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
      req.onblocked = function () { resolve(null); };
    });
  }

  function idbGet(db, key) {
    return new Promise(function (resolve) {
      if (!db) return resolve(null);
      try {
        var r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        r.onsuccess = function () { resolve(r.result || null); };
        r.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }

  function idbPut(db, key, val) {
    return new Promise(function (resolve) {
      if (!db) return resolve();
      try {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(val, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
        tx.onabort = function () { resolve(); };
      } catch (e) { resolve(); }
    });
  }

  function idbAllKeys(db) {
    return new Promise(function (resolve) {
      if (!db) return resolve([]);
      try {
        var r = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
        r.onsuccess = function () { resolve(r.result || []); };
        r.onerror = function () { resolve([]); };
      } catch (e) { resolve([]); }
    });
  }

  function idbDel(db, key) {
    return new Promise(function (resolve) {
      if (!db) return resolve();
      try {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) { resolve(); }
    });
  }

  /* Executa código já compilado em escopo GLOBAL (como o Babel fazia):
     um <script> inline roda sincronamente ao ser anexado. O sourceURL
     mantém o nome do arquivo no DevTools/stack traces. */
  function runGlobal(code, url) {
    var s = document.createElement('script');
    s.textContent = code + '\n//# sourceURL=' + url;
    (document.head || document.documentElement).appendChild(s);
    if (s.parentNode) s.parentNode.removeChild(s);
  }

  function compile(src) {
    // presets ['react'] = só transforma JSX; JS moderno (?., ??, campos de
    // classe) passa direto, rodado nativamente pelo browser.
    // plugin transform-block-scoping = converte const/let -> var, igual ao
    // que o auto-runner do Babel Standalone já fazia. Sem isso, dois arquivos
    // que declaram o MESMO const no topo (ex.: UF_LIST em contrato-editor e
    // proposta-form) colidiam em escopo global ("already declared"), já que
    // cada .jsx executa em escopo global (pra os globais cruzarem arquivos).
    return window.Babel.transform(src, {
      presets: ['react'],
      plugins: ['transform-block-scoping'],
      sourceType: 'script',
    }).code;
  }

  function fail(stage, url, err) {
    console.error('[jsx-loader] ' + stage + ' falhou: ' + url, err);
  }

  function boot() {
    var tags = Array.prototype.slice.call(document.querySelectorAll(SELECTOR));
    var urls = [];
    for (var i = 0; i < tags.length; i++) {
      var u = tags[i].getAttribute('src');
      if (u) urls.push(u);
    }
    if (!window.Babel) { console.error('[jsx-loader] Babel não carregou — app não pode iniciar.'); return; }

    openDB().then(function (db) {
      var current = {};
      var chain = Promise.resolve();

      urls.forEach(function (url) {
        var key = keyFor(url);
        current[key] = true;
        chain = chain.then(function () {
          return idbGet(db, key).then(function (code) {
            if (code != null) return code;
            return fetch(url).then(function (res) {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.text();
            }).then(function (src) {
              var out = compile(src);
              // grava sem bloquear a execução (fire-and-forget)
              idbPut(db, key, out);
              return out;
            }).catch(function (err) { fail('fetch/compile', url, err); return null; });
          });
        }).then(function (code) {
          if (code == null) return;
          try { runGlobal(code, url); } catch (err) { fail('execução', url, err); }
        });
      });

      // Depois de tudo rodar: marca o tempo (pra diagnóstico) e limpa versões
      // antigas (chaves que saíram do manifesto por ?v= ou CACHE_VERSION novo)
      // pra o cache não crescer sem fim.
      chain.then(function () {
        try {
          performance.mark('vp-jsx-loaded');
          window.__vpJsxLoadedMs = Math.round(performance.now());
        } catch (e) { /* noop */ }
        idbAllKeys(db).then(function (keys) {
          keys.forEach(function (k) { if (!current[k]) idbDel(db, k); });
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
