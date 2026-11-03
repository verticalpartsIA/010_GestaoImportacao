/* ============================================================
   solicitacoes-produto-timeline-calc.js — regras puras da linha do tempo
   (Engenharia & Produto › Solicitações de Produto, 8.3). Sem acesso a dados:
   recebe os eventos de `solicitacao_produto_eventos` e devolve as frases.
   window.SolProdTimeline
   ============================================================ */
(function (root) {
  'use strict';

  /* Quem pode ser avisado em cada etapa (decisão do Gelson, 03/11/2026). */
  var ENGENHARIA = [
    { nome: 'Gelson Simoes', email: 'gelson.simoes@verticalparts.com.br' },
    { nome: 'Alexandre Schmidt', email: 'alexandre@verticalparts.com.br' },
    { nome: 'Vinicius Leite', email: 'vinicius.leite@verticalparts.com.br' },
    { nome: 'Brayan Souza', email: 'automacao@verticalparts.com.br' },
  ];
  var IMPORTACAO = [
    { nome: 'Andreia Oliveira', email: 'andreia.oliveira@verticalparts.com.br' },
    { nome: 'Beatriz Anderson', email: 'beatriz@verticalparts.com.br' },
    { nome: 'Bianca Mayumi', email: 'bianca@verticalparts.com.br' },
  ];

  function pessoa(lista, email) {
    var e = String(email || '').trim().toLowerCase();
    return lista.find(function (p) { return p.email === e; }) || null;
  }

  /* Nome para mostrar: o gravado no evento; senão o e-mail; senão "Alguém". */
  function nomeDe(nome, email) {
    return String(nome || '').trim() || String(email || '').trim() || 'Alguém';
  }

  /* Resumo curto do que foi pedido, para o título do aviso. Duas solicitações no mesmo dia
     não podem ter o mesmo título normalizado, senão o gi-avisos agrupa e a segunda não sai. */
  function resumo(texto, max) {
    var t = String(texto || '').replace(/\s+/g, ' ').trim();
    var lim = max || 40;
    if (t.length <= lim) return t;
    return t.slice(0, lim - 1).replace(/\s+\S*$/, '') + '…';
  }

  /* Uma frase por evento. Nunca usa pronome: só nomes. */
  function frase(ev) {
    var ator = nomeDe(ev.ator_nome, ev.ator_email);
    var alvo = nomeDe(ev.alvo_nome, ev.alvo_email);
    var d = ev.detalhe || {};
    switch (ev.tipo) {
      case 'aberta': return ator + ' abriu a solicitação';
      case 'aviso_engenharia':
        if (d.aviso_enviado === false) return 'O aviso para ' + alvo + ' NÃO saiu (escolhido(a) por ' + ator + ')';
        return alvo + ' foi avisado(a) para criar a Ficha Técnica (escolhido(a) por ' + ator + ')';
      case 'analise_iniciada': return ator + ' iniciou a análise';
      case 'ficha_criada': return ator + ' criou a Ficha Técnica';
      case 'aviso_importacao': return alvo + ' foi avisado(a) para conferir o NCM e publicar no Omie (escolhido(a) por ' + ator + ')';
      case 'ficha_publicada': {
        var verbo = /^republicou/i.test(String(d.acao || '')) ? 'republicou' : 'publicou';
        return ator + ' ' + verbo + ' no Omie' + (d.codigo_produto ? ' (' + d.codigo_produto + ')' : '');
      }
      default: return ator + ': ' + ev.tipo;
    }
  }

  function ordenar(eventos) {
    return (eventos || []).slice().sort(function (a, b) {
      return new Date(a.criado_em) - new Date(b.criado_em);
    });
  }

  /* Valida a escolha de quem avisar: tem de ser alguém da lista da etapa. */
  function escolhaValida(lista, email) {
    return !!pessoa(lista, email);
  }

  root.SolProdTimeline = { ENGENHARIA: ENGENHARIA, IMPORTACAO: IMPORTACAO, pessoa: pessoa, nomeDe: nomeDe, resumo: resumo, frase: frase, ordenar: ordenar, escolhaValida: escolhaValida };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SolProdTimeline;
}(typeof window !== 'undefined' ? window : globalThis));
