/* ============================================================
   evolucao-equipamentos-calc.js — regras puras da "Evolução dos
   equipamentos" (2ª aba do Mapa de Obras, 19/10/2026).
   Monta a linha do tempo de UM equipamento a partir de dados que já existem:
     - dossier_obra (abertura, fase, equipamento entregue)
     - equipamentos_obra (previsões e datas reais por nº de série)
     - embarques_importacao da cotação (saída da fábrica, chegada a Santos, entrega)
     - acompanhamento_obra_status (Diário de Obra: início e marcos 50/75/100%)
   Cada etapa sai como 'feito' (data real), 'previsto' (data prevista),
   'pendente' (sem data) ou 'pulado' (não se aplica / fase já passou sem data).
   Nada é inventado: etapa sem data fica sem data.
   window.EvolucaoEquipamentosCalc
   ============================================================ */
(function () {
  'use strict';

  const ETAPAS = [
    { key: 'aberta',   rotulo: 'Obra aberta' },
    { key: 'embarque', rotulo: 'Saiu da fábrica' },
    { key: 'porto',    rotulo: 'Chegou ao Brasil' },
    { key: 'obra',     rotulo: 'Chegou na obra' },
    { key: 'inicio',   rotulo: 'Instalação iniciada' },
    { key: 'm50',      rotulo: '50% instalado' },
    { key: 'm75',      rotulo: '75% instalado' },
    { key: 'fim',      rotulo: 'Instalação concluída' },
    { key: 'entrega',  rotulo: 'Entregue ao cliente' },
  ];
  const FASES_ENTREGUE = ['DataBook', 'Entregue', 'Manutenção preventiva'];

  /* 'aaaa-mm-dd' puro é data local (não UTC, senão vira o dia anterior no Brasil). */
  function paraData(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    const s = String(v);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
    return isNaN(d) ? null : d;
  }
  function inicioDoDia(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

  /* Uma data "real" no futuro é tratada como previsão (ex.: ETA de embarque ainda por vir). */
  function etapa(key, real, prevista, hoje) {
    const r = paraData(real), p = paraData(prevista);
    if (r && inicioDoDia(r) <= hoje) return { key, estado: 'feito', data: r };
    if (r) return { key, estado: 'previsto', data: r };
    if (p) return { key, estado: 'previsto', data: p };
    return { key, estado: 'pendente', data: null };
  }

  /* Embarque mais recente da cotação (o que ainda vale). */
  function escolherEmbarque(lista) {
    const ok = (lista || []).filter((e) => e && !e.arquivado);
    if (!ok.length) return null;
    return ok.slice().sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))[0];
  }

  /**
   * @param d   dossier_obra
   * @param eq  equipamentos_obra (ou null quando o dossiê não tem equipamento cadastrado)
   * @param ctx { embarque, progresso: {pct, iniciadoEm, marcos:[{label,completo,dataConclusao}]}, hoje }
   */
  function montarLinha(d, eq, ctx) {
    ctx = ctx || {};
    const hoje = inicioDoDia(ctx.hoje || new Date());
    const e = eq || {};
    const emb = ctx.embarque || {};
    const prog = ctx.progresso || { pct: 0, marcos: [], iniciadoEm: null };
    const marco = (lbl) => (prog.marcos || []).find((m) => m.label === lbl) || {};
    const entregueNaObra = !!(d && d.equipamento_entregue);

    /* Toda obra desta tela já tem contrato assinado: "Obra aberta" está sempre feita (a data é a de criação do dossiê, quando existe). */
    const passos = [{ key: 'aberta', estado: 'feito', data: paraData(d && d.created_at) }];

    const embarque = etapa('embarque', emb.etd_atual || emb.etd_original, null, hoje);
    const porto = etapa('porto', emb.eta_santos, null, hoje);
    const obra = etapa('obra', e.chegada_real_material || (d && d.equipamento_entregue_em) || emb.data_entrega,
      e.previsao_chegada_material || emb.data_limite_entrega, hoje);
    if (obra.estado !== 'feito' && entregueNaObra) { obra.estado = 'feito'; obra.data = obra.data && obra.data <= hoje ? obra.data : null; }

    const inicio = etapa('inicio', e.data_real_inicio || prog.iniciadoEm, e.previsao_inicio, hoje);
    const m50 = etapa('m50', marco('50%').completo ? marco('50%').dataConclusao : null, null, hoje);
    const m75 = etapa('m75', marco('75%').completo ? marco('75%').dataConclusao : null, null, hoje);
    const fim = etapa('fim', e.data_real_termino || (marco('100%').completo ? marco('100%').dataConclusao : null), e.previsao_termino, hoje);
    const fase = String((d && d.status_master) || '').trim();
    const entrega = { key: 'entrega', estado: FASES_ENTREGUE.includes(fase) ? 'feito' : 'pendente', data: null };

    /* Se uma etapa posterior já aconteceu, as anteriores sem data aconteceram também (só não foram registradas). */
    const seq = [embarque, porto, obra, inicio, m50, m75, fim, entrega];
    for (let i = seq.length - 1; i >= 0; i--) {
      if (seq[i].estado !== 'feito') continue;
      for (let j = 0; j < i; j++) if (seq[j].estado !== 'feito') seq[j] = { ...seq[j], estado: 'pulado' };
      break;
    }
    passos.push(...seq);
    passos.forEach((p) => { p.rotulo = (ETAPAS.find((x) => x.key === p.key) || {}).rotulo || p.key; });

    const ultimoFeito = passos.reduce((acc, p, i) => (p.estado === 'feito' || p.estado === 'pulado' ? i : acc), -1);
    const atual = passos[ultimoFeito + 1] || null;
    const atrasada = !!(atual && atual.estado === 'previsto' && atual.data && inicioDoDia(atual.data) < hoje);
    return { passos, atualKey: atual ? atual.key : null, atrasada, pct: Math.round(Number(prog.pct) || 0) };
  }

  window.EvolucaoEquipamentosCalc = { ETAPAS, paraData, escolherEmbarque, montarLinha };
}());
