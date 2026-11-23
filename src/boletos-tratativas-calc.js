/* ============================================================
   boletos-tratativas-calc.js — Financeiro & Preços › Boletos Avisos › aba "Tratativas" (regra pura, 19/11/2026).
   Um CASO por cliente: o que foi enviado, o que o cliente respondeu (ou devolveu), o que o time anotou e o estado do caso.
   Esta camada só decide: quem entra na lista, o que pede ação e como montar a linha do tempo. Leitura e gravação moram na store.

   Entradas (todas já lidas do banco):
     lista       linhas de boletos_avisos_resumo_v (codigo_cliente_omie, razao_social, cnpj, ultimo_aviso_em, ultimo_aviso_status…)
     entradas    e-mails de ENTRADA ligados a avisos (emails_projeto): { id, referencia_id (= id do envio), assunto, de_email, de_nome, corpo_texto, data_mensagem }
     envios      os envios a que essas entradas respondem: { id, codigo_cliente_omie, criado_em, para, assunto, etapa, status }
     casos       boletos_avisos_casos: { codigo_cliente_omie, status, responsavel_email, promessa_pagamento, resolvido_em, atualizado_em }
     tratativas  boletos_avisos_tratativas: { id, codigo_cliente_omie, tipo, texto, autor, criado_em, meta }
     erros       Map de BoletosAvisosCalc.clientesComErro (cliente -> { tipo: 'devolvido'|'falha', motivo, para, desde })
   Datas são ISO (timestamptz) e o dia é o de Brasília (AAAA-MM-DD).
   ============================================================ */
window.BoletosTratativasCalc = (() => {
  const STATUS = [
    { chave: 'aberto', rotulo: 'Aberto' },
    { chave: 'em_tratativa', rotulo: 'Em tratativa' },
    { chave: 'aguardando_cliente', rotulo: 'Aguardando cliente' },
    { chave: 'resolvido', rotulo: 'Resolvido' },
  ];
  const ROTULO_STATUS = { novo: 'Novo', ...Object.fromEntries(STATUS.map((s) => [s.chave, s.rotulo])) };

  const ms = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : 0; };
  const ehDevolucao = (e) => !!(window.BoletosAvisosCalc && window.BoletosAvisosCalc.ehDevolucao(e));
  /* 'devolucao' = aviso do servidor; qualquer outra entrada é resposta do cliente */
  function classificarEntrada(email) { return ehDevolucao(email) ? 'devolucao' : 'resposta'; }
  const trecho = (txt, n = 140) => { const s = String(txt || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  /* Linha do tempo do caso, da mais antiga para a mais nova.
     log = envios do cliente já com .respostas (BoletosAvisosStore.logDoCliente); tratativas = linhas do cliente. */
  function linhaDoTempo(log, tratativas) {
    const itens = [];
    for (const e of log || []) {
      itens.push({
        id: 'envio:' + e.id, tipo: e.status === 'erro' ? 'aviso_erro' : 'aviso', quando: e.criado_em,
        titulo: (e.status === 'erro' ? 'Aviso com falha no envio' : 'Aviso enviado') + (e.etapa ? ' · ' + e.etapa : ''),
        texto: e.assunto || '', para: e.para || [], erro: e.erro || null, modoTeste: !!e.modo_teste,
      });
      for (const r of e.respostas || []) {
        const dev = classificarEntrada(r) === 'devolucao';
        itens.push({
          id: 'entrada:' + r.id, tipo: dev ? 'devolucao' : 'resposta', quando: r.data_mensagem,
          titulo: dev ? 'E-mail devolvido pelo servidor do cliente' : 'Resposta do cliente',
          texto: dev ? (r.assunto || '') : (r.corpo_texto || r.assunto || ''), de: r.de_nome || r.de_email || '', deEmail: r.de_email || '',
        });
      }
    }
    for (const t of tratativas || []) {
      itens.push({ id: 'trat:' + t.id, tipo: t.tipo, quando: t.criado_em, titulo: tituloDaTratativa(t), texto: t.texto || '', autor: t.autor, meta: t.meta || {} });
    }
    return itens.sort((a, b) => ms(a.quando) - ms(b.quando) || String(a.id).localeCompare(String(b.id)));
  }
  function tituloDaTratativa(t) {
    const m = t.meta || {};
    if (t.tipo === 'nota') return 'Anotação interna';
    if (t.tipo === 'resposta_enviada') return 'Resposta enviada ao cliente';
    if (t.tipo === 'status') return m.de ? 'Status: ' + (ROTULO_STATUS[m.de] || m.de) + ' → ' + (ROTULO_STATUS[m.para] || m.para) : 'Caso aberto como ' + (ROTULO_STATUS[m.para] || m.para || 'aberto');
    if (t.tipo === 'atribuicao') return m.para ? 'Responsável: ' + m.para : 'Responsável removido';
    if (t.tipo === 'promessa') return m.para ? 'Promessa de pagamento para ' + String(m.para).split('-').reverse().join('/') : 'Promessa de pagamento removida';
    return t.tipo;
  }

  /* Promessa vencida: a data já passou e o caso não está resolvido (só aviso visual; não há alerta automático). */
  function promessaVencida(caso, hojeISO) {
    return !!(caso && caso.promessa_pagamento && caso.status !== 'resolvido' && String(caso.promessa_pagamento) < hojeISO);
  }

  /* Casos que aparecem na lista. Uma linha por cliente que tem ao menos um destes motivos:
       - respondeu e ninguém tratou depois (nota, status, responsável, resposta nossa);
       - último aviso devolvido ou com falha;
       - caso aberto à mão e ainda não resolvido.
     Caso RESOLVIDO sai da lista, salvo se chegar resposta ou devolução NOVA depois de resolvido. */
  function casosAtivos({ lista, entradas, envios, casos, tratativas, erros, hojeISO }) {
    const envioPorId = new Map((envios || []).map((e) => [e.id, e]));
    const casoPorCli = new Map((casos || []).map((c) => [c.codigo_cliente_omie, c]));
    const ultimaResposta = new Map();   // cliente -> { quando, entrada }
    for (const r of entradas || []) {
      if (classificarEntrada(r) !== 'resposta') continue;
      const env = envioPorId.get(r.referencia_id);
      if (!env) continue;
      const atual = ultimaResposta.get(env.codigo_cliente_omie);
      if (!atual || ms(r.data_mensagem) > ms(atual.quando)) ultimaResposta.set(env.codigo_cliente_omie, { quando: r.data_mensagem, entrada: r });
    }
    const ultimaTratativa = new Map();  // cliente -> data da última ação nossa
    for (const t of tratativas || []) {
      const atual = ultimaTratativa.get(t.codigo_cliente_omie);
      if (!atual || ms(t.criado_em) > ms(atual)) ultimaTratativa.set(t.codigo_cliente_omie, t.criado_em);
    }
    const porCli = new Map((lista || []).map((c) => [c.codigo_cliente_omie, c]));
    const clientes = new Set([...ultimaResposta.keys(), ...(erros ? erros.keys() : []), ...casoPorCli.keys()]);
    const out = [];
    for (const cod of clientes) {
      const caso = casoPorCli.get(cod) || null;
      const resp = ultimaResposta.get(cod) || null;
      const erro = erros && erros.get ? erros.get(cod) || null : null;
      const nossa = ultimaTratativa.get(cod) || null;
      const respondeuSemTratar = !!resp && (!nossa || ms(resp.quando) > ms(nossa));
      const resolvidoEm = caso && caso.status === 'resolvido' ? caso.resolvido_em || caso.atualizado_em : null;
      const novoDepoisDeResolvido = !!resolvidoEm && ((resp && ms(resp.quando) > ms(resolvidoEm)) || (erro && ms(erro.desde) > ms(resolvidoEm)));
      const motivo = respondeuSemTratar || !!erro || (caso && caso.status !== 'resolvido');
      if (!motivo) continue;
      if (resolvidoEm && !novoDepoisDeResolvido) continue;
      const base = porCli.get(cod) || {};
      const status = caso && !(resolvidoEm && novoDepoisDeResolvido) ? caso.status : (resolvidoEm ? 'aberto' : 'novo');
      const ultima = resp ? { quando: resp.quando, tipo: 'resposta', trecho: trecho(resp.entrada.corpo_texto || resp.entrada.assunto) }
        : erro ? { quando: erro.desde, tipo: erro.tipo, trecho: trecho(erro.motivo) } : null;
      out.push({
        codigo_cliente_omie: cod, razao_social: base.razao_social || 'Cliente ' + cod, cnpj: base.cnpj || null,
        status, responsavel: caso ? caso.responsavel_email || null : null, promessa: caso ? caso.promessa_pagamento || null : null,
        promessaVencida: promessaVencida(caso, hojeISO || ''),
        respondeu: !!resp, devolvido: !!erro && erro.tipo === 'devolvido', falha: !!erro && erro.tipo === 'falha',
        semRespostaNossa: respondeuSemTratar || (status === 'novo' && !!erro),
        ultima,
      });
    }
    return out.sort((a, b) => (b.semRespostaNossa - a.semRespostaNossa) || (b.devolvido - a.devolvido) || (ms(b.ultima && b.ultima.quando) - ms(a.ultima && a.ultima.quando)));
  }

  /* Quantos casos pedem ação agora (mostrado no botão "Tratativas (N)"). */
  function pedemAcao(casos) {
    return (casos || []).filter((c) => c.semRespostaNossa || c.promessaVencida || c.status === 'novo').length;
  }

  return { STATUS, ROTULO_STATUS, classificarEntrada, linhaDoTempo, tituloDaTratativa, promessaVencida, casosAtivos, pedemAcao, trecho };
})();
