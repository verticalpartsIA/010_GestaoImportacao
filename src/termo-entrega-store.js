/* ============================================================
   termo-entrega-store.js
   Termo de Entrega — assinatura digital (self-service ou presencial)
   sobre dossier_obra.termo_entrega_token / dossier_obra.termo_entrega.
   Mesmo padrão de link público por token de formularios_elevador/
   dossier_obra (RLS permissiva — segurança real é o token não ser
   adivinhável) e mesma auditoria de assinatura de contrato-venda-store.js
   (hash/IP/UA/device). Ao concluir, gera PDF (jsPDF) e anexa em
   dossier_documentos com tipo:'Termo de Entrega' — mesmo lugar que o
   upload manual da aba Documentos já usa, então o checklist da obra
   marca ✓ igual, venha de onde vier.
   window.TermoEntregaStore = { ... }
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

  /* ---------- Auditoria (mesmo padrão de contrato-venda-store.js) ---------- */
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
    if (/whatsapp/i.test(ua)) app = 'WhatsApp';
    else if (/edg/i.test(ua)) app = 'Edge';
    else if (/chrome/i.test(ua)) app = 'Chrome';
    else if (/firefox/i.test(ua)) app = 'Firefox';
    else if (/safari/i.test(ua)) app = 'Safari';
    return `${app} / ${os}`;
  }
  async function sha256Hex(text) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      let h = 0; for (let i = 0; i < text.length; i++) { h = (h << 5) - h + text.charCodeAt(i); h |= 0; }
      return 'fallback-' + (h >>> 0).toString(16);
    }
  }

  function publicUrl(token) {
    return `${window.location.origin}/termo-entrega/${encodeURIComponent(token)}`;
  }

  /* ---------- Painel interno: gerar/reemitir link ---------- */
  async function gerarLink(dossierId, modo) {
    const c = sb(); if (!c || !dossierId) throw new Error('dossierId inválido');
    if (!['self_service', 'presencial'].includes(modo)) throw new Error('modo inválido');

    const { data: atual } = await c.from('dossier_obra')
      .select('termo_entrega_token, numero_cotacao, building_name').eq('id', dossierId).maybeSingle();

    const token = (atual && atual.termo_entrega_token) || shortToken();

    const termo = {
      modo,
      status: 'pendente',
      assinaturas: {},
      gerado_em: new Date().toISOString(),
      gerado_por: window.__VP_USER?.email || 'system',
    };

    const { error } = await c.from('dossier_obra')
      .update({ termo_entrega_token: token, termo_entrega: termo })
      .eq('id', dossierId);
    if (error) throw error;

    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'TERMO_PREPARADO', numeroCotacao: atual?.numero_cotacao ?? null,
      alvoLabel: atual?.building_name, alvoId: dossierId,
    });

    return publicUrl(token);
  }

  /* ---------- Página pública: ler pelo token ---------- */
  async function obterPorToken(token) {
    const c = sb(); if (!c || !token) return null;
    const { data } = await c.from('dossier_obra')
      .select('id, client_name, building_name, city, state, termo_entrega')
      .eq('termo_entrega_token', token).maybeSingle();
    return data || null;
  }

  /* ---------- Página pública: registrar 1 assinatura (cliente OU supervisor) ----------
     Cada papel grava sua própria auditoria (hash/ip/device/hora). Quando os
     assinantes exigidos pelo modo estão completos, gera o PDF e anexa. */
  async function assinar({ token, papel, nome, assinaturaPngDataUrl }) {
    const c = sb(); if (!c || !token) throw new Error('Link inválido.');
    if (!['cliente', 'supervisor'].includes(papel)) throw new Error('papel inválido');
    if (!nome || !nome.trim()) throw new Error('Nome é obrigatório.');
    if (!assinaturaPngDataUrl) throw new Error('Assinatura é obrigatória.');

    const { data: atual, error: e1 } = await c.from('dossier_obra')
      .select('id, client_name, building_name, numero_cotacao, termo_entrega')
      .eq('termo_entrega_token', token).maybeSingle();
    if (e1 || !atual) throw new Error('Link não encontrado.');

    const termo = atual.termo_entrega || { modo: 'self_service', status: 'pendente', assinaturas: {} };
    if (termo.status === 'concluido') return termo; // já concluído, evita reassinar

    const ip = await getPublicIP();
    const device = deviceLabel();
    const hash = await sha256Hex(`${token}|${papel}|${nome}|${Date.now()}`);

    termo.assinaturas = termo.assinaturas || {};
    termo.assinaturas[papel] = {
      nome: nome.trim(), assinatura_png: assinaturaPngDataUrl,
      hash, ip, device, assinado_em: new Date().toISOString(),
    };

    const exigidos = termo.modo === 'presencial' ? ['cliente', 'supervisor'] : ['cliente'];
    const completo = exigidos.every((p) => termo.assinaturas[p]);

    if (completo) {
      termo.status = 'concluido';
      termo.concluido_em = new Date().toISOString();
      try {
        termo.documento_id = await gerarEAnexarPdf(atual, termo);
      } catch (e) {
        console.error('Erro ao gerar PDF do Termo de Entrega:', e);
        termo.pdf_erro = String(e.message || e);
      }
    }

    const { error } = await c.from('dossier_obra')
      .update({ termo_entrega: termo }).eq('termo_entrega_token', token);
    if (error) throw error;

    if (completo && window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'TERMO_ASSINADO', numeroCotacao: atual.numero_cotacao ?? null,
      alvoLabel: atual.building_name, alvoId: atual.id,
    });

    return termo;
  }

  /* ---------- Gera PDF simples (jsPDF) e anexa em dossier_documentos ----------
     Roda direto na página pública (sem sessão/login) — grava no Storage e
     na tabela igual ao anexarDocumento manual de dossier-store.js, só que
     sem depender de window.__VP_USER (aqui quem "envia" é o assinante). */
  async function gerarEAnexarPdf(dossier, termo) {
    const c = sb();
    if (!window.jspdf) throw new Error('jsPDF não carregado');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    doc.setFontSize(14); doc.setFont(undefined, 'bold');
    doc.text('Termo de Entrega', 20, 20);
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    doc.text(`Obra: ${dossier.building_name || '—'}`, 20, 30);
    doc.text(`Cliente: ${dossier.client_name || '—'}`, 20, 36);
    doc.text(`Dossiê: ${dossier.id}`, 20, 42);
    doc.text('Declaro que o(s) equipamento(s) desta obra foi(ram) entregue(s), testado(s) e', 20, 52);
    doc.text('aceito(s) nas condições apresentadas, encerrando a etapa de instalação.', 20, 58);

    let y = 72;
    for (const papel of ['cliente', 'supervisor']) {
      const a = termo.assinaturas[papel];
      if (!a) continue;
      const label = papel === 'cliente' ? 'Assinatura do Cliente' : 'Assinatura do Supervisor VerticalParts';
      doc.setFont(undefined, 'bold'); doc.text(label, 20, y);
      doc.setFont(undefined, 'normal');
      try { doc.addImage(a.assinatura_png, 'PNG', 20, y + 3, 70, 28); } catch (e) { /* assinatura vazia — segue sem imagem */ }
      doc.setFontSize(8);
      doc.text(`${a.nome} - ${new Date(a.assinado_em).toLocaleString('pt-BR')}`, 20, y + 35);
      doc.text(`IP ${a.ip || '-'} - ${a.device || '-'} - hash ${(a.hash || '').slice(0, 24)}...`, 20, y + 40);
      doc.setFontSize(10);
      y += 52;
    }

    const blob = doc.output('blob');
    const id = 'DOC-' + Date.now().toString().slice(-6);
    const path = `dossier-documentos/${dossier.id}/${id}.pdf`;
    const { error: upErr } = await c.storage.from('engenharia')
      .upload(path, blob, { upsert: true, contentType: 'application/pdf' });
    if (upErr) throw upErr;
    const { data: pub } = c.storage.from('engenharia').getPublicUrl(path);

    const { error } = await c.from('dossier_documentos').insert({
      id, dossier_id: dossier.id, tipo: 'Termo de Entrega',
      nome: 'Termo de Entrega — assinado digitalmente',
      status: 'anexado',
      responsavel: termo.assinaturas.supervisor?.nome || termo.assinaturas.cliente?.nome || 'assinatura digital',
      data_criacao: new Date().toISOString().split('T')[0],
      arquivo_url: pub?.publicUrl || null,
      metadata: { origem: 'termo-entrega-assinatura-digital', modo: termo.modo },
    });
    if (error) throw error;
    return id;
  }

  window.TermoEntregaStore = {
    gerarLink, obterPorToken, assinar, publicUrl,
  };
})();
