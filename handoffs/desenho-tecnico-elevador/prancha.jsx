/* =========================================================
   VerticalParts — Prancha de Instalação
   prancha.jsx · moldura A4, carimbo e primitivas de cota
   ========================================================= */
(function () {
  const { mm, or, up, NOTAS } = window.VPDados;

  // A4 paisagem @96dpi
  const W = 1122, H = 794;
  const M = 8;                 // margem externa
  const BX = 26, BY = 20;      // moldura interna (esquerda maior p/ encadernação)
  const TBW = 316;             // largura do carimbo
  const TBX = W - BY - TBW;    // x do carimbo
  const AREA = { x: BX, y: BY, w: TBX - BX, h: H - BY * 2 };  // área útil de desenho

  const F = { mono: "'JetBrains Mono', ui-monospace, monospace", disp: "'Mulish', system-ui, sans-serif" };
  const INK = "#0E0E0E", THIN = "#555", HAIR = "#8A8A8A";

  /* ---------------- primitivas ---------------- */
  const T = (x, y, txt, o = {}) => React.createElement("text", {
    key: o.key, x, y, fill: o.fill || INK, fontSize: o.s || 8,
    fontFamily: o.f || F.mono, fontWeight: o.w || 400,
    textAnchor: o.a || "start", letterSpacing: o.ls,
    transform: o.rot ? `rotate(${o.rot} ${x} ${y})` : undefined,
    style: o.style,
  }, txt);

  const L = (x1, y1, x2, y2, o = {}) => React.createElement("line", {
    key: o.key, x1, y1, x2, y2, stroke: o.c || INK,
    strokeWidth: o.w || 0.7, strokeDasharray: o.d, opacity: o.op,
  });

  const R = (x, y, w, h, o = {}) => React.createElement("rect", {
    key: o.key, x, y, width: w, height: h, fill: o.fill || "none",
    stroke: o.c === null ? "none" : (o.c || INK), strokeWidth: o.w || 0.7,
    strokeDasharray: o.d, opacity: o.op,
  });

  // seta cheia de cota
  function arrow(x, y, dir, o = {}) {
    const s = o.s || 4, c = o.c || INK;
    const p = dir === "l" ? `${x},${y} ${x + s},${y - s / 2.4} ${x + s},${y + s / 2.4}`
      : dir === "r" ? `${x},${y} ${x - s},${y - s / 2.4} ${x - s},${y + s / 2.4}`
      : dir === "u" ? `${x},${y} ${x - s / 2.4},${y + s} ${x + s / 2.4},${y + s}`
      : `${x},${y} ${x - s / 2.4},${y - s} ${x + s / 2.4},${y - s}`;
    return React.createElement("polygon", { key: o.key, points: p, fill: c });
  }

  // cota horizontal
  function CotaH(x1, x2, y, label, o = {}) {
    const k = o.key || `ch${x1}${y}`, c = o.c || INK, mx = (x1 + x2) / 2;
    const els = [L(x1, y, x2, y, { key: k + "l", c, w: 0.6 }),
      arrow(x1, y, "l", { key: k + "a1", c }), arrow(x2, y, "r", { key: k + "a2", c })];
    if (o.ext) {
      els.push(L(x1, o.ext[0], x1, o.ext[1], { key: k + "e1", c: HAIR, w: 0.4 }));
      els.push(L(x2, o.ext[0], x2, o.ext[1], { key: k + "e2", c: HAIR, w: 0.4 }));
    }
    const tw = String(label).length * 4.6 + 5;
    els.push(R(mx - tw / 2, y - 8.5, tw, 9, { key: k + "bg", fill: "#fff", c: null }));
    els.push(T(mx, y - 2, label, { key: k + "t", s: o.s || 8, a: "middle" }));
    return React.createElement("g", { key: k }, els);
  }

  // cota vertical
  function CotaV(y1, y2, x, label, o = {}) {
    const k = o.key || `cv${x}${y1}`, c = o.c || INK, my = (y1 + y2) / 2;
    const els = [L(x, y1, x, y2, { key: k + "l", c, w: 0.6 }),
      arrow(x, y1, "u", { key: k + "a1", c }), arrow(x, y2, "d", { key: k + "a2", c })];
    if (o.ext) {
      els.push(L(o.ext[0], y1, o.ext[1], y1, { key: k + "e1", c: HAIR, w: 0.4 }));
      els.push(L(o.ext[0], y2, o.ext[1], y2, { key: k + "e2", c: HAIR, w: 0.4 }));
    }
    const tw = String(label).length * 4.6 + 5;
    els.push(R(x - 4.5, my - tw / 2, 9, tw, { key: k + "bg", fill: "#fff", c: null }));
    els.push(T(x - 2, my, label, { key: k + "t", s: o.s || 8, a: "middle", rot: -90 }));
    return React.createElement("g", { key: k }, els);
  }

  // hachura (concreto / terreno)
  function hatchDefs() {
    return React.createElement("defs", { key: "defs" },
      React.createElement("pattern", { id: "vphatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
        React.createElement("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: HAIR, strokeWidth: 0.6 })),
      React.createElement("pattern", { id: "vpsolo", width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
        React.createElement("line", { x1: 0, y1: 0, x2: 0, y2: 8, stroke: INK, strokeWidth: 0.5 }))
    );
  }

  /* ---------------- moldura + zonas ---------------- */
  function Moldura() {
    const els = [
      R(M, M, W - M * 2, H - M * 2, { key: "out", w: 0.6, c: THIN }),
      R(BX, BY, W - BX - BY, H - BY * 2, { key: "in", w: 1.2 }),
    ];
    // zonas 1..6 (topo/base)
    const zw = (W - BX - BY) / 6;
    for (let i = 0; i < 6; i++) {
      const cx = BX + zw * i + zw / 2;
      els.push(T(cx, BY - 7, String(i + 1), { key: "zt" + i, s: 7.5, a: "middle", fill: THIN }));
      els.push(T(cx, H - BY + 12, String(i + 1), { key: "zb" + i, s: 7.5, a: "middle", fill: THIN }));
      if (i) {
        els.push(L(BX + zw * i, M, BX + zw * i, BY, { key: "zlt" + i, c: THIN, w: 0.5 }));
        els.push(L(BX + zw * i, H - BY, BX + zw * i, H - M, { key: "zlb" + i, c: THIN, w: 0.5 }));
      }
    }
    // zonas A..D (laterais)
    const zh = (H - BY * 2) / 4;
    ["A", "B", "C", "D"].forEach((z, i) => {
      const cy = BY + zh * i + zh / 2;
      els.push(T(BX - 9, cy + 3, z, { key: "zla" + i, s: 7.5, a: "middle", fill: THIN }));
      els.push(T(W - BY + 10, cy + 3, z, { key: "zra" + i, s: 7.5, a: "middle", fill: THIN }));
      if (i) {
        els.push(L(M, BY + zh * i, BX, BY + zh * i, { key: "zhl" + i, c: THIN, w: 0.5 }));
        els.push(L(W - BY, BY + zh * i, W - M, BY + zh * i, { key: "zhr" + i, c: THIN, w: 0.5 }));
      }
    });
    els.push(T(W - BY + 10, H - BY - 6, "A4", { key: "a4", s: 8, a: "middle", w: 700, fill: THIN }));
    return React.createElement("g", { key: "moldura" }, els);
  }

  /* ---------------- carimbo ---------------- */
  function Carimbo({ d, folha, titulo }) {
    const x = TBX, y = BY, w = TBW, bot = H - BY;
    const els = [R(x, y, w, bot - y, { key: "tb", w: 1.2 })];
    let cy = y;
    const line = (h, k) => { cy += h; els.push(L(x, cy, x + w, cy, { key: "hl" + k, w: 0.7 })); };
    const cell = (cx, cw, label, val, o = {}) => {
      const k = `${cx}${cy}${label}`;
      if (label) els.push(T(cx + 4, cy - o.h + 9, label, { key: k + "l", s: 6.4, fill: THIN, ls: "0.04em" }));
      els.push(T(cx + 4, cy - 4, String(or(val, "----")), {
        key: k + "v", s: o.s || 9, w: o.w || 600, f: o.f || F.mono, fill: o.fill || INK,
      }));
    };

    // 1 · revisão / folha
    const h1 = 26;
    cy += h1;
    els.push(L(x, cy, x + w, cy, { key: "h1", w: 0.7 }));
    els.push(L(x + w / 2, y, x + w / 2, cy, { key: "v1", w: 0.7 }));
    els.push(T(x + 4, y + 9, "REVISÃO:", { key: "rl", s: 6.4, fill: THIN }));
    els.push(T(x + 4, cy - 5, or(d.documento.revisao, "0"), { key: "rv", s: 11, w: 700 }));
    els.push(T(x + w / 2 + 4, y + 9, "FOLHA:", { key: "fl", s: 6.4, fill: THIN }));
    els.push(T(x + w / 2 + 4, cy - 5, `${folha}/6`, { key: "fv", s: 11, w: 700 }));

    // 2 · título
    const h2 = 34; line(h2, 2);
    els.push(T(x + 4, cy - h2 + 9, "TÍTULO:", { key: "tl", s: 6.4, fill: THIN }));
    els.push(T(x + 4, cy - 7, up(titulo), { key: "tv", s: 11.5, w: 800, f: F.disp, ls: "0.02em" }));

    // 3 · data / escala / unidade
    const h3 = 22; line(h3, 3);
    const c3 = w / 3;
    [1, 2].forEach(i => els.push(L(x + c3 * i, cy - h3, x + c3 * i, cy, { key: "v3" + i, w: 0.7 })));
    [["DATA:", d.documento.data], ["ESCALA:", d.documento.escala], ["UNIDADE:", d.documento.unidade]]
      .forEach(([lb, v], i) => {
        els.push(T(x + c3 * i + 4, cy - h3 + 8, lb, { key: "l3" + i, s: 6, fill: THIN }));
        els.push(T(x + c3 * i + 4, cy - 4, or(v, "---"), { key: "v3v" + i, s: 8.5, w: 600 }));
      });

    // 4 · cliente
    const h4 = 22; line(h4, 4);
    cell(x, w, "CLIENTE:", up(d.cliente.nomeRazaoSocial), { h: h4, s: 9.5, w: 700, f: F.disp });

    // 5 · CNPJ
    const h5 = 19; line(h5, 5);
    cell(x, w, "CNPJ:", or(d.cliente.cnpj, "----"), { h: h5, s: 8.5 });

    // 6 · endereço (2 linhas)
    const h6 = 27; line(h6, 6);
    els.push(T(x + 4, cy - h6 + 8, "ENDEREÇO:", { key: "el", s: 6, fill: THIN }));
    const end = d.derivado.enderecoLinha || "----";
    const cut = end.length > 44 ? end.slice(0, 44).lastIndexOf(" ") : -1;
    els.push(T(x + 4, cy - 11, cut > 0 ? end.slice(0, cut) : end, { key: "ev1", s: 7.2 }));
    if (cut > 0) els.push(T(x + 4, cy - 3, end.slice(cut + 1), { key: "ev2", s: 7.2 }));

    // 7 · proposta / série
    const h7 = 20; line(h7, 7);
    els.push(L(x + w / 2, cy - h7, x + w / 2, cy, { key: "v7", w: 0.7 }));
    els.push(T(x + 4, cy - h7 + 8, "N° PROPOSTA/CONTRATO:", { key: "pl", s: 6, fill: THIN }));
    els.push(T(x + 4, cy - 4, or(d.documento.numeroProposta, "----"), { key: "pv", s: 8.5, w: 600 }));
    els.push(T(x + w / 2 + 4, cy - h7 + 8, "N° SÉRIE:", { key: "sl", s: 6, fill: THIN }));
    els.push(T(x + w / 2 + 4, cy - 4, or(d.documento.numeroSerie, "----"), { key: "sv", s: 8.5, w: 600 }));

    // 8 · código do equipamento
    const h8 = 22; line(h8, 8);
    els.push(T(x + 4, cy - h8 + 8, "CÓDIGO DO EQUIPAMENTO:", { key: "cl", s: 6, fill: THIN }));
    els.push(T(x + 4, cy - 5, d.derivado.codigo, { key: "cv", s: 10.5, w: 700 }));

    // 9 · revisado / aprovado
    const h9 = 22; line(h9, 9);
    els.push(L(x + w / 2, cy - h9, x + w / 2, cy, { key: "v9", w: 0.7 }));
    els.push(T(x + 4, cy - h9 + 8, "REVISADO POR:", { key: "rvl", s: 6, fill: THIN }));
    els.push(T(x + 4, cy - 4, up(d.documento.revisadoPor), { key: "rvv", s: 8, w: 600 }));
    els.push(T(x + w / 2 + 4, cy - h9 + 8, "APROVADO POR:", { key: "apl", s: 6, fill: THIN }));
    els.push(T(x + w / 2 + 4, cy - 4, up(d.documento.aprovadoPor), { key: "apv", s: 8, w: 600 }));

    // 10 · reações de apoio
    const hHdr = 14; line(hHdr, 10);
    els.push(T(x + w / 2, cy - 4, "REAÇÕES DE APOIO (N)", { key: "rah", s: 7, a: "middle", w: 700, ls: "0.06em" }));
    const rx = d.engenharia.reacoes || {};
    const rows = [["R", "R3", "U"], ["R1", "R4", "V"], ["R2", "R5", null]];
    const rh = 15, cw3 = w / 3;
    rows.forEach((row, ri) => {
      line(rh, "ra" + ri);
      [1, 2].forEach(i => els.push(L(x + cw3 * i, cy - rh, x + cw3 * i, cy, { key: `rav${ri}${i}`, w: 0.5, c: THIN })));
      row.forEach((key, ci) => {
        if (!key) return;
        const v = rx[key];
        els.push(T(x + cw3 * ci + 4, cy - 4.5, key + " =", { key: `rak${ri}${ci}`, s: 7.5, fill: THIN }));
        els.push(T(x + cw3 * (ci + 1) - 5, cy - 4.5, v === null || v === undefined ? "----" : mm(v), {
          key: `rav2${ri}${ci}`, s: 8.5, w: 600, a: "end",
        }));
      });
    });

    // 11 · motivos de revisão
    [1, 2].forEach(i => {
      const hh = 16; line(hh, "mr" + i);
      els.push(T(x + 4, cy - 5, `MOTIVO DA REVISÃO ${i}:`, { key: "mrl" + i, s: 6, fill: THIN }));
      els.push(T(x + w - 5, cy - 5, or(d.documento["motivoRevisao" + i], "----"), { key: "mrv" + i, s: 7.5, a: "end" }));
    });

    // 12 · notas (preenche o resto)
    els.push(T(x + 4, cy + 11, "NOTAS:", { key: "nh", s: 6.6, w: 700, fill: THIN, ls: "0.06em" }));
    let ny = cy + 20;
    NOTAS.forEach((n, i) => {
      els.push(T(x + 5, ny, String(i + 1) + ".", { key: "nn" + i, s: 6.4, w: 700, fill: THIN }));
      wrap(n, 62).forEach((ln, li) => {
        els.push(T(x + 15, ny + li * 7.2, ln, { key: `nt${i}_${li}`, s: 6.4, fill: "#333" }));
      });
      ny += wrap(n, 62).length * 7.2 + 3.4;
    });

    return React.createElement("g", { key: "carimbo" }, els);
  }

  function wrap(txt, n) {
    const words = String(txt).split(" "), out = []; let cur = "";
    words.forEach(wd => {
      if ((cur + " " + wd).trim().length > n) { if (cur) out.push(cur); cur = wd; }
      else cur = (cur + " " + wd).trim();
    });
    if (cur) out.push(cur);
    return out;
  }

  /* ---------------- folha completa ---------------- */
  function Folha({ d, n, titulo, children }) {
    return React.createElement("section", { className: "page", "data-screen-label": String(n).padStart(2, "0") },
      React.createElement("svg", { viewBox: `0 0 ${W} ${H}`, className: "prancha" },
        hatchDefs(),
        React.createElement("rect", { key: "bg", x: 0, y: 0, width: W, height: H, fill: "#fff" }),
        Moldura(),
        Carimbo({ d, folha: n, titulo }),
        React.createElement("g", { key: "conteudo" }, children)
      )
    );
  }

  window.VPPrancha = { Folha, T, L, R, CotaH, CotaV, arrow, wrap, W, H, AREA, F, INK, THIN, HAIR };
})();
