/* ============================================================
   precificacao-ajustes-calc.js — coluna "Alterar valor" da Precificação
   (Gelson, 06/11/2026): regras PURAS.

   O Financeiro digita, por equipamento, a DIFERENÇA em R$ (pode ser negativa).
   - preço do equipamento = rateio do preço base + diferença; os outros ficam travados;
   - total = preço base (no mark-up digitado) + soma das diferenças;
   - o MARK-UP EFETIVO que fecha nesse total é recalculado pela conta inversa do motor
     (`alavancaParaPreco`), e impostos, comissões e DIFAL recalculam sobre o novo total;
   - chave de cada equipamento = "<unidadeId>:<equipamentoIndice>" (a mesma de valores_sugeridos_ceo).

   window.PrecificacaoAjustes
   ============================================================ */
(function () {
  'use strict';

  function num(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    return parseFloat((v ?? '0').toString().replace(/\./g, '').replace(',', '.')) || 0;
  }
  const c2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  /* Tira o que não é número ou é zero: o que fica é só ajuste de verdade. */
  function normalizar(ajustes) {
    const saida = {};
    Object.keys(ajustes || {}).forEach((k) => {
      const v = c2(num(ajustes[k]));
      if (v !== 0) saida[k] = v;
    });
    return saida;
  }

  function soma(ajustes) {
    return c2(Object.values(normalizar(ajustes)).reduce((s, v) => s + v, 0));
  }

  /* Total da cotação com os ajustes: preço base + soma das diferenças. */
  function totalComAjustes(precoBase, ajustes) {
    return c2((Number(precoBase) || 0) + soma(ajustes));
  }

  /* Preço final de um equipamento: base do rateio + a diferença dele. */
  function precoDoEquipamento(base, ajustes, chave) {
    const a = normalizar(ajustes);
    return c2((Number(base) || 0) + (a[chave] || 0));
  }

  /* Diferença a digitar para um equipamento chegar ao valor pedido pelo Comercial:
     valor pedido − o que a coluna "VLR Proposta" da Precificação mostra (e NÃO o valor da proposta,
     que pode estar defasado — caso VPPR-0993). */
  function diferencaParaPedido(valorPedido, vlrNaPrecificacao) {
    return c2((Number(valorPedido) || 0) - (Number(vlrNaPrecificacao) || 0));
  }

  /* Lucro PROJETADO para o preço que está na tela (13/11/2026, pedido do Gelson: "corrija o lucro por equipamento e o Preço p/ Venda").
     As colunas por equipamento misturavam dois estados: o lucro total vinha do último Calcular (preço salvo) e os preços das linhas
     já traziam as diferenças digitadas em "Alterar valor" e ainda não calculadas — o lucro de cada equipamento saía de um lucro velho
     repartido por preços novos. O lucro é LINEAR no preço (custos e créditos não mudam; impostos, serviços, comissões e DIFAL são
     proporcionais ao preço — é o que `margemMarginal` mede), então:  lucro(preço atual) = lucro salvo + margemMarginal × (atual − salvo).
     Sem diferença pendente devolve o lucro salvo, idêntico ao de antes. Exato (confere com o motor no teste). */
  function lucroProjetado({ lucroSalvo, margemMarginal, precoSalvo, precoAtual }) {
    const L = Number(lucroSalvo) || 0;
    const m = Number(margemMarginal) || 0;
    const Ps = Number(precoSalvo) || 0;
    const Pa = Number(precoAtual) || 0;
    if (!(Ps > 0) || !(m > 0) || Math.abs(Pa - Ps) < 0.005) return L;
    return L + m * (Pa - Ps);
  }

  window.PrecificacaoAjustes = { normalizar, soma, totalComAjustes, precoDoEquipamento, diferencaParaPedido, lucroProjetado, num };
}());
