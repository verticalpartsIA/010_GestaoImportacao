/* ============================================================
   mes-cadastros-calc.js — MES · Fase 0 · regras puras dos cadastros (sem rede).
   Frentes, postos, jornada e etapas modelo.
   (Motivos de parada/problema/refugo NÃO ficam aqui: o MES existente — mes.jsx — já tem
   bloqueios, pausas e NC; ver CLAUDE.md "MES — Sistema de Execução da Manufatura".)
   window.MesCadastrosCalc — usado por mes-cadastros-store.js e mes-cadastros.jsx.
   ============================================================ */
(function () {
  'use strict';

  const TIPOS_ETAPA = ['producao', 'inspecao'];
  const ROTULO_TIPO_ETAPA = { producao: 'Produção', inspecao: 'Inspeção / conferência' };
  const DIAS = [
    { n: 1, curto: 'Seg' }, { n: 2, curto: 'Ter' }, { n: 3, curto: 'Qua' }, { n: 4, curto: 'Qui' },
    { n: 5, curto: 'Sex' }, { n: 6, curto: 'Sáb' }, { n: 0, curto: 'Dom' },
  ];

  function validarFrente(f) {
    const erros = [];
    if (!String((f && f.nome) || '').trim()) erros.push('Informe o nome da frente.');
    const cod = String((f && f.codigo) || '').trim();
    if (!cod) erros.push('Informe o código da frente.');
    else if (!/^[a-z0-9_]+$/.test(cod)) erros.push('O código só aceita letras minúsculas sem acento, números e "_".');
    return erros;
  }

  function minutos(hhmm) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  }

  function validarJornada(j) {
    const erros = [];
    const ini = minutos(j && j.inicio), fim = minutos(j && j.fim);
    if (Number.isNaN(ini) || Number.isNaN(fim)) erros.push('Informe o início e o fim da jornada.');
    else if (fim <= ini) erros.push('O fim da jornada precisa ser depois do início.');
    const inter = Number(j && j.intervalo_min);
    if (!Number.isFinite(inter) || inter < 0) erros.push('O intervalo não pode ser negativo.');
    else if (!Number.isNaN(ini) && !Number.isNaN(fim) && inter >= fim - ini) erros.push('O intervalo precisa ser menor que a jornada.');
    const dias = (j && j.dias_semana) || [];
    if (!Array.isArray(dias) || !dias.length) erros.push('Marque ao menos um dia da semana.');
    return erros;
  }

  /* Horas úteis por dia = (fim − início − intervalo) em horas. */
  function horasUteisDia(j) {
    const ini = minutos(j && j.inicio), fim = minutos(j && j.fim);
    if (Number.isNaN(ini) || Number.isNaN(fim) || fim <= ini) return 0;
    const h = (fim - ini - (Number(j.intervalo_min) || 0)) / 60;
    return h > 0 ? Math.round(h * 100) / 100 : 0;
  }

  function resumoDias(dias) {
    const set = new Set(dias || []);
    return DIAS.filter(d => set.has(d.n)).map(d => d.curto).join(', ') || '—';
  }

  function validarEtapa(e) {
    const erros = [];
    if (!String((e && e.nome) || '').trim()) erros.push('Informe o nome da etapa.');
    if (!TIPOS_ETAPA.includes(e && e.tipo)) erros.push('Escolha o tipo da etapa.');
    const op = Number(e && e.operadores);
    if (!Number.isInteger(op) || op < 1) erros.push('O número de operadores precisa ser 1 ou mais.');
    return erros;
  }

  function validarPosto(p) {
    const erros = [];
    if (!String((p && p.codigo) || '').trim()) erros.push('Informe o código do posto.');
    if (!String((p && p.nome) || '').trim()) erros.push('Informe o nome do posto.');
    if (!['mao_de_obra', 'maquina'].includes(p && p.tipo)) erros.push('Escolha o tipo do posto.');
    if (!(p && p.frente_codigo)) erros.push('Escolha a frente do posto.');
    return erros;
  }

  window.MesCadastrosCalc = {
    TIPOS_ETAPA, ROTULO_TIPO_ETAPA, DIAS,
    validarFrente, validarJornada, horasUteisDia, resumoDias, validarEtapa, validarPosto,
  };
}());
