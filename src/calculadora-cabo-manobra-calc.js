/* ============================================================
   calculadora-cabo-manobra-calc.js — Quadros de Comando · Calculadora de Cabos (06/11/2026, pedido do Gelson).
   Regra pura (sem tela, sem banco). window.CaboManobraCalc.
   Portada SEM mudar a conta de CalculadoraCaboManobra.html (arquivo que o Gelson trouxe). Só dois ajustes:
   - os alert() viraram retorno { erro } (a tela mostra o aviso, nada some em silêncio — Art. 9);
   - nada é arredondado antes da hora: a compra é o total arredondado para cima, em metros inteiros.
   Conta: curso (paradas-1 × piso a piso) + overhead K + seio (descida + meia circunferência + subida) + percurso na cabine
   (largura + altura + sobra do topo) + (MRL: margem de travessia | MR: distância do quadro ao furo da laje).
   ATENÇÃO: NÃO é a mesma conta do cabo de manobra do BOM do quadro (quadro-comando-bom-engine.js, montarTrechoCaboManobra,
   calibrada num cabo real: 10 paradas × 3 m = 47 m). Esta dá 45 m para o mesmo caso. Duas contas coexistem até o Gelson decidir qual vale.
   ============================================================ */
(function () {
  'use strict';

  const CABINE_LARGURA_M = 1.50;
  const CABINE_ALTURA_M = 3.00;
  const SOBRA_TOPO_M = 2.00;
  const FOLGA_SEIO_FUNDO_M = 0.15;   // 15 cm do chão do poço

  const PADRAO = { tipo: 'MRL', paradas: 9, pisoAPiso: 3.0, profundidadePoco: 1.5, overhead: 4.5, margemMrl: 2.0, distanciaMr: 4.0 };

  function num(v) { const n = parseFloat(v); return isFinite(n) ? n : 0; }

  // entrada: { tipo: 'MRL'|'MR', paradas, pisoAPiso, profundidadePoco, overhead, margemMrl, distanciaMr } (números ou texto)
  // saída: { ok:true, curso, seio, cabine, extra, extraRotulo, total, comprar } ou { ok:false, erro }
  function calcular(entrada) {
    const e = entrada || {};
    const tipo = e.tipo === 'MR' ? 'MR' : 'MRL';
    const paradas = parseInt(e.paradas, 10) || 0;
    const pisoAPiso = num(e.pisoAPiso);
    const poco = num(e.profundidadePoco);
    const overhead = num(e.overhead);
    const margemMrl = num(e.margemMrl);
    const distanciaMr = num(e.distanciaMr);

    if (paradas < 2) return { ok: false, erro: 'A quantidade de paradas deve ser no mínimo 2.' };
    if (poco <= FOLGA_SEIO_FUNDO_M) return { ok: false, erro: 'A profundidade do poço deve ser maior que a folga do chão (15 cm).' };

    const curso = (paradas - 1) * pisoAPiso;
    const alturaSeio = poco - FOLGA_SEIO_FUNDO_M;
    const curva = (Math.PI * alturaSeio) / 2;            // meia circunferência, raio = alturaSeio / 2
    const seio = 2 * alturaSeio + curva;                 // desce + curva + sobe
    const cabine = CABINE_LARGURA_M + CABINE_ALTURA_M + SOBRA_TOPO_M;

    const extra = tipo === 'MRL' ? margemMrl : distanciaMr;
    const extraRotulo = tipo === 'MRL' ? 'Margem exterior (MRL)' : 'Distância quadro → furo da laje';
    const total = curso + overhead + seio + cabine + extra;
    return { ok: true, tipo, curso, seio, cabine, extra, extraRotulo, total, comprar: Math.ceil(total) };
  }

  window.CaboManobraCalc = { calcular, PADRAO, CABINE_LARGURA_M, CABINE_ALTURA_M, SOBRA_TOPO_M, FOLGA_SEIO_FUNDO_M };
})();
