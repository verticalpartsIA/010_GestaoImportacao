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

  /* ---------- Fiação do carro (chicotes da caixa de passagem/inspeção) ----------
     Trechos reais de "LISTA DE MATERIAIS E FICAO PARA QUADRO DE COMANDO
     MANUFATURADO MONARCH.xlsx" (planilha de engenharia, achada em
     29/09/2026) — cada chicote com seu código, cabo/bitola e comprimento
     reais de referência, em vez dos valores estimados da 1ª versão.
     Comprimento automático só se a cabina for até 2400x2400mm (regra do
     usuário) — acima disso, ou sem a medida da cabina, fica
     pendente_engenharia, com override manual por chicote. A decisão de
     Escopo (fornecer/reutilizar/terceiro) NUNCA entra aqui: a fiação é
     sempre fabricada pela VerticalParts, mesmo em cima de um componente
     reaproveitado pelo cliente. A Botoeira de Cabina (COP) não tem chicote
     próprio — a placa já vem fiada de fábrica dentro da botoeira. */
  const CABINA_LIMITE_PADRAO_MM = 2400;
  const FIACAO_CARRO_ORIGEM_PADRAO = 'Caixa de passagem/inspeção (teto da cabina)';

  /* doorSpecific: true = 1 trecho por porta ativa (dobra com portas_opostas_cabina).
     origemFisica: só o POW1 foge da caixa de passagem (é alimentação
     independente que desce da casa de máquinas/última altura). */
  const FIACAO_CARRO_CHICOTES = [
    { chicote: 'GS1', nome: 'Contato de trinco da porta', destino: 'Trinco da porta de cabina', cabo: 'Cabo flexível 3×0,75mm²', mm: 6000, override: 'fiacao_carro_gs1_mm', doorSpecific: true },
    { chicote: 'DC1', nome: 'Alimentação do operador de porta', destino: 'Operador de porta (motor)', cabo: 'Cabo flexível 3×0,75mm²', mm: 6000, override: 'fiacao_carro_dc1_mm', doorSpecific: true },
    { chicote: 'DEN1', nome: 'Sinais do operador de porta', destino: 'Módulo do operador de porta (comunicação)', cabo: 'Cabo de controle 6×0,75mm²', mm: 6000, override: 'fiacao_carro_den1_mm', doorSpecific: true },
    { chicote: 'EDP1', nome: 'Barreira de luz — alimentação', destino: 'Cortina luminosa (alimentação)', cabo: 'Cabo flexível 3×0,75mm²', mm: 6000, override: 'fiacao_carro_edp1_alim_mm', doorSpecific: true },
    { chicote: 'EDP1', nome: 'Barreira de luz — sinal', destino: 'Cortina luminosa (sinal)', cabo: 'Cabo flexível 2×0,75mm²', mm: 6000, override: 'fiacao_carro_edp1_sinal_mm', doorSpecific: true },
    { chicote: 'RDZ', nome: 'Sensor de nivelamento de cabina', destino: 'Sensores de nivelamento e zona de porta (DZU/DZD/FL1/FL2)', cabo: 'Cabo flexível 4×0,75mm²', mm: 4000, override: 'fiacao_carro_rdz_mm', doorSpecific: false },
    { chicote: 'SOS', nome: 'Segurança do carro', destino: 'Contato do freio de segurança (cunha) do carro', cabo: 'Cabo flexível 3×0,75mm²', mm: 6000, override: 'fiacao_carro_seguranca_mm', doorSpecific: false },
    { chicote: 'FAN', nome: 'Iluminação da cabina', destino: 'Iluminação da cabina', cabo: 'Cabo flexível 3×0,75mm²', mm: 2000, override: 'fiacao_carro_fan_iluminacao_mm', doorSpecific: false },
    { chicote: 'FAN', nome: 'Ventilador da cabina', destino: 'Ventilador da cabina', cabo: 'Cabo flexível 3×0,75mm²', mm: 2000, override: 'fiacao_carro_fan_ventilador_mm', doorSpecific: false },
    { chicote: 'SL', nome: 'LED e sirene 24V', destino: 'Sinalizador (LED + sirene)', cabo: 'Cabo flexível 2×0,75mm²', mm: 6000, override: 'fiacao_carro_sl_mm', doorSpecific: false },
    { chicote: 'WT1', nome: 'Pesador de carga digital', destino: 'Pesador de carga', cabo: 'Cabo flexível 4×0,75mm²', mm: 2000, override: 'fiacao_carro_wt1_mm', doorSpecific: false },
    { chicote: 'POW1', nome: 'Alimentação independente (backup luz/ventilador)', destino: 'Backup de luz/ventilador da cabina', cabo: 'Cabo flexível 2×0,75mm²', mm: 6000, override: 'fiacao_carro_pow1_mm', doorSpecific: false, origemFisica: 'Casa de máquinas / última altura' },
  ];

  function cabinaDentroDoPadrao(geometria) {
    const l = Number(geometria.cabina_largura_mm) || null;
    const p = Number(geometria.cabina_profundidade_mm) || null;
    if (!l || !p) return null;
    return l <= CABINA_LIMITE_PADRAO_MM && p <= CABINA_LIMITE_PADRAO_MM;
  }

  function trechoFiacaoCarro(geometria, spec, dentroPadrao, sufixoPorta) {
    const overrideMm = Number(geometria[spec.override]) || null;
    let comprimento = null, confianca, formula;
    if (overrideMm) {
      comprimento = overrideMm;
      confianca = 'confirmado';
      formula = `Comprimento informado manualmente pela engenharia: ${overrideMm}mm.`;
    } else if (dentroPadrao === true) {
      comprimento = spec.mm;
      confianca = 'estimado';
      formula = `Cabina dentro do padrão (largura e profundidade ≤ ${CABINA_LIMITE_PADRAO_MM}mm) — comprimento de referência do chicote ${spec.chicote} (${spec.mm}mm, planilha de engenharia Monarch).`;
    } else if (dentroPadrao === false) {
      formula = `Cabina maior que ${CABINA_LIMITE_PADRAO_MM}x${CABINA_LIMITE_PADRAO_MM}mm — comprimento não pode ser presumido pelo padrão de referência. Informar a medida real (campo de override desta aba).`;
      confianca = 'pendente_engenharia';
    } else {
      formula = 'Largura/profundidade da cabina ainda não informadas — sem base pra saber se o padrão de referência se aplica.';
      confianca = 'pendente_engenharia';
    }
    return trechoBase({
      tipo_cabo: `Fiação do carro — ${spec.chicote} — ${spec.nome}${sufixoPorta ? ` (${sufixoPorta})` : ''}`,
      vias_bitola: spec.cabo,
      origem_fisica: spec.origemFisica || FIACAO_CARRO_ORIGEM_PADRAO,
      destino_fisico: spec.destino,
      comprimento_base_mm: comprimento,
      comprimento_final_mm: comprimento,
      quantidade_pedacos: 1,
      confianca,
      formula,
    });
  }

  function montarTrechosFiacaoCarro(geometria, config) {
    const dentroPadrao = cabinaDentroDoPadrao(geometria);
    const portas2 = !!(config || {}).portas_opostas_cabina;
    const g = geometria || {};

    const trechos = [];
    FIACAO_CARRO_CHICOTES.forEach((spec) => {
      if (!spec.doorSpecific) { trechos.push(trechoFiacaoCarro(g, spec, dentroPadrao, null)); return; }
      trechos.push(trechoFiacaoCarro(g, spec, dentroPadrao, 'frontal'));
      if (portas2) trechos.push(trechoFiacaoCarro(g, spec, dentroPadrao, 'traseira'));
    });
    return trechos;
  }

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

  /* Chave de variante para a ESTRUTURA DO OMIE (pcp_quadro_variante): aceita também 30 kW,
     que não tem lista fixa neste arquivo. Sem correspondência exata -> null. */
  function chaveVarianteQuadro(potenciaKw, tensaoV) {
    const kw = Number(potenciaKw), v = Number(tensaoV);
    if (!kw || !v) return null;
    const kwKey = Math.abs(kw - 7.5) < 0.6 ? '7.5' : Math.abs(kw - 15) < 0.6 ? '15' : Math.abs(kw - 30) < 1 ? '30' : null;
    const vKey = Math.abs(v - 220) < 15 ? '220' : Math.abs(v - 380) < 15 ? '380' : null;
    return kwKey && vKey ? `${kwKey}_${vKey}` : null;
  }

  /* ---------- BOM a partir da estrutura do produto no Omie (fonte da verdade) ----------
     linhas: [{ codigo_filho, quantidade }] de pcp_estrutura do produto do quadro.
     produtosPorCodigo: { [codigo]: { descricao, unidade } } (pcp_produtos).
     Soma códigos repetidos; "Caixa para QC…" vai para o grupo caixa. */
  function montarBomDaEstrutura(linhas, produtosPorCodigo, catalogoPorSku, rotulo) {
    const prod = produtosPorCodigo || {}, cat = catalogoPorSku || {};
    const soma = new Map();
    (linhas || []).forEach((l) => {
      const q = Number(l.quantidade);
      if (!l.codigo_filho || !(q > 0)) return;
      soma.set(l.codigo_filho, (soma.get(l.codigo_filho) || 0) + q);
    });
    const itens = [];
    soma.forEach((quantidade, sku) => {
      const p = prod[sku] || {}, c = cat[sku] || {};
      const descricao = p.descricao || c.descricao || `(SKU ${sku} sem descrição no cadastro)`;
      const caixa = c.categoria === 'caixa' || /^caixa para qc/i.test(descricao);
      itens.push({
        sku, descricao,
        unidade: String(p.unidade || c.unidade || 'un').toLowerCase(),
        grupo_separacao: caixa ? 'caixa' : 'componentes',
        quantidade: Math.round(quantidade * 1e6) / 1e6,
        origem: 'fixo_variante', confianca: 'confirmado',
        memoria_calculo: `Estrutura do produto ${rotulo} no Omie (sincronizada no PCP).`,
      });
    });
    return itens.sort((a, b) => a.sku.localeCompare(b.sku));
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
    const foraDoPadrao = ultimaAltura > 4500;
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

  /* Sem casa de máquinas (MRL) o quadro fica no pavimento da última parada e a máquina/limitador na UA (≈4.500mm acima do piso;
     o fio sai da base do quadro, ~440mm acima do piso): ≈5.000mm de percurso, 6.000mm com folga (regra da Engenharia, 28/10/2026).
     Só vale quando a distância não foi medida; medida informada sempre vence. */
  const MRL_FIO_UA_MM = 6000;
  const ehMRL = (tipoAplicacao) => String(tipoAplicacao || '').toUpperCase() === 'MRL';

  function montarTrechosFiacaoFixa(geometria, tipoAplicacao) {
    const trechos = [];
    const mrl = ehMRL(tipoAplicacao);
    const padraoMRL = `Padrão sem casa de máquinas (MRL): quadro no pavimento até a última altura (UA ≈4.500mm + ~440mm do piso à base do quadro ≈ 5.000mm) com folga = ${MRL_FIO_UA_MM}mm.`;

    const distMaquina = Number(geometria.distancia_quadro_maquina_mm) || (mrl ? MRL_FIO_UA_MM : null);
    trechos.push(trechoBase({
      tipo_cabo: 'Fiação fixa — força/comando da máquina',
      endereco_referencia: 'U/V/W, MT (freio)',
      origem_fisica: 'Quadro de comando (saída de fundo)',
      destino_fisico: 'Máquina de tração',
      comprimento_base_mm: distMaquina,
      comprimento_final_mm: distMaquina,
      confianca: distMaquina ? (Number(geometria.distancia_quadro_maquina_mm) ? 'confirmado' : 'estimado') : 'pendente_engenharia',
      formula: distMaquina
        ? (Number(geometria.distancia_quadro_maquina_mm) ? `comprimento_final = distancia_quadro_maquina_mm (medido) = ${distMaquina}mm` : padraoMRL)
        : 'distancia_quadro_maquina_mm não informada — não presumir os 10m de referência comercial sem confirmação explícita.',
    }));

    const distLimitador = Number(geometria.distancia_quadro_limitador_mm) || (mrl ? MRL_FIO_UA_MM : null);
    trechos.push(trechoBase({
      tipo_cabo: 'Fiação fixa — limitador de velocidade (OS)',
      endereco_referencia: 'OS',
      origem_fisica: 'Quadro de comando',
      destino_fisico: 'Limitador de velocidade (guia solitária)',
      comprimento_base_mm: distLimitador,
      comprimento_final_mm: distLimitador,
      confianca: distLimitador ? (Number(geometria.distancia_quadro_limitador_mm) ? 'confirmado' : 'estimado') : 'pendente_engenharia',
      formula: distLimitador
        ? (Number(geometria.distancia_quadro_limitador_mm) ? `comprimento_final = distancia_quadro_limitador_mm (medido) = ${distLimitador}mm` : padraoMRL)
        : 'distancia_quadro_limitador_mm não informada — não presumir os 7,6m/10m de referência comercial sem confirmação explícita.',
    }));

    if (mrl) {
      trechos.push(trechoBase({
        tipo_cabo: 'Fiação fixa — PAP do motor / volante de inércia (HW)',
        endereco_referencia: 'HW',
        origem_fisica: 'Quadro de comando',
        destino_fisico: 'Máquina de tração (última altura)',
        comprimento_base_mm: MRL_FIO_UA_MM,
        comprimento_final_mm: MRL_FIO_UA_MM,
        confianca: 'estimado',
        formula: padraoMRL,
      }));
    }

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

  /* Cabo de manobra (regra do Gelson, 29/10/2026, calibrada num cabo real: 10 paradas de 3 m, sem casa de máquinas = 47 m; 8 paradas = 41 m).
     O quadro fica na última parada; o cabo desce fixo até a fixação do meio da caixa, continua pendurado até a fixação embaixo do carro
     (a volta/seio fica no extremo inferior) e sobe pelo costado até a caixa de inspeção no teto. Fixo + pendurado = o curso inteiro,
     então a parada escolhida como meio não muda o corte. Comprimento = soma dos pisos reais + reserva fixa
     (seio 3 m + subida 3 m + pontas 2+2 m + 10 m calibrados no caso real, ainda sem nome) + distância do quadro até a descida da laje
     (só com casa de máquinas; é o campo "Distância quadro → entrada da caixa"). Piso fora do padrão entra pelo valor real. */
  const CABO_MANOBRA_SEIO_MM = 3000;
  const CABO_MANOBRA_SUBIDA_MM = 3000;
  const CABO_MANOBRA_PONTAS_MM = 4000;
  const CABO_MANOBRA_RESERVA_CALIBRADA_MM = 10000;

  function montarTrechoCaboManobra(geometria, intervalos, tipoAplicacao) {
    const geo = geometria || {};
    const { percurso_mm } = alturaTotalMm(geo, intervalos);
    const tipo = String(tipoAplicacao || '').trim().toUpperCase();
    const comCasaMaquinas = tipo !== '' && tipo !== 'MRL';
    const base = {
      tipo_cabo: 'Cabo de manobra (28 vias — 1 peça)',
      origem_fisica: 'Fundo do quadro de comando',
      destino_fisico: 'Caixa de inspeção no teto da cabina',
    };

    if (!percurso_mm) {
      return trechoBase({ ...base, formula: 'Percurso (soma dos intervalos entre pisos) não informado — sem base pra calcular o comprimento do cabo de manobra.' });
    }

    const distLaje = Number(geo.distancia_quadro_entrada_caixa_mm) || 0;
    if (comCasaMaquinas && !distLaje) {
      return trechoBase({ ...base, comprimento_base_mm: percurso_mm,
        formula: `Percurso = ${percurso_mm}mm. Com casa de máquinas o cliente informa a distância do quadro até a descida da laje (campo "Distância quadro → entrada da caixa") — sem ela o comprimento não é liberado.` });
    }

    const seio = Number(geo.seio_cabo_mm) > 0 ? Number(geo.seio_cabo_mm) : CABO_MANOBRA_SEIO_MM;
    const pontas = Number(geo.folga_mm) > 0 ? Number(geo.folga_mm) : CABO_MANOBRA_PONTAS_MM;
    const subida = CABO_MANOBRA_SUBIDA_MM;
    const reserva = CABO_MANOBRA_RESERVA_CALIBRADA_MM;
    const lajeMm = comCasaMaquinas ? distLaje : 0;
    const folga = subida + pontas + reserva + lajeMm;
    return trechoBase({
      ...base,
      comprimento_base_mm: percurso_mm,
      contornos_mm: seio,
      folga_mm: folga,
      comprimento_final_mm: percurso_mm + seio + folga,
      confianca: 'estimado',
      formula: `comprimento_final = pisos (${percurso_mm}mm) + seio (${seio}mm) + subida até a caixa de inspeção (${subida}mm) + pontas (${pontas}mm)`
        + ` + saída do quadro até a caixa (${reserva}mm)` + (comCasaMaquinas ? ` + distância quadro → descida da laje (${lajeMm}mm)` : '')
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

  /* ---------- LOP — Botoeira de Pavimento ----------
     Elevador coletivo: térreo só ▲ (Seta Subida), último andar só ▼ (Seta Descida)
     e intermediários com 2 botões (1 Sobe + 1 Desce) ou, se o cliente escolher,
     1 botão. Cada posição é uma botoeira pronta BST (vidro preto sem display
     ou VTP com display). */
  const LOP_MODELOS = {
    sem: {
      desce: ['VPB-033', 'Botoeira de Pavimento Vidro Preto com 1 Botão "Seta Descida" em Led Branco, sem Display, para Elevador - Ref.: BST VPB-033'],
      sobe: ['VPB-034', 'Botoeira de Pavimento Vidro Preto com 1 Botão "Seta Subida" em Led Branco, sem Display, para Elevador - Ref.: BST VPB-034'],
      dois: ['VPB-035', 'Botoeira de Pavimento Vidro Preto com 2 Botões, "1 Sobe e 1 Desce" em Led Branco, sem Display, para Elevador - Ref.: BST VPB-035'],
    },
    com: {
      desce: ['VPB-038', 'Botoeira de Pavimento VTP com 1 Botão "Seta Descida" em Led Branco, com Display em Led Branco, para Elevador - Ref.: BST VPB-038'],
      sobe: ['VPB-039', 'Botoeira de Pavimento VTP com 1 Botão "Seta Subida" em Led Branco, com Display em Led Branco, para Elevador - Ref.: BST VPB-039'],
      dois: ['VPB-037', 'Botoeira de Pavimento VTP, 2 Botões, "1 Sobe e 1 Desce" em Led Branco, com Display em Led Branco, para Elevador-Ref.: BST VPB-037'],
    },
  };

  /* Modelos de LOP: os padrões BST (vidro) ou, se o vendedor escolheu outro código no hub, a família dele
     (`familia` = { sobe, desce, dois } com os SKUs; a descrição vem do catálogo). */
  function modelosLop(comDisplay, familia, catalogoPorSku) {
    if (!familia) return LOP_MODELOS[comDisplay ? 'com' : 'sem'];
    const cat = catalogoPorSku || {};
    const m = (sku) => [sku, (cat[sku] && cat[sku].descricao) || ('Botoeira de Pavimento ' + sku)];
    return { sobe: m(familia.sobe), desce: m(familia.desce), dois: m(familia.dois) };
  }

  function calcularLop(numParadas, botoesIntermediarios) {
    const n = parseInt(numParadas, 10);
    if (!Number.isFinite(n) || n < 2) return null;
    const dois = Number(botoesIntermediarios) !== 1;
    const inter = n - 2;
    return {
      paradas: n, intermediarios: inter, doisBotoes: dois,
      botoeiras1: 2 + (dois ? 0 : inter), // térreo + último (+ intermediários de 1 botão)
      botoeiras2: dois ? inter : 0,
      botoesTotal: 2 + inter * (dois ? 2 : 1),
    };
  }

  function montarItensLop(numParadas, botoesIntermediarios, catalogoPorSku, comDisplay, familia) {
    const r = calcularLop(numParadas, botoesIntermediarios);
    if (!r) return [];
    const cat = catalogoPorSku || {};
    const m = modelosLop(comDisplay, familia, catalogoPorSku);
    const regra = `${r.paradas} paradas: térreo ▲ (Seta Subida), último ▼ (Seta Descida), ${r.doisBotoes ? 'intermediários com 2 botões (1 Sobe e 1 Desce)' : 'intermediários com 1 botão'}.`;
    const linha = (modelo, quantidade, confianca, extra) => ({
      sku: modelo[0], descricao: (cat[modelo[0]] && cat[modelo[0]].descricao) || modelo[1], unidade: 'un',
      grupo_separacao: 'componentes', quantidade, origem: 'calculado_geometria', confianca,
      memoria_calculo: regra + (extra ? ' ' + extra : ''),
    });
    const itens = [linha(m.sobe, 1, 'confirmado', 'Térreo.'), linha(m.desce, 1, 'confirmado', 'Último andar.')];
    if (r.intermediarios > 0) {
      if (r.doisBotoes) itens.push(linha(m.dois, r.intermediarios, 'confirmado', 'Andares intermediários.'));
      else {
        // Sem modelo "1 botão" definido para intermediários: usa a Seta Subida — a confirmar com a produção.
        itens[0] = linha(m.sobe, 1 + r.intermediarios, 'estimado', 'Intermediários com 1 botão usam a Seta Subida (a confirmar com a produção).');
      }
    }
    return itens;
  }

  /* ---------- Botoeiras de inspeção (cabina e poço) — 1 de cada, quando fornecemos ---------- */
  const INSPECAO_MODELOS = [
    ['botoeira_inspecao_cabina', 'VPB-193', 'Caixa de Inspeção de Topo de Cabine de Elevador do Comando Monarch Ref.: BST | VPB-193'],
    ['botoeira_inspecao_poco', 'VPB-209', 'Botoeira de Inspeção do Poço de Elevador - Ref.: BST | VPB-209'],
  ];

  function montarItensInspecao(escopo, catalogoPorSku) {
    const cat = catalogoPorSku || {};
    return INSPECAO_MODELOS.filter(([chave]) => ((escopo || {})[chave] || {}).decisao === 'fornecer').map(([chave, skuPadrao, desc]) => {
      const escolhido = String(((escopo || {})[chave] || {}).codigo || '').trim();
      const sku = escolhido || skuPadrao;
      return { sku, descricao: (cat[sku] && cat[sku].descricao) || (escolhido ? escolhido : desc), unidade: 'un', grupo_separacao: 'componentes', quantidade: 1,
        origem: 'calculado_geometria', confianca: 'confirmado', memoria_calculo: 'Escopo: fornecer. 1 botoeira por elevador.' + (escolhido ? ' Código escolhido no hub.' : '') };
    });
  }

  /* ---------- Chicotes que acompanham cada peça (28/10/2026, regra da Engenharia) ----------
     Aparecem sempre que a peça entra no pedido, sem ninguém escolher: caixa do poço (VPB-209), caixa de topo de
     cabine Monarch (VPB-193) e o próprio quadro de comando (HW, MT e OS saem direto dele para a última altura).
     O mesmo chicote nunca entra duas vezes. */
  const CHICOTES_VPEL = {
    PT1: ['VPEL-732a', 'Chicote PT1 (Botão Stop de Acesso ao Poço) - Ref.: VerticalParts (A)'],
    PT2: ['VPEL-733a', 'Chicote PT2 (Polia Tensora e Buffer) - Ref.: VerticalParts (A)'],
    EDP1: ['VPEL-727a', 'Chicote EDP1 (Alimentação e Sinal de Barreira Eletrônica) - Ref.: VerticalParts (A)'],
    FAN: ['VPEL-723a', 'Chicote FAN (Iluminação e Ventilação de Cabina) - Ref.: VerticalParts (A)'],
    GS1: ['VPEL-721a', 'Chicote GS1 (Contato de Trinco da Porta de Cabina) - Ref.: VerticalParts (A)'],
    SOS: ['VPEL-725a', 'Chicote SOS (Contato do Freio da Cunha da Cabina) - Ref.: VerticalParts (A)'],
    SL: ['VPEL-728a', 'Chicote SL (LED e Sirene 24V) - Ref.: VerticalParts (A)'],
    HW: ['VPEL-730a', 'Chicote HW (PAP do Motor / Contato Volante de Inércia) - Ref.: VerticalParts (A)'],
    MT: ['VPEL-731a', 'Chicote MT (Alimentação e Monitoramento do Freio da Máquina) - Ref.: VerticalParts (A)'],
    OS: ['VPEL-729a', 'Chicote OS (Contato Elétrico Limitador de Velocidade) - Ref.: VerticalParts (A)'],
  };
  /* Chicotes dos demais conectores da caixa de topo (VPB-193, placa MCTC-CTB-H5). Regra do Gelson (29/10/2026): todo cabo é feito na VerticalParts,
     um chicote por conector. O código VPEL-7xx ainda não existe: a lista "Chicotes da caixa de topo" (tabela chicotes_caixa_topo) o recebe depois.
     Sem código, o item entra no BOM como "código a definir". Comprimento padrão 2.400 mm; 3.500 mm para o que desce até a baixo da cabine (WT2, SOS). */
  const CHICOTE_MM_PADRAO = 2400;
  const CHICOTE_MM_BAIXO_CABINE = 3500;
  const CHICOTES_CAIXA_TOPO_NOVOS = [
    { chave: 'DC1', desc: 'Chicote DC1 (Alimentação do Operador de Porta)' },
    { chave: 'DC2', desc: 'Chicote DC2 (Alimentação do Operador de Porta Oposta)', cond: 'portaOposta' },
    { chave: 'DEN1', desc: 'Chicote DEN1 (Limites e Comandos do Operador de Porta)' },
    { chave: 'DEN2', desc: 'Chicote DEN2 (Limites e Comandos do Operador de Porta Oposta)', cond: 'portaOposta' },
    { chave: 'EDP2', desc: 'Chicote EDP2 (Barreira Eletrônica da Porta Oposta)', cond: 'portaOposta' },
    { chave: 'DP', desc: 'Chicote DP (Térmica do Motor da Porta)' },
    { chave: 'WT1', desc: 'Chicote WT1 (Sobrecarga / Carga Cheia)' },
    { chave: 'WT2', desc: 'Chicote WT2 (Célula de Carga Analógica)', cond: 'celulaCarga', mm: CHICOTE_MM_BAIXO_CABINE },
    { chave: 'RDZ', desc: 'Chicote RDZ (Zona de Porta)' },
    { chave: 'DZ', desc: 'Chicote DZ (Nivelamento)' },
    { chave: 'Y4', desc: 'Chicote Y4 (Botoeira de Inspeção / Pendant)' },
    { chave: 'CB/TEL1', desc: 'Chicote CB/TEL1 (Interfone)' },
    { chave: 'COB1', desc: 'Chicote COB1 (Botoeira de Cabine)' },
    { chave: 'COB2', desc: 'Chicote COB2 (2ª Botoeira / Auxiliar de Cabine)', cond: 'cob2' },
    { chave: 'Y1/Y2/S3', desc: 'Chicote Y1/Y2/S3 (Fonte Combinada e Luz de Topo de Cabine)' },
    { chave: 'CA/CC', desc: 'Chicote CA/CC (Alimentação 220V e 24V/CAN)' },
  ];
  const MM_CHICOTE_EXISTENTE = { SOS: CHICOTE_MM_BAIXO_CABINE };
  const CHICOTES_POR_PECA = [
    { sku: 'VPB-209', nome: 'Botoeira de Inspeção do Poço (VPB-209)', chicotes: ['PT1', 'PT2'] },
    { sku: 'VPB-193', nome: 'Caixa de Inspeção de Topo de Cabine Monarch (VPB-193)', chicotes: ['EDP1', 'FAN', 'GS1', 'SOS', 'SL', ...CHICOTES_CAIXA_TOPO_NOVOS.map((c) => c.chave)] },
  ];
  const CHICOTES_DO_QUADRO = ['HW', 'MT', 'OS'];

  /* HW, MT e OS saem do quadro até a última altura: o comprimento é o do trecho de fiação fixa correspondente (medido, ou 6.000mm estimado em MRL).
     Sem trecho/comprimento (ex.: casa de máquinas sem medida) o item fica "pendente de engenharia" — nunca se presume metragem. */
  const CHICOTE_TRECHO = { MT: 'U/V/W, MT (freio)', OS: 'OS', HW: 'HW' };
  const fmtMetros = (mm) => (mm / 1000).toFixed(2).replace('.', ',') + ' m';

  function montarItensChicotes(bomItens, catalogoPorSku, trechosFixa, opcoes) {
    const cat = catalogoPorSku || {};
    const op = opcoes || {};
    const codigos = op.codigos || {};
    const skusBom = new Set((bomItens || []).map((i) => i.sku));
    const vistos = new Set(skusBom);
    const itens = [];
    const caixaTopo = new Set(['EDP1', 'FAN', 'GS1', 'SOS', 'SL']);
    const add = (chave, motivo) => {
      const [skuPadrao, desc] = CHICOTES_VPEL[chave];
      const sku = String(codigos[chave] || '').trim() || skuPadrao;
      if (vistos.has(sku)) return;
      vistos.add(sku);
      const base = (cat[sku] && cat[sku].descricao) || desc;
      const refTrecho = CHICOTE_TRECHO[chave];
      if (!refTrecho) {
        const mm = caixaTopo.has(chave) ? (MM_CHICOTE_EXISTENTE[chave] || CHICOTE_MM_PADRAO) : null;
        itens.push({ sku, descricao: mm ? `${base} — ${fmtMetros(mm)}` : base, unidade: 'un', grupo_separacao: 'componentes', quantidade: 1,
          origem: 'calculado_geometria', confianca: 'confirmado', memoria_calculo: `Chicote automático: ${motivo}. 1 por elevador.` + (mm ? ` Comprimento ${fmtMetros(mm)} (definido pela Engenharia).` : '') });
        return;
      }
      const t = (trechosFixa || []).find((x) => x.endereco_referencia === refTrecho);
      const mm = t && Number(t.comprimento_final_mm) > 0 ? Number(t.comprimento_final_mm) : null;
      itens.push({ sku, descricao: mm ? `${base} — ${fmtMetros(mm)}` : `${base} — comprimento a definir`, unidade: 'un', grupo_separacao: 'componentes', quantidade: 1,
        origem: 'calculado_geometria', confianca: mm ? (t.confianca === 'confirmado' ? 'confirmado' : 'estimado') : 'pendente_engenharia',
        memoria_calculo: `Chicote automático: ${motivo}. 1 por elevador. ` + (mm ? `Comprimento ${fmtMetros(mm)} = trecho de fiação fixa (${t.confianca === 'confirmado' ? 'medido' : 'estimado'}).` : 'Comprimento não informado — preencher a distância na aba Geometria; nunca presumir metragem.') });
    };
    /* Chicotes novos da caixa de topo: sem código cadastrado entram como "código a definir" (nunca somem do BOM). */
    const addNovo = (c, motivo) => {
      const cod = String(codigos[c.chave] || '').trim();
      const sku = cod || `A-DEFINIR-${c.chave.replace(/[^A-Z0-9]+/gi, '')}`;
      if (vistos.has(sku)) return;
      vistos.add(sku);
      const mm = c.mm || CHICOTE_MM_PADRAO;
      const base = (cod && cat[cod] && cat[cod].descricao) || c.desc;
      itens.push({ sku, descricao: `${base} — ${fmtMetros(mm)}${cod ? '' : ' — código VPEL a definir'}`, unidade: 'un', grupo_separacao: 'componentes', quantidade: 1,
        origem: 'calculado_geometria', confianca: cod ? 'confirmado' : 'pendente_engenharia',
        memoria_calculo: `Chicote automático: ${motivo}. 1 por elevador. Feito na VerticalParts. Comprimento ${fmtMetros(mm)} (definido pela Engenharia).` + (cod ? '' : ' Código VPEL ainda não cadastrado na lista "Chicotes da caixa de topo".') });
    };
    CHICOTES_POR_PECA.forEach((peca) => {
      if (!skusBom.has(peca.sku)) return;
      peca.chicotes.forEach((c) => {
        if (CHICOTES_VPEL[c]) { add(c, `acompanha ${peca.nome}`); return; }
        const novo = CHICOTES_CAIXA_TOPO_NOVOS.find((x) => x.chave === c);
        if (!novo || (novo.cond && !op[novo.cond])) return;
        addNovo(novo, `acompanha ${peca.nome}`);
      });
    });
    CHICOTES_DO_QUADRO.forEach((c) => add(c, 'saem direto do quadro de comando para a última altura (UA)'));
    return itens;
  }

  /* LOP lendo a quantidade de cada parada (frontal e traseira). Cada face é uma
     sequência: 1ª parada com LOP = térreo (Seta Subida), última = Seta Descida,
     as do meio = 2 botões (ou 1 botão). A quantidade manual da parada multiplica. */
  function montarItensLopParadas(paradas, botoesIntermediarios, catalogoPorSku, comDisplay, familia) {
    const qtdDe = (v, padrao) => { const t = String(v == null ? '' : v).trim(); if (t === '') return padrao; const n = Number(t.replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : padrao; };
    const faces = [
      (paradas || []).filter((p) => p.abertura_frontal !== false).map((p) => qtdDe(p.qtd_lop_frontal, 1)),
      (paradas || []).filter((p) => p.abertura_traseira).map((p) => qtdDe(p.qtd_lop_traseira, 1)),
    ].map((l) => l.filter((q) => q > 0));
    const dois = Number(botoesIntermediarios) !== 1;
    let sobe = 0, desce = 0, meio = 0, umNoMeio = 0, nFaces = 0;
    faces.forEach((l) => {
      if (l.length < 2) return;
      nFaces += 1;
      l.forEach((q, i) => {
        if (i === 0) sobe += q; else if (i === l.length - 1) desce += q; else if (dois) meio += q; else umNoMeio += q;
      });
    });
    if (!nFaces) return [];
    const cat = catalogoPorSku || {};
    const m = modelosLop(comDisplay, familia, catalogoPorSku);
    const regra = `${nFaces === 2 ? 'Frontal e traseira' : 'Uma face'}: primeira parada ▲ (Seta Subida), última ▼ (Seta Descida), ${dois ? 'intermediárias com 2 botões (1 Sobe e 1 Desce)' : 'intermediárias com 1 botão'}; usa as quantidades de LOP de cada parada.`;
    const linha = (modelo, quantidade, confianca, extra) => ({
      sku: modelo[0], descricao: (cat[modelo[0]] && cat[modelo[0]].descricao) || modelo[1], unidade: 'un',
      grupo_separacao: 'componentes', quantidade, origem: 'calculado_geometria', confianca,
      memoria_calculo: regra + (extra ? ' ' + extra : ''),
    });
    const itens = [];
    if (umNoMeio) itens.push(linha(m.sobe, sobe + umNoMeio, 'estimado', 'Intermediárias com 1 botão usam a Seta Subida (a confirmar com a produção).'));
    else itens.push(linha(m.sobe, sobe, 'confirmado', 'Térreo.'));
    itens.push(linha(m.desce, desce, 'confirmado', 'Último andar.'));
    if (meio) itens.push(linha(m.dois, meio, 'confirmado', 'Andares intermediários.'));
    return itens;
  }

  window.QuadroComandoBomEngine = {
    calcularLop, montarItensLop, montarItensLopParadas, LOP_MODELOS, montarItensInspecao, INSPECAO_MODELOS, montarItensChicotes, CHICOTES_VPEL, CHICOTES_CAIXA_TOPO_NOVOS, MRL_FIO_UA_MM,
    listarVariantes, chaveVariante, chaveVarianteQuadro, montarBomDaEstrutura, montarBomFixo,
    somaIntervalos, alturaTotalMm, perimetroCaixaMm,
    montarTrechosFiacaoFixa, montarTrechoCaboManobra, CABO_MANOBRA_SEIO_MM, CABO_MANOBRA_SUBIDA_MM, CABO_MANOBRA_PONTAS_MM, CABO_MANOBRA_RESERVA_CALIBRADA_MM, montarChecklist,
    cabinaDentroDoPadrao, montarTrechosFiacaoCarro,
    grupoSeparacaoPorCategoria, classificarCruzamentoErp,
  };
}());
