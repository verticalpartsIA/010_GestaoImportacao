/* ============================================================
   fabricacao-quadro-calc.js — motor puro de progresso/pausa do
   Quadro de Fabricação (Evolução da Fabricação do Quadro de Comando,
   19/10/2026). Não fala com o Supabase — só processa o formato de
   linha que uma query real devolveria.

   resumoProgresso(statusRows): mesmo algoritmo ponderado (soma de
   pesos, teto 99% enquanto houver item aberto, 100% só com TUDO
   flegado E pesos somando >= 100) de
   acompanhamento-obra-store.js:resumoProgresso — adaptado pra ler a
   relação embutida fabricacao_quadro_itens (ordem, peso) em vez de
   acompanhamento_obra_itens, e devolvendo só {pct} (esta feature não
   tem marcos de 50/75/100 disparando evento, ao contrário do Diário
   de Obra).

   etapaAtualId(statusRows): primeiro item não flegado, por ORDEM
   (não pela posição em que a linha chegou no array).

   estaPausado(ocorrencias): true só quando existe uma ocorrência
   'aberta' sem frente de trabalho (tem_frente_trabalho === false) —
   outra ocorrência aberta COM frente de trabalho não pausa nada.

   window.FabricacaoQuadroCalc
   ============================================================ */
(function () {
  'use strict';

  function resumoProgresso(statusRows) {
    if (!statusRows || !statusRows.length) return { pct: 0 };
    const ordenados = [...statusRows].sort((a, b) => (a.fabricacao_quadro_itens?.ordem || 0) - (b.fabricacao_quadro_itens?.ordem || 0));
    let acumulado = 0;
    ordenados.forEach((s) => {
      if (!s.flegado) return;
      acumulado += Number(s.fabricacao_quadro_itens?.peso) || 0;
    });
    /* 100% só com TODOS os itens flegados; enquanto houver item aberto,
       o teto é 99% e o arredondamento é para baixo. Também exige que as
       linhas devolvidas cubram o checklist completo (pesos somam 100):
       um link seeded antes de todas as linhas existirem nunca pode
       mostrar 100% só porque o que existe está marcado. */
    const pesoTotal = ordenados.reduce((a, s) => a + (Number(s.fabricacao_quadro_itens?.peso) || 0), 0);
    const completo = ordenados.every((s) => s.flegado) && pesoTotal >= 100 - 0.001;
    const pct = completo ? 100 : Math.min(99, Math.floor(acumulado + 0.001));
    return { pct };
  }

  function etapaAtualId(statusRows) {
    if (!statusRows || !statusRows.length) return null;
    const ordenados = [...statusRows].sort((a, b) => (a.fabricacao_quadro_itens?.ordem || 0) - (b.fabricacao_quadro_itens?.ordem || 0));
    const proxima = ordenados.find((s) => !s.flegado);
    return proxima ? proxima.item_id : null;
  }

  function estaPausado(ocorrencias) {
    return (ocorrencias || []).some((o) => o.status === 'aberta' && o.tem_frente_trabalho === false);
  }

  window.FabricacaoQuadroCalc = { resumoProgresso, etapaAtualId, estaPausado };
})();
