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

  (function ssoGuard() {
    const params   = new URLSearchParams(window.location.search);
    const ssoToken = params.get('sso_token');

    // Flag de aba corrente (sobrevive a reloads dentro da mesma aba)
    const hasTabFlag = sessionStorage.getItem('vpprd_sso_ok') === '1';

    // Bypass para desenvolvimento local (localhost, 127.0.0.1)
    const isLocalhost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(window.location.hostname);

    // Sem token SSO E sem flag de aba E não está em localhost → acesso direto bloqueado
    if (!ssoToken && !hasTabFlag && !isLocalhost) {
      window.location.replace('https://vpsistema.com');
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

      window.history.replaceState({}, '', window.location.pathname);
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

  function fmtBRL(n) {
    if (!n) return 'R$ 0';
    if (n >= 1_000_000) return 'R$ ' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return 'R$ ' + Math.round(n / 1_000) + 'k';
    return 'R$ ' + n;
  }

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

    // ---- tarefas no formato esperado pelo Dashboard ----
    const tarefasFmt = tarefas.map(t => ({
      t: t.title,
      time: t.due_time,
      prio: ({ alta: 'Alta', media: 'Média', baixa: 'Baixa' }[String(t.priority || '').toLowerCase()] || t.priority || 'Média'),
      module: t.module,
    }));

    // ---- métricas derivadas ----
    // (leadsDoMes/cotAbertas/propEnviadas/convertidos/convPct migraram pra
    // ComercialMetrics; fichasDoMes/catProdAtivos/alertasEngenharia/ncm
    // migraram pra EngenhariaMetrics — ver blocos acima)
    const emTransito   = embarques.filter(e => e.status === 'Em trânsito');
    const comPend      = comissoes.filter(c => c.status === 'Aguardando').reduce((s, c) => s + (c.comissao || 0), 0);
    const gatProx7     = gatilhos.filter(g => (g.days_left || 0) <= 7);
    const aReceber     = contratos.filter(c => c.status !== 'Assinado').reduce((s, c) => s + (c.value || 0), 0);

    // ---- Faturamento total (esteira real) — soma das propostas assinadas
    // pelo cliente (status 'aprovada'), não mais da tabela `projetos`
    // (legada/desconectada, 1 linha demo — mostrava R$0 com venda fechada).
    // propostasAprovadas/idsComContrato vêm de ComercialMetrics — fonte
    // única da definição, reaproveitada aqui em vez de refiltrar (raiz dos
    // bugs antigos: a mesma regra escrita/mudada em lugares diferentes). ----
    const propostasAprovadas = CM.propostasAprovadas(propostas);
    const fatTotal = propostasAprovadas.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);

    // ---- Alertas críticos (esteira real) — além dos `alertas` manuais,
    // detecta inconsistências entre módulos que o E2E encontrou escondidas
    // (proposta assinada sem contrato, contrato com valor zerado, sinal
    // pago sem contrato/importação vinculados). ----
    const idsComContrato = CM.idsComContrato(contratos);
    const propostasSemContrato = propostasAprovadas.filter(p => !idsComContrato.has(p.id));
    const contratosValorZero = contratos.filter(c => !c.valor_total_num || Number(c.valor_total_num) === 0);
    const avaisSinalSemContrato = avais.filter(a => a.sinal_pago && !a.contrato_venda_id);
    const alertasCrit = [
      ...alertas.filter(a => a.level === 'danger'),
      ...propostasSemContrato.map(p => ({ tipo: 'proposta_sem_contrato', ref: p.numero_cotacao })),
      ...contratosValorZero.map(c => ({ tipo: 'contrato_valor_zero', ref: c.id })),
      ...avaisSinalSemContrato.map(a => ({ tipo: 'sinal_sem_contrato', ref: a.numero_cotacao })),
    ];

    // ---- KPIs por perfil ----
    const kpis = {
      comercial: comercial.kpis,
      engenharia: engenharia.kpis,
      financeiro: [
        { label: 'A receber',           value: fmtBRL(aReceber),     unit: '',  delta: '', deltaDir: 'up', sub: 'contratos abertos' },
        { label: 'Comissões pendentes', value: fmtBRL(comPend),      unit: '',  delta: '', deltaDir: 'up', sub: 'aguardando pagamento' },
        { label: 'Gatilhos próx. 7d',   value: String(gatProx7.length), unit:'', delta: '', deltaDir: gatProx7.length > 3 ? 'down' : 'up', sub: 'atenção' },
        { label: 'Contratos abertos',   value: String(contratos.filter(c => c.status !== 'Assinado').length), unit: '', delta: '', deltaDir: 'up', sub: 'em andamento' },
      ],
      admin: [
        { label: 'Projetos ativos',       value: String(projetos.length),    unit: '',  delta: '', deltaDir: 'up', sub: 'todos módulos' },
        { label: 'Embarques em trânsito', value: String(emTransito.length),  unit: '',  delta: '', deltaDir: 'up', sub: 'Santos+Itaguaí' },
        { label: 'Alertas críticos',      value: String(alertasCrit.length), unit: '',  delta: '', deltaDir: alertasCrit.length > 0 ? 'down' : 'up', sub: 'ver central' },
        { label: 'Faturamento (propostas assinadas)', value: fmtBRL(fatTotal), unit: '', delta: '', deltaDir: 'up', sub: `${propostasAprovadas.length} propostas` },
      ],
    };

    // ---- Pipeline Funnel + Conversão por Origem: vêm de ComercialMetrics
    // (comercial.pipelineStages / comercial.originBars), calculados lá em
    // cima junto com os KPIs — mesma fonte, sem recomputar aqui. ----

    // ---- Estoque crítico ----
    const estoqueCritico = estoque
      .filter(e => e.qty < e.min_qty)
      .map(e => ({
        sku: e.sku, name: e.name, qty: e.qty, min: e.min_qty,
        status: e.qty <= Math.floor(e.min_qty / 2) ? 'danger' : 'warning',
      }));

    // ---- Gantt: hoje em dias desde o início do projeto mais antigo ----
    const startMs = projetos.map(p => +new Date(p.start_date)).filter(Boolean);
    const ganttStart  = startMs.length ? Math.min(...startMs) : Date.now();
    const ganttToday  = Math.max(0, Math.floor((Date.now() - ganttStart) / 86_400_000));

    // ---- Gantt: converte projetos Supabase → formato GanttChart (fases sintéticas) ----
    const GANTT_PHASES = ['Projeto', 'Fabricação', 'Importação', 'Instalação', 'Entrega'];
    const ganttProjetos = projetos.map(p => {
      const pStart = p.start_date ? +new Date(p.start_date) : ganttStart;
      const pEnd   = p.end_date   ? +new Date(p.end_date)   : pStart + 150 * 86_400_000;
      const pDay0  = Math.max(0, Math.floor((pStart - ganttStart) / 86_400_000));
      const totalD = Math.max(30, Math.floor((pEnd - pStart) / 86_400_000));
      const phLen  = Math.floor(totalD / GANTT_PHASES.length);
      const curIdx = Math.max(0, GANTT_PHASES.findIndex(ph => (p.current_phase || '').includes(ph)));
      return {
        ...p,
        phases: GANTT_PHASES.map((name, i) => ({
          name,
          start:  pDay0 + i * phLen,
          end:    pDay0 + (i + 1) * phLen,
          status: i < curIdx ? 'done' : i === curIdx ? 'current' : 'future',
        })),
      };
    });

    return {
      leads, cotacoes, projetos, alertas, tarefas: tarefasFmt,
      embarques, contratos, estoque, comissoes, gatilhos, fichas, catalogo, ncm: engenharia.ncm,
      kpis, pipelineStages: comercial.pipelineStages, originBars: comercial.originBars, estoqueCritico,
      alertasCriticos: alertasCrit.length,
      ganttToday, ganttProjetos,
    };
  }

  // ---- expor para componentes React ----
  window.__VP_SB = { sb, loadDashboardData, timeAgo };
}());
