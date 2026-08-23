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

  /* Recalcula "dias restantes" ao vivo a partir de due_date — antes o
     KPI lia gatilhos.days_left, coluna gravada só no momento em que o
     gatilho nasce e nunca mais atualizada (achado "Importante" da
     auditoria: um gatilho já vencido continuava marcado com os dias
     congelados de quando foi criado). Mesmo cálculo que
     src/financeiro.jsx já faz ao vivo pra tela de Gatilhos & Prazo —
     só não estava replicado aqui. Sem due_date (gatilho ainda sem
     prazo definido), cai no valor já gravado — mesmo comportamento de
     antes pra esse caso. */
  function diasRestantes(g, agora) {
    if (!g.due_date) return g.days_left || 0;
    return Math.round((new Date(g.due_date) - (agora || new Date())) / 86_400_000);
  }

  function gatilhosProximos(gatilhos, dias, agora) {
    const limite = dias == null ? 7 : dias;
    return (gatilhos || []).filter((g) => diasRestantes(g, agora) <= limite);
  }

  function kpis({ contratos, comissoes, gatilhos, agora }) {
    const gatProx7 = gatilhosProximos(gatilhos, 7, agora);
    return [
      { label: 'A receber', value: fmtBRL(aReceber(contratos)), unit: '', delta: '', deltaDir: 'up', sub: 'contratos abertos' },
      { label: 'Comissões pendentes', value: fmtBRL(comissoesPendentesValor(comissoes)), unit: '', delta: '', deltaDir: 'up', sub: 'aguardando pagamento' },
      { label: 'Gatilhos próx. 7d', value: String(gatProx7.length), unit: '', delta: '', deltaDir: gatProx7.length > 3 ? 'down' : 'up', sub: 'atenção' },
      { label: 'Contratos abertos', value: String(contratosAbertos(contratos).length), unit: '', delta: '', deltaDir: 'up', sub: 'em andamento' },
    ];
  }

  function compute({ contratos, comissoes, gatilhos, agora }) {
    return { kpis: kpis({ contratos, comissoes, gatilhos, agora }) };
  }

  window.FinanceiroMetrics = {
    contratosAbertos, aReceber, comissoesPendentes, comissoesPendentesValor, diasRestantes, gatilhosProximos, kpis, compute,
  };
}());
