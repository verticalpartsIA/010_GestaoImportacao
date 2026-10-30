/* Sugestões de herança do Embarque (Onda 2, 30/10/2026). Funções puras: NUNCA gravam nada;
   a tela mostra "Sugerido: X — Aplicar" e só preenche com o clique. Cada função devolve
   { valor, motivo } ou null (sem sugestão ou nada a mudar). */
(function () {
  const ETAPAS = ['Pagamento', 'Produção', 'Embarque', 'Desembaraço', 'Entrega', 'Concluído'];
  const MODALIDADES = ['FOB', 'FCA', 'EXW'];

  function txt(v) { return v == null ? '' : String(v).trim(); }
  function dia(v) { const s = txt(v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  function somarDias(iso, n) {
    const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function diasEntre(a, b) { return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000); }

  /* Modalidade a partir do incoterm das P.I. (só se TODAS apontam para a mesma modalidade conhecida). */
  function modalidade(incoterms, atual) {
    const achadas = new Set();
    (incoterms || []).forEach((t) => {
      const u = txt(t).toUpperCase();
      MODALIDADES.forEach((m) => { if (new RegExp('\\b' + m + '\\b').test(u)) achadas.add(m); });
    });
    if (achadas.size !== 1) return null;
    const v = [...achadas][0];
    return v === txt(atual) ? null : { valor: v, motivo: 'incoterm da P.I.: ' + (incoterms || []).join(', ') };
  }

  /* Tipo de frete: com cotação de frete marítimo cadastrada, "Marítimo". */
  function tipoFrete(cotacoes, atual) {
    const tem = (cotacoes || []).length > 0;
    if (!tem || txt(atual) === 'Marítimo') return null;
    return { valor: 'Marítimo', motivo: 'há cotação de frete marítimo na aba Frete' };
  }

  /* Última data de free time = presença de carga + dias de free time. */
  function ultimaDataFreeTime(presencaCarga, freeTime, atual) {
    const p = dia(presencaCarga); const n = Number(freeTime);
    if (!p || !(n > 0)) return null;
    const v = somarDias(p, n);
    return v === dia(atual) ? null : { valor: v, motivo: 'presença de carga ' + p + ' + ' + n + ' dias de free time' };
  }

  /* TT total (dias) = ETD atual → presença de carga. */
  function transitTimeTotal(etdAtual, presencaCarga, atual) {
    const e = dia(etdAtual); const p = dia(presencaCarga);
    if (!e || !p) return null;
    const n = diasEntre(e, p);
    if (!(n > 0)) return null;
    return String(n) === txt(atual) ? null : { valor: String(n), motivo: 'ETD ' + e + ' → presença de carga ' + p };
  }

  /* Status da etapa pelo que já está preenchido (nunca sugere voltar etapa). */
  function statusEtapa(f, pagamentoFeito, atual) {
    let idx = 0;
    if (pagamentoFeito) idx = 1;
    if (txt(f.navio) || txt(f.awb_bl) || dia(f.etd_atual)) idx = Math.max(idx, 2);
    if (txt(f.di) || dia(f.data_registro_di) || dia(f.eta_atual) || dia(f.presenca_carga)) idx = Math.max(idx, 3);
    if (dia(f.data_entrega)) idx = Math.max(idx, 4);
    const v = ETAPAS[idx];
    const cur = ETAPAS.indexOf(atual);
    if (cur >= idx) return null;
    return { valor: v, motivo: 'pelos campos já preenchidos' };
  }

  window.EmbSugestoesCalc = { modalidade, tipoFrete, ultimaDataFreeTime, transitTimeTotal, statusEtapa, ETAPAS };
})();
