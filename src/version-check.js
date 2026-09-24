/* ============================================================
   version-check.js — detecta nova versão publicada e avisa o
   usuário, sem forçar reload (evita perder algo que a pessoa
   esteja digitando).

   Deploy real: build isolado por commit via integração Git do hPanel
   (Hostinger) — ver readVersionInfo() em server.js, que serve /version.json
   lendo o HEAD do git a cada request (sem histórico de commits anteriores
   no diretório publicado, só o commit atual).
   ============================================================ */
(function () {
  const CHECK_INTERVAL_MS = 5 * 60 * 1000;
  const NOTIFIED_BUILD_KEY = 'vp_version_notified_build';
  const JSX_CACHE_DB = 'vp-jsx-cache'; // mesmo nome de src/jsx-loader.js
  let runningBuildTime = null;
  let notified = false;

  function alreadyNotified(buildTime) {
    try { return localStorage.getItem(NOTIFIED_BUILD_KEY) === buildTime; } catch (e) { return false; }
  }
  function markNotified(buildTime) {
    try { localStorage.setItem(NOTIFIED_BUILD_KEY, buildTime); } catch (e) { /* sem persistência */ }
  }
  function fetchVersion() {
    return fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null)).catch(() => null);
  }
  function announce(info) {
    window.__VP_VERSION = info;
    window.dispatchEvent(new CustomEvent('vpprd:version', { detail: info }));
  }
  function formatUpdateMessage(buildTime) {
    const d = new Date(buildTime);
    if (isNaN(d.getTime())) return 'Este site foi atualizado.';
    const date = d.toLocaleDateString('pt-BR');
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `Este site foi atualizado em ${date} às ${time}h`;
  }
  /* Só o assunto do commit ATUAL (não um range/lista de commits): o deploy
     na Hostinger é um build isolado por commit, sem histórico de commits
     anteriores no diretório publicado — testado ao vivo em produção,
     confirmando que uma rota baseada em `git log <sha antigo>..HEAD`
     nunca teria o que responder ali (ver server.js). Se pular mais de uma
     versão entre checagens (raro, intervalo de 5min), mostra só a mais
     recente — correto por ser real, mesmo que incompleto. Commits de merge
     genéricos ("Merge ...") não dizem nada ao usuário, então caem no
     texto padrão em vez de aparecer como "novidade". */
  function formatChangelog(commitSubject) {
    const s = (commitSubject || '').trim();
    if (!s || /^merge\b/i.test(s)) return 'Atualize a página para usar a versão mais recente.';
    return 'Novidade desta atualização:\n• ' + s;
  }

  /* Zera o cache de compilação JSX (IndexedDB — ver src/jsx-loader.js) antes
     de recarregar. Sem isso, "Atualizar agora" só dava reload da página, mas
     o loader podia reaproveitar JS compilado da versão antiga guardado no
     IndexedDB (só é invalidado por-arquivo quando o ?v= daquele .jsx muda) —
     esse botão precisa garantir a atualização mesmo se algum ?v= tiver sido
     esquecido no deploy. NÃO mexe em sessionStorage/localStorage: é lá
     (vpprd_sso_ok/vpprd_user em sessionStorage, ver src/supabase.js) que
     mora a sessão SSO do vpsistema.com — apagar isso derrubaria o usuário
     pra tela de login à toa, o que o usuário pediu explicitamente pra evitar. */
  function clearJsxCacheAndReload() {
    let done = false;
    const reload = () => { if (!done) { done = true; window.location.reload(); } };
    try {
      if (!window.indexedDB || !indexedDB.deleteDatabase) return reload();
      const req = indexedDB.deleteDatabase(JSX_CACHE_DB);
      req.onsuccess = reload;
      req.onerror = reload;
      req.onblocked = reload; // outra aba com o DB aberto: recarrega mesmo assim
      setTimeout(reload, 800); // rede/IDB lenta não pode travar o clique
    } catch (e) { reload(); }
  }

  fetchVersion().then((info) => {
    if (!info || !info.buildTime) return;
    runningBuildTime = info.buildTime;
    announce(info);
  });

  function check() {
    if (notified || runningBuildTime === null) return;
    fetchVersion().then((info) => {
      if (!info || !info.buildTime) return;
      if (info.buildTime !== runningBuildTime) {
        if (alreadyNotified(info.buildTime)) { notified = true; return; }
        notified = true; markNotified(info.buildTime);
        if (typeof window.toast === 'function') {
          window.toast(formatUpdateMessage(info.buildTime), 'info', {
            description: formatChangelog(info.commitSubject),
            duration: Infinity,
            action: { label: 'Atualizar agora', onClick: clearJsxCacheAndReload },
          });
        } else clearJsxCacheAndReload();
      }
    });
  }

  setInterval(check, CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('online', check);

  /* Ajuda contextual: carregada como módulo independente para não acoplar
     o tutorial à lógica comercial. O script só atua quando Pipeline de Leads
     está renderizado; nas demais telas permanece inerte. */
  const helpScript = document.createElement('script');
  helpScript.src = '/src/leads-tooltips.js?v=1';
  helpScript.defer = true;
  document.head.appendChild(helpScript);
})();
