/* ============================================================
   version-check.js — detecta nova versão publicada e mantém o
   usuário sempre na versão mais nova, sem depender de ninguém notar.

   Deploy é feito por `git pull` direto no servidor (ver
   .github/workflows/deploy.yml), que grava version.json a cada push
   em main com o timestamp + commit do deploy.

   1. No carregamento: busca version.json (sem cache) e expõe em
      window.__VP_VERSION — a Sidebar usa isso pra mostrar "atualizado
      em DD/MM HH:MMh".
   2. Em segundo plano: a cada 5 min, quando a aba volta a ficar visível
      e ao reconectar à rede, busca version.json de novo. Se o servidor
      tiver uma versão mais nova que a que está rodando nesta aba,
      recarrega a página sozinho — sem aviso, sem clique. Servidor já
      manda version.json com Cache-Control: no-cache (server.js), então
      abrir o site do zero já vem com a versão certa; isso aqui cobre
      só a aba que já estava aberta antes do deploy.
   ============================================================ */
(function () {
  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

  let runningBuildTime = null;
  let reloading = false;

  function fetchVersion() {
    return fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }

  function announce(info) {
    window.__VP_VERSION = info;
    window.dispatchEvent(new CustomEvent('vpprd:version', { detail: info }));
  }

  /* Primeira leitura: define a linha de base e já alimenta a Sidebar. */
  fetchVersion().then((info) => {
    if (!info || !info.buildTime) return;
    runningBuildTime = info.buildTime;
    announce(info);
  });

  /* Checagens seguintes: se o servidor tiver versão mais nova que a
     linha de base desta aba, recarrega sozinho — sem aviso. */
  function check() {
    if (reloading || runningBuildTime === null) return;
    fetchVersion().then((info) => {
      if (!info || !info.buildTime) return;
      if (info.buildTime !== runningBuildTime) {
        reloading = true;
        window.location.reload();
      }
    });
  }

  setInterval(check, CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('online', check);
})();
