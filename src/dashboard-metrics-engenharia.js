/* ============================================================
   dashboard-metrics-engenharia.js
   Dashboard · métricas da perspectiva Engenharia — 2º módulo extraído
   de loadDashboardData() (ver dashboard-metrics-comercial.js pro
   raciocínio completo). Funções puras, zero I/O.

   Fecha a issue #273: o widget "Pendências NCM" recebia sempre `[]`
   (const ncm = []; // legado removido). Agora ncmPendentes() puxa de
   verdade de `ncm_solicitacoes` — só os 3 status que o widget sabe
   interpretar (EM_PREENCHIMENTO / AGUARD_JURIDICO / APROVADO); depois
   disso o produto já foi pra LogComex/Siscomex, não é mais "pendência".

   window.EngenhariaMetrics
   ============================================================ */
(function () {
  'use strict';

  const NCM_STATUS_PENDENTES = ['EM_PREENCHIMENTO', 'AGUARD_JURIDICO', 'APROVADO'];

  function fichasDoMes(fichas, hoje) {
    const mesAtual = (hoje || new Date()).toISOString().slice(0, 7);
    return (fichas || []).filter((f) => (f.criado_em || '').startsWith(mesAtual));
  }

  function catalogoAtivos(catalogo) {
    return (catalogo || []).filter((p) => p.situacao === 'ativado');
  }

  function alertasEngenharia(alertas) {
    return (alertas || []).filter((a) => a.module === 'Engenharia');
  }

  /* Só os status "em aberto" do funil NCM — o resto (APROVADO_PRONTO,
     CADASTRADO) já saiu da fila de pendência do jurídico/engenharia. */
  function ncmPendentes(ncmSolicitacoes) {
    return (ncmSolicitacoes || []).filter((s) => NCM_STATUS_PENDENTES.includes(s.status));
  }

  function kpis({ projetos, fichas, catalogo, alertas, fichasNoMes }) {
    return [
      // "Projetos abertos" ainda lê a tabela legada `projetos` (issue #274
      // / Candidato 2 da revisão de arquitetura — fora do escopo aqui).
      { label: 'Projetos abertos', value: String((projetos || []).length), unit: '', delta: '', deltaDir: 'up', sub: 'ativos' },
      { label: 'Fichas técnicas', value: String((fichas || []).length), unit: '', delta: fichasNoMes.length > 0 ? `+${fichasNoMes.length}` : '0', deltaDir: 'up', sub: 'no mês' },
      { label: 'Catálogo (ativos)', value: String(catalogoAtivos(catalogo).length), unit: '', delta: '', deltaDir: 'up', sub: 'produtos no catálogo' },
      { label: 'Alertas engenharia', value: String(alertasEngenharia(alertas).length), unit: '', delta: '', deltaDir: 'up', sub: 'pendentes' },
    ];
  }

  function compute({ projetos, fichas, catalogo, alertas, ncmSolicitacoes, hoje }) {
    return {
      kpis: kpis({ projetos, fichas, catalogo, alertas, fichasNoMes: fichasDoMes(fichas, hoje) }),
      ncm: ncmPendentes(ncmSolicitacoes),
    };
  }

  window.EngenhariaMetrics = {
    NCM_STATUS_PENDENTES, fichasDoMes, catalogoAtivos, alertasEngenharia, ncmPendentes, kpis, compute,
  };
}());
