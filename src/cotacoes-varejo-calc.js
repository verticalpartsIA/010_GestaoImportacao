/* ============================================================
   cotacoes-varejo-calc.js — regras puras das Cotações de Varejo (testadas em cotacoes-varejo-calc.test.js).
   Suprimentos & Importação › Cotações de Varejo. window.CotacoesVarejoCalc

   Preço por faixa de quantidade: cada resposta traz `faixas` = [{ min, preco }]. Para uma quantidade Q vale a faixa de
   MAIOR `min` que ainda seja ≤ Q. Se Q é menor que o `min` da 1ª faixa o preço da 1ª faixa vale, mas fica marcado
   `abaixoMin` (o fornecedor só vende a partir de `min`) — a tela avisa, não bloqueia.
   ============================================================ */
(function () {
  'use strict';

  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

  function faixasOrdenadas(faixas) {
    return (Array.isArray(faixas) ? faixas : [])
      .map((f) => ({ min: Math.max(1, num(f && f.min) || 1), preco: num(f && f.preco) }))
      .filter((f) => f.preco > 0)
      .sort((a, b) => a.min - b.min);
  }

  /* → { preco, min, abaixoMin } ou null (fornecedor não cotou este item) */
  function precoNaQuantidade(faixas, qtd) {
    const fx = faixasOrdenadas(faixas);
    if (!fx.length) return null;
    const q = num(qtd);
    let achada = null;
    fx.forEach((f) => { if (f.min <= q) achada = f; });
    if (achada) return { preco: achada.preco, min: achada.min, abaixoMin: false };
    return { preco: fx[0].preco, min: fx[0].min, abaixoMin: true };
  }

  /* Menor preço entre os fornecedores para a quantidade Q. respostas = { conviteId: resposta|undefined } → conviteId|null */
  function melhorConvite(respostas, qtd) {
    let melhor = null; let melhorPreco = Infinity;
    Object.keys(respostas || {}).forEach((cid) => {
      const p = precoNaQuantidade(respostas[cid] && respostas[cid].faixas, qtd);
      if (p && p.preco < melhorPreco) { melhorPreco = p.preco; melhor = cid; }
    });
    return melhor;
  }

  /* Valor na moeda do convite → R$. USD precisa de câmbio; BRL passa direto; outra moeda → null (não converte no escuro). */
  function paraReais(valor, moeda, cambioUsdBrl) {
    const m = String(moeda || 'USD').toUpperCase();
    if (m === 'BRL') return num(valor);
    if (m === 'USD') { const c = num(cambioUsdBrl); return c > 0 ? num(valor) * c : null; }
    return null;
  }

  /* Decisões de um item → quantidade total comprada e quanto falta/sobra em relação ao pedido. */
  function resumoItem(item, decisoesDoItem) {
    const comprada = (decisoesDoItem || []).reduce((a, d) => a + num(d.quantidade), 0);
    return { comprada, pedida: num(item && item.quantidade_pedida), diferenca: comprada - num(item && item.quantidade_pedida) };
  }

  /* itens, decisoes [{item_id, convite_id, quantidade}], respostas { 'convite|item': resposta }, convites [{id, moeda}], cambio
     → { porConvite: { id: { totalOriginal, totalBRL|null, itens:[{item_id,codigo,descricao,quantidade,preco,abaixoMin}] } }, totalBRL|null } */
  function consolidarPorFornecedor(itens, decisoes, respostas, convites, cambio) {
    const itemPorId = {}; (itens || []).forEach((i) => { itemPorId[i.id] = i; });
    const moedaPorConvite = {}; (convites || []).forEach((c) => { moedaPorConvite[c.id] = c.moeda; });
    const porConvite = {};
    let totalBRL = 0; let totalValido = true;
    (decisoes || []).forEach((d) => {
      const it = itemPorId[d.item_id]; if (!it || !(num(d.quantidade) > 0)) return;
      const r = respostas && respostas[d.convite_id + '|' + d.item_id];
      const p = precoNaQuantidade(r && r.faixas, d.quantidade);
      const preco = p ? p.preco : 0;
      const g = porConvite[d.convite_id] || (porConvite[d.convite_id] = { totalOriginal: 0, totalBRL: 0, itens: [] });
      g.totalOriginal += preco * num(d.quantidade);
      const brl = paraReais(preco * num(d.quantidade), moedaPorConvite[d.convite_id], cambio);
      if (brl == null) { g.totalBRL = null; totalValido = false; } else if (g.totalBRL != null) { g.totalBRL += brl; }
      g.itens.push({ item_id: it.id, codigo: it.codigo, descricao: it.descricao, quantidade: num(d.quantidade), preco, abaixoMin: !!(p && p.abaixoMin), semPreco: !p });
      if (brl != null) totalBRL += brl;
    });
    return { porConvite, totalBRL: totalValido ? totalBRL : null };
  }

  window.CotacoesVarejoCalc = { faixasOrdenadas, precoNaQuantidade, melhorConvite, paraReais, resumoItem, consolidarPorFornecedor };
}());
