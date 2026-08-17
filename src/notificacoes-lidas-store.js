/* ============================================================
   notificacoes-lidas-store.js
   Persistência de "lido" da Central de Notificações (Candidato 2
   da revisão de arquitetura — ver issue #275). Antes vivia só em
   localStorage (`vpprd.notificacoes.lidas`) dentro de NotificacoesPage:
   se limpava o cache, perdia o histórico; não sincronizava entre
   dispositivos do mesmo usuário. Agora é uma linha por (alerta, email)
   em `notificacoes_lidas` — upsert idempotente via a constraint
   unique(alerta_id, user_email).

   window.NotificacoesLidasStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }
  function emailAtual() { return (window.__VP_USER || {}).email || null; }

  /* IDs de alertas já lidos pelo usuário atual. */
  async function carregar(userEmail) {
    const c = sb(); const email = userEmail || emailAtual();
    if (!c || !email) return [];
    const { data, error } = await c.from('notificacoes_lidas').select('alerta_id').eq('user_email', email);
    if (error) { window.toast?.('Erro ao carregar notificações lidas: ' + error.message, 'error'); return []; }
    return (data || []).map((r) => r.alerta_id);
  }

  async function marcarLida(alertaId, userEmail) {
    const c = sb(); const email = userEmail || emailAtual();
    if (!c || !email || !alertaId) return;
    const { error } = await c.from('notificacoes_lidas')
      .upsert({ alerta_id: String(alertaId), user_email: email }, { onConflict: 'alerta_id,user_email' });
    if (error) window.toast?.('Erro ao marcar notificação como lida: ' + error.message, 'error');
  }

  async function marcarTodasLidas(alertaIds, userEmail) {
    const c = sb(); const email = userEmail || emailAtual();
    if (!c || !email || !(alertaIds || []).length) return;
    const rows = alertaIds.map((id) => ({ alerta_id: String(id), user_email: email }));
    const { error } = await c.from('notificacoes_lidas').upsert(rows, { onConflict: 'alerta_id,user_email' });
    if (error) window.toast?.('Erro ao marcar notificações como lidas: ' + error.message, 'error');
  }

  window.NotificacoesLidasStore = { carregar, marcarLida, marcarTodasLidas };
}());
