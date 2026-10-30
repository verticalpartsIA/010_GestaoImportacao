/* ============================================================
   fabricacao-oficina-calc.js — motor puro de progresso/pausa das telas
   Fabricação Corrimão e Fabricação Corte (22/10/2026). Mesmo algoritmo
   do Quadro (fabricacao-quadro-calc.js), mas sobre as linhas planas que
   a RPC public_fab_obter devolve: { id, ordem, texto, peso, flegado }.
   window.FabOficinaCalc
   ============================================================ */
(function () {
  'use strict';

  function ordenadas(etapas) { return [...(etapas || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)); }

  // 100% só com TODAS as etapas feitas e pesos somando 100; antes disso teto 99.
  function progresso(etapas) {
    const o = ordenadas(etapas);
    if (!o.length) return 0;
    const feito = o.reduce((a, e) => a + (e.flegado ? Number(e.peso) || 0 : 0), 0);
    const total = o.reduce((a, e) => a + (Number(e.peso) || 0), 0);
    if (o.every((e) => e.flegado) && total >= 100 - 0.001) return 100;
    return Math.min(99, Math.floor(feito + 0.001));
  }

  function etapaAtualId(etapas) {
    const p = ordenadas(etapas).find((e) => !e.flegado);
    return p ? p.id : null;
  }

  // Pausa só com ocorrência aberta SEM frente de trabalho.
  function pausado(ocorrencias) {
    return (ocorrencias || []).some((o) => o.status === 'aberta' && o.tem_frente_trabalho === false);
  }

  // Unidade da OP: "unidade 2/3" do título, para agrupar por pedido.
  function unidadeDoTitulo(titulo) {
    const m = String(titulo || '').match(/unidade (\d+)\/(\d+)/i);
    return m ? { n: Number(m[1]), de: Number(m[2]) } : null;
  }

  // "Onde está" o item de um pedido (Separação): OPs de Corrimão/Corte (ignora canceladas) + envios a Quadro/Expedição.
  // d = { ops: [{ item_codigo, frente, status }], enviados: [{ codigo, destino }] } (vem de separacao_destinos_listar).
  function localizacaoDoItem(codigo, d) {
    const cod = String(codigo || '').toUpperCase();
    const partes = [];
    const rotulo = { corrimao: 'Corrimão', corte: 'Corte' };
    ['corrimao', 'corte'].forEach((f) => {
      const ops = ((d && d.ops) || []).filter((o) => String(o.item_codigo || '').toUpperCase() === cod && o.frente === f && o.status !== 'cancelada');
      if (!ops.length) return;
      const prontas = ops.filter((o) => o.status === 'concluida').length;
      partes.push(prontas === ops.length ? `${rotulo[f]}: pronto` : `${rotulo[f]}: ${prontas} de ${ops.length} prontas`);
    });
    const env = ((d && d.enviados) || []).filter((e) => String(e.codigo || '').toUpperCase() === cod);
    if (env.some((e) => e.destino === 'quadro')) partes.push('No Quadro de Comando');
    if (env.some((e) => e.destino === 'expedicao')) partes.push('Na Expedição');
    return partes;
  }


  // Fabricação Corte (30/10/2026): só Cabos de Aço, Cintas de Tração e Cabos de Manobra, sempre "código — descrição comercial".
  const CORTE_DESCRICOES = {
    'VPEL-484': ['aco', 'Cabo de Aço de Elevador 6*19S+FC 6MM (1/4 pol)'],
    'VPEL-485': ['aco', 'Cabo de Aço de Elevador 8*19W+IWRC 6MM (1/4 pol)'],
    'VPEL-694': ['aco', 'Cabo de Aço para Elevador 8*19W+IWRC 6MM (1/4 pol)'],
    'VPEL-125': ['aco', 'Cabo de Aço de Elevador 8*19S+FC 8MM (5/16 pol)'],
    'VPEL-692': ['aco', 'Cabo de Aço para Elevador 8*19S+FC 9,5MM (3/8 pol)'],
    'VPEL-229': ['aco', 'Cabo de Aço de Elevador 8*19S+FC 12,7MM (1/2 pol)'],
    'VPEL-693': ['aco', 'Cabo de Aço para Elevador 8*19S+FC 12,7MM (1/2 pol)'],
    'VPEL-046': ['aco', 'Cabo de Aço de Elevador 8*19S+FC 13MM (1/2 pol)'],
    'VPEL-048': ['aco', 'Cabo de Aço de Elevador 8*19S+FC 16MM (5/8 pol)'],
    'SAO_OTAAA717X1': ['cinta', 'CINTA DE TRACAO PLANA 32KN LISA'],
    'VPEL-115': ['cinta', 'Cinta de Tração de Elevador, Largura 30mm, com Ranhuras - Ref.: CCO'],
    'VPEL-233': ['cinta', 'Cinta de Tração de Elevador 3.0x30 32kN, Lisa - Ref.: CCO'],
    'VPEL-234': ['cinta', 'Cinta de Tração de Elevador 3.3x30 43kN, Lisa - Ref.: CCO'],
    'VPEL-234N': ['cinta', 'Cinta de Tração de Elevador 3.3x30 43kN (Nacional), Lisa - Ref.: CCO'],
    'VPEL-482': ['cinta', 'Cinta de Tração de Elevador (30 x 4,5mm) - Ref.: CCS'],
    'VPEL-523': ['cinta', 'Cinta de Tração de Elevador (40 x 4,5mm) - Ref.: CCS'],
    'VPEL-523N': ['cinta', 'Cinta de Tração de Elevador (40 x 4,5mm) (NACIONAL) - Ref.: CCS'],
    'SAO_OT06MB132420': ['manobra', 'CABO DE MANOBRA CHATO'],
    'VPEL-529N': ['manobra', 'Cabo Manobra Elétrico com 23 Vias para Elevador (NACIONAL) - Ref.: DRAKA'],
    'VPB-086': ['manobra', 'Cabo de Comando Elétrico com 24 Vias'],
  };
  const CORTE_ROTULO = { aco: 'Cabo de Aço', cinta: 'Cinta de Tração', manobra: 'Cabo de Manobra' };
  function semAcento(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  // Categoria do item de corte: pelo código do dicionário; senão pelo texto (descrição do cadastro ou título da OP). null = fora do escopo.
  function categoriaCorte(codigo, texto) {
    const d = CORTE_DESCRICOES[String(codigo || '').trim().toUpperCase()];
    if (d) return d[0];
    const t = semAcento(texto);
    if (/cabo\s+de\s+aco|cabo\s+aco/.test(t)) return 'aco';
    if (/cinta\s+de\s+tracao|cinta\s+tracao/.test(t)) return 'cinta';
    if (/cabo\s+(de\s+)?(manobra|comando)/.test(t)) return 'manobra';
    return null;
  }
  // Descrição comercial: dicionário vence; senão a do cadastro (pcp_produtos / catálogo Omie).
  function descricaoCorte(codigo, descCadastro) {
    const d = CORTE_DESCRICOES[String(codigo || '').trim().toUpperCase()];
    return d ? d[1] : (descCadastro ? String(descCadastro) : '');
  }
  // "VPEL-692 — Cabo de Aço para Elevador ..." (só o código se não houver descrição).
  function rotuloItemCorte(codigo, descCadastro) {
    const d = descricaoCorte(codigo, descCadastro);
    return d ? `${codigo} — ${d}` : String(codigo || '');
  }

  window.FabOficinaCalc = { progresso, etapaAtualId, pausado, unidadeDoTitulo, localizacaoDoItem, CORTE_DESCRICOES, CORTE_ROTULO, categoriaCorte, descricaoCorte, rotuloItemCorte };
})();
