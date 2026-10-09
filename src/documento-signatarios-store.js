/* ============================================================
   documento-signatarios-store.js
   Signatários com token individual — genérico, reutilizável por
   Proposta, Contrato de Venda e Contrato Instalador (os 3 documentos que
   passam por assinar-app.jsx). Primeira entrega usa só Contrato de Venda;
   Proposta/Contrato Instalador plugam nisto depois sem mudar a tabela.

   01/10/2026 — achado real (cotação 955/AKAI): o campo "Para" do envio
   de Contrato de Venda tinha 5 e-mails (cliente + 3 pessoas da
   VerticalParts em cópia) todos recebendo o MESMO link/token de
   assinatura — qualquer um que abrisse o link depois de outro já ter
   visualizado/assinado/recusado caía direto na tela final, sem nunca
   ver o documento (foi o que aconteceu com a Juliana do Financeiro).
   Esta store é o "D4Sign" do projeto: cada destinatário marcado como
   "deve assinar" (decisão do usuário — nem todo e-mail em cópia vira
   signatário) ganha seu PRÓPRIO token, rastreado independentemente.

   Nomeação dos métodos (getByToken/markViewed/markSigned/refuse) espelha
   de propósito CVStore/CIStore/PropostaStore/CVSignatarioStore —
   assinar-app.jsx chama `source.store.<método>` genericamente.

   window.DocumentoSignatariosStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function shortToken() { return uuid().split('-').join('').slice(0, 16); }

  /* ---------- Auditoria (IP / UA / device / hash) — mesmo padrão já
     usado em CVStore/CIStore/PropostaStore/CVSignatarioStore, mas sem
     depender de nenhum deles (esta store é doc-type agnóstica). ---------- */
  let _ipCache;
  async function getPublicIP() {
    if (_ipCache !== undefined) return _ipCache;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      const j = await r.json();
      _ipCache = j.ip || null;
    } catch (e) { _ipCache = null; }
    return _ipCache;
  }
  function deviceLabel(ua) {
    ua = ua || navigator.userAgent;
    let os = 'Desktop';
    if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/windows/i.test(ua)) os = 'Windows';
    else if (/mac os/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    let app = 'Navegador';
    if (/edg/i.test(ua)) app = 'Edge';
    else if (/chrome/i.test(ua)) app = 'Chrome';
    else if (/firefox/i.test(ua)) app = 'Firefox';
    else if (/safari/i.test(ua)) app = 'Safari';
    return `${app} / ${os}`;
  }
  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function signUrl(token) {
    return `${window.location.origin}/assinar/${encodeURIComponent(token)}`;
  }

  /* Segurança real (#571, Fase 3/Task 11b): leitura/visualização/assinatura/recusa por RPC `public_cvs_*` (só o TOKEN do signatário;
     o servidor decide se o documento-pai já pode virar ASSINADO). Interruptor: localStorage.vp_public_rpc = 'off' (o mesmo da Proposta);
     se a RPC falhar, cai no caminho antigo. A RPC devolve também o contrato-pai (`__contratoPai`). Esta store não depende de CVStore. */
  function usarRpcPublica() { try { return localStorage.getItem('vp_public_rpc') !== 'off'; } catch (e) { return true; } }
  async function chamarRpcPublica(c, nome, args) {
    try {
      const { data, error } = await c.rpc(nome, args);
      if (error) { console.warn('[DocumentoSignatariosStore] RPC ' + nome + ' falhou — usando caminho antigo', error); return { falhou: true }; }
      return { data };
    } catch (e) { console.warn('[DocumentoSignatariosStore] RPC ' + nome + ' indisponível — usando caminho antigo', e); return { falhou: true }; }
  }
  function erroDaRpc(res) {
    const e = res && res.erro;
    if (e === 'link_invalido') return new Error('Link inválido ou expirado.');
    if (e && String(e).indexOf('status_') === 0) return new Error('Este documento não está mais disponível para esta ação (situação atual: ' + String(e).slice(7) + ').');
    return new Error('Não foi possível concluir a ação. Tente novamente.');
  }
  async function getByToken(token) {
    const c = sb(); if (!c) return null;
    if (usarRpcPublica()) {
      const r = await chamarRpcPublica(c, 'public_cvs_obter', { p_token: token });
      if (!r.falhou) {
        if (!r.data || r.data.origem !== 'doc') return null;
        const sig = r.data.sig; sig.__contratoPai = r.data.contrato || null; return sig;
      }
    }
    const { data } = await c.from('documento_signatarios').select('*').eq('token', token).maybeSingle();
    return data || null;
  }

  async function listarPorDocumento(documentoTipo, documentoId) {
    const c = sb(); if (!c || !documentoId) return [];
    const { data, error } = await c.from('documento_signatarios').select('*')
      .eq('documento_tipo', documentoTipo).eq('documento_id', String(documentoId)).order('ordem', { ascending: true });
    if (error) { console.warn('[DocumentoSignatariosStore] listarPorDocumento falhou', error); return []; }
    return data || [];
  }

  /* Todas as linhas de um tipo de documento (ex.: 'projeto_instalacao') — a Engenharia
     usa pra mostrar o status de assinatura de cada projeto na lista, numa consulta só. */
  async function listarPorTipo(documentoTipo) {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('documento_signatarios').select('*')
      .eq('documento_tipo', documentoTipo).order('criado_em', { ascending: false }).limit(2000);
    if (error) { console.warn('[DocumentoSignatariosStore] listarPorTipo falhou', error); return []; }
    return data || [];
  }

  /* Quantos signatários AINDA não completaram a própria assinatura
     (inclui 'recusado' de propósito — uma recusa também bloqueia o
     documento de virar 'assinado' até ser resolvida manualmente, mesmo
     critério de CVSignatarioStore.contarPendentes). */
  async function contarPendentes(documentoTipo, documentoId) {
    const lista = await listarPorDocumento(documentoTipo, documentoId);
    return lista.filter((s) => s.status !== 'assinado').length;
  }

  async function criar({ documentoTipo, documentoId, nome, email, telefone, papel, ordem } = {}) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!documentoTipo || !documentoId) throw new Error('documentoTipo/documentoId são obrigatórios.');
    if (!nome || !nome.trim()) throw new Error('Informe o nome do signatário.');
    if (!email || !email.trim()) throw new Error('Informe o e-mail do signatário.');
    const token = shortToken();
    const { data, error } = await c.from('documento_signatarios').insert({
      documento_tipo: documentoTipo, documento_id: String(documentoId),
      papel: (papel || '').trim() || null, nome: nome.trim(),
      email: email.trim(), telefone: (telefone || '').trim() || null,
      token, status: 'pendente', ordem: ordem || 0,
    }).select().single();
    if (error) throw error;
    return data;
  }

  async function remover(id) {
    const c = sb(); if (!c) return;
    await c.from('documento_signatarios').delete().eq('id', id);
  }

  async function marcarEnviado(id, channel, recipient) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const now = new Date().toISOString();
    const { data, error } = await c.from('documento_signatarios')
      .update({ status: 'enviado', channel, recipient: recipient || {}, sent_at: now, atualizado_em: now })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  /* Depois que um signatário assina/recusa, tenta avisar o documento-pai
     pra ele reavaliar se já pode finalizar (ou ficar bloqueado). Hoje só
     Contrato de Venda implementa o gancho (tentarFinalizarAposSignatarioExtra)
     — Proposta/Contrato Instalador ainda não passam por este fluxo
     (escopo desta entrega é só Contrato de Venda), então o dispatch
     abaixo simplesmente não faz nada pros outros tipos, sem quebrar.
     Quando Proposta/Contrato Instalador ganharem o mesmo mecanismo, só
     precisam expor um `tentarFinalizarAposSignatarioExtra(documentoId)`
     na própria store pra entrar aqui de graça. */
  async function _avisarDocumentoPai(documentoTipo, documentoId) {
    const STORE_POR_TIPO = {
      contrato_venda: window.CVStore,
      contrato_instalador: window.CIStore,
      proposta: window.PropostaStore,
    };
    const store = STORE_POR_TIPO[documentoTipo];
    if (store && store.tentarFinalizarAposSignatarioExtra) {
      await store.tentarFinalizarAposSignatarioExtra(documentoId);
    }
  }

  async function markViewed(token) {
    const c = sb(); if (!c) return null;
    const cur = await getByToken(token);
    if (!cur) return null;
    if (cur.status !== 'enviado' && cur.status !== 'pendente') return cur;
    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    if (usarRpcPublica()) {
      const r = await chamarRpcPublica(c, 'public_cvs_visualizado', { p_token: token, p_audit: { viewUa: ua, viewDevice: device, viewIp: ip } });
      if (!r.falhou && r.data && r.data.ok && r.data.rec) return { ...cur, ...r.data.rec };
    }
    const now = new Date().toISOString();
    const audit = { ...(cur.audit || {}), viewedAt: now, viewIp: ip, viewUa: ua, viewDevice: device };
    const { error } = await c.from('documento_signatarios')
      .update({ status: 'visualizado', viewed_at: now, audit, atualizado_em: now }).eq('token', token);
    if (error) { console.warn('[DocumentoSignatariosStore] markViewed falhou', error); return cur; }
    return { ...cur, status: 'visualizado', viewed_at: now, audit };
  }

  async function markSigned(token, sig) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const cur = await getByToken(token);
    if (!cur) return null;
    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    const now = new Date();
    const hash = await sha256Hex(`${cur.token}|${cur.documento_tipo}|${cur.documento_id}|${sig.signerName || ''}|${now.getTime()}`);
    const audit = {
      ...(cur.audit || {}),
      signedAt: now.toISOString(), signIp: ip, signUa: ua, signDevice: device,
      signerName: sig.signerName, signatureType: sig.type, signatureData: sig.data,
      consent: true, hash,
    };
    if (usarRpcPublica()) {
      /* O servidor grava a assinatura + o log e reavalia se o documento-pai já pode virar ASSINADO. */
      const r = await chamarRpcPublica(c, 'public_cvs_assinar', { p_token: token, p_audit: {
        signUa: ua, signDevice: device, signIp: ip, signerName: sig.signerName, signatureType: sig.type, signatureData: sig.data, hash,
      } });
      if (!r.falhou) {
        if (!r.data || !r.data.ok) throw erroDaRpc(r.data);
        return { ...cur, ...r.data.rec };
      }
    }
    const log = (cur.log || []).slice();
    log.push({ status: 'assinado', at: now.toISOString(), meta: { ip, ua, hash } });
    const patch = { status: 'assinado', signed_at: now.toISOString(), audit, log, atualizado_em: now.toISOString() };
    const { error } = await c.from('documento_signatarios').update(patch).eq('token', token);
    if (error) throw error;
    const updated = { ...cur, ...patch };

    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Assinatura de Documento',
      acao: `${cur.papel ? cur.papel + ' — ' : ''}${cur.nome} assinou (${cur.documento_tipo})`,
      alvo_id: cur.documento_id,
    });
    await _avisarDocumentoPai(cur.documento_tipo, cur.documento_id);
    return updated;
  }

  async function refuse(token, info) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const cur = await getByToken(token);
    if (!cur) return null;
    const ip = await getPublicIP();
    const ua = navigator.userAgent;
    const device = deviceLabel(ua);
    const now = new Date().toISOString();
    const nome = ((info && info.nome) || '').trim() || cur.nome || null;
    const motivo = ((info && info.motivo) || '').trim() || null;
    if (usarRpcPublica()) {
      const r = await chamarRpcPublica(c, 'public_cvs_recusar', { p_token: token, p_nome: nome, p_motivo: motivo, p_audit: { refuseUa: ua, refuseDevice: device, refuseIp: ip } });
      if (!r.falhou) {
        if (!r.data || !r.data.ok) throw erroDaRpc(r.data);
        return { ...cur, ...r.data.rec };
      }
    }
    const audit = { ...(cur.audit || {}), refusedAt: now, refusedBy: nome, refusedReason: motivo, refuseIp: ip, refuseUa: ua, refuseDevice: device };
    const log = (cur.log || []).slice();
    log.push({ status: 'recusado', at: now, meta: { nome, motivo, ip } });
    const patch = { status: 'recusado', log, audit, atualizado_em: now };
    const { error } = await c.from('documento_signatarios').update(patch).eq('token', token);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Assinatura de Documento',
      acao: `${cur.papel ? cur.papel + ' — ' : ''}${cur.nome} recusou assinar (${cur.documento_tipo})` + (motivo ? ` — Motivo: ${motivo}` : ''),
      alvo_id: cur.documento_id,
    });
    return { ...cur, ...patch };
  }

  window.DocumentoSignatariosStore = {
    shortToken, signUrl, getByToken, listarPorDocumento, listarPorTipo, contarPendentes,
    criar, remover, marcarEnviado, markViewed, markSigned, refuse,
    getPublicIP, deviceLabel, sha256Hex,
    /* achado real (01/10, teste E2E): a tela final de assinatura chama
       `source.store.fmtDateTime(...)` genericamente — faltava aqui e
       quebrava a tela de "assinatura registrada" com um erro de React
       (mesmo delegate que CVSignatarioStore já usa). */
    fmtDateTime: (ts) => (window.CVStore ? window.CVStore.fmtDateTime(ts) : ts),
  };
}());
