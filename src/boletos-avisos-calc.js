/* ============================================================
   boletos-avisos-calc.js — Financeiro & Preços › Boletos Avisos (regra pura).
   O bloco entre "BEGIN CALC" e "END CALC" existe IGUAL na Edge Function
   supabase/functions/boletos-avisos/index.ts; src/boletos-avisos-paridade.test.js
   falha se um lado mudar sem o outro. Se mudar uma regra, mude os dois e
   republique a função.

   Etapas dos avisos automáticos (decisão do Gelson, 11/11/2026): 5 dias antes (D-5),
   1 dia antes (D-1), no dia (D0) e 1 dia depois (D+1). A etapa só vale NA data dela. A rotina
   roda de segunda a sexta; na segunda-feira também sai o que caiu no sábado/domingo (a mais
   recente prevalece). Se a rotina falhar num dia, a etapa daquele dia não é recuperada depois.
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
  function situacaoDoBoleto(vencISO, hojeISO) {
    const d = diasDesdeVencimento(vencISO, hojeISO);
    return d > 0 ? 'atrasado' : d === 0 ? 'vence_hoje' : 'em_dia';
  }
  function etapaDevida(vencISO, hojeISO, jaEnviadas, semBoleto) {
    const d = diasDesdeVencimento(vencISO, hojeISO);
    const segunda = new Date(hojeISO + 'T12:00:00Z').getUTCDay() === 1;
    let achada = null;
    for (const e of ETAPAS) {
      const dias = (e.cod === 'D+1' && semBoleto) ? 2 : e.dias;   // sem boleto a conciliação é manual: o aviso de atraso sai no 2º dia
      const atraso = d - dias;
      if (atraso === 0 || (segunda && (atraso === 1 || atraso === 2))) achada = e;
    }
    if (!achada || (jaEnviadas || []).includes(achada.cod)) return null;
    return achada.cod;
  }
  function dataBR(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
  function moedaBR(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function montarAviso(razao, boletos, etapa) {
    // Textos aprovados pelo Gelson em 17/11/2026 (mantém "encargos"; sem telefone e sem dados bancários).
    const plural = boletos.length > 1;
    const algumSem = boletos.some((b) => b.tem_boleto === false);
    const pl = (sing, plur) => (plural ? plur : sing);
    const item = algumSem ? pl('pagamento', 'pagamentos') : pl('boleto', 'boletos');
    const vence = pl('vence', 'vencem');
    const intro = {
      'D-5': 'Olá, tudo bem?\n\nPassando para lembrar que ' + pl('o ', 'os ') + item + ' abaixo ' + vence + ' em 5 dias:',
      'D-1': 'Olá,\n\n' + pl('O ', 'Os ') + item + ' abaixo ' + vence + ' amanhã:',
      'D0': 'Olá,\n\n' + pl('O ', 'Os ') + item + ' abaixo ' + vence + ' hoje:',
      'D+1': 'Olá,\n\n' + (algumSem
        ? 'Até o momento ' + pl('o pagamento abaixo, já vencido, ainda não consta como recebido:', 'os pagamentos abaixo, já vencidos, ainda não constam como recebidos:')
        : 'Até o momento não identificamos o pagamento ' + pl('do boleto abaixo, já vencido:', 'dos boletos abaixo, já vencidos:')),
      'manual': 'Olá,\n\n' + pl('Segue o ', 'Seguem os ') + item + ' em aberto da sua empresa:',
    }[etapa] || 'Olá,\n\n' + pl('Segue o ', 'Seguem os ') + item + ' em aberto da sua empresa:';
    const fecho = {
      'D-5': 'Se o pagamento já estiver programado, pode desconsiderar este e-mail.\n'
        + (algumSem ? 'Tem alguma dúvida?' : 'Precisa da 2ª via ou tem alguma dúvida?') + ' É só responder esta mensagem.',
      'D-1': 'Para evitar encargos por atraso, recomendamos o pagamento até a data do vencimento.\n'
        + 'Se já foi pago ou programado, desconsidere este aviso.\nQualquer dúvida, é só responder este e-mail.',
      'D0': 'Se o pagamento já foi feito, obrigado e desconsidere esta mensagem.\n'
        + 'Se precisar de ' + (algumSem ? 'ajuda' : '2ª via') + ' ou tiver alguma dificuldade, responda este e-mail que ajudamos.',
      'D+1': 'Se já pagou: responda este e-mail com o comprovante' + (algumSem ? ' do depósito ou da transferência' : '') + ' para darmos baixa.\n'
        + 'Se ainda não pagou: pedimos que regularize o quanto antes. Se precisar de ' + (algumSem ? '' : '2ª via atualizada ou de ')
        + 'uma nova data, responda esta mensagem que combinamos com você.',
    }[etapa] || 'Se o pagamento já foi feito, responda este e-mail com o comprovante para darmos baixa.\nQualquer dúvida, é só responder esta mensagem.';
    const assunto = (algumSem ? {
      'D-5': 'Lembrete: ' + pl('pagamento vence', 'pagamentos vencem') + ' em 5 dias',
      'D-1': pl('Seu pagamento vence', 'Seus pagamentos vencem') + ' amanhã',
      'D0': pl('Seu pagamento vence', 'Seus pagamentos vencem') + ' hoje',
      'D+1': pl('Pagamento em aberto — vencido', 'Pagamentos em aberto — vencidos'),
      'manual': 'Pagamentos em aberto',
    } : {
      'D-5': 'Lembrete: ' + pl('boleto vence', 'boletos vencem') + ' em 5 dias',
      'D-1': pl('Seu boleto vence', 'Seus boletos vencem') + ' amanhã',
      'D0': pl('Seu boleto vence', 'Seus boletos vencem') + ' hoje',
      'D+1': pl('Boleto em aberto — vencido', 'Boletos em aberto — vencidos'),
      'manual': 'Boletos em aberto',
    })[etapa] + ' — ' + razao;
    const linhas = boletos.map((b) => {
      let l = '• ' + [b.numero_documento ? 'NF ' + b.numero_documento : null, b.numero_parcela ? 'parcela ' + b.numero_parcela : null].filter(Boolean).join(' · ')
        + ' — vencimento ' + dataBR(b.data_vencimento) + ' — ' + moedaBR(b.valor);
      if (b.tem_boleto === false) l += '\n  Forma de pagamento: depósito/transferência, conforme combinado.';
      else if (b.linha_digitavel) l += '\n  Linha digitável: ' + b.linha_digitavel;
      return l;
    });
    const texto = intro + '\n\n' + linhas.join('\n') + '\n\n' + fecho + '\n\n'
      + 'Atenciosamente,\nFinanceiro — VerticalParts';
    return { assunto, texto };
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
  function resumoFinanceiro(boletos, hojeISO) {
    const vazio = () => ({ centavos: 0, boletos: 0, clientes: new Set() });
    const b = { aVencer: vazio(), venceHoje: vazio(), atrasado30: vazio(), atrasadoMais30: vazio() };
    for (const x of boletos || []) {
      const d = diasDesdeVencimento(x.data_vencimento, hojeISO);
      const k = d < 0 ? 'aVencer' : d === 0 ? 'venceHoje' : d <= 30 ? 'atrasado30' : 'atrasadoMais30';
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

  return {
    ETAPAS, SITUACOES, ETAPA_ROTULO,
    diasDesdeVencimento, situacaoDoBoleto, etapaDevida, montarAviso, dataBR, moedaBR, hojeBrasil, resumoFinanceiro,
  };
})();
