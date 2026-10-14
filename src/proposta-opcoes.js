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
    /* DIFAL não aparece na proposta (Financeiro, 13/10/2026): o preço já o contém. */
    const difal = 0;
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
      nv = { ...nv, valorUnit: o.valorUnit, difal: '', formaTipo: o.formaTipo, qtdParcelas: o.qtdParcelas, forma: o.forma, parcelas: o.parcelas };
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
  function montarOpcao90({ precoVendaPorEquipamento, qtdParcelas, parcelasFn }) {
    const unit = Math.round(Number(precoVendaPorEquipamento) || 0);
    if (!(unit > 0)) return null;
    const total = unit;
    const qtd = qtdParcelas || 5;
    const rest = Math.max(qtd - 1, 0);
    return {
      valorUnit: String(unit),
      difal: '',
      formaTipo: 'parcelado',
      qtdParcelas: qtd,
      forma: rest > 0 ? `40% à vista e ${rest} parcela${rest > 1 ? 's' : ''}` : '100% à vista',
      parcelas: parcelasFn ? parcelasFn(qtd, total) : [],
    };
  }

  /* Uma linha por EQUIPAMENTO FÍSICO (pedido do Financeiro, 10/10/2026): "Preços dos Equipamentos" mostra
     os 27 elevadores de uma proposta de 27, cada um com seu valor unitário — nunca "6 × valor" numa linha só.
     O código de cada um vem de data.ativos (VPEL-EL0963-1…N) pelo `unidadeId` do item; item sem `unidadeId`
     (proposta herdada antes desta regra) cai em "<código> (k/N)". `original` só existe com desconto ativo. */
  function linhasUnitarias(d, eq) {
    const v = valores(d, eq);
    const ativos = Array.isArray(d && d.ativos) ? d.ativos : [];
    const fonte = (Array.isArray(v.itens) && v.itens.length) ? v.itens : [v];
    const out = [];
    fonte.forEach((it) => {
      const qtd = Math.max(1, Math.round(parseFloat(it.quantidade) || 1));
      const unit = num(it.valorUnit);
      const orig = it.valorOriginal != null ? num(it.valorOriginal) : null;
      const original = (it.desconto && orig != null && orig > unit) ? orig : null;
      const codigos = it.unidadeId
        ? ativos.filter((a) => a.unidadeId === it.unidadeId)
            .sort((a, b) => (Number(a.equipamentoIndice) || 0) - (Number(b.equipamentoIndice) || 0))
            .map((a) => a.codigo || a.identificador).filter(Boolean)
        : [];
      const nome = it.equipamento || 'Elevador de Passageiros';
      if (qtd === 1 || codigos.length === qtd) {
        for (let k = 0; k < qtd; k++) out.push({ equipamento: codigos.length === qtd ? codigos[k] : nome, unit, original, total: unit });
      } else {
        // Sem os códigos físicos (proposta antiga): nunca inventa numeração — 1 linha agregada, com a quantidade.
        out.push({ equipamento: `${nome} — ${qtd} un.`, unit, original: original != null ? original * qtd : null, total: unit * qtd });
      }
    });
    return out;
  }

  /* Especificações na ordem dos códigos dos equipamentos (…-1, -2, … -27), não na ordem das Unidades do Formulário. */
  function ordenarEspecs(lista) {
    const menor = (s) => {
      const cods = Array.isArray(s && s.codigos) && s.codigos.length ? s.codigos : [s && s.id];
      const ns = cods.map((c) => { const m = /-(\d+)$/.exec(String(c || '')); return m ? Number(m[1]) : Infinity; });
      return Math.min(...ns);
    };
    return (Array.isArray(lista) ? lista.slice() : []).sort((a, b) => menor(a) - menor(b));
  }

  /* Tabela-resumo "Prezados Senhores(as)": UMA linha por equipamento físico (código único), com modelo, capacidade e
     Andares / Paradas / Portas. "09/09/09" é esse campo livre do editor (Andares/Paradas/Portas): quando vem como
     três números separados por "/" vira 3 colunas; qualquer outro texto fica inteiro na coluna Paradas. */
  /* Só as PARADAS: "09/09/09" (andares/paradas/portas) vira "9"; texto livre fica como veio. */
  function paradasDe(raw) {
    const r = String(raw || '').trim();
    const m = /^(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)$/.exec(r);
    return m ? String(Number(m[2])) : r;
  }

  /* Linhas da página ACABAMENTO — fonte única de PDF e preview (bug da 985: o PDF lia só o formato antigo fixo
     `acabamentos`, vazio, enquanto o editor grava em `acabamentosCats` — categorias/campos com checkbox "ativo").
     Com acabamentosCats: só entra o campo marcado e preenchido. Sem ele (proposta antiga): o formato fixo. */
  function linhasAcabamento(ed) {
    const e = ed || {};
    if (Array.isArray(e.acabamentosCats) && e.acabamentosCats.length) {
      return e.acabamentosCats.flatMap((c) => (c.campos || []).filter((f) => f.ativo && f.valor).map((f) => [f.nome, f.valor]));
    }
    const a = e.acabamentos || {};
    return [
      ['Modelo da Cabine', a.modeloCabine], ['Acabamentos', a.acabamentoMat], ['Sub-teto', a.subTeto], ['Botoeira de Cabine', a.painelOperacao],
      ['Piso', a.pisoCabina], ['Medidas', a.medidasPiso], ['Porta de Cabine', a.modeloPorta], ['Medidas Porta de Cabine', a.dimPortaCabine],
      ['Modelo de Porta', a.acabPortaCabine], ['Portas de Pavimento', a.portasPavimento], ['Botoeiras de Pavimento', a.botoeirasPavimento],
      ['Sinalização', a.sinalizacao], ['Pavimentos Inox', a.pavInox], ['Demais', a.demais],
    ].filter(([, v]) => v);
  }

  /* Blocos da página AJUSTES E IMPOSTOS — fonte única de PDF e preview. A seção "Ajustes, Impostos e Câmbio" do editor
     tem campos "da página" (clausulaCambial, faturamentoTexto, taxasInclusas, taxasExcluidas) e campos gerais
     (cambio, faturamento, reajuste, taxasIn, taxasOut). Tudo o que o vendedor digitar entra: o campo da página vence;
     vazio, vale o geral (nunca imprime os dois com o mesmo sentido). Preset (Fora do Estado/SP/…) é só interno. */
  function blocosAjustes(ed) {
    const a = (ed && ed.ajustes) || {};
    const cambio = String(a.cambio || '').trim();
    return [
      ['Cláusula de Reajuste Cambial', a.clausulaCambial],
      ['Taxa de Câmbio de Referência (USD)', cambio ? (/^R\$/.test(cambio) ? cambio : 'R$ ' + cambio) : ''],
      ['Faturamento', a.faturamentoTexto || a.faturamento],
      ['Reajuste', a.reajuste],
      ['Taxas e Impostos Inclusos', a.taxasInclusas || a.taxasIn],
      ['Taxas e Impostos Excluídos', a.taxasExcluidas || a.taxasOut],
    ].filter(([, v]) => v && String(v).trim());
  }

  /* Modelos distintos da proposta, na ordem dos códigos: "GEP / GEP-MRL" (título da página do equipamento). */
  function modelosDistintos(especs) {
    const out = [];
    ordenarEspecs(especs).forEach((s) => { if (s && s.modelo && !out.includes(s.modelo)) out.push(s.modelo); });
    return out.join(' / ');
  }

  function resumoEquipamentos(especs) {
    const rows = [];
    (Array.isArray(especs) ? especs : []).forEach((s) => {
      const cods = (Array.isArray(s.codigos) && s.codigos.length) ? s.codigos : [s.id || '—'];
      const paradas = paradasDe(s.andaresParadasPortas) || '—';
      cods.forEach((c) => rows.push({ codigo: c, modelo: s.modelo || '—', capacidade: s.capacidade || '—', paradas }));
    });
    const nc = (r) => { const m = /-(\d+)$/.exec(r.codigo); return m ? Number(m[1]) : Infinity; };
    return rows.sort((a, b) => nc(a) - nc(b));
  }

  /* Total da proposta = soma dos equipamentos. O DIFAL nunca aparece nem soma (Financeiro, 13/10/2026):
     o preço de venda já o contém. `difal` fica 0 só por compatibilidade com quem ainda lê o campo. */
  function totaisValores(d, eq) {
    const totalEq = linhasUnitarias(d, eq).reduce((s, l) => s + l.total, 0);
    return { totalEq, difal: 0, totalGeral: totalEq };
  }

  /* Dinheiro em CENTAVOS exatos (o valor da Precificação tem centavos: R$ 8.961.402,72). Texto no padrão pt-BR
     sem milhar ("257025,50"), que num()/numBR()/calcularValorTotal() leem certo. */
  const c2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
  const textoBR = (x) => c2(x).toFixed(2).replace('.', ',');
  const milharBR = (x) => c2(x).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* Sinal de 40% + parcelas iguais; a ÚLTIMA absorve o centavo que sobra, então a soma é sempre o total exato. */
  function parcelasPadrao(qtd, total) {
    const n = Math.max(1, Number(qtd) || 1);
    const tot = Math.round(c2(total) * 100);
    if (n <= 1) return [{ desc: 'Pagamento integral na assinatura do contrato', valor: milharBR(tot / 100) }];
    const sinal = Math.round(tot * 0.4);
    const rest = n - 1;
    const cada = Math.round((tot - sinal) / rest);
    const linhas = [{ desc: 'Sinal de 40% na assinatura do contrato', valor: milharBR(sinal / 100) }];
    let acumulado = sinal;
    for (let i = 1; i <= rest; i++) {
      const v = i === rest ? tot - acumulado : cada;
      acumulado += v;
      linhas.push({ desc: `${i}ª Parcela`, valor: milharBR(v / 100) });
    }
    return linhas;
  }

  window.PropostaOpcoes = { c2, textoBR, parcelasPadrao, TEXTOS, temOpcoes, temOpcao90, opcoes, aplicarEscolha, totalOficial, modalidadeEscolhida, montarOpcao90, linhasUnitarias, totaisValores, ordenarEspecs, resumoEquipamentos, paradasDe, modelosDistintos, linhasAcabamento, blocosAjustes, _num: num };
}());
