/* ============================================================
   fabricacao-oficina-calc.js — motor puro de progresso/pausa das telas
   Fabricação Corrimão e Fabricação Corte (22/10/2026). Mesmo algoritmo
   do Quadro (fabricacao-quadro-calc.js), mas sobre as linhas planas que
   a RPC public_fab_obter devolve: { id, ordem, texto, peso, flegado }.
   window.FabOficinaCalc
   ============================================================ */
(function () {
  'use strict';

  function ordenadas(etapas) { return [...(etapas || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)); }

  // 100% só com TODAS as etapas feitas e pesos somando 100; antes disso teto 99.
  function progresso(etapas) {
    const o = ordenadas(etapas);
    if (!o.length) return 0;
    const feito = o.reduce((a, e) => a + (e.flegado ? Number(e.peso) || 0 : 0), 0);
    const total = o.reduce((a, e) => a + (Number(e.peso) || 0), 0);
    if (o.every((e) => e.flegado) && total >= 100 - 0.001) return 100;
    return Math.min(99, Math.floor(feito + 0.001));
  }

  function etapaAtualId(etapas) {
    const p = ordenadas(etapas).find((e) => !e.flegado);
    return p ? p.id : null;
  }

  // Pausa só com ocorrência aberta SEM frente de trabalho.
  function pausado(ocorrencias) {
    return (ocorrencias || []).some((o) => o.status === 'aberta' && o.tem_frente_trabalho === false);
  }

  // Unidade da OP: "unidade 2/3" do título, para agrupar por pedido.
  function unidadeDoTitulo(titulo) {
    const m = String(titulo || '').match(/unidade (\d+)\/(\d+)/i);
    return m ? { n: Number(m[1]), de: Number(m[2]) } : null;
  }

  window.FabOficinaCalc = { progresso, etapaAtualId, pausado, unidadeDoTitulo };
})();
