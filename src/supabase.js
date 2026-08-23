/* ============================================================
   supabase.js — Client Supabase + carregador de dados do dashboard
   Carregado como <script> puro antes dos componentes Babel.
   Requer window.supabase (CDN) já carregado.
   ============================================================ */

(function () {
  'use strict';

  const URL_SB  = 'https://jxtqwzmpgofwctqajewt.supabase.co';
  const ANON_SB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4dHF3em1wZ29md2N0cWFqZXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODk3NzcsImV4cCI6MjA5NTA2NTc3N30.hoNuKfSaSLFDKqJ2F331QSDQkzsiphWhLk3xtZh6Bpc';

  const sb = window.supabase.createClient(URL_SB, ANON_SB);

  // ---- SSO Guard — acesso exclusivo via vpsistema.com ------------------
  // O vpsistema.com injeta sso_token + sso_refresh na URL ao abrir o card.
  //
  // IMPORTANTE: sso_token é um JWT do projeto ubdkoqxfwcraftesgmbw (vpsistema).
  // Este app usa o projeto jxtqwzmpgofwctqajewt (vpprd) — projetos distintos,
  // JWT secrets distintos. Não é possível usar setSession() cross-project.
  // O payload do JWT carrega a IDENTIDADE do usuário (e-mail + nome do convite):
  // decodificamos na chegada e validamos no Auth do vpsistema (best-effort).
  const VPSISTEMA_URL  = 'https://ubdkoqxfwcraftesgmbw.supabase.co';
  const VPSISTEMA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZGtvcXhmd2NyYWZ0ZXNnbWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjUwMjcsImV4cCI6MjA5MDY0MTAyN30.s1A15nFQVne94gbz0511L2IYvHdTcgYeL0H8YU80iI8';

  function decodeJwtPayload(token) {
    try {
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(b64).split('').map(function (ch) {
        return '%' + ('00' + ch.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  function userFromAuthPayload(p) {
    if (!p) return null;
    const meta = p.user_metadata || {};
    const email = p.email || meta.email || '';
    const nome = meta.nome || meta.name || meta.full_name || meta.display_name
      || (email ? email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }) : '');
    if (!email && !nome) return null;
    const partes = String(nome).trim().split(/\s+/);
    const iniciais = ((partes[0] || ' ')[0] + ((partes[1] || partes[0] || ' ')[partes.length > 1 ? 0 : 1] || '')).toUpperCase().slice(0, 2) || 'VP';
    return { nome: nome || email, email: email, iniciais: iniciais, id: p.sub || p.id || null };
  }

  function saveUser(u) {
    if (!u) return;
    try { sessionStorage.setItem('vpprd_user', JSON.stringify(u)); } catch (e) {}
    window.__VP_USER = u;
    try { window.dispatchEvent(new CustomEvent('vpprd:user', { detail: u })); } catch (e) {}
  }

  // Link direto perdido no round-trip do SSO (issue #279/#281): o card do
  // vpsistema.com sempre abre a raiz do app, então um deep link
  // (/comercial/lead-detail/42) acessado sem sessão ativa virava sempre
  // dashboard depois do login. Guardamos o path pretendido antes de sair
  // e restauramos assim que o token confirmar a volta — funciona mesmo
  // sem nenhuma cooperação do vpsistema.com (é outro sistema, fora deste
  // repo; não dá pra garantir que ele devolva algo). ?vp_return= vai
  // junto por via das dúvidas, best-effort, caso o portal algum dia passe
  // a repassar esse parâmetro — não é o mecanismo principal.
  const PENDING_DEEPLINK_KEY = 'vpprd_pending_deeplink';
  function currentDeepLinkPath() {
    const p = window.location.pathname;
    return p && p !== '/' ? p : null; // raiz não é link específico de nada
  }

  (function ssoGuard() {
    const params   = new URLSearchParams(window.location.search);
    const ssoToken = params.get('sso_token');

    // Flag de aba corrente (sobrevive a reloads dentro da mesma aba)
    const hasTabFlag = sessionStorage.getItem('vpprd_sso_ok') === '1';

    // Bypass para desenvolvimento local (localhost, 127.0.0.1)
    const isLocalhost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(window.location.hostname);

    // Sem token SSO E sem flag de aba E não está em localhost → acesso direto bloqueado
    if (!ssoToken && !hasTabFlag && !isLocalhost) {
      const pending = currentDeepLinkPath();
      if (pending) {
        try { localStorage.setItem(PENDING_DEEPLINK_KEY, pending); } catch (e) {}
      }
      const returnParam = pending ? '?vp_return=' + encodeURIComponent(pending) : '';
      window.location.replace('https://vpsistema.com' + returnParam);
      return;
    }

    // Em localhost sem token → criar flag de desenvolvimento
    if (isLocalhost && !ssoToken && !hasTabFlag) {
      sessionStorage.setItem('vpprd_sso_ok', '1');
      const devUser = { nome: 'Desenvolvimento', email: 'dev@localhost', iniciais: 'DV', id: 'dev-local' };
      saveUser(devUser);
    }

    // Restaura usuário já capturado nesta aba (reloads)
    try {
      const saved = sessionStorage.getItem('vpprd_user');
      if (saved) window.__VP_USER = JSON.parse(saved);
    } catch (e) {}

    // Token presente → registra autorização, captura a identidade e limpa a URL
    if (ssoToken) {
      sessionStorage.setItem('vpprd_sso_ok', '1');

      // 1) Identidade imediata (síncrona): decodifica o payload do JWT
      const payload = decodeJwtPayload(ssoToken);
      const u = userFromAuthPayload(payload);
      if (u) saveUser(u);

      // 2) Validação assíncrona no Auth do vpsistema (confirma e enriquece;
      //    best-effort — rede/expiração não derruba o acesso já autorizado)
      fetch(VPSISTEMA_URL + '/auth/v1/user', {
        headers: { apikey: VPSISTEMA_ANON, Authorization: 'Bearer ' + ssoToken },
      }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (auth) {
          const confirmado = userFromAuthPayload(auth);
          if (confirmado) saveUser(confirmado);
        })
        .catch(function () { /* offline/expirado: mantém o decode local */ });

      // Restaura o link pretendido, se algum ficou guardado antes do
      // redirecionamento pro login — senão mantém o pathname atual
      // (comportamento de sempre: vpsistema.com manda pra raiz).
      let voltarPara = window.location.pathname;
      try {
        const pendente = localStorage.getItem(PENDING_DEEPLINK_KEY);
        if (pendente) {
          voltarPara = pendente;
          localStorage.removeItem(PENDING_DEEPLINK_KEY);
        }
      } catch (e) {}
      window.history.replaceState({}, '', voltarPara);
    }
  }());

  // ---- helpers --------------------------------------------------------

  function timeAgo(ts) {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2)  return 'agora';
    if (mins < 60) return `há ${mins}min`;
    const h = Math.floor(mins / 60);
    if (h < 24)   return `há ${h}h`;
    const d = Math.floor(h / 24);
    if (d === 1)  return 'ontem';
    return `há ${d}d`;
  }

  // fmtBRL (compacto, R$ 1.2M/R$ 5k) migrou pra dentro de
  // dashboard-metrics-financeiro.js/dashboard-metrics-admin.js — únicos
  // lugares que ainda formatam moeda pro Dashboard.

  // ---- carregador principal -------------------------------------------

  async function loadDashboardData(role) {
    const [
      lR, cotR, projR, alertR,
      tarR, embR, ctR, estR,
      comR, gatR, fichasR, catalogoR,
      propR, avaisR, ncmR
    ] = await Promise.all([
      sb.from('leads').select('*').order('date', { ascending: false }),
      sb.from('cotacoes').select('*').order('date', { ascending: false }),
      sb.from('projetos').select('*').order('start_date'),
      sb.from('alertas').select('*').eq('resolved', false).order('created_at', { ascending: false }),
      sb.from('tarefas').select('*').eq('role', role).eq('done', false).order('id'),
      sb.from('embarques').select('*').order('eta'),
      sb.from('contratos_venda_equipamentos').select('*').order('issued_date', { ascending: false }),
      sb.from('estoque').select('*').order('sku'),
      sb.from('comissoes').select('*').order('id'),
      sb.from('gatilhos').select('*').order('due_date'),
      sb.from('fichas_tecnicas').select('*').order('criado_em', { ascending: false }),
      sb.from('catalogo_produtos').select('*').order('created_at', { ascending: false }),
      // Esteira real (Formulário→Proposta→Contrato→Aval Financeiro) — usada
      // pra corrigir os KPIs do Dashboard Admin, que antes só liam a tabela
      // legada/desconectada `projetos` (achado E2E: Faturamento Total R$0 e
      // Alertas Críticos 0 com proposta assinada de R$185mil e sinal pago).
      sb.from('propostas').select('id, status, valor_total, numero_cotacao, aprovada_em'),
      sb.from('avais_financeiros').select('id, numero_cotacao, status, sinal_pago, contrato_venda_id'),
      // Issue #273: o widget "Pendências NCM" do Dashboard lia um array
      // hardcoded vazio — puxa de verdade agora (ver dashboard-metrics-engenharia.js).
      sb.from('ncm_solicitacoes').select('id, status, created_at'),
    ]);

    const leads     = lR.data    || [];
    const cotacoes  = cotR.data  || [];
    const projetos  = projR.data || [];
    const alertas   = (alertR.data || []).map(a => ({ ...a, time: timeAgo(a.created_at) }));
    const tarefas   = tarR.data  || [];
    const embarques = embR.data  || [];
    const contratos = ctR.data   || [];
    const estoque   = estR.data  || [];
    const comissoes = comR.data  || [];
    const gatilhos  = gatR.data  || [];
    const fichas    = fichasR.data || [];
    const catalogo  = catalogoR.data || [];
    const propostas = propR.data  || [];
    const avais     = avaisR.data || [];
    const ncmSolicitacoes = ncmR.data || [];

    // ---- Comercial (dashboard-metrics-comercial.js) — 1º módulo extraído
    // da revisão de arquitetura do Dashboard. Funções puras, testadas em
    // dashboard-metrics-comercial.test.js. Os outros perfis ainda são
    // calculados aqui embaixo — extração incremental, um módulo por vez. ----
    const CM = window.ComercialMetrics;
    const comercial = CM.compute({ leads, cotacoes, propostas, contratos });

    // ---- Engenharia (dashboard-metrics-engenharia.js) — 2º módulo
    // extraído. Fecha a issue #273 (NCM sempre vazio). ----
    const EM = window.EngenhariaMetrics;
    const engenharia = EM.compute({ projetos, fichas, catalogo, alertas, ncmSolicitacoes });

    // ---- Financeiro (dashboard-metrics-financeiro.js) — 3º módulo extraído. ----
    const FM = window.FinanceiroMetrics;
    const financeiro = FM.compute({ contratos, comissoes, gatilhos });

    // ---- Admin (dashboard-metrics-admin.js) — 5º e último módulo
    // extraído. Único que COMPÕE outro módulo (ComercialMetrics), em vez
    // de refiltrar do zero — ver comentário no próprio arquivo. ----
    const AM = window.AdminMetrics;
    const admin = AM.compute({ projetos, embarques, alertas, propostas, contratos, avais });

    // ---- tarefas no formato esperado pelo Dashboard ----
    const tarefasFmt = tarefas.map(t => ({
      t: t.title,
      time: t.due_time,
      prio: ({ alta: 'Alta', media: 'Média', baixa: 'Baixa' }[String(t.priority || '').toLowerCase()] || t.priority || 'Média'),
      module: t.module,
    }));

    // ---- KPIs por perfil ----
    const kpis = {
      comercial: comercial.kpis,
      engenharia: engenharia.kpis,
      financeiro: financeiro.kpis,
      admin: admin.kpis,
    };

    // ---- Estoque crítico ----
    const estoqueCritico = estoque
      .filter(e => e.qty < e.min_qty)
      .map(e => ({
        sku: e.sku, name: e.name, qty: e.qty, min: e.min_qty,
        status: e.qty <= Math.floor(e.min_qty / 2) ? 'danger' : 'warning',
      }));

    // ---- Gantt (dashboard-metrics-gantt.js) — 4º módulo extraído.
    // Extração comportamento-idêntica: ainda lê a tabela `projetos`
    // legada (issue #274 / Candidato 2, fora do escopo aqui). ----
    const GM = window.ProjetosGanttMetrics;
    const gantt = GM.compute({ projetos });

    return {
      leads, cotacoes, projetos, alertas, tarefas: tarefasFmt,
      embarques, contratos, estoque, comissoes, gatilhos, fichas, catalogo, ncm: engenharia.ncm,
      kpis, pipelineStages: comercial.pipelineStages, originBars: comercial.originBars, estoqueCritico,
      alertasCriticos: admin.alertasCriticos.length,
      ganttToday: gantt.ganttToday, ganttProjetos: gantt.ganttProjetos,
    };
  }

  // ---- expor para componentes React ----
  window.__VP_SB = { sb, loadDashboardData, timeAgo };
}());
