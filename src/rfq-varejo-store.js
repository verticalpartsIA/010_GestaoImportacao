/* ============================================================
   rfq-varejo-store.js
   Tratativas das Cotações de Varejo na tela RFQ Importação (/gestao-importacao/rfq-importacao).
   Uma conversa por CONVITE (lote × fornecedor), no mesmo molde das Tratativas dos equipamentos (tratativas-store.js):
     • SAÍDA: a mensagem é gravada em iv_cotacao_tratativas E enviada por e-mail (send-email) ao fornecedor, com
       referenciaTipo 'cotacao_varejo' + referenciaId = id do convite — o mesmo vínculo do pedido de cotação, então a resposta
       dele por e-mail (que preserva o Message-ID) volta ligada ao convite pelo read-inbox, sem mexer nele;
     • ENTRADA: e-mails de emails_projeto com referencia_id = convite (pedido enviado, mensagens, respostas do fornecedor);
     • EVENTOS: envios do link, abertura, resposta pelo portal e mudanças de preço (histórico da resposta).
   Nada aqui altera send-email/read-inbox/vínculo. window.RFQVarejoStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }
  function autorAtual() {
    let u = window.__VP_USER;
    if (!u) { try { u = JSON.parse(sessionStorage.getItem('vpprd_user')); } catch (e) {} }
    return (u && (u.nome || u.name || u.email)) || 'Importação';
  }

  async function listarPorConvite(conviteId) {
    const c = sb(); if (!c || !conviteId) return [];
    const { data, error } = await c.from('iv_cotacao_tratativas').select('*').eq('convite_id', conviteId).order('created_at', { ascending: true });
    if (error) { console.warn('[RFQVarejo] tratativas', error); return []; }
    return data || [];
  }

  const EMAIL_COLS = 'id, direcao, assunto, de_email, de_nome, para, corpo_texto, data_mensagem, referencia_tipo, referencia_id';
  async function listarEmails(conviteId) {
    const c = sb(); if (!c || !conviteId) return [];
    try {
      const { data } = await c.from('emails_projeto').select(EMAIL_COLS)
        .eq('referencia_id', String(conviteId)).is('excluido_em', null).order('data_mensagem', { ascending: true }).limit(300);
      return data || [];
    } catch (e) { console.warn('[RFQVarejo] e-mails', e); return []; }
  }

  /* Eventos do convite: envios (e-mail/WhatsApp/link), abertura do portal, resposta. */
  function eventosDoConvite(cv) {
    const ev = [];
    (cv.envios || []).forEach((e, i) => ev.push({
      k: 'env:' + i, quando: e.em, quem: e.por || null, tipo: 'evento',
      titulo: 'Pedido de cotação enviado (' + ({ email: 'e-mail', whatsapp: 'WhatsApp', link: 'link copiado' }[e.canal] || e.canal || 'link') + ', rodada ' + (e.rodada || 1) + ')',
    }));
    if (cv.visualizado_em) ev.push({ k: 'vis', quando: cv.visualizado_em, quem: cv.fornecedor_nome, tipo: 'evento', titulo: 'Fornecedor abriu o link da cotação' });
    if (cv.respondido_em) ev.push({ k: 'resp', quando: cv.respondido_em, quem: cv.fornecedor_nome, tipo: 'evento', titulo: 'Fornecedor respondeu pelo portal (rodada ' + (cv.rodada || 1) + ')' });
    return ev;
  }

  /* Mudanças de preço: cada resposta guarda as versões anteriores em `historico` (rodadas/atualizações). */
  function mudancasDePreco(respostas, itensPorId, moeda) {
    const out = [];
    (respostas || []).forEach((r) => {
      const it = itensPorId[r.item_id]; const cod = it ? it.codigo : 'item';
      (r.historico || []).forEach((h, i) => {
        out.push({
          k: 'hist:' + r.id + ':' + i, quando: h.em, quem: null, tipo: 'preco',
          titulo: 'Preço anterior de ' + cod + ' (rodada ' + (h.rodada || 1) + ')',
          linhas: (h.faixas || []).map((f) => 'a partir de ' + f.min + ' un.: ' + (moeda || '') + ' ' + f.preco),
        });
      });
    });
    return out;
  }

  function splitEmails(txt) {
    return String(txt || '').split(/[,;\s]+/).map((e) => e.trim()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br/>');

  async function enviar({ lote, convite, mensagem, anexos, cc } = {}) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    if (!lote || !convite) throw new Error('Lote ou fornecedor não informado.');
    const texto = (mensagem || '').trim();
    if (!texto && !(anexos || []).length) throw new Error('Escreva uma mensagem ou anexe um arquivo.');
    const autor = autorAtual();

    // O histórico existe mesmo se o e-mail falhar.
    const { data, error } = await c.from('iv_cotacao_tratativas').insert({
      convite_id: convite.id, lote_id: lote.id, lote_numero: lote.numero, fornecedor_nome: convite.fornecedor_nome,
      autor, mensagem: texto || null, anexos: anexos || [],
    }).select().single();
    if (error) throw new Error(error.message);

    const destinos = splitEmails(convite.email);
    let aviso = { ok: false, para: destinos, motivo: 'Este fornecedor não tem e-mail no cadastro — a mensagem ficou só registrada aqui.' };
    if (destinos.length) {
      const link = window.CotacoesVarejoStore ? window.CotacoesVarejoStore.portalUrl(convite.token) : null;
      const linksAnexos = (anexos || []).map((a) => '- ' + a.nome + ': ' + a.url).join('\n');
      const corpo = 'Message about request for quotation ' + lote.numero + ' / Mensagem sobre a cotação ' + lote.numero + ' / 关于询价单 ' + lote.numero + ' 的消息\n\n'
        + autor + ':\n' + (texto || '(attachments only)') + '\n' + (linksAnexos ? '\nAttachments:\n' + linksAnexos + '\n' : '')
        + '\nYou can reply directly to this e-mail.' + (link ? '\nQuotation portal: ' + link : '');
      const r = window.EmailEnvioHelper
        ? await window.EmailEnvioHelper.tentarEnviarDireto({ to: destinos.join(', '), cc, subject: 'Request for Quotation ' + lote.numero + ' — VerticalParts', text: corpo, referenciaTipo: 'cotacao_varejo', referenciaId: convite.id })
        : { enviouDireto: false };
      if (r.enviouDireto) aviso = { ok: true, para: destinos, motivo: null };
      else {
        let motivo = (r.emailData && r.emailData.error) || (r.emailError && r.emailError.message) || 'O envio por e-mail falhou.';
        try { if (r.emailError && r.emailError.context && r.emailError.context.json) { const j = await r.emailError.context.json(); if (j && j.error) motivo = j.error; } } catch (e) {}
        aviso = { ok: false, para: destinos, motivo };
      }
    }
    if (window.VPLog) window.VPLog.registrar({ modulo: 'RFQ Importação (varejo)', acao: 'Escreveu ao fornecedor na tratativa', alvo: lote.numero + ' · ' + convite.fornecedor_nome, alvo_id: convite.id });
    return { ...data, __email: aviso };
  }

  async function uploadAnexo(conviteId, file) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    const path = 'varejo/' + conviteId + '/' + Date.now() + '_' + file.name.replace(/[^\w.\-]/g, '_');
    const { error } = await c.storage.from('tratativas').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = c.storage.from('tratativas').getPublicUrl(path);
    return { nome: file.name, url: data.publicUrl, tipo: file.type, tamanho: file.size, path };
  }

  window.RFQVarejoStore = { listarPorConvite, listarEmails, eventosDoConvite, mudancasDePreco, enviar, uploadAnexo };
}());
