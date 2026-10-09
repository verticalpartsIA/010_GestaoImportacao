/* ============================================================
   custo-calc.js — Almoxarifado › Custos: contas puras (sem rede, sem React).
   window.PcpCusto = { parseValor, impacto }

   parseValor(texto): lê o valor digitado no campo "Custo manual (R$)".
     Antes o campo removia TODO ponto e trocava a vírgula por ponto, pensando só em "1.234,56": digitar "12.50" gravava
     R$ 1.250,00 e "0.75" gravava R$ 75, sem aviso, direto no lucro dos relatórios. Regras agora:
       - com vírgula: a vírgula é o decimal; pontos só valem como milhar ("1.234,56");
       - só ponto, 1 vez: até 2 casas depois (ou 4+) é decimal ("12.50", "9.5", "0.75", "0.750");
                          exatamente 3 casas depois, com parte inteira de 1–3 dígitos sem zero à esquerda,
                          é milhar ("1.234" = 1234) e devolve um aviso para a pessoa conferir;
       - só ponto, várias vezes: milhar ("1.234.567").
     Devolve { vazio: true } | { erro } | { valor, aviso? }.
     (Não usa window.parseMoeda de utils.js: aquela trata "1,234" como 1234 e devolve 0 em vez de erro; serve a texto
      de fornecedor, não a um campo digitado em português.)

   impacto(usadoEm, receitaPorRaiz): quanto da receita dos pedidos do PCP depende de cada folha (componente).
     Não dá para medir o "tamanho" do custo que falta (é justamente o que não se sabe; preco_venda do cadastro está
     zerado na maioria), então mede-se o que se sabe: a receita dos produtos vendidos que contêm o componente.
   ============================================================ */
(function () {
  'use strict';

  function parseValor(texto) {
    const s = String(texto == null ? '' : texto).trim().replace(/^R\$\s*/i, '').replace(/\s+/g, '');
    if (s === '') return { vazio: true };
    if (!/^[0-9.,]+$/.test(s)) return { erro: 'Use só números, ponto ou vírgula.' };
    const pontos = (s.match(/\./g) || []).length;
    const virgulas = (s.match(/,/g) || []).length;
    let num, aviso = null;
    if (virgulas > 1) return { erro: 'Há mais de uma vírgula.' };
    if (virgulas === 1) {
      const i = s.split(',')[0], d = s.split(',')[1];
      if (d.indexOf('.') !== -1) return { erro: 'Ponto depois da vírgula.' };
      if (pontos > 0 && !/^\d{1,3}(\.\d{3})+$/.test(i)) return { erro: 'Os pontos de milhar estão fora de lugar.' };
      num = Number(i.replace(/\./g, '') + '.' + d);
    } else if (pontos === 0) {
      num = Number(s);
    } else if (pontos === 1) {
      const i = s.split('.')[0], d = s.split('.')[1];
      if (/^\d{3}$/.test(d) && /^[1-9]\d{0,2}$/.test(i)) {
        num = Number(i + d);
        aviso = 'Lido como milhar (' + num.toLocaleString('pt-BR') + '). Para centavos, use vírgula (ex.: 1,234).';
      } else {
        num = Number(i + '.' + d);
      }
    } else {
      if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return { erro: 'Os pontos de milhar estão fora de lugar.' };
      num = Number(s.replace(/\./g, ''));
    }
    if (!Number.isFinite(num) || !(num > 0)) return { erro: 'Informe um valor maior que zero.' };
    if (num > 1000000) return { erro: 'Valor acima de R$ 1.000.000: confira.' };
    return aviso ? { valor: num, aviso: aviso } : { valor: num };
  }

  // usadoEm: { folha: Set|Array de produtos vendidos que dependem dela } · receitaPorRaiz: { produto: R$ vendido }
  // devolve { folha: { receita, pct, produtos } } (pct = fatia da receita total do PCP, 0–1)
  function impacto(usadoEm, receitaPorRaiz) {
    const total = Object.keys(receitaPorRaiz).reduce(function (s, k) { return s + (Number(receitaPorRaiz[k]) || 0); }, 0);
    const out = {};
    Object.keys(usadoEm).forEach(function (f) {
      const prods = Array.from(usadoEm[f]);
      const receita = prods.reduce(function (s, p) { return s + (Number(receitaPorRaiz[p]) || 0); }, 0);
      out[f] = { receita: receita, pct: total > 0 ? receita / total : 0, produtos: prods.length };
    });
    return out;
  }

  /* custoPorCompras(linhas, hojeIso, meses): custo do componente a partir das compras (pedidos de compra do Omie).
     Regra aprovada: média PONDERADA pela quantidade RECEBIDA das compras dos últimos `meses` (12), só linhas com preço > 0;
     sem compra recebida nesse prazo, cai para o preço do PEDIDO PENDENTE (ponderado pela quantidade pedida).
     Ponderar pela quantidade é o que protege de linhas de quantidade minúscula com preço fora do padrão (ex.: 0,03 × R$ 280
     ao lado de 7.000 × R$ 3,56) — o "último preço" erraria; a média ponderada ficou a ±30% do custo do Omie em 57 de 57 itens.
     Preço de pedido com valor 0 é ignorado (ex.: requisição convertida sem preço). IPI/ST/frete não entram: quase não vêm
     nas linhas (5 de 91) e incluí-los não aproximou do custo do Omie.
     linhas: [{ situacao: 'recebido'|'pendente', data_pedido: 'AAAA-MM-DD', quantidade, qtde_recebida, valor_unitario }]
     devolve { custo, fonte: 'media_12m'|'pedido_pendente', em: 'AAAA-MM-DD', n } ou null. */
  // BEGIN CALC custoPorCompras
  function custoPorCompras(linhas, hojeIso, meses) {
    const num = (x) => Number(x) || 0;
    const d = new Date(hojeIso + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() - (meses || 12));
    const desde = d.toISOString().slice(0, 10);
    const todas = linhas || [];
    const rec = todas.filter((l) => l.situacao === 'recebido' && num(l.valor_unitario) > 0 && num(l.qtde_recebida) > 0 && l.data_pedido && l.data_pedido >= desde);
    const pend = todas.filter((l) => l.situacao === 'pendente' && num(l.valor_unitario) > 0 && num(l.quantidade) > 0);
    const media = (ls, campo) => {
      const q = ls.reduce((s, l) => s + num(l[campo]), 0);
      const v = ls.reduce((s, l) => s + num(l[campo]) * num(l.valor_unitario), 0);
      return Math.round((v / q) * 10000) / 10000;
    };
    const maisRecente = (ls) => ls.map((l) => l.data_pedido || '').sort().pop() || null;
    if (rec.length) return { custo: media(rec, 'qtde_recebida'), fonte: 'media_12m', em: maisRecente(rec), n: rec.length };
    if (pend.length) return { custo: media(pend, 'quantidade'), fonte: 'pedido_pendente', em: maisRecente(pend), n: pend.length };
    return null;
  }
  // END CALC

  window.PcpCusto = { parseValor: parseValor, impacto: impacto, custoPorCompras: custoPorCompras };
}());
