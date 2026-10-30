/* ============================================================
   evolucao-equipamentos-calc.js — regras puras da "Evolução dos
   equipamentos" (2ª aba do Mapa de Obras, 19/10/2026).
   Monta a linha do tempo de UM equipamento a partir de dados que já existem:
     - dossier_obra (abertura, fase, equipamento entregue)
     - equipamentos_obra (previsões e datas reais por nº de série)
     - embarques_importacao da cotação (saída da fábrica, chegada a Santos, entrega);
       sem cotação, TEMPORARIAMENTE pelo nº de série da P.I. (embarquesPorSerie)
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

  const normSerie = (v) => String(v == null ? '' : v).trim().toUpperCase();

  /* TEMPORÁRIO (19/10/2026): obras antigas não têm Nº de cotação. Liga o embarque ao
     equipamento pelo nº de série gravado na P.I. (pi_importacao.numeros_serie → embarque_id).
     A regra definitiva é pelo Nº da cotação — que sempre vence quando existe.
     pis: [{ numeros_serie: [...], embarque_id }]; embarques: [{ id, ... }].
     Devolve { 'SERIE': embarque } (mais recente quando a série aparece em 2+ P.I.). */
  function embarquesPorSerie(pis, embarques) {
    const porId = {};
    (embarques || []).forEach((e) => { if (e && e.id) porId[e.id] = e; });
    const listas = {};
    (pis || []).forEach((p) => {
      const emb = p && porId[p.embarque_id];
      if (!emb) return;
      (p.numeros_serie || []).forEach((sr) => { const k = normSerie(sr); if (k) (listas[k] = listas[k] || []).push(emb); });
    });
    const out = {};
    Object.keys(listas).forEach((k) => { const e = escolherEmbarque(listas[k]); if (e) out[k] = e; });
    return out;
  }

  /* Cotação primeiro (regra definitiva); nº de série só quando a obra não tem embarque pela cotação. */
  function embarqueDoEquipamento(embCotacao, porSerie, serie) {
    if (embCotacao) return { embarque: embCotacao, origem: 'cotacao' };
    const e = porSerie && serie ? porSerie[normSerie(serie)] : null;
    return e ? { embarque: e, origem: 'serie' } : { embarque: null, origem: null };
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
    /* Chegada REAL = presença de carga; sem ela vale a estimativa (ETA), marcada como estimada. */
    const porto = etapa('porto', emb.presenca_carga || emb.eta_santos, null, hoje);
    porto.fonte = emb.presenca_carga ? 'presenca' : (emb.eta_santos ? 'eta' : null);
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


  /* ---------- Ocorrências e atrasos (espinha de peixe) — 19/10/2026 ----------
     Cada ocorrência cai numa "espinha" (categoria) e aponta para a etapa da linha do tempo
     onde aconteceu. Hoje só existem as internas que o banco já registra (rolagem/ETD do
     navio, mudança de ETA, canal da aduana, previsão vencida). As Ocorrências de Obra e os
     atrasos combinados de projeto/contrato entram por ctx.extras quando existirem. */
  const CATEGORIAS_OCORRENCIA = [
    { key: 'contrato',  rotulo: 'Projeto e contrato' },
    { key: 'navio',     rotulo: 'Navio e frete' },
    { key: 'aduana',    rotulo: 'Aduana' },
    { key: 'logistica', rotulo: 'Logística até a obra' },
    { key: 'obra',      rotulo: 'Obra e instalação' },
  ];
  const DIA = 86400000;
  const dias = (a, b) => Math.round((inicioDoDia(b) - inicioDoDia(a)) / DIA);
  const fmt = (d) => (d ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() : '');
  const CAT_DA_ETAPA = { embarque: 'navio', porto: 'navio', obra: 'logistica', inicio: 'obra', m50: 'obra', m75: 'obra', fim: 'obra', entrega: 'obra' };
  const DIAS_PORTO_SEM_ENTREGA = 10;

  /**
   * @param emb   embarque ligado ao equipamento (ou null)
   * @param linha resultado de montarLinha
   * @param ctx   { hoje, extras: [{categoria, etapa, titulo, detalhe, data, dias, gravidade, origem}] }
   * @returns { lista, porCategoria, diasAtraso }
   */
  function ocorrencias(emb, linha, ctx) {
    ctx = ctx || {};
    const hoje = inicioDoDia(ctx.hoje || new Date());
    const lista = [];
    const e = emb || {};
    const nomeEmb = String(e.nome_embarque || '').trim();
    let atrasoNavio = 0;

    const rol = Array.isArray(e.historico_rolagens) ? e.historico_rolagens : [];
    const RC = (typeof window !== 'undefined' && window.RolagensCalc) || null;
    const suspeitas = {};
    (RC ? RC.conferir(rol) : []).forEach((a) => { suspeitas[a.indice] = a.avisos; });
    rol.forEach((r, i) => {
      const de = paraData(r && r.data_anterior), para = paraData(r && r.nova_data);
      if (!de || !para) return;
      const n = dias(de, para);
      const motivo = String((r && r.motivo) || '').trim();
      const conferir = suspeitas[i] ? ' · ⚠ data a conferir no Embarque' : '';
      lista.push({ categoria: 'navio', etapa: 'embarque', origem: 'interna', data: para, dias: n,
        gravidade: n > 7 ? 'alta' : 'media', conferir: !!suspeitas[i],
        titulo: n >= 0 ? `Rolagem do navio (+${n} dia${n === 1 ? '' : 's'})` : `Nova data antes da prevista (${n} dias)`,
        detalhe: `${nomeEmb ? nomeEmb + ': ' : ''}saída ${fmt(de)} → ${fmt(para)}${motivo ? ' · ' + motivo : ' · motivo não informado'}${conferir}` });
    });
    const etdAtual = paraData(e.etd_atual);
    if (rol.length) {
      const primeira = paraData(rol[0] && rol[0].data_anterior);
      if (primeira && etdAtual) atrasoNavio = Math.max(0, dias(primeira, etdAtual));
    } else {
      const etd0 = paraData(e.etd_original);
      if (etd0 && etdAtual && dias(etd0, etdAtual) > 0) {
        atrasoNavio = dias(etd0, etdAtual);
        lista.push({ categoria: 'navio', etapa: 'embarque', origem: 'interna', data: etdAtual, dias: atrasoNavio, gravidade: atrasoNavio > 7 ? 'alta' : 'media',
          titulo: `Saída do navio adiada (+${atrasoNavio} dias)`, detalhe: `${nomeEmb ? nomeEmb + ': ' : ''}previsto ${fmt(etd0)}, saiu/sai ${fmt(etdAtual)}` });
      }
    }
    const hEta = Array.isArray(e.historico_eta) ? e.historico_eta : [];
    hEta.forEach((h) => {
      const de = paraData(h && (h.data_anterior || h.eta_anterior)), para = paraData(h && (h.nova_data || h.eta_nova || h.eta));
      if (!de || !para) return;
      const n = dias(de, para);
      if (!n) return;
      const motivo = String((h && h.motivo) || '').trim();
      lista.push({ categoria: 'navio', etapa: 'porto', origem: 'interna', data: para, dias: n, gravidade: n > 7 ? 'alta' : 'media',
        titulo: n > 0 ? `Chegada a Santos adiada (+${n} dias)` : `Chegada a Santos antecipada (${n} dias)`,
        detalhe: `${nomeEmb ? nomeEmb + ': ' : ''}ETA ${fmt(de)} → ${fmt(para)}${motivo ? ' · ' + motivo : ''}` });
    });
    const canal = String(e.canal_parametrizacao || '').trim().toLowerCase();
    if (canal && canal !== 'verde') {
      const grave = canal === 'vermelho' || canal === 'cinza';
      lista.push({ categoria: 'aduana', etapa: 'porto', origem: 'interna', data: null, dias: null, gravidade: grave ? 'alta' : 'media',
        titulo: `Canal ${canal.charAt(0).toUpperCase() + canal.slice(1)} na aduana`,
        detalhe: `${nomeEmb ? nomeEmb + ': ' : ''}parametrização ${grave ? 'com conferência física/documental (costuma atrasar a liberação)' : 'com conferência documental'}` });
    }
    const passo = (k) => ((linha && linha.passos) || []).find((p) => p.key === k) || {};
    const eta = paraData(e.presenca_carga || e.eta_santos);
    if (eta && passo('porto').estado === 'feito' && passo('obra').estado !== 'feito' && passo('obra').estado !== 'pulado') {
      const n = dias(eta, hoje);
      if (n > DIAS_PORTO_SEM_ENTREGA) lista.push({ categoria: 'logistica', etapa: 'obra', origem: 'interna', data: eta, dias: n, gravidade: n > 30 ? 'alta' : 'media',
        titulo: `${n} dias desde a chegada a Santos sem entrega na obra`, detalhe: `${nomeEmb ? nomeEmb + ': ' : ''}chegou em ${fmt(eta)}` });
    }
    let atrasoPrev = 0;
    if (linha && linha.atrasada && linha.atualKey) {
      const p = passo(linha.atualKey);
      if (p.data) {
        atrasoPrev = dias(p.data, hoje);
        lista.push({ categoria: CAT_DA_ETAPA[linha.atualKey] || 'obra', etapa: linha.atualKey, origem: 'interna', data: p.data, dias: atrasoPrev,
          gravidade: atrasoPrev > 30 ? 'alta' : 'media', titulo: `Previsão vencida há ${atrasoPrev} dia${atrasoPrev === 1 ? '' : 's'}`,
          detalhe: `${p.rotulo || linha.atualKey}: previsto para ${fmt(p.data)}` });
      }
    }
    (ctx.extras || []).forEach((x) => { if (x && x.titulo) lista.push({ origem: 'obra', gravidade: 'media', etapa: null, data: null, dias: null, ...x, categoria: CATEGORIAS_OCORRENCIA.some((c) => c.key === x.categoria) ? x.categoria : 'obra' }); });

    const porCategoria = {};
    CATEGORIAS_OCORRENCIA.forEach((c) => { porCategoria[c.key] = []; });
    lista.forEach((o) => porCategoria[o.categoria].push(o));
    const extrasDias = (ctx.extras || []).reduce((s, x) => s + (Number(x && x.dias) > 0 ? Number(x.dias) : 0), 0);
    return { lista, porCategoria, diasAtraso: atrasoNavio + Math.max(0, atrasoPrev) + extrasDias };
  }

  window.EvolucaoEquipamentosCalc = { ETAPAS, CATEGORIAS_OCORRENCIA, paraData, escolherEmbarque, embarquesPorSerie, embarqueDoEquipamento, montarLinha, ocorrencias };
}());
