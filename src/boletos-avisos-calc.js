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
  function etapaDevida(vencISO, hojeISO, jaEnviadas) {
    const d = diasDesdeVencimento(vencISO, hojeISO);
    const segunda = new Date(hojeISO + 'T12:00:00Z').getUTCDay() === 1;
    let achada = null;
    for (const e of ETAPAS) {
      const atraso = d - e.dias;
      if (atraso === 0 || (segunda && (atraso === 1 || atraso === 2))) achada = e;
    }
    if (!achada || (jaEnviadas || []).includes(achada.cod)) return null;
    return achada.cod;
  }
  function dataBR(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
  function moedaBR(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function montarAviso(razao, boletos, etapa) {
    const plural = boletos.length > 1;
    const intro = {
      'D-5': 'Este é um lembrete: ' + (plural ? 'os boletos abaixo estão para vencer.' : 'o boleto abaixo está para vencer.'),
      'D-1': (plural ? 'Os boletos abaixo vencem' : 'O boleto abaixo vence') + ' amanhã.',
      'D0': (plural ? 'Os boletos abaixo vencem' : 'O boleto abaixo vence') + ' hoje.',
      'D+1': 'Identificamos que ' + (plural ? 'os boletos abaixo venceram e ainda não constam como pagos.' : 'o boleto abaixo venceu e ainda não consta como pago.'),
      'manual': (plural ? 'Seguem os boletos' : 'Segue o boleto') + ' em aberto da sua empresa.',
    }[etapa] || 'Seguem os boletos em aberto da sua empresa.';
    const assunto = {
      'D-5': 'Lembrete: boleto próximo do vencimento',
      'D-1': 'Seu boleto vence amanhã',
      'D0': 'Seu boleto vence hoje',
      'D+1': 'Boleto vencido — regularize o pagamento',
      'manual': 'Boletos em aberto',
    }[etapa] + ' — ' + razao;
    const linhas = boletos.map((b) => {
      let l = '• ' + [b.numero_documento ? 'NF ' + b.numero_documento : null, b.numero_parcela ? 'parcela ' + b.numero_parcela : null].filter(Boolean).join(' · ')
        + ' — vencimento ' + dataBR(b.data_vencimento) + ' — ' + moedaBR(b.valor);
      if (b.linha_digitavel) l += '\n  Linha digitável: ' + b.linha_digitavel;
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
  const ETAPA_ROTULO = { 'D-5': '5 dias antes', 'D-1': '1 dia antes', 'D0': 'No dia', 'D+1': '1 dia depois', manual: 'Manual' };

  function hojeBrasil(agora) { return new Date((agora || Date.now()) - 3 * 3600e3).toISOString().slice(0, 10); }

  return {
    ETAPAS, SITUACOES, ETAPA_ROTULO,
    diasDesdeVencimento, situacaoDoBoleto, etapaDevida, montarAviso, dataBR, moedaBR, hojeBrasil,
  };
})();
