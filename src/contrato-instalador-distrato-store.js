/* ============================================================
   contrato-instalador-distrato-store.js
   Distrato do Contrato do Instalador (30/10/2026) — rescisão motivada e
   bilateral de um contrato JÁ ASSINADO. Reaproveita o MESMO desenho de
   assinatura em sequência do contrato original (Contratada -> Diego/CEO ->
   Testemunha 1 (Juliana) -> Testemunha 2 (Maurício)) via documento_signatarios
   (documento_tipo='distrato_instalador') — essa fila já funciona pelas MESMAS
   RPCs genéricas que o Contrato Instalador usa (public_cvs_obter/_visualizado/
   _assinar/_recusar, ver DocumentoSignatariosStore), estendidas no banco pra
   reconhecer esse tipo novo. Este arquivo só cuida do token PRÓPRIO da
   Contratada no distrato (linha própria em contratos_instalador_distratos).

   Mesma convenção de nomes de outras stores de assinatura (CIStore/CVStore/
   PropostaStore): getByToken/markViewed/markSigned/refuse/fmtDateTime — não
   mude isso, assinar-app.jsx despacha genericamente via source.store.<método>.

   window.CIDistratoStore = { ... }
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  async function getPublicIP() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      const j = await r.json();
      return j.ip || null;
    } catch (e) { return null; }
  }
  function deviceLabel(ua) {
    ua = ua || navigator.userAgent;
    let os = 'Desktop';
    if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/windows/i.test(ua)) os = 'Windows';
    else if (/mac os/i.test(ua)) os = 'macOS';
    let nav = 'navegador';
    if (/edg\//i.test(ua)) nav = 'Edge';
    else if (/chrome\//i.test(ua)) nav = 'Chrome';
    else if (/firefox\//i.test(ua)) nav = 'Firefox';
    else if (/safari\//i.test(ua)) nav = 'Safari';
    return nav + ' / ' + os;
  }
  async function sha256Hex(text) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      let h = 0; for (let i = 0; i < text.length; i++) { h = (h << 5) - h + text.charCodeAt(i); h |= 0; }
      return 'fallback-' + (h >>> 0).toString(16);
    }
  }
  function erroDaRpc(res) {
    const e = res && res.erro;
    if (e === 'status_expirado') return new Error('Este link de assinatura expirou. Peça um novo envio à Vertical Parts.');
    if (e === 'status_recusado') return new Error('Este distrato foi recusado e não pode mais ser assinado.');
    if (e === 'link_invalido') return new Error('Link inválido ou expirado.');
    if (e === 'nome_obrigatorio') return new Error('Informe o seu nome para assinar.');
    if (e === 'motivo_curto') return new Error('Descreva o motivo com pelo menos 10 letras.');
    if (e === 'sem_sessao') return new Error('Sua sessão expirou — recarregue a página e tente de novo.');
    if (e === 'sem_permissao') return new Error('Você não tem a alçada "Contrato Instalador — Editar" para gerar o Distrato.');
    if (e === 'nao_assinado') return new Error('Só é possível gerar Distrato de um contrato já ASSINADO.');
    if (e === 'ja_existe') return new Error('Já existe um Distrato ativo (não recusado/expirado) para este contrato.');
    if (e === 'contrato_destino_invalido') return new Error('O contrato de destino informado não foi encontrado.');
    if (e && String(e).indexOf('status_') === 0) return new Error('Este distrato não está mais disponível para esta ação (situação atual: ' + String(e).slice(7) + ').');
    return new Error('Não foi possível concluir — tente novamente.');
  }
  async function chamarRpc(c, nome, args) {
    const { data, error } = await c.rpc(nome, args);
    if (error) throw error;
    return data;
  }

  function fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('pt-BR') : '—'; }
  function signUrl(token) { return window.location.origin + '/assinar/' + encodeURIComponent(token); }

  const STATUS = {
    rascunho:    { id: 'rascunho',    label: 'Rascunho',    icon: '📝', tone: 'gray' },
    enviado:     { id: 'enviado',     label: 'Enviado',     icon: '📤', tone: 'blue' },
    visualizado: { id: 'visualizado', label: 'Visualizado', icon: '👁', tone: 'yellow' },
    assinado:    { id: 'assinado',    label: 'Assinado',    icon: '✍', tone: 'green' },
    expirado:    { id: 'expirado',    label: 'Expirado',    icon: '⚠', tone: 'red' },
    recusado:    { id: 'recusado',    label: 'Recusado',    icon: '✕', tone: 'red' },
  };

  /* ---------- Geração/envio (interno, autenticado) ---------- */

  /* motivo: texto (≥10 letras, validado também no servidor).
     transferencia: null ou { contrato_destino_id, valor } — "o valor recebido
     nesta obra será transferido pra outro contrato (o montador trocou de obra)". */
  async function gerar(contratoId, motivo, transferencia) {
    const c = sb(); if (!c) throw new Error('Supabase indisponível.');
    const data = await chamarRpc(c, 'gerar_distrato_instalador', {
      p_contrato_id: contratoId, p_motivo: motivo, p_transferencia: transferencia || null,
    });
    if (!data || !data.ok) throw erroDaRpc(data);
    return data; // { id, numero_documento }
  }

  /* Monta o doc (CI.buildDistratoContract) a partir do contrato original e envia. */
  async function enviar(distratoId, doc) {
    const c = sb(); if (!c) throw new Error('Supabase indisponível.');
    const data = await chamarRpc(c, 'ci_distrato_enviar', { p_id: distratoId, p_doc: doc });
    if (!data || !data.ok) throw erroDaRpc(data);
    return data.rec;
  }

  async function reenviarAvisoVez(distratoId) {
    const c = sb(); if (!c) throw new Error('Supabase indisponível.');
    const data = await chamarRpc(c, 'ci_distrato_reenviar_aviso_vez', { p_id: distratoId });
    if (!data || !data.ok) throw erroDaRpc(data);
    return data;
  }

  /* Distratos do contrato (painel interno) — hoje só 1 ativo por vez, mas a
     função já devolve lista (histórico, se um dia precisar de recusa+novo). */
  async function listarPorContrato(contratoId) {
    const c = sb(); if (!c) return [];
    try { return (await chamarRpc(c, 'listar_distratos_do_contrato', { p_contrato_id: contratoId })) || []; }
    catch (e) { console.warn('[CIDistratoStore] listarPorContrato falhou', e); return []; }
  }

  async function getById(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('contratos_instalador_distratos').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  /* ---------- Página pública (token da Contratada no distrato) ---------- */

  async function getByToken(token) {
    const c = sb(); if (!c) return null;
    try { return await chamarRpc(c, 'public_di_obter', { p_token: token }); }
    catch (e) { console.warn('[CIDistratoStore] getByToken falhou', e); return null; }
  }

  async function fila(token) {
    const c = sb(); if (!c) return [];
    try { return (await chamarRpc(c, 'public_di_fila', { p_token: token })) || []; }
    catch (e) { return []; }
  }

  async function markViewed(token) {
    const c = sb(); if (!c) return null;
    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    try {
      const data = await chamarRpc(c, 'public_di_visualizado', { p_token: token, p_audit: { viewUa: ua, viewDevice: device, viewIp: ip } });
      return data && data.ok ? data.rec : null;
    } catch (e) {
      /* best-effort de propósito (mesmo padrão de CIStore.markViewed) — é só
         rastreamento automático no mount, nunca deve travar a leitura. */
      console.warn('[CIDistratoStore] markViewed falhou (best-effort)', e);
      return await getByToken(token);
    }
  }

  async function markSigned(token, sig) {
    const c = sb(); if (!c) return null;
    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    const cur = await getByToken(token);
    const hash = await sha256Hex(JSON.stringify(cur && cur.doc) + '|' + (sig.signerName || '') + '|' + new Date().toISOString());
    const data = await chamarRpc(c, 'public_di_assinar', {
      p_token: token,
      p_audit: { signUa: ua, signDevice: device, signIp: ip, signerName: sig.signerName, signatureType: sig.type, signatureData: sig.data, hash },
    });
    if (!data || !data.ok) throw erroDaRpc(data);
    return data.rec;
  }

  async function refuse(token, info) {
    const c = sb(); if (!c) return null;
    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    const nome = ((info && info.nome) || '').trim() || null;
    const motivo = ((info && info.motivo) || '').trim() || null;
    const data = await chamarRpc(c, 'public_di_recusar', { p_token: token, p_nome: nome, p_motivo: motivo, p_audit: { refuseUa: ua, refuseDevice: device, refuseIp: ip } });
    if (!data || !data.ok) throw erroDaRpc(data);
    return data.rec;
  }

  window.CIDistratoStore = {
    STATUS,
    fmtDateTime, fmtDate, signUrl,
    gerar, enviar, reenviarAvisoVez, listarPorContrato, getById,
    getByToken, fila, markViewed, markSigned, refuse,
  };
})();
