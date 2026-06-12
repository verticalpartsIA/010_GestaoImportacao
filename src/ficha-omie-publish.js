/* ============================================================
   ficha-omie-publish.js — Publicar ficha técnica no Omie
   Gera PDF da pré-visualização e envia como anexo do produto
   no Omie via Edge Function (Supabase) publicar_ficha_omie.
   window.FichaOmiePublish
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Gera o PDF da ficha em tamanho real (html2canvas → jsPDF, 1 página A4).
     Se o overlay estiver aberto usa-o diretamente; caso contrário clona a
     ficha do preview e renderiza fora de qualquer container com zoom. */
  async function gerarPdfBase64() {
    if (!window.html2canvas || !window.jspdf) {
      throw new Error('Bibliotecas de PDF ainda carregando — tente de novo em 2s');
    }

    // Overlay aberto = versão em tamanho real, preferência máxima
    let el = document.querySelector('.ft-ficha-overlay .ft-ficha');
    let tempEl = null;

    if (!el) {
      const source = document.querySelector('.ft-previewcol .ft-ficha')
        || document.querySelector('.ft-ficha');
      if (!source) throw new Error('Pré-visualização da ficha não encontrada na tela');

      // Clona e renderiza fora do container com zoom para obter tamanho real
      tempEl = source.cloneNode(true);
      tempEl.style.cssText = [
        'position:fixed', 'top:-9999px', 'left:-9999px',
        'zoom:1', 'transform:none', 'width:1040px',
        'pointer-events:none',
      ].join(';');
      document.body.appendChild(tempEl);
      el = tempEl;
    }

    const ori = el.getAttribute('data-orientation') || 'landscape';
    try {
      const canvas = await window.html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: ori, compress: true });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'JPEG', 0, 0, pw, ph, undefined, 'FAST');
      return pdf.output('datauristring').split('base64,')[1];
    } finally {
      if (tempEl) document.body.removeChild(tempEl);
    }
  }

  let busy = false; // trava cliques duplos — o Omie rejeita chamadas repetidas (<60s)

  async function publicarNoOmie(fichaId, nomeProduto, atorNome, atorSetor) {
    if (busy) { window.toast?.('Aguarde — publicação em andamento…', 'info'); return; }
    const c = sb();
    if (!c) { window.toast?.('Supabase indisponível', 'error'); throw new Error('Supabase indisponível'); }
    if (!fichaId) {
      window.toast?.('Salve a ficha antes de publicar no Omie', 'error');
      throw new Error('Ficha ainda não salva');
    }
    busy = true;
    try {
      return await doPublicar(c, fichaId, atorNome, atorSetor);
    } finally { busy = false; }
  }

  async function doPublicar(c, fichaId, atorNome, atorSetor) {

    window.toast?.('Gerando PDF da ficha…', 'info');
    const pdfBase64 = await gerarPdfBase64();

    window.toast?.('Enviando para o Omie…', 'info');
    const { data, error } = await c.functions.invoke('publicar_ficha_omie', {
      body: {
        ficha_id: fichaId,
        pdf_base64: pdfBase64,
        ator_nome: atorNome || 'Usuário',
        ator_setor: atorSetor || 'engenharia',
      },
    });

    if (error) {
      // FunctionsHttpError: o corpo da resposta tem a mensagem real
      let msg = error.message || 'Erro ao publicar';
      try {
        const body = await error.context?.json?.();
        if (body && body.error) msg = body.error;
      } catch (e) { /* mantém msg */ }
      window.toast?.(msg, 'error');
      throw new Error(msg);
    }
    if (data && data.error) {
      window.toast?.(data.error, 'error');
      throw new Error(data.error);
    }

    window.toast?.(data?.mensagem || '✅ Ficha publicada no Omie!', 'success');
    return data;
  }

  window.FichaOmiePublish = { publicarNoOmie, gerarPdfBase64 };
}());
