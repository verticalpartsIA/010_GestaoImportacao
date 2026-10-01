/* ============================================================
   contrato-venda-signatarios-store.js
   Signatários adicionais do Contrato de Venda (sócios/jurídico do
   Comprador, pedido explícito do usuário) — o representante principal
   continua no fluxo já existente (token/audit em contratos_venda_
   equipamentos, ver contrato-venda-store.js, intocado). Cada signatário
   extra tem seu próprio token individual, assina em qualquer ordem
   (mesmo padrão de assinar-app.jsx: canvas/nome digitado, hash SHA-256,
   IP/device).

   Nomeação dos métodos (getByToken/markViewed/markSigned/refuse) espelha
   de propósito CVStore/CIStore/PropostaStore — assinar-app.jsx chama
   `source.store.<método>` genericamente sem saber qual store é.

   window.CVSignatarioStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  async function getByToken(token) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('contrato_venda_signatarios').select('*').eq('token', token).maybeSingle();
    return data || null;
  }

  async function listarPorContrato(contratoVendaId) {
    const c = sb(); if (!c || !contratoVendaId) return [];
    const { data, error } = await c.from('contrato_venda_signatarios').select('*')
      .eq('contrato_venda_id', contratoVendaId).order('ordem', { ascending: true });
    if (error) { console.warn('[CVSignatarioStore] listarPorContrato falhou', error); return []; }
    return data || [];
  }

  /* Conta quantos signatários extras AINDA não completaram a própria
     assinatura (inclui 'recusado' de propósito — uma recusa também
     bloqueia o contrato virar 'assinado' até ser resolvida manualmente:
     vendedor remove ou substitui o signatário). Usado como gate por
     CVStore.markSigned/tentarFinalizarAposSignatarioExtra. */
  async function contarPendentes(contratoVendaId) {
    const lista = await listarPorContrato(contratoVendaId);
    return lista.filter((s) => s.status !== 'assinado').length;
  }

  async function adicionar(contratoVendaId, { papel, nome, email, telefone } = {}, ordem) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!papel || !papel.trim()) throw new Error('Informe o papel do signatário (ex.: Sócio, Jurídico).');
    if (!nome || !nome.trim()) throw new Error('Informe o nome do signatário.');
    const token = window.CVStore.shortToken();
    const { data, error } = await c.from('contrato_venda_signatarios').insert({
      contrato_venda_id: contratoVendaId,
      papel: papel.trim(), nome: nome.trim(),
      email: (email || '').trim() || null, telefone: (telefone || '').trim() || null,
      token, status: 'pendente', ordem: ordem || 0,
    }).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Contrato Venda', acao: `adicionou ${data.papel} (${data.nome}) como signatário adicional`,
      alvo_id: contratoVendaId,
    });
    return data;
  }

  async function remover(id) {
    const c = sb(); if (!c) return;
    await c.from('contrato_venda_signatarios').delete().eq('id', id);
  }

  function signUrl(token) {
    return `${window.location.origin}/assinar/${encodeURIComponent(token)}`;
  }

  async function marcarEnviado(id, channel, recipient) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const now = new Date().toISOString();
    const { data, error } = await c.from('contrato_venda_signatarios')
      .update({ status: 'enviado', channel, recipient: recipient || {}, sent_at: now, atualizado_em: now })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  /* ---------- Chamadas genéricas de assinar-app.jsx (mesmo nome de
     método que CVStore/CIStore/PropostaStore) ---------- */

  async function markViewed(token) {
    const c = sb(); if (!c) return null;
    const cur = await getByToken(token);
    if (!cur) return null;
    if (cur.status !== 'enviado' && cur.status !== 'pendente') return cur;
    const now = new Date().toISOString();
    const { error } = await c.from('contrato_venda_signatarios')
      .update({ status: 'visualizado', viewed_at: now, atualizado_em: now }).eq('token', token);
    if (error) { console.warn('[CVSignatarioStore] markViewed falhou', error); return cur; }
    return { ...cur, status: 'visualizado', viewed_at: now };
  }

  async function markSigned(token, sig) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const cur = await getByToken(token);
    if (!cur) return null;
    const ip = await window.CVStore.getPublicIP();
    const ua = navigator.userAgent;
    const device = window.CVStore.deviceLabel(ua);
    const now = new Date();
    const hash = await window.CVStore.sha256Hex(`${cur.token}|${cur.papel}|${sig.signerName || ''}|${now.getTime()}`);
    const audit = {
      signedAt: now.toISOString(), signIp: ip, signUa: ua, signDevice: device,
      signerName: sig.signerName, signatureType: sig.type, signatureData: sig.data,
      consent: true, hash,
    };
    const log = (cur.log || []).slice();
    log.push({ status: 'assinado', at: now.toISOString(), meta: { ip, ua, hash } });
    const patch = { status: 'assinado', signed_at: now.toISOString(), audit, log, atualizado_em: now.toISOString() };
    const { error } = await c.from('contrato_venda_signatarios').update(patch).eq('token', token);
    if (error) throw error;
    const updated = { ...cur, ...patch };

    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Contrato Venda', acao: `${cur.papel} (${cur.nome || 'signatário adicional'}) assinou o contrato`,
      alvo_id: cur.contrato_venda_id,
    });
    if (window.EventosFluxo && window.CVStore) {
      const contrato = await window.CVStore.getById(cur.contrato_venda_id);
      const numeroCotacao = contrato ? await window.CVStore.numeroCotacaoDaProposta(contrato.proposta_id) : null;
      window.EventosFluxo.registrar({
        evento: 'CONTRATO_VENDA_SIGNATARIO_ASSINOU', numeroCotacao,
        alvoLabel: `${cur.papel} — ${cur.nome || ''}`, alvoId: cur.contrato_venda_id,
      });
    }

    /* Só finaliza o contrato como 'assinado' de verdade quando o
       representante principal JÁ tiver assinado e todos os outros
       signatários extras também — ver CVStore.tentarFinalizarAposSignatarioExtra. */
    if (window.CVStore && window.CVStore.tentarFinalizarAposSignatarioExtra) {
      await window.CVStore.tentarFinalizarAposSignatarioExtra(cur.contrato_venda_id);
    }
    return updated;
  }

  /* 01/10 — mesmo achado real do representante principal (cotação 955/
     AKAI): recusa sem motivo registrado. Aqui "quem" já é conhecido
     (cada signatário extra tem seu próprio registro/`cur.nome`) —
     só faltava o motivo, opcional, vindo de `assinar-app.jsx`. */
  async function refuse(token, info) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const cur = await getByToken(token);
    if (!cur) return null;
    const now = new Date().toISOString();
    const motivo = ((info && info.motivo) || '').trim() || null;
    const audit = { ...(cur.audit || {}), refusedAt: now, refusedReason: motivo };
    const log = (cur.log || []).slice();
    log.push({ status: 'recusado', at: now, meta: { motivo } });
    const patch = { status: 'recusado', log, audit, atualizado_em: now };
    const { error } = await c.from('contrato_venda_signatarios').update(patch).eq('token', token);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Contrato Venda', acao: `${cur.papel} (${cur.nome || 'signatário adicional'}) recusou assinar o contrato` + (motivo ? ` — Motivo: ${motivo}` : ''),
      alvo_id: cur.contrato_venda_id,
    });
    if (window.EventosFluxo && window.CVStore) {
      const contrato = await window.CVStore.getById(cur.contrato_venda_id);
      const numeroCotacao = contrato ? await window.CVStore.numeroCotacaoDaProposta(contrato.proposta_id) : null;
      window.EventosFluxo.registrar({
        evento: 'CONTRATO_VENDA_SIGNATARIO_RECUSOU', numeroCotacao,
        alvoLabel: `${cur.papel} — ${cur.nome || ''}`, alvoId: cur.contrato_venda_id,
      });
    }
    return { ...cur, ...patch };
  }

  window.CVSignatarioStore = {
    getByToken, listarPorContrato, contarPendentes, adicionar, remover, signUrl, marcarEnviado,
    markViewed, markSigned, refuse,
    fmtDateTime: (ts) => (window.CVStore ? window.CVStore.fmtDateTime(ts) : ts),
  };
}());
