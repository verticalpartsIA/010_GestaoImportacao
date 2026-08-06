/* =========================================================
   VerticalParts — Prancha de Instalação
   folhas-a.jsx · Folhas 1-3 (seção, poço, casa de máquinas)
   ========================================================= */
(function () {
  const P = window.VPPrancha;
  const { T, L, R, CotaH, CotaV, AREA, F, INK, THIN, HAIR, wrap } = P;
  const { mm, or, num } = window.VPDados;

  /* ============ tabela genérica ============ */
  function tabela(x, y, cols, rows, o = {}) {
    const els = [], hr = o.hr || 15, hh = o.hh || 22;
    const wTot = cols.reduce((s, c) => s + c.w, 0);
    els.push(R(x, y, wTot, hh + rows.length * hr, { key: "tb", w: 1 }));
    // cabeçalho
    els.push(R(x, y, wTot, hh, { key: "th", fill: "#F0EFEA", w: 1 }));
    let cx = x;
    cols.forEach((c, i) => {
      if (i) els.push(L(cx, y, cx, y + hh + rows.length * hr, { key: "cv" + i, w: 0.7 }));
      const lines = wrap(c.t, c.wrap || 16);
      lines.forEach((ln, li) =>
        els.push(T(cx + c.w / 2, y + (hh / 2) + 3 - (lines.length - 1) * 3.6 + li * 7.2, ln,
          { key: `ch${i}_${li}`, s: 6.8, a: "middle", w: 700 })));
      cx += c.w;
    });
    // linhas
    rows.forEach((row, ri) => {
      const ry = y + hh + ri * hr;
      els.push(L(x, ry, x + wTot, ry, { key: "rh" + ri, w: 0.6, c: ri === 0 ? INK : THIN }));
      let rx = x;
      cols.forEach((c, ci) => {
        const v = row[ci];
        els.push(T(rx + c.w / 2, ry + hr - 4.5, v === null || v === undefined ? "_" : String(v),
          { key: `rc${ri}_${ci}`, s: 7.6, a: "middle", w: row.__b ? 700 : 400 }));
        rx += c.w;
      });
    });
    return { els: React.createElement("g", { key: o.key || "tab" }, els), w: wTot, h: hh + rows.length * hr };
  }

  /* ================= FOLHA 1 · SEÇÃO DO EIXO VERTICAL ================= */
  function Folha1(d) {
    const els = [], D = d.derivado;
    const S = D.S, K = D.K, PT = D.percurso, TOT = D.alturaTotal;
    const semCM = D.semCasaMaquinas;

    /* --- tabela de andares (topo esquerdo) --- */
    const cols = [
      { t: "Pisos", w: 46 }, { t: "Distância entre pisos", w: 74, wrap: 11 },
      { t: "Porta", w: 54 }, { t: "Parada", w: 46 }, { t: "Viga intermediária", w: 82, wrap: 11 },
    ];
    const rows = [[or(d.poco.rotulo, "S ="), mm(d.poco.profundidade), null, null, mm(d.poco.viga)]];
    d.pavimentos.forEach(p => rows.push([
      p.rotulo, mm(num(p.distancia)), or(p.porta, "_"),
      p.parada === false ? "Não" : "Sim", or(p.viga, "_"),
    ]));
    const tot = [`${D.pisos} Pisos`, "", `${D.paradas} Paradas`, "", `${D.portas} Portas`];
    tot.__b = true; rows.push(tot);
    const tb = tabela(AREA.x + 14, AREA.y + 16, cols, rows, { key: "tabandares" });
    els.push(tb.els);
    els.push(T(AREA.x + 14, AREA.y + 11, "Informações dos andares", { key: "tt", s: 8.5, w: 700, f: F.disp }));

    /* --- elevação --- */
    const exT = AREA.y + 46, exB = AREA.y + 690;
    const mrH = semCM ? 0 : 74;
    const shTop = exT + mrH, shBot = exB;
    const sy = (shBot - shTop) / TOT;
    const yOf = (h) => shBot - h * sy;      // h em mm a partir do fundo do poço
    const cxL = AREA.x + 470, shW = 132, cxR = cxL + shW;

    // casa de máquinas
    if (!semCM) {
      els.push(R(cxL - 16, exT, shW + 32, mrH, { key: "mr", w: 1.1 }));
      els.push(T(cxL - 10, exT + 14, "CASA DE MÁQUINAS", { key: "mrl", s: 7, w: 700, f: F.disp }));
      els.push(CotaV(exT, exT + mrH, cxL - 30, "MRH ≥ " + mm(d.casaMaquinas.altura), { key: "cmrh", s: 7.5 }));
      // gancho
      els.push(L(cxL + shW / 2, exT + 4, cxL + shW / 2, exT + 20, { key: "gk", w: 1.4 }));
      els.push(React.createElement("circle", { key: "gkc", cx: cxL + shW / 2, cy: exT + 23, r: 4, fill: "none", stroke: INK, strokeWidth: 1.2 }));
      els.push(T(cxR + 24, exT + 20, "Gancho no teto — pelo Cliente", { key: "gkl", s: 7 }));
      els.push(T(cxR + 24, exT + 29, `Capacidade ${mm(d.casaMaquinas.ganchoCapacidade)} kg`, { key: "gkl2", s: 7, fill: THIN }));
      els.push(T(cxR + 24, exT + 38, "(marcar no gancho)", { key: "gkl3", s: 7, fill: THIN }));
    }

    // caixa de corrida
    els.push(R(cxL, shTop, shW, shBot - shTop, { key: "sh", w: 1.3 }));
    els.push(R(cxL + 4, shTop + 4, shW - 8, shBot - shTop - 8, { key: "sh2", w: 0.4, c: HAIR }));

    // poço hachurado + solo
    const yPit = yOf(S);
    els.push(R(cxL, yPit, shW, shBot - yPit, { key: "pit", fill: "url(#vphatch)", c: null }));
    els.push(L(cxL, yPit, cxR, yPit, { key: "pitl", w: 1 }));
    els.push(R(cxL - 26, shBot, shW + 52, 10, { key: "solo", fill: "url(#vpsolo)", c: null }));
    els.push(L(cxL - 26, shBot, cxR + 26, shBot, { key: "solol", w: 1.2 }));

    // níveis dos pavimentos
    let h = S;
    const niveis = [];
    d.pavimentos.forEach((p, i) => {
      niveis.push({ h, p, i });
      h += num(p.distancia, 0);
    });
    niveis.forEach(({ h: hh, p, i }) => {
      const y = yOf(hh);
      els.push(L(cxL - 22, y, cxR + 8, y, { key: "fl" + i, w: 1 }));
      els.push(T(cxL - 26, y + 3, p.rotulo, { key: "fll" + i, s: 8, a: "end", w: 700 }));
      // porta de pavimento
      if (p.porta && p.porta !== "_") {
        const oph = num(d.portas.altura, 2100) * sy;
        els.push(R(cxR - 5, y - oph, 5, oph, { key: "dr" + i, fill: "#0E0E0E", c: null, op: 0.82 }));
      }
      // cota entre pisos
      if (i < niveis.length - 1) {
        els.push(CotaV(yOf(niveis[i + 1].h), y, cxL - 46, mm(num(p.distancia)), { key: "cd" + i, s: 7.5 }));
      }
    });

    // cabina no pavimento inferior
    const chp = num(d.cabina.altura, 2400) * sy, y0 = yOf(S);
    els.push(R(cxL + 18, y0 - chp, shW - 36, chp, { key: "cab", w: 1, fill: "#fff" }));
    els.push(T(cxL + shW / 2, y0 - chp / 2 + 3, "CABINA", { key: "cabl", s: 7.5, a: "middle", w: 700, f: F.disp }));
    els.push(CotaV(y0 - chp, y0, cxL + shW / 2 + 30, "CH " + mm(d.cabina.altura), { key: "cch", s: 7 }));

    // cotas gerais à direita
    const dx1 = cxR + 20, dx2 = cxR + 62;
    els.push(CotaV(yOf(S + PT), yOf(TOT), dx1, "K = " + mm(K), { key: "ck", ext: [cxR, dx1] }));
    els.push(CotaV(yOf(S), yOf(S + PT), dx1, "P = " + mm(PT), { key: "cp", ext: [cxR, dx1] }));
    els.push(CotaV(yOf(0), yOf(S), dx1, "S = " + mm(S), { key: "cs", ext: [cxR, dx1] }));
    els.push(CotaV(yOf(0), yOf(TOT), dx2, mm(TOT), { key: "ctot", ext: [dx1, dx2] }));
    els.push(CotaH(cxL, cxR, shTop + 16, "HD " + mm(d.caixa.profundidade), { key: "chd", ext: [shTop, shTop + 16] }));

    // suportes de guia
    const ySup1 = yOf(S + num(d.engenharia.primeiroSuporte, 700));
    const ySupN = yOf(TOT - num(d.engenharia.ultimoSuporte, 500));
    [[ySup1, "Posição do primeiro suporte de guia", d.engenharia.primeiroSuporte],
     [ySupN, "Posição do último suporte de guia", d.engenharia.ultimoSuporte]].forEach(([y, lb, v], i) => {
      els.push(L(cxL - 6, y, cxL + 10, y, { key: "sup" + i, w: 1.1 }));
      els.push(L(cxL - 60, y, cxL - 6, y, { key: "supl" + i, w: 0.4, c: HAIR, d: "3 2" }));
      els.push(T(cxL - 62, y - 2, lb, { key: "supt" + i, s: 6.6, a: "end", fill: THIN }));
      els.push(T(cxL - 62, y + 6, mm(v), { key: "supv" + i, s: 7.4, a: "end", w: 700 }));
    });

    /* --- notas técnicas (bloco inferior esquerdo) --- */
    const nx = AREA.x + 14, ny = AREA.y + 250;
    const notas = [
      ["SOH", mm(d.portas.soleiraAltura) + " mm", "Altura da porta de entrada"],
      ["OPH", mm(d.portas.altura) + " mm", "Altura da abertura de porta"],
      ["Suportes de guia", "máx. " + mm(d.engenharia.distanciaMaxSuportes) + " mm", "Distância entre suportes"],
      ["Luzes de proteção", "n × 7000 mm", "Conforme o espaçamento"],
      ["Iluminação de poço", "1 por pavimento", "Interruptor e tomada a máx. 1,00 m"],
    ];
    els.push(T(nx, ny, "Dados verticais", { key: "nvt", s: 8.5, w: 700, f: F.disp }));
    notas.forEach(([k, v, obs], i) => {
      const y = ny + 16 + i * 22;
      els.push(T(nx, y, k, { key: "nvk" + i, s: 7.4, w: 700 }));
      els.push(T(nx + 256, y, v, { key: "nvv" + i, s: 7.8, a: "end", w: 600 }));
      els.push(T(nx, y + 9, obs, { key: "nvo" + i, s: 6.4, fill: THIN }));
      els.push(L(nx, y + 14, nx + 256, y + 14, { key: "nvl" + i, w: 0.4, c: HAIR }));
    });

    /* --- detalhe dos parachoques / forças de solo --- */
    const bx = AREA.x + 14, by = AREA.y + 400;
    els.push(R(bx, by, 256, 140, { key: "bqb", w: 0.8, c: THIN }));
    els.push(T(bx + 8, by + 15, "DETALHE DOS PARACHOQUES", { key: "bqt", s: 7.4, w: 700, f: F.disp }));
    els.push(T(bx + 8, by + 26, "Instalação das forças de solo", { key: "bqs", s: 6.6, fill: THIN }));
    // dois amortecedores
    [["U", "Amortecedor lateral da cabina", 0], ["V", "Amortecedor lateral do contrapeso", 1]].forEach(([k, lb, i]) => {
      const ax = bx + 26 + i * 120, ay = by + 56;
      els.push(R(ax, ay, 34, 30, { key: "amb" + i, w: 0.9, fill: "url(#vphatch)" }));
      els.push(L(ax + 17, ay - 10, ax + 17, ay, { key: "aml" + i, w: 1.2 }));
      els.push(T(ax + 17, ay + 42, k, { key: "amk" + i, s: 9, a: "middle", w: 700 }));
      const rv = (d.engenharia.reacoes || {})[k];
      els.push(T(ax + 17, ay + 52, rv ? mm(rv) + " N" : "----", { key: "amv" + i, s: 7.2, a: "middle", w: 600 }));
      wrap(lb, 18).forEach((ln, li) =>
        els.push(T(ax + 17, ay + 62 + li * 7.4, ln, { key: `amt${i}_${li}`, s: 6.2, a: "middle", fill: THIN })));
    });

    return els;
  }

  /* ================= FOLHA 2 · PLANO DO POÇO ================= */
  function Folha2(d) {
    const els = [], D = d.derivado;
    const HW = num(d.caixa.largura, 1796), HD = num(d.caixa.profundidade, 1810);
    const CW = num(d.cabina.largura, 1100), CD = num(d.cabina.profundidade, 1400);
    const OP = num(d.portas.largura, 800), SOW = num(d.portas.soleiraLargura, 1000);
    const cp = d.engenharia.contrapeso || {};
    const temCP = cp.posicao && cp.posicao !== "nenhum";

    // escala
    const boxW = 400, boxH = 360;
    const s = Math.min(boxW / HW, boxH / HD);
    const pw = HW * s, ph = HD * s;
    const ox = AREA.x + 150, oy = AREA.y + 150;

    els.push(T(ox, oy - 24, "Vista em planta do poço", { key: "t", s: 10, w: 800, f: F.disp }));

    // caixa
    els.push(R(ox, oy, pw, ph, { key: "hw", w: 1.4 }));
    els.push(R(ox + 5, oy + 5, pw - 10, ph - 10, { key: "hw2", w: 0.5, c: HAIR }));

    // contrapeso ao fundo
    let cpDepth = 0;
    if (temCP) {
      const brw = num(cp.largura, 1016) * s;
      cpDepth = 22;
      els.push(R(ox + (pw - brw) / 2, oy + 8, brw, cpDepth, { key: "cp", fill: "url(#vphatch)", w: 0.9 }));
      els.push(T(ox + pw / 2, oy + 8 + cpDepth / 2 + 3, "CONTRAPESO", { key: "cpl", s: 6.8, a: "middle", w: 700 }));
      els.push(CotaH(ox + (pw - brw) / 2, ox + (pw + brw) / 2, oy - 10, "BRW " + mm(cp.largura), { key: "cbrw", s: 7.4 }));
    }

    // cabina (frente = baixo)
    const cw = CW * s, cd = CD * s;
    const cx = ox + (pw - cw) / 2, cy = oy + ph - cd - 10;
    els.push(R(cx, cy, cw, cd, { key: "cab", w: 1.2 }));
    els.push(T(cx + cw / 2, cy + cd / 2 - 2, "CABINA", { key: "cabl", s: 9, a: "middle", w: 800, f: F.disp }));
    els.push(T(cx + cw / 2, cy + cd / 2 + 10, `${mm(CW)} × ${mm(CD)}`, { key: "cabd", s: 7.4, a: "middle", fill: THIN }));

    // guias de cabina (laterais)
    [ox + 2, ox + pw - 8].forEach((gx, i) => {
      els.push(R(gx, oy + ph / 2 - 14, 6, 28, { key: "gc" + i, fill: INK, c: null }));
      els.push(L(gx + 3, oy + ph / 2, gx + (i ? 46 : -46), oy + ph / 2, { key: "gcl" + i, w: 0.4, c: HAIR, d: "3 2" }));
    });
    els.push(T(ox + pw + 52, oy + ph / 2 + 3, "Guias de cabina = " + or(d.engenharia.guiaCabina, "--"), { key: "gcT", s: 7 }));
    if (temCP) els.push(T(ox + pw + 52, oy + ph / 2 + 13, "Guias de contrapeso = " + or(d.engenharia.guiaContrapeso, "--"), { key: "gpT", s: 7, fill: THIN }));

    // abertura de porta (frente)
    const fy = oy + ph;
    const sowPx = SOW * s, opPx = OP * s;
    const central = /central/i.test(String(d.portas.tipoAbertura || ""));
    const sx = ox + (pw - sowPx) / 2;
    els.push(R(sx, fy - 5, sowPx, 10, { key: "sow", fill: "#fff", c: null }));
    els.push(L(sx, fy, sx + sowPx, fy, { key: "sowl", w: 2.4 }));
    const opx = ox + (pw - opPx) / 2;
    if (central) {
      els.push(L(opx, fy, opx + opPx / 2 - 3, fy, { key: "d1", w: 4 }));
      els.push(L(opx + opPx / 2 + 3, fy, opx + opPx, fy, { key: "d2", w: 4 }));
    } else {
      els.push(L(opx, fy, opx + opPx, fy, { key: "d1", w: 4 }));
    }
    els.push(T(ox + pw / 2, fy + 46, String(d.portas.tipoAbertura || "").toUpperCase(), { key: "dt", s: 7.4, a: "middle", w: 700 }));

    // pontos de reação
    const rx = d.engenharia.reacoes || {};
    [["R", ox + 14, oy + ph - 14], ["R", ox + pw - 14, oy + ph - 14], ["U", ox + pw / 2, oy + ph - 30]]
      .forEach(([k, px, py], i) => {
        els.push(React.createElement("circle", { key: "rp" + i, cx: px, cy: py, r: 3.6, fill: "#fff", stroke: INK, strokeWidth: 1 }));
        els.push(React.createElement("circle", { key: "rpc" + i, cx: px, cy: py, r: 1.4, fill: INK }));
        els.push(T(px, py - 7, k, { key: "rpl" + i, s: 7.4, a: "middle", w: 700 }));
      });
    if (temCP) {
      els.push(React.createElement("circle", { key: "rpv", cx: ox + pw / 2, cy: oy + 8 + cpDepth + 12, r: 3.6, fill: "#fff", stroke: INK, strokeWidth: 1 }));
      els.push(T(ox + pw / 2 + 9, oy + 8 + cpDepth + 15, "V", { key: "rpvl", s: 7.4, w: 700 }));
    }

    // cotas
    els.push(CotaH(ox, ox + pw, oy - 34, "HW " + mm(HW), { key: "chw", ext: [oy, oy - 34], s: 9 }));
    els.push(CotaV(oy, oy + ph, ox + pw + 34, "HD " + mm(HD), { key: "chd", ext: [ox + pw, ox + pw + 34], s: 9 }));
    els.push(CotaH(cx, cx + cw, cy - 12, "CW " + mm(CW), { key: "ccw", s: 7.6 }));
    els.push(CotaV(cy, cy + cd, cx - 14, "CD " + mm(CD), { key: "ccd", s: 7.6 }));
    els.push(CotaH(opx, opx + opPx, fy + 20, "OP " + mm(OP), { key: "cop", ext: [fy, fy + 20], s: 8 }));
    els.push(CotaH(sx, sx + sowPx, fy + 34, "SOW " + mm(SOW), { key: "csow", ext: [fy, fy + 34], s: 8 }));

    // legenda de cargas
    const lx = AREA.x + 14, ly = AREA.y + 596;
    els.push(T(lx, ly, "Cargas no fundo do poço", { key: "clt", s: 8.5, w: 700, f: F.disp }));
    const pares = [["R", "Reação das guias de cabina"], ["R1", "Reação complementar"],
      ["U", "Amortecedor lateral da cabina"], ["V", "Amortecedor lateral do contrapeso"]];
    pares.forEach(([k, lb], i) => {
      const y = ly + 16 + i * 17;
      els.push(T(lx, y, k + " =", { key: "clk" + i, s: 7.4, w: 700 }));
      const v = rx[k];
      els.push(T(lx + 46, y, v === null || v === undefined ? "----" : mm(v) + " N", { key: "clv" + i, s: 7.6, w: 600 }));
      els.push(T(lx + 120, y, lb, { key: "cll" + i, s: 6.6, fill: THIN }));
      els.push(L(lx, y + 5, lx + 300, y + 5, { key: "clL" + i, w: 0.4, c: HAIR }));
    });
    els.push(T(lx, ly + 100, "Cargas com coeficiente de segurança incluído.", { key: "cln", s: 6.4, fill: THIN }));

    return els;
  }

  /* ================= FOLHA 3 · CASA DE MÁQUINAS ================= */
  function Folha3(d) {
    const els = [], D = d.derivado;
    if (D.semCasaMaquinas) {
      const cx = AREA.x + AREA.w / 2, cy = AREA.y + 300;
      els.push(R(cx - 250, cy - 70, 500, 150, { key: "b", w: 1, c: THIN, d: "6 4" }));
      els.push(T(cx, cy - 34, "SEM CASA DE MÁQUINAS", { key: "t", s: 15, a: "middle", w: 800, f: F.disp }));
      els.push(T(cx, cy - 8, "Equipamento especificado como " + or(d.equipamento.casaDeMaquinas, "sem casa de máquinas") + ".",
        { key: "t2", s: 8.4, a: "middle" }));
      els.push(T(cx, cy + 10, "Máquina instalada na própria caixa de corrida.", { key: "t3", s: 8.4, a: "middle", fill: THIN }));
      els.push(T(cx, cy + 36, "Painel de comando conforme folha 5 — Diagrama unifilar.", { key: "t4", s: 7.6, a: "middle", fill: THIN }));
      return els;
    }

    const CM = d.casaMaquinas;
    const MRW = num(CM.largura, 1796), MRD = num(CM.profundidade, 1810);
    const s = Math.min(340 / MRW, 300 / MRD);
    const pw = MRW * s, ph = MRD * s;
    const ox = AREA.x + 60, oy = AREA.y + 130;

    els.push(T(ox, oy - 22, "Vista em planta da casa de máquinas", { key: "t", s: 10, w: 800, f: F.disp }));
    els.push(R(ox, oy, pw, ph, { key: "mr", w: 1.4 }));
    els.push(R(ox + 5, oy + 5, pw - 10, ph - 10, { key: "mr2", w: 0.5, c: HAIR }));

    // furação no piso — posições definidas em projeto
    const furos = [
      { lb: "4-200×200", ly: 53.6, d: 15, pos: [[30, 100], [30, 135], [177.45, 135], [214, 135]] },
      { lb: "2-100×100", ly: 100.4, d: 10, pos: [[30, 50], [30, 200]] },
      { lb: "2-100×200", ly: 147.3, d: 10, pos: [[64, 139], [264, 139]] },
    ];
    furos.forEach((f, i) => {
      f.pos.forEach(([dx, dy], j) =>
        els.push(R(ox + dx, oy + dy, f.d, f.d, { key: `f${i}_${j}`, fill: "url(#vphatch)", w: 0.9 })));
      els.push(T(ox + pw + 12, oy + f.ly, f.lb, { key: "fl" + i, s: 7.2, w: 600 }));
      els.push(L(ox + 278, oy + f.ly - 3, ox + pw + 8, oy + f.ly - 3, { key: "fll" + i, w: 0.4, c: HAIR, d: "3 2" }));
    });
    // linha central
    els.push(L(ox + pw / 2, oy - 8, ox + pw / 2, oy + ph + 8, { key: "clc", w: 0.5, c: THIN, d: "9 3 2 3" }));
    els.push(T(ox + 30, oy + 26, "Furação no piso da casa de máquinas", { key: "ft", s: 6.8, fill: THIN }));
    els.push(T(ox + pw / 2 + 4, oy + ph + 18, "Linha central da cabina", { key: "clct", s: 6.6, fill: THIN }));

    // cotas
    els.push(CotaH(ox, ox + pw, oy - 34, "MRW " + mm(MRW), { key: "cmrw", ext: [oy, oy - 34], s: 9 }));
    els.push(CotaV(oy, oy + ph, ox + pw + 80, "MRD " + mm(MRD), { key: "cmrd", ext: [ox + pw, ox + pw + 80], s: 9 }));
    els.push(T(ox, oy + ph + 34, "C = " + mm(CM.folga) + " mm  ·  MRH ≥ " + mm(CM.altura) + " mm", { key: "cc", s: 7.8, w: 600 }));

    /* --- vistas dos ganchos --- */
    const gx = AREA.x + 470, gy = AREA.y + 130;
    els.push(T(gx, gy - 22, "Vistas dos ganchos", { key: "gt", s: 10, w: 800, f: F.disp }));
    els.push(R(gx, gy, 250, 190, { key: "gb", w: 0.8, c: THIN }));
    // laje + gancho
    els.push(R(gx + 20, gy + 24, 210, 20, { key: "laje", fill: "url(#vphatch)", w: 0.9 }));
    els.push(React.createElement("circle", { key: "ghc", cx: gx + 125, cy: gy + 48, r: 9, fill: "none", stroke: INK, strokeWidth: 1.6 }));
    els.push(T(gx + 125, gy + 116, `GANCHO SUPERIOR ${mm(CM.ganchoCapacidade)} KG`, { key: "ghl", s: 7.4, a: "middle", w: 700 }));
    els.push(T(gx + 125, gy + 130, "Partes embutidas por conta do Cliente,", { key: "ghl2", s: 6.4, a: "middle", fill: THIN }));
    els.push(T(gx + 125, gy + 139, "após a conclusão da casa de máquinas.", { key: "ghl3", s: 6.4, a: "middle", fill: THIN }));
    els.push(T(gx + 125, gy + 156, "Detalhe A — 2 × 300×150×25 placa de aço", { key: "ghl4", s: 6.6, a: "middle", w: 600 }));
    els.push(T(gx + 125, gy + 170, "A capacidade deve ser marcada no gancho.", { key: "ghl5", s: 6.4, a: "middle", fill: THIN }));

    /* --- requisitos --- */
    const rx2 = AREA.x + 470, ry2 = AREA.y + 360;
    els.push(T(rx2, ry2, "Requisitos da casa de máquinas", { key: "rt", s: 8.5, w: 700, f: F.disp }));
    const reqs = [
      ["Altura livre mínima", "≥ " + mm(CM.alturaLivre) + " mm"],
      ["Carga admissível do piso", "600 kg/m²"],
      ["Temperatura ambiente", "+5 °C a +40 °C"],
      ["Umidade relativa (a 25 °C)", "≤ 85%"],
      ["Iluminância mínima", "200 lux"],
      ["Proteção", "À prova de fogo e de poeira"],
    ];
    reqs.forEach(([k, v], i) => {
      const y = ry2 + 18 + i * 18;
      els.push(T(rx2, y, k, { key: "rk" + i, s: 7.2 }));
      els.push(T(rx2 + 250, y, v, { key: "rv" + i, s: 7.6, a: "end", w: 600 }));
      els.push(L(rx2, y + 5, rx2 + 250, y + 5, { key: "rl" + i, w: 0.4, c: HAIR }));
    });

    return els;
  }

  window.VPFolhasA = { Folha1, Folha2, Folha3, tabela };
})();
