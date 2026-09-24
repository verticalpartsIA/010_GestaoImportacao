/* ============================================================
   quadro-comando-bom-engine.js
   Cálculo puro (sem I/O) do Quadro de Comando: BOM fixo por variante de
   potência/tensão + trechos de corte de fiação fixa do passadiço e do
   cabo de manobra + checklist de separação agrupado.

   Duas camadas nunca misturadas (regra da instrução original):
   - geometria MEDIDA (o que veio da obra/projeto)
   - padrão comercial de ESTIMATIVA (parâmetro configurável, nunca
     aplicado silenciosamente — se um campo não foi preenchido, o
     trecho fica `pendente_engenharia`, nunca com número inventado).

   window.QuadroComandoBomEngine
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Variantes conhecidas do quadro NICE3000 MRL BST ----------
     Fonte: "Materiais Quadro de comando NICE3000 MRL BST VerticalParts.xlsx"
     (aba COMANDO). Cada variante tem sua lista FIXO+VARIÁVEL própria —
     alguns SKUs mudam de bitola/corrente conforme a variante (ver
     observacao_divergencia em materiais_catalogo pros casos já sinalizados
     como ambíguos na planilha original, ex. VPMP-263/857/888). */
  const VARIANTES = {
    '7.5_220': {
      label: '7,5 kW / 220 V',
      fixo: [
        ['VPMP-852', 1], ['VPMP-885', 24], ['VPMP-504', 1], ['VPMP-851', 1], ['VPMP-867', 1],
        ['VPMP-550', 6], ['VPMP-853', 6], ['VPMP-856', 1], ['VPMP-858', 2], ['VPMP-859', 1],
        ['VPMP-860', 1], ['VPB-383', 1], ['VPMP-057', 75], ['VPMP-883', 4], ['VPMP-841', 1],
        ['VPMP-843', 1], ['VPMP-882', 2.4], ['VPMP-896', 1], ['VPMP-895', 1], ['VPMP-794', 1],
        ['VPMP-800', 2], ['VPMP-801', 2], ['VPMP-796', 4], ['VPMP-797', 5], ['VPMP-798', 2],
        ['VPMP-799', 2], ['VPMP-849', 1], ['VPMP-847', 1], ['VPMP-897', 11], ['VPMP-891', 1],
        ['VPMP-761', 3], ['VPMP-850', 1], ['VPMP-333', 3], ['VPMP-865', 1], ['VPMP-305', 22],
        ['VPMP-159', 11], ['VPB-157', 1], ['VPB-156', 1], ['VPMP-855', 8], ['VPMP-178', 16],
        ['VPMP-890', 2], ['VPMP-854', 2], ['VPMP-795', 75], ['VPMP-889', 6], ['VPMP-390', 35],
        ['VPMP-084', 75], ['VPMP-898', 1], ['VPMP-112', 0.7],
      ],
      variavel: [
        ['VPMP-861', 13], ['VPMP-862', 4], ['VPMP-054', 1], ['VPMP-263', 14], ['VPMP-884', 1.5],
        ['VPMP-857', 3], ['VPMP-863', 6], ['VPB-196', 1], ['VPB-381', 1], ['VPMP-899', 1],
        ['VPMP-212', 0], ['VPMP-888', 7], ['VPMP-393', 16], ['VPMP-385', 10], ['VPMP-392', 3],
      ],
      semTipo: [['VPMP-265', 1], ['VPMP-242', 30]],
    },
    '7.5_380': {
      label: '7,5 kW / 380 V',
      fixo: [
        ['VPMP-852', 1], ['VPMP-885', 24], ['VPMP-504', 1], ['VPMP-851', 1], ['VPMP-867', 1],
        ['VPMP-550', 6], ['VPMP-853', 7], ['VPMP-856', 1], ['VPMP-858', 2], ['VPMP-859', 1],
        ['VPMP-860', 1], ['VPB-383', 1], ['VPMP-057', 75], ['VPMP-883', 4], ['VPMP-841', 1],
        ['VPMP-843', 1], ['VPMP-882', 2.4], ['VPMP-896', 1], ['VPMP-895', 1], ['VPMP-794', 1],
        ['VPMP-800', 2], ['VPMP-801', 2], ['VPMP-796', 4], ['VPMP-797', 5], ['VPMP-798', 2],
        ['VPMP-799', 2], ['VPMP-849', 1], ['VPMP-847', 1], ['VPMP-897', 11], ['VPMP-891', 1],
        ['VPMP-761', 3], ['VPMP-850', 1], ['VPMP-333', 3], ['VPMP-865', 1], ['VPMP-305', 22],
        ['VPMP-159', 11], ['VPB-157', 1], ['VPB-156', 1], ['VPMP-855', 8], ['VPMP-178', 16],
        ['VPMP-890', 2], ['VPMP-854', 2], ['VPMP-795', 75], ['VPMP-889', 6], ['VPMP-390', 35],
        ['VPMP-084', 75], ['VPMP-898', 1], ['VPMP-112', 0.7],
      ],
      variavel: [
        ['VPMP-861', 13], ['VPMP-862', 4], ['VPMP-263', 14], ['VPMP-884', 1.5], ['VPMP-857', 3],
        ['VPMP-863', 6], ['VPB-223', 1], ['VPB-381', 1], ['VPMP-901', 1], ['VPMP-212', 0],
        ['VPMP-888', 7], ['VPMP-393', 16], ['VPMP-385', 10], ['VPMP-392', 3],
      ],
      semTipo: [['VPMP-265', 1], ['VPMP-242', 30]],
    },
    '15_220': {
      label: '15 kW / 220 V',
      fixo: [
        ['VPMP-852', 1], ['VPMP-885', 24], ['VPMP-504', 1], ['VPMP-851', 1], ['VPMP-867', 1],
        ['VPMP-550', 6], ['VPMP-853', 6], ['VPMP-856', 1], ['VPMP-858', 2], ['VPMP-859', 1],
        ['VPMP-860', 1], ['VPB-383', 1], ['VPMP-057', 75], ['VPMP-883', 4], ['VPMP-841', 1],
        ['VPMP-843', 1], ['VPMP-882', 2.4], ['VPMP-896', 1], ['VPMP-895', 1], ['VPMP-794', 1],
        ['VPMP-800', 2], ['VPMP-801', 2], ['VPMP-796', 4], ['VPMP-797', 5], ['VPMP-798', 2],
        ['VPMP-799', 2], ['VPMP-849', 1], ['VPMP-848', 1], ['VPMP-897', 11], ['VPMP-891', 1],
        ['VPMP-761', 3], ['VPMP-850', 1], ['VPMP-333', 3], ['VPMP-864', 1], ['VPMP-305', 22],
        ['VPMP-159', 11], ['VPB-157', 1], ['VPB-156', 1], ['VPMP-855', 8], ['VPMP-178', 16],
        ['VPMP-890', 2], ['VPMP-854', 2], ['VPMP-795', 75], ['VPMP-889', 6], ['VPMP-390', 35],
        ['VPMP-084', 75], ['VPMP-898', 1], ['VPMP-112', 0.7],
      ],
      variavel: [
        ['VPMP-861', 13], ['VPMP-862', 4], ['VPMP-054', 1], ['VPMP-263', 14], ['VPMP-886', 1.6],
        ['VPMP-857', 3], ['VPMP-863', 6], ['VPB-224', 1], ['VPB-381', 1], ['VPMP-900', 1],
        ['VPMP-888', 7], ['VPMP-663', 19], ['VPMP-385', 10],
      ],
      semTipo: [['VPMP-265', 1], ['VPMP-242', 30]],
    },
    '15_380': {
      label: '15 kW / 380 V',
      fixo: [
        ['VPMP-852', 1], ['VPMP-885', 24], ['VPMP-504', 1], ['VPMP-851', 1], ['VPMP-867', 1],
        ['VPMP-550', 6], ['VPMP-853', 7], ['VPMP-856', 1], ['VPMP-858', 2], ['VPMP-859', 1],
        ['VPMP-860', 1], ['VPB-383', 1], ['VPMP-057', 75], ['VPMP-883', 4], ['VPMP-841', 1],
        ['VPMP-843', 1], ['VPMP-882', 2.4], ['VPMP-896', 1], ['VPMP-895', 1], ['VPMP-794', 1],
        ['VPMP-800', 2], ['VPMP-801', 2], ['VPMP-796', 4], ['VPMP-797', 5], ['VPMP-798', 2],
        ['VPMP-799', 2], ['VPMP-849', 1], ['VPMP-847', 1], ['VPMP-897', 11], ['VPMP-891', 1],
        ['VPMP-761', 3], ['VPMP-850', 1], ['VPMP-333', 3], ['VPMP-865', 1], ['VPMP-305', 22],
        ['VPMP-159', 11], ['VPB-157', 1], ['VPB-156', 1], ['VPMP-855', 8], ['VPMP-178', 16],
        ['VPMP-890', 2], ['VPMP-854', 2], ['VPMP-795', 75], ['VPMP-889', 6], ['VPMP-390', 35],
        ['VPMP-084', 75], ['VPMP-898', 1], ['VPMP-112', 0.7],
      ],
      variavel: [
        ['VPMP-861', 13], ['VPMP-862', 4], ['VPMP-263', 14], ['VPMP-884', 1.5], ['VPMP-857', 3],
        ['VPMP-863', 6], ['VPB-225', 1], ['VPB-381', 1], ['VPMP-902', 1], ['VPMP-212', 0],
        ['VPMP-888', 7], ['VPMP-393', 16], ['VPMP-385', 10], ['VPMP-392', 3],
      ],
      semTipo: [['VPMP-265', 1], ['VPMP-242', 30]],
    },
  };

  /* Máquina (kW, tensão da rede) -> chave de variante. Sem correspondência
     exata -> null (fica pendente de engenharia, não escolhe "a mais perto"). */
  function chaveVariante(potenciaKw, tensaoV) {
    const kw = Number(potenciaKw), v = Number(tensaoV);
    if (!kw || !v) return null;
    const kwKey = Math.abs(kw - 7.5) < 0.6 ? '7.5' : Math.abs(kw - 15) < 0.6 ? '15' : null;
    const vKey = Math.abs(v - 220) < 15 ? '220' : Math.abs(v - 380) < 15 ? '380' : null;
    if (!kwKey || !vKey) return null;
    const key = `${kwKey}_${vKey}`;
    return VARIANTES[key] ? key : null;
  }

  function listarVariantes() {
    return Object.keys(VARIANTES).map((k) => ({ key: k, label: VARIANTES[k].label }));
  }

  /* categoria do catálogo -> grupo do checklist físico de separação.
     Só "caixa" tem grupo próprio; todo o resto de item comprado (placas,
     contatores, disjuntores, botoeiras, bornes, conectores, terminais,
     fixação, trilho/canaleta, fiação interna do quadro por metro) entra
     junto em "componentes". "fiacao" no checklist é reservado pros
     TRECHOS DE CORTE calculados (poço + cabo de manobra), nunca pro
     metro de fio comprado a granel pra fiação interna do próprio quadro. */
  function grupoSeparacaoPorCategoria(categoria) {
    return categoria === 'caixa' ? 'caixa' : 'componentes';
  }

  /* ---------- BOM fixo da variante ---------- */
  /* catalogoPorSku: { [sku]: { descricao, categoria, unidade, observacao_divergencia } } */
  function montarBomFixo(varianteKey, catalogoPorSku) {
    const v = VARIANTES[varianteKey];
    if (!v) return { itens: [], erro: 'Variante de potência/tensão não reconhecida — combinação fora das 4 variantes cadastradas (7,5/15 kW × 220/380 V). Confirmar com engenharia antes de gerar BOM.' };
    const linhas = [...v.fixo, ...v.variavel, ...v.semTipo];
    const itens = [];
    linhas.forEach(([sku, qtd]) => {
      if (!qtd) return; // quantidade zero na planilha original — não considerar na compra (ex. conector 14 vias, olhal 6mm em algumas variantes)
      const cat = catalogoPorSku[sku];
      itens.push({
        sku,
        descricao: cat ? cat.descricao : `(SKU ${sku} não cadastrado em materiais_catalogo)`,
        unidade: cat ? cat.unidade : 'un',
        grupo_separacao: cat ? grupoSeparacaoPorCategoria(cat.categoria) : 'componentes',
        quantidade: qtd,
        origem: 'fixo_variante',
        confianca: cat && cat.observacao_divergencia ? 'estimado' : 'confirmado',
        memoria_calculo: cat && cat.observacao_divergencia
          ? `Quantidade fixa da variante ${v.label}. Divergência conhecida: ${cat.observacao_divergencia}`
          : `Quantidade fixa da variante ${v.label} (planilha de materiais NICE3000 MRL).`,
      });
    });
    return { itens, erro: null };
  }

  /* ---------- Geometria: percurso, altura total, perímetro (item 5 da instrução) ---------- */
  function somaIntervalos(intervalos) {
    return (intervalos || []).reduce((acc, it) => acc + (Number(it.distancia_mm) || 0), 0);
  }

  function alturaTotalMm(geometria, intervalos) {
    const percurso = somaIntervalos(intervalos);
    const poco = Number(geometria.poco_mm) || 0;
    const ultimaAltura = Number(geometria.ultima_altura_mm) || 0;
    const total = poco + percurso + ultimaAltura;
    const foraDoPadrao = ultimaAltura > 4400;
    return { percurso_mm: percurso, altura_total_mm: total, ultima_altura_fora_do_padrao: foraDoPadrao };
  }

  function perimetroCaixaMm(geometria) {
    const l = Number(geometria.caixa_largura_mm) || 0;
    const p = Number(geometria.caixa_profundidade_mm) || 0;
    if (!l || !p) return null;
    return 2 * (l + p);
  }

  /* ---------- Trechos de corte (item 4/5/6 — fiação fixa + cabo de manobra) ----------
     Nunca inventa contorno/folga: só usa o que foi medido/confirmado. Um
     trecho sem distância informada não vira "0m fictício" — fica
     `pendente_engenharia`, sem comprimento_final, com a fórmula descrita
     pra quem for revisar entender o que falta. */
  function trechoBase(campos) {
    return {
      tipo_cabo: null, endereco_referencia: null, origem_fisica: null, destino_fisico: null,
      vias_bitola: null, comprimento_base_mm: null, contornos_mm: 0, folga_mm: 0,
      comprimento_final_mm: null, quantidade_pedacos: 1, confianca: 'pendente_engenharia', formula: null,
      ...campos,
    };
  }

  function montarTrechosFiacaoFixa(geometria) {
    const trechos = [];

    const distMaquina = Number(geometria.distancia_quadro_maquina_mm) || null;
    trechos.push(trechoBase({
      tipo_cabo: 'Fiação fixa — força/comando da máquina',
      endereco_referencia: 'U/V/W, MT (freio)',
      origem_fisica: 'Quadro de comando (saída de fundo)',
      destino_fisico: 'Máquina de tração',
      comprimento_base_mm: distMaquina,
      comprimento_final_mm: distMaquina,
      confianca: distMaquina ? 'confirmado' : 'pendente_engenharia',
      formula: distMaquina
        ? `comprimento_final = distancia_quadro_maquina_mm (medido) = ${distMaquina}mm`
        : 'distancia_quadro_maquina_mm não informada — não presumir os 10m de referência comercial sem confirmação explícita.',
    }));

    const distLimitador = Number(geometria.distancia_quadro_limitador_mm) || null;
    trechos.push(trechoBase({
      tipo_cabo: 'Fiação fixa — limitador de velocidade (OS)',
      endereco_referencia: 'OS',
      origem_fisica: 'Quadro de comando',
      destino_fisico: 'Limitador de velocidade (guia solitária)',
      comprimento_base_mm: distLimitador,
      comprimento_final_mm: distLimitador,
      confianca: distLimitador ? 'confirmado' : 'pendente_engenharia',
      formula: distLimitador
        ? `comprimento_final = distancia_quadro_limitador_mm (medido) = ${distLimitador}mm`
        : 'distancia_quadro_limitador_mm não informada — não presumir os 7,6m/10m de referência comercial sem confirmação explícita.',
    }));

    const distCaixa = Number(geometria.distancia_quadro_entrada_caixa_mm) || null;
    trechos.push(trechoBase({
      tipo_cabo: 'Fiação fixa — cadeia de segurança do poço (BA/BB/BC/BD/BE)',
      endereco_referencia: 'BA, BB, BC, BD/BE',
      origem_fisica: 'Quadro de comando',
      destino_fisico: 'Entrada da caixa de corrida',
      comprimento_base_mm: distCaixa,
      comprimento_final_mm: distCaixa,
      confianca: distCaixa ? 'confirmado' : 'pendente_engenharia',
      formula: distCaixa
        ? `comprimento_final = distancia_quadro_entrada_caixa_mm (medido) = ${distCaixa}mm`
        : 'distancia_quadro_entrada_caixa_mm não informada. Bornes BA–BE têm identificações repetidas e derivações — calcular a partir dos pontos físicos reais do esquema, nunca presumir 1 fio por posição de borne.',
    }));

    return trechos;
  }

  function montarTrechoCaboManobra(geometria, intervalos) {
    const { percurso_mm } = alturaTotalMm(geometria, intervalos);
    const seioMm = Number(geometria.seio_cabo_mm) || null;
    const seioConfirmado = !!geometria.seio_definicao_confirmada;
    const folgaMm = Number(geometria.folga_mm) || 0;
    const folgaConfirmada = !!geometria.folga_regra_confirmada;

    if (!percurso_mm) {
      return trechoBase({
        tipo_cabo: 'Cabo de manobra (28 vias — 1 peça)',
        origem_fisica: 'Fundo do quadro de comando',
        destino_fisico: 'Caixa de inspeção no teto da cabina',
        formula: 'Percurso (soma dos intervalos entre pisos) não informado — sem base pra calcular o comprimento do cabo de manobra.',
      });
    }

    if (!seioConfirmado) {
      return trechoBase({
        tipo_cabo: 'Cabo de manobra (28 vias — 1 peça)',
        origem_fisica: 'Fundo do quadro de comando',
        destino_fisico: 'Caixa de inspeção no teto da cabina',
        comprimento_base_mm: percurso_mm,
        formula: `Percurso = ${percurso_mm}mm. Definição física do seio (comprimento adicional da curva) ainda não confirmada pela engenharia — comprimento final não liberado. Verificar com a cabina nos dois extremos de curso antes de cortar.`,
      });
    }

    const folgaAplicada = folgaConfirmada ? folgaMm : 0;
    const comprimentoFinal = percurso_mm + seioMm + folgaAplicada;
    return trechoBase({
      tipo_cabo: 'Cabo de manobra (28 vias — 1 peça)',
      origem_fisica: 'Fundo do quadro de comando',
      destino_fisico: 'Caixa de inspeção no teto da cabina',
      comprimento_base_mm: percurso_mm,
      contornos_mm: seioMm,
      folga_mm: folgaAplicada,
      comprimento_final_mm: comprimentoFinal,
      confianca: folgaConfirmada ? 'confirmado' : 'estimado',
      formula: `comprimento_final = percurso (${percurso_mm}mm) + seio (${seioMm}mm)`
        + (folgaConfirmada ? ` + folga (${folgaAplicada}mm)` : ' — folga NÃO aplicada (regra ainda não confirmada pela engenharia)')
        + '. 28 vias = 1 peça só; não multiplicar o comprimento por 28.',
    });
  }

  /* ---------- Checklist de separação (item pedido: caixa / componentes internos / fiação) ---------- */
  function montarChecklist(bomItens, trechosFiacaoFixa, trechoCaboManobra) {
    const linhas = [];
    let ordem = 0;

    bomItens.filter((i) => i.grupo_separacao === 'caixa').forEach((i) => {
      linhas.push({ grupo: 'caixa', descricao: i.descricao, sku: i.sku, quantidade: i.quantidade, unidade: i.unidade, medida_mm: null, ordem: ordem++ });
    });
    bomItens.filter((i) => i.grupo_separacao === 'componentes').forEach((i) => {
      linhas.push({ grupo: 'componentes', descricao: i.descricao, sku: i.sku, quantidade: i.quantidade, unidade: i.unidade, medida_mm: null, ordem: ordem++ });
    });
    [...trechosFiacaoFixa, trechoCaboManobra].forEach((t) => {
      linhas.push({
        grupo: 'fiacao',
        descricao: `${t.tipo_cabo} — ${t.origem_fisica} → ${t.destino_fisico}`,
        sku: null,
        quantidade: t.quantidade_pedacos,
        unidade: 'peça',
        medida_mm: t.comprimento_final_mm,
        ordem: ordem++,
      });
    });
    return linhas;
  }

  /* ---------- Cruzamento com o ERP (item 6 da instrução) ----------
     Puro: recebe os itens da BOM já gerada + os resultados já
     consultados no Omie (edge function quadro-comando-cruzamento-erp,
     que faz a chamada real — este arquivo nunca fala com rede) e
     classifica cada linha. "cadastrado_fora_do_pedido" é calculado
     100% local (materiais_catalogo × SKUs desta BOM), sem precisar de
     nova consulta — mas pode incluir SKUs que só pertencem a OUTRA
     variante de potência/tensão (não é necessariamente uma anomalia,
     é só o que sobra do catálogo compartilhado depois de tirar o que
     este pedido específico usa). Nunca adiciona nada à BOM sozinho —
     é só diagnóstico pro usuário decidir o que fazer. */
  function classificarCruzamentoErp(bomItens, resultadosOmie, catalogoPorSku, estoqueOmie, estoqueErroGeral) {
    const resultados = resultadosOmie || {};
    const catalogo = catalogoPorSku || {};
    const estoque = estoqueOmie || {};
    const skusNaBom = new Set(bomItens.map((i) => i.sku));

    const linhas = bomItens.map((item) => {
      const r = resultados[item.sku] || { encontrado: null };
      const cat = catalogo[item.sku];
      const descricaoLocal = (cat && cat.descricao) || item.descricao || null;
      const unidadeLocal = (cat && cat.unidade) || item.unidade || null;

      let status = 'erro_consulta';
      if (r.encontrado === true) status = 'cadastrado_e_solicitado';
      else if (r.encontrado === false) status = 'solicitado_sem_cadastro';

      const normaliza = (s) => (s == null ? null : String(s).trim().toUpperCase());
      const divergenciaUnidade = r.encontrado === true
        && normaliza(r.unidade) != null && normaliza(unidadeLocal) != null
        && normaliza(r.unidade) !== normaliza(unidadeLocal);
      const divergenciaDescricao = r.encontrado === true
        && normaliza(r.descricao) != null && normaliza(descricaoLocal) != null
        && normaliza(r.descricao) !== normaliza(descricaoLocal);

      // Estoque Omie — diagnóstico independente do cadastro/descrição
      // acima: uma falha na busca de estoque (erroGeral) nunca derruba o
      // resto do cruzamento, só essa coluna específica.
      const quantidadeNecessaria = item.quantidade != null ? Number(item.quantidade) : null;
      const saldoOmie = Object.prototype.hasOwnProperty.call(estoque, item.sku) ? estoque[item.sku] : null;
      let estoqueStatus = null;
      let estoqueErroLinha = null;
      if (estoqueErroGeral) {
        estoqueStatus = 'erro_consulta';
        estoqueErroLinha = estoqueErroGeral;
      } else {
        const saldo = saldoOmie == null ? 0 : Number(saldoOmie);
        if (saldo <= 0) estoqueStatus = 'sem_estoque';
        else if (quantidadeNecessaria != null && saldo < quantidadeNecessaria) estoqueStatus = 'insuficiente';
        else estoqueStatus = 'suficiente';
      }

      return {
        sku: item.sku,
        descricao_local: descricaoLocal,
        descricao_omie: r.descricao != null ? r.descricao : null,
        unidade_local: unidadeLocal,
        unidade_omie: r.unidade != null ? r.unidade : null,
        status,
        divergencia_unidade: !!divergenciaUnidade,
        divergencia_descricao: !!divergenciaDescricao,
        erro: r.erro || null,
        quantidade_necessaria: quantidadeNecessaria,
        quantidade_estoque_omie: estoqueErroGeral ? null : saldoOmie,
        estoque_status: estoqueStatus,
        estoque_erro: estoqueErroLinha,
      };
    });

    const catalogoNaoUsado = Object.keys(catalogo)
      .filter((sku) => catalogo[sku].ativo !== false && !skusNaBom.has(sku))
      .map((sku) => ({ sku, descricao: catalogo[sku].descricao }));

    return { linhas, catalogoNaoUsado };
  }

  window.QuadroComandoBomEngine = {
    listarVariantes, chaveVariante, montarBomFixo,
    somaIntervalos, alturaTotalMm, perimetroCaixaMm,
    montarTrechosFiacaoFixa, montarTrechoCaboManobra, montarChecklist,
    grupoSeparacaoPorCategoria, classificarCruzamentoErp,
  };
}());
