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
            description: 'Atualize a página para usar a versão mais recente.',
            duration: Infinity,
            action: { label: 'Atualizar agora', onClick: () => window.location.reload() },
          });
        } else window.location.reload();
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
