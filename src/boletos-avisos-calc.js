/* ============================================================
   boletos-avisos-calc.js — Financeiro & Preços › Boletos Avisos (regra pura).
   O bloco entre "BEGIN CALC" e "END CALC" existe IGUAL na Edge Function
   supabase/functions/boletos-avisos/index.ts; src/boletos-avisos-paridade.test.js
   falha se um lado mudar sem o outro. Se mudar uma regra, mude os dois e
   republique a função.

   Etapas dos avisos automáticos (decisão do Gelson, 11/11/2026): 5 dias antes (D-5),
   1 dia antes (D-1), no dia (D0) e 1 dia depois (D+1). A etapa só vale NA data dela.
   Desde 17/11/2026: nada sai em sábado, domingo ou feriado (calendario_feriados); o vencimento que
   vale é o próximo dia útil (regra bancária) e cada etapa cai sempre num dia útil (datasDasEtapas).
   Se a rotina falhar num dia, a etapa daquele dia não é recuperada depois.
   Dia = data de Brasília (AAAA-MM-DD).
   ============================================================ */
window.BoletosAvisosCalc = (() => {
  // BEGIN CALC
  const ETAPAS = [
    { cod: 'D-5', dias: -5 },
    { cod: 'D-1', dias: -1 },
    { cod: 'D0', dias: 0 },
    { cod: 'D+1', dias: 1 },
  ];
  function diasDesdeVencimento(vencISO, hojeISO) {
    const a = Date.UTC(+vencISO.slice(0, 4), +vencISO.slice(5, 7) - 1, +vencISO.slice(8, 10));
    const b = Date.UTC(+hojeISO.slice(0, 4), +hojeISO.slice(5, 7) - 1, +hojeISO.slice(8, 10));
    return Math.round((b - a) / 86400000);
  }
  /* Dia sem expediente (17/11/2026, decisão do Gelson): sábado, domingo e os feriados do calendário do hub que
     bloqueiam envio (nacionais, estaduais de SP e municipais de Guarulhos) + segunda e terça de Carnaval (banco fechado).
     feriados = Set de 'AAAA-MM-DD' (conjuntoSemExpediente); sem o Set, vale só o fim de semana. */
  function conjuntoSemExpediente(linhas) {
    return new Set((linhas || []).filter((l) => l.ativo !== false && (l.bloqueia_envio === true || /^carnaval/i.test(l.descricao || ''))).map((l) => l.data));
  }
  function somarDias(iso, n) {
    return new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400000).toISOString().slice(0, 10);
  }
  function diaUtil(iso, feriados) {
    const w = new Date(iso + 'T12:00:00Z').getUTCDay();
    return w !== 0 && w !== 6 && !(feriados && feriados.has(iso));
  }
  function proximoDiaUtil(iso, feriados) {
    let d = iso;
    for (let i = 0; i < 60 && !diaUtil(d, feriados); i++) d = somarDias(d, 1);
    return d;
  }
  function diaUtilAnterior(iso, feriados) {
    let d = somarDias(iso, -1);
    for (let i = 0; i < 60 && !diaUtil(d, feriados); i++) d = somarDias(d, -1);
    return d;
  }
  /* Boleto que vence em dia sem expediente pode ser pago no próximo dia útil sem encargos: é esse o vencimento que vale. */
  function vencimentoEfetivo(vencISO, feriados) { return proximoDiaUtil(vencISO, feriados); }
  /* Data (sempre dia útil) de cada etapa. D-1 é o dia útil ANTES do vencimento efetivo; as demais vão para o próximo
     dia útil. O aviso de atraso ("D+1") sai no 2º dia útil depois do vencimento efetivo, com ou sem boleto (Gelson,
     19/11/2026: o banco pode levar 1 dia útil para mostrar o pagamento). semBoleto fica na assinatura por compatibilidade. */
  function datasDasEtapas(vencISO, semBoleto, feriados) {
    const efetivo = vencimentoEfetivo(vencISO, feriados);
    const atraso1 = proximoDiaUtil(somarDias(efetivo, 1), feriados);
    return {
      'D-5': proximoDiaUtil(somarDias(vencISO, -5), feriados),
      'D-1': diaUtilAnterior(efetivo, feriados),
      'D0': efetivo,
      'D+1': proximoDiaUtil(somarDias(atraso1, 1), feriados),
    };
  }
  function situacaoDoBoleto(vencISO, hojeISO, feriados) {
    const d = diasDesdeVencimento(vencimentoEfetivo(vencISO, feriados), hojeISO);
    return d > 0 ? 'atrasado' : d === 0 ? 'vence_hoje' : 'em_dia';
  }
  function diasDeAtraso(vencISO, hojeISO, feriados) {
    return Math.max(0, diasDesdeVencimento(vencimentoEfetivo(vencISO, feriados), hojeISO));
  }
  /* Em dia sem expediente nada sai. Num dia útil sai a etapa cuja data é hoje (a mais adiantada, se coincidirem). */
  function etapaDevida(vencISO, hojeISO, jaEnviadas, semBoleto, feriados) {
    if (!diaUtil(hojeISO, feriados)) return null;
    const datas = datasDasEtapas(vencISO, semBoleto, feriados);
    let achada = null;
    for (const e of ETAPAS) {
      if (e.cod === 'D-5' && datas['D-5'] >= datas['D-1']) continue;   // feriado longo: o D-1 já cobre
      if (datas[e.cod] === hojeISO) achada = e.cod;
    }
    if (!achada || (jaEnviadas || []).includes(achada)) return null;
    return achada;
  }
  function dataBR(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
  function moedaBR(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  /* Textos aprovados pelo Gelson em 17/11/2026 (mantém "encargos"; sem telefone e sem dados bancários).
     19/11/2026: um e-mail pode juntar títulos em etapas diferentes (e de vários códigos do mesmo cliente) — cada título vai
     na seção da SUA etapa (Vencido / Vence hoje / Próximos vencimentos), nunca sob o texto do mais grave; "amanhã" e
     "em 5 dias" só quando é verdade; corpo em tabela (html) + versão texto (log). etapa = 'D-5'|'D-1'|'D0'|'D+1'|'manual'
     para todos, ou { codigo_lancamento_omie: etapa }. */
  const DIA_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  function diaDaSemana(iso) { return DIA_SEMANA[new Date(iso + 'T12:00:00Z').getUTCDay()]; }
  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  /* Vencimento como o cliente lê: se caiu em dia sem expediente, diz até quando pode pagar sem encargos. */
  function vencimentoTexto(vencISO, feriados) {
    const ef = vencimentoEfetivo(vencISO, feriados);
    if (ef === vencISO) return dataBR(vencISO);
    const w = new Date(vencISO + 'T12:00:00Z').getUTCDay();
    return dataBR(vencISO) + ' (' + (w === 0 || w === 6 ? diaDaSemana(vencISO) : 'feriado') + ') — pode pagar até ' + dataBR(ef).slice(0, 5);
  }
  /* "amanhã" / "em 3 dias" / "no próximo dia útil, segunda-feira, 23/11" — sem hoje, cai nos textos fixos. */
  function quandoVence(lista, etapa, feriados, hojeISO) {
    if (etapa === 'D-1') {
      const efs = [...new Set(lista.map((b) => vencimentoEfetivo(b.data_vencimento, feriados)))];
      if (!hojeISO || (efs.length === 1 && efs[0] === somarDias(hojeISO, 1))) return { frase: 'amanhã', assunto: 'amanhã' };
      if (efs.length === 1) return { frase: 'no próximo dia útil, ' + diaDaSemana(efs[0]) + ', ' + dataBR(efs[0]).slice(0, 5), assunto: 'em ' + dataBR(efs[0]).slice(0, 5) };
      return { frase: 'nos próximos dias', assunto: 'nos próximos dias' };
    }
    const vs = [...new Set(lista.map((b) => b.data_vencimento))];
    if (!hojeISO) return { frase: 'em 5 dias', assunto: 'em 5 dias' };
    if (vs.length > 1) return { frase: 'nos próximos dias', assunto: 'nos próximos dias' };
    const n = diasDesdeVencimento(hojeISO, vs[0]);
    const t = n === 1 ? 'amanhã' : 'em ' + n + ' dias';
    return { frase: t, assunto: t };
  }
  const ORDEM_ETAPA = ['manual', 'D-5', 'D-1', 'D0', 'D+1'];
  function montarAviso(razao, boletos, etapa, feriados, hojeISO) {
    const etapaDe = (b) => (typeof etapa === 'string' ? etapa : (etapa && etapa[b.codigo_lancamento_omie]) || 'manual');
    const grupoDe = (e) => (e === 'D-5' || e === 'D-1' ? 'prox' : e);
    const porGrupo = {};
    for (const b of boletos) (porGrupo[grupoDe(etapaDe(b))] = porGrupo[grupoDe(etapaDe(b))] || []).push(b);
    const grupos = ['D+1', 'D0', 'prox', 'manual'].filter((g) => porGrupo[g]);
    const maisGrave = boletos.map(etapaDe).sort((a, b) => ORDEM_ETAPA.indexOf(b) - ORDEM_ETAPA.indexOf(a))[0];
    const algumSemTodos = boletos.some((b) => b.tem_boleto === false);

    // palavras de uma lista (singular/plural, boleto/pagamento)
    const palavras = (lista) => {
      const plural = lista.length > 1;
      const algumSem = lista.some((b) => b.tem_boleto === false);
      const pl = (s, p) => (plural ? p : s);
      return { plural, algumSem, pl, item: algumSem ? pl('pagamento', 'pagamentos') : pl('boleto', 'boletos'), vence: pl('vence', 'vencem') };
    };
    const linhaTexto = (b) => {
      let l = '• ' + [b.numero_documento ? 'NF ' + b.numero_documento : null, b.numero_parcela ? 'parcela ' + b.numero_parcela : null].filter(Boolean).join(' · ')
        + ' — vencimento ' + vencimentoTexto(b.data_vencimento, feriados) + ' — ' + moedaBR(b.valor);
      if (b.tem_boleto !== false && b.linha_digitavel) l += '\n  Linha digitável: ' + b.linha_digitavel;
      return l;
    };
    const soma = (lista) => lista.reduce((s, b) => s + Math.round(Number(b.valor || 0) * 100), 0) / 100;
    const ordenar = (lista) => lista.slice().sort((a, b) => (a.data_vencimento < b.data_vencimento ? -1 : a.data_vencimento > b.data_vencimento ? 1 : 0));

    const fechoDe = (e, lista) => {
      const w = palavras(lista);
      return {
        'D-5': 'Se o pagamento já estiver programado, pode desconsiderar este e-mail.\n'
          + (w.algumSem ? 'Tem alguma dúvida?' : 'Precisa da 2ª via ou tem alguma dúvida?') + ' É só responder esta mensagem.',
        'D-1': 'Para evitar encargos por atraso, recomendamos o pagamento até a data do vencimento.\n'
          + 'Se já foi pago ou programado, desconsidere este aviso.\nQualquer dúvida, é só responder este e-mail.',
        'D0': 'Se o pagamento já foi feito, obrigado e desconsidere esta mensagem.'
          + (w.algumSem ? '' : '\nSe precisar da 2ª via, responda este e-mail.'),
        'D+1': 'Se já pagou: responda este e-mail com o comprovante' + (w.algumSem ? ' do depósito ou da transferência' : '') + ' para darmos baixa.\n'
          + 'Se ainda não pagou: solicitamos a regularização imediata, sujeita aos encargos por atraso.'
          + (w.algumSem ? '' : ' A 2ª via atualizada pode ser solicitada respondendo este e-mail.'),
      }[e] || 'Se o pagamento já foi feito, responda este e-mail com o comprovante para darmos baixa.\nQualquer dúvida, é só responder esta mensagem.';
    };
    const semExpediente = (lista) => lista.every((b) => !diaUtil(b.data_vencimento, feriados));

    let secoes, intro, fecho;
    if (grupos.length === 1) {
      // uma situação só: os textos aprovados em 17/11, com a data certa
      const lista = ordenar(boletos);
      const w = palavras(lista);
      const q = quandoVence(lista, maisGrave, feriados, hojeISO);
      intro = {
        'D-5': 'Olá, tudo bem?\n\nPassando para lembrar que ' + w.pl('o ', 'os ') + w.item + ' abaixo ' + w.vence + ' ' + q.frase + ':',
        'D-1': 'Olá,\n\n' + w.pl('O ', 'Os ') + w.item + ' abaixo ' + w.vence + ' ' + q.frase + ':',
        'D0': 'Olá,\n\n' + w.pl('O ', 'Os ') + w.item + ' abaixo ' + (semExpediente(lista)
          ? w.pl('venceu', 'venceram') + ' em dia sem expediente bancário e ' + w.pl('pode', 'podem') + ' ser '
            + (w.algumSem ? w.pl('feito', 'feitos') : w.pl('pago', 'pagos')) + ' hoje sem encargos:'
          : w.vence + ' hoje:'),
        'D+1': 'Olá,\n\n' + (w.algumSem
          ? 'Até o momento ' + w.pl('o pagamento abaixo, já vencido, ainda não consta como recebido:', 'os pagamentos abaixo, já vencidos, ainda não constam como recebidos:')
          : 'Até o momento não identificamos o pagamento ' + w.pl('do boleto abaixo, já vencido:', 'dos boletos abaixo, já vencidos:')),
      }[maisGrave] || 'Olá,\n\n' + w.pl('Segue o ', 'Seguem os ') + w.item + ' em aberto da sua empresa:';
      secoes = [{ grupo: grupos[0], titulo: null, lista, fecho: null }];
      fecho = fechoDe(maisGrave, lista);
    } else {
      // situações diferentes no mesmo e-mail: uma seção para cada, cada uma com o seu texto
      intro = 'Olá,\n\nSegue a situação dos seus ' + (algumSemTodos ? 'pagamentos' : 'boletos') + ' com a VerticalParts.';
      secoes = grupos.map((g) => {
        const lista = ordenar(porGrupo[g]);
        const w = palavras(lista);
        const titulo = {
          'D+1': w.pl('Vencido — ainda não consta como recebido', 'Vencidos — ainda não constam como recebidos'),
          'D0': semExpediente(lista)
            ? w.pl('Venceu em dia sem expediente bancário — pode ser pago hoje sem encargos', 'Venceram em dia sem expediente bancário — podem ser pagos hoje sem encargos')
            : w.pl('Vence hoje', 'Vencem hoje'),
          'prox': 'Próximos vencimentos',
        }[g] || 'Em aberto';
        return { grupo: g, titulo, lista, fecho: g === 'D+1' ? fechoDe('D+1', lista).split('\n').slice(0, 2).join('\n') : null };
      });
      fecho = 'Para evitar encargos por atraso, recomendamos o pagamento até a data de cada vencimento. O que já foi pago ou programado pode ser desconsiderado.\n'
        + 'Qualquer dúvida' + (boletos.some((b) => b.tem_boleto !== false) ? ' ou se precisar da 2ª via' : '') + ', é só responder este e-mail.';
    }

    // assunto: a situação mais grave
    const listaAssunto = boletos.filter((b) => etapaDe(b) === maisGrave);
    const wa = palavras(listaAssunto);
    const qa = quandoVence(listaAssunto, maisGrave, feriados, hojeISO);
    const assunto = (wa.algumSem ? {
      'D-5': 'Lembrete: ' + wa.pl('pagamento vence', 'pagamentos vencem') + ' ' + qa.assunto,
      'D-1': wa.pl('Seu pagamento vence', 'Seus pagamentos vencem') + ' ' + qa.assunto,
      'D0': wa.pl('Seu pagamento vence', 'Seus pagamentos vencem') + ' hoje',
      'D+1': wa.pl('Pagamento em aberto — vencido', 'Pagamentos em aberto — vencidos'),
      'manual': 'Pagamentos em aberto',
    } : {
      'D-5': 'Lembrete: ' + wa.pl('boleto vence', 'boletos vencem') + ' ' + qa.assunto,
      'D-1': wa.pl('Seu boleto vence', 'Seus boletos vencem') + ' ' + qa.assunto,
      'D0': wa.pl('Seu boleto vence', 'Seus boletos vencem') + ' hoje',
      'D+1': wa.pl('Boleto em aberto — vencido', 'Boletos em aberto — vencidos'),
      'manual': 'Boletos em aberto',
    })[maisGrave] + ' — ' + razao;

    // forma de pagamento uma vez só, no rodapé (Gelson, 19/11/2026)
    const temSem = boletos.some((b) => b.tem_boleto === false), temCom = boletos.some((b) => b.tem_boleto !== false);
    const formaPagamento = 'Forma de pagamento: ' + (temSem && temCom
      ? 'boleto (linha digitável junto do título) ou, onde não há linha digitável, depósito/transferência, conforme combinado.'
      : temSem ? 'depósito/transferência, conforme combinado.' : 'boleto (linha digitável junto de cada título).');
    const assinatura = 'Atenciosamente,\nFinanceiro — VerticalParts';
    const texto = intro + '\n\n'
      + secoes.map((s) => (s.titulo ? s.titulo + ':\n' : '') + s.lista.map(linhaTexto).join('\n')
        + (s.lista.length > 1 ? '\nTotal: ' + moedaBR(soma(s.lista)) : '') + (s.fecho ? '\n\n' + s.fecho : '')).join('\n\n')
      + '\n\n' + fecho + '\n\n' + formaPagamento + '\n\n' + assinatura;

    // html (19/11/2026, formato aprovado pelo Gelson — pacote "email-cobranca" da sessão CoworkOutlook): cartão de 640px,
    // "Pagamentos de <cliente>", frase de resumo, uma tabela por situação (Vencem hoje → Vencidos → A vencer) com total,
    // e a assinatura do hub (cobrança sem assinatura parece golpe). Cada título fica na seção da SUA etapa (dia útil/feriado),
    // nunca pela data do calendário. Só <table> e estilo em linha (Outlook); tudo escapado.
    const F = "font-family:'Segoe UI',Arial,Helvetica,sans-serif;";
    const C1 = '#1f2933', C2 = '#52606d', LINHA = '#e3e8ee';
    const corDe = { 'D0': '#b45309', 'D+1': '#b91c1c', prox: '#1d4ed8', manual: C1 };
    const ordemHtml = ['D0', 'D+1', 'prox', 'manual'].filter((g) => porGrupo[g]);
    const notaVencimento = (b) => {
      const ef = vencimentoEfetivo(b.data_vencimento, feriados);
      const partes = [];
      if (ef !== b.data_vencimento) {
        const w = new Date(b.data_vencimento + 'T12:00:00Z').getUTCDay();
        partes.push((w === 0 || w === 6 ? diaDaSemana(b.data_vencimento) : 'feriado') + ' — pode pagar até ' + dataBR(ef).slice(0, 5));
      }
      if (hojeISO && diasDesdeVencimento(ef, hojeISO) > 0) {
        const n = diasDesdeVencimento(ef, hojeISO);
        partes.push('vencido há ' + n + (n === 1 ? ' dia' : ' dias'));
      }
      return partes.join(' · ');
    };
    const secaoHtml = (g) => {
      const lista = ordenar(porGrupo[g]);
      const w = palavras(lista);
      const titulo = { 'D0': w.pl('Vence hoje', 'Vencem hoje'), 'D+1': w.pl('Vencido', 'Vencidos'), prox: 'A vencer', manual: 'Em aberto' }[g];
      const nota = {
        'D0': (semExpediente(lista) ? w.pl('Venceu', 'Venceram') + ' em dia sem expediente bancário e ' + w.pl('pode', 'podem') + ' ser '
          + (w.algumSem ? w.pl('feito', 'feitos') : w.pl('pago', 'pagos')) + ' hoje sem encargos. ' : '')
          + 'Se o pagamento já foi feito, obrigado e desconsidere.',
        'D+1': (w.algumSem ? w.pl('Ainda não consta como recebido.', 'Ainda não constam como recebidos.') : w.pl('Ainda não identificamos o pagamento.', 'Ainda não identificamos os pagamentos.'))
          + '\n' + fechoDe('D+1', lista).split('\n').slice(0, 2).join('\n'),
        prox: 'Lembrete: ' + w.pl('este ' + w.item + ' vence', 'estes ' + w.item + ' vencem') + ' nos próximos dias, na data indicada.',
        manual: w.pl('Título em aberto nesta data.', 'Títulos em aberto nesta data.'),
      }[g];
      const th = 'padding:10px 12px;' + F + 'font-size:12px;color:' + C2 + ';background-color:#f4f6f8;border-bottom:1px solid ' + LINHA + ';';
      const td = 'padding:11px 12px;' + F + 'font-size:14px;color:' + C1 + ';border-bottom:1px solid ' + LINHA + ';vertical-align:top;';
      let t = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + LINHA + ';border-collapse:collapse;">'
        + '<tr><th align="left" style="' + th + '">Nota fiscal</th><th align="left" style="' + th + '">Parcela</th><th align="left" style="' + th + '">Vencimento</th><th align="right" style="' + th + '">Valor</th></tr>';
      for (const b of lista) {
        const ld = b.tem_boleto !== false && b.linha_digitavel;
        const tdl = ld ? td.replace('border-bottom:1px solid ' + LINHA + ';', '') : td;
        const nv = notaVencimento(b);
        t += '<tr><td style="' + tdl + 'font-weight:bold;">' + escHtml(b.numero_documento ? 'NF ' + b.numero_documento : '—') + '</td>'
          + '<td style="' + tdl + '">' + escHtml(b.numero_parcela || '') + '</td>'
          + '<td style="' + tdl + '">' + escHtml(dataBR(b.data_vencimento)) + (nv ? '<br><span style="font-size:12px;color:' + (g === 'D+1' ? corDe['D+1'] : C2) + ';">' + escHtml(nv) + '</span>' : '') + '</td>'
          + '<td align="right" style="' + tdl + 'font-weight:bold;white-space:nowrap;">' + escHtml(moedaBR(b.valor)) + '</td></tr>';
        if (ld) t += '<tr><td colspan="4" style="padding:0 12px 10px 12px;' + F + 'font-size:12px;color:' + C2 + ';border-bottom:1px solid ' + LINHA + ';">Linha digitável: <span style="font-family:Consolas,Menlo,monospace;color:' + C1 + ';word-break:break-all;">' + escHtml(b.linha_digitavel) + '</span></td></tr>';
      }
      t += '<tr><td colspan="3" style="' + td + 'font-weight:bold;background-color:#f9fafb;">Total (' + lista.length + ' ' + w.pl('parcela', 'parcelas') + ')</td>'
        + '<td align="right" style="' + td + 'font-weight:bold;background-color:#f9fafb;white-space:nowrap;">' + escHtml(moedaBR(soma(lista))) + '</td></tr></table>';
      return '<tr><td style="padding:22px 28px 6px 28px;' + F + 'font-size:17px;font-weight:bold;color:' + corDe[g] + ';">' + escHtml(titulo) + ' <span style="color:' + C1 + ';">' + escHtml(moedaBR(soma(lista))) + '</span></td></tr>'
        + '<tr><td style="padding:0 28px 10px 28px;' + F + 'font-size:13px;line-height:1.5;color:' + C2 + ';">' + escHtml(nota).replace(/\n/g, '<br>') + '</td></tr>'
        + '<tr><td style="padding:0 28px;">' + t + '</td></tr>';
    };
    const partesResumo = ordemHtml.map((g) => {
      const n = porGrupo[g].length, pl = (s1, p1) => (n > 1 ? p1 : s1);
      const r = { 'D0': pl('parcela que vence hoje', 'parcelas que vencem hoje'), 'D+1': pl('já vencida', 'já vencidas'), prox: 'a vencer', manual: 'em aberto' }[g];
      return '<strong>' + n + ' ' + r + '</strong> (' + escHtml(moedaBR(soma(porGrupo[g]))) + ')';
    });
    const resumo = partesResumo.length > 1 ? partesResumo.slice(0, -1).join(', ') + ' e ' + partesResumo[partesResumo.length - 1] : partesResumo[0];
    const so = ordemHtml.length === 1 ? ordemHtml[0] : null;
    const fechoHtml = so === 'D+1'
      ? 'Qualquer dúvida' + (temCom ? ' ou se precisar da 2ª via atualizada' : '') + ', é só responder este e-mail.'
      : 'Para evitar encargos por atraso, recomendamos o pagamento até a data de cada vencimento. O que já foi pago ou programado pode ser desconsiderado.\n'
        + 'Qualquer dúvida' + (temCom ? ' ou se precisar da 2ª via' : '') + ', é só responder este e-mail.';
    const assinaturaHub = '<table role="presentation" id="vp-assinatura-hub" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:600px"><tr><td>'
      + '<a href="https://verticalparts.com.br" target="_blank" style="text-decoration:none"><img src="https://jxtqwzmpgofwctqajewt.supabase.co/storage/v1/object/public/engenharia/email-assinatura/assinatura-hub.jpg" width="600" alt="VerticalParts" style="display:block;width:100%;max-width:600px;height:auto;border:0"></a></td></tr>'
      + '<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#777;padding-top:6px"><b>E-mail corporativo VerticalParts</b> &mdash; fale com todas as áreas da empresa por aqui. Basta responder.<br>'
      + '<b>VerticalParts corporate e-mail</b> &mdash; reach every area of the company here. Just reply.<br>'
      + '<a href="mailto:financeiro@verticalparts.com.br" style="color:#777">financeiro@verticalparts.com.br</a> &middot; <a href="https://verticalparts.com.br" style="color:#777">verticalparts.com.br</a></td></tr></table>';
    const html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;"><tr><td align="center" style="padding:24px 12px;">'
      + '<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:100%;background-color:#ffffff;border:1px solid ' + LINHA + ';">'
      + '<tr><td style="padding:26px 28px 4px 28px;' + F + 'font-size:12px;font-weight:bold;letter-spacing:1px;color:#b45309;">VERTICALPARTS · FINANCEIRO</td></tr>'
      + '<tr><td style="padding:0 28px 8px 28px;' + F + 'font-size:24px;font-weight:bold;color:' + C1 + ';">Pagamentos de ' + escHtml(razao) + '</td></tr>'
      + '<tr><td style="padding:10px 28px 0 28px;' + F + 'font-size:14px;line-height:1.5;color:' + C1 + ';">Olá, segue o resumo dos pagamentos desta empresa' + (hojeISO ? ' em ' + escHtml(dataBR(hojeISO)) : '') + ': ' + resumo + '.</td></tr>'
      + ordemHtml.map(secaoHtml).join('')
      + '<tr><td style="padding:22px 28px 0 28px;' + F + 'font-size:14px;line-height:1.5;color:' + C1 + ';">' + escHtml(fechoHtml).replace(/\n/g, '<br>') + '</td></tr>'
      + '<tr><td style="padding:12px 28px 0 28px;' + F + 'font-size:13px;line-height:1.5;color:' + C2 + ';">' + escHtml(formaPagamento) + '</td></tr>'
      + '<tr><td style="padding:24px 28px 8px 28px;' + F + 'font-size:14px;color:' + C1 + ';">Atenciosamente,<br><strong>Financeiro — VerticalParts</strong></td></tr>'
      + '<tr><td style="padding:8px 28px 22px 28px;">' + assinaturaHub + '</td></tr>'
      + '</table></td></tr></table>';
    return { assunto, texto, html };
  }
  // END CALC

  const SITUACOES = {
    em_dia: { rotulo: 'Em dia', cor: '#16a34a' },
    vence_hoje: { rotulo: 'Vence hoje', cor: '#eab308' },
    atrasado: { rotulo: 'Atrasado', cor: '#dc2626' },
  };
  const ETAPA_ROTULO = { 'D-5': '5 dias antes', 'D-1': '1 dia antes', 'D0': 'No dia', 'D+1': 'Aviso de atraso', manual: 'Manual' };

  function hojeBrasil(agora) { return new Date((agora || Date.now()) - 3 * 3600e3).toISOString().slice(0, 10); }

  /* Impacto financeiro (só da tela; não está na Edge Function): dinheiro em aberto por situação do BOLETO.
     Soma em centavos para não acumular erro de ponto flutuante. Atrasado se divide em 1–30 dias e mais de 30. */
  /* Faixa de um título em aberto — a MESMA regra dos cards e dos filtros da lista (dia útil: vencimento no fim de semana/feriado
     vale no próximo dia útil). aVencer: ainda não venceu · venceHoje · atrasado30: 1 a 30 dias · atrasadoMais30: mais de 30. */
  const FAIXAS = [
    { chave: 'aVencer', rotulo: 'A vencer' },
    { chave: 'venceHoje', rotulo: 'Vence hoje' },
    { chave: 'atrasado30', rotulo: 'Atrasado (1 a 30 dias)' },
    { chave: 'atrasadoMais30', rotulo: 'Atrasado (mais de 30 dias)' },
  ];
  function faixaDoBoleto(vencISO, hojeISO, feriados) {
    const d = diasDesdeVencimento(vencimentoEfetivo(vencISO, feriados), hojeISO);
    return d < 0 ? 'aVencer' : d === 0 ? 'venceHoje' : d <= 30 ? 'atrasado30' : 'atrasadoMais30';
  }

  function resumoFinanceiro(boletos, hojeISO, feriados) {
    const vazio = () => ({ centavos: 0, boletos: 0, clientes: new Set() });
    const b = { aVencer: vazio(), venceHoje: vazio(), atrasado30: vazio(), atrasadoMais30: vazio() };
    for (const x of boletos || []) {
      const k = faixaDoBoleto(x.data_vencimento, hojeISO, feriados);
      b[k].centavos += Math.round(Number(x.valor || 0) * 100);
      b[k].boletos++;
      b[k].clientes.add(x.codigo_cliente_omie);
    }
    const out = {};
    let total = 0, qtd = 0;
    const todos = new Set();
    for (const k of Object.keys(b)) {
      out[k] = { valor: b[k].centavos / 100, boletos: b[k].boletos, clientes: b[k].clientes.size };
      total += b[k].centavos; qtd += b[k].boletos; b[k].clientes.forEach((c) => todos.add(c));
    }
    const atr = b.atrasado30.centavos + b.atrasadoMais30.centavos;
    const atrClientes = new Set([...b.atrasado30.clientes, ...b.atrasadoMais30.clientes]);
    out.atrasado = { valor: atr / 100, boletos: b.atrasado30.boletos + b.atrasadoMais30.boletos, clientes: atrClientes.size };
    out.total = { valor: total / 100, boletos: qtd, clientes: todos.size };
    out.pctAtrasado = total > 0 ? Math.round((atr / total) * 1000) / 10 : 0;
    return out;
  }

  /* Clientes marcados na lista (18/11/2026, pedido do Gelson): só conta e soma, sem ação em lote.
     linhas = [{ qtd, centavos }] (já na faixa ativa dos cards). Soma em centavos: sem erro de ponto flutuante. */
  function resumoSelecao(linhas) {
    let titulos = 0, centavos = 0;
    for (const l of linhas || []) { titulos += Number(l && l.qtd) || 0; centavos += Math.round(Number(l && l.centavos) || 0); }
    return { clientes: (linhas || []).length, titulos, valor: centavos / 100 };
  }

  return {
    ETAPAS, SITUACOES, ETAPA_ROTULO,
    diasDesdeVencimento, situacaoDoBoleto, etapaDevida, montarAviso, vencimentoTexto, dataBR, moedaBR, hojeBrasil, resumoFinanceiro,
    conjuntoSemExpediente, diaUtil, vencimentoEfetivo, datasDasEtapas, diasDeAtraso, FAIXAS, faixaDoBoleto, resumoSelecao,
  };
})();
