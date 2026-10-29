/* ============================================================
   embarques-frete-calc.js — regras puras das cotações de frete marítimo
   do embarque (aba Frete). Sem tela, sem banco: testável.
   window.EmbFreteCalc
   ============================================================ */
(function () {
  'use strict';

  var MAX_COTACOES = 4;
  var MOEDAS = ['USD', 'BRL'];

  function num(v) {
    if (v === '' || v == null) return 0;
    var str = String(v).trim();
    // "1.200,50" (pt-BR) ou "1200.50" (campo numérico): vírgula decide.
    var n = typeof v === 'number' ? v : Number(str.indexOf(',') >= 0 ? str.replace(/\./g, '').replace(',', '.') : str);
    return isFinite(n) ? n : 0;
  }
  function arred(n) { return Math.round(n * 100) / 100; }

  function novaCotacao(id) {
    return {
      id: id, fornecedor_id: null, agente: '', email: '', contato: '',
      taxas: [{ descricao: 'Frete marítimo', moeda: 'USD', valor: '' }],
      transit_time: '', free_time: '', observacao: '',
      anexos: [], envios: [], vencedor: false,
    };
  }

  function novaTaxa() { return { descricao: '', moeda: 'USD', valor: '' }; }

  // Soma por moeda (só USD e BRL entram nos totais pedidos).
  function totais(taxas) {
    var t = { usd: 0, brl: 0 };
    (taxas || []).forEach(function (x) {
      var v = num(x && x.valor);
      if (!v) return;
      if (x.moeda === 'BRL') t.brl += v; else t.usd += v;
    });
    return { usd: arred(t.usd), brl: arred(t.brl) };
  }

  // Só 1 vencedora por embarque; clicar de novo na vencedora a desmarca.
  function definirVencedor(cotacoes, id) {
    var lista = cotacoes || [];
    var jaEra = lista.some(function (c) { return c.id === id && c.vencedor; });
    return lista.map(function (c) { return Object.assign({}, c, { vencedor: !jaEra && c.id === id }); });
  }

  function vencedor(cotacoes) {
    return (cotacoes || []).filter(function (c) { return c && c.vencedor; })[0] || null;
  }

  // Campos únicos do embarque que o resto do sistema já lê (espelho em
  // `embarques`, Precificação, Evolução). Sem vencedora → null (não mexe).
  function resumoVencedor(cotacoes) {
    var v = vencedor(cotacoes);
    if (!v) return null;
    var t = totais(v.taxas);
    var usd = t.usd > 0;
    return {
      agente_carga: v.agente || null,
      cotacao_frete: usd ? t.usd : (t.brl > 0 ? t.brl : null),
      moeda_frete: usd ? 'USD' : (t.brl > 0 ? 'BRL' : null),
      transit_time: v.transit_time === '' || v.transit_time == null ? null : num(v.transit_time),
      free_time: v.free_time === '' || v.free_time == null ? null : num(v.free_time),
    };
  }

  // Embarque antigo (null/undefined/objeto estranho) carrega como lista vazia.
  function normalizar(lista) {
    if (!Array.isArray(lista)) return [];
    return lista.filter(function (c) { return c && typeof c === 'object'; }).slice(0, MAX_COTACOES).map(function (c) {
      var base = novaCotacao(c.id);
      var o = Object.assign(base, c);
      o.taxas = Array.isArray(c.taxas) ? c.taxas : [];
      o.anexos = Array.isArray(c.anexos) ? c.anexos : [];
      o.envios = Array.isArray(c.envios) ? c.envios : [];
      return o;
    });
  }

  // Id da cotação (vira referencia_id do e-mail e nome da pasta de anexos). Não depende do id do embarque:
  // o embarque novo ainda não tem id quando a cotação nasce.
  function proximoId(cotacoes) {
    var usados = (cotacoes || []).map(function (c) { return String(c.id); });
    for (var t = 0; t < 20; t++) {
      var r = '';
      for (var k = 0; k < 8; k++) r += Math.floor(Math.random() * 16).toString(16);
      var id = 'FRT-' + r;
      if (usados.indexOf(id) < 0) return id;
    }
    return 'FRT-' + Date.now().toString(16);
  }

  // Valida antes de salvar: devolve lista de avisos (não bloqueia o salvamento).
  function avisos(cotacoes) {
    var out = [];
    var lista = cotacoes || [];
    if (lista.length > MAX_COTACOES) out.push('No máximo ' + MAX_COTACOES + ' cotações por embarque.');
    if (lista.filter(function (c) { return c.vencedor; }).length > 1) out.push('Só uma cotação pode ser a vencedora.');
    return out;
  }

  window.EmbFreteCalc = {
    MAX_COTACOES: MAX_COTACOES, MOEDAS: MOEDAS,
    novaCotacao: novaCotacao, novaTaxa: novaTaxa, totais: totais,
    definirVencedor: definirVencedor, vencedor: vencedor, resumoVencedor: resumoVencedor,
    normalizar: normalizar, proximoId: proximoId, avisos: avisos,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.EmbFreteCalc;
}());
