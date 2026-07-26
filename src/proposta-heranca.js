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
    const numero = parseInt(numeroCotacao, 10);
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
       maturidade do pipeline (aprovada > em análise > respondida > última). */
    const lista = cotacoes || [];
    const precificacao = (precificacoes || [])[0] || null;
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
    const cefStore = window.CotacaoElevadorFornecedorStore;

    const base = unidades.length ? unidades : envio.map((u) => ({ ...u, id: u.unidade_id }));

    return base.map((u) => {
      const uid = u.id || u.unidade_id;
      const tec = envio.find((e) => e.unidade_id === uid) || {};
      const mod = modelos.find((m) => m.unidadeId === uid) || {};
      const capKg = u.capacidade_kg || tec.capacidade_kg;
      const capPass = u.capacidade_pessoas || tec.capacidade_pessoas;
      const largura = u.caixa_largura_mm || tec.caixa_largura_mm;
      const prof = u.caixa_profundidade_mm || tec.caixa_profundidade_mm;
      const paradas = u.paradas || tec.paradas;
      return {
        id: u.identificador || tec.identificador || '',
        modelo: mod.modelo || u.modelo || tec.modelo || '',
        empreendimento: '',
        carac: u.tipo || tec.tipo || '',
        denominacao: u.pavimentos_desc || tec.pavimentos_desc || '',
        percurso: String(u.percurso_mm || tec.percurso_mm || ''),
        capacidade: capKg ? `${capPass ? capPass + ' Passageiros x ' : ''}${capKg}Kg` : '',
        dimensoesCaixa: (largura || prof) ? `${largura || '?'} x ${prof || '?'}mm` : '',
        profPoço: String(u.poco_mm || tec.poco_mm || ''),
        vel: String(u.velocidade_ms || tec.velocidade_ms || ''),
        andaresParadasPortas: paradas ? `${paradas} Paradas` : '',
        qtd: Number(u.quantidade || tec.quantidade) || 1,
        codigoAtivo: (cotacao && cefStore) ? cefStore.assetMasterId(cotacao, u.indice_ativo ?? tec.indice_ativo) : null,
      };
    });
  }

  /* Lista granular de ativos — o que Contrato de Venda e Contrato
     Instalador consomem depois (Master ID Fase 2). */
  function montarAtivos(fontes) {
    const { unidades, cotacao } = fontes;
    const envio = (cotacao && cotacao.dados_envio && cotacao.dados_envio.unidades) || [];
    const cefStore = window.CotacaoElevadorFornecedorStore;
    const base = unidades.length ? unidades : envio.map((u) => ({ ...u, id: u.unidade_id }));
    return base.map((u) => {
      const uid = u.id || u.unidade_id;
      const tec = envio.find((e) => e.unidade_id === uid) || {};
      const indice = u.indice_ativo ?? tec.indice_ativo ?? null;
      return {
        indice,
        codigo: (cotacao && cefStore) ? cefStore.assetMasterId(cotacao, indice) : null,
        identificador: u.identificador || tec.identificador || '',
        modelo: u.modelo || tec.modelo || '',
      };
    }).filter((a) => a.indice != null);
  }

  /* ---------- Prefill no formato do PropostaEditor ---------- */
  function montarPrefill(fontes) {
    if (!fontes || !fontes.encontrado) return null;
    const { formulario, cliente, cotacao, precificacao, numeroCotacao } = fontes;
    const resultado = (precificacao && precificacao.resultado) || null;
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

  window.PropostaHeranca = { buscarFontes, montarPrefill, prefillPorNumeroCotacao, resumoFontes };
}());
