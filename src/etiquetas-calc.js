/* ============================================================
   etiquetas-calc.js — Logística Interna · Etiquetas (regras puras: sem tela, sem rede, sem banco).
   Spec: docs/superpowers/specs/2026-10-17-modulo-etiquetas-design.md
   O que mora aqui:
   - endereço do almoxarifado (R<rua><vão><nível>, ex. R2A4; EXP = área de expedição) e o dígito verificador (DV);
   - modelos padrão de etiqueta (layout em milímetros, igual para qualquer impressora);
   - renderizador ZPL II (impressoras Zebra e compatíveis) e renderizador SVG (pré-visualização e impressão pelo navegador).
   Regras que existem por motivo:
   - O CONTRATO com o app de estoque não muda: item = QR e Code 128 com o `codigo` exato; endereço = QR "END:" + código.
     Formato novo de QR exige comentário na issue #862 ANTES de mudar (spec do app, 3.4). O DV nunca entra no QR.
   - DV = (rua×3 + vão×5 + nível×7) mod 10, vão A=1 … J=10. Fórmula PROPOSTA, ainda não aprovada pelo Gelson: por isso o DV nasce
     DESLIGADO na tela. Mude só em DV_PESOS e imprima as etiquetas DEPOIS de aprovar (etiqueta antiga ficaria com o DV da regra velha).
   - ZPL: acentos saem como bytes UTF-8 em hexadecimal (^FH, _C3_A7 = ç) com ^CI28, independente de como o agente local codifica o
     texto. Se a impressora não aceitar UTF-8, o perfil liga "sem acentos" (acento é removido; nunca vira lixo).
   - QR e Code 128 são SEMPRE nativos da impressora (leitura mais confiável que imagem).
   window.EtiquetasCalc
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Endereço ---------- */
  const END_RE = /^R([1-4])([A-J])([1-8])$/;
  const VAOS = 'ABCDEFGHIJ';
  const DV_PESOS = { rua: 3, vao: 5, nivel: 7 };

  // Igual ao estoque_endereco_normalizar do banco: tira "END:", põe em maiúscula, tira espaços.
  function normalizarEndereco(texto) {
    return String(texto == null ? '' : texto).replace(/^\s*END:\s*/i, '').replace(/\s+/g, '').toUpperCase();
  }
  // null = endereço que não existe. Mesmas regras da constraint de estoque_enderecos: Rua 1 e Rua 4 só têm nível ímpar
  // (porta-palete à esquerda); a Rua 1 só vai até o vão I.
  function parseEndereco(texto) {
    const c = normalizarEndereco(texto);
    if (c === 'EXP') return { codigo: 'EXP', tipo: 'expedicao', rua: null, vao: null, nivel: null, lado: null };
    const m = END_RE.exec(c);
    if (!m) return null;
    const rua = Number(m[1]), vao = m[2], nivel = Number(m[3]);
    if (!(rua === 2 || rua === 3 || nivel % 2 === 1)) return null;
    if (rua === 1 && vao === 'J') return null;
    return { codigo: c, tipo: 'posicao', rua, vao, nivel, lado: nivel % 2 === 1 ? 'esquerda' : 'direita' };
  }
  function dvEndereco(texto) {
    const e = parseEndereco(texto);
    if (!e || e.tipo !== 'posicao') return null;
    return (e.rua * DV_PESOS.rua + (VAOS.indexOf(e.vao) + 1) * DV_PESOS.vao + e.nivel * DV_PESOS.nivel) % 10;
  }
  function textoEndereco(texto) {
    const e = parseEndereco(texto);
    if (!e) return '';
    if (e.tipo === 'expedicao') return 'Área de expedição';
    return `Rua ${e.rua} · Vão ${e.vao} · Nível ${e.nivel}`;
  }
  // As 236 posições + EXP (mesma carga da migration 20261017120000). Serve de conferência e de plano B se a tabela não responder.
  function todosEnderecos() {
    const out = [];
    for (let rua = 1; rua <= 4; rua++) for (const vao of VAOS) for (let nivel = 1; nivel <= 8; nivel++) {
      const e = parseEndereco(`R${rua}${vao}${nivel}`);
      if (e) out.push(e);
    }
    out.push(parseEndereco('EXP'));
    return out;
  }

  /* ---------- Dados que alimentam os modelos ---------- */
  function dadosEndereco(texto, opcoes) {
    const e = parseEndereco(texto);
    if (!e) throw new Error(`Endereço inexistente: ${texto}`);
    const comDv = !!(opcoes && opcoes.dv);
    const dv = comDv ? dvEndereco(e.codigo) : null;
    return {
      codigo: e.codigo,
      descricao_local: textoEndereco(e.codigo),
      lado_texto: e.lado === 'esquerda' ? 'LADO ESQUERDO' : e.lado === 'direita' ? 'LADO DIREITO' : '',
      dv_texto: dv == null ? '' : `DV ${dv}`,
      qr: `END:${e.codigo}`,
      barras: e.codigo,
    };
  }
  function dadosItem(p) {
    const codigo = String(p.codigo || '').trim();
    const unidade = String(p.unidade || '').trim();
    const familia = String(p.familia || '').trim();
    return {
      codigo,
      descricao: String(p.descricao || '').trim(),
      linha_unidade: [unidade, familia && `Família ${familia}`].filter(Boolean).join(' · '),
      endereco_txt: p.endereco ? `End.: ${String(p.endereco).trim()}` : '',
      qr: codigo,
      barras: codigo,
    };
  }

  /* ---------- Modelos padrão (layout em mm) ----------
     Elementos: caixa (borda) · linha · texto ({campo}, h = altura do texto, linhas) · qr (w = lado) · code128 (w × h). */
  const MODELOS = [
    {
      id: 'ENDERECO_VIGA_100x50', tipo: 'ENDERECO', nome: 'Endereço — viga horizontal', largura_mm: 100, altura_mm: 50,
      proposito: 'Identifica a posição no porta-palete. O QR (END:R2A4) é bipado no app para dizer onde se contou, guardou ou separou.',
      campos: ['codigo', 'descricao_local', 'lado_texto', 'dv_texto', 'qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 49, esp: 0.4 },
        { tipo: 'qr', campo: '{qr}', x: 4, y: 4, w: 30 },
        { tipo: 'texto', campo: '{codigo}', x: 38, y: 4, w: 58, h: 16 },
        { tipo: 'texto', campo: '{descricao_local}', x: 38, y: 22, w: 58, h: 4.5 },
        { tipo: 'texto', campo: '{lado_texto}', x: 38, y: 29, w: 38, h: 5 },
        { tipo: 'texto', campo: '{dv_texto}', x: 78, y: 29, w: 18, h: 5, alinhamento: 'dir' },
        { tipo: 'code128', campo: '{barras}', x: 38, y: 36, w: 58, h: 10 },
      ],
    },
    {
      id: 'ITEM_100x50', tipo: 'ITEM', nome: 'Item — código e descrição', largura_mm: 100, altura_mm: 50,
      proposito: 'Cola-se na peça ou na caixa. QR e Code 128 levam exatamente o código do produto (contrato do app de estoque).',
      campos: ['codigo', 'descricao', 'linha_unidade', 'endereco_txt', 'qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 49, esp: 0.4 },
        { tipo: 'qr', campo: '{qr}', x: 4, y: 4, w: 24 },
        { tipo: 'texto', campo: '{codigo}', x: 32, y: 4, w: 64, h: 9 },
        { tipo: 'texto', campo: '{descricao}', x: 32, y: 14.5, w: 64, h: 4.6, linhas: 2 },
        { tipo: 'texto', campo: '{linha_unidade}', x: 32, y: 26.5, w: 64, h: 4.2 },
        { tipo: 'texto', campo: '{endereco_txt}', x: 32, y: 31.5, w: 64, h: 3.8 },
        { tipo: 'code128', campo: '{barras}', x: 4, y: 37, w: 92, h: 9 },
      ],
    },
    {
      id: 'TESTE_100x50', tipo: 'TESTE', nome: 'Teste de bancada', largura_mm: 100, altura_mm: 50,
      proposito: 'Confere margem, acentos, QR, código de barras e escala (réguas de 10 mm e 50 mm) na impressora.',
      campos: ['qr', 'barras'],
      elementos: [
        { tipo: 'caixa', x: 0.5, y: 0.5, w: 99, h: 49, esp: 0.4 },
        { tipo: 'texto', campo: 'TESTE - 100 x 50 mm', x: 3, y: 2, w: 94, h: 4.5 },
        { tipo: 'texto', campo: 'Acentos: ç ã é ô Ç Ã', x: 3, y: 8, w: 94, h: 3.5 },
        { tipo: 'qr', campo: '{qr}', x: 3, y: 14, w: 22 },
        { tipo: 'code128', campo: '{barras}', x: 32, y: 14, w: 64, h: 11 },
        { tipo: 'texto', campo: 'QR: END:R2A4', x: 3, y: 37, w: 40, h: 3 },
        { tipo: 'linha', x: 3, y: 42, w: 10, esp: 0.4 },
        { tipo: 'texto', campo: '10 mm', x: 15, y: 40.5, w: 20, h: 3 },
        { tipo: 'linha', x: 3, y: 46.5, w: 50, esp: 0.4 },
        { tipo: 'texto', campo: '50 mm', x: 56, y: 45, w: 20, h: 3 },
      ],
    },
  ];
  const DADOS_TESTE = { qr: 'END:R2A4', barras: 'VPEL-156' };
  const modeloPorId = (id) => MODELOS.find((m) => m.id === id) || null;
  const modelosDoTipo = (tipo) => MODELOS.filter((m) => m.tipo === tipo);

  // "{campo}" -> valor de dados (vazio se não existir)
  function aplicar(modelo, dados) {
    return String(modelo == null ? '' : modelo).replace(/\{(\w+)\}/g, (_, k) => (dados && dados[k] != null ? String(dados[k]) : ''));
  }

  /* ---------- ZPL II ---------- */
  // Impressoras de "203 dpi" têm 8 pontos por mm (203,2 dpi); as de "300 dpi", 12 pontos/mm. Qualquer outra resolução: dpi ÷ 25,4.
  const pontosPorMm = (dpi) => (Number(dpi) === 203 ? 8 : Number(dpi) === 300 ? 12 : Number(dpi) === 600 ? 24 : Number(dpi) / 25.4);
  const mmParaDots = (mm, dpi) => Math.round(Number(mm) * pontosPorMm(dpi));
  // Capacidade em bytes (modo byte, correção M) das versões 1..10 do QR; módulos = 17 + 4×versão.
  const QR_CAP_M = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
  function qrModulos(bytes) {
    const i = QR_CAP_M.findIndex((c) => c >= bytes);
    return 17 + 4 * ((i < 0 ? QR_CAP_M.length : i) + 1);
  }
  const utf8Bytes = (s) => (typeof TextEncoder !== 'undefined' ? Array.from(new TextEncoder().encode(s)) : Array.from(unescape(encodeURIComponent(s)), (c) => c.charCodeAt(0)));

  // Texto seguro para dentro de ^FD (usa ^FH com "_" como escape). Acento vira _C3_A7; sem UTF-8, o acento é removido.
  function zplTexto(valor, utf8) {
    let s = String(valor == null ? '' : valor).replace(/[\r\n\t]+/g, ' ');
    if (!utf8) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    let out = '';
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x20 && cp <= 0x7e && ch !== '^' && ch !== '~' && ch !== '_' && ch !== '\\') { out += ch; continue; }
      if (!utf8 && cp > 0x7e) { out += '?'; continue; }
      if (cp < 0x20) { out += ' '; continue; }
      out += utf8Bytes(ch).map((b) => '_' + b.toString(16).toUpperCase().padStart(2, '0')).join('');
    }
    return out;
  }
  function cortar(texto, max, utf8) {
    const s = String(texto || '');
    if (s.length <= max) return { texto: s, cortado: false };
    return { texto: s.slice(0, Math.max(1, max - 1)) + (utf8 ? '…' : '.'), cortado: true };
  }

  /* opcoes: { dpi = 203, utf8 = true, copias = 1 } -> { zpl, avisos[] } (uma etiqueta; ^PQ repete as cópias) */
  function renderZPL(modelo, dados, opcoes) {
    const o = Object.assign({ dpi: 203, utf8: true, copias: 1 }, opcoes || {});
    const avisos = [];
    const d = (mm) => mmParaDots(mm, o.dpi);
    const W = d(modelo.largura_mm), H = d(modelo.altura_mm);
    const z = ['^XA'];
    if (o.utf8) z.push('^CI28');
    z.push(`^PW${W}`, `^LL${H}`, '^LH0,0');
    for (const el of modelo.elementos) {
      const x = d(el.x), y = d(el.y);
      if (el.tipo === 'caixa') {
        const esp = Math.max(1, d(el.esp || 0.4));
        z.push(`^FO${x},${y}^GB${d(el.w)},${d(el.h)},${esp}^FS`);
      } else if (el.tipo === 'linha') {
        const esp = Math.max(1, d(el.esp || 0.4));
        z.push(`^FO${x},${y}^GB${d(el.w)},${esp},${esp}^FS`);
      } else if (el.tipo === 'texto') {
        const bruto = aplicar(el.campo, dados);
        if (!bruto.trim()) continue;
        const w = d(el.w), h = Math.max(8, d(el.h));
        const linhas = el.linhas || 1;
        const maxChars = Math.max(1, Math.floor(w / (h * 0.55))) * linhas;
        const c = cortar(bruto, maxChars, o.utf8);
        if (c.cortado) avisos.push(`Texto cortado para caber: "${bruto}"`);
        const al = el.alinhamento === 'dir' ? 'R' : el.alinhamento === 'centro' ? 'C' : 'L';
        z.push(`^FO${x},${y}^FB${w},${linhas},0,${al},0^A0N,${h},0^FH_^FD${zplTexto(c.texto, o.utf8)}^FS`);
      } else if (el.tipo === 'qr') {
        const dado = aplicar(el.campo, dados);
        if (!dado) continue;
        const modulos = qrModulos(utf8Bytes(dado).length);
        const alvo = d(el.w);
        const mag = Math.max(2, Math.min(10, Math.floor(alvo / modulos)));
        if (Math.floor(alvo / modulos) < 3) avisos.push(`QR "${dado}" pequeno: ${mag} ponto(s) por módulo (ideal ≥ 3)`);
        z.push(`^FO${x},${y}^BQN,2,${mag}^FH_^FDMA,${zplTexto(dado, true)}^FS`);
      } else if (el.tipo === 'code128') {
        const dado = aplicar(el.campo, dados);
        if (!dado) continue;
        // largura de um Code 128 em subset B: (11 × (caracteres + 3) + 13) módulos; escolhe a barra mais larga que couber (2 a 3 pontos).
        const modulos = 11 * (dado.length + 3) + 13;
        const alvo = d(el.w);
        const barra = Math.min(3, Math.floor(alvo / modulos));
        if (barra < 2) { avisos.push(`Código de barras "${dado}" não cabe na largura do modelo`); }
        z.push(`^BY${Math.max(2, barra)}`, `^FO${x},${y}^BCN,${Math.max(8, d(el.h))},N,N,N,A^FH_^FD${zplTexto(dado, true)}^FS`);
      }
    }
    z.push(`^PQ${Math.max(1, Math.floor(Number(o.copias) || 1))}`, '^XZ');
    return { zpl: z.join('\n'), avisos };
  }

  /* ---------- SVG (pré-visualização e impressão pelo navegador) ---------- */
  const escXml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (n) => Math.round(n * 1000) / 1000;
  // Embute um <svg viewBox> gerado por biblioteca de código de barras dentro de uma caixa (x, y, w, h) em mm.
  function embutirSvg(svg, x, y, w, h, preservar) {
    const vb = /viewBox="([^"]+)"/.exec(svg);
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    if (!vb) return '';
    return `<svg x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" viewBox="${vb[1]}" preserveAspectRatio="${preservar}">${inner}</svg>`;
  }
  function quebrar(texto, maxChars, linhas) {
    const palavras = String(texto).split(/\s+/);
    const out = []; let atual = '';
    for (const p of palavras) {
      if ((atual + ' ' + p).trim().length <= maxChars) atual = (atual + ' ' + p).trim();
      else { if (atual) out.push(atual); atual = p; }
    }
    if (atual) out.push(atual);
    if (out.length > linhas) { out.length = linhas; out[linhas - 1] = out[linhas - 1].slice(0, Math.max(1, maxChars - 1)) + '…'; }
    return out;
  }
  /* opcoes.barcode(tipo, texto) -> string <svg> (tipo 'qr' | 'code128'); sem ela, desenha um retângulo de aviso. */
  function renderSVG(modelo, dados, opcoes) {
    const bc = opcoes && opcoes.barcode;
    const W = modelo.largura_mm, H = modelo.altura_mm;
    const p = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" font-family="Arial, Helvetica, sans-serif">`,
      `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`];
    for (const el of modelo.elementos) {
      if (el.tipo === 'caixa') {
        p.push(`<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" fill="none" stroke="#000" stroke-width="${el.esp || 0.4}"/>`);
      } else if (el.tipo === 'linha') {
        p.push(`<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.esp || 0.4}" fill="#000"/>`);
      } else if (el.tipo === 'texto') {
        const t = aplicar(el.campo, dados);
        if (!t.trim()) continue;
        const linhas = el.linhas || 1;
        const maxChars = Math.max(1, Math.floor(el.w / (el.h * 0.5))) * 1;
        const partes = quebrar(t, maxChars, linhas);
        const anc = el.alinhamento === 'dir' ? 'end' : el.alinhamento === 'centro' ? 'middle' : 'start';
        const tx = el.alinhamento === 'dir' ? el.x + el.w : el.alinhamento === 'centro' ? el.x + el.w / 2 : el.x;
        partes.forEach((linha, i) => {
          p.push(`<text x="${num(tx)}" y="${num(el.y + el.h * 0.82 + i * el.h * 1.15)}" font-size="${num(el.h)}" font-weight="700" text-anchor="${anc}">${escXml(linha)}</text>`);
        });
      } else if (el.tipo === 'qr' || el.tipo === 'code128') {
        const dado = aplicar(el.campo, dados);
        if (!dado) continue;
        const h = el.tipo === 'qr' ? el.w : el.h;
        const svg = bc ? bc(el.tipo, dado) : null;
        const emb = svg ? embutirSvg(svg, el.x, el.y, el.w, h, el.tipo === 'qr' ? 'xMinYMin meet' : 'none') : '';
        p.push(emb || `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${h}" fill="#eee" stroke="#999" stroke-width="0.2"/><text x="${el.x + 1}" y="${el.y + h / 2}" font-size="2.5" fill="#666">${el.tipo === 'qr' ? 'QR' : 'Code 128'}</text>`);
      }
    }
    p.push('</svg>');
    return p.join('');
  }
  // Documento de impressão pelo navegador: uma página por etiqueta, tamanho exato em mm, sem margem.
  function htmlImpressao(paginasSvg, larguraMm, alturaMm) {
    const css = `@page{size:${larguraMm}mm ${alturaMm}mm;margin:0}html,body{margin:0;padding:0;background:#fff}` +
      `.pg{width:${larguraMm}mm;height:${alturaMm}mm;overflow:hidden;page-break-after:always;break-after:page}` +
      `.pg:last-child{page-break-after:auto;break-after:auto}.pg svg{display:block;width:${larguraMm}mm;height:${alturaMm}mm}`;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas</title><style>${css}</style></head><body>` +
      paginasSvg.map((s) => `<div class="pg">${s}</div>`).join('') + '</body></html>';
  }

  /* Confere um endereço digitado à mão (regra do galpão, a mesma do app de estoque). Só vale para valor NOVO:
     se o texto é igual ao que já estava gravado (endereço antigo, ex.: "G13"), passa sem mexer — nunca apagamos dado existente.
     Devolve { ok, codigo, antigo, msg }; codigo = forma canônica (R2A4) ou null quando vazio. */
  function validarEnderecoNovo(texto, anterior) {
    const bruto = String(texto == null ? '' : texto).trim();
    if (!bruto) return { ok: true, codigo: null, antigo: false, msg: '' };
    const p = parseEndereco(bruto);
    if (p) return { ok: true, codigo: p.codigo, antigo: false, msg: '' };
    if (anterior != null && normalizarEndereco(bruto) === normalizarEndereco(anterior)) return { ok: true, codigo: bruto, antigo: true, msg: '' };
    return { ok: false, codigo: null, antigo: false, msg: `Endereço "${bruto}" não existe no galpão. Use o formato R<rua><vão><nível>, ex.: R2A4 (ruas 1–4, vãos A–J, níveis 1–8) ou EXP.` };
  }

  window.EtiquetasCalc = {
    DV_PESOS, validarEnderecoNovo, MODELOS, DADOS_TESTE, modeloPorId, modelosDoTipo,
    normalizarEndereco, parseEndereco, dvEndereco, textoEndereco, todosEnderecos,
    dadosEndereco, dadosItem, aplicar, pontosPorMm, mmParaDots, qrModulos, zplTexto, renderZPL, renderSVG, htmlImpressao,
  };
}());
