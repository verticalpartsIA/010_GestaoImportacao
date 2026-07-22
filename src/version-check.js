/* ============================================================
   version-check.js — detecta nova versão publicada e avisa o
   usuário, sem forçar reload (evita perder algo que a pessoa
   esteja digitando).

   Deploy é feito por `git pull` direto no servidor (ver
   .github/workflows/deploy.yml), que grava version.json a cada push
   em main com o timestamp + commit do deploy.

   1. No carregamento: busca version.json (sem cache) e expõe em
      window.__VP_VERSION — a Sidebar usa isso pra mostrar "atualizado
      em DD/MM HH:MMh".
   2. Em segundo plano: a cada 5 min, quando a aba volta a ficar visível
      e ao reconectar à rede, busca version.json de novo. Se o servidor
      tiver uma versão mais nova que a que está rodando nesta aba, mostra
      um toast persistente com botão "Atualizar agora" (window.toast,
      ver toast.jsx) — quem quiser continua trabalhando e atualiza quando
      quiser. Servidor já manda version.json com Cache-Control: no-cache
      (server.js), então abrir o site do zero já vem com a versão certa;
      isso aqui cobre só a aba que já estava aberta antes do deploy.
   ============================================================ */
(function () {
  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
  /* Compartilhado entre abas da mesma origem — sem isso, quem tem mais de
     uma aba aberta do site vê o mesmo aviso "loopar" de aba em aba (cada
     aba roda esta IIFE de novo, com sua própria variável `notified` em
     memória, mas todas comparam contra o mesmo version.json). */
  const NOTIFIED_BUILD_KEY = 'vp_version_notified_build';

  let runningBuildTime = null;
  let notified = false;

  function alreadyNotified(buildTime) {
    try {
      return localStorage.getItem(NOTIFIED_BUILD_KEY) === buildTime;
    } catch (e) {
      return false;
    }
  }

  function markNotified(buildTime) {
    try {
      localStorage.setItem(NOTIFIED_BUILD_KEY, buildTime);
    } catch (e) {
      // localStorage indisponível — sem persistência, mas a checagem
      // desta aba continua funcionando normalmente.
    }
  }

  function fetchVersion() {
    return fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
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

  /* Primeira leitura: define a linha de base e já alimenta a Sidebar. */
  fetchVersion().then((info) => {
    if (!info || !info.buildTime) return;
    runningBuildTime = info.buildTime;
    announce(info);
  });

  /* Checagens seguintes: se o servidor tiver versão mais nova que a
     linha de base desta aba, avisa com um toast (não recarrega sozinho). */
  function check() {
    if (notified || runningBuildTime === null) return;
    fetchVersion().then((info) => {
      if (!info || !info.buildTime) return;
      if (info.buildTime !== runningBuildTime) {
        if (alreadyNotified(info.buildTime)) {
          notified = true;
          return;
        }
        notified = true;
        markNotified(info.buildTime);
        if (typeof window.toast === 'function') {
          window.toast(formatUpdateMessage(info.buildTime), 'info', {
            description: 'Atualize a página para usar a versão mais recente.',
            duration: Infinity,
            action: { label: 'Atualizar agora', onClick: () => window.location.reload() },
          });
        } else {
          // toast.jsx ainda não carregou (não deveria acontecer, já que a
          // primeira checagem real só ocorre minutos depois do boot) — não
          // deixa o usuário sem aviso nenhum.
          window.location.reload();
        }
      }
    });
  }

  setInterval(check, CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('online', check);
})();
