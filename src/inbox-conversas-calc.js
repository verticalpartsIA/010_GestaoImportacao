/* ============================================================
   inbox-conversas-calc.js — Inbox fase 4C (04/10/2026): agrupar mensagens em CONVERSAS (threads), como no Gmail.
   Funções PURAS (testadas em inbox-conversas-calc.test.js). Duas evidências, nesta ordem:
     1) cabeçalho: a mensagem responde (In-Reply-To) a outra que temos (Message-ID) → mesma conversa (certo);
     2) fallback: mesmo assunto sem "Re:/Fwd:" E alguma ponta externa em comum (ou a mesma Cotação Nº) → mesma conversa.
   Assunto igual com gente diferente NÃO junta ("Orçamento" de dois fornecedores são conversas distintas).
   window.InboxConversas = { normalizarAssunto, pontasExternas, agrupar }
   ============================================================ */
(function () {
  'use strict';

  const PREFIXO = /^\s*((re|res|enc|fw|fwd|aw|tr|rv|ref)\s*(\[\d+\])?\s*:\s*)+/i;
  const sem = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* "Re: Re: Cotação técnica" e "RES: cotação tecnica" → "cotacao tecnica" */
  function normalizarAssunto(s) {
    let t = String(s == null ? '' : s);
    for (let i = 0; i < 6 && PREFIXO.test(t); i++) t = t.replace(PREFIXO, '');
    return sem(t).replace(/\s+/g, ' ').trim();
  }

  const INTERNO = /@(vpsistema\.com|verticalparts\.com\.br)$/i;
  /* quem está do outro lado: remetente (recebido) ou destinatários (enviado), sem a nossa caixa e sem domínios internos */
  function pontasExternas(m) {
    const lista = m && m._pasta === 'sent' ? (m.to || []) : [m && m.from];
    return lista.map((x) => sem(x).trim()).filter((x) => x && x.includes('@') && !INTERNO.test(x));
  }

  /* msgs: [{ id, date, subject, from, to, numeroCotacao, _pasta }]; ids: { [id]: { messageId, inReplyTo } }
     Devolve { conversas: [{ chave, ids (mais recente primeiro), repId, total }], porId: { id → conversa } } */
  function agrupar(msgs, ids) {
    const lista = msgs || [];
    const pai = {};
    const raiz = (x) => { while (pai[x] !== x) { pai[x] = pai[pai[x]]; x = pai[x]; } return x; };
    const unir = (a, b) => { const ra = raiz(a), rb = raiz(b); if (ra !== rb) pai[ra] = rb; };
    lista.forEach((m) => { pai[m.id] = m.id; });

    const porMessageId = {};
    lista.forEach((m) => { const mid = ids && ids[m.id] && ids[m.id].messageId; if (mid) porMessageId[mid] = m.id; });
    lista.forEach((m) => {
      const irt = ids && ids[m.id] && ids[m.id].inReplyTo;
      if (irt && porMessageId[irt] && porMessageId[irt] !== m.id) unir(m.id, porMessageId[irt]);
    });

    const porAssunto = {};
    lista.forEach((m) => { const a = normalizarAssunto(m.subject); if (a.length >= 4) (porAssunto[a] = porAssunto[a] || []).push(m); });
    Object.values(porAssunto).forEach((grupo) => {
      for (let i = 0; i < grupo.length; i++) {
        for (let j = i + 1; j < grupo.length; j++) {
          const a = grupo[i], b = grupo[j];
          const mesmaCotacao = a.numeroCotacao != null && a.numeroCotacao === b.numeroCotacao;
          const pa = pontasExternas(a), pb = pontasExternas(b);
          const comum = pa.length && pb.some((x) => pa.includes(x));
          // a mesma Cotação Nº só junta quando nenhum dos dois tem ponta externa (aviso interno); fornecedores diferentes NÃO se misturam
          if (comum || (mesmaCotacao && !pa.length && !pb.length)) unir(a.id, b.id);
        }
      }
    });

    const grupos = {};
    lista.forEach((m) => { (grupos[raiz(m.id)] = grupos[raiz(m.id)] || []).push(m); });
    const conversas = Object.entries(grupos).map(([chave, ms]) => {
      ms.sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
      return { chave, ids: ms.map((m) => m.id), repId: ms[0].id, total: ms.length };
    });
    const porId = {};
    conversas.forEach((c) => c.ids.forEach((id) => { porId[id] = c; }));
    return { conversas, porId };
  }

  const api = { normalizarAssunto, pontasExternas, agrupar };
  if (typeof window !== 'undefined') window.InboxConversas = api;
  if (typeof module !== 'undefined') module.exports = api;
}());
