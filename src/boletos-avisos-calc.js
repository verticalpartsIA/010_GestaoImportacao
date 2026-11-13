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
    const plural = boletos.length > 1;
    const algumSem = boletos.some((b) => b.tem_boleto === false);
    const intro = (algumSem ? {
      'D-5': 'Este é um lembrete: ' + (plural ? 'os pagamentos abaixo estão para vencer.' : 'o pagamento abaixo está para vencer.'),
      'D-1': (plural ? 'Os pagamentos abaixo vencem' : 'O pagamento abaixo vence') + ' amanhã.',
      'D0': (plural ? 'Os pagamentos abaixo vencem' : 'O pagamento abaixo vence') + ' hoje.',
      'D+1': 'Identificamos que ' + (plural ? 'os pagamentos abaixo venceram e ainda não constam como recebidos.' : 'o pagamento abaixo venceu e ainda não consta como recebido.'),
      'manual': (plural ? 'Seguem os pagamentos' : 'Segue o pagamento') + ' em aberto da sua empresa.',
    } : {
      'D-5': 'Este é um lembrete: ' + (plural ? 'os boletos abaixo estão para vencer.' : 'o boleto abaixo está para vencer.'),
      'D-1': (plural ? 'Os boletos abaixo vencem' : 'O boleto abaixo vence') + ' amanhã.',
      'D0': (plural ? 'Os boletos abaixo vencem' : 'O boleto abaixo vence') + ' hoje.',
      'D+1': 'Identificamos que ' + (plural ? 'os boletos abaixo venceram e ainda não constam como pagos.' : 'o boleto abaixo venceu e ainda não consta como pago.'),
      'manual': (plural ? 'Seguem os boletos' : 'Segue o boleto') + ' em aberto da sua empresa.',
    })[etapa] || (algumSem ? 'Seguem os pagamentos em aberto da sua empresa.' : 'Seguem os boletos em aberto da sua empresa.');
    const assunto = (algumSem ? {
      'D-5': 'Lembrete: pagamento próximo do vencimento',
      'D-1': 'Seu pagamento vence amanhã',
      'D0': 'Seu pagamento vence hoje',
      'D+1': 'Pagamento vencido — regularize',
      'manual': 'Pagamentos em aberto',
    } : {
      'D-5': 'Lembrete: boleto próximo do vencimento',
      'D-1': 'Seu boleto vence amanhã',
      'D0': 'Seu boleto vence hoje',
      'D+1': 'Boleto vencido — regularize o pagamento',
      'manual': 'Boletos em aberto',
    })[etapa] + ' — ' + razao;
    const linhas = boletos.map((b) => {
      let l = '• ' + [b.numero_documento ? 'NF ' + b.numero_documento : null, b.numero_parcela ? 'parcela ' + b.numero_parcela : null].filter(Boolean).join(' · ')
        + ' — vencimento ' + dataBR(b.data_vencimento) + ' — ' + moedaBR(b.valor);
      if (b.tem_boleto === false) l += '\n  Sem boleto — pague pela forma combinada.';
      else if (b.linha_digitavel) l += '\n  Linha digitável: ' + b.linha_digitavel;
      return l;
    });
    const texto = 'Olá,\n\n' + intro + '\n\n' + linhas.join('\n') + '\n\n'
      + 'Se o pagamento já foi feito, responda este e-mail com o comprovante. Em caso de dúvida, é só responder.\n\n'
      + 'Financeiro — VerticalParts';
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
