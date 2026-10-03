/* ============================================================
   notificacoes-lidas-store.js
   Estado da Central de Notificações POR PESSOA + leitura dos alertas.
   - "Lido" e "Arquivado" vivem em `notificacoes_lidas` (uma linha por alerta × e-mail, unique(alerta_id, user_email)).
     Arquivar some da lista DESSA pessoa; o alerta dos outros não muda (por isso é por pessoa, e não `alertas.resolved`).
   - `carregarAlertas()` é a ÚNICA leitura dos alertas visíveis à pessoa (globais + os dirigidos ao e-mail dela + os 3
     sintéticos do Dashboard). A página e o contador do sino usam a mesma função, então os números nunca divergem.
   - Preferências (Financeiro / Operações / Comercial) ficam no navegador; módulos fora dessas categorias nunca somem.
   - `useNaoLidas()` = contador do sino do cabeçalho; atualiza sozinho (5 min) e na hora que a Central avisa.

   window.NotificacoesLidasStore
   ============================================================ */
(function () {
  'use strict';

  const CHAVE_PREFS = 'vpprd.notificacoes.preferencias';
  const EVENTO = 'vp:notificacoes';

  function sb() { return (window.__VP_SB || {}).sb; }
  function emailAtual() { return (window.__VP_USER || {}).email || null; }
  function avisar(detalhe) {
    try { window.dispatchEvent(new CustomEvent(EVENTO, { detail: detalhe || {} })); } catch (e) { /* sem DOM */ }
  }

  /* Estado da pessoa: { lidas: [alerta_id], arquivadas: [alerta_id] }. */
  async function carregarEstado(userEmail) {
    const c = sb(); const email = userEmail || emailAtual();
    if (!c || !email) return { lidas: [], arquivadas: [] };
    const { data, error } = await c.from('notificacoes_lidas').select('alerta_id, arquivada').eq('user_email', email);
    if (error) { window.toast?.('Erro ao carregar notificações lidas: ' + error.message, 'error'); return { lidas: [], arquivadas: [] }; }
    const rows = data || [];
    return { lidas: rows.map((r) => r.alerta_id), arquivadas: rows.filter((r) => r.arquivada).map((r) => r.alerta_id) };
  }

  /* IDs de alertas já lidos pelo usuário atual (compatível com o uso antigo). */
  async function carregar(userEmail) { return (await carregarEstado(userEmail)).lidas; }

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

  /* Arquivar / desarquivar para a pessoa atual (arquivar também conta como lida). */
  async function definirArquivada(alertaIds, arquivada, userEmail) {
    const c = sb(); const email = userEmail || emailAtual();
    if (!c || !email || !(alertaIds || []).length) return false;
    const agora = new Date().toISOString();
    const rows = alertaIds.map((id) => ({ alerta_id: String(id), user_email: email, arquivada: !!arquivada, arquivada_em: arquivada ? agora : null }));
    const { error } = await c.from('notificacoes_lidas').upsert(rows, { onConflict: 'alerta_id,user_email' });
    if (error) { window.toast?.('Erro ao ' + (arquivada ? 'arquivar' : 'restaurar') + ' notificação: ' + error.message, 'error'); return false; }
    return true;
  }
  const arquivar = (ids, email) => definirArquivada(ids, true, email);
  const desarquivar = (ids, email) => definirArquivada(ids, false, email);

  /* Alertas visíveis à pessoa: globais (destinatario_email nulo) + os dirigidos ao e-mail dela + sintéticos do Dashboard.
     O filtro por destinatário é de exibição (a leitura da tabela é pública — limite conhecido, issue #571). */
  async function carregarAlertas() {
    const c = sb(); if (!c) throw new Error('Supabase não carregou.');
    const email = emailAtual();
    let query = c.from('alertas').select('*').eq('resolved', false);
    query = email ? query.or(`destinatario_email.is.null,destinatario_email.eq.${email}`) : query.is('destinatario_email', null);
    const [alertasR, propR, ctR, avaisR] = await Promise.all([
      query.order('created_at', { ascending: false }),
      c.from('propostas').select('id, status, numero_cotacao, aprovada_em'),
      c.from('contratos_venda_equipamentos').select('id, proposta_id, valor_total_num').or('status.is.null,status.neq.em_preenchimento'),
      c.from('avais_financeiros').select('id, numero_cotacao, sinal_pago, contrato_venda_id'),
    ]);
    if (alertasR.error) throw alertasR.error;
    const sinteticos = window.AdminMetrics
      ? window.AdminMetrics.alertasSinteticosDetalhados({ propostas: propR.data || [], contratos: ctR.data || [], avais: avaisR.data || [] })
      : [];
    return [...(alertasR.data || []), ...sinteticos];
  }

  function lerPreferencias() {
    const padrao = (window.NotificacoesProcessamento || {}).PREFERENCIAS_PADRAO || { financeiro: true, operacoes: true, comercial: true };
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_PREFS) || 'null');
      return salvo && typeof salvo === 'object' ? { ...padrao, ...salvo } : { ...padrao };
    } catch (e) { return { ...padrao }; }
  }
  function salvarPreferencias(prefs) {
    try { localStorage.setItem(CHAVE_PREFS, JSON.stringify(prefs)); } catch (e) { /* sem storage */ }
    avisar();
  }

  /* Notificações que a pessoa de fato vê: sem arquivadas e respeitando as preferências. */
  function visiveis(alertas, estado, prefs) {
    const NP = window.NotificacoesProcessamento;
    const arq = new Set((estado.arquivadas || []).map(String));
    return NP.processarAlertas(alertas, estado.lidas).filter((n) => !arq.has(String(n.id)) && NP.visivelPorPreferencia(n, prefs));
  }

  /* Hook do sino do cabeçalho: nº de não lidas. */
  function useNaoLidas() {
    const R = window.React;
    const [n, setN] = R.useState(0);
    R.useEffect(() => {
      let vivo = true;
      const calcular = async () => {
        try {
          const [alertas, estado] = await Promise.all([carregarAlertas(), carregarEstado()]);
          const nots = visiveis(alertas, estado, lerPreferencias());
          if (vivo) setN(window.NotificacoesProcessamento.naoLidas(nots).length);
        } catch (e) { /* o sino fica com o último valor */ }
      };
      calcular();
      const timer = setInterval(calcular, 300000);
      const ouvir = (ev) => {
        if (ev && ev.detail && typeof ev.detail.naoLidas === 'number') { if (vivo) setN(ev.detail.naoLidas); }
        else calcular();
      };
      window.addEventListener(EVENTO, ouvir);
      return () => { vivo = false; clearInterval(timer); window.removeEventListener(EVENTO, ouvir); };
    }, []);
    return n;
  }

  window.NotificacoesLidasStore = {
    carregar, carregarEstado, marcarLida, marcarTodasLidas, arquivar, desarquivar,
    carregarAlertas, lerPreferencias, salvarPreferencias, visiveis, useNaoLidas, avisar,
  };
}());
