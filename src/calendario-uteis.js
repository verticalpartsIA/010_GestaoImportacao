/* ============================================================
   calendario-uteis.js — dias úteis com calendário de feriados (espelho de
   public.dias_uteis / public.somar_dias_uteis, migration 20261019160000).
   Funções puras: o chamador passa o Set de feriados ('aaaa-mm-dd') que
   contam no SLA (calendario_feriados.ativo e conta_no_sla).
   A gordura do SLA não cobre calendário: feriado entra aqui, exato.
   window.CalendarioUteis
   ============================================================ */
(function () {
  'use strict';

  const DIA_MS = 864e5;
  const paraMs = (iso) => Date.parse(iso + 'T00:00:00Z');
  const paraIso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const ehFimDeSemana = (ms) => { const d = new Date(ms).getUTCDay(); return d === 0 || d === 6; };

  /* Dias úteis entre duas datas, contando as DUAS pontas (seg a sex = 5). fim < ini => 0. */
  function diasUteis(ini, fim, feriados) {
    const f = feriados || new Set();
    let n = 0;
    for (let ms = paraMs(ini); ms <= paraMs(fim); ms += DIA_MS) {
      if (!ehFimDeSemana(ms) && !f.has(paraIso(ms))) n++;
    }
    return n;
  }

  /* Data que fica n dias úteis depois de ini (ini não conta; n = 0 devolve ini). */
  function somarDiasUteis(ini, n, feriados) {
    if (!(n >= 0)) throw new Error('n precisa ser >= 0');
    const f = feriados || new Set();
    let ms = paraMs(ini), falta = n;
    const limite = ms + 3650 * DIA_MS; // mesmo teto da função SQL: nunca fica em laço
    while (falta > 0) {
      ms += DIA_MS;
      if (ms > limite) throw new Error('Calendário sem dia útil suficiente a partir de ' + ini);
      if (!ehFimDeSemana(ms) && !f.has(paraIso(ms))) falta--;
    }
    return paraIso(ms);
  }

  /* Monta o Set a partir das linhas de calendario_feriados. */
  function conjuntoDeFeriados(linhas) {
    return new Set((linhas || []).filter((l) => l.ativo !== false && l.conta_no_sla !== false).map((l) => l.data));
  }

  window.CalendarioUteis = { diasUteis, somarDiasUteis, conjuntoDeFeriados };
}());
