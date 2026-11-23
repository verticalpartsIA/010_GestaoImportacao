/* Precificação de Escada/Esteira Rolante — regras puras (05/11/2026, cotação 1009).
   Sem motor de cálculo: o Financeiro lança o preço de venda por equipamento. */
(function () {
  'use strict';

  const CATEGORIAS = {
    escada_rolante: { sigla: 'ER', tipo: 'escada', rotulo: 'Escada Rolante' },
    esteira_rolante: { sigla: 'ES', tipo: 'esteira', rotulo: 'Esteira Rolante' },
  };
  const ehEscEst = (cat) => Object.prototype.hasOwnProperty.call(CATEGORIAS, cat);
  const categoriaDoTipo = (tipo) => Object.keys(CATEGORIAS).find((k) => CATEGORIAS[k].tipo === tipo) || null;

  /* "1.234,56" | "1234.56" | "$18,990" | 1234.5 → número (0 se não der) */
  function parseValor(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    let s = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) {
      /* o último separador é o decimal ("1.234,56" pt-BR ou "18,990.50" en-US) */
      s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');   // "$18,990" = 18990
    else if (s.includes(',')) s = s.replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  const c2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  /* mesmo formato de PropostaOpcoes.textoBR: "257024,57" (sem milhar) */
  const textoBR = (n) => c2(n).toFixed(2).replace('.', ',');

  function numeroDocumento(categoria, numeroCotacao, letra) {
    const cat = CATEGORIAS[categoria];
    if (!cat || numeroCotacao == null) return null;
    const n = String(parseInt(numeroCotacao, 10)).padStart(4, '0');
    return `VPPC-${cat.sigla}${n}${letra ? '-' + letra : ''}`;
  }

  /* Itens da precificação a partir da cotação do fornecedor (dados_envio + respostas). */
  function itensDaCotacao(cotacao) {
    const unidades = (cotacao && cotacao.dados_envio && cotacao.dados_envio.unidades) || [];
    const resp = ((cotacao && cotacao.respostas && cotacao.respostas.itens) || []);
    const porUnidade = {}; resp.forEach((it) => { porUnidade[it.unidade_id] = it; });
    return unidades.map((u) => {
      const it = porUnidade[u.unidade_id] || {};
      return {
        unidadeId: u.unidade_id, identificador: u.identificador || '',
        modelo: it.modelo_fornecedor || u.modelo || '',
        quantidade: Number(u.quantidade) || 1,
        custoUnitarioUsd: parseValor(it.preco_unitario),
        precoVendaUnit: '',
      };
    });
  }

  /* Itens a partir do Formulário (envio direto, sem cotação de fornecedor). */
  function itensDasUnidades(unidades, tipo) {
    return (unidades || []).filter((u) => (u.tipo_equipamento || 'elevador') === tipo).map((u) => ({
      unidadeId: u.id, identificador: u.identificador || '', modelo: u.modelo || '',
      quantidade: Number(u.quantidade) || 1, custoUnitarioUsd: 0, precoVendaUnit: '',
    }));
  }

  function totais(itens) {
    let venda = 0, custoUsd = 0, qtd = 0;
    (itens || []).forEach((i) => {
      const q = Number(i.quantidade) || 0;
      qtd += q;
      venda += q * parseValor(i.precoVendaUnit);
      custoUsd += q * (Number(i.custoUnitarioUsd) || 0);
    });
    return { venda: c2(venda), custoUsd: c2(custoUsd), quantidade: qtd };
  }

  function faltando(pz) {
    const f = [];
    const itens = (pz && pz.itens) || [];
    if (!itens.length) f.push('Equipamentos');
    itens.forEach((i) => { if (!(parseValor(i.precoVendaUnit) > 0)) f.push(`Preço de venda de ${i.identificador || 'equipamento'}`); });
    return f;
  }

  /* Qual precificação alimenta a Proposta: só a finalizada (a mais recente). */
  function escolherParaProposta(lista, categoria) {
    return (lista || []).filter((p) => p.categoria === categoria && p.status === 'finalizado')
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;
  }

  /* Preenche valorUnit nas especificações da Proposta, por Unidade. Nunca sobrescreve o que já veio preenchido. */
  function aplicarPrecosNaProposta(especificacoes, pz) {
    if (!pz) return especificacoes;
    const porUnidade = {}; (pz.itens || []).forEach((i) => { porUnidade[i.unidadeId] = i; });
    return (especificacoes || []).map((e) => {
      const i = porUnidade[e.unidadeId];
      const v = i ? parseValor(i.precoVendaUnit) : 0;
      return v > 0 && !e.valorUnit ? { ...e, valorUnit: textoBR(v) } : e;
    });
  }

  window.PrecificacaoEscEstCalc = { CATEGORIAS, ehEscEst, categoriaDoTipo, parseValor, textoBR, numeroDocumento, itensDaCotacao, itensDasUnidades, totais, faltando, escolherParaProposta, aplicarPrecosNaProposta };
})();
