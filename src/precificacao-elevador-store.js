/* ============================================================
   precificacao-elevador-store.js
   CRUD da Precificação de Elevador (ADM/Financeiro) — herda o Cotação Nº
   do Formulário de Elevadores e os custos já respondidos pelo fornecedor,
   orquestra o motor de cálculo (PrecificacaoElevadorEngine) e o motor de
   DIFAL (DifalEngine). window.PrecificacaoElevadorStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Parse best-effort do texto livre respostas.container_no (ex.: "1x40HC +
     1x20GP") em linhas estruturadas pro card "Despesas Operacionais" —
     preço sempre nasce 0 (o fornecedor do elevador não cota frete, só
     tamanho/quantidade de container; o preço vem depois do despachante).
     GP (General Purpose) mapeia pro mesmo tipo que EI_CONTAINER_TIPOS
     (embarques-importacao.jsx) chama de "DV" (Dry Van) — mesmo vocabulário
     usado depois no embarque físico. Trecho sem match reconhecível vira
     "Outro" com quantidade 1, pro Financeiro corrigir na mão.
     Exportado (window.PrecificacaoElevadorStore.parseContainerNo) só pra
     permitir teste unitário isolado. */
  function parseContainerNo(raw) {
    const txt = String(raw || '').trim();
    if (!txt) return [];
    const SUFIXO = { GP: 'DV', DV: 'DV', HC: 'HC', RF: 'RF', OT: 'OT', FR: 'FR' };
    return txt.split(/\s*\+\s*/).filter(Boolean).map((parte) => {
      const m = parte.match(/(\d+)\s*[xX]\s*(\d+)\s*'?\s*([A-Za-z]+)/);
      if (!m) return { tipo_tamanho: 'Outro', quantidade: 1, preco_rs: 0 };
      const quantidade = Number(m[1]) || 1;
      const sufixo = SUFIXO[m[3].toUpperCase()];
      return { tipo_tamanho: sufixo ? `${m[2]}'${sufixo}` : 'Outro', quantidade, preco_rs: 0 };
    });
  }

  /* Mapa fixo ISO (tipo_tamanho, usado aqui e em EI_CONTAINER_TIPOS de
     embarques-importacao.jsx) → tipo real de custos_containers (texto
     livre, ver seed em supabase/migrations/20260828100000_cadastro_custos.sql).
     Pedido do usuário (28/09): "Preço (R$)" de Cadastros → Atualização de
     Custos → Containers precisa doar valor pro container da Precificação.
     Decisão explícita: NÃO trocar o vocabulário ISO da Precificação pelos
     nomes de Custos — esse tipo_tamanho também alimenta
     EmbarquesImportacaoStore.containersDaCotacao/expandirContainers (issue
     #384, já em produção), que só reconhece os códigos ISO. Este mapa é só
     uma tradução interna pra achar a linha certa em custos_containers — a
     Precificação continua salvando/mostrando "20'DV", "40'HC" etc. */
  const CONTAINER_ISO_PARA_CUSTOS = {
    "20'DV": '20GP (Padrão)', "40'DV": '40GP (Padrão)',
    "20'HC": '20HC (High Cube)', "40'HC": '40HC (High Cube)',
    "20'RF": '20 Reefer (Refrigerado)', "40'RF": '40 HC Reefer (Refrigerado Alto)',
    "20'OT": '20 Open Top (Teto aberto)', "40'OT": '40 Open Top (Teto aberto)',
    "20'FR": '20 Flat Rack (Sem laterais)', "40'FR": '40 Flat Rack (Sem laterais)',
  };

  /* Busca em custos_containers a linha que corresponde a um tipo_tamanho
     ISO da Precificação/Embarques — usada pra herdar o Preço(R$) sem tocar
     no vocabulário salvo (ver comentário do mapa acima). null quando não
     há mapeamento (ex. 'Outro') ou a tabela de Custos não tem essa linha
     ativa ainda. */
  function buscarContainerCustoPorIso(tipoTamanhoIso, custosContainers) {
    const tipoCustos = CONTAINER_ISO_PARA_CUSTOS[tipoTamanhoIso];
    if (!tipoCustos) return null;
    return (custosContainers || []).find((c) => c.tipo === tipoCustos && c.ativo !== false) || null;
  }

  /* Preenche preco_rs de cada container detectado no container_no do
     fornecedor com o valor já cadastrado em Atualização de Custos — só
     quando o container ainda não tem preço nenhum (preserva edição manual
     de uma precificação já existente/recarregada). */
  function enriquecerContainersComCusto(containers, custosContainers) {
    return (containers || []).map((ct) => {
      const custo = buscarContainerCustoPorIso(ct.tipo_tamanho, custosContainers);
      if (!custo) return ct;
      const out = { ...ct };
      if (!(Number(ct.preco_rs) > 0)) out.preco_rs = Number(custo.preco_rs) || 0;
      // Capatazia (01/10/2026): mesma regra do preço — herda do cadastro só
      // quando a linha ainda não tem valor, nunca sobrescreve edição manual.
      if (!(Number(ct.capatazia_rs) > 0) && Number(custo.capatazia_rs) > 0) out.capatazia_rs = Number(custo.capatazia_rs);
      // GRI (01/10/2026): mesma regra da capatazia.
      if (!(Number(ct.gri_rs) > 0) && Number(custo.gri_rs) > 0) out.gri_rs = Number(custo.gri_rs);
      return out;
    });
  }

  /* Avisa (não bloqueia) quando o preço do container ou a capatazia lançados
     na Precificação divergem do cadastro de Containers (Atualização de
     Custos) — decisão do Financeiro (01/10/2026). Só compara campos já
     preenchidos dos dois lados. */
  function divergenciasContainerComCadastro(containers, custosContainers) {
    const out = [];
    (containers || []).forEach((ct, i) => {
      const custo = buscarContainerCustoPorIso(ct.tipo_tamanho, custosContainers);
      if (!custo) return;
      [['preco_rs', 'preço do container'], ['capatazia_rs', 'capatazia'], ['gri_rs', 'GRI']].forEach(([campo, rotulo]) => {
        const atual = Number(ct[campo]) || 0;
        const cadastro = Number(custo[campo]) || 0;
        if (atual > 0 && cadastro > 0 && Math.abs(atual - cadastro) > 0.01) out.push({ indice: i, campo, rotulo, atual, cadastro });
      });
    });
    return out;
  }

  /* ============================================================
     Busca automática de mão de obra (issue "Precificação real" Fase 3).
     custos_instalacao_elevador é indexada por tração × faixa de
     capacidade × paradas (ver cadastro-custos-store.js). Aqui só
     classificamos o resultado dessa busca: função pura, testável sem
     Supabase — window.PrecificacaoElevadorStore.classificarMaoDeObraUnidade.
     Situações seguem o vocabulário do documento de origem (regras_
     precificacao_real.json): confirmado (achou na tabela), pendente
     (falta tração/capacidade/paradas na Unidade) — projeto_especial=true
     quando a config existe mas caiu fora da cobertura da tabela (não
     retorna preço confirmado automaticamente, nunca extrapola). */
  function classificarMaoDeObraUnidade(modelo, custoTabela) {
    const unidadeId = modelo.unidadeId ?? null;
    const identificador = modelo.identificador ?? null;
    const tracao = modelo.tracao || null;
    const capacidadeKg = modelo.capacidadeKg != null && modelo.capacidadeKg !== '' ? Number(modelo.capacidadeKg) : null;
    const paradas = modelo.paradas != null && modelo.paradas !== '' ? Number(modelo.paradas) : null;
    const base = { unidadeId, identificador, tracao, capacidadeKg, paradas };

    if (!tracao || !paradas || !(capacidadeKg > 0)) {
      return {
        ...base, origem: 'manual', situacao: 'pendente', valorRs: 0,
        regraUsada: null, diasMontagem: null, qtdMontadores: null, dataBase: null,
        projetoEspecial: false,
        motivo: 'Falta tração, capacidade (kg) e/ou paradas na Unidade — preencha o Formulário de Elevadores.',
      };
    }
    if (!custoTabela) {
      return {
        ...base, origem: 'tabela_referencia', situacao: 'pendente', valorRs: 0,
        regraUsada: null, diasMontagem: null, qtdMontadores: null, dataBase: null,
        projetoEspecial: true,
        motivo: `Fora da cobertura da tabela de MO (tração ${tracao}, ${capacidadeKg}kg, ${paradas} paradas) — trate como projeto especial: exige estimativa versionada, justificativa e aprovação técnica/financeira antes de aprovar a precificação.`,
      };
    }
    /* 29/08 — is_estimativa (extrapolação estatística em Cadastros >
       Atualização de Custos, nunca uma cotação real de instalador) precisa
       do MESMO tratamento que projetoEspecial: não pode entrar sozinho na
       conta, exige aprovação antes de virar preço de venda. */
    if (custoTabela.is_estimativa) {
      return {
        ...base, origem: 'tabela_referencia', situacao: 'confirmado', estimativa: true,
        valorRs: Number(custoTabela.valor_reajustado_rs) || 0,
        regraUsada: `tração ${tracao} × ${custoTabela.capacidade_min_kg}-${custoTabela.capacidade_max_kg}kg × ${paradas} paradas`,
        diasMontagem: custoTabela.dias_montagem ?? null,
        qtdMontadores: custoTabela.qtd_montadores ?? null,
        dataBase: custoTabela.atualizado_em || null,
        projetoEspecial: false,
        motivo: 'Valor de MO estimado por extrapolação estatística (Cadastros > Atualização de Custos), não é cotação real de instalador — exige a mesma aprovação técnica/financeira de um projeto especial antes de aprovar a precificação.',
      };
    }
    return {
      ...base, origem: 'tabela_referencia', situacao: 'confirmado', estimativa: false,
      valorRs: Number(custoTabela.valor_reajustado_rs) || 0,
      regraUsada: `tração ${tracao} × ${custoTabela.capacidade_min_kg}-${custoTabela.capacidade_max_kg}kg × ${paradas} paradas`,
      diasMontagem: custoTabela.dias_montagem ?? null,
      qtdMontadores: custoTabela.qtd_montadores ?? null,
      dataBase: custoTabela.atualizado_em || null,
      projetoEspecial: false,
      motivo: null,
    };
  }

  /* Orquestra a busca real (CadastroCustosStore.buscarCustoElevador, já
     existe desde Cadastros → Atualização de Custos) unidade por unidade
     e devolve a lista classificada — pronta pra virar o card "Mão de
     obra" da Precificação (Fase 4) e pra alimentar o motor V2
     (custo_economico_completo). Nunca lança: unidade sem tabela vira
     projeto especial, não erro.

     28/09 — uma Unidade com quantidade > 1 (o vendedor cotou "2" no
     Formulário pra dois elevadores idênticos numa Unidade só, ver
     feNovaUnidade em formulario-elevador.jsx) representa N equipamentos
     físicos reais, cada um exigindo sua própria instalação — mas até aqui
     virava só 1 linha/1 valor de MO nesta tabela (achado real: cotação
     Nº 955 com quantidade=2 mostrava 1 linha em vez de 2, e a soma de MO
     em pzMoTotalRs/precificacao-elevador.jsx contava só 1x). Cada Unidade
     agora vira `quantidade` linhas (mesma classificação/valor — a tabela
     de custo é por especificação, não por unidade física).

     Numeração pedida explicitamente pelo usuário: renumerar de forma
     contínua a partir do próprio identificador da Unidade (ex.:
     "VPEL-EL0955-1" com quantidade=2 vira "VPEL-EL0955-1"/"VPEL-EL0955-2"),
     não um sufixo aninhado. Risco real avisado e aceito pelo usuário:
     como o número final de cada Unidade já é o índice de ativo real dela
     (indice_ativo, 1 por Unidade — ver migration
     master_id_elevador_fase1), renumerar pra cima pode bater em cima do
     identificador de OUTRA Unidade real da mesma cotação (confirmado em
     produção: cotação 957 tem Unidade índice 1 com quantidade=6 ao lado de
     Unidades reais nos índices 4/6/9). getIdentificadorFisico() below só
     usa a numeração contínua quando o número não está em uso por NENHUM
     identificador já visto nesta chamada — nem um real (outra Unidade da
     mesma cotação) nem um já gerado pela expansão de OUTRA Unidade com
     quantidade > 1 processada antes (achado ao testar com >1 Unidade de
     quantidade>1 na mesma cotação: checar só contra os identificadores
     reais não bastava — duas Unidades diferentes geravam o mesmo número
     "emprestado" uma da outra, ex. duas fileiras de "VPEL-EL0957-7"
     apontando pra equipamentos físicos diferentes). Quando colide (com o
     real ou com o já gerado), cai pra um sufixo aninhado (ex.
     "VPEL-EL0955-1-4") só pra não fabricar um rótulo idêntico ao de outro
     equipamento de verdade. Em ambos os casos, isso é só pra exibição/soma
     nesta tabela — nunca grava de volta em
     formularios_elevador_unidades.identificador.

     29/09 — achado real na cotação Nº 962 (Juliana): a instalação de um
     equipamento pode não ser por conta da VerticalParts (terceiro cuida da
     montagem) — o vendedor/financeiro precisa poder excluir SÓ a Mão de
     obra daquele equipamento físico, sem reduzir a quantidade cotada (isso
     afetaria "Unidades desta cotação"/VMLE e a proposta, que leem
     `modelos[i].quantidade` como a contagem real de equipamento vendido).
     `m.moExcluidos` (contagem, não índice — os equipamentos físicos de uma
     mesma Unidade são idênticos entre si) marca quantos dos `quantidade`
     equipamentos físicos deste grupo têm a MO excluída; os últimos
     `moExcluidos` viram `situacao: 'excluido'`/`valorRs: 0` em vez da
     classificação normal. Nunca decrementa `quantidade`. */
  async function buscarMaoDeObraAutomatica(modelos) {
    const store = window.CadastroCustosStore;
    const lista = Array.isArray(modelos) ? modelos : [];
    const usados = new Set(lista.map((m) => m.identificador).filter(Boolean));

    function getIdentificadorFisico(identificadorBase, i, quantidade) {
      if (quantidade <= 1 || !identificadorBase) return identificadorBase;
      const m = /^(.*)-(\d+)$/.exec(identificadorBase);
      if (m) {
        const candidato = `${m[1]}-${Number(m[2]) + i}`;
        if (i === 0) return candidato; // próprio identificador da Unidade — sempre permitido
        if (!usados.has(candidato)) { usados.add(candidato); return candidato; }
        console.warn('[PrecificacaoElevadorStore] numeração contínua colidiria com outro identificador desta cotação', candidato, '— usando sufixo aninhado');
      }
      let fallback = `${identificadorBase}-${i + 1}`;
      while (usados.has(fallback)) fallback += '.';
      usados.add(fallback);
      return fallback;
    }

    const resultados = [];
    for (const m of lista) {
      const capacidadeKg = m.capacidadeKg != null && m.capacidadeKg !== '' ? Number(m.capacidadeKg) : null;
      let base;
      if (!store || !m.tracao || !m.paradas || !(capacidadeKg > 0)) {
        base = classificarMaoDeObraUnidade(m, null);
      } else {
        let custoTabela = null;
        try { custoTabela = await store.buscarCustoElevador(m.tracao, capacidadeKg, Number(m.paradas)); }
        catch (e) { console.warn('[PrecificacaoElevadorStore] buscarMaoDeObraAutomatica falhou pra unidade', m.unidadeId, e); }
        base = classificarMaoDeObraUnidade(m, custoTabela);
      }
      const quantidade = Math.max(1, Number(m.quantidade) || 1);
      const moExcluidos = Math.min(quantidade, Math.max(0, Number(m.moExcluidos) || 0));
      for (let i = 0; i < quantidade; i++) {
        const excluido = i >= quantidade - moExcluidos;
        const linha = excluido
          ? {
              ...base, origem: 'excluido_manual', situacao: 'excluido', valorRs: 0,
              estimativa: false, projetoEspecial: false,
              regraUsada: null, diasMontagem: null, qtdMontadores: null, dataBase: null,
              motivo: 'Instalação não é por conta da VerticalParts — Mão de obra excluída manualmente desta Precificação (o equipamento continua na cotação).',
            }
          : base;
        resultados.push({
          ...linha,
          identificador: getIdentificadorFisico(base.identificador, i, quantidade),
          equipamentoIndice: i + 1,
          equipamentoTotal: quantidade,
          avulso: !!m.avulso,
          moExcluido: excluido,
        });
      }
    }
    return resultados;
  }

  /* pz.modelos é um snapshot congelado em montarRascunho() na hora em que a
     precificação foi criada — igual pz.dados_envio congela o que foi
     mandado pro fornecedor. Uma precificação criada antes de tracao/
     capacidade_kg/paradas entrarem em montarRascunho (ou antes do vendedor
     preencher isso no Formulário) fica com esses campos ausentes pra
     sempre, mesmo que o Formulário seja completado depois — "Recalcular"
     rodando só em cima do snapshot nunca via o dado novo. Esta função
     busca o valor ATUAL direto em formularios_elevador_unidades (fonte
     viva, não o snapshot) casando por unidadeId, antes de rodar a busca de
     MO — é o que faz o botão "Recalcular" (e reabrir depois de editar o
     Formulário) realmente refletir o que está lá agora. */
  async function refrescarSpecUnidades(modelos) {
    const c = sb(); if (!c) return modelos;
    const unidadeIds = (modelos || []).map((m) => m.unidadeId).filter(Boolean);
    if (!unidadeIds.length) return modelos;
    const { data: unidadesForm, error } = await c.from('formularios_elevador_unidades')
      .select('id, tracao, capacidade_kg, paradas').in('id', unidadeIds);
    if (error) { console.warn('[PrecificacaoElevadorStore] refrescarSpecUnidades falhou', error); return modelos; }
    const porId = {}; (unidadesForm || []).forEach((u) => { porId[u.id] = u; });
    return modelos.map((m) => {
      const u = porId[m.unidadeId];
      if (!u) return m;
      return {
        ...m,
        tracao: u.tracao || null,
        capacidadeKg: u.capacidade_kg != null ? Number(u.capacidade_kg) : null,
        paradas: u.paradas != null ? Number(u.paradas) : null,
      };
    });
  }

  /* Re-roda a busca sob demanda (ex.: vendedor completou tração/capacidade/
     paradas no Formulário depois da precificação já criada, ou Financeiro
     atualizou a tabela de MO em Cadastros) — sem recriar tudo do zero.
     Também atualiza pz.modelos com a spec fresca (ver refrescarSpecUnidades)
     antes de buscar; não mexe em itens_instalacao_montagem (lista manual,
     V1) nem dispara recálculo de preço sozinho. */
  async function atualizarMaoDeObra(id) {
    const pz = await obter(id);
    const modelos = await refrescarSpecUnidades(pz.modelos || []);
    const moLookup = await buscarMaoDeObraAutomatica(modelos);
    await salvar(id, { modelos, mo_lookup: moLookup });
    return moLookup;
  }

  /* 28/09 — pedido do usuário: depois que a Proposta já foi enviada, o
     cliente às vezes pede pra acrescentar ou remover equipamento(s) do
     pedido. Isso NUNCA mexe em formularios_elevador_unidades (a Unidade
     original do Formulário, com seu indice_ativo/Master ID real) — só no
     snapshot `pz.modelos` desta Precificação, igual "Trocar" faz pra
     tração/capacidade/paradas só que ali sim grava na Unidade real (ver
     salvarSpecUnidade em precificacao-elevador.jsx). Um equipamento
     "novo" (specs diferentes de qualquer Unidade já cotada) nasce sem
     `unidadeId` real — ganha um id sintético (`avulso-...`) só pra ter
     uma chave única nesta lista, marcado `avulso: true`, e um
     identificador só descritivo (nunca um Master ID de verdade, pra não
     fingir que existe uma Unidade real por trás). */
  function novoIdSintetico() {
    return `avulso-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function acrescentarEquipamento(id, patch) {
    const pz = await obter(id);
    const modelos = [...(pz.modelos || [])];
    const quantidadeAdicional = Math.max(1, Number(patch.quantidadeAdicional) || 1);

    if (patch.modo === 'identico') {
      const idx = modelos.findIndex((m) => m.unidadeId === patch.unidadeId);
      if (idx === -1) throw new Error('Equipamento de referência não encontrado nesta precificação.');
      modelos[idx] = { ...modelos[idx], quantidade: (Number(modelos[idx].quantidade) || 1) + quantidadeAdicional };
    } else {
      const numeroAvulso = modelos.filter((m) => m.avulso).length + 1;
      modelos.push({
        unidadeId: novoIdSintetico(),
        identificador: `Equipamento adicional ${numeroAvulso}`,
        modelo: patch.modelo || '',
        quantidade: quantidadeAdicional,
        valorUnitarioUsd: 0,
        tracao: patch.tracao || null,
        capacidadeKg: patch.capacidadeKg != null && patch.capacidadeKg !== '' ? Number(patch.capacidadeKg) : null,
        paradas: patch.paradas != null && patch.paradas !== '' ? Number(patch.paradas) : null,
        avulso: true,
      });
    }
    const moLookup = await buscarMaoDeObraAutomatica(modelos);
    await salvar(id, { modelos, mo_lookup: moLookup });
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Formulário de Elevadores', acao: 'Acrescentou equipamento na Precificação',
      alvo: pz.numero_documento || id, alvo_id: id,
      detalhe: { modo: patch.modo, quantidadeAdicional, unidadeIdReferencia: patch.unidadeId || null, modelo: patch.modelo || null },
    });
    return moLookup;
  }

  /* 29/09 — corrigido depois de um achado real na cotação Nº 962: a
     versão anterior desta função decrementava (ou removia inteiro)
     `modelos[idx].quantidade` — o mesmo campo que "Unidades desta
     cotação"/VMLE (precificacao-elevador.jsx, tabela logo acima do card de
     Mão de obra) e a Proposta usam como a contagem real de equipamento
     vendido. Juliana clicou "Remover" só pra tirar a Mão de obra de um
     equipamento cuja instalação não é da VerticalParts — e o equipamento
     inteiro (goods, VMLE) sumiu da cotação junto. "Remover" agora só
     incrementa `moExcluidos` (nunca toca `quantidade`) — ver
     buscarMaoDeObraAutomatica. Ver restaurarEquipamentoMO() pra desfazer. */
  async function removerEquipamento(id, unidadeId) {
    const pz = await obter(id);
    let modelos = [...(pz.modelos || [])];
    const idx = modelos.findIndex((m) => m.unidadeId === unidadeId);
    if (idx === -1) throw new Error('Equipamento não encontrado nesta precificação.');
    const itemAlvo = modelos[idx];
    const quantidade = Math.max(1, Number(itemAlvo.quantidade) || 1);
    const atual = Math.min(quantidade, Math.max(0, Number(itemAlvo.moExcluidos) || 0));
    if (atual >= quantidade) throw new Error('Todos os equipamentos deste grupo já estão com a Mão de obra excluída.');
    modelos[idx] = { ...modelos[idx], moExcluidos: atual + 1 };
    const moLookup = await buscarMaoDeObraAutomatica(modelos);
    await salvar(id, { modelos, mo_lookup: moLookup });
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Formulário de Elevadores', acao: 'Removeu a Mão de obra de um equipamento na Precificação',
      alvo: pz.numero_documento || id, alvo_id: id,
      detalhe: { unidadeId, identificador: itemAlvo.identificador || null, modelo: itemAlvo.modelo || null, moExcluidosAntes: atual, moExcluidosDepois: atual + 1 },
    });
    return moLookup;
  }

  /* Desfaz removerEquipamento — devolve 1 equipamento físico do grupo pro
     cálculo normal de Mão de obra. */
  async function restaurarEquipamentoMO(id, unidadeId) {
    const pz = await obter(id);
    let modelos = [...(pz.modelos || [])];
    const idx = modelos.findIndex((m) => m.unidadeId === unidadeId);
    if (idx === -1) throw new Error('Equipamento não encontrado nesta precificação.');
    const itemAlvo = modelos[idx];
    const atual = Math.max(0, Number(itemAlvo.moExcluidos) || 0);
    if (atual <= 0) throw new Error('Este equipamento já está incluído no cálculo de Mão de obra.');
    modelos[idx] = { ...modelos[idx], moExcluidos: atual - 1 };
    const moLookup = await buscarMaoDeObraAutomatica(modelos);
    await salvar(id, { modelos, mo_lookup: moLookup });
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Formulário de Elevadores', acao: 'Restaurou a Mão de obra de um equipamento na Precificação',
      alvo: pz.numero_documento || id, alvo_id: id,
      detalhe: { unidadeId, identificador: itemAlvo.identificador || null, modelo: itemAlvo.modelo || null, moExcluidosAntes: atual, moExcluidosDepois: atual - 1 },
    });
    return moLookup;
  }

  async function listarParametrosFiscais() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('parametros_fiscais_elevador').select('*').eq('id', 'default').single();
    if (error) throw error;
    return data;
  }

  async function salvarParametrosFiscais(patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('parametros_fiscais_elevador')
      .update({ ...patch, updated_at: new Date().toISOString(), updated_by: (window.__VP_USER || {}).email || null })
      .eq('id', 'default');
    if (error) throw error;
  }

  function paramsCamelCase(p) {
    return {
      regimeTributario: p.regime_tributario,
      icmsImportacaoPct: p.icms_importacao_pct, ipiImportacaoPct: p.ipi_importacao_pct,
      pisImportacaoPct: p.pis_importacao_pct, cofinsImportacaoPct: p.cofins_importacao_pct, iiImportacaoPct: p.ii_importacao_pct,
      icmsVendaPct: p.icms_venda_pct, ipiVendaPct: p.ipi_venda_pct, pisVendaPct: p.pis_venda_pct, cofinsVendaPct: p.cofins_venda_pct,
      irpjVendaPct: p.irpj_venda_pct, csllVendaPct: p.csll_venda_pct, irpjAdicionalPct: p.irpj_adicional_pct,
      impostosPagarServicosPct: p.impostos_pagar_servicos_pct, markUpPct: p.mark_up_padrao_pct,
      comissaoConsultoriaPct: p.comissao_consultoria_pct, comissaoVendedorPct: p.comissao_vendedor_pct, comissaoIndicacaoPct: p.comissao_indicacao_pct,
      margemMinimaPct: p.margem_minima_pct,
    };
  }

  /* ---------- Lista de cotações de fornecedor já respondidas (fila da Precificação) ----------
     Inclui respondido/em_analise/aprovada — não só respondido — porque o time
     comercial/ADM pode avançar a decisão de compra (ver cotacoes-fornecedor.jsx)
     antes ou depois do Financeiro abrir a precificação. Filtrar só por
     "respondido" fazia a cotação sumir da fila assim que alguém decidia
     comprar, mesmo sem a precificação ter sido feita ainda (issue #161). */
  async function listarPendentes() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: cots, error } = await c.from('cotacoes_elevador_fornecedor')
      .select('id, numero_documento, fornecedor, formulario_elevador_id, status, responded_at, categoria_produto')
      .in('status', ['respondido', 'em_analise', 'aprovada']).eq('categoria_produto', 'elevador').order('responded_at', { ascending: false });
    if (error) throw error;

    /* "Direto pra Precificação" (pedido do usuário, 19/08): preço já veio
       combinado por fora, formulário nunca passa por Cotação a Fornecedor.
       São formulários marcados com envio_direto_precificacao_em que ainda
       não viraram uma precificacoes_elevador. */
    const { data: diretos } = await c.from('formularios_elevador')
      .select('id, numero_cotacao, cliente_id, clientes(razao_social, cnpj), envio_direto_precificacao_em')
      .not('envio_direto_precificacao_em', 'is', null).order('envio_direto_precificacao_em', { ascending: false });

    const formularioIds = [...new Set((cots || []).map((c2) => c2.formulario_elevador_id))];
    const { data: forms } = formularioIds.length
      ? await c.from('formularios_elevador').select('id, numero_cotacao, cliente_id, clientes(razao_social, cnpj)').in('id', formularioIds)
      : { data: [] };
    const { data: precificacoes } = await c.from('precificacoes_elevador').select('id, cotacao_fornecedor_id, formulario_elevador_id, status');
    const formPorId = {}; (forms || []).forEach((f) => { formPorId[f.id] = f; });
    const pzPorCotacao = {}; (precificacoes || []).forEach((p) => { if (p.cotacao_fornecedor_id) pzPorCotacao[p.cotacao_fornecedor_id] = p; });
    const pzPorFormulario = {}; (precificacoes || []).forEach((p) => { if (!p.cotacao_fornecedor_id) pzPorFormulario[p.formulario_elevador_id] = p; });

    const daCotacao = (cots || []).map((cot) => {
      const form = formPorId[cot.formulario_elevador_id] || {};
      const pz = pzPorCotacao[cot.id];
      return {
        cotacaoFornecedorId: cot.id, numeroDocumentoFornecedor: cot.numero_documento, fornecedor: cot.fornecedor,
        formularioElevadorId: cot.formulario_elevador_id, numeroCotacao: form.numero_cotacao ?? null,
        clienteNome: (form.clientes && form.clientes.razao_social) || null, clienteCnpj: (form.clientes && form.clientes.cnpj) || null,
        respondedAt: cot.responded_at, precificacaoId: pz ? pz.id : null, precificacaoStatus: pz ? pz.status : null,
        statusCotacao: cot.status, direto: false,
      };
    });
    const diretosResultado = (diretos || [])
      .filter((form) => !pzPorFormulario[form.id]) // já virou precificação → some daqui, aparece na lista normal de precificações
      .map((form) => ({
        cotacaoFornecedorId: null, numeroDocumentoFornecedor: null, fornecedor: null,
        formularioElevadorId: form.id, numeroCotacao: form.numero_cotacao ?? null,
        clienteNome: (form.clientes && form.clientes.razao_social) || null, clienteCnpj: (form.clientes && form.clientes.cnpj) || null,
        respondedAt: form.envio_direto_precificacao_em, precificacaoId: null, precificacaoStatus: null,
        statusCotacao: null, direto: true,
      }));
    return [...diretosResultado, ...daCotacao];
  }

  /* ---------- Monta o snapshot inicial (modelos, quantidade, VMLE) a partir do
     Formulário + resposta do fornecedor — ponto de entrada "herdar o Cotação Nº".
     cotacaoFornecedorId nulo = caminho "direto pra Precificação" (pedido do
     usuário, 19/08): preço já veio combinado por fora (CEO/Financeiro por
     e-mail, telefone etc.), não faz sentido esperar resposta de fornecedor
     que nunca vai chegar. Modelos nascem das próprias unidades do
     Formulário, com valor zerado — o Financeiro digita à mão na tela de
     cálculo de sempre, igual já faz com VMLE/frete quando falta algo. */
  async function montarRascunho(formularioElevadorId, cotacaoFornecedorId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: formulario, error: e1 } = await c.from('formularios_elevador').select('*').eq('id', formularioElevadorId).single();
    if (e1) throw e1;

    let modelos, vmleUsd, freteSeguroCapataziaUsd, containersSeed = [];
    if (!cotacaoFornecedorId) {
      const { data: unidadesForm, error: e3 } = await c.from('formularios_elevador_unidades')
        .select('id, identificador, modelo, quantidade, tracao, capacidade_kg, paradas').eq('formulario_id', formularioElevadorId).order('indice_ativo');
      if (e3) throw e3;
      modelos = (unidadesForm || []).map((u) => ({
        unidadeId: u.id, identificador: u.identificador,
        modelo: u.modelo || '', quantidade: Number(u.quantidade) || 1,
        valorUnitarioUsd: 0,
        tracao: u.tracao || null,
        capacidadeKg: u.capacidade_kg != null ? Number(u.capacidade_kg) : null,
        paradas: u.paradas != null ? Number(u.paradas) : null,
      }));
      vmleUsd = 0;
      freteSeguroCapataziaUsd = 0;
    } else {
      const { data: cotFornecedor, error: e2 } = await c.from('cotacoes_elevador_fornecedor').select('*').eq('id', cotacaoFornecedorId).single();
      if (e2) throw e2;
      var cambioNaCotacao = cotFornecedor.cambio_na_resposta_usd_brl ?? null;

      const unidades = (cotFornecedor.dados_envio && cotFornecedor.dados_envio.unidades) || [];
      const itensResposta = (cotFornecedor.respostas && cotFornecedor.respostas.itens) || [];
      const itemPorUnidade = {}; itensResposta.forEach((it) => { itemPorUnidade[it.unidade_id] = it; });

      modelos = unidades.map((u) => {
        const item = itemPorUnidade[u.unidade_id] || {};
        return {
          unidadeId: u.unidade_id, identificador: u.identificador,
          modelo: item.modelo_fornecedor || u.modelo || '',
          quantidade: Number(u.quantidade) || 1,
          valorUnitarioUsd: window.parseMoeda(item.preco_unitario),
          tracao: u.tracao || null,
          capacidadeKg: u.capacidade_kg != null ? Number(u.capacidade_kg) : null,
          paradas: u.paradas != null ? Number(u.paradas) : null,
        };
      });
      vmleUsd = itensResposta.reduce((s, it) => s + window.parseMoeda(it.preco_total), 0);

      /* Frete internacional + outras taxas informados pelo fornecedor (USD) —
         agora campos estruturados na resposta — herdam pra o bucket USD de
         frete/seguro/capatazia da precificação (antes vinham zerados e o
         precificador tinha que digitar à mão, no campo errado). */
      const respostas = cotFornecedor.respostas || {};
      const freteInternacionalUsd = Number(respostas.frete_internacional_usd) || 0;
      const taxasExtrasUsd = Number(respostas.taxas_extras_usd) || 0;
      freteSeguroCapataziaUsd = freteInternacionalUsd + taxasExtrasUsd;

      containersSeed = parseContainerNo(respostas.container_no);
      if (containersSeed.length) {
        const custosContainers = await window.CadastroCustosStore?.listarContainers();
        containersSeed = enriquecerContainersComCusto(containersSeed, custosContainers);
      }
    }

    const parametros = await listarParametrosFiscais();
    const moLookup = await buscarMaoDeObraAutomatica(modelos);

    return {
      formulario_elevador_id: formularioElevadorId,
      numero_cotacao: formulario.numero_cotacao ?? null,
      cotacao_fornecedor_id: cotacaoFornecedorId || null,
      cambio_na_cotacao_usd_brl: typeof cambioNaCotacao !== 'undefined' ? cambioNaCotacao : null,
      vmle_usd: vmleUsd,
      frete_seguro_capatazia_usd: freteSeguroCapataziaUsd,
      containers: containersSeed,
      modelos,
      mo_lookup: moLookup,
      percentual_servicos: 0.30,
      parametros_fiscais_snapshot: parametros,
      mark_up_pct: parametros.mark_up_padrao_pct,
      // Card 90d tem markup padrão próprio (Financeiro, 01/10/2026): 40,5% (120d) × 38,1% (90d).
      mark_up_pct_expresso: parametros.mark_up_padrao_expresso_pct ?? null,
      // V2 (custo econômico completo) — motor oficial desde 29/08 (decisão
      // registrada em conversa, sem necessidade de aval formal do
      // Financeiro por enquanto). Nasce em modo markup_sobre_custo: mesma
      // alavanca de sempre (Markup sobre o custo, acima), só que aplicada
      // sobre o custo completo em vez de só a mercadoria — "aplicar 22%
      // precisa ser real". margem_desejada_pct fica preenchida como
      // referência caso o Financeiro troque de modo na tela.
      modo_formacao_preco: 'markup_sobre_custo',
      margem_desejada_pct: Number(parametros.margem_minima_pct) || 0.2,
      comissao_consultoria_pct: parametros.comissao_consultoria_pct,
      comissao_vendedor_pct: parametros.comissao_vendedor_pct,
      comissao_indicacao_pct: parametros.comissao_indicacao_pct,
      _formulario: formulario, // usado só em memória p/ montar o DIFAL — não é persistido
    };
  }

  /* Nº do documento (revisão 27/08): a Precificação NÃO tem mais numeração
     própria (RPC gerar_numero_precificacao_elevador, sequência independente
     "VPPZ-000X") — reaproveita o MESMO Nº da Cotação, só trocando o
     prefixo de etapa (VPPC-0950). Um único número acompanha o negócio do
     início ao fim; a sequência antiga fica só como fallback raríssimo
     (formulário sem numero_cotacao, o que não deveria acontecer). */
  async function criar(formularioElevadorId, cotacaoFornecedorId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const rascunho = await montarRascunho(formularioElevadorId, cotacaoFornecedorId);
    delete rascunho._formulario;
    let numero_documento;
    if (rascunho.numero_cotacao != null) {
      numero_documento = window.MasterIdEngine.etapaId('precificacao', rascunho.numero_cotacao);
    } else {
      const { data, error } = await c.rpc('gerar_numero_precificacao_elevador');
      if (error) throw error;
      numero_documento = data;
    }
    const { data, error } = await c.from('precificacoes_elevador').insert({ ...rascunho, numero_documento }).select().single();
    if (error) throw error;
    return data;
  }

  async function obter(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('precificacoes_elevador').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async function salvar(id, patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('precificacoes_elevador').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  /* ---------- Calcula (2 passadas por causa do DIFAL — ver nota abaixo) e salva ---------- */
  async function calcularEsalvar(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const pz = await obter(id);
    const { data: formulario, error: e1 } = await c.from('formularios_elevador').select('*').eq('id', pz.formulario_elevador_id).single();
    if (e1) throw e1;
    // contribuinte_icms e o UF fiscal do cliente ficam em `clientes`, não em formularios_elevador.
    let cliente = null;
    if (formulario.cliente_id) {
      const { data } = await c.from('clientes').select('contribuinte_icms, endereco_estado').eq('id', formulario.cliente_id).maybeSingle();
      cliente = data;
    }

    const params = paramsCamelCase(pz.parametros_fiscais_snapshot || {});
    /* Card base = 120 dias (container compartilhado). Com 1 equipamento o
       container (+ capatazia) é dividido pelos equipamentos que o dividem
       (padrão 2, editável — regra do Financeiro 01/10/2026, vem da planilha
       FIN (120)); com 2+ o container é pago uma vez só pra cotação inteira,
       então não divide (preço por equipamento já cai por total ÷ quantidade). */
    const qtdEquipamentos = (pz.modelos || []).reduce((s, m) => s + (Number(m.quantidade) || 0), 0) || 1;
    // Um container comporta no máximo 2 elevadores (regra física, Financeiro 01/10): o equipamento
    // sozinho em 120d viaja com outro, então divide o container por 2 — fixo, sem campo na tela.
    const divisor120 = qtdEquipamentos <= 1 ? 2 : 1;
    const baseInputs = {
      containerRateioDivisor: divisor120,
      vmleUsd: pz.vmle_usd, seguroUsd: pz.seguro_usd, freteSeguroCapataziaUsd: pz.frete_seguro_capatazia_usd,
      siscomexRs: pz.siscomex_rs, txCambial: pz.tx_cambial, outrasDespesasImportacaoRs: pz.outras_despesas_importacao_rs,
      despachanteDesembaracoRs: pz.despachante_desembaraco_rs, demurrageRs: pz.demurrage_rs,
      freteInternoRs: pz.frete_interno_rs, armazenagemRs: pz.armazenagem_rs,
      itensInstalacaoMontagem: pz.itens_instalacao_montagem || [],
      containers: pz.containers || [],
      itensDespesasExtras: pz.itens_despesas_extras || [],
      quantidadeEquipamentos: (pz.modelos || []).reduce((s, m) => s + (Number(m.quantidade) || 0), 0) || 1,
      percentualServicos: pz.percentual_servicos, modelos: pz.modelos || [],
      markUpPct: pz.mark_up_pct, comissaoConsultoriaPct: pz.comissao_consultoria_pct,
      comissaoVendedorPct: pz.comissao_vendedor_pct, comissaoIndicacaoPct: pz.comissao_indicacao_pct,
      parametros: params,
    };

    // 1ª passada — sem DIFAL, só pra ter um "Valor da Operação" de referência.
    const pass1 = window.PrecificacaoElevadorEngine.calcular({ ...baseInputs, difalCustoRs: 0 });

    const ufFaturamento = cliente ? cliente.endereco_estado : null;
    const ufDestino = formulario.local_obra_estado || ufFaturamento;
    const estadoDestino = await window.DifalEngine.buscarEstado(ufDestino);
    const difal = window.DifalEngine.calcular({
      ufFaturamento, ufEntrega: formulario.local_obra_estado,
      finalidadeCompra: formulario.finalidade_compra, contribuinteIcms: cliente ? cliente.contribuinte_icms : null,
      valorOperacao: pass1.precificacao.precoVendaProposta, estadoDestino,
    });
    const difalCustoRs = difal.responsavel_recolhimento === 'emitente_verticalparts' ? difal.valor_difal : 0;

    // 2ª passada — já com o custo do DIFAL (quando é da VerticalParts) refletido no lucro.
    const resultado = window.PrecificacaoElevadorEngine.calcular({ ...baseInputs, difalCustoRs });

    // V2 (custo econômico completo) roda lado a lado, mesmo baseInputs +
    // DIFAL da 2ª passada — nunca substitui o V1 (`resultado`, ainda o
    // motor oficial), só grava pra comparação/auditoria (Fase 4/5).
    // margem_desejada_pct fica null em toda precificação criada antes desta
    // coluna existir (a migration não tem default — só montarRascunho seta
    // pra registro novo); sem este fallback, calcularV2 tratava null como
    // 0% de margem desejada (Number(null)||0) e o preço/margem V2 saía
    // artificialmente baixo, sem o usuário nunca ter escolhido isso.
    const margemDesejadaPct = pz.margem_desejada_pct != null ? pz.margem_desejada_pct : (params.margemMinimaPct || 0.2);
    const v2Extras = {
      modoFormacaoPreco: pz.modo_formacao_preco,
      margemDesejadaPct,
      contingenciaValor: pz.contingencia_valor,
      outrosCustosNaoRecuperaveisRs: pz.outros_custos_nao_recuperaveis_rs,
    };
    const resultadoV2 = window.PrecificacaoElevadorEngine.calcularV2({ ...baseInputs, difalCustoRs, ...v2Extras });

    /* Duas modalidades de entrega (issue "Precificação real"): 90 dias
       (container exclusivo, frete mais caro) × 120 dias (container
       compartilhado, o frete_seguro_capatazia_usd de sempre). Só o frete
       muda — reaproveita o mesmo custoEconomicoCompleto/markup/comissões
       via calcularV2, só trocando freteSeguroCapataziaUsd. DIFAL não é
       recalculado pro cenário expresso (a diferença de preço não muda o
       UF/regra de DIFAL, só o valor-base — aproximação aceitável pra uma
       cotação comparativa, não uma aprovação final). Sem frete expresso
       preenchido, resultado_v2_expresso fica vazio — não força a
       modalidade pra quem não precisa dela. */
    // 01/10/2026 — o card de 90 dias (container exclusivo) só existe com 1 equipamento
    // e paga o container + capatazia inteiros (rateio 1). O antigo frete expresso digitado
    // (frete_seguro_capatazia_usd_expresso) foi removido do banco em 01/10/2026.
    const resultadoV2Expresso = qtdEquipamentos <= 1
      ? window.PrecificacaoElevadorEngine.calcularV2({
          ...baseInputs, containerRateioDivisor: 1, difalCustoRs, ...v2Extras,
          // Markup próprio do card 90d (Financeiro, 01/10). Null = usa o mesmo do 120d, como antes.
          markUpPct: pz.mark_up_pct_expresso != null ? pz.mark_up_pct_expresso : pz.mark_up_pct,
        })
      : {};

    await salvar(id, { resultado, resultado_v2: resultadoV2, resultado_v2_expresso: resultadoV2Expresso, difal, status: 'calculado' });
    return { resultado, resultadoV2, resultadoV2Expresso, difal };
  }

  /* ---------- Aprovação (issue #4) ----------
     "Calcular" só grava o resultado — nada travava preço abaixo da margem
     mínima nem campo obrigatório vazio, e a Proposta puxava a última
     precificação encontrada (calculada ou não) sem revisão nenhuma. Aprovar
     congela o snapshot que a Proposta vai usar (ver proposta-heranca.js,
     que agora prioriza status 'aprovado'). */
  function camposObrigatoriosFaltando(pz) {
    const faltando = [];
    if (!(Number(pz.vmle_usd) > 0)) faltando.push('VMLE (USD)');
    if (!(Number(pz.tx_cambial) > 0)) faltando.push('Câmbio (R$/US$)');
    if (!(pz.modelos || []).length) faltando.push('Unidades/modelos');
    /* 23/08 (Gelson): o custoTotalMercadorias calculado aqui vira o "teto de
       custo" que o CEO aprova mais adiante (ver aval-financeiro-store.js) —
       se a lista de custos de instalação/montagem estiver vazia, o teto
       fica artificialmente baixo (ART, Andaime/Munck, Frete etc. nunca
       entraram na conta), e o alerta de estouro vira ruído. Por isso passa
       a ser obrigatório listar pelo menos 1 item aqui antes de aprovar. */
    if (!(pz.itens_instalacao_montagem || []).length) faltando.push('Custos de instalação/montagem (ART, andaime/munck, frete, instalador…)');
    /* 23/08 (Gelson): comissão de vendedor é regra clara (padrão 2%, ver
       parametros_fiscais_elevador), mas nada impedia zerar sem querer —
       e ela agora conta pro teto de custo do CEO (ver
       aval-financeiro-store.js), então precisa estar preenchida. */
    if (!(Number(pz.comissao_vendedor_pct) > 0)) faltando.push('Comissão do vendedor (%)');
    return faltando;
  }

  async function aprovar(id, { forcarAbaixoMinima } = {}) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const pz = await obter(id);
    if (!pz.resultado) throw new Error('Calcule a precificação antes de aprovar.');
    const faltando = camposObrigatoriosFaltando(pz);
    if (faltando.length) throw new Error(`Campos obrigatórios sem valor: ${faltando.join(', ')}.`);
    const margemMinima = Number((pz.parametros_fiscais_snapshot || {}).margem_minima_pct) || 0;
    // Motor oficial desde 29/08 é o V2 (custo econômico completo) — o V1
    // deixava markup positivo conviver com margem real negativa (issue
    // "Precificação real"). Precificação sem resultado_v2 ainda (nunca
    // recalculada após a migração) cai pro V1, não trava aprovação por
    // um dado que nunca existiu pra ela.
    const margemV2 = pz.resultado_v2 && pz.resultado_v2.precificacao ? Number(pz.resultado_v2.precificacao.margemEfetivaPct) : null;
    const margemFinal = margemV2 != null ? margemV2 : Number((pz.resultado.precificacao || {}).margemFinalPct) || 0;
    if (margemFinal < margemMinima && !forcarAbaixoMinima) {
      const err = new Error(`Margem ${margemV2 != null ? 'efetiva (V2)' : 'final (V1)'} (${(margemFinal * 100).toFixed(2)}%) abaixo da margem mínima (${(margemMinima * 100).toFixed(2)}%).`);
      err.margemAbaixoMinima = true;
      throw err;
    }
    const now = new Date().toISOString();
    // status usa o enum já existente na tabela ('rascunho'|'calculado'|'finalizado') — 'finalizado' é o estado de aprovado.
    const { error } = await c.from('precificacoes_elevador').update({
      status: 'finalizado', aprovado_em: now, aprovado_por: (window.__VP_USER || {}).email || null, updated_at: now,
    }).eq('id', id);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Formulário de Elevadores', acao: 'Aprovou a precificação',
      alvo: pz.numero_documento || id, alvo_id: id,
      detalhe: { margemFinal, forcarAbaixoMinima: !!forcarAbaixoMinima },
    });

    /* Proposta nasce sozinha ao aprovar (pedido do usuário, 27/08) — puxa
       Lead/Cliente + o preço já calculado na Precificação (resultado.
       precoVendaPorEquipamento, via PropostaHeranca.montarPrefill, que já
       fazia isso pro fluxo manual). Nasce EDITÁVEL, pronta pra o vendedor
       revisar/ajustar e disparar manualmente — a trava (won_editable/
       destravada_em) só entra quando a PROPOSTA em si for aprovada, igual
       já funciona hoje. Idempotente: não duplica se já existe proposta
       pra esse Nº de Cotação (ex.: alguém já criou manualmente antes).
       Falha aqui não desfaz a aprovação da Precificação — só avisa. */
    try {
      await criarPropostaAutomatica({ ...pz, numero_cotacao: pz.numero_cotacao });
    } catch (e) {
      console.warn('[PrecificacaoElevadorStore] Falha ao criar proposta automática ao aprovar:', e);
    }
  }

  async function criarPropostaAutomatica(pz) {
    const c = sb();
    if (!c || pz.numero_cotacao == null || !window.PropostaHeranca || !window.PropostaStore || !window.MasterIdEngine) return;
    const { data: existente } = await c.from('propostas').select('id').eq('numero_cotacao', pz.numero_cotacao).maybeSingle();
    if (existente) return; // já tem proposta pra essa cotação — não duplica
    const r = await window.PropostaHeranca.prefillPorNumeroCotacao(pz.numero_cotacao);
    if (!r.encontrado) return;
    const numero = window.MasterIdEngine.etapaId('proposta', pz.numero_cotacao);
    const valorUnit = Number((r.prefill.elevador || {}).valores?.valorUnit) || 0;
    const quantidade = Number((r.prefill.elevador || {}).valores?.quantidade) || 1;
    /* deepMergeProposta (não deepMergeHeranca): proposta nova (editId: null),
       sem digitação de vendedor pra proteger. deepMergeHeranca tratava o
       placeholder do makeDefaultProposta() como conteúdo real e descartava a
       herança quando havia mais de 1 equipamento (achado na cotação 950). */
    const dadosCompletos = window.deepMergeProposta(window.makeDefaultProposta(), { ...r.prefill, numero });
    await window.PropostaStore.salvar({ data: dadosCompletos, eq: 'elevador', editId: null, valorTotal: valorUnit * quantidade });
  }

  /* ---------- Ressincroniza modelos/vmle a partir da resposta do fornecedor ----------
     Cobre o caso comum: a precificação nasceu ANTES do fornecedor responder
     (ou a resposta veio em formato de texto tipo "$18,990" — bug corrigido
     27/08, ver window.parseMoeda), então valorUnitarioUsd ficou zerado e
     nunca foi atualizado sozinho depois. Só reescreve valorUnitarioUsd (por
     unidade, casando por unidadeId) e vmle_usd — preserva tudo mais que o
     Financeiro já tenha digitado (câmbio, frete, percentuais). Sem
     cotacao_fornecedor_id (fluxo "direto pra Precificação") não há o que
     ressincronizar — lança erro claro em vez de silenciar. */
  /* 15/09 — achado real (auditoria do tour.md): esta função sobrescrevia
     modelo/valorUnitarioUsd/vmle_usd incondicionalmente, mesmo quando o
     Financeiro já tinha corrigido esses valores manualmente na tela — sem
     diff, sem aviso, sem chance de cancelar. Agora sempre calcula o diff
     contra os valores atuais; com dryRun:true (default) só retorna o que
     mudaria, sem gravar — o chamador decide se avisa o usuário antes de
     confirmar a gravação de verdade (dryRun:false). */
  async function ressincronizarDoFornecedor(precificacaoId, { dryRun = true } = {}) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const pz = await obter(precificacaoId);
    if (!pz.cotacao_fornecedor_id) throw new Error('Esta precificação não veio de uma Cotação a Fornecedor — nada para ressincronizar.');
    const { data: cotFornecedor, error } = await c.from('cotacoes_elevador_fornecedor').select('*').eq('id', pz.cotacao_fornecedor_id).single();
    if (error) throw error;
    const itensResposta = (cotFornecedor.respostas && cotFornecedor.respostas.itens) || [];
    if (!itensResposta.length) throw new Error('O fornecedor ainda não respondeu esta cotação.');
    const itemPorUnidade = {}; itensResposta.forEach((it) => { itemPorUnidade[it.unidade_id] = it; });

    const diffs = [];
    const modelos = (pz.modelos || []).map((m) => {
      const item = itemPorUnidade[m.unidadeId];
      if (!item) return m;
      const modeloNovo = item.modelo_fornecedor || m.modelo;
      const valorNovo = window.parseMoeda(item.preco_unitario);
      if (modeloNovo !== m.modelo || valorNovo !== m.valorUnitarioUsd) {
        diffs.push({ unidadeId: m.unidadeId, de: { modelo: m.modelo, valorUnitarioUsd: m.valorUnitarioUsd }, para: { modelo: modeloNovo, valorUnitarioUsd: valorNovo } });
      }
      return { ...m, modelo: modeloNovo, valorUnitarioUsd: valorNovo };
    });
    const vmleUsd = itensResposta.reduce((s, it) => s + window.parseMoeda(it.preco_total), 0);
    if (vmleUsd !== (Number(pz.vmle_usd) || 0)) {
      diffs.push({ unidadeId: null, de: { vmle_usd: pz.vmle_usd }, para: { vmle_usd: vmleUsd } });
    }
    // Câmbio congelado: só preenche se ainda não tinha (precificação nasceu
    // antes dessa coluna existir, ou antes do fornecedor ter câmbio salvo) —
    // depois de setado uma vez, nunca reescreve (é congelado por definição).
    const patch = { modelos, vmle_usd: vmleUsd };
    if (pz.cambio_na_cotacao_usd_brl == null && cotFornecedor.cambio_na_resposta_usd_brl != null) {
      patch.cambio_na_cotacao_usd_brl = cotFornecedor.cambio_na_resposta_usd_brl;
    }
    if (dryRun) return { modelos, vmle_usd: vmleUsd, diffs };
    await salvar(precificacaoId, patch);
    return { modelos, vmle_usd: vmleUsd, diffs };
  }

  window.PrecificacaoElevadorStore = {
    listarParametrosFiscais, salvarParametrosFiscais,
    listarPendentes, criar, obter, salvar, calcularEsalvar,
    camposObrigatoriosFaltando, aprovar, ressincronizarDoFornecedor,
    parseContainerNo, buscarContainerCustoPorIso, enriquecerContainersComCusto, divergenciasContainerComCadastro,
    classificarMaoDeObraUnidade, buscarMaoDeObraAutomatica, atualizarMaoDeObra,
    acrescentarEquipamento, removerEquipamento, restaurarEquipamentoMO,
  };
}());
