/* ============================================================
   supabase.js — Client Supabase + carregador de dados do dashboard
   Carregado como <script> puro antes dos componentes Babel.
   Requer window.supabase (CDN) já carregado.
   ============================================================ */

(function () {
  'use strict';

  const URL_SB  = 'https://jxtqwzmpgofwctqajewt.supabase.co';
  const ANON_SB = 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP';

  /* F0 (Gelson, 09/10/2026): as consultas passam por VpAuth.fetchDados, que põe a sessão individual da pessoa
     (quando o modo está 'on' para ela — ver vp-auth.js) e, se o banco recusar, refaz com a chave pública. */
  const sb = window.supabase.createClient(URL_SB, ANON_SB, {
    global: {
      fetch: function (input, init) {
        return (window.VpAuth && window.VpAuth.fetchDados) ? window.VpAuth.fetchDados(input, init) : fetch(input, init);
      },
    },
  });

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

    // Segurança real (#571) — troca o login do vpsistema por uma sessão nativa do vpprd (Edge Function
    // sso-exchange). Em modo 'shadow' só observa; em 'on' (piloto F0) o cliente de dados acima passa a usar a
    // sessão. Uma falha aqui nunca quebra o app (VpAuth.init não lança; sem sessão = chave pública).
    try {
      if (window.VpAuth) {
        window.VpAuth.init({ ssoToken: ssoToken || null }).then(function () {
          const s = window.VpAuth.status();
          if (s.modo !== 'off') console.info('[VpAuth] modo=' + s.modo + ' estado=' + s.estado + (s.motivo ? ' (' + s.motivo + ')' : ''));
        });
      }
    } catch (e) { /* sombra: nunca bloqueia */ }
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

  /* Achado A02 da auditoria: o seletor Hoje/7/30/90 dias do Dashboard
     mudava o rótulo do botão sem filtrar nenhum dado. period vem como o
     rótulo exato mostrado na tela; undefined preserva o comportamento
     antigo (sem filtro) pra não quebrar chamadas existentes. */
  function periodoParaData(period) {
    if (!period) return null;
    const agora = new Date();
    if (period === 'Hoje') { const d = new Date(agora); d.setHours(0, 0, 0, 0); return d; }
    const dias = { '7 dias': 7, '30 dias': 30, '90 dias': 90 }[period];
    if (!dias) return null;
    return new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);
  }

  async function loadDashboardData(role, period) {
    const [
      lR, alertR,
      tarR, embR, ctR,
      comR, gatR, fichasR, catalogoR,
      propR, avaisR,
      formR, cliR, instR
    ] = await Promise.all([
      sb.from('leads').select('*').is('excluido_em', null).order('date', { ascending: false }),
      // Mesma regra de destinatário da Central de Notificações (antes o Dashboard contava alertas dirigidos a outras pessoas).
      (() => {
        const q = sb.from('alertas').select('*').eq('resolved', false);
        const em = (window.__VP_USER || {}).email || null;
        return (em ? q.or(`destinatario_email.is.null,destinatario_email.eq.${em}`) : q.is('destinatario_email', null)).order('created_at', { ascending: false });
      })(),
      sb.from('tarefas').select('*').eq('role', role).eq('done', false).order('id'),
      sb.from('embarques').select('*').eq('teste', false).order('eta'),
      sb.from('contratos_venda_equipamentos').select('*').or('status.is.null,status.neq.em_preenchimento').order('issued_date', { ascending: false }),
      sb.from('comissoes').select('*').order('id'),
      sb.from('gatilhos').select('*').order('due_date'),
      sb.from('fichas_tecnicas').select('*').order('criado_em', { ascending: false }),
      sb.from('catalogo_produtos').select('*').order('created_at', { ascending: false }),
      // Esteira real (Formulário→Proposta→Contrato→Aval Financeiro) — usada
      // pra corrigir os KPIs do Dashboard Admin, que antes só liam a tabela
      // legada/desconectada `projetos` (achado E2E: Faturamento Total R$0 e
      // Alertas Críticos 0 com proposta assinada de R$185mil e sinal pago).
      // ativos:data_json->ativos — só o array de ativos (com
      // custoInstalacaoMaoDeObraRs por equipamento, ver proposta-heranca.js),
      // não o data_json inteiro (evita puxar o JSON grande da proposta toda
      // só pra comparar custo de instalação no Dashboard).
      // cliente_id: usado por ComercialMetrics.conversaoLeadProposta() pra
      // casar lead → proposta pelo cliente (propostas não tem lead_id).
      sb.from('propostas').select('id, status, valor_total, numero_cotacao, aprovada_em, cliente_id, ativos:data_json->ativos'),
      sb.from('avais_financeiros').select('id, numero_cotacao, status, sinal_pago, contrato_venda_id'),
      // Issue #274 (23/08): "Projetos em Andamento" (Gantt/Kanban/Lista) lia
      // só a tabela `projetos`, legada e sempre vazia em produção. cliente/
      // obra por numero_cotacao vêm daqui pra montar o projeto sintético
      // real em dashboard-metrics-gantt.js (projetosDaEsteira).
      // vendedor/created_by: achado real (03/10) — alimenta "Responsável"
      // no modal de detalhe do projeto (campo morto até então).
      sb.from('formularios_elevador').select('numero_cotacao, cliente_id, local_obra_cidade, vendedor, created_by'),
      sb.from('clientes').select('id, nome_fantasia, razao_social'),
      // Instalação: contratado x previsto (Fase 3d "capítulo leve" da
      // granularidade de custo) — só os campos usados na comparação.
      sb.from('contratos_instalador').select('id, valor_total, proposta_id, ativos_indices, status'),
    ]);

    const leads     = lR.data    || [];
    const alertas   = (alertR.data || []).map(a => ({ ...a, time: timeAgo(a.created_at) }));
    const tarefas   = tarR.data  || [];
    const embarques = embR.data  || [];
    const contratos = ctR.data   || [];
    const comissoes = comR.data  || [];
    const gatilhos  = gatR.data  || [];
    const fichas    = fichasR.data || [];
    const catalogo  = catalogoR.data || [];
    const propostas = propR.data  || [];
    const avais     = avaisR.data || [];
    const formularios = formR.data || [];
    const contratosInstalador = instR.data || [];
    const clientesPorId = {};
    (cliR.data || []).forEach((c) => { clientesPorId[c.id] = c; });

    // ---- Esteira real (gatilhos+formulários) reconciliada em "projeto
    // sintético" — fonte única de "projeto/cotação aberta" pro Dashboard
    // inteiro (Gantt/Kanban/Lista, "Projetos ativos" do Admin e, desde
    // 03/10, "Projetos abertos" da Engenharia também). Calculada ANTES dos
    // módulos de perspectiva porque mais de um perfil precisa dela. ----
    const GM = window.ProjetosGanttMetrics;
    const projetosReais = GM.projetosDaEsteira({ gatilhos, formularios, clientesPorId, propostas });

    // ---- Comercial (dashboard-metrics-comercial.js) — 1º módulo extraído
    // da revisão de arquitetura do Dashboard. Funções puras, testadas em
    // dashboard-metrics-comercial.test.js. Os outros perfis ainda são
    // calculados aqui embaixo — extração incremental, um módulo por vez. ----
    const CM = window.ComercialMetrics;
    const comercial = CM.compute({ leads, gatilhos, propostas, contratos });

    // ---- Engenharia (dashboard-metrics-engenharia.js) — 2º módulo
    // extraído. Achado real (03/10): "Projetos abertos" lia a tabela legada
    // `projetos` (0 linhas em produção) — agora usa a mesma esteira
    // reconciliada (projetosReais) que o Gantt/Admin já usam, nunca mais
    // fica preso em zero. `ncmSolicitacoes` não é mais passado aqui —
    // ver nota sobre `ncm_solicitacoes` logo abaixo (achado real 03/10). ----
    const EM = window.EngenhariaMetrics;
    const engenharia = EM.compute({ projetos: projetosReais, fichas, catalogo, alertas });

    // ---- Financeiro (dashboard-metrics-financeiro.js) — 3º módulo extraído. ----
    const FM = window.FinanceiroMetrics;
    const financeiro = FM.compute({ contratos, comissoes, gatilhos, contratosInstalador, propostas });

    // ---- Admin (dashboard-metrics-admin.js) — 5º e último módulo
    // extraído. Único que COMPÕE outro módulo (ComercialMetrics), em vez
    // de refiltrar do zero — ver comentário no próprio arquivo. ----
    const AM = window.AdminMetrics;
    const desde = periodoParaData(period);
    const projetosPeriodo = desde ? AM.projetosAtivosNoPeriodo(projetosReais, desde) : undefined;
    const propostasPeriodo = desde ? propostas.filter(p => p.aprovada_em && new Date(p.aprovada_em) >= desde) : undefined;
    const comissoesPeriodo = desde ? comissoes.filter(c => c.created_at && new Date(c.created_at) >= desde) : undefined;
    const admin = AM.compute({ projetos: projetosReais, embarques, alertas, propostas, contratos, avais, comissoes, projetosPeriodo, propostasPeriodo, comissoesPeriodo });

    // ---- tarefas no formato esperado pelo Dashboard ----
    const tarefasFmt = tarefas.map(t => ({
      id: t.id,
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

    // Achado real (03/10): até aqui o Dashboard ainda consultava `estoque`
    // (pra computar `estoqueCritico`) e `ncm_solicitacoes` (pra
    // `engenharia.ncm`, issue #273) a cada carregamento — mas nenhum dos
    // dois é lido em lugar nenhum de `dashboard.jsx`. O comentário de
    // `OndeParouWidget` já confirma a causa: "Onde Parou" (23/08) substituiu
    // os widgets "Pendências NCM" e "Estoque Crítico" que consumiam esses
    // dados — a limpeza do back-end ficou pela metade na troca. Removidas
    // as 2 consultas (não há mais `estoqueCritico`/`ncm` no retorno) —
    // se um widget equivalente for pedido de novo, refazer a consulta é
    // simples; manter uma rodando pra ninguém ler não é.
    const gantt = GM.compute({ projetos: projetosReais });

    return {
      leads, projetos: projetosReais, alertas, tarefas: tarefasFmt,
      embarques, contratos, comissoes, gatilhos, fichas, catalogo,
      kpis, pipelineStages: comercial.pipelineStages, originBars: comercial.originBars,
      alertasCriticos: admin.alertasCriticos.length,
      ganttToday: gantt.ganttToday, ganttProjetos: gantt.ganttProjetos,
    };
  }

  /* 04/10/2026 — Inbox fase 1: todo envio pela função send-email leva o LOGIN de quem enviou (`enviadoPor`) — é o DONO
     do e-mail. Feito num ponto só para nenhum chamador (hoje ou futuro) esquecer. `sb.functions` cria um cliente novo a
     cada acesso, então o invólucro é aplicado no getter. Declarado pelo navegador (não verificável — issue #571). */
  try {
    const descFn = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(sb), 'functions');
    if (descFn && descFn.get) {
      Object.defineProperty(sb, 'functions', {
        configurable: true,
        get() {
          const fc = descFn.get.call(sb);
          const invocar = fc.invoke.bind(fc);
          fc.invoke = (nome, opts) => {
            try {
              if (nome === 'send-email' && opts && opts.body && typeof opts.body === 'object' && !opts.body.enviadoPor) {
                const quem = (window.__VP_USER || {}).email;
                if (quem) opts = { ...opts, body: { ...opts.body, enviadoPor: String(quem).toLowerCase() } };
              }
            } catch (_) { /* nunca atrapalha o envio */ }
            return invocar(nome, opts);
          };
          return fc;
        },
      });
    }
  } catch (e) { console.warn('[supabase.js] não consegui anexar o dono nos envios de e-mail', e); }

  // ---- expor para componentes React ----
  window.__VP_SB = { sb, loadDashboardData, timeAgo };
}());
