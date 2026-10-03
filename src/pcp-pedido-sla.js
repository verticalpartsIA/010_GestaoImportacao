/* ============================================================
   pcp-pedido-sla.js — SLA do pedido de venda no fluxo PCP (03/10/2026).
   Marcos: entrada no Omie (etapa 20) → OP criada → produção concluída → NF emitida → despacho.
   Prazos (decisão do usuário): OP em até 1 dia útil da entrada; produção até a previsão do pedido;
   NF em até 1 dia útil após a produção; despacho em até 1 dia útil após a NF.
   Pedido marcado como "histórico" (já entregue antes do sistema) não tem SLA.
   Funções puras; datas como 'AAAA-MM-DD' (fuso local, sem new Date('aaaa-mm-dd')).
   Dia útil = segunda a sexta (feriados não considerados).
   ============================================================ */
(function () {
  const dia = (s) => (s ? String(s).slice(0, 10) : null);
  const paraData = (s) => { const [a, m, d] = dia(s).split('-').map(Number); return new Date(a, m - 1, d); };
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  // Soma n dias úteis (n>=0).
  function somarDiasUteis(s, n) {
    const dt = paraData(s);
    let falta = n;
    while (falta > 0) { dt.setDate(dt.getDate() + 1); const w = dt.getDay(); if (w !== 0 && w !== 6) falta--; }
    return iso(dt);
  }

  // Resultado de uma etapa: { limite, feito, estado } — estado: 'ok' | 'ok_atraso' | 'andamento' | 'atrasada' | 'aguardando'
  function etapa(inicio, limite, feito, hoje) {
    if (!inicio || !limite) return { limite: null, feito: dia(feito), estado: 'aguardando' };
    const f = dia(feito);
    if (f) return { limite, feito: f, estado: f <= limite ? 'ok' : 'ok_atraso' };
    return { limite, feito: null, estado: hoje > limite ? 'atrasada' : 'andamento' };
  }

  // p: { entrada_em, opCriadaEm, producaoPrazo, producaoFeita, nfEm, despachoEm, historico }
  function calcular(p, hoje) {
    if (p.historico) return { historico: true, etapas: null, atrasado: false };
    const entrada = dia(p.entrada_em);
    const op = etapa(entrada, entrada ? somarDiasUteis(entrada, 1) : null, p.opCriadaEm, hoje);
    const prod = etapa(dia(p.opCriadaEm), dia(p.producaoPrazo), p.producaoFeita, hoje);
    const prodFeita = dia(p.producaoFeita);
    const nf = etapa(prodFeita, prodFeita ? somarDiasUteis(prodFeita, 1) : null, p.nfEm, hoje);
    const nfEm = dia(p.nfEm);
    const desp = etapa(nfEm, nfEm ? somarDiasUteis(nfEm, 1) : null, p.despachoEm, hoje);
    const etapas = { op, producao: prod, nf, despacho: desp };
    const atrasado = Object.values(etapas).some(e => e.estado === 'atrasada');
    return { historico: false, etapas, atrasado };
  }

  window.PcpPedidoSLA = { somarDiasUteis, etapa, calcular };
}());
