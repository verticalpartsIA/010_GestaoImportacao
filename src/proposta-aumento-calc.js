/* ============================================================
   proposta-aumento-calc.js — pedido de AUMENTO de valor da proposta, que
   volta ao Financeiro (regras PURAS, sem tela e sem banco).

   Regra combinada com o Gelson (06/11/2026):
   - O Comercial NÃO digita preço na proposta: impostos, DIFAL e encargos só
     recalculam juntos na Precificação. O botão "Alterar valor" só PEDE o valor;
     a Juliana ajusta na Precificação e a Regiane/dono clica em "Herdar Dados".
   - Vale por equipamento e pela proposta inteira (valor total).
   - Sem aprovação (aumentar só melhora a margem). Proposta travada não bloqueia.
   - Um pedido aberto por vez em cada nível; pedido de total e de equipamento
     não convivem. Diminuir é desconto (outro fluxo).
   - "Atendido" só quando o preço da Precificação ficou DIFERENTE do que era
     no momento do pedido (salvar sem mudar o preço não avisa ninguém).
   - Histórico em aumentoLog (nunca apagado), no estilo de descontoLog.

   O que o pedido guarda (item ou proposta):
     aumentoPendente = { valorPedido, valorAtual, motivo, solicitadoPor, solicitadoEm }
     aumentoLog      = [{ em, por, acao: 'solicitado'|'cancelado'|'atendido', ... }]

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

  /* Confere o valor digitado. Só aceita valor MAIOR que o atual. */
  function validarPedido(valorAtual, valorPedido) {
    const atual = parseNum(valorAtual);
    const pedido = parseNum(valorPedido);
    if (!(pedido > 0)) return { ok: false, erro: 'Informe o novo valor.' };
    if (!(atual > 0)) return { ok: false, erro: 'Não há valor atual para comparar.' };
    if (arred(pedido) === arred(atual)) return { ok: false, erro: 'O valor pedido é igual ao atual.' };
    if (pedido < atual) {
      return { ok: false, erro: 'Para reduzir o valor use "Solicitar desconto". Aqui só é possível aumentar.' };
    }
    return { ok: true, variacaoRs: arred(pedido - atual), variacaoPct: (pedido - atual) / atual, valorPedido: arred(pedido), valorAtual: arred(atual) };
  }

  /* Por que um alvo (item ou proposta) NÃO aceita pedido agora. null = aceita. */
  function bloqueio(alvo, ctx) {
    ctx = ctx || {};
    if (alvo.aumentoPendente) return 'Já existe um pedido de aumento aguardando o Financeiro.';
    if (alvo.descontoPendente) return 'Resolva o pedido de desconto antes de pedir aumento.';
    if (alvo.oculto) return 'Equipamento oculto da proposta: reexiba antes de pedir aumento.';
    if (ctx.contratoAssinado) return 'Já existe contrato assinado desta proposta. Fale com o Jurídico antes de alterar o valor.';
    if (ctx.outroNivelPendente) return 'Há outro pedido de aumento aberto nesta proposta (total ou de outro equipamento). Cancele ou aguarde o Financeiro.';
    return null;
  }

  function entradaLog(acao, por, agora, extra) {
    return Object.assign({ em: agora, por: por || null, acao }, extra || {});
  }

  /* Abre o pedido. Devolve uma CÓPIA do alvo com aumentoPendente + log. */
  function solicitar(alvo, { valorAtual, valorPedido, motivo, por, agora }, ctx) {
    const b = bloqueio(alvo, ctx);
    if (b) throw new Error(b);
    const v = validarPedido(valorAtual, valorPedido);
    if (!v.ok) throw new Error(v.erro);
    const quando = agora || new Date().toISOString();
    const pendente = {
      valorPedido: v.valorPedido, valorAtual: v.valorAtual, motivo: (motivo || '').trim(),
      solicitadoPor: por || null, solicitadoEm: quando,
    };
    const log = [...(alvo.aumentoLog || []), entradaLog('solicitado', por, quando, {
      valorAtual: v.valorAtual, valorPedido: v.valorPedido, motivo: pendente.motivo,
    })];
    return { ...alvo, aumentoPendente: pendente, aumentoLog: log };
  }

  /* Cancela enquanto o Financeiro não atendeu. */
  function cancelar(alvo, por, agora) {
    if (!alvo.aumentoPendente) throw new Error('Não há pedido de aumento aberto.');
    const quando = agora || new Date().toISOString();
    const p = alvo.aumentoPendente;
    const log = [...(alvo.aumentoLog || []), entradaLog('cancelado', por, quando, {
      valorAtual: p.valorAtual, valorPedido: p.valorPedido,
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
    if (!(novo > 0) || arred(novo) === arred(p.valorAtual)) return { alvo, atendido: false };
    const quando = agora || new Date().toISOString();
    const log = [...(alvo.aumentoLog || []), entradaLog('atendido', por, quando, {
      valorAnterior: p.valorAtual, valorPedido: p.valorPedido, valorNovo: arred(novo),
    })];
    return { alvo: { ...alvo, aumentoPendente: null, aumentoLog: log }, atendido: true, valorNovo: arred(novo), valorPedido: p.valorPedido };
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
        const r = atender(alvo, parseNum(novo.valorUnit), por, agora);
        alvo = r.alvo;
        if (r.atendido) atendidos.push({ id: novo.id, valorAnterior: velho.aumentoPendente.valorAtual, valorPedido: r.valorPedido, valorNovo: r.valorNovo });
      }
      return alvo;
    });
    return { itens, atendidos };
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
      return {
        titulo: `Revisão de valor pedida — ${cli} (${alvo})`,
        sub: `${ctx.por || 'O Comercial'} pede aumentar de ${brl(ctx.valorAtual)} para ${brl(ctx.valorPedido)}`
          + `${ctx.motivo ? ' — motivo: ' + ctx.motivo : ''}. Ajuste na Precificação da cotação ${ctx.numeroCotacao || ''}.`.trim(),
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
    pendentesDaProposta, destinatarios, montarAviso, migrarAposHerdar,
  };
}());
