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
      /* 10/10/2026 — passageiros = Capacidade máx. (kg) ÷ 75 (regra única, capacidade-passageiros.js); Elevador de CARGA
         não leva pessoas: só os kg. Antes valia o número digitado à mão no Formulário (o "4000 Passageiros" da 950). */
      const CP = window.CapacidadePassageiros;
      const capPass = CP ? CP.passageiros(capKg, u.tipo || tec.tipo) : (u.capacidade_pessoas || tec.capacidade_pessoas);
      const largura = u.caixa_largura_mm || tec.caixa_largura_mm;
      const prof = u.caixa_profundidade_mm || tec.caixa_profundidade_mm;
      const paradas = u.paradas || tec.paradas;
      const tipo = u.tipo || tec.tipo || '';
      const cabLargura = u.cabina_largura_mm || tec.cabina_largura_mm;
      const cabProf = u.cabina_profundidade_mm || tec.cabina_profundidade_mm;
      /* REGRA (Financeiro, 10/10/2026): cada equipamento físico é ÚNICO e tem o SEU código (VPEL-EL0963-1 … -27,
         numeração corrida da Precificação — mo_lookup). O identificador da Unidade do Formulário NÃO é código de
         equipamento quando a Unidade tem quantidade > 1. Aqui ficam todos os códigos físicos desta Unidade. */
      const codigos = ((precificacao && precificacao.mo_lookup) || [])
        .filter((l) => l.unidadeId === uid && l.identificador)
        .sort((a, b) => (Number(a.equipamentoIndice) || 0) - (Number(b.equipamentoIndice) || 0))
        .map((l) => l.identificador);
      const idUnidade = u.identificador || tec.identificador || '';
      return {
        id: codigos.length ? codigos.join(', ') : idUnidade,
        codigos: codigos.length ? codigos : (idUnidade ? [idUnidade] : []),
        /* Liga a especificação (e o item de valores) aos ativos físicos VPEL-ELxxxx-k — é o que
           permite listar os N equipamentos de uma Unidade de quantidade N, cada um com seu código. */
        unidadeId: uid || '',
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
    /* 10/10 — na explosão os códigos vêm CORRIDOS (1..N, menor → maior
       paradas) de mo_lookup (ver renumerarPorParadas em
       precificacao-elevador-store.js): a ordem e o código dos ativos
       seguem a Precificação, não a ordem das Unidades do Formulário. */
    const porUid = new Map(porUnidade.map((x) => [x.uid, x]));
    const out = [];
    moLookup.forEach((l) => {
      const x = porUid.get(l.unidadeId);
      if (!x) return; // equipamento avulso (sem Unidade real) fica de fora, como sempre
      out.push({
        indice: out.length + 1, codigo: l.identificador || x.codigo, identificador: l.identificador || x.identificador,
        modelo: x.modelo, unidadeId: x.uid, equipamentoIndice: l.equipamentoIndice ?? null,
        custoInstalacaoMaoDeObraRs: Number(l.valorRs) || null,
      });
    });
    // Unidade sem nenhuma linha em mo_lookup mantém o formato de sempre
    porUnidade.forEach((x) => {
      if (x.linhasMo.length) return;
      out.push({
        indice: out.length + 1, codigo: x.codigo, identificador: x.identificador, modelo: x.modelo,
        unidadeId: x.uid, equipamentoIndice: 1, custoInstalacaoMaoDeObraRs: null,
      });
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
      valores.valorUnit = window.PropostaOpcoes ? window.PropostaOpcoes.textoBR(resultado.precoVendaPorEquipamento) : String(Math.round(resultado.precoVendaPorEquipamento));
    }
    /* DIFAL NÃO vai para a proposta (Financeiro, 13/10/2026): o preço de venda já o contém, a proposta mostra
       só o valor da venda. Ele continua na Precificação como custo da VerticalParts. */
    /* Mais de 1 equipamento na cotação: monta uma linha por unidade (não só
       o agregado acima) pra Preview mostrar cada equipamento separado, em
       vez de uma linha só somando tudo (bug real na cotação 950 — 2
       elevadores viravam 1 linha "GEF, GEP" com quantidade errada).
       Cada item usa seu valor real (e.valorUnitarioRs, rateado por modelo
       em precificacao-elevador-engine.js) — só cai pra precoVendaPorEquipamento
       (a média) quando o rateio não está disponível (cotação antiga, ou
       modelos[] incompleto). */
    if ((qtdTotal > 1 || especificacoes.length > 1) && resultado
      && (resultado.precoVendaPorEquipamento || especificacoes.some((e) => e.valorUnitarioRs))) {
      const O = window.PropostaOpcoes;
      const c2 = O ? O.c2 : (x) => Math.round((Number(x) || 0) * 100) / 100;
      const txt = O ? O.textoBR : (x) => String(Math.round(x));
      const mediaFallback = c2(resultado.precoVendaPorEquipamento) || 0;
      /* UM item por EQUIPAMENTO FÍSICO, com o código dele (VPEL-EL0963-13…): cada equipamento é único e o
         cliente pode pedir mudança num específico. Unidade de quantidade N vira N itens (quantidade 1). */
      valores.itens = [];
      especificacoes.forEach((e, i) => {
        const unit = c2(e.valorUnitarioRs) || mediaFallback;
        const n = Math.max(1, Number(e.qtd) || 1);
        const codigos = (Array.isArray(e.codigos) && e.codigos.length === n) ? e.codigos : null;
        for (let k = 0; k < n; k++) {
          const cod = codigos ? codigos[k] : (n === 1 ? (e.id || e.codigoAtivo || `Equipamento ${i + 1}`) : null);
          valores.itens.push({
            id: cod || e.id || `Equipamento ${i + 1}`,
            unidadeId: e.unidadeId || '',
            equipamento: cod || e.id || equipamentos || 'Elevador de Passageiros',
            quantidade: cod ? '1' : String(n),
            valorUnit: txt(unit),
            /* valorOriginal: congelado no nascimento — nunca sobrescrito por um
               desconto (proposta-desconto.js só mexe em valorUnit/desconto*). */
            valorOriginal: txt(unit),
            desconto: null, descontoPendente: null, descontoLog: [],
          });
          if (!cod) break; // sem código físico conhecido: mantém 1 item agregado (nunca inventa numeração)
        }
      });
      // Lista na ordem dos códigos (…-1, -2, … -27), não na ordem das Unidades.
      const nCod = (it) => { const m = /-(\d+)$/.exec(it.equipamento || ''); return m ? Number(m[1]) : Infinity; };
      valores.itens.sort((a, b) => nCod(a) - nCod(b));
      /* Fecha no centavo: a soma dos equipamentos tem que ser EXATAMENTE o preço da Precificação
         (R$ 8.961.402,72 na 963). O arredondamento por item deixa até alguns centavos de diferença;
         o último equipamento de quantidade 1 absorve. */
      const alvo = Math.round(c2(resultado.precoVendaProposta) * 100);
      if (alvo > 0) {
        const cent = (it) => Math.round(c2(String(it.valorUnit).replace(',', '.')) * 100) * (Number(it.quantidade) || 1);
        const soma = valores.itens.reduce((s, it) => s + cent(it), 0);
        const dif = alvo - soma;
        const alvoItem = [...valores.itens].reverse().find((it) => Number(it.quantidade) === 1);
        if (dif !== 0 && Math.abs(dif) <= 100 * valores.itens.length && alvoItem) {
          const novo = txt((cent(alvoItem) + dif) / 100);
          alvoItem.valorUnit = novo; alvoItem.valorOriginal = novo;
        }
      }
    }
    /* "VALORES DE PAGAMENTOS" (Forma de Pagamento + Parcelas) — assim que
       precificado, a Proposta já nasce com o template padrão (Sinal 40% +
       4 parcelas iguais, mesmo texto que já era usado como sugestão fixa
       em proposta-editor.jsx) em vez do vendedor precisar montar na mão.
       deepMergeHeranca() (proposta-editor.jsx) garante que isso só entra
       se o vendedor ainda não tiver mexido nesses campos — nunca sobrescreve
       parcelas já digitadas/ajustadas. */
    if (Object.keys(valores).length) {
      const pbr = (x) => parseFloat(String(x == null ? '0' : x).replace(/\./g, '').replace(',', '.')) || 0;
      const totalItens = Array.isArray(valores.itens)
        ? valores.itens.reduce((s, it) => s + pbr(it.valorUnit) * (Number(it.quantidade) || 1), 0)
        : (Number(valores.quantidade) || 0) * pbr(valores.valorUnit);
      const totalComDifal = totalItens;
      if (totalComDifal > 0) {
        const QTD_PADRAO = 5;
        const restCount = QTD_PADRAO - 1;
        valores.formaTipo = 'parcelado';
        valores.qtdParcelas = QTD_PADRAO;
        valores.forma = `40% à vista e ${restCount} parcelas`;
        valores.parcelas = window.PropostaOpcoes.parcelasPadrao(QTD_PADRAO, totalComDifal);
      }
    }

    /* Duas modalidades de entrega (Financeiro, 01/10/2026): com 1 equipamento a
       Precificação calcula também o preço de 90 dias (container exclusivo) —
       vai na Proposta como alternativa (opcao90) ao de 120 dias (o "oficial"
       acima). O cliente escolhe na assinatura (ver proposta-opcoes.js). Com
       2+ equipamentos não existe resultado_v2_expresso, então nada muda. */
    const expresso = precificacao && precificacao.resultado_v2_expresso && precificacao.resultado_v2_expresso.precificacao;
    if (expresso && especificacoes.length === 1 && window.PropostaOpcoes) {
      const opcao90 = window.PropostaOpcoes.montarOpcao90({
        precoVendaPorEquipamento: expresso.precoVendaPorEquipamento, qtdParcelas: 5,
        parcelasFn: (qtd, total) => window.PropostaOpcoes.parcelasPadrao(qtd, total),
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

  /* ---------- Escada / Esteira Rolante ----------
     No Formulário, escada/esteira guardam as especificações em
     `formularios_elevador_unidades.especificacoes` (jsonb, texto livre das
     planilhas técnicas); a proposta usa SELECTS com listas fixas (OPTIONS em
     proposta-form.jsx). Por isso cada valor é normalizado para a opção
     equivalente — texto que não casa com nenhuma opção ficaria em branco no
     select. Não há Precificação própria de escada/esteira: sem valores. */
  const ESC_OPTS = {
    escada: {
      empreendimento: ['Comercial', 'Supermercado', 'Shopping', 'Hospital', 'Aeroporto'],
      incl: ['30º', '35º'], largura: ['600mm', '800mm', '1000mm'], bal: ['900mm', '1000mm'],
      vel: ['0.5 m/s', '0.65 m/s', '0.75 m/s'], alim: (v) => `${v}V Trifásico`, arranjo: ['Paralelo', 'Cruzada', 'Simples'],
    },
    esteira: {
      empreendimento: ['Supermercado', 'Shopping', 'Aeroporto'],
      incl: ['0º', '10º', '11º', '12º'], largura: ['800mm', '1000mm'], bal: ['900mm', '1000mm'],
      vel: ['0.5 m/s', '0.65 m/s'], alim: (v) => `Trifásico ${v}V`, arranjo: ['Paralelo', 'Cruzada', 'Simples'],
    },
  };
  const _t = (v) => String(v == null ? '' : v).trim();
  const _num = (v) => { const m = /(\d+(?:[.,]\d+)?)/.exec(_t(v).replace(/\.(?=\d{3}\b)/g, '')); return m ? parseFloat(m[1].replace(',', '.')) : null; };
  const _mm = (v) => { const n = _num(v); if (n == null) return ''; return String(/\bmm\b/i.test(_t(v)) || n >= 100 ? Math.round(n) : Math.round(n * 1000)); };
  const _opt = (v, opts) => { const n = _num(v); if (n == null) return ''; return opts.find((o) => _num(o) === n) || ''; };
  const _txt = (v, opts) => { const t = _t(v).toLowerCase(); return t ? (opts.find((o) => t.includes(o.toLowerCase())) || '') : ''; };

  function montarBlocoEscadaEsteira(fontes, tipo) {
    if (!fontes || !fontes.encontrado || (tipo !== 'escada' && tipo !== 'esteira')) return null;
    const O = ESC_OPTS[tipo];
    const unidades = (fontes.unidades || []).filter((u) => (u.tipo_equipamento || 'elevador') === tipo);
    if (!unidades.length) return null;
    const especificacoes = unidades.map((u, i) => {
      const e = u.especificacoes || {};
      const tensao = _num(e.tensao_alimentacao_equip);
      const alimentacao = tensao === 220 || tensao === 380 ? O.alim(tensao) : '';
      const disp = _t(e.disposicao_espaco).toLowerCase();
      const arranjo = /cruz/.test(disp) ? 'Cruzada' : /paralel/.test(disp) ? 'Paralelo' : /simples/.test(disp) ? 'Simples' : '';
      const uso = _t(e.uso_previsto).toLowerCase();
      const carac = /alto/.test(uso) || _num(e.horario_pico) >= 8000 ? 'Alto Tráfego' : uso ? 'Comercial' : '';
      const base = {
        id: u.identificador || `${tipo === 'escada' ? 'Escada' : 'Esteira'} ${i + 1}`,
        unidadeId: u.id,
        empreendimento: _txt(e.tipo_edificacao, O.empreendimento),
        carac,
        incl: _opt(e.inclinacao, O.incl),
        balaustrada: _opt(e.balaustrada, O.bal),
        vel: _opt(e.velocidade_nominal, O.vel),
        alimentacao, arranjo, maquina: '',
        qtd: Number(u.quantidade) || 1, valorUnit: '',
      };
      return tipo === 'escada'
        ? { ...base, desnivel: _mm(e.desnivel_elevacao), largDegrau: _opt(e.largura_degrau, O.largura) }
        : { ...base, desnivelComp: _mm(e.desnivel_vertical || e.comprimento_total), largPallet: _opt(e.largura_palete, O.largura) };
    });
    const qtd = especificacoes.reduce((s, x) => s + (Number(x.qtd) || 0), 0);
    return {
      especificacoes,
      valores: { equipamento: tipo === 'escada' ? 'Escada Rolante' : 'Esteira Rolante', quantidade: String(qtd) },
    };
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

  window.PropostaHeranca = { buscarFontes, montarPrefill, prefillPorNumeroCotacao, resumoFontes, montarAtivos, montarEspecificacoes, montarBlocoEscadaEsteira };
}());
