/* ============================================================
   version-check.js — detecta nova versão publicada e avisa o
   usuário, sem forçar reload (evita perder algo que a pessoa
   esteja digitando).

   Deploy é feito por `git pull` direto no servidor (ver
   .github/workflows/deploy.yml), que grava version.json a cada push
   em main com o timestamp + commit do deploy.
   ============================================================ */
(function () {
  const CHECK_INTERVAL_MS = 5 * 60 * 1000;
  const NOTIFIED_BUILD_KEY = 'vp_version_notified_build';
  const JSX_CACHE_DB = 'vp-jsx-cache'; // mesmo nome de src/jsx-loader.js
  let runningBuildTime = null;
  let runningCommit = null;
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
  function fetchChangelog(sinceCommit) {
    if (!sinceCommit) return Promise.resolve([]);
    return fetch('/api/version-changelog?since=' + encodeURIComponent(sinceCommit), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (data && data.ok && Array.isArray(data.commits) ? data.commits : []))
      .catch(() => []);
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
  function formatChangelog(commits) {
    if (!commits.length) return 'Atualize a página para usar a versão mais recente.';
    const shown = commits.slice(0, 5);
    const resto = commits.length - shown.length;
    let texto = 'Novidades desta atualização:\n' + shown.map((c) => '• ' + c).join('\n');
    if (resto > 0) texto += `\n… e mais ${resto} ${resto === 1 ? 'alteração' : 'alterações'}`;
    return texto;
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
    runningCommit = info.commit || null;
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
          fetchChangelog(runningCommit).then((commits) => {
            window.toast(formatUpdateMessage(info.buildTime), 'info', {
              description: formatChangelog(commits),
              duration: Infinity,
              action: { label: 'Atualizar agora', onClick: clearJsxCacheAndReload },
            });
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
