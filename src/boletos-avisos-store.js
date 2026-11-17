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
  async function podeGerir() {
    const c = sb(); if (!c) return false;
    const { data, error } = await c.rpc('boletos_avisos_pode_gerir');
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

  async function chamar(acao, extra) {
    const { data, error } = await sb().functions.invoke('boletos-avisos', { body: { acao, ...(extra || {}) } });
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

  return { pode, podeGerir, feriados, feriadosCache, listarClientes, boletosAbertos, boletosDoCliente, logDoCliente, config, salvarConfig, sincronizar, enviarAviso, simularAutomatico,
    indiceDoPeriodo, scoreConfig, salvarScoreConfig, listarScores, titulosDoCliente, listarClientesHistorico, historicoAtualizadoEm, quem };
})();
