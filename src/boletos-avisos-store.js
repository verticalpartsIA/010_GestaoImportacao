/* ============================================================
   boletos-avisos-store.js — Financeiro & Preços › Boletos Avisos.
   Lê as tabelas boletos_avisos_* (fechadas: só Gelson, Diego e Juliana passam na
   RLS — boletos_avisos_pode()) e chama a Edge Function `boletos-avisos` para
   sincronizar com o Omie e mandar aviso manual. O envio automático (D-5, D-1, D0,
   D+1) roda por cron no servidor; aqui só se liga/desliga e se escolhe o modo teste.
   A trava na tela é organização; a de verdade está no banco (Art. 25).
   ============================================================ */
window.BoletosAvisosStore = (() => {
  const sb = () => window.__VP_SB && window.__VP_SB.sb;
  const quem = () => (window.__VP_USER && window.__VP_USER.email) || null;

  async function pode() {
    const c = sb(); if (!c) return false;
    const { data, error } = await c.rpc('boletos_avisos_pode');
    if (error) return false;
    return data === true;
  }

  /* Só os 3 fixos (Gelson, Diego, Juliana): enviar aviso, atualizar do Omie, envio automático. Quem só tem a alçada "ver" lê. */
  /* Aba "Tratativas" (19/11/2026): os 3 fixos + quem recebeu a caixa "tratar" respondem, anotam e mudam o caso. Quem só lê vê a aba sem controles. */
  async function podeTratar() {
    const c = sb(); if (!c) return false;
    const { data, error } = await c.rpc('boletos_avisos_pode_tratar');
    if (error) return false;
    return data === true;
  }

  async function podeGerir() {
    const c = sb(); if (!c) return false;
    const { data, error } = await c.rpc('boletos_avisos_pode_gerir');
    if (error) return false;
    return data === true;
  }

  /* 18/11/2026: alçada "atualizar" (Administração › Alçadas) — pode clicar em "Atualizar do Omie" sem ser um dos 3 fixos. */
  async function podeAtualizar() {
    const c = sb(); if (!c) return false;
    const { data, error } = await c.rpc('boletos_avisos_pode_atualizar');
    if (error) return false;
    return data === true;
  }

  async function listarClientes() {
    const { data, error } = await sb().from('boletos_avisos_resumo_v').select('*').order('dias_atraso', { ascending: false }).order('razao_social').limit(2000);
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function boletosDoCliente(cod) {
    const { data, error } = await sb().from('boletos_avisos_boletos').select('*').eq('codigo_cliente_omie', cod).eq('aberto', true).order('data_vencimento');
    if (error) throw new Error(error.message);
    return data || [];
  }

  /* Todos os boletos em aberto (para o resumo financeiro). Lê de 1.000 em 1.000: passando disso não corta em silêncio. */
  async function boletosAbertos() {
    const PAG = 1000; const out = [];
    for (let off = 0; ; off += PAG) {
      const { data, error } = await sb().from('boletos_avisos_boletos')
        .select('codigo_lancamento_omie,codigo_cliente_omie,data_vencimento,valor').eq('aberto', true).order('codigo_lancamento_omie').range(off, off + PAG - 1);
      if (error) throw new Error(error.message);
      out.push(...(data || []));
      if (!data || data.length < PAG) break;
    }
    return out;
  }

  /* Dias sem expediente (calendario_feriados; regra em BoletosAvisosCalc.conjuntoSemExpediente). Guarda o último lido:
     o detalhe do cliente usa o mesmo. Falha de leitura não derruba a tela: fica só o fim de semana. */
  let _feriados = new Set();
  async function feriados() {
    const { data, error } = await sb().from('calendario_feriados').select('data,descricao,bloqueia_envio,ativo').eq('ativo', true);
    if (error) { console.warn('[BoletosAvisos] calendario_feriados indisponível — vale só o fim de semana', error.message); return _feriados; }
    _feriados = window.BoletosAvisosCalc.conjuntoSemExpediente(data || []);
    return _feriados;
  }
  const feriadosCache = () => _feriados;

  /* Log de envios do cliente + a resposta dele (e-mail de entrada ligado ao envio pelo read-inbox) */
  async function logDoCliente(cod) {
    const { data: envios, error } = await sb().from('boletos_avisos_envios').select('*').eq('codigo_cliente_omie', cod).order('criado_em', { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    const ids = (envios || []).map(e => e.id);
    let respostas = [];
    if (ids.length) {
      const r = await sb().from('emails_projeto').select('id,referencia_id,assunto,corpo_texto,de_email,de_nome,data_mensagem')
        .eq('referencia_tipo', 'boleto_aviso').eq('direcao', 'entrada').in('referencia_id', ids).order('data_mensagem');
      if (!r.error) respostas = r.data || [];
    }
    return (envios || []).map(e => ({ ...e, respostas: respostas.filter(x => x.referencia_id === e.id) }));
  }

  /* Avisos enviados HOJE (dia de Brasília): alimenta o card "Avisos enviados hoje". Falha de leitura não derruba a tela. */
  async function enviosDeHoje() {
    try {
      const inicio = window.BoletosAvisosCalc.hojeBrasil() + 'T03:00:00Z';   // 00:00 de Brasília = 03:00 UTC
      const out = [];
      for (let off = 0; ; off += 1000) {
        const { data, error } = await sb().from('boletos_avisos_envios').select('id,codigo_cliente_omie,etapa,status,modo_teste,criado_em')
          .gte('criado_em', inicio).order('criado_em', { ascending: false }).range(off, off + 999);
        if (error) throw new Error(error.message);
        out.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return out;
    } catch (e) { console.warn('[BoletosAvisos] envios de hoje indisponíveis', e.message); return []; }
  }

  /* E-mails devolvidos pelo servidor do cliente ("Não é possível entregar", do postmaster): chegam no Inbox ligados ao envio por
     referencia_id. Devolve as respostas (já filtradas por ehDevolucao) e os envios a que elas se referem. Últimos 30 dias. */
  async function devolucoes() {
    const vazio = { devolucoes: [], envios: [] };
    try {
      const C = window.BoletosAvisosCalc;
      const desde = new Date(Date.now() - 30 * 86400e3).toISOString();
      const r = await sb().from('emails_projeto').select('id,referencia_id,assunto,de_email,data_mensagem')
        .eq('referencia_tipo', 'boleto_aviso').eq('direcao', 'entrada').gte('data_mensagem', desde).order('data_mensagem', { ascending: false }).limit(1000);
      if (r.error) throw new Error(r.error.message);
      const devs = (r.data || []).filter(C.ehDevolucao).map(x => ({ envio_id: x.referencia_id, assunto: x.assunto, data: x.data_mensagem }));
      const ids = [...new Set(devs.map(d => d.envio_id).filter(Boolean))];
      if (!ids.length) return vazio;
      const e = await sb().from('boletos_avisos_envios').select('id,codigo_cliente_omie,criado_em,para').in('id', ids);
      if (e.error) throw new Error(e.error.message);
      return { devolucoes: devs, envios: e.data || [] };
    } catch (err) { console.warn('[BoletosAvisos] devoluções indisponíveis', err.message); return vazio; }
  }

  /* ---- Tratativas: um caso por cliente (tabelas boletos_avisos_casos e boletos_avisos_tratativas) ---- */
  const semTabela = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|Could not find the table/i.test(e.message || ''));

  /* Tudo que a lista de casos precisa, numa leitura: casos, anotações, e-mails de ENTRADA ligados aos avisos (90 dias) e os envios a que eles respondem.
     Se as tabelas novas ainda não existirem no banco, devolve `semTabelas: true` e a tela avisa em vez de quebrar. */
  async function painelTratativas() {
    const vazio = { casos: [], tratativas: [], entradas: [], envios: [], semTabelas: false, erro: null };
    try {
      const desde = new Date(Date.now() - 90 * 86400e3).toISOString();
      const [cs, tr, en] = await Promise.all([
        sb().from('boletos_avisos_casos').select('*'),
        sb().from('boletos_avisos_tratativas').select('*').order('criado_em', { ascending: false }).limit(2000),
        sb().from('emails_projeto').select('id,referencia_id,assunto,de_email,de_nome,corpo_texto,data_mensagem')
          .eq('referencia_tipo', 'boleto_aviso').eq('direcao', 'entrada').gte('data_mensagem', desde).order('data_mensagem', { ascending: false }).limit(1000),
      ]);
      const sem = semTabela(cs.error) || semTabela(tr.error);   // migration ainda não aplicada: segue lendo respostas e devoluções, sem casos nem anotações
      for (const r of (sem ? [en] : [cs, tr, en])) if (r.error) throw new Error(r.error.message);
      const entradas = en.data || [];
      const ids = [...new Set(entradas.map(x => x.referencia_id).filter(Boolean))];
      let envios = [];
      for (let i = 0; i < ids.length; i += 100) {
        const e = await sb().from('boletos_avisos_envios').select('id,codigo_cliente_omie,criado_em,para,assunto,etapa,status').in('id', ids.slice(i, i + 100));
        if (e.error) throw new Error(e.error.message);
        envios = envios.concat(e.data || []);
      }
      return { ...vazio, casos: sem ? [] : (cs.data || []), tratativas: sem ? [] : (tr.data || []), entradas, envios, semTabelas: sem };
    } catch (err) { console.warn('[BoletosAvisos] tratativas indisponíveis', err.message); return { ...vazio, erro: err.message }; }
  }

  async function tratativasDoCliente(cod) {
    const { data, error } = await sb().from('boletos_avisos_tratativas').select('*').eq('codigo_cliente_omie', cod).order('criado_em', { ascending: true }).limit(1000);
    if (error) throw new Error(error.message);
    return data || [];
  }

  /* Usuários ativos para escolher o responsável do caso (só nome e e-mail). */
  async function responsaveis() {
    const { data, error } = await sb().from('perfis').select('email,nome').eq('ativo', true).order('nome');
    if (error) throw new Error(error.message);
    return (data || []).filter(p => p.email);
  }

  /* Muda status, responsável e/ou promessa do caso (patch parcial; promessa/responsável vazios limpam). O banco confere a alçada e grava o histórico. */
  async function mudarCaso(cod, patch, clienteNome) {
    const { data, error } = await sb().rpc('boletos_avisos_caso_mudar', { p_cliente: cod, p_patch: patch });
    if (error) throw new Error(error.message);
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Boletos Avisos', acao: 'Mudou o caso de tratativa do cliente', alvo: clienteNome || String(cod), alvo_id: String(cod), detalhe: patch });
    return data;
  }

  async function anotarTratativa(cod, texto, clienteNome) {
    const { data, error } = await sb().rpc('boletos_avisos_tratativa_nota', { p_cliente: cod, p_texto: texto });
    if (error) throw new Error(error.message);
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Boletos Avisos', acao: 'Registrou tratativa do cliente', alvo: clienteNome || String(cod), alvo_id: String(cod), detalhe: { tamanho: String(texto || '').length } });
    return data;
  }

  /* Responde o cliente por e-mail (função `boletos-avisos`, ação responder). O servidor só aceita e-mail do cliente ou de quem respondeu
     um aviso dele, grava a resposta no Inbox e na linha do tempo e põe o caso em "aguardando cliente". */
  async function responderCliente(cliente, dados) {
    const r = await chamar('responder', { codigo_cliente_omie: cliente.codigo_cliente_omie, para: dados.para, assunto: dados.assunto, texto: dados.texto, simular: !!dados.simular });
    if (!dados.simular && window.VPLog) window.VPLog.registrar({ modulo: 'Boletos Avisos', acao: 'Respondeu o cliente por e-mail', alvo: cliente.razao_social || String(cliente.codigo_cliente_omie), alvo_id: String(cliente.codigo_cliente_omie), detalhe: { para: r.para, envioId: r.envioId } });
    return r;
  }

  async function config() {
    const { data, error } = await sb().from('boletos_avisos_config').select('*').eq('id', true).maybeSingle();
    if (error) throw new Error(error.message);
    return data || {};
  }
  async function salvarConfig(patch) {
    const { data, error } = await sb().from('boletos_avisos_config').update({ ...patch, atualizado_em: new Date().toISOString() }).eq('id', true).select().maybeSingle();
    if (error) throw new Error(error.message);
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Boletos Avisos', acao: 'Mudou a configuração dos avisos', alvo: 'config', alvo_id: 'config', detalhe: patch });
    return data;
  }

  /* A função `boletos-avisos` precisa saber QUEM clicou (ela confere o login no Supabase e a lista de quem pode).
     O cliente de dados do app só manda a sessão nas consultas ao banco (/rest/v1); numa chamada de função ele manda a chave
     pública, e a função respondia 401 "Não autorizado" para todo mundo (achado de 18/11/2026, nos logs: 401 em 15–37 ms).
     Por isso o login desta pessoa vai à mão no cabeçalho. Sem sessão ativa, avisa em vez de fingir que foi. */
  async function chamar(acao, extra) {
    const token = (window.VpAuth && window.VpAuth.getAccessToken) ? await window.VpAuth.getAccessToken() : null;
    if (!token) throw new Error('Sua sessão não está ativa neste navegador. Recarregue a página (Ctrl+F5) ou entre de novo pelo portal e tente outra vez.');
    const { data, error } = await sb().functions.invoke('boletos-avisos', { body: { acao, ...(extra || {}) }, headers: { Authorization: 'Bearer ' + token } });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) { /* mensagem padrão */ }
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  async function sincronizar() {
    const r = await chamar('sincronizar');
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Boletos Avisos', acao: 'Sincronizou os boletos com o Omie', alvo: 'omie', alvo_id: 'sync', detalhe: r });
    return r;
  }
  async function enviarAviso(cliente) {
    const r = await chamar('enviar', { codigo_cliente_omie: cliente.codigo_cliente_omie });
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Boletos Avisos', acao: 'Enviou aviso de boleto', alvo: cliente.razao_social, alvo_id: String(cliente.codigo_cliente_omie), detalhe: { para: r.para, envioId: r.envioId } });
    return r;
  }
  async function simularAutomatico() { return chamar('automatico', { simular: true }); }

  /* ---- Índice de inadimplência e Consulta de cliente (score) — histórico em boletos_avisos_historico ---- */
  async function indiceDoPeriodo(p) {
    const { data, error } = await sb().rpc('boletos_avisos_indice', { p_de: p.de, p_ate: p.ate });
    if (error) throw new Error(error.message);
    return data || {};
  }
  async function scoreConfig() {
    const { data, error } = await sb().from('boletos_avisos_score_config').select('*').eq('id', true).maybeSingle();
    if (error) throw new Error(error.message);
    return data || {};
  }
  async function salvarScoreConfig(patch) {
    const { data, error } = await sb().from('boletos_avisos_score_config')
      .update({ ...patch, atualizado_em: new Date().toISOString(), atualizado_por: quem() }).eq('id', true).select().maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Sem permissão para alterar os limites do score.');
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Boletos Avisos', acao: 'Mudou os limites do score de clientes', alvo: 'score_config', alvo_id: 'score_config', detalhe: patch });
    return data;
  }
  /* Um cliente por linha (só quem já teve título vencido). Lê de 1.000 em 1.000: passando disso não corta em silêncio. */
  async function listarScores() {
    const PAG = 1000; const out = [];
    for (let off = 0; ; off += PAG) {
      const { data, error } = await sb().from('boletos_avisos_score_v').select('*').order('codigo_cliente_omie').range(off, off + PAG - 1);
      if (error) throw new Error(error.message);
      out.push(...(data || []));
      if (!data || data.length < PAG) break;
    }
    return out;
  }
  async function titulosDoCliente(cod) {
    const { data, error } = await sb().from('boletos_avisos_historico')
      .select('codigo_lancamento_omie,numero_documento,numero_parcela,data_vencimento,data_pagamento,valor,valor_pago,pago,status_omie')
      .eq('codigo_cliente_omie', cod).eq('cancelado', false).order('data_vencimento', { ascending: false }).limit(60);
    if (error) throw new Error(error.message);
    return data || [];
  }
  /* Clientes que o Omie conhece pelo histórico (mesmo sem título vencido), para a busca da consulta */
  async function listarClientesHistorico() {
    const PAG = 1000; const out = [];
    for (let off = 0; ; off += PAG) {
      const { data, error } = await sb().from('boletos_avisos_clientes').select('codigo_cliente_omie,razao_social,cnpj').order('codigo_cliente_omie').range(off, off + PAG - 1);
      if (error) throw new Error(error.message);
      out.push(...(data || []));
      if (!data || data.length < PAG) break;
    }
    return out;
  }
  async function historicoAtualizadoEm() {
    const { data } = await sb().from('boletos_avisos_historico').select('atualizado_em').order('atualizado_em', { ascending: false }).limit(1);
    return data && data[0] ? data[0].atualizado_em : null;
  }

  return { pode, podeGerir, podeAtualizar, feriados, feriadosCache, listarClientes, boletosAbertos, boletosDoCliente, logDoCliente, enviosDeHoje, devolucoes, painelTratativas, tratativasDoCliente, responsaveis, mudarCaso, anotarTratativa, responderCliente, podeTratar, config, salvarConfig, sincronizar, enviarAviso, simularAutomatico,
    indiceDoPeriodo, scoreConfig, salvarScoreConfig, listarScores, titulosDoCliente, listarClientesHistorico, historicoAtualizadoEm, quem };
})();
