/* ============================================================
   inbox-preco-calc.js — Inbox: extrair PREÇO e condições do e-mail de resposta do fornecedor (04/10/2026).
   Funções PURAS (testadas em inbox-preco-calc.test.js). SÓ REGRAS (regex), sem IA: lê o texto do e-mail e PROPÕE valores;
   quem confirma é uma pessoa na tela — nada é gravado daqui. A confiança é de regra (linha com identificador da unidade =
   alta; valor solto = baixa), NÃO calibrada.
   window.InboxPreco = { limparCitacao, numeroDe, extrair, montarRespostas }
   ============================================================ */
(function () {
  'use strict';

  const sem = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* Corta a parte CITADA do e-mail (a nossa própria RFQ que o fornecedor devolveu junto) — ali há números que não são preço. */
  function limparCitacao(texto) {
    const linhas = String(texto == null ? '' : texto).replace(/\r/g, '').split('\n');
    const out = [];
    for (const l of linhas) {
      if (/^\s*(on .{5,80} wrote:|em .{5,80} escreveu:|-{2,}\s*original message|-{2,}\s*mensagem original|from:\s.+@|de:\s.+@)/i.test(l)) break;
      if (/^\s*>/.test(l)) continue;
      out.push(l);
    }
    return out.join('\n');
  }

  /* "12,820.00" (EUA) / "12.820,00" (BR) / "12820" / "12 820" → número; texto sem número → null.
     Separador com 1–2 dígitos depois dele = decimal; com 3 dígitos = milhar. */
  function numeroDe(s) {
    const t = String(s == null ? '' : s).replace(/[^\d.,]/g, '');
    if (!/\d/.test(t)) return null;
    const ult = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','));
    const casasDepois = ult >= 0 ? t.length - ult - 1 : 0;
    if (ult >= 0 && casasDepois >= 1 && casasDepois <= 2) {
      const n = Number(t.slice(0, ult).replace(/[.,]/g, '') + '.' + t.slice(ult + 1));
      return Number.isFinite(n) ? n : null;
    }
    const n = Number(t.replace(/[.,]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  const MOEDAS = [
    ['USD', /(US\$|U\$S|USD|\bUS\s*dollars?\b|d[oó]lar(?:es)? americanos?|\bdollars?\b)/i],
    ['EUR', /(€|\bEUR\b|\beuros?\b)/i],
    ['CNY', /(RMB|CNY|¥|\byuan\b)/i],
    ['BRL', /(R\$|\bBRL\b|\breais\b)/i],
  ];
  function moedaDoTexto(t) {
    for (const [cod, re] of MOEDAS) if (re.test(t)) return cod;
    if (/\$/.test(t)) return 'USD';
    return null;
  }

  const RE_VALOR_MOEDA = /(?:US\$|U\$S|USD|RMB|CNY|EUR|BRL|R\$|[$€¥])\s*([\d][\d.,]*\d|\d)|([\d][\d.,]*\d)\s*(?:USD|US\$|RMB|CNY|EUR|BRL|dollars?|d[oó]lares?|reais)/gi;
  const RE_VALOR_ROTULO = /\b(?:unit\s*price|price|pre[cç]o|valor|amount|total|each|fob|cif|exw)\b[^\d\n]{0,28}?([\d][\d.,]*\d)/gi;

  /* unidades: [{ unidade_id, identificador, indice_ativo, quantidade }] */
  function unidadeDaLinha(linha, unidades) {
    const l = sem(linha);
    for (const u of unidades || []) {
      const id = sem(u.identificador || '');
      if (id && l.includes(id)) return { unidade: u, confianca: 'alta' };
    }
    const m = l.match(/\b(?:item|unit|unidade|elevator|elevador|no\.?|#)\s*0*(\d{1,3})\b/);
    if (m) {
      const u = (unidades || []).find((x) => Number(x.indice_ativo) === Number(m[1]));
      if (u) return { unidade: u, confianca: 'media' };
    }
    return null;
  }

  function tipoDaLinha(linha) {
    const l = sem(linha);
    if (/\b(total|subtotal|amount|soma|sum)\b/.test(l) && !/unit/.test(l)) return 'total';
    if (/\b(unit|unitario|each|per set|per unit|\/set|\/unit|por unidade)\b/.test(l)) return 'unitario';
    return 'desconhecido';
  }

  function campo(texto, regs) {
    for (const re of regs) { const m = texto.match(re); if (m && m[1]) return m[1].trim().replace(/\s+/g, ' ').slice(0, 200); }
    return '';
  }

  /* extrair(texto, unidades) → { moeda, valores:[{valor,linha,tipo,unidadeId,confianca}], termos:{...}, avisos:[] } */
  function extrair(textoBruto, unidades) {
    const texto = limparCitacao(textoBruto);
    const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
    const valores = [];
    const vistos = new Set();
    linhas.forEach((linha, idx) => {
      const achados = [];
      for (const re of [RE_VALOR_MOEDA, RE_VALOR_ROTULO]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(linha))) {
          const v = numeroDe(m[1] || m[2]);
          // ignora anos, números pequenos, percentuais ("30%") e prazos/medidas ("30 days", "2000mm") sem moeda
          const depois = linha.slice(m.index + m[0].length, m.index + m[0].length + 8);
          if (v == null || v < 100 || (v >= 1990 && v <= 2100 && !/[$€¥]|usd|rmb|cny|eur/i.test(m[0]))) continue;
          if (/^\s*(%|days?|dias|months?|meses|kg|mm|pcs|sets?\b)/i.test(depois)) continue;
          achados.push(v);
        }
      }
      achados.forEach((v) => {
        const chave = idx + ':' + v;
        if (vistos.has(chave)) return;
        vistos.add(chave);
        const alvo = unidadeDaLinha(linha, unidades);
        valores.push({ valor: v, linha: linha.slice(0, 180), tipo: tipoDaLinha(linha), unidadeId: alvo ? alvo.unidade.unidade_id : null, confianca: alvo ? alvo.confianca : 'baixa' });
      });
    });

    // uma única unidade + um único valor "solto": propõe com confiança média
    const us = unidades || [];
    if (us.length === 1 && valores.length === 1 && !valores[0].unidadeId) { valores[0].unidadeId = us[0].unidade_id; valores[0].confianca = 'media'; }

    const termos = {
      moeda: moedaDoTexto(texto) || '',
      incoterm_porto: campo(texto, [/\b((?:FOB|CIF|CFR|EXW|FCA|CPT|DAP)\b[^\n.;]{0,40})/i]),
      container_no: campo(texto, [/\b(\d+\s*[x×]\s*(?:20|40)\s*(?:'|ft)?\s*(?:HC|GP|DV|RF|OT|FR)?)\b/i, /\b((?:20|40)\s*(?:'|ft)?\s*(?:HC|GP|DV)\s*[x×]\s*\d+)\b/i]),
      prazo_fabricacao: campo(texto, [/\b(?:lead[ \t]*time|production[ \t]*time|delivery[ \t]*time|prazo(?:[ \t]*de[ \t]*(?:fabrica[cç][aã]o|entrega))?)[ \t]*[:\-–]?[ \t]*([^\n]{3,120})/i]),
      validade_dias: campo(texto, [/(?:valid(?:ity)?|validade)[^\d\n]{0,30}(\d{1,3})\s*(?:days?|dias)/i]),
      garantia: campo(texto, [/\b(?:warranty|garantia)[ \t]*[:\-–]?[ \t]*([^\n]{3,120})/i]),
      condicoes_pagamento: campo(texto, [/\b(?:payment(?:[ \t]*terms?)?|pagamento|condi[cç][oõ]es de pagamento)[ \t]*[:\-–]?[ \t]*([^\n]{3,140})/i, /(\d{1,3}[ \t]*%[ \t]*(?:T\/T|TT|deposit|advance|sinal)[^\n]{0,100})/i]),
      frete_internacional_usd: (() => { const m = texto.match(/(?:ocean\s*)?freight[^\d\n]{0,25}([\d][\d.,]*\d)/i); const n = m ? numeroDe(m[1]) : null; return n != null ? String(n) : ''; })(),
    };

    const avisos = [];
    if (!valores.length) avisos.push('Não achei nenhum valor com moeda ou rótulo de preço no texto. Digite os preços na tabela abaixo.');
    if (valores.some((v) => v.confianca === 'baixa')) avisos.push('Alguns valores não citam a unidade — confira a quem pertencem.');
    return { moeda: termos.moeda, valores, termos, avisos };
  }

  /* montarRespostas({ atual, unidades, precos:{unidade_id:{preco_unitario}}, termos })
     Devolve o objeto `respostas` no MESMO formato do formulário do fornecedor (cotacao-elevador-fornecedor-store.js).
     preco_total = unitário × quantidade da unidade. `atual` (resposta anterior, se houver) é preservada no que não for informado. */
  function montarRespostas(p) {
    const base = p.atual && typeof p.atual === 'object' ? p.atual : {};
    const itensAtuais = Array.isArray(base.itens) ? base.itens : [];
    const itens = (p.unidades || []).map((u) => {
      const ant = itensAtuais.find((i) => i.unidade_id === u.unidade_id) || {};
      const unit = Number((p.precos && p.precos[u.unidade_id] && p.precos[u.unidade_id].preco_unitario) || 0);
      const qtd = Number(u.quantidade) > 0 ? Number(u.quantidade) : 1;
      return {
        divergencias: {}, ...ant, unidade_id: u.unidade_id, unidade_identificador: u.identificador || ant.unidade_identificador || '',
        preco_unitario: unit, preco_total: Math.round(unit * qtd * 100) / 100,
      };
    });
    const t = p.termos || {};
    const pick = (k) => (t[k] != null && String(t[k]).trim() !== '' ? String(t[k]).trim() : (base[k] || ''));
    return {
      ...base,
      moeda: t.moeda || base.moeda || 'USD',
      incoterm_porto: pick('incoterm_porto'), container_no: pick('container_no'), prazo_fabricacao: pick('prazo_fabricacao'),
      validade_dias: pick('validade_dias'), garantia: pick('garantia'), condicoes_pagamento: pick('condicoes_pagamento'),
      frete_internacional_usd: pick('frete_internacional_usd'), observacoes_gerais: pick('observacoes_gerais'),
      itens,
    };
  }

  const api = { limparCitacao, numeroDe, extrair, montarRespostas };
  if (typeof window !== 'undefined') window.InboxPreco = api;
  if (typeof module !== 'undefined') module.exports = api;
}());
