/* ============================================================
   inbox-organizar-calc.js — regras de organização do Inbox estilo Gmail (04/10/2026, fase 4A).
   Funções PURAS (testadas em inbox-organizar-calc.test.js): em que pasta cada e-mail aparece, horários de "Suspender",
   árvore de marcadores, permissões de marcador e trava de spam.
   Modelo: estrela / arquivar / adiar são POR PESSOA; spam é COMPARTILHADO (nunca em e-mail ligado a cotação/documento);
   marcador é "pessoal" (só o dono) ou "equipe" (todos que veem o e-mail).
   window.InboxOrganizar = { CORES, opcoesAdiar, adiadoAgora, visivelNaPasta, arvoreMarcadores, marcadoresVisiveis,
     podeCriarMarcador, podeGerirMarcador, podeAplicarMarcador, podeMarcarSpam }
   ============================================================ */
(function () {
  'use strict';

  const CORES = ['#64748b', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#9333ea'];
  const norm = (e) => String(e || '').trim().toLowerCase();

  /* "Suspender": hoje à tarde (18h, só se ainda faltar pelo menos 1h), amanhã de manhã (8h) e próxima segunda (8h). */
  function opcoesAdiar(agora) {
    const a = agora ? new Date(agora) : new Date();
    const em = (dias, hora) => { const d = new Date(a); d.setDate(d.getDate() + dias); d.setHours(hora, 0, 0, 0); return d; };
    const opcoes = [];
    const hoje18 = em(0, 18);
    if (hoje18.getTime() - a.getTime() >= 3600000) opcoes.push({ id: 'hoje', rotulo: 'Hoje à tarde', quando: hoje18 });
    opcoes.push({ id: 'amanha', rotulo: 'Amanhã de manhã', quando: em(1, 8) });
    const diasAteSegunda = ((1 - a.getDay() + 7) % 7) || 7;           // sempre a PRÓXIMA segunda (se hoje é segunda, a de daqui a 7 dias)
    opcoes.push({ id: 'segunda', rotulo: 'Próxima segunda', quando: em(diasAteSegunda, 8) });
    return opcoes;
  }

  const adiadoAgora = (estado, agora) => !!(estado && estado.adiado_ate && new Date(estado.adiado_ate).getTime() > (agora ? new Date(agora).getTime() : Date.now()));

  /* visivelNaPasta(m, pasta, c) — decide se o e-mail `m` aparece na pasta.
     pasta: 'inbox' | 'sent' | 'starred' | 'mine' | 'triagem' | 'adiados' | 'spam' | 'all' | 'm:<idDoMarcador>'
     c: { ehEnviado(m), estado(m) → { arquivado, adiado_ate, estrela }|undefined, spam(m), eMeu(m), semResp(m), marcadores(m) → ids[], agora } */
  function visivelNaPasta(m, pasta, c) {
    const st = c.estado(m) || {};
    if (c.spam(m)) return pasta === 'spam';                              // spam só aparece na pasta Spam (como no Gmail, fora de pesquisas e de "Todos")
    if (pasta === 'spam') return false;
    const arq = !!st.arquivado;
    const adiado = adiadoAgora(st, c.agora);
    const enviado = c.ehEnviado(m);
    switch (pasta) {
      case 'inbox': return !enviado && !arq && !adiado;
      case 'sent': return enviado;
      case 'starred': return !!st.estrela;
      case 'mine': return c.eMeu(m) && !arq && !adiado;
      case 'triagem': return !enviado && c.semResp(m) && !arq && !adiado;
      case 'adiados': return adiado;
      case 'all': return true;
      default:
        if (String(pasta).startsWith('m:')) return (c.marcadores(m) || []).includes(String(pasta).slice(2));
        return true;
    }
  }

  /* Marcadores que a pessoa enxerga: os da equipe e os próprios. */
  const marcadoresVisiveis = (lista, eu) => (lista || []).filter((x) => x.escopo === 'equipe' || norm(x.dono_email) === norm(eu));

  /* árvore achatada com profundidade (pai antes do filho, irmãos por nome). Pai ausente/ciclo → vira raiz. */
  function arvoreMarcadores(lista) {
    const porId = new Map((lista || []).map((x) => [x.id, x]));
    const filhos = new Map();
    (lista || []).forEach((x) => {
      const pai = x.pai_id && porId.has(x.pai_id) && x.pai_id !== x.id ? x.pai_id : null;
      if (!filhos.has(pai)) filhos.set(pai, []);
      filhos.get(pai).push(x);
    });
    const out = []; const vistos = new Set();
    const descer = (pai, nivel) => {
      (filhos.get(pai) || []).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')).forEach((x) => {
        if (vistos.has(x.id)) return;
        vistos.add(x.id); out.push({ ...x, nivel }); descer(x.id, nivel + 1);
      });
    };
    descer(null, 0);
    (lista || []).forEach((x) => { if (!vistos.has(x.id)) { vistos.add(x.id); out.push({ ...x, nivel: 0 }); } });   // sobras de ciclo
    return out;
  }

  /* caps: { editar, triagem, ver_todos } (booleans) */
  const podeCriarMarcador = (escopo, caps) => !!(caps && caps.editar && (escopo === 'pessoal' || caps.triagem || caps.ver_todos));
  const podeGerirMarcador = (mc, eu, caps) => !!mc && (norm(mc.dono_email) === norm(eu) || (mc.escopo === 'equipe' && !!(caps && caps.ver_todos)));
  const podeAplicarMarcador = (mc, eu, caps) => !!mc && !!(caps && caps.editar) && (mc.escopo === 'equipe' || norm(mc.dono_email) === norm(eu));

  /* Spam é compartilhado, então tem trava: e-mail enviado por nós, ligado a cotação ou a documento NUNCA vira spam
     (esconderia venda). Devolve { ok, motivo }. */
  function podeMarcarSpam(m, ehEnviado) {
    if (ehEnviado) return { ok: false, motivo: 'e-mail enviado por nós' };
    if (m.numeroCotacao != null) return { ok: false, motivo: 'ligado à Cotação Nº ' + m.numeroCotacao };
    if (m.referenciaTipo) return { ok: false, motivo: 'ligado a um documento' };
    return { ok: true, motivo: null };
  }

  const api = { CORES, opcoesAdiar, adiadoAgora, visivelNaPasta, arvoreMarcadores, marcadoresVisiveis, podeCriarMarcador, podeGerirMarcador, podeAplicarMarcador, podeMarcarSpam };
  if (typeof window !== 'undefined') window.InboxOrganizar = api;
  if (typeof module !== 'undefined') module.exports = api;
}());
