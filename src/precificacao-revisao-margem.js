/* ============================================================
   precificacao-revisao-margem.js — prévia da MARGEM no total que o Comercial pediu
   (07/11/2026, pendência 11 de 5.2.10 do módulo 5).

   A faixa "Revisão de valor pedida pelo Comercial" já mostra o mark-up que leva ao total pedido
   (`alavancaParaPreco`). Faltava dizer o que sobra de margem nesse total: roda o MOTOR OFICIAL
   (calcularV2, método da planilha) com esse mark-up e devolve a mesma margem efetiva que a
   trava de aprovação usa (`precificacao.margemEfetivaPct`), mais o lucro em R$.

   Limite honesto: o DIFAL depende do preço. Aqui ele acompanha o preço na mesma proporção do
   cálculo atual (custo do DIFAL ÷ preço do equipamento, constante), sem consultar a tabela de
   estados. É uma PRÉVIA; o valor exato sai ao clicar em Calcular. Só leitura: não grava nada.
   window.PrecificacaoRevisaoMargem
   ============================================================ */
(function () {
  /* E: window.PrecificacaoElevadorEngine
     baseInputs: PrecificacaoElevadorStore.montarBaseInputs(pz).baseInputs
     extras: { modoFormacaoPreco, margemDesejadaPct, contingenciaValor, outrosCustosNaoRecuperaveisRs } (mesmos do Calcular)
     res: resultado V2 salvo (para a conta inversa e para a razão do DIFAL)
     alvo: total pedido (R$); difalAtualRs: custo do DIFAL no cálculo atual (0 se não for da VerticalParts)
     (13/11/2026: a "margem mínima" saiu da precificação — não consta da planilha) */
  function previaMargem({ E, baseInputs, extras, res, alvo, difalAtualRs }) {
    if (!E || !res || !res.precificacao || !baseInputs) return null;
    const al = E.alavancaParaPreco(res, alvo);
    // só o método da planilha (mark-up sobre o preço); sem alavanca válida não há prévia
    if (!al || !al.valido || al.campo !== 'mark_up_pct') return null;

    const equipAtual = Number(res.precificacao.precoVendaProduto) || 0;
    const razaoDifal = equipAtual > 0 ? (Number(difalAtualRs) || 0) / equipAtual : 0;
    let difal = Number(difalAtualRs) || 0;
    let r = null;
    for (let it = 0; it < 30; it++) {
      r = E.calcularV2({ ...baseInputs, difalCustoRs: difal, ...(extras || {}), markUpPct: al.valor });
      const equipNovo = Number(r.precificacao.precoVendaProduto) || 0;
      const proximo = razaoDifal * equipNovo;
      if (Math.abs(proximo - difal) < 0.005) break;
      difal = proximo;
    }

    const margemPct = Number(r.precificacao.margemEfetivaPct) || 0;
    return {
      markUpPct: al.valor,
      precoRs: Number(r.precificacao.precoVendaProposta) || 0,
      lucroRs: Number(r.precificacao.lucroFinal) || 0,
      margemPct,
    };
  }

  window.PrecificacaoRevisaoMargem = { previaMargem };
}());
