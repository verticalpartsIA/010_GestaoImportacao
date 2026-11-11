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

  return { pode, listarClientes, boletosDoCliente, logDoCliente, config, salvarConfig, sincronizar, enviarAviso, simularAutomatico, quem };
})();
