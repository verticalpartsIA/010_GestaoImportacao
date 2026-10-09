/* ============================================================
   proposta-heranca.js — Motor de herança da Proposta Comercial.

   A proposta é o destino do pipeline:
     Formulário de Coleta → Cotação a Fornecedor → Precificação → PROPOSTA

   Mas ela não fica presa a isso: o vendedor pode abrir uma proposta em
   branco e preencher tudo na mão. Se em algum momento ele informar o
   Nº da Cotação, este módulo busca o que já foi coletado/calculado e
   devolve o prefill — sem redigitação.

   Fonte única de verdade das duas entradas:
     - "puxa"  : editor de proposta, pelo Nº da Cotação digitado
     - "empurra": tela de Precificação, no botão "Gerar Proposta"

   window.PropostaHeranca
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* ---------- Busca as fontes a partir do Nº da Cotação ----------
     numeroCotacao é o inteiro que o vendedor conhece (ex.: 902), o mesmo
     que vem sendo continuado desde a planilha histórica. */
  async function buscarFontes(numeroCotacao) {
    const c = sb();
    if (!c) throw new Error('Supabase não carregado');
    // Aceita tanto o nº puro (898) quanto o Master ID completo (VPEL-EL0898).
    const numero = window.MasterIdEngine.parseNumeroCotacao(numeroCotacao);
    if (!numero) throw new Error('Informe um Nº da Cotação válido.');

    const { data: formulario, error: errF } = await c
      .from('formularios_elevador')
      .select('*, clientes(*)')
      .eq('numero_cotacao', numero)
      .maybeSingle();
    if (errF) throw errF;
    if (!formulario) return { encontrado: false, numeroCotacao: numero };

    const [{ data: unidades }, { data: cotacoes }, { data: precificacoes }] = await Promise.all([
      c.from('formularios_elevador_unidades').select('*')
        .eq('formulario_id', formulario.id).order('created_at', { ascending: true }),
      c.from('cotacoes_elevador_fornecedor').select('*')
        .eq('formulario_elevador_id', formulario.id).order('created_at', { ascending: false }),
      c.from('precificacoes_elevador').select('*')
        .eq('numero_cotacao', numero).order('created_at', { ascending: false }),
    ]);

    /* Qual cotação vale? A que o Financeiro realmente precificou — é a que
       gerou o preço que vai na proposta. Sem precificação, cai na ordem de
       maturidade do pipeline (aprovada > em análise > respondida > última).
       Entre as precificações do mesmo Nº de Cotação, prioriza a que foi
       explicitamente aprovada (issue #4) — sem isso, a Proposta podia puxar
       um rascunho de cálculo nunca revisado só por ser o mais recente. */
    const lista = cotacoes || [];
    const listaPz = precificacoes || [];
    const precificacao = listaPz.find((p) => p.status === 'finalizado') || listaPz[0] || null;
    const cotacao = (precificacao && lista.find((x) => x.id === precificacao.cotacao_fornecedor_id))
      || lista.find((x) => x.status === 'aprovada')
      || lista.find((x) => x.status === 'em_analise')
      || lista.find((x) => x.status === 'respondido')
      || lista[0] || null;

    return {
      encontrado: true,
      numeroCotacao: numero,
      formulario,
      cliente: formulario.clientes || {},
      unidades: unidades || [],
      cotacao,
      precificacao,
    };
  }

  /* ---------- Especificações técnicas por equipamento ----------
     Combina o que foi coletado na Unidade com o snapshot congelado que foi
     enviado ao fornecedor (dados_envio), e carimba o código do ativo
     (Master ID nível equipamento, ex.: VPEL-EL0902-A-1). */
  function montarEspecificacoes(fontes) {
    const { unidades, cotacao, precificacao } = fontes;
    const envio = (cotacao && cotacao.dados_envio && cotacao.dados_envio.unidades) || [];
    const modelos = (precificacao && precificacao.modelos) || [];
    /* Rateio calculado (valorUnitarioRs por unidade) mora em resultado(_v2)
       .modelos — é OUTPUT do motor, não o snapshot de entrada acima (que só
       tem modelo/quantidade/valorUnitarioUsd). Mesma seleção V1/V2 de
       montarPrefill(). */
    const modelosCalc = (precificacao && precificacao.resultado_v2 && precificacao.resultado_v2.modelos)
      || (precificacao && precificacao.resultado && precificacao.resultado.modelos) || [];
    const cefStore = window.CotacaoElevadorFornecedorStore;

    const base = unidades.length ? unidades : envio.map((u) => ({ ...u, id: u.unidade_id }));

    return base.map((u) => {
      const uid = u.id || u.unidade_id;
      const tec = envio.find((e) => e.unidade_id === uid) || {};
      const mod = modelos.find((m) => m.unidadeId === uid) || {};
      const modCalc = modelosCalc.find((m) => m.unidadeId === uid) || {};
      const capKg = u.capacidade_kg || tec.capacidade_kg;
      const capPass = u.capacidade_pessoas || tec.capacidade_pessoas;
      const largura = u.caixa_largura_mm || tec.caixa_largura_mm;
      const prof = u.caixa_profundidade_mm || tec.caixa_profundidade_mm;
      const paradas = u.paradas || tec.paradas;
      const tipo = u.tipo || tec.tipo || '';
      const cabLargura = u.cabina_largura_mm || tec.cabina_largura_mm;
      const cabProf = u.cabina_profundidade_mm || tec.cabina_profundidade_mm;
      /* Elevador de Carga também pode ter capacidade de passageiros (não é
         exclusividade do tipo Passageiro) — o "4000 Passageiros" visto na
         cotação 950 era só o vendedor tendo digitado o número errado no
         Formulário (corrigido pra 53 depois), não uma regra de categoria.
         Não suprimir por tipo aqui. */
      return {
        id: u.identificador || tec.identificador || '',
        modelo: mod.modelo || u.modelo || tec.modelo || '',
        empreendimento: '',
        carac: tipo,
        denominacao: u.pavimentos_desc || tec.pavimentos_desc || '',
        percurso: String(u.percurso_mm || tec.percurso_mm || ''),
        capacidade: capKg ? `${capPass ? capPass + ' Passageiros x ' : ''}${capKg}Kg` : '',
        dimensoesCaixa: (largura || prof) ? `${largura || '?'} x ${prof || '?'}mm` : '',
        profPoço: String(u.poco_mm || tec.poco_mm || ''),
        dimensoesCabine: (cabLargura || cabProf) ? `${cabLargura || '?'} x ${cabProf || '?'}mm` : '',
        tensao: u.tensao_principal || tec.tensao_principal || '',
        tracao: u.tracao || tec.tracao || '',
        vel: String(u.velocidade_ms || tec.velocidade_ms || ''),
        andaresParadasPortas: paradas ? `${paradas} Paradas` : '',
        qtd: Number(u.quantidade || tec.quantidade) || 1,
        codigoAtivo: (cotacao && cefStore) ? cefStore.assetMasterId(cotacao, u.indice_ativo ?? tec.indice_ativo) : null,
        /* Valor rateado por equipamento (ponderado pelo custo USD real do
           modelo, ver precificacao-elevador-engine.js) — distinto de
           precoVendaPorEquipamento, que é só a média. Usado em
           montarPrefill() pra dar a cada item da proposta seu valor real,
           em vez do mesmo valor clonado pra todos. */
        valorUnitarioRs: Number(modCalc.valorUnitarioRs) || null,
      };
    });
  }

  /* Lista granular de ativos — o que Contrato de Venda e Contrato
     Instalador consomem depois (Master ID Fase 2). */
  function montarAtivos(fontes) {
    const { unidades, cotacao, precificacao } = fontes;
    const envio = (cotacao && cotacao.dados_envio && cotacao.dados_envio.unidades) || [];
    const cefStore = window.CotacaoElevadorFornecedorStore;
    const base = unidades.length ? unidades : envio.map((u) => ({ ...u, id: u.unidade_id }));
    /* Mão de obra de instalação já é calculada por unidade em Precificação
       (pz.mo_lookup, ver precificacao-elevador.jsx) — é a parcela dominante
       (e a única hoje genuinamente por equipamento) do custo de instalação.
       Expõe aqui pra granularidade sobreviver até Contrato Instalador/Diário
       de Obra consumirem (ainda não consomem — ver Fase 3b/3c do projeto).
       As demais categorias (ART, andaime, talha, empilhadeira, ajudantes)
       continuam só como total da cotação inteira — não têm dado de origem
       por unidade, então não são rateadas aqui (ratear sem base real seria
       inventar um número, não "a mais pura verdade"). */
    const moLookup = (precificacao && precificacao.mo_lookup) || [];
    const modelosPz = (precificacao && precificacao.modelos) || [];
    /* Uma linha por UNIDADE do Formulário (visão antiga) → cada uma pode ter
       `quantidade` > 1 = vários equipamentos físicos. A Precificação já
       expande isso em mo_lookup (1 linha por equipamento físico, com o
       identificador real VPEL-EL0955-1/-2). Antes esta lista tinha 1 ativo
       por Unidade, então uma Unidade de quantidade 2 aparecia como 1 ativo só
       (e 1 só custo de MO) no Contrato Instalador/painel financeiro. */
    const porUnidade = base.map((u) => {
      const uid = u.id || u.unidade_id;
      const tec = envio.find((e) => e.unidade_id === uid) || {};
      const indice = u.indice_ativo ?? tec.indice_ativo ?? null;
      const linhasMo = moLookup.filter((m) => m.unidadeId === uid)
        .sort((x, y) => (Number(x.equipamentoIndice) || 0) - (Number(y.equipamentoIndice) || 0));
      const mod = modelosPz.find((m) => m.unidadeId === uid) || {};
      return {
        uid, indice, linhasMo,
        codigo: (cotacao && cefStore) ? cefStore.assetMasterId(cotacao, indice) : null,
        identificador: u.identificador || tec.identificador || '',
        // mesmo critério de montarEspecificacoes: o modelo da Precificação vence
        modelo: mod.modelo || u.modelo || tec.modelo || '',
      };
    }).filter((x) => x.indice != null);

    const expandiu = porUnidade.some((x) => x.linhasMo.length > 1);
    if (!expandiu) {
      // caso comum (1 equipamento por Unidade) — formato de sempre
      return porUnidade.map((x) => ({
        indice: x.indice, codigo: x.codigo, identificador: x.identificador, modelo: x.modelo,
        custoInstalacaoMaoDeObraRs: Number((x.linhasMo[0] || {}).valorRs) || null,
      }));
    }
    // Há Unidade com vários equipamentos: 1 ativo por equipamento físico e
    // `indice` sequencial único (1..N) — os consumidores (Contrato Instalador,
    // dashboard financeiro) identificam o ativo por esse índice.
    const out = [];
    porUnidade.forEach((x) => {
      if (x.linhasMo.length > 1) {
        x.linhasMo.forEach((l) => out.push({
          indice: out.length + 1, codigo: l.identificador || x.codigo, identificador: l.identificador || x.identificador,
          modelo: x.modelo, unidadeId: x.uid, equipamentoIndice: l.equipamentoIndice ?? null,
          custoInstalacaoMaoDeObraRs: Number(l.valorRs) || null,
        }));
      } else {
        out.push({
          indice: out.length + 1, codigo: x.codigo, identificador: x.identificador, modelo: x.modelo,
          unidadeId: x.uid, equipamentoIndice: 1,
          custoInstalacaoMaoDeObraRs: Number((x.linhasMo[0] || {}).valorRs) || null,
        });
      }
    });
    return out;
  }

  /* ---------- Prefill no formato do PropostaEditor ---------- */
  function montarPrefill(fontes) {
    if (!fontes || !fontes.encontrado) return null;
    const { formulario, cliente, cotacao, precificacao, numeroCotacao } = fontes;
    // V2 (custo econômico completo) é o motor oficial desde 29/08 — usa o
    // preço dele; cai pro V1 só em precificação antiga que nunca rodou o
    // V2 (nunca recalculada desde a migração).
    const resultado = (precificacao && precificacao.resultado_v2 && precificacao.resultado_v2.precificacao)
      || (precificacao && precificacao.resultado && precificacao.resultado.precificacao) || null;
    const difal = (precificacao && precificacao.difal) || null;
    const especificacoes = montarEspecificacoes(fontes);

    const qtdTotal = especificacoes.reduce((s, e) => s + (Number(e.qtd) || 0), 0) || 1;
    const equipamentos = [...new Set(especificacoes.map((e) => e.modelo).filter(Boolean))].join(', ');

    const prefill = {
      __prefillFromPrecificacao: true,
      numeroCotacao,
      masterId: cotacao ? cotacao.numero_documento : null,
      precificacaoId: precificacao ? precificacao.id : null,
      ativos: montarAtivos(fontes),
      cliente: {
        nome: cliente.razao_social || '',
        cnpj: cliente.cnpj || '',
        responsavel: cliente.contato || '',
        endereco: cliente.endereco_logradouro || '',
        numero: '',
        bairro: cliente.endereco_bairro || '',
        cidade: cliente.endereco_cidade || '',
        uf: cliente.endereco_estado || '',
        cep: cliente.endereco_cep || '',
        email: cliente.email || '',
        telefone: cliente.telefone || '',
      },
      obra: {
        nome: formulario.local_obra_cidade || '',
        endereco: formulario.endereco_obra_logradouro || formulario.endereco_logradouro || '',
        numero: '',
        bairro: formulario.endereco_obra_bairro || formulario.endereco_bairro || '',
        cidade: formulario.local_obra_cidade || '',
        uf: formulario.local_obra_estado || '',
        cep: formulario.endereco_obra_cep || formulario.endereco_cep || '',
      },
    };

    /* Só mexe no bloco do equipamento se houver algo real pra colocar —
       proposta em branco continua em branco. */
    const valores = {};
    if (equipamentos) valores.equipamento = equipamentos;
    if (qtdTotal) valores.quantidade = String(qtdTotal);
    if (resultado && resultado.precoVendaPorEquipamento) {
      valores.valorUnit = String(Math.round(resultado.precoVendaPorEquipamento));
    }
    if (difal && difal.difal_aplicavel && difal.responsavel_recolhimento === 'emitente_verticalparts') {
      valores.difal = String(Math.round(difal.valor_difal));
    }
    /* Mais de 1 equipamento na cotação: monta uma linha por unidade (não só
       o agregado acima) pra Preview mostrar cada equipamento separado, em
       vez de uma linha só somando tudo (bug real na cotação 950 — 2
       elevadores viravam 1 linha "GEF, GEP" com quantidade errada).
       Cada item usa seu valor real (e.valorUnitarioRs, rateado por modelo
       em precificacao-elevador-engine.js) — só cai pra precoVendaPorEquipamento
       (a média) quando o rateio não está disponível (cotação antiga, ou
       modelos[] incompleto). */
    if (especificacoes.length > 1 && resultado
      && (resultado.precoVendaPorEquipamento || especificacoes.some((e) => e.valorUnitarioRs))) {
      const mediaFallback = Math.round(resultado.precoVendaPorEquipamento) || 0;
      valores.itens = especificacoes.map((e, i) => {
        const unit = Math.round(e.valorUnitarioRs) || mediaFallback;
        return {
          id: e.id || e.codigoAtivo || `Equipamento ${i + 1}`,
          /* Só o Nº do equipamento (VPEL-EL0950-1) — combinado é esse, sem
             anexar o código interno de modelo do fabricante junto. */
          equipamento: e.id || equipamentos || 'Elevador de Passageiros',
          quantidade: String(Number(e.qtd) || 1),
          valorUnit: String(unit),
          /* valorOriginal: congelado no nascimento — nunca sobrescrito por um
             desconto (proposta-desconto.js só mexe em valorUnit/desconto*). */
          valorOriginal: String(unit),
          desconto: null, descontoPendente: null, descontoLog: [],
        };
      });
    }
    /* "VALORES DE PAGAMENTOS" (Forma de Pagamento + Parcelas) — assim que
       precificado, a Proposta já nasce com o template padrão (Sinal 40% +
       4 parcelas iguais, mesmo texto que já era usado como sugestão fixa
       em proposta-editor.jsx) em vez do vendedor precisar montar na mão.
       deepMergeHeranca() (proposta-editor.jsx) garante que isso só entra
       se o vendedor ainda não tiver mexido nesses campos — nunca sobrescreve
       parcelas já digitadas/ajustadas. */
    if (Object.keys(valores).length) {
      const totalItens = Array.isArray(valores.itens)
        ? valores.itens.reduce((s, it) => s + (Number(it.valorUnit) || 0) * (Number(it.quantidade) || 1), 0)
        : (Number(valores.quantidade) || 0) * (Number(valores.valorUnit) || 0);
      const totalComDifal = totalItens + (Number(valores.difal) || 0);
      if (totalComDifal > 0) {
        const QTD_PADRAO = 5;
        const sinal = totalComDifal * 0.4;
        const restCount = QTD_PADRAO - 1;
        const cadaParcela = (totalComDifal - sinal) / restCount;
        const fmt2 = (x) => x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        valores.formaTipo = 'parcelado';
        valores.qtdParcelas = QTD_PADRAO;
        valores.forma = `40% à vista e ${restCount} parcelas`;
        valores.parcelas = [
          { desc: 'Sinal de 40% na assinatura do contrato', valor: fmt2(sinal) },
          ...Array.from({ length: restCount }, (_, i) => ({ desc: `${i + 1}ª Parcela`, valor: fmt2(cadaParcela) })),
        ];
      }
    }

    /* Duas modalidades de entrega (Financeiro, 01/10/2026): com 1 equipamento a
       Precificação calcula também o preço de 90 dias (container exclusivo) —
       vai na Proposta como alternativa (opcao90) ao de 120 dias (o "oficial"
       acima). O cliente escolhe na assinatura (ver proposta-opcoes.js). Com
       2+ equipamentos não existe resultado_v2_expresso, então nada muda. */
    const expresso = precificacao && precificacao.resultado_v2_expresso && precificacao.resultado_v2_expresso.precificacao;
    if (expresso && especificacoes.length === 1 && window.PropostaOpcoes) {
      const difalOpc = (difal && difal.difal_aplicavel && difal.responsavel_recolhimento === 'emitente_verticalparts') ? difal.valor_difal : 0;
      const fmt2 = (x) => x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const opcao90 = window.PropostaOpcoes.montarOpcao90({
        precoVendaPorEquipamento: expresso.precoVendaPorEquipamento, difal: difalOpc, qtdParcelas: 5,
        parcelasFn: (qtd, total) => {
          const rest = Math.max(qtd - 1, 0);
          const sinal = total * 0.4;
          const cada = rest > 0 ? (total - sinal) / rest : 0;
          return [{ desc: 'Sinal de 40% na assinatura do contrato', valor: fmt2(sinal) },
            ...Array.from({ length: rest }, (_, i) => ({ desc: `${i + 1}ª Parcela`, valor: fmt2(cada) }))];
        },
      });
      if (opcao90) valores.opcao90 = opcao90;
    }

    if (especificacoes.length || Object.keys(valores).length) {
      prefill.elevador = {};
      if (especificacoes.length) prefill.elevador.especificacoes = especificacoes;
      if (Object.keys(valores).length) prefill.elevador.valores = valores;
    }
    return prefill;
  }

  /* Atalho usado pelo editor: número → prefill (ou null se não achar). */
  async function prefillPorNumeroCotacao(numeroCotacao) {
    const fontes = await buscarFontes(numeroCotacao);
    if (!fontes.encontrado) return { encontrado: false, numeroCotacao: fontes.numeroCotacao };
    return { encontrado: true, prefill: montarPrefill(fontes), fontes };
  }

  /* Resumo pro usuário saber o que veio de onde. */
  function resumoFontes(fontes) {
    if (!fontes || !fontes.encontrado) return '';
    const partes = ['Formulário do cliente'];
    if (fontes.cotacao) partes.push(`Cotação ${fontes.cotacao.numero_documento}`);
    if (fontes.precificacao) partes.push('Precificação do Financeiro');
    return partes.join(' · ');
  }

  window.PropostaHeranca = { buscarFontes, montarPrefill, prefillPorNumeroCotacao, resumoFontes, montarAtivos, montarEspecificacoes };
}());
