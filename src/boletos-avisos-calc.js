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
     dia útil. Sem boleto o aviso de atraso sai no 2º dia útil (conciliação manual). */
  function datasDasEtapas(vencISO, semBoleto, feriados) {
    const efetivo = vencimentoEfetivo(vencISO, feriados);
    const atraso1 = proximoDiaUtil(somarDias(efetivo, 1), feriados);
    return {
      'D-5': proximoDiaUtil(somarDias(vencISO, -5), feriados),
      'D-1': diaUtilAnterior(efetivo, feriados),
      'D0': efetivo,
      'D+1': semBoleto ? proximoDiaUtil(somarDias(atraso1, 1), feriados) : atraso1,
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
  function montarAviso(razao, boletos, etapa, feriados) {
    // Textos aprovados pelo Gelson em 17/11/2026 (mantém "encargos"; sem telefone e sem dados bancários).
    const plural = boletos.length > 1;
    const algumSem = boletos.some((b) => b.tem_boleto === false);
    const pl = (sing, plur) => (plural ? plur : sing);
    const item = algumSem ? pl('pagamento', 'pagamentos') : pl('boleto', 'boletos');
    const vence = pl('vence', 'vencem');
    const vencEmDiaSemExpediente = boletos.every((b) => !diaUtil(b.data_vencimento, feriados));
    const intro = {
      'D-5': 'Olá, tudo bem?\n\nPassando para lembrar que ' + pl('o ', 'os ') + item + ' abaixo ' + vence + ' em 5 dias:',
      'D-1': 'Olá,\n\n' + pl('O ', 'Os ') + item + ' abaixo ' + vence + ' amanhã:',
      'D0': 'Olá,\n\n' + pl('O ', 'Os ') + item + ' abaixo ' + (vencEmDiaSemExpediente
        ? pl('venceu', 'venceram') + ' em dia sem expediente bancário e ' + pl('pode', 'podem') + ' ser '
          + (algumSem ? pl('feito', 'feitos') : pl('pago', 'pagos')) + ' hoje sem encargos:'
        : vence + ' hoje:'),
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
      'D0': 'Se o pagamento já foi feito, obrigado e desconsidere esta mensagem.'
        + (algumSem ? '' : '\nSe precisar da 2ª via, responda este e-mail.'),
      'D+1': 'Se já pagou: responda este e-mail com o comprovante' + (algumSem ? ' do depósito ou da transferência' : '') + ' para darmos baixa.\n'
        + 'Se ainda não pagou: solicitamos a regularização imediata, sujeita aos encargos por atraso.'
        + (algumSem ? '' : ' A 2ª via atualizada pode ser solicitada respondendo este e-mail.'),
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

  /* ---- Erros de envio e envios do dia (19/11/2026, pedido do Gelson) ----
     Dois tipos de e-mail que "não chegou": (a) FALHA nossa: o envio ficou com status 'erro'; (b) DEVOLVIDO: o servidor do cliente
     devolveu ("Não é possível entregar", do postmaster). No caso (b) o envio fica 'enviado': só a resposta no Inbox mostra o erro. */
  function ehDevolucao(email) {
    const de = String((email && email.de_email) || '').toLowerCase();
    const assunto = String((email && email.assunto) || '');
    if (/^(postmaster|mailer-daemon|mail-daemon)@/.test(de)) return true;
    return /n[aã]o [eé] poss[ií]vel entregar|n[aã]o foi poss[ií]vel entregar|undeliverable|delivery status notification|mail delivery (failed|subsystem)|delivery has failed|returned mail|message not delivered|falha na entrega/i.test(assunto);
  }
  /* Cliente com erro = o envio MAIS RECENTE dele falhou ou foi devolvido (devolução de um envio já superado por outro não conta:
     é isso que faz o cliente sair da lista sozinho quando o aviso seguinte é entregue).
     lista: linhas da view (codigo_cliente_omie, ultimo_aviso_em, ultimo_aviso_status);
     devolucoes: [{ envio_id, assunto, para, data }] já filtradas por ehDevolucao;
     envios: [{ id, codigo_cliente_omie, criado_em, para }] dos envios que receberam devolução. */
  function clientesComErro(lista, devolucoes, envios) {
    const porEnvio = new Map((envios || []).map((e) => [e.id, e]));
    const ultimaDevolucao = new Map();   // cliente -> devolução do envio mais recente
    for (const d of devolucoes || []) {
      const e = porEnvio.get(d.envio_id);
      if (!e) continue;
      const atual = ultimaDevolucao.get(e.codigo_cliente_omie);
      if (!atual || String(e.criado_em) > String(atual.envio.criado_em)) ultimaDevolucao.set(e.codigo_cliente_omie, { d, envio: e });
    }
    const out = new Map();
    for (const c of lista || []) {
      const dev = ultimaDevolucao.get(c.codigo_cliente_omie);
      const ehOUltimo = dev && c.ultimo_aviso_em && Date.parse(dev.envio.criado_em) === Date.parse(c.ultimo_aviso_em);
      if (ehOUltimo) out.set(c.codigo_cliente_omie, { tipo: 'devolvido', motivo: dev.d.assunto || 'E-mail devolvido', para: dev.envio.para || [], desde: dev.envio.criado_em });
      else if (c.ultimo_aviso_status === 'erro') out.set(c.codigo_cliente_omie, { tipo: 'falha', motivo: 'Falha no envio', para: [], desde: c.ultimo_aviso_em });
    }
    return out;
  }
  /* Quantos e-mails automáticos foram enviados no dia, por etapa (só 'enviado', fora do modo teste e do envio manual). */
  const ETAPAS_DO_DIA = ['D-5', 'D-1', 'D0', 'D+1'];
  function contarEnviosDoDia(envios, hojeISO) {
    const out = {};
    for (const k of ETAPAS_DO_DIA) out[k] = { emails: 0, clientes: new Set() };
    for (const e of envios || []) {
      if (e.status !== 'enviado' || e.modo_teste || !out[e.etapa]) continue;
      if (hojeBrasil(Date.parse(e.criado_em)) !== hojeISO) continue;
      out[e.etapa].emails++; out[e.etapa].clientes.add(e.codigo_cliente_omie);
    }
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
    diasDesdeVencimento, situacaoDoBoleto, etapaDevida, montarAviso, dataBR, moedaBR, hojeBrasil, resumoFinanceiro,
    conjuntoSemExpediente, diaUtil, vencimentoEfetivo, datasDasEtapas, diasDeAtraso, FAIXAS, faixaDoBoleto, resumoSelecao,
    ehDevolucao, clientesComErro, contarEnviosDoDia, ETAPAS_DO_DIA,
  };
})();
