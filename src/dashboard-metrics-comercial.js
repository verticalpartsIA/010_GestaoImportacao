/* ============================================================
   dashboard-metrics-comercial.js
   Dashboard · métricas da perspectiva Comercial — extraído de
   loadDashboardData() (supabase.js), que virou um orquestrador fino:
   busca as tabelas brutas e passa arrays prontos pra cada módulo de
   perspectiva. Funções puras, zero I/O — testadas em
   dashboard-metrics-comercial.test.js sem mockar Supabase nenhum.

   propostasAprovadas() e idsComContrato() também são consumidas por
   dashboard-metrics-admin.js (reaproveita em vez de recalcular —
   raiz dos 3 bugs de produção já documentados no histórico do
   Dashboard: a mesma definição de "proposta aprovada" divergindo
   entre pontos diferentes do código).

   window.ComercialMetrics
   ============================================================ */
(function () {
  'use strict';

  function leadsDoMes(leads, hoje) {
    const mesAtual = (hoje || new Date()).toISOString().slice(0, 7);
    return (leads || []).filter((l) => (l.date || '').startsWith(mesAtual));
  }

  function cotacoesAbertas(cotacoes) {
    return (cotacoes || []).filter((c) => ['Aguardando China', 'Recebida', 'Em análise'].includes(c.status));
  }

  function propostasEnviadas(leads) {
    return (leads || []).filter((l) => l.status === 'Proposta enviada');
  }

  function leadsConvertidos(leads) {
    return (leads || []).filter((l) => l.status === 'Convertido');
  }

  function conversaoLeadProposta(leads, propEnviadas) {
    const total = (leads || []).length;
    if (!total) return 0;
    return Math.round((((propEnviadas || []).length) / total) * 100);
  }

  /* Propostas (tabela real `propostas`, distinta do status textual dos
     `leads`) — status 'aprovada' = cliente assinou. Fonte única desta
     definição: qualquer outro módulo que precise de "proposta aprovada"
     chama esta função em vez de refiltrar. */
  function propostasAprovadas(propostas) {
    return (propostas || []).filter((p) => p.status === 'aprovada');
  }

  /* proposta_id de todo contrato já emitido — usado pra saber quais
     propostas aprovadas AINDA não viraram contrato (pipeline e alertas). */
  function idsComContrato(contratos) {
    return new Set((contratos || []).map((c) => c.proposta_id).filter(Boolean));
  }

  function kpis({ leads, cotacoes, propEnviadas, convPct }) {
    return [
      { label: 'Leads do mês', value: String(leadsDoMes(leads).length), unit: '', delta: leadsDoMes(leads).length > 0 ? `+${leadsDoMes(leads).length}` : '0', deltaDir: 'up', sub: 'vs. mês anterior' },
      { label: 'Cot. em China', value: String(cotacoesAbertas(cotacoes).length), unit: '', delta: `${cotacoesAbertas(cotacoes).length}`, deltaDir: 'up', sub: 'abertas' },
      { label: 'Propostas enviadas', value: String((propEnviadas || []).length), unit: '', delta: '', deltaDir: 'up', sub: 'no período' },
      { label: 'Conversão Lead→Proposta', value: String(convPct), unit: '%', delta: '', deltaDir: convPct >= 25 ? 'up' : 'down', sub: 'meta 25%' },
    ];
  }

  /* Funil Leads → Propostas enviadas → Propostas assinadas (sem contrato
     ainda) → Contratos. Volume por estágio ATUAL, não histórico acumulado:
     uma proposta que virou contrato conta só em "Contrato". */
  function pipeline({ leads, propostas, contratos }) {
    const aprovadas = propostasAprovadas(propostas);
    const comContrato = idsComContrato(contratos);
    const aprovadasComContrato = aprovadas.filter((p) => comContrato.has(p.id)).length;
    return [
      { label: 'Leads', value: (leads || []).length, color: '#000' },
      { label: 'Propostas enviadas', value: (propostas || []).length, color: 'var(--vp-gray-700)' },
      { label: 'Propostas assinadas', value: aprovadas.length - aprovadasComContrato, color: 'var(--vp-yellow-press)' },
      { label: 'Contratos', value: (contratos || []).length, color: 'var(--vp-yellow)' },
    ];
  }

  function origemBars(leads) {
    const originMap = {}, originConv = {};
    (leads || []).forEach((l) => { if (l.origin) originMap[l.origin] = (originMap[l.origin] || 0) + 1; });
    leadsConvertidos(leads).forEach((l) => { if (l.origin) originConv[l.origin] = (originConv[l.origin] || 0) + 1; });
    return Object.entries(originMap)
      .map(([l, v]) => ({ l, v, conv: v > 0 ? Math.round(((originConv[l] || 0) / v) * 100) : 0 }))
      .sort((a, b) => b.v - a.v);
  }

  function compute({ leads, cotacoes, propostas, contratos }) {
    const propEnviadas = propostasEnviadas(leads);
    const convPct = conversaoLeadProposta(leads, propEnviadas);
    return {
      kpis: kpis({ leads, cotacoes, propEnviadas, convPct }),
      pipelineStages: pipeline({ leads, propostas, contratos }),
      originBars: origemBars(leads),
    };
  }

  window.ComercialMetrics = {
    leadsDoMes, cotacoesAbertas, propostasEnviadas, leadsConvertidos, conversaoLeadProposta,
    propostasAprovadas, idsComContrato, kpis, pipeline, origemBars, compute,
  };
}());
