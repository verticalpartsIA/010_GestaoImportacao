/* ============================================================
   proposta-aumento-calc.js — pedido de AUMENTO de valor da proposta, que
   volta ao Financeiro (regras PURAS, sem tela e sem banco).

   Regra combinada com o Gelson (06/11/2026):
   - O Comercial NÃO digita preço na proposta: impostos, DIFAL e encargos só
     recalculam juntos na Precificação. O botão "Alterar valor" só PEDE o valor;
     a Juliana ajusta na Precificação e a Regiane/dono clica em "Herdar Dados".
   - Vale por equipamento e pela proposta inteira (valor total).
   - Aumento: sem aprovação (só melhora a margem). Proposta travada não bloqueia.
   - 13/11/2026 (Gelson) — DESCONTO = o mesmo fluxo, para BAIXO: o Comercial pede o valor menor, o Financeiro avalia na
     Precificação e ACEITA (ajusta e calcula; o preço novo chega à proposta) ou RECUSA com motivo. Sem aprovação do gestor
     (ele só é avisado) e a proposta fica TRAVADA para envio ao cliente enquanto o pedido de desconto estiver aberto.
   - Um pedido aberto por vez em cada nível; pedido de total e de equipamento
     não convivem. O pedido guarda `tipo` ('aumento' | 'desconto'; sem o campo = aumento).
   - "Atendido" só quando o preço da Precificação ficou DIFERENTE do que era
     no momento do pedido (salvar sem mudar o preço não avisa ninguém).
   - Histórico em aumentoLog (nunca apagado), no estilo de descontoLog.

   O que o pedido guarda (item ou proposta):
     aumentoPendente = { tipo, valorPedido, valorAtual, motivo, solicitadoPor, solicitadoEm }
     aumentoLog      = [{ em, por, acao: 'solicitado'|'cancelado'|'atendido'|'recusado', ... }]

   window.PropostaAumento
   ============================================================ */
(function () {
  'use strict';

  function parseNum(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    return parseFloat((v ?? '0').toString().replace(/\./g, '').replace(',', '.')) || 0;
  }

  function arred(n) { return Math.round(n * 100) / 100; }

  function brl(n) {
    return 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* Confere o valor digitado. `modo` 'aumento' só aceita valor MAIOR que o atual; 'desconto' só MENOR; sem modo infere
     pela direção. Devolve `tipo` e a variação (em módulo; `variacaoRs` positiva). */
  function validarPedido(valorAtual, valorPedido, modo) {
    const atual = parseNum(valorAtual);
    const pedido = parseNum(valorPedido);
    if (!(pedido > 0)) return { ok: false, erro: 'Informe o novo valor.' };
    if (!(atual > 0)) return { ok: false, erro: 'Não há valor atual para comparar.' };
    if (arred(pedido) === arred(atual)) return { ok: false, erro: 'O valor pedido é igual ao atual.' };
    if (modo === 'aumento' && pedido < atual) {
      return { ok: false, erro: 'Para reduzir o valor use "Solicitar desconto". Aqui só é possível aumentar.' };
    }
    if (modo === 'desconto' && pedido > atual) {
      return { ok: false, erro: 'Para aumentar o valor use "Alterar valor". Aqui só é possível pedir desconto.' };
    }
    const tipo = pedido < atual ? 'desconto' : 'aumento';
    return { ok: true, tipo, variacaoRs: arred(Math.abs(pedido - atual)), variacaoPct: Math.abs(pedido - atual) / atual, valorPedido: arred(pedido), valorAtual: arred(atual) };
  }

  /* Por que um alvo (item ou proposta) NÃO aceita pedido agora. null = aceita. */
  function bloqueio(alvo, ctx) {
    ctx = ctx || {};
    if (alvo.aumentoPendente) return 'Já existe um pedido de alteração de valor aguardando o Financeiro.';
    if (alvo.descontoPendente) return 'Resolva o pedido de desconto antigo (aprovação por alçada) antes de pedir alteração de valor.';
    if (alvo.oculto) return 'Equipamento oculto da proposta: reexiba antes de pedir aumento.';
    if (ctx.contratoAssinado) return 'Já existe contrato assinado desta proposta. Fale com o Jurídico antes de alterar o valor.';
    if (ctx.outroNivelPendente) return 'Há outro pedido de valor aberto nesta proposta (total ou de outro equipamento). Cancele ou aguarde o Financeiro.';
    return null;
  }

  function entradaLog(acao, por, agora, extra) {
    return Object.assign({ em: agora, por: por || null, acao }, extra || {});
  }

  /* Abre o pedido. Devolve uma CÓPIA do alvo com aumentoPendente + log. */
  function solicitar(alvo, { valorAtual, valorPedido, motivo, por, agora, precificacaoBase, modo }, ctx) {
    const b = bloqueio(alvo, ctx);
    if (b) throw new Error(b);
    const v = validarPedido(valorAtual, valorPedido, modo);
    if (!v.ok) throw new Error(v.erro);
    const quando = agora || new Date().toISOString();
    const pendente = {
      tipo: v.tipo, valorPedido: v.valorPedido, valorAtual: v.valorAtual, motivo: (motivo || '').trim(),
      solicitadoPor: por || null, solicitadoEm: quando,
    };
    /* Preço da PRECIFICAÇÃO no momento do pedido: é com ele que se decide se o Financeiro mudou algo
       (a proposta pode estar defasada em relação à Precificação — caso VPPR-0993). */
    if (Number(precificacaoBase) > 0) pendente.precificacaoBase = arred(Number(precificacaoBase));
    const log = [...(alvo.aumentoLog || []), entradaLog('solicitado', por, quando, {
      tipo: v.tipo, valorAtual: v.valorAtual, valorPedido: v.valorPedido, motivo: pendente.motivo,
    })];
    return { ...alvo, aumentoPendente: pendente, aumentoLog: log };
  }

  /* Cancela enquanto o Financeiro não atendeu. */
  function cancelar(alvo, por, agora) {
    if (!alvo.aumentoPendente) throw new Error('Não há pedido de valor aberto.');
    const quando = agora || new Date().toISOString();
    const p = alvo.aumentoPendente;
    const log = [...(alvo.aumentoLog || []), entradaLog('cancelado', por, quando, {
      tipo: p.tipo || 'aumento', valorAtual: p.valorAtual, valorPedido: p.valorPedido,
    })];
    return { ...alvo, aumentoPendente: null, aumentoLog: log };
  }

  /* O Financeiro RECUSA o pedido (13/11/2026 — "a Precificação pode barrar o desconto"). Motivo obrigatório (≥ 3 letras);
     o preço não muda; o pedido some e o histórico guarda quem recusou e por quê. */
  function recusar(alvo, { motivo, por, agora }) {
    if (!alvo.aumentoPendente) throw new Error('Não há pedido de valor aberto.');
    const m = (motivo || '').trim();
    if (m.length < 3) throw new Error('Informe o motivo da recusa (o Comercial vai ler).');
    const quando = agora || new Date().toISOString();
    const p = alvo.aumentoPendente;
    const log = [...(alvo.aumentoLog || []), entradaLog('recusado', por, quando, {
      tipo: p.tipo || 'aumento', valorAtual: p.valorAtual, valorPedido: p.valorPedido, motivo: m,
    })];
    return { ...alvo, aumentoPendente: null, aumentoLog: log };
  }

  /* A Precificação foi salva. `valorNaPrecificacao` é o preço dela (do
     equipamento ou total, conforme o nível do pedido). Só vira "atendido" se
     o preço MUDOU em relação ao do momento do pedido. */
  function atender(alvo, valorNaPrecificacao, por, agora) {
    const p = alvo.aumentoPendente;
    if (!p) return { alvo, atendido: false };
    const novo = parseNum(valorNaPrecificacao);
    /* Só conta como atendido se a Precificação mudou em relação à BASE do pedido (caso VPPR-0993: a proposta pode
       estar defasada em relação à Precificação, e isso não é o Financeiro atendendo o pedido). */
    if (!(novo > 0) || !precificacaoMudou(p, novo)) return { alvo, atendido: false };
    const quando = agora || new Date().toISOString();
    const log = [...(alvo.aumentoLog || []), entradaLog('atendido', por, quando, {
      tipo: p.tipo || 'aumento', valorAnterior: p.valorAtual, valorPedido: p.valorPedido, valorNovo: arred(novo),
    })];
    return { alvo: { ...alvo, aumentoPendente: null, aumentoLog: log }, atendido: true, valorNovo: arred(novo), valorPedido: p.valorPedido, tipo: p.tipo || 'aumento' };
  }

  /* "Herdar Dados" troca a lista de equipamentos pela da Precificação: os itens
     novos nascem sem pedido nem histórico. Esta função leva o histórico dos
     itens antigos (mesmo id) para os novos e fecha o pedido que o novo preço
     atendeu. Devolve { itens, atendidos[] } — atendidos alimenta o aviso de volta.
     Pedido cujo preço NÃO mudou continua aberto no item novo. */
  function migrarAposHerdar(itensAntigos, itensNovos, por, agora) {
    const antigos = new Map((itensAntigos || []).map((it) => [it && it.id, it]));
    const atendidos = [];
    const itens = (itensNovos || []).map((novo) => {
      const velho = antigos.get(novo && novo.id);
      if (!velho || (!velho.aumentoLog && !velho.aumentoPendente)) return novo;
      let alvo = { ...novo, aumentoLog: velho.aumentoLog || [], aumentoPendente: velho.aumentoPendente || null };
      if (alvo.aumentoPendente) {
        const precoNovo = parseNum(novo.valorUnit);
        const r = atender(alvo, precoNovo, por, agora);
        alvo = r.alvo;
        if (r.atendido) atendidos.push({ id: novo.id, tipo: r.tipo, valorAnterior: velho.aumentoPendente.valorAtual, valorPedido: r.valorPedido, valorNovo: r.valorNovo });
        else if (precoNovo > 0) alvo = { ...alvo, aumentoPendente: { ...alvo.aumentoPendente, valorAtual: arred(precoNovo) } };
      }
      return alvo;
    });
    return { itens, atendidos };
  }

  /* Preço da Precificação com o qual o pedido deve ser comparado: o do momento do pedido; nos pedidos antigos
     (sem essa base), o último valor já avisado; e, em último caso, o valor da proposta. */
  function baseDoPedido(pedido) {
    const p = pedido || {};
    return Number(p.precificacaoBase) > 0 ? Number(p.precificacaoBase)
      : (Number(p.precificacaoValor) > 0 ? Number(p.precificacaoValor) : Number(p.valorAtual) || 0);
  }

  /* A Precificação mudou de verdade em relação à base do pedido? */
  function precificacaoMudou(pedido, valorNaPrecificacao) {
    const novo = parseNum(valorNaPrecificacao);
    return novo > 0 && Math.abs(novo - baseDoPedido(pedido)) >= 0.01;
  }

  /* Total que a proposta terá se TODOS os pedidos abertos forem atendidos:
     total atual + soma das diferenças pedidas (ou o valor pedido, no pedido da proposta inteira). */
  function alvoTotal(propostaTotal, pedidos) {
    const total = parseNum(propostaTotal);
    const lista = pedidos || [];
    const daProposta = lista.find((x) => x.nivel === 'proposta');
    if (daProposta) return arred(Number(daProposta.pedido.valorPedido) || 0);
    return arred(total + lista.reduce((s, x) => s + ((Number(x.pedido.valorPedido) || 0) - (Number(x.pedido.valorAtual) || 0)), 0));
  }

  /* REGRA do Gelson (06/11/2026): reprecificou, a proposta herda. Aplica à proposta (bloco elevador) os valores novos
     que a Precificação gerou (`valoresNovos`, o que o PropostaHeranca monta). Decisões do Gelson:
     - o preço novo entra SEM desconto: o desconto aplicado do equipamento cujo preço mudou é retirado (fica no
       histórico) e, se for preciso, o desconto é pedido de novo sobre o preço novo; equipamento cujo preço NÃO mudou
       fica exatamente como estava (com o desconto);
     - pedido de desconto ainda pendente segue pendente;
     - ocultos e escolhas do vendedor ficam; parcelas são refeitas no padrão (sinal de 40% + iguais), mantendo a forma
       de pagamento e a quantidade de parcelas que a proposta já tinha;
     - pedido de aumento: fecha o que a Precificação atendeu (mudou em relação à base do pedido).
     Pura: devolve { mudou, valores, propostaAtendida, atendidos, total, totalAnterior }. */
  function aplicarNovosValores(dataAtual, valoresNovos, opts) {
    const o = opts || {};
    const O = o.opcoes || (typeof window !== 'undefined' ? window.PropostaOpcoes : null);
    const d = dataAtual || {};
    const v = (d.elevador && d.elevador.valores) || {};
    const novos = Array.isArray(valoresNovos && valoresNovos.itens) ? valoresNovos.itens : [];
    const antigos = Array.isArray(v.itens) ? v.itens : [];
    const porId = new Map(antigos.map((it) => [it && it.id, it]));
    const quando = o.agora || new Date().toISOString();
    const por = o.por || null;
    const atendidos = [];
    let mudou = novos.length !== antigos.length;
    const itens = novos.map((novo) => {
      const velho = porId.get(novo.id);
      if (!velho) { mudou = true; return novo; }
      const semDesconto = parseNum(velho.valorOriginal != null ? velho.valorOriginal : velho.valorUnit);
      if (Math.abs(parseNum(novo.valorUnit) - semDesconto) < 0.005) return velho; // preço não mudou: fica como está
      mudou = true;
      const log = [...(velho.descontoLog || [])];
      if (velho.desconto) log.push(entradaLog('removido', por, quando, { tipo: velho.desconto.tipo, valor: velho.desconto.valor, motivo: 'preço reprecificado pelo Financeiro' }));
      let item = { ...novo, desconto: null, descontoPendente: velho.descontoPendente || null, descontoLog: log,
        aumentoPendente: velho.aumentoPendente || null, aumentoLog: velho.aumentoLog || [] };
      if (item.aumentoPendente) {
        const r = atender(item, parseNum(novo.valorUnit), por, quando);
        item = r.alvo;
        if (r.atendido) atendidos.push({ id: novo.id, tipo: r.tipo, valorAnterior: velho.aumentoPendente.valorAtual, valorPedido: r.valorPedido, valorNovo: r.valorNovo });
        else item = { ...item, aumentoPendente: { ...item.aumentoPendente, valorAtual: arred(parseNum(novo.valorUnit)) } };
      }
      return item;
    });
    const ocultos = new Set(Array.isArray(v.ocultos) ? v.ocultos : []);
    const somaVisivel = (lista) => lista.filter((it) => !ocultos.has(it.id)).reduce((s, it) => s + parseNum(it.valorUnit) * (Number(it.quantidade) || 1), 0);
    const total = arred(somaVisivel(itens));
    const totalAnterior = arred(somaVisivel(antigos));
    if (Math.abs(total - totalAnterior) >= 0.01) mudou = true;
    if (!mudou) return { mudou: false, valores: v, propostaAtendida: null, atendidos: [], total, totalAnterior };

    /* parcelas: mesmo tipo e quantidade que a proposta já tinha, refeitas sobre o total novo */
    const formaTipo = v.formaTipo || (valoresNovos && valoresNovos.formaTipo) || 'parcelado';
    let parcelas = [], forma, qtdParcelas = v.qtdParcelas;
    if (formaTipo === 'vista') { forma = '100% à vista'; }
    else {
      const qtd = Number(v.qtdParcelas) || (Array.isArray(v.parcelas) && v.parcelas.length) || Number(valoresNovos && valoresNovos.qtdParcelas) || 5;
      qtdParcelas = qtd;
      forma = qtd > 1 ? `40% à vista e ${qtd - 1} parcela${qtd - 1 > 1 ? 's' : ''}` : '100% à vista';
      parcelas = O && O.parcelasPadrao ? O.parcelasPadrao(qtd, total) : [];
    }
    let propostaAtendida = null;
    if (d.aumentoPendente) {
      const rp = atender(d, total, por, quando);
      if (rp.atendido) {
        propostaAtendida = { aumentoPendente: null, aumentoLog: rp.alvo.aumentoLog };
        atendidos.push({ id: 'proposta', tipo: rp.tipo, valorAnterior: d.aumentoPendente.valorAtual, valorPedido: rp.valorPedido, valorNovo: rp.valorNovo });
      } else {
        propostaAtendida = { aumentoPendente: { ...d.aumentoPendente, valorAtual: total }, aumentoLog: d.aumentoLog || [] };
      }
    }
    return { mudou: true, valores: { itens, parcelas, formaTipo, qtdParcelas, forma }, propostaAtendida, atendidos, total, totalAnterior };
  }

  /* Há pedido aberto em algum nível da proposta? (proposta inteira ou itens) */
  function pendentesDaProposta(proposta, itens) {
    const lista = [];
    if (proposta && proposta.aumentoPendente) lista.push({ nivel: 'proposta', pedido: proposta.aumentoPendente });
    (itens || []).forEach((it) => {
      if (it && it.aumentoPendente) lista.push({ nivel: 'equipamento', item: it, pedido: it.aumentoPendente });
    });
    return lista;
  }

  /* Pedidos de DESCONTO abertos (13/11/2026): enquanto houver um, a proposta NÃO pode ser enviada ao cliente (decisão do Gelson,
     3A). `proposta` = o objeto de dados (pedido do valor total em `aumentoPendente`); `itens` = linhas de equipamento. */
  function pendentesDeDesconto(proposta, itens) {
    return pendentesDaProposta(proposta, itens).filter((x) => x.pedido && x.pedido.tipo === 'desconto');
  }

  /* Quem recebe o aviso (ida e volta): Financeiro + gestor comercial + dono da
     proposta. Sem repetir e-mail. Quem não tem e-mail é ignorado. */
  function destinatarios({ financeiro, gestores, dono }) {
    const vistos = new Set();
    const saida = [];
    [].concat(financeiro || [], gestores || [], dono || []).forEach((e) => {
      const m = (e || '').toString().trim().toLowerCase();
      if (m && m.includes('@') && !vistos.has(m)) { vistos.add(m); saida.push(m); }
    });
    return saida;
  }

  /* Texto dos avisos. O gi-avisos agrupa por título (apaga números e acentos)
     em 24 h por pessoa: por isso o título leva o CLIENTE e o tipo (equipamento
     ou total), senão dois pedidos no mesmo dia viram um aviso só. */
  function montarAviso(tipo, ctx) {
    const cli = (ctx.cliente || 'cliente').toString().slice(0, 40);
    const alvo = ctx.equipamento ? `equipamento ${ctx.equipamento}` : 'valor total';
    if (tipo === 'ida') {
      const desc = ctx.tipoPedido === 'desconto';
      return {
        // o título muda com o tipo: o gi-avisos agrupa por título, e desconto e aumento do mesmo cliente não podem virar um aviso só
        titulo: `${desc ? 'Desconto pedido' : 'Revisão de valor pedida'} — ${cli} (${alvo})`,
        sub: `${ctx.por || 'O Comercial'} pede ${desc ? 'desconto: de' : 'aumentar de'} ${brl(ctx.valorAtual)} para ${brl(ctx.valorPedido)}`
          + `${ctx.motivo ? ' — motivo: ' + ctx.motivo : ''}. `
          + (desc ? `Aceite ou recuse na Precificação da cotação ${ctx.numeroCotacao || ''} (a proposta fica travada para envio até a resposta).`
            : `Ajuste na Precificação da cotação ${ctx.numeroCotacao || ''}.`),
      };
    }
    if (tipo === 'recusa') {
      return {
        titulo: `Desconto recusado — ${cli} (${alvo})`,
        sub: `O Financeiro recusou o desconto de ${brl(ctx.valorAtual)} para ${brl(ctx.valorPedido)}${ctx.por ? ' (' + ctx.por + ')' : ''}`
          + `${ctx.motivo ? ' — motivo: ' + ctx.motivo : ''}. O valor da proposta não mudou e ela já pode ser enviada.`,
      };
    }
    if (tipo === 'atualizada') {
      return {
        titulo: `Preço da proposta atualizado — ${cli}`,
        sub: `A Precificação foi recalculada e a proposta passou de ${brl(ctx.valorAnterior)} para ${brl(ctx.valorNovo)}. Confira o valor antes de enviar.`,
      };
    }
    if (tipo === 'volta' && Array.isArray(ctx.itens)) {
      /* Um aviso por proposta (e não um por equipamento): lista os primeiros e resume o resto. */
      const lista = ctx.itens.slice(0, 3).map((i) => `${i.id || 'valor total'}: ${brl(i.valorNovo)} (pedido ${brl(i.valorPedido)})`).join('; ');
      const mais = ctx.itens.length > 3 ? ` e mais ${ctx.itens.length - 3}` : '';
      /* aumento: alcançou se o valor novo ficou >= pedido; desconto: alcançou se ficou <= pedido */
      const alcancou = (i) => (i.tipo === 'desconto' ? Number(i.valorNovo) <= Number(i.valorPedido) + 0.01 : Number(i.valorNovo) + 0.01 >= Number(i.valorPedido));
      const todos = ctx.itens.every(alcancou);
      const soDesconto = ctx.itens.every((i) => i.tipo === 'desconto');
      const soAumento = ctx.itens.every((i) => i.tipo !== 'desconto'); // pedido antigo, sem `tipo`, é aumento
      return {
        titulo: `Precificação atualizada — ${cli}`,
        sub: `${todos ? 'O Financeiro atingiu o valor pedido' : (soDesconto ? 'O Financeiro atualizou, mas o desconto ficou menor que o pedido' : (soAumento ? 'O Financeiro atualizou, mas ainda abaixo do pedido' : 'O Financeiro atualizou, mas ficou diferente do pedido'))}. ${lista}${mais}. Abra a proposta e clique em Herdar Dados.`,
      };
    }
    if (tipo === 'volta') {
      return {
        titulo: `Precificação atualizada — ${cli} (${alvo})`,
        sub: `O Financeiro alterou ${brl(ctx.valorAnterior)} para ${brl(ctx.valorNovo)} (pedido: ${brl(ctx.valorPedido)}). Abra a proposta e clique em Herdar Dados.`,
      };
    }
    return {
      titulo: `Contrato precisa ser refeito — ${cli}`,
      sub: `O valor da proposta da cotação ${ctx.numeroCotacao || ''} mudou de ${brl(ctx.valorAnterior)} para ${brl(ctx.valorNovo)} depois do contrato. Refaça o contrato.`,
    };
  }

  window.PropostaAumento = {
    parseNum, brl, validarPedido, bloqueio, solicitar, cancelar, atender,
    recusar, pendentesDeDesconto, pendentesDaProposta, destinatarios, montarAviso, migrarAposHerdar, baseDoPedido, precificacaoMudou, alvoTotal, aplicarNovosValores,
  };
}());
