/* ============================================================
   proposta-opcoes.js — modalidades de entrega da Proposta de Elevador
   (Financeiro, 01/10/2026): com 1 equipamento a Precificação gera 2 preços —
   120 dias (container compartilhado, o menor) e 90 dias (container
   exclusivo) — e a Proposta apresenta as duas; o cliente escolhe uma na
   assinatura e a outra deixa de aparecer.

   Modelo (dentro de data.elevador.valores):
   - o preço de 120 dias é o "oficial" de sempre (valorUnit/itens/difal/parcelas) —
     editor, descontos, total, Contrato e dashboards continuam lendo ele;
   - opcao90 = { valorUnit, difal, formaTipo, qtdParcelas, forma, parcelas } — a alternativa;
   - escolhaEntrega = null | '120' | '90' — preenchida na assinatura. Com '90', os campos
     oficiais passam a ser os da opcao90 (é o que o Contrato herda); opcao90 fica guardada.
   Só aparece com 1 equipamento (com 2+ o container já é dividido: uma opção só).
   Funções puras — sem I/O. window.PropostaOpcoes
   ============================================================ */
(function () {
  'use strict';

  const TEXTOS = {
    '120': {
      titulo: 'Entrega em 120 dias',
      rotulo: 'Container compartilhado',
      caracteristicas: [
        'Seu equipamento viaja em container compartilhado com outros equipamentos, o que divide o custo do frete e resulta no menor preço.',
        'Prazo de entrega: 120 dias.',
      ],
    },
    '90': {
      titulo: 'Entrega em 90 dias',
      rotulo: 'Container exclusivo',
      caracteristicas: [
        'Container exclusivo para o seu equipamento: a entrega é mais rápida, mas o custo integral do frete recai sobre ele.',
        'Prazo de entrega: 90 dias.',
      ],
    },
  };

  const num = (s) => parseFloat(String(s == null ? '0' : s).replace(/\./g, '').replace(',', '.')) || 0;
  const valores = (d, eq) => ((d && d[eq || 'elevador']) || {}).valores || {};

  /* Há duas opções para o cliente decidir? (tem opcao90 válida e ainda não escolheu) */
  function temOpcoes(d, eq) {
    const v = valores(d, eq);
    return !!(v.opcao90 && num(v.opcao90.valorUnit) > 0) && !v.escolhaEntrega;
  }

  /* Há opcao90 guardada (mesmo já escolhida)? */
  function temOpcao90(d, eq) {
    const v = valores(d, eq);
    return !!(v.opcao90 && num(v.opcao90.valorUnit) > 0);
  }

  function visao(id, src, qtd, equipamento) {
    const unit = num(src.valorUnit);
    const difal = num(src.difal);
    const totalEq = unit * qtd;
    const parcelas = src.parcelas || [];
    return {
      id, ...TEXTOS[id],
      equipamento: equipamento || 'Elevador de Passageiros',
      totalEquipamento: totalEq, difal, total: totalEq + difal,
      forma: src.forma || '', parcelas,
      totalParcelas: parcelas.reduce((s, p) => s + num(p.valor), 0),
    };
  }

  /* As duas opções prontas pra exibir ([120, 90]) — null se não houver opcao90. */
  function opcoes(d, eq) {
    const v = valores(d, eq);
    if (!temOpcao90(d, eq)) return null;
    const qtd = num(v.quantidade) || 1;
    return [visao('120', v, qtd, v.equipamento), visao('90', v.opcao90, qtd, v.equipamento)];
  }

  /* Aplica a escolha do cliente: devolve uma cópia de `d` com escolhaEntrega e, no caso de '90',
     os campos oficiais trocados pelos da opcao90. Sem opcao90 (ou escolha inválida) devolve `d` igual. */
  function aplicarEscolha(d, escolha, eq) {
    const chave = eq || 'elevador';
    if (!d || !d[chave] || !temOpcao90(d, chave)) return d;
    if (escolha !== '120' && escolha !== '90') return d;
    const v = d[chave].valores || {};
    // Escolha já aplicada: idempotente (não troca os campos de novo).
    if (v.escolhaEntrega) return d;
    let nv = { ...v, escolhaEntrega: escolha };
    if (escolha === '90') {
      const o = v.opcao90;
      nv = { ...nv, valorUnit: o.valorUnit, difal: o.difal, formaTipo: o.formaTipo, qtdParcelas: o.qtdParcelas, forma: o.forma, parcelas: o.parcelas };
    }
    return { ...d, [chave]: { ...d[chave], valores: nv } };
  }

  /* Total (equipamentos) do que está "oficial" agora — igual a calcularValorTotal do editor,
     sem o DIFAL; usado pra gravar valor_total depois da escolha. */
  function totalOficial(d, eq) {
    const v = valores(d, eq);
    if (Array.isArray(v.itens) && v.itens.length) return v.itens.reduce((s, it) => s + num(it.valorUnit) * (Number(it.quantidade) || 1), 0);
    return num(v.valorUnit) * (Number(v.quantidade) || 1);
  }

  /* Texto curto da modalidade escolhida (null se não houve escolha). */
  function modalidadeEscolhida(d, eq) {
    const e = valores(d, eq).escolhaEntrega;
    return e && TEXTOS[e] ? { id: e, titulo: TEXTOS[e].titulo, rotulo: TEXTOS[e].rotulo } : null;
  }

  /* Opção 90 a partir do resultado V2 exclusivo da Precificação (1 equipamento). `parcelasFn`
     gera as parcelas no mesmo template da proposta (sinal 40% + resto igual). */
  function montarOpcao90({ precoVendaPorEquipamento, difal, qtdParcelas, parcelasFn }) {
    const unit = Math.round(Number(precoVendaPorEquipamento) || 0);
    if (!(unit > 0)) return null;
    const dif = Math.round(Number(difal) || 0);
    const total = unit + dif;
    const qtd = qtdParcelas || 5;
    const rest = Math.max(qtd - 1, 0);
    return {
      valorUnit: String(unit),
      difal: dif ? String(dif) : '',
      formaTipo: 'parcelado',
      qtdParcelas: qtd,
      forma: rest > 0 ? `40% à vista e ${rest} parcela${rest > 1 ? 's' : ''}` : '100% à vista',
      parcelas: parcelasFn ? parcelasFn(qtd, total) : [],
    };
  }

  window.PropostaOpcoes = { TEXTOS, temOpcoes, temOpcao90, opcoes, aplicarEscolha, totalOficial, modalidadeEscolhida, montarOpcao90, _num: num };
}());
