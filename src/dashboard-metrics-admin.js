/* ============================================================
   dashboard-metrics-admin.js
   Dashboard · métricas da perspectiva Admin — 5º e último módulo
   extraído de loadDashboardData() (ver dashboard-metrics-comercial.js
   pro raciocínio completo). Funções puras, zero I/O.

   Único módulo que COMPÕE os outros — reaproveita
   ComercialMetrics.propostasAprovadas()/idsComContrato() em vez de
   refiltrar do zero (raiz dos 3 bugs de produção já documentados:
   a mesma definição de "proposta aprovada" divergindo em lugares
   diferentes do código). As checagens de consistência cruzada
   (proposta sem contrato, sinal sem contrato) moram só aqui — não
   pertencem a nenhuma perspectiva sozinha.

   Depende de window.ComercialMetrics já estar carregado — ver ordem
   dos <script> em index.html.

   window.AdminMetrics
   ============================================================ */
(function () {
  'use strict';

  function embarquesEmTransito(embarques) {
    return (embarques || []).filter((e) => e.status === 'Em trânsito');
  }

  /* Soma das propostas aprovadas pelo cliente — não mais da tabela
     `projetos` (legada/desconectada, mostrava R$0 com venda fechada). */
  function faturamentoTotal(propostas) {
    const CM = window.ComercialMetrics;
    return CM.propostasAprovadas(propostas).reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
  }

  function propostasSemContrato(propostas, contratos) {
    const CM = window.ComercialMetrics;
    const aprovadas = CM.propostasAprovadas(propostas);
    const comContrato = CM.idsComContrato(contratos);
    return aprovadas.filter((p) => !comContrato.has(p.id));
  }

  function contratosValorZero(contratos) {
    return (contratos || []).filter((c) => !c.valor_total_num || Number(c.valor_total_num) === 0);
  }

  function avaisSinalSemContrato(avais) {
    return (avais || []).filter((a) => a.sinal_pago && !a.contrato_venda_id);
  }

  /* Além dos `alertas` manuais, detecta inconsistências entre módulos
     que o E2E encontrou escondidas (proposta assinada sem contrato,
     contrato com valor zerado, sinal pago sem contrato vinculado). */
  function alertasCriticos({ alertas, propostas, contratos, avais }) {
    return [
      ...(alertas || []).filter((a) => a.level === 'danger'),
      ...propostasSemContrato(propostas, contratos).map((p) => ({ tipo: 'proposta_sem_contrato', ref: p.numero_cotacao })),
      ...contratosValorZero(contratos).map((c) => ({ tipo: 'contrato_valor_zero', ref: c.id })),
      ...avaisSinalSemContrato(avais).map((a) => ({ tipo: 'sinal_sem_contrato', ref: a.numero_cotacao })),
    ];
  }

  /* Comissão é custo (23/08, Gelson) — o ERP Omie já trata como despesa;
     aqui é só exibição, soma todos os registros de `comissoes` (mesma
     tabela que a página Gatilhos & Prazo já usa pra "Comissões
     pendentes", ver dashboard-metrics-financeiro.js — aqui é o total,
     não só o pendente). */
  function comissaoTotal(comissoes) {
    return (comissoes || []).reduce((s, c) => s + (Number(c.comissao) || 0), 0);
  }

  function kpis({ projetos, embarques, alertas, propostas, contratos, avais, comissoes }) {
    const CM = window.ComercialMetrics;
    const crit = alertasCriticos({ alertas, propostas, contratos, avais });
    const aprovadas = CM.propostasAprovadas(propostas);
    return [
      // "Projetos ativos" ainda lê a tabela legada `projetos` (issue #274
      // / Candidato 2 da revisão de arquitetura — fora do escopo aqui).
      { label: 'Projetos ativos', value: String((projetos || []).length), unit: '', delta: '', deltaDir: 'up', sub: 'todos módulos' },
      { label: 'Embarques em trânsito', value: String(embarquesEmTransito(embarques).length), unit: '', delta: '', deltaDir: 'up', sub: 'Santos+Itaguaí' },
      { label: 'Alertas críticos', value: String(crit.length), unit: '', delta: '', deltaDir: crit.length > 0 ? 'down' : 'up', sub: 'ver central' },
      { label: 'Faturamento (propostas assinadas)', value: fmtBRL(faturamentoTotal(propostas)), unit: '', delta: '', deltaDir: 'up', sub: `${aprovadas.length} propostas` },
      { label: 'Comissões (custo)', value: fmtBRL(comissaoTotal(comissoes)), unit: '', delta: '', deltaDir: 'down', sub: `${(comissoes || []).length} registros` },
    ];
  }

  /* Mesmo formato compacto (R$ 1.2M / R$ 5k) do FinanceiroMetrics —
     cópia local de propósito, ver o comentário lá pro porquê. */
  function fmtBRL(n) {
    if (!n) return 'R$ 0';
    if (n >= 1_000_000) return 'R$ ' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return 'R$ ' + Math.round(n / 1_000) + 'k';
    return 'R$ ' + n;
  }

  function compute({ projetos, embarques, alertas, propostas, contratos, avais, comissoes }) {
    return {
      kpis: kpis({ projetos, embarques, alertas, propostas, contratos, avais, comissoes }),
      alertasCriticos: alertasCriticos({ alertas, propostas, contratos, avais }),
    };
  }

  window.AdminMetrics = {
    embarquesEmTransito, faturamentoTotal, propostasSemContrato, contratosValorZero,
    avaisSinalSemContrato, alertasCriticos, comissaoTotal, kpis, compute,
  };
}());
