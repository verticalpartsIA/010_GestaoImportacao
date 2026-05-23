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
      comR, gatR, ncmR
    ] = await Promise.all([
      sb.from('leads').select('*').order('date', { ascending: false }),
      sb.from('cotacoes').select('*').order('date', { ascending: false }),
      sb.from('projetos').select('*').order('start_date'),
      sb.from('alertas').select('*').eq('resolved', false).order('created_at', { ascending: false }),
      sb.from('tarefas').select('*').eq('role', role).eq('done', false).order('id'),
      sb.from('embarques').select('*').order('eta'),
      sb.from('contratos').select('*').order('issued_date', { ascending: false }),
      sb.from('estoque').select('*').order('sku'),
      sb.from('comissoes').select('*').order('id'),
      sb.from('gatilhos').select('*').order('due_date'),
      sb.from('ncm_solicitacoes').select('*').order('created_at', { ascending: false }),
    ]);

    const leads     = lR.data    || [];
    const cotacoes  = cotR.data  || [];
    const projetos  = projR.data || [];
    const alertas   = alertR.data.map(a => ({ ...a, time: timeAgo(a.created_at) })) || [];
    const tarefas   = tarR.data  || [];
    const embarques = embR.data  || [];
    const contratos = ctR.data   || [];
    const estoque   = estR.data  || [];
    const comissoes = comR.data  || [];
    const gatilhos  = gatR.data  || [];
    const ncm       = ncmR.data  || [];

    // ---- tarefas no formato esperado pelo Dashboard ----
    const tarefasFmt = tarefas.map(t => ({
      t: t.title, time: t.due_time, prio: t.priority, module: t.module,
    }));

    // ---- métricas derivadas ----
    const mesAtual     = new Date().toISOString().slice(0, 7);
    const leadsDoMes   = leads.filter(l => (l.date || '').startsWith(mesAtual));
    const cotAbertas   = cotacoes.filter(c => ['Aguardando China', 'Recebida', 'Em análise'].includes(c.status));
    const propEnviadas = leads.filter(l => l.status === 'Proposta enviada');
    const convertidos  = leads.filter(l => l.status === 'Convertido');
    const convPct      = leads.length ? Math.round((propEnviadas.length / leads.length) * 100) : 0;
    const emTransito   = embarques.filter(e => e.status === 'Em trânsito');
    const alertasCrit  = alertas.filter(a => a.level === 'danger');
    const fatTotal     = projetos.reduce((s, p) => s + (p.value || 0), 0);
    const comPend      = comissoes.filter(c => c.status === 'Aguardando').reduce((s, c) => s + (c.comissao || 0), 0);
    const gatProx7     = gatilhos.filter(g => (g.days_left || 0) <= 7);
    const aReceber     = contratos.filter(c => c.status !== 'Assinado').reduce((s, c) => s + (c.value || 0), 0);
    const ncmPend      = ncm.filter(n => n.status === 'pendente').length;
    const ncmAnalise   = ncm.filter(n => n.status === 'em_analise').length;

    // ---- KPIs por perfil ----
    const kpis = {
      comercial: [
        { label: 'Leads do mês',            value: String(leadsDoMes.length),   unit: '', delta: leadsDoMes.length > 0 ? `+${leadsDoMes.length}` : '0', deltaDir: 'up',   sub: 'vs. mês anterior' },
        { label: 'Cot. em China',           value: String(cotAbertas.length),   unit: '', delta: `${cotAbertas.length}`,    deltaDir: 'up',   sub: 'abertas' },
        { label: 'Propostas enviadas',      value: String(propEnviadas.length), unit: '', delta: '',                        deltaDir: 'up',   sub: 'no período' },
        { label: 'Conversão Lead→Proposta', value: String(convPct),             unit: '%',delta: '',                        deltaDir: convPct >= 25 ? 'up' : 'down', sub: 'meta 25%' },
      ],
      engenharia: [
        { label: 'Projetos abertos',  value: String(projetos.length), unit: '', delta: '', deltaDir: 'up', sub: 'ativos' },
        { label: 'NCM pendentes',     value: String(ncmPend),         unit: '', delta: '', deltaDir: 'up', sub: 'aguardando análise' },
        { label: 'NCM em análise',    value: String(ncmAnalise),      unit: '', delta: '', deltaDir: 'up', sub: 'em andamento' },
        { label: 'Alertas engenharia',value: String(alertas.filter(a => a.module === 'Engenharia').length), unit: '', delta: '', deltaDir: 'up', sub: 'pendentes' },
      ],
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
        { label: 'Faturamento total',     value: fmtBRL(fatTotal),           unit: '',  delta: '', deltaDir: 'up', sub: 'em projetos' },
      ],
    };

    // ---- Pipeline Funnel (real) ----
    const maxPipeline = leads.length || 1;
    const pipelineStages = [
      { label: 'Leads',         value: leads.length,          color: '#000' },
      { label: 'Cotação China', value: cotacoes.length,        color: 'var(--vp-gray-700)' },
      { label: 'Precificação',  value: cotAbertas.length,      color: 'var(--vp-gray-500)' },
      { label: 'Proposta',      value: propEnviadas.length,    color: 'var(--vp-yellow-press)' },
      { label: 'Contrato',      value: contratos.length,       color: 'var(--vp-yellow)' },
    ];

    // ---- Conversão por Origem (real) ----
    const originMap = {}, originConv = {};
    leads.forEach(l => { if (l.origin) originMap[l.origin] = (originMap[l.origin] || 0) + 1; });
    convertidos.forEach(l => { if (l.origin) originConv[l.origin] = (originConv[l.origin] || 0) + 1; });
    const originBars = Object.entries(originMap)
      .map(([l, v]) => ({ l, v, conv: v > 0 ? Math.round(((originConv[l] || 0) / v) * 100) : 0 }))
      .sort((a, b) => b.v - a.v);

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
      embarques, contratos, estoque, comissoes, gatilhos, ncm,
      kpis, pipelineStages, originBars, estoqueCritico,
      alertasCriticos: alertasCrit.length,
      ganttToday, ganttProjetos,
    };
  }

  // ---- expor para componentes React ----
  window.__VP_SB = { sb, loadDashboardData };
}());
