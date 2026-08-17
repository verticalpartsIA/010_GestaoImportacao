/* ============================================================
   dashboard-metrics-gantt.js
   Dashboard · geração das fases sintéticas do Gantt/Kanban de projetos —
   4º módulo extraído de loadDashboardData() (ver
   dashboard-metrics-comercial.js pro raciocínio completo). Funções
   puras, zero I/O.

   Extração comportamento-idêntica de propósito: ainda lê da tabela
   `projetos` (legada/desconectada da esteira real, issue #274 — 0
   linhas em produção). Reconciliar com a esteira real de verdade é o
   Candidato 2 da revisão de arquitetura, escopo separado deste.

   window.ProjetosGanttMetrics
   ============================================================ */
(function () {
  'use strict';

  const DIA_MS = 86_400_000;
  const GANTT_PHASES = ['Projeto', 'Fabricação', 'Importação', 'Instalação', 'Entrega'];

  /* Início da timeline: o projeto mais antigo por start_date, ou agora se
     não houver nenhum. */
  function ganttStart(projetos) {
    const startMs = (projetos || []).map((p) => +new Date(p.start_date)).filter(Boolean);
    return startMs.length ? Math.min(...startMs) : Date.now();
  }

  /* "Hoje" em dias desde o início da timeline — posição da linha vertical
     "HOJE" no gráfico. */
  function ganttToday(projetos, agora) {
    const inicio = ganttStart(projetos);
    return Math.max(0, Math.floor(((agora || Date.now()) - inicio) / DIA_MS));
  }

  /* Converte projetos (Supabase) → formato que o GanttChart/Kanban
     entendem: 5 fases sintéticas de tamanho igual, divididas pelo
     período total do projeto, com a fase atual marcada por
     current_phase. */
  function projetosComFases(projetos, inicio) {
    const base = inicio == null ? ganttStart(projetos) : inicio;
    return (projetos || []).map((p) => {
      const pStart = p.start_date ? +new Date(p.start_date) : base;
      const pEnd   = p.end_date   ? +new Date(p.end_date)   : pStart + 150 * DIA_MS;
      const pDay0  = Math.max(0, Math.floor((pStart - base) / DIA_MS));
      const totalD = Math.max(30, Math.floor((pEnd - pStart) / DIA_MS));
      const phLen  = Math.floor(totalD / GANTT_PHASES.length);
      const curIdx = Math.max(0, GANTT_PHASES.findIndex((ph) => (p.current_phase || '').includes(ph)));
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
  }

  function compute({ projetos, agora }) {
    const inicio = ganttStart(projetos);
    return {
      ganttToday: ganttToday(projetos, agora),
      ganttProjetos: projetosComFases(projetos, inicio),
    };
  }

  window.ProjetosGanttMetrics = {
    GANTT_PHASES, ganttStart, ganttToday, projetosComFases, compute,
  };
}());
