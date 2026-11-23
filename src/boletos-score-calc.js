/* ============================================================
   boletos-score-calc.js — Financeiro & Preços › Boletos Avisos › Consulta de cliente (regra pura).
   Classifica o cliente em A–D a partir do histórico de pagamento (visão boletos_avisos_score_v) e
   monta o conselho para o financeiro. Também monta os períodos Passado/Presente/Futuro do card
   "Índice de inadimplência" e calcula o índice a partir dos totais devolvidos por boletos_avisos_indice().

   Os limites moram na tabela boletos_avisos_score_config (editável só pelos 3 fixos); os valores abaixo
   são o padrão proposto em 17/11/2026 e o que a tela usa se a configuração não puder ser lida.
   "Vencido" = vencimento ANTERIOR a hoje (vence hoje ainda não é atraso). Dia = data de Brasília (AAAA-MM-DD).
   ============================================================ */
window.BoletosScoreCalc = (() => {
  const CONFIG_PADRAO = {
    tolerancia_dias: 0,          // pago até N dias depois do vencimento ainda conta como "em dia" (aplicado no banco)
    minimo_titulos: 3,           // menos títulos vencidos que isto = sem histórico suficiente
    pontualidade_a: 90,          // % de títulos pagos em dia
    pontualidade_b: 75,
    pontualidade_c: 50,
    atraso_max_a: 15,            // maior atraso (dias) tolerado na classe A
    atraso_medio_b: 10,          // atraso médio (dias) tolerado na classe B
    atraso_max_b: 30,            // acima disto no histórico o cliente cai para C
    aberto_vencido_d: 30,        // título vencido em aberto há mais de N dias = classe D
  };

  const CLASSES = {
    A: { rotulo: 'A · Bom pagador', cor: '#16a34a' },
    B: { rotulo: 'B · Bom pagador com atrasos pontuais', cor: '#65a30d' },
    C: { rotulo: 'C · Atenção', cor: '#d97706' },
    D: { rotulo: 'D · Alto risco', cor: '#dc2626' },
    N: { rotulo: 'Sem histórico suficiente', cor: '#6b7280' },
  };

  const num = (v) => Number(v || 0);
  const arred1 = (v) => Math.round(v * 10) / 10;

  /* Junta o padrão com o que veio do banco, ignorando valor vazio ou não numérico. */
  function mesclarConfig(cfg) {
    const out = { ...CONFIG_PADRAO };
    for (const k of Object.keys(CONFIG_PADRAO)) {
      if (cfg && cfg[k] !== null && cfg[k] !== undefined && cfg[k] !== '' && Number.isFinite(Number(cfg[k]))) out[k] = Number(cfg[k]);
    }
    return out;
  }

  /* Títulos vencidos = pagos em dia + pagos com atraso + vencidos ainda em aberto. */
  function pontualidade(r) {
    const total = num(r.pagos_em_dia) + num(r.pagos_atrasados) + num(r.abertos_vencidos);
    return total > 0 ? arred1((num(r.pagos_em_dia) / total) * 100) : null;
  }

  function classificar(r, cfg) {
    const c = mesclarConfig(cfg);
    const vencidos = num(r.pagos_em_dia) + num(r.pagos_atrasados) + num(r.abertos_vencidos);
    const pont = pontualidade(r);
    const maior = num(r.maior_atraso_dias);
    const medio = num(r.atraso_medio_dias);
    const abertoDias = num(r.aberto_vencido_dias_max);
    const abertos = num(r.abertos_vencidos);
    const motivos = [];
    let classe, conselho;

    if (vencidos < c.minimo_titulos) {
      classe = 'N';
      motivos.push(`só ${vencidos} título(s) vencido(s) no histórico (mínimo ${c.minimo_titulos})`);
      conselho = 'Cliente novo ou com pouco histórico: não dá para dizer se é bom pagador. Consulte o score externo no Aval Financeiro e prefira entrada ou pagamento à vista na primeira compra.';
    } else if (pont < c.pontualidade_c || abertoDias > c.aberto_vencido_d) {
      classe = 'D';
      if (pont < c.pontualidade_c) motivos.push(`pontualidade de ${pont}% (abaixo de ${c.pontualidade_c}%)`);
      if (abertoDias > c.aberto_vencido_d) motivos.push(`tem título vencido em aberto há ${abertoDias} dias (limite ${c.aberto_vencido_d})`);
      conselho = 'Alto risco: só vender à vista ou com pagamento antecipado. Antes de qualquer prazo, fale com a Juliana.';
    } else if (pont >= c.pontualidade_a && maior <= c.atraso_max_a && abertos === 0) {
      classe = 'A';
      motivos.push(`pontualidade de ${pont}%`, `maior atraso de ${maior} dia(s)`, 'nada vencido em aberto');
      conselho = 'Bom pagador: pode liberar a compra nas condições normais.';
    } else if (pont >= c.pontualidade_b && medio <= c.atraso_medio_b && maior <= c.atraso_max_b) {
      classe = 'B';
      motivos.push(`pontualidade de ${pont}%`, `atraso médio de ${medio} dia(s)`);
      if (abertos > 0) motivos.push(`${abertos} título(s) vencido(s) em aberto`);
      conselho = 'Bom pagador com atrasos pontuais: pode liberar, mas acompanhe o vencimento e cobre cedo.';
    } else {
      classe = 'C';
      if (pont < c.pontualidade_b) motivos.push(`pontualidade de ${pont}% (abaixo de ${c.pontualidade_b}%)`);
      if (medio > c.atraso_medio_b) motivos.push(`atraso médio de ${medio} dias (limite ${c.atraso_medio_b})`);
      if (maior > c.atraso_max_b) motivos.push(`já atrasou ${maior} dias`);
      if (!motivos.length) motivos.push('fora dos limites das classes A e B');
      conselho = 'Atenção: peça sinal maior ou reduza o prazo. Confira se há título em aberto antes de liberar.';
    }
    return { classe, rotulo: CLASSES[classe].rotulo, cor: CLASSES[classe].cor, conselho, motivos, pontualidade: pont, titulosVencidos: vencidos };
  }

  /* ---- períodos do card (datas AAAA-MM-DD, inclusive nas duas pontas) ---- */
  function somarDias(iso, n) {
    const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400000);
    return d.toISOString().slice(0, 10);
  }
  function primeiroDoMes(iso) { return iso.slice(0, 8) + '01'; }
  function ultimoDoMes(iso) {
    const prox = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7), 1);   // 1º do mês seguinte
    return new Date(prox - 86400000).toISOString().slice(0, 10);
  }

  const PRESETS = {
    passado: [['30d', 'Últimos 30 dias'], ['90d', 'Últimos 90 dias'], ['mes', 'Mês passado'], ['ano', 'Ano até ontem']],
    presente: [['mes', 'Mês atual']],
    futuro: [['30d', 'Próximos 30 dias'], ['60d', 'Próximos 60 dias'], ['90d', 'Próximos 90 dias'], ['mes', 'Até o fim do mês']],
  };

  function periodo(modo, preset, hojeISO) {
    if (modo === 'presente') return { modo, preset: 'mes', de: primeiroDoMes(hojeISO), ate: hojeISO };
    if (modo === 'futuro') {
      const de = somarDias(hojeISO, 1);
      const dias = { '30d': 30, '60d': 60, '90d': 90 }[preset];
      if (preset === 'mes') return { modo, preset, de, ate: ultimoDoMes(hojeISO) < de ? de : ultimoDoMes(hojeISO) };
      return { modo, preset: dias ? preset : '30d', de, ate: somarDias(hojeISO, dias || 30) };
    }
    const ontem = somarDias(hojeISO, -1);
    if (preset === '90d') return { modo: 'passado', preset, de: somarDias(hojeISO, -90), ate: ontem };
    if (preset === 'mes') {
      const fimMesPassado = somarDias(primeiroDoMes(hojeISO), -1);
      return { modo: 'passado', preset, de: primeiroDoMes(fimMesPassado), ate: fimMesPassado };
    }
    if (preset === 'ano') {
      // em 1º de janeiro "ontem" é do ano anterior: o período vira o ano anterior inteiro, nunca invertido
      const ano = ontem.slice(0, 4) === hojeISO.slice(0, 4) ? hojeISO.slice(0, 4) : ontem.slice(0, 4);
      return { modo: 'passado', preset, de: ano + '-01-01', ate: ontem };
    }
    return { modo: 'passado', preset: '30d', de: somarDias(hojeISO, -30), ate: ontem };
  }

  /* Calendário livre (18/11/2026, pedido do Gelson): o usuário escolhe o início e o fim. Devolve { de, ate, erro }.
     O índice olha só o que já venceu (antes de hoje); o que vence de hoje em diante entra em "A vencer" (o banco separa). */
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  function dataValida(s) {
    if (!ISO.test(String(s || ''))) return false;
    const d = new Date(s + 'T12:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }
  function intervalo(de, ate) {
    if (!dataValida(de) || !dataValida(ate)) return { de, ate, erro: 'Escolha a data de início e a de fim.' };
    if (de > ate) return { de, ate, erro: 'A data de início é depois da data de fim.' };
    return { de, ate, erro: null };
  }
  /* Atalhos do calendário (preenchem início e fim; depois dá para mexer nas datas à mão). */
  function atalhos(hojeISO) {
    const p = (m, pr) => periodo(m, pr, hojeISO);
    const lista = [
      ['30d', 'Últimos 30 dias', p('passado', '30d')],
      ['90d', 'Últimos 90 dias', p('passado', '90d')],
      ['mes_passado', 'Mês passado', p('passado', 'mes')],
      ['mes_atual', 'Mês atual', p('presente', 'mes')],
      ['prox30', 'Próximos 30 dias', p('futuro', '30d')],
      ['ano', 'Ano até ontem', p('passado', 'ano')],
    ];
    return lista.map(([id, rotulo, per]) => ({ id, rotulo, de: per.de, ate: per.ate }));
  }

  /* Totais vêm de boletos_avisos_indice(): valores em reais.
     índice = vencido ainda em aberto ÷ total que venceu no período. Sem nada vencido não há índice (null). */
  function indice(t) {
    const vencido = num(t && t.vencido_valor);
    const aberto = num(t && t.vencido_aberto_valor);
    return {
      pct: vencido > 0 ? arred1((aberto / vencido) * 100) : null,
      vencido, aberto,
      pagoEmDia: num(t && t.pago_em_dia_valor),
      pagoAtrasado: num(t && t.pago_atrasado_valor),
      aVencer: num(t && t.a_vencer_valor),
      titulos: num(t && t.titulos), clientes: num(t && t.clientes),
      titulosAVencer: num(t && t.a_vencer_titulos), clientesAVencer: num(t && t.a_vencer_clientes),
    };
  }

  return { CONFIG_PADRAO, CLASSES, PRESETS, mesclarConfig, pontualidade, classificar, periodo, intervalo, atalhos, dataValida, indice, somarDias };
})();
