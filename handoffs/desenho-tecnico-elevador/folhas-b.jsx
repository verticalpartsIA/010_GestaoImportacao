/* =========================================================
   VerticalParts — Prancha de Instalação
   folhas-b.jsx · Folhas 4-6 (porta, unifilar, especificações)
   ========================================================= */
(function () {
  const P = window.VPPrancha;
  const { T, L, R, CotaH, CotaV, AREA, F, INK, THIN, HAIR, wrap } = P;
  const { mm, or, num, up, SIGLAS, NOTAS_OBRA } = window.VPDados;
  const { tabela } = window.VPFolhasA;

  /* ================= FOLHA 4 · PORTA DE PAVIMENTO ================= */
  function Folha4(d) {
    const els = [];
    const SOW = num(d.portas.soleiraLargura, 1000), SOH = num(d.portas.soleiraAltura, 2200);
    const OP = num(d.portas.largura, 800), OPH = num(d.portas.altura, 2100);
    const H_LOP = 1300, H_FIRE = 1700, ESTRUT = 200, OFFSET = 300;
    const s = 0.168;

    const wallX = AREA.x + 104, wallW = 360;
    const sowPx = SOW * s, sohPx = SOH * s;
    const ox = wallX + (wallW - sowPx) / 2, yBase = AREA.y + 520;

    els.push(T(AREA.x + 14, AREA.y + 22, "Layout dos furos dos andares", { key: "t", s: 10, w: 800, f: F.disp }));
    els.push(T(AREA.x + 14, AREA.y + 34, "Vista frontal da abertura de pavimento — dimensões em mm",
      { key: "t2", s: 7, fill: THIN }));

    // parede
    els.push(R(wallX, yBase - sohPx - ESTRUT * s - 30, wallW, sohPx + ESTRUT * s + 38, { key: "wall", fill: "url(#vphatch)", w: 1 }));
    // vão da porta (limpo)
    els.push(R(ox, yBase - sohPx, sowPx, sohPx, { key: "op", fill: "#fff", w: 1.5 }));
    // camada estrutural
    const cey = yBase - sohPx - ESTRUT * s;
    els.push(R(ox - 20, cey, sowPx + 40, ESTRUT * s, { key: "estr", fill: "#E4E2DB", w: 1 }));
    els.push(L(ox + sowPx + 22, cey + ESTRUT * s / 2, wallX + wallW + 14, cey + ESTRUT * s / 2, { key: "estrll", w: 0.5, c: HAIR, d: "3 2" }));
    els.push(T(wallX + wallW + 18, cey + ESTRUT * s / 2 + 3, "Camada estrutural · " + mm(ESTRUT), { key: "estrl", s: 7, w: 600 }));

    // folhas da porta
    const central = /central/i.test(String(d.portas.tipoAbertura || ""));
    const opPx = OP * s, ophPx = OPH * s;
    const opx = ox + (sowPx - opPx) / 2;
    els.push(R(opx, yBase - ophPx, opPx, ophPx, { key: "leaf", w: 1.1, c: THIN, d: "5 3" }));
    if (central) els.push(L(opx + opPx / 2, yBase - ophPx, opx + opPx / 2, yBase, { key: "lf", w: 1 }));
    els.push(T(ox + sowPx / 2, yBase - ophPx / 2, up(d.portas.tipoAbertura), { key: "lfl", s: 7.4, a: "middle", w: 700, fill: THIN }));

    // soleira
    els.push(R(ox, yBase, sowPx, 7, { key: "sill", fill: INK, c: null }));
    els.push(T(ox + sowPx / 2, yBase + 48, "SOLEIRA — espessura externa máx. 85 mm", { key: "silll", s: 6.6, a: "middle", fill: THIN }));
    els.push(L(wallX, yBase + 7, wallX + wallW, yBase + 7, { key: "floor", w: 1.4 }));

    // furos
    const holeX = ox + sowPx + OFFSET * s * 0.5;
    const callX = wallX + wallW + 18;
    const hy = yBase - H_LOP * s, fyy = yBase - H_FIRE * s;
    [[hy, "Furo para botoeira de pavimento", "(apenas para botoeiras externas sem fundo)", "lop"],
     [fyy, "Furo para caixa de incêndio", "(somente em estações de nível básico)", "fire"]]
      .forEach(([y, t1, t2, k]) => {
        els.push(React.createElement("circle", { key: k, cx: holeX, cy: y, r: 6, fill: "#fff", stroke: INK, strokeWidth: 1.2 }));
        els.push(L(holeX + 7, y, callX - 4, y, { key: k + "ld", w: 0.4, c: HAIR, d: "3 2" }));
        els.push(T(callX, y - 5, "Ø40", { key: k + "d", s: 7.4, w: 700 }));
        els.push(T(callX, y + 5, t1, { key: k + "l", s: 6.6 }));
        els.push(T(callX, y + 14, t2, { key: k + "l2", s: 6, fill: THIN }));
      });

    // cotas
    els.push(CotaH(ox, ox + sowPx, yBase - sohPx - ESTRUT * s - 14, "SOW " + mm(SOW), { key: "csow", s: 9 }));
    els.push(CotaV(yBase - sohPx, yBase, wallX - 18, "SOH " + mm(SOH), { key: "csoh", ext: [ox, wallX - 18], s: 9 }));
    els.push(CotaV(yBase - ophPx, yBase, wallX - 48, "OPH " + mm(OPH), { key: "coph", ext: [opx, wallX - 48], s: 8 }));
    els.push(CotaH(opx, opx + opPx, yBase + 34, "OP " + mm(OP), { key: "cop2", ext: [yBase, yBase + 34], s: 8 }));
    els.push(CotaV(hy, yBase, callX + 232, mm(H_LOP), { key: "clop", ext: [callX + 200, callX + 232], s: 7.6 }));
    els.push(CotaV(fyy, yBase, callX + 262, mm(H_FIRE), { key: "cfire", ext: [callX + 200, callX + 262], s: 7.6 }));

    // notas
    const nx = AREA.x + 14, ny = AREA.y + 606;
    const notas = [
      "Se a caixa adotar estrutura de tijolo e concreto, devem ser previstas vigas ou vigas de anel.",
      "A camada estrutural deve envolver todo o perímetro da abertura de pavimento.",
      "Os furos Ø40 são executados pelo Cliente antes do acabamento final.",
      `Estrutura da caixa especificada: ${or(d.caixa.tipoEstrutura, "--")}.`,
      `Classe corta-fogo da porta: ${or(d.portas.classeCortaFogo, "--")}.`,
    ];
    els.push(T(nx, ny, "Observações", { key: "nt", s: 8.5, w: 700, f: F.disp }));
    let cy2 = ny + 15;
    notas.forEach((n, i) => {
      els.push(T(nx, cy2, "·", { key: "nb" + i, s: 8, w: 700, fill: THIN }));
      wrap(n, 92).forEach((ln, li) => els.push(T(nx + 9, cy2 + li * 8, ln, { key: `nl${i}_${li}`, s: 6.8 })));
      cy2 += wrap(n, 92).length * 8 + 3;
    });

    // tabela de acabamentos
    const tb = tabela(AREA.x + 404, AREA.y + 596, [
      { t: "Item", w: 140 }, { t: "Especificação", w: 160 },
    ], [
      ["Modelo de porta", or(d.portas.modelo, "--")],
      ["Tipo de abertura", or(d.portas.tipoAbertura, "--")],
      ["Acab. porta cabina", or(d.portas.acabCabina, "--")],
      ["Acab. porta pavimento", or(d.portas.acabPavimento, "--")],
      ["Classe corta-fogo", or(d.portas.classeCortaFogo, "--")],
      ["Botoeira de pavimento", or(d.botoeiras.lop, "--")],
    ], { key: "tabporta", hr: 17 });
    els.push(tb.els);
    els.push(T(AREA.x + 404, AREA.y + 588, "Portas — especificação", { key: "tpt", s: 8.5, w: 700, f: F.disp }));

    return els;
  }

  /* ================= FOLHA 5 · DIAGRAMA UNIFILAR ================= */
  function Folha5(d) {
    const els = [], E = d.eletrico;

    els.push(T(AREA.x + 14, AREA.y + 22, "Diagrama unifilar", { key: "t", s: 10, w: 800, f: F.disp }));
    els.push(T(AREA.x + 14, AREA.y + 34, "Alimentação e proteção — fornecimento do Cliente até o quadro do elevador",
      { key: "t2", s: 7, fill: THIN }));

    const cx = AREA.x + 200, top = AREA.y + 80;

    // rede
    els.push(T(cx, top, "VEM DA REDE", { key: "rede", s: 8.6, a: "middle", w: 700 }));
    els.push(T(cx, top + 12, `${or(E.tensaoPrincipal, "--")}  ·  ${or(E.fases, "--")}`, { key: "rede2", s: 7.4, a: "middle", fill: THIN }));
    els.push(L(cx, top + 20, cx, top + 52, { key: "l0", w: 1.4 }));
    // marcas de condutores (3F+N+PE)
    [0, 1, 2].forEach(i => els.push(L(cx - 7, top + 30 + i * 5, cx + 7, top + 26 + i * 5, { key: "cm" + i, w: 0.9 })));
    els.push(T(cx + 14, top + 36, "3F + N + PE", { key: "cml", s: 6.4, fill: THIN }));

    // QDG
    const qw = 300, qh = 46, qx = cx - 60, qy = top + 52;
    els.push(R(qx, qy, qw, qh, { key: "qdg", w: 1.4, fill: "#F4F3EE" }));
    els.push(T(qx + 10, qy + 20, "QDG DO CLIENTE", { key: "qdgl", s: 9.5, w: 800, f: F.disp }));
    els.push(T(qx + 10, qy + 34, "Quadro de distribuição geral — barramento", { key: "qdgl2", s: 6.8, fill: THIN }));
    els.push(L(cx, qy, cx, qy, { key: "lq" }));

    // barramento
    const busY = qy + qh + 34;
    els.push(L(qx + 30, busY, qx + qw - 30, busY, { key: "bus", w: 2 }));
    els.push(L(cx, qy + qh, cx, busY, { key: "lbus", w: 1.4 }));

    // ramais
    const ramais = [
      { x: qx + 80, nome: "Elevador " + or(d.equipamento.identificador, "1").replace(/^E/i, ""),
        disj: or(E.disjuntorForca, "--"), pot: or(E.potenciaMotor, "--"), sec: or(E.secaoForca, "--"),
        polos: 3, obs: "Alimentação de força — " + or(E.controle, "--") },
      { x: qx + qw - 80, nome: "Iluminação " + or(d.equipamento.identificador, "1").replace(/^E/i, ""),
        disj: or(E.disjuntorIluminacao, "--"), pot: or(E.potenciaIluminacao, "--"), sec: or(E.secaoIluminacao, "--"),
        polos: 1, obs: "Iluminação de cabina e poço" },
    ];
    ramais.forEach((r, i) => {
      const bx = r.x;
      els.push(L(bx, busY, bx, busY + 30, { key: "rl" + i, w: 1.2 }));
      // disjuntor
      els.push(L(bx, busY + 30, bx + 11, busY + 44, { key: "dj" + i, w: 1.4 }));
      els.push(React.createElement("circle", { key: "djc" + i, cx: bx, cy: busY + 30, r: 2, fill: INK }));
      for (let p = 1; p < r.polos; p++)
        els.push(L(bx + p * 6, busY + 30, bx + 11 + p * 6, busY + 44, { key: `dj${i}_${p}`, w: 1.4, c: THIN }));
      if (r.polos > 1) els.push(L(bx + 5, busY + 37, bx + (r.polos - 1) * 6 + 6, busY + 37, { key: "djt" + i, w: 0.7, d: "2 2" }));
      els.push(T(bx - 8, busY + 40, r.disj, { key: "djl" + i, s: 8, a: "end", w: 700 }));
      els.push(L(bx, busY + 44, bx, busY + 86, { key: "rl2" + i, w: 1.2 }));
      // seção
      els.push(L(bx - 6, busY + 62, bx + 6, busY + 56, { key: "sec" + i, w: 0.9 }));
      els.push(T(bx + 10, busY + 62, r.sec, { key: "secl" + i, s: 7.4, w: 600 }));
      // carga
      els.push(R(bx - 52, busY + 86, 104, 44, { key: "cg" + i, w: 1.2 }));
      els.push(T(bx, busY + 103, r.nome, { key: "cgl" + i, s: 9, a: "middle", w: 800, f: F.disp }));
      els.push(T(bx, busY + 116, "Pot.: " + r.pot, { key: "cgp" + i, s: 7.6, a: "middle", w: 600 }));
      els.push(T(bx, busY + 126, r.polos > 1 ? "Corrente: " + or(E.correnteNominal, "--") : "—", { key: "cgc" + i, s: 6.6, a: "middle", fill: THIN }));
      els.push(T(bx, busY + 164, r.obs, { key: "cgo" + i, s: 6.6, a: "middle", fill: THIN }));
      // aterramento
      els.push(L(bx, busY + 130, bx, busY + 140, { key: "at" + i, w: 1 }));
      [0, 1, 2].forEach(k => els.push(L(bx - 7 + k * 2.4, busY + 140 + k * 3, bx + 7 - k * 2.4, busY + 140 + k * 3, { key: `atl${i}_${k}`, w: 1 })));
    });

    /* --- legenda --- */
    const lx = AREA.x + 470, ly = AREA.y + 90;
    els.push(R(lx, ly, 272, 200, { key: "lgb", w: 0.9, c: THIN }));
    els.push(T(lx + 10, ly + 18, "LEGENDA", { key: "lgt", s: 8.4, w: 800, f: F.disp, ls: "0.06em" }));
    els.push(L(lx + 10, ly + 24, lx + 262, ly + 24, { key: "lgl", w: 0.6 }));
    const leg = [
      { n: 1, t: "Disjuntor termomagnético monopolar" },
      { n: 2, t: "Disjuntor termomagnético bipolar" },
      { n: 3, t: "Disjuntor termomagnético tripolar" },
      { n: 0, t: "Condutores fase, neutro e terra" },
      { n: -1, t: "Aterramento" },
    ];
    leg.forEach((g, i) => {
      const y = ly + 44 + i * 30, sx = lx + 22;
      if (g.n > 0) {
        for (let p = 0; p < g.n; p++) {
          els.push(L(sx + p * 6, y - 8, sx + 9 + p * 6, y + 4, { key: `lgs${i}_${p}`, w: 1.3 }));
          els.push(React.createElement("circle", { key: `lgc${i}_${p}`, cx: sx + p * 6, cy: y - 8, r: 1.6, fill: INK }));
        }
        if (g.n > 1) els.push(L(sx + 4, y - 2, sx + (g.n - 1) * 6 + 5, y - 2, { key: "lgt2" + i, w: 0.6, d: "2 2" }));
      } else if (g.n === 0) {
        els.push(L(sx - 2, y - 2, sx + 16, y - 2, { key: "lgw" + i, w: 1.2 }));
        [0, 1, 2].forEach(k => els.push(L(sx + 2 + k * 5, y - 8, sx + 8 + k * 5, y + 2, { key: `lgw${i}_${k}`, w: 0.9 })));
      } else {
        els.push(L(sx + 7, y - 10, sx + 7, y - 2, { key: "lga" + i, w: 1.1 }));
        [0, 1, 2].forEach(k => els.push(L(sx - k * 2.2, y - 2 + k * 3, sx + 14 + k * 2.2 - k * 4.4, y - 2 + k * 3, { key: `lgab${i}_${k}`, w: 1 })));
      }
      els.push(T(lx + 62, y, g.t, { key: "lgtx" + i, s: 7.2 }));
    });

    /* --- dados elétricos --- */
    const tb = tabela(AREA.x + 470, AREA.y + 330, [
      { t: "Grandeza", w: 156 }, { t: "Valor", w: 116 },
    ], [
      ["Tensão principal", or(E.tensaoPrincipal, "--")],
      ["Tensão de iluminação", or(E.tensaoIluminacao, "--")],
      ["Sistema", or(E.fases, "--")],
      ["Potência do motor", or(E.potenciaMotor, "--")],
      ["Corrente nominal", or(E.correnteNominal, "--")],
      ["Controle", or(E.controle, "--")],
      ["Variação de tensão", "±7%"],
    ], { key: "tabelet", hr: 17 });
    els.push(tb.els);
    els.push(T(AREA.x + 470, AREA.y + 322, "Dados elétricos", { key: "tet", s: 8.5, w: 700, f: F.disp }));

    els.push(T(AREA.x + 14, AREA.y + 700, "O Cliente é responsável por levar os condutores de alimentação até a caixa de energia do elevador,",
      { key: "fn1", s: 6.8, fill: THIN }));
    els.push(T(AREA.x + 14, AREA.y + 710, "reservando 3 m de cabo com marcação adicional. Altura do comando: 1600 mm do piso.",
      { key: "fn2", s: 6.8, fill: THIN }));

    return els;
  }

  /* ================= FOLHA 6 · ESPECIFICAÇÕES ================= */
  function Folha6(d) {
    const els = [], D = d.derivado, E = d.eletrico;

    /* --- siglas --- */
    els.push(T(AREA.x + 14, AREA.y + 22, "Siglas e abreviações", { key: "st", s: 10, w: 800, f: F.disp }));
    const half = Math.ceil(SIGLAS.length / 2);
    const sgRows = [];
    for (let i = 0; i < half; i++) {
      const a = SIGLAS[i] || ["", ""], b = SIGLAS[i + half] || ["", ""];
      sgRows.push([a[0], a[1], b[0], b[1]]);
    }
    const tSg = tabela(AREA.x + 14, AREA.y + 30, [
      { t: "Código", w: 48 }, { t: "Significado", w: 292, wrap: 22 },
      { t: "Código", w: 48 }, { t: "Significado", w: 292, wrap: 22 },
    ], sgRows, { key: "tabsiglas", hr: 14, hh: 18 });
    els.push(tSg.els);

    /* --- especificações técnicas --- */
    const ey = AREA.y + 30 + tSg.h + 26;
    els.push(T(AREA.x + 14, ey - 8, "Especificações técnicas", { key: "et", s: 10, w: 800, f: F.disp }));
    const espec = [
      ["MODELO", or(d.equipamento.modelo, "--")],
      ["TIPO", or(d.equipamento.tipo, "--")],
      ["CAPACIDADE", D.capacidade],
      ["VELOCIDADE", D.velocidade],
      ["PARADAS / PISOS", `${D.paradas} / ${D.pisos}`],
      ["TIPO DE ABERTURA DE PORTA", or(d.portas.tipoAbertura, "--")],
      ["TAMANHO DA ABERTURA DA PORTA", D.tamanhoPorta],
      ["TAMANHO DA CABINE", D.tamanhoCabina],
      ["CASA DE MÁQUINAS", or(d.equipamento.casaDeMaquinas, "--")],
      ["AGRUPAMENTO", or(d.equipamento.agrupamento, "--")],
      ["MODELO DO MOTOR", or(E.modeloMotor, "--")],
      ["POTÊNCIA DO MOTOR", or(E.potenciaMotor, "--")],
      ["CORRENTE NOMINAL", or(E.correnteNominal, "--")],
      ["CONTROLE", or(E.controle, "--")],
      ["EFEITO DE TRAÇÃO", or(E.efeitoTracao, "--")],
      ["FONTE DE ALIMENTAÇÃO", or(E.tensaoPrincipal, "--")],
      ["ALIMENTAÇÃO DE SINAL E ILUMINAÇÃO", or(E.tensaoIluminacao, "--")],
      ["SEÇÃO DOS CABOS DE ALIMENTAÇÃO", or(E.secaoForca, "--")],
      ["SEÇÃO DOS CABOS DE ILUMINAÇÃO", or(E.secaoIluminacao, "--")],
      ["NORMA DE PROJETO", or(d.equipamento.normaProjeto, "--")],
      ["PERCURSO MÁXIMO", or(d.engenharia.percursoMaximo, "--")],
      ["N.º MÁXIMO DE PAVIMENTOS", or(d.engenharia.pavimentosMaximo, "--")],
    ];
    const tEs = tabela(AREA.x + 14, ey, [
      { t: "Grandeza", w: 216 }, { t: "Valor", w: 158 },
    ], espec, { key: "tabespec", hr: 15, hh: 18 });
    els.push(tEs.els);

    // opcionais
    const opc = [];
    if (d.opcionais.ard) opc.push("ARD — resgate automático");
    if (d.opcionais.camera) opc.push("Câmera na cabine");
    if (d.opcionais.anuncioVoz) opc.push("Anúncio de voz");
    const oy2 = ey + tEs.h + 14;
    els.push(T(AREA.x + 14, oy2, "Opcionais: " + (opc.length ? opc.join("  ·  ") : "nenhum"), { key: "opc", s: 7.2, w: 600 }));
    if (d.opcionais.exigenciasEspeciais)
      wrap("Exigências especiais: " + d.opcionais.exigenciasEspeciais, 62).forEach((ln, i) =>
        els.push(T(AREA.x + 14, oy2 + 12 + i * 8.4, ln, { key: "exe" + i, s: 6.8, fill: THIN })));

    /* --- notas de obra --- */
    const nx = AREA.x + 410, ny = ey - 8;
    els.push(T(nx, ny, "A obra será executada pelo usuário e pela empreiteira", { key: "nt", s: 8.6, w: 800, f: F.disp }));
    let cy2 = ny + 16;
    NOTAS_OBRA.forEach((n, i) => {
      const lines = wrap(n, 62);
      els.push(T(nx, cy2, String(i + 1) + ".", { key: "nn" + i, s: 6.4, w: 700, fill: THIN }));
      lines.forEach((ln, li) => els.push(T(nx + 14, cy2 + li * 7.4, ln, { key: `nl${i}_${li}`, s: 6.4 })));
      cy2 += lines.length * 7.4 + 3.6;
    });

    return els;
  }

  window.VPFolhasB = { Folha4, Folha5, Folha6 };
})();
