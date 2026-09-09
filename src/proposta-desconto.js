/* ============================================================
   proposta-desconto.js — desconto por equipamento com histórico +
   aprovação por alçada (Frentes B + C do estudo do editor de Proposta).

   Regra combinada com o usuário:
   - valorOriginal do item nunca é sobrescrito (nasce em proposta-heranca.js,
     congelado) — só valorUnit (o valor ATUAL, com desconto aplicado) muda.
   - Desconto até 7% (sobre o valorOriginal do item): decide o Gestor
     Comercial sozinho. Acima de 7%: só o CEO. CEO sempre pode decidir,
     mesmo os ≤7% que normalmente iriam pro Gestor.
   - Nada é aplicado na hora — vira um pedido pendente (uma linha em
     decisoes_gerenciais, reaproveitando a Central de Decisões que já
     existe) até alguém com a alçada certa aprovar ou reprovar.
   - Toda decisão (pedido, aprovação, reprovação, remoção) fica gravada em
     item.descontoLog — histórico visível na proposta, pro cliente ou pra
     VerticalParts, mesmo depois de anos.

   window.PropostaDesconto
   ============================================================ */
(function () {
  'use strict';

  const LIMITE_GESTOR_PCT = 0.07; // acima disso, só o CEO decide

  function parseNum(v) {
    return parseFloat((v ?? '0').toString().replace(/\./g, '').replace(',', '.')) || 0;
  }

  function meuEmail() { return ((window.__VP_USER || {}).email || '').trim().toLowerCase(); }

  /* Percentual equivalente do desconto sobre o valorOriginal do item —
     usado só pra decidir qual alçada é exigida, não pra exibir. */
  function pctDoDesconto(item, tipo, valor) {
    const original = parseNum(item.valorOriginal ?? item.valorUnit);
    if (!original) return 0;
    if (tipo === 'percentual') return (Number(valor) || 0) / 100;
    return parseNum(valor) / original;
  }

  function papelParaPct(pct) {
    return pct <= LIMITE_GESTOR_PCT ? 'gestor_comercial' : 'ceo';
  }

  /* Recalcula valorUnit a partir de valorOriginal + desconto ativo (ou
     restaura valorOriginal se desconto for null). Nunca toca valorOriginal. */
  function aplicarDesconto(item, desconto) {
    const original = parseNum(item.valorOriginal ?? item.valorUnit);
    let novoValor = original;
    if (desconto) {
      const abate = desconto.tipo === 'percentual'
        ? original * ((Number(desconto.valor) || 0) / 100)
        : parseNum(desconto.valor);
      novoValor = Math.max(0, original - abate);
    }
    return { ...item, valorUnit: String(Math.round(novoValor)), desconto: desconto || null };
  }

  /* Solicita desconto pra 1 item — cria a decisão roteada pela alçada certa
     e devolve o item marcado como "pendente" (nada muda de preço ainda). */
  async function solicitar(proposta, item, { tipo, valor, motivo }) {
    if (!window.DecisoesStore) throw new Error('Central de Decisões não carregada.');
    if (!(Number(valor) > 0)) throw new Error('Informe um valor de desconto maior que zero.');
    const pct = pctDoDesconto(item, tipo, valor);
    if (pct >= 1) throw new Error('Esse desconto zera ou passa do valor original do equipamento.');
    const papel = papelParaPct(pct);
    const solicitante = meuEmail() || null;
    const original = parseNum(item.valorOriginal ?? item.valorUnit);
    const clienteNome = (proposta.cliente && proposta.cliente.nome) || proposta.titulo || '';
    /* numeroCotacao pode chegar como inteiro puro ("950") ou Master ID
       completo ("VPCT-0950") — decisoes_gerenciais.numero_cotacao é integer,
       então sempre passa pelo mesmo parser usado no resto do app. */
    const numeroCotacaoBruto = proposta.numeroCotacao ?? proposta.numero_cotacao ?? null;
    const numeroCotacao = window.MasterIdEngine ? window.MasterIdEngine.parseNumeroCotacao(numeroCotacaoBruto) : (Number(numeroCotacaoBruto) || null);
    const decisao = await window.DecisoesStore.criarDecisao({
      tipo: 'desconto_proposta',
      papelRequerido: papel,
      numeroCotacao,
      referenciaTabela: 'propostas',
      referenciaId: proposta.id || null,
      contexto: {
        titulo: `Desconto — ${item.id || item.equipamento || 'equipamento'}${clienteNome ? ' · ' + clienteNome : ''}`,
        item: item.id || null,
        valor_original: original,
        desconto_tipo: tipo,
        desconto_valor: Number(valor),
        pct_equivalente: pct,
        solicitante,
        valor: original * (1 - pct),
      },
    });
    const agora = new Date().toISOString();
    const pendente = { tipo, valor: Number(valor), motivo: motivo || '', solicitadoPor: solicitante, solicitadoEm: agora, decisaoId: decisao.id, papel };
    const log = [...(item.descontoLog || []), {
      em: agora, por: solicitante, acao: 'solicitado', tipo, valor: Number(valor), motivo: motivo || '', decisaoId: decisao.id,
    }];
    return { ...item, descontoPendente: pendente, descontoLog: log };
  }

  /* Confere se a decisão pendente de um item já foi decidida — se sim,
     aplica (aprovada) ou limpa sem aplicar (reprovada), registrando no log.
     Se ainda pendente, ou sem pedido nenhum, devolve o item como está. */
  async function reconciliar(item, numeroCotacao) {
    if (!item.descontoPendente || !window.DecisoesStore || numeroCotacao == null) return item;
    const decisoes = await window.DecisoesStore.listarPorCotacao(numeroCotacao);
    const decisao = decisoes.find((d) => d.id === item.descontoPendente.decisaoId);
    if (!decisao || decisao.status === 'pendente' || decisao.status === 'bloqueada_por_dependencia') return item;
    const pend = item.descontoPendente;
    const logEntry = {
      em: decisao.decidido_em || new Date().toISOString(), por: decisao.decidido_por || null,
      acao: decisao.status === 'aprovada' ? 'aprovado' : 'reprovado',
      tipo: pend.tipo, valor: pend.valor, motivo: decisao.motivo || '', decisaoId: decisao.id,
    };
    const log = [...(item.descontoLog || []), logEntry];
    if (decisao.status === 'aprovada') {
      const aplicado = aplicarDesconto(item, {
        tipo: pend.tipo, valor: pend.valor, motivo: pend.motivo,
        concedidoPor: decisao.decidido_por, concedidoEm: decisao.decidido_em, decisaoId: decisao.id,
      });
      return { ...aplicado, descontoPendente: null, descontoLog: log };
    }
    return { ...item, descontoPendente: null, descontoLog: log };
  }

  /* Remove um desconto já ATIVO, restaurando valorUnit = valorOriginal — só
     aumenta o preço de volta, então não precisa de aprovação pra isso,
     só pra CONCEDER. Fica registrado no log do mesmo jeito. */
  function removerDesconto(item) {
    const por = meuEmail() || null;
    const anterior = item.desconto || {};
    const log = [...(item.descontoLog || []), {
      em: new Date().toISOString(), por, acao: 'removido', tipo: anterior.tipo, valor: anterior.valor, motivo: '',
    }];
    return { ...aplicarDesconto(item, null), descontoLog: log };
  }

  window.PropostaDesconto = {
    LIMITE_GESTOR_PCT, parseNum, pctDoDesconto, papelParaPct,
    aplicarDesconto, solicitar, reconciliar, removerDesconto,
  };
}());
