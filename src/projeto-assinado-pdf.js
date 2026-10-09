/* ============================================================
   projeto-assinado-pdf.js — PDF do Projeto de Instalação da Obra com a
   assinatura digital do cliente.

   Pedido do usuário (05/10/2026): a Engenharia sobe o PDF do Projeto de
   Instalação (Engenharia › Projeto de Elevadores) e o representante do
   cliente assina pelo site (/assinar/<token>), igual aos outros documentos.
   O PDF original NÃO é redesenhado: usa-se a pdf-lib (CDN, window.PDFLib)
   pra anexar uma página final com as assinaturas digitais, mantendo o
   arquivo da Engenharia intacto. REGRA TRAVADA (ver CLAUDE.md): a página
   lista cada assinante com papel, nome, data/hora (Brasília), dispositivo,
   IP e hash, mais o SHA-256 do PDF original (prova de qual arquivo foi
   assinado).

   window.ProjetoAssinadoPdf.gerarBlob(info, assinaturas) → Blob
   window.ProjetoAssinadoPdf.baixar(info, assinaturas, nomeArquivo)
   window.ProjetoAssinadoPdf.assinaturasDe(linhasDocumentoSignatarios)
     info        = { arquivo_url, arquivo_nome, referencia, cliente_nome, numero_cotacao, equipamentos[] }
     assinaturas = [{ papel, nome, em (ISO), dispositivo, ip, hash }]
   ============================================================ */
(function () {
  'use strict';

  const FONTE_MAO = 'https://cdn.jsdelivr.net/npm/@fontsource/caveat@5.0.8/files/caveat-latin-700-normal.woff';

  /* Fontes padrão da pdf-lib só entendem Latin-1: troca o que sobrar por "?"
     (nome com emoji/CJK não pode derrubar o download). */
  function limpa(t) {
    return String(t == null ? '' : t).replace(/[^\x20-\x7E -ÿ]/g, '?');
  }
  function fmtDataHora(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  async function sha256Hex(bytes) {
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  /* Quebra em linhas que cabem em `max` pontos (palavra a palavra; palavra
     maior que a linha, como o hash, é cortada em pedaços). */
  function quebra(texto, font, size, max) {
    const linhas = [];
    let atual = '';
    const larg = (s) => font.widthOfTextAtSize(s, size);
    String(texto).split(/\s+/).filter(Boolean).forEach((p) => {
      while (larg(p) > max) {
        let i = p.length - 1;
        while (i > 1 && larg(p.slice(0, i)) > max) i--;
        if (atual) { linhas.push(atual); atual = ''; }
        linhas.push(p.slice(0, i));
        p = p.slice(i);
      }
      const tent = atual ? atual + ' ' + p : p;
      if (larg(tent) <= max) atual = tent;
      else { linhas.push(atual); atual = p; }
    });
    if (atual) linhas.push(atual);
    return linhas;
  }

  async function gerarBlob(info, assinaturas) {
    const L = window.PDFLib;
    if (!L) throw new Error('Biblioteca de PDF (pdf-lib) não carregou. Recarregue a página.');
    if (!info || !info.arquivo_url) throw new Error('Arquivo do projeto não encontrado.');

    const resp = await fetch(info.arquivo_url, { cache: 'no-store' });
    if (!resp.ok) throw new Error('Não foi possível ler o PDF do projeto (HTTP ' + resp.status + ').');
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const hashOriginal = await sha256Hex(bytes);

    const pdf = await L.PDFDocument.load(bytes, { ignoreEncryption: true });
    const reg = await pdf.embedFont(L.StandardFonts.Helvetica);
    const neg = await pdf.embedFont(L.StandardFonts.HelveticaBold);
    const ita = await pdf.embedFont(L.StandardFonts.HelveticaOblique);
    /* Assinatura em letra de mão (Caveat). Precisa do fontkit; sem ele ou sem rede, cai pro itálico. */
    let mao = ita;
    try {
      if (window.fontkit) {
        pdf.registerFontkit(window.fontkit);
        const fr = await fetch(FONTE_MAO, { cache: 'force-cache' });
        if (fr.ok) mao = await pdf.embedFont(new Uint8Array(await fr.arrayBuffer()), { subset: true });
      }
    } catch (e) { console.warn('[ProjetoAssinadoPdf] fonte de letra de mão indisponível, usando itálico', e); mao = ita; }

    const W = 595.28, H = 841.89, M = 56;
    const preto = L.rgb(0, 0, 0), cinza = L.rgb(0.4, 0.4, 0.4), amarelo = L.rgb(0.96, 0.72, 0);
    let page = pdf.addPage([W, H]);
    let y = H - M;

    const novaPaginaSe = (alt) => { if (y - alt < M) { page = pdf.addPage([W, H]); y = H - M; } };
    const texto = (t, { font = reg, size = 10, cor = preto, x = M, gap = 4 } = {}) => {
      quebra(limpa(t), font, size, W - M - x).forEach((ln) => {
        novaPaginaSe(size + gap);
        y -= size;
        page.drawText(ln, { x, y, size, font, color: cor });
        y -= gap;
      });
    };

    page.drawRectangle({ x: 0, y: H - 14, width: W, height: 14, color: amarelo });
    y -= 14;
    texto('ASSINATURAS DIGITAIS', { font: neg, size: 16, gap: 6 });
    texto('Projeto de Instalação da Obra', { font: neg, size: 11, gap: 10 });

    [
      ['Obra / empreendimento', info.referencia],
      ['Cliente', info.cliente_nome],
      ['Nº da cotação', info.numero_cotacao != null ? String(info.numero_cotacao) : ''],
      ['Equipamento(s)', (info.equipamentos || []).join(', ')],
      ['Arquivo original', info.arquivo_nome],
    ].filter(([, v]) => v).forEach(([k, v]) => texto(k + ': ' + v, { size: 9.5, gap: 3 }));
    texto('SHA-256 do arquivo original: ' + hashOriginal, { size: 7, cor: cinza, gap: 14 });

    const lista = Array.isArray(assinaturas) ? assinaturas : [];
    if (!lista.length) texto('Documento ainda sem assinatura.', { font: ita, size: 10 });
    for (const a of lista) {
      novaPaginaSe(120);
      const topo = y;
      texto(a.papel || '', { font: neg, size: 9, x: M + 10, gap: 3 });
      if (a.imagem) {
        try {
          const img = /^data:image\/png/.test(a.imagem) ? await pdf.embedPng(a.imagem) : await pdf.embedJpg(a.imagem);
          const h = 40, w = Math.min(220, img.width * (h / img.height));
          novaPaginaSe(h + 6);
          y -= h;
          page.drawImage(img, { x: M + 10, y, width: w, height: h });
          y -= 6;
        } catch (e) { texto(a.nome || '', { font: mao, size: 22, x: M + 10, gap: 5 }); }
      } else {
        texto(a.nome || '', { font: mao, size: 22, x: M + 10, gap: 5 });
      }
      texto('Assinado em ' + fmtDataHora(a.em) + ' (horário de Brasília) · ' + (a.dispositivo || 'dispositivo não informado'), { size: 9, x: M + 10, gap: 3 });
      texto('IP: ' + (a.ip || 'não informado'), { size: 9, x: M + 10, gap: 3 });
      texto('Hash: ' + (a.hash || ''), { size: 7, cor: cinza, x: M + 10, gap: 6 });
      page.drawRectangle({ x: M, y: y + 2, width: 2, height: topo - y - 2, color: preto });
      y -= 10;
    }

    texto('Documento assinado eletronicamente, com registro de data/hora, IP e dispositivo, conforme a MP 2.200-2/2001 e a Lei 14.063/2020.', { font: ita, size: 8, cor: cinza, gap: 4 });

    const out = await pdf.save();
    return new Blob([out], { type: 'application/pdf' });
  }

  async function baixar(info, assinaturas, nomeArquivo) {
    const blob = await gerarBlob(info, assinaturas);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeArquivo || 'Projeto de Instalação - assinado.pdf';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /* Lista de assinaturas a partir das linhas de documento_signatarios já
     assinadas — usado pela página pública e pela tela da Engenharia. */
  function assinaturasDe(linhas) {
    return (linhas || []).filter((s) => s && s.status === 'assinado').map((s) => {
      const au = s.audit || {};
      return { papel: s.papel || 'Representante do cliente', nome: au.signerName || s.nome || '', em: au.signedAt || s.signed_at, dispositivo: au.signDevice, ip: au.signIp, hash: au.hash, imagem: /^data:image\//.test(au.signatureData || '') ? au.signatureData : null };
    }).sort((a, b) => new Date(a.em) - new Date(b.em));
  }

  window.ProjetoAssinadoPdf = { gerarBlob, baixar, assinaturasDe };
}());
