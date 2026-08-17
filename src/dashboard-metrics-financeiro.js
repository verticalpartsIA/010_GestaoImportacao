/* ============================================================
   dashboard-metrics-financeiro.js
   Dashboard · métricas da perspectiva Financeiro — 3º módulo extraído
   de loadDashboardData() (ver dashboard-metrics-comercial.js pro
   raciocínio completo). Funções puras, zero I/O.

   contratosAbertos() também é reaproveitada por dashboard-metrics-admin.js
   (KPI "Contratos abertos" existe nos dois perfis, mesma definição).

   window.FinanceiroMetrics
   ============================================================ */
(function () {
  'use strict';

  /* Formato compacto (R$ 1.2M / R$ 5k) — mesmo formato já usado pelos KPIs
     do Dashboard. Cópia local de propósito (não é o fmtBRL de
     primitives.jsx, que formata moeda "cheia" — nomes iguais, formatos
     diferentes; não dá pra reaproveitar um pelo outro). */
  function fmtBRL(n) {
    if (!n) return 'R$ 0';
    if (n >= 1_000_000) return 'R$ ' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return 'R$ ' + Math.round(n / 1_000) + 'k';
    return 'R$ ' + n;
  }

  function contratosAbertos(contratos) {
    return (contratos || []).filter((c) => c.status !== 'Assinado');
  }

  function aReceber(contratos) {
    return contratosAbertos(contratos).reduce((s, c) => s + (c.value || 0), 0);
  }

  function comissoesPendentes(comissoes) {
    return (comissoes || []).filter((c) => c.status === 'Aguardando');
  }

  function comissoesPendentesValor(comissoes) {
    return comissoesPendentes(comissoes).reduce((s, c) => s + (c.comissao || 0), 0);
  }

  function gatilhosProximos(gatilhos, dias) {
    const limite = dias == null ? 7 : dias;
    return (gatilhos || []).filter((g) => (g.days_left || 0) <= limite);
  }

  function kpis({ contratos, comissoes, gatilhos }) {
    const gatProx7 = gatilhosProximos(gatilhos, 7);
    return [
      { label: 'A receber', value: fmtBRL(aReceber(contratos)), unit: '', delta: '', deltaDir: 'up', sub: 'contratos abertos' },
      { label: 'Comissões pendentes', value: fmtBRL(comissoesPendentesValor(comissoes)), unit: '', delta: '', deltaDir: 'up', sub: 'aguardando pagamento' },
      { label: 'Gatilhos próx. 7d', value: String(gatProx7.length), unit: '', delta: '', deltaDir: gatProx7.length > 3 ? 'down' : 'up', sub: 'atenção' },
      { label: 'Contratos abertos', value: String(contratosAbertos(contratos).length), unit: '', delta: '', deltaDir: 'up', sub: 'em andamento' },
    ];
  }

  function compute({ contratos, comissoes, gatilhos }) {
    return { kpis: kpis({ contratos, comissoes, gatilhos }) };
  }

  window.FinanceiroMetrics = {
    contratosAbertos, aReceber, comissoesPendentes, comissoesPendentesValor, gatilhosProximos, kpis, compute,
  };
}());
