/* ============================================================
   inbox-busca-calc.js — busca estilo Gmail + ordenação do Inbox (04/10/2026, fase 3).
   Funções PURAS (testadas em inbox-busca-calc.test.js). A busca roda sobre as mensagens já carregadas na tela
   (Caixa de entrada + Enviados), não sobre o histórico completo — isso é a fase 4 (backend).
   Operadores (português e inglês, como no Gmail):
     de:x  para:x  assunto:x  cotacao:955  tem:anexo  é:nao-lida|lida|estrela  depois:2026-10-01  antes:2026-10-31
     em:entrada|enviados|estrela|meus|triagem|todos   -palavra (exclui)   "frase exata"   palavras soltas (todas devem aparecer)
   window.InboxBusca = { parseConsulta, montarConsulta, aplicar, ordenar, normalizar, vazia }
   ============================================================ */
(function () {
  'use strict';

  const normalizar = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* quebra em tokens respeitando aspas: de:"fulano silva" e "frase exata" ficam inteiros */
  function tokens(texto) {
    const out = [];
    const re = /(-?[\wçãõáéíóúâêôà]+:)?"([^"]*)"|\S+/gi;
    let m;
    const t = String(texto || '');
    while ((m = re.exec(t))) {
      if (m[2] !== undefined) out.push((m[1] || '') + m[2]);   // com aspas → valor sem aspas
      else out.push(m[0]);
    }
    return out;
  }

  const DATA = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
  function paraData(v, fimDoDia) {
    const m = DATA.exec(String(v || '').trim());
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), fimDoDia ? 23 : 0, fimDoDia ? 59 : 0, fimDoDia ? 59 : 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function parseConsulta(texto) {
    const q = { termos: [], excluir: [], de: [], para: [], assunto: [], anexo: false, lida: null, estrela: false, depois: null, antes: null, em: null, cotacao: null };
    tokens(texto).forEach((tk) => {
      const neg = tk.startsWith('-') && tk.length > 1;
      const corpo = neg ? tk.slice(1) : tk;
      const i = corpo.indexOf(':');
      const chave = i > 0 ? normalizar(corpo.slice(0, i)) : '';
      const valor = i > 0 ? corpo.slice(i + 1) : corpo;
      const v = normalizar(valor);
      if (neg) { if (v) q.excluir.push(v); return; }          // -palavra e -campo:valor → exclui o valor
      switch (chave) {
        case 'de': case 'from': if (v) q.de.push(v); return;
        case 'para': case 'to': if (v) q.para.push(v); return;
        case 'assunto': case 'subject': if (v) q.assunto.push(v); return;
        case 'cotacao': case 'vpct': { const n = parseInt(v.replace(/\D/g, ''), 10); if (n) q.cotacao = n; return; }
        case 'tem': case 'has': if (/anexo|attach/.test(v)) q.anexo = true; return;
        case 'e': case 'is':
          if (/^(nao-?lida|naolida|unread)$/.test(v)) q.lida = false;
          else if (/^(lida|read)$/.test(v)) q.lida = true;
          else if (/^(estrela|starred|star)$/.test(v)) q.estrela = true;
          return;
        case 'depois': case 'after': q.depois = paraData(valor, false) || q.depois; return;
        case 'antes': case 'before': q.antes = paraData(valor, true) || q.antes; return;
        case 'em': case 'in': {
          const mapa = { entrada: 'inbox', inbox: 'inbox', enviados: 'sent', enviado: 'sent', sent: 'sent', estrela: 'starred', starred: 'starred',
            meus: 'mine', meu: 'mine', mine: 'mine', triagem: 'triagem', todos: 'all', all: 'all' };
          if (mapa[v]) q.em = mapa[v];
          return;
        }
        default: if (v) q.termos.push(v);
      }
    });
    return q;
  }

  /* Texto do campo de busca a partir do formulário "Pesquisa avançada". */
  function montarConsulta(f) {
    const a = (k, v) => (v && String(v).trim() ? (/\s/.test(String(v).trim()) ? `${k}:"${String(v).trim()}"` : `${k}:${String(v).trim()}`) : '');
    const solto = (s, pref) => String(s || '').trim().split(/\s+/).filter(Boolean).map((p) => pref + p).join(' ');
    return [
      a('de', f.de), a('para', f.para), a('assunto', f.assunto),
      solto(f.contem, ''), solto(f.naoTem, '-'),
      f.anexo ? 'tem:anexo' : '', f.naoLida ? 'é:nao-lida' : '', f.estrela ? 'é:estrela' : '',
      f.depois ? 'depois:' + f.depois : '', f.antes ? 'antes:' + f.antes : '',
      f.em && f.em !== 'todos' ? 'em:' + f.em : '',
    ].filter(Boolean).join(' ');
  }

  /* aplicar(m, q) — m: { from, fromName, to[], cc[], subject, preview, anexos[], date, numeroCotacao, naoLida, estrela } */
  function aplicar(m, q) {
    if (!q) return true;
    const de = normalizar((m.from || '') + ' ' + (m.fromName || ''));
    const para = normalizar([...(m.to || []), ...(m.cc || [])].join(' '));
    const assunto = normalizar(m.subject);
    const tudo = normalizar([m.subject, m.fromName, m.from, m.preview, m.numeroCotacao != null ? m.numeroCotacao : '', (m.to || []).join(' ')].join(' '));
    if (q.de.some((x) => !de.includes(x))) return false;
    if (q.para.some((x) => !para.includes(x))) return false;
    if (q.assunto.some((x) => !assunto.includes(x))) return false;
    if (q.termos.some((x) => !tudo.includes(x))) return false;
    if (q.excluir.some((x) => tudo.includes(x))) return false;
    if (q.anexo && !(m.anexos && m.anexos.length)) return false;
    if (q.lida === true && m.naoLida) return false;
    if (q.lida === false && !m.naoLida) return false;
    if (q.estrela && !m.estrela) return false;
    if (q.cotacao != null && Number(m.numeroCotacao) !== q.cotacao) return false;
    const quando = m.date ? new Date(m.date) : null;
    if (q.depois && (!quando || quando < q.depois)) return false;
    if (q.antes && (!quando || quando > q.antes)) return false;
    return true;
  }

  const vazia = (q) => !q || (!q.termos.length && !q.excluir.length && !q.de.length && !q.para.length && !q.assunto.length && !q.anexo
    && q.lida === null && !q.estrela && !q.depois && !q.antes && !q.em && q.cotacao == null);

  /* ordenar(lista, tipo, f) — tipo: 'padrao' | 'nao_lidas' | 'estrela' | 'importantes'. Dentro de cada grupo, mais recentes primeiro.
     f = { naoLida(m), estrela(m), importante(m) } */
  function ordenar(lista, tipo, f) {
    const peso = (m) => {
      if (tipo === 'nao_lidas') return f.naoLida(m) ? 0 : 1;
      if (tipo === 'estrela') return f.estrela(m) ? 0 : 1;
      if (tipo === 'importantes') return f.importante(m) ? 0 : 1;
      return 0;
    };
    return [...lista].sort((a, b) => (peso(a) - peso(b)) || (new Date(b.date || 0) - new Date(a.date || 0)));
  }

  const api = { parseConsulta, montarConsulta, aplicar, ordenar, normalizar, vazia };
  if (typeof window !== 'undefined') window.InboxBusca = api;
  if (typeof module !== 'undefined') module.exports = api;
}());
