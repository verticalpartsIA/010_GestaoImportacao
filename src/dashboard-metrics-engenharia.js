/* ============================================================
   dashboard-metrics-engenharia.js
   Dashboard · métricas da perspectiva Engenharia — 2º módulo extraído
   de loadDashboardData() (ver dashboard-metrics-comercial.js pro
   raciocínio completo). Funções puras, zero I/O.

   Fechou a issue #273 (widget "Pendências NCM" recebia sempre `[]`):
   ncmPendentes() filtra `ncm_solicitacoes` pelos 3 status que o widget
   sabia interpretar (EM_PREENCHIMENTO / AGUARD_JURIDICO / APROVADO).
   **Achado real (03/10): o widget em si não existe mais** — o comentário
   de `OndeParouWidget` (dashboard.jsx) confirma que "Onde Parou" (23/08)
   substituiu "Pendências NCM" e "Estoque Crítico", mas a limpeza do
   back-end ficou pela metade: `supabase.js` continuou buscando
   `ncm_solicitacoes` e devolvendo `ncm` pro Dashboard sem ninguém ler.
   `supabase.js` parou de passar `ncmSolicitacoes` pra `compute()` — a
   função/teste continuam aqui, puras e cobertas, pro dia em que um
   widget equivalente for pedido de novo (só plugar a consulta de volta).

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
      // Achado real (03/10): até aqui `projetos` ainda era a tabela legada
      // `projetos` (0 linhas em produção, issue #274) — o KPI sempre
      // mostrava zero mesmo com cotações ativas de verdade. supabase.js
      // agora passa a mesma esteira real (gatilhos+formulários) que já
      // alimenta "Projetos ativos" do Admin e o Gantt/Kanban/Lista —
      // mesmo array, mesma definição de "projeto aberto", 1 fonte só.
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
