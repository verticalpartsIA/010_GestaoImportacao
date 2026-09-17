/* ============================================================
   quadro-comando-store.js
   CRUD do módulo Quadro de Comando + orquestração do cálculo de BOM/lista
   de corte (via QuadroComandoBomEngine) + checklist digital de separação.
   Mesmo padrão de sb()/RLS anon do resto do projeto.
   window.QuadroComandoStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Alçada delegável (mesmo sistema de proposta-store.js) — sem ela, o
     campo origem_fabricacao fica travado em 'interno' pra quem não é
     Administrador. */
  async function podeDecidirOrigemFabricacao() {
    if (!window.PropostaStore || !window.PropostaStore.temCapacidade) return true; // store de alçadas ainda não carregou — não trava sem necessidade
    return window.PropostaStore.temCapacidade('quadro_comando', 'decidir_fabricacao');
  }

  /* ---------- Header ---------- */
  async function criar(dados) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const row = {
      numero_cotacao: dados.numero_cotacao || null,
      formulario_elevador_unidade_id: dados.formulario_elevador_unidade_id || null,
      cliente_id: dados.cliente_id || null,
      tipo_aplicacao: dados.tipo_aplicacao || null,
      novo_ou_modernizacao: dados.novo_ou_modernizacao || null,
      origem_fabricacao: dados.origem_fabricacao || 'interno',
      fabricante_comando: dados.fabricante_comando || null,
      modelo_comando: dados.modelo_comando || null,
      escopo_fornecimento: dados.escopo_fornecimento || {},
      criado_por: (window.__VP_USER || {}).email || null,
    };
    const { data, error } = await c.from('quadros_comando').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  const QC_COLUNAS_VALIDAS = [
    'numero_cotacao', 'formulario_elevador_unidade_id', 'cliente_id', 'tipo_aplicacao',
    'novo_ou_modernizacao', 'origem_fabricacao', 'fabricante_comando', 'modelo_comando',
    'status', 'escopo_fornecimento', 'cotacao_fornecedor_id',
  ];
  async function salvar(id, patchBruto) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const patch = {};
    Object.keys(patchBruto || {}).forEach((k) => { if (QC_COLUNAS_VALIDAS.includes(k)) patch[k] = patchBruto[k]; });
    patch.updated_at = new Date().toISOString();
    const { error } = await c.from('quadros_comando').update(patch).eq('id', id);
    if (error) throw error;
  }

  async function obter(id) {
    const c = sb(); if (!c) return null;
    const [{ data: header }, { data: paradas }, { data: intervalos }, { data: geometria }, { data: maquina }] = await Promise.all([
      c.from('quadros_comando').select('*').eq('id', id).maybeSingle(),
      c.from('quadros_comando_paradas').select('*').eq('quadro_comando_id', id).order('ordem'),
      c.from('quadros_comando_intervalos_piso').select('*').eq('quadro_comando_id', id).order('ordem'),
      c.from('quadros_comando_geometria').select('*').eq('quadro_comando_id', id).maybeSingle(),
      c.from('quadros_comando_maquina').select('*').eq('quadro_comando_id', id).maybeSingle(),
    ]);
    if (!header) return null;
    return { ...header, paradas: paradas || [], intervalos: intervalos || [], geometria: geometria || {}, maquina: maquina || {} };
  }

  async function listarPorNumeroCotacao(numeroCotacao) {
    const c = sb(); if (!c || numeroCotacao == null) return [];
    const { data, error } = await c.from('quadros_comando').select('*').eq('numero_cotacao', numeroCotacao).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /* ---------- Filhas 1:N — substituição total (mais simples e previsível
     que diff campo a campo; volume por quadro é pequeno, poucas dezenas
     de linhas no máximo). ---------- */
  async function salvarParadas(quadroId, paradas) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error: delErr } = await c.from('quadros_comando_paradas').delete().eq('quadro_comando_id', quadroId);
    if (delErr) throw delErr;
    if (!paradas || !paradas.length) return;
    const rows = paradas.map((p, i) => ({ ...p, quadro_comando_id: quadroId, ordem: i }));
    const { error } = await c.from('quadros_comando_paradas').insert(rows);
    if (error) throw error;
  }

  async function salvarIntervalos(quadroId, intervalos) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error: delErr } = await c.from('quadros_comando_intervalos_piso').delete().eq('quadro_comando_id', quadroId);
    if (delErr) throw delErr;
    if (!intervalos || !intervalos.length) return;
    const rows = intervalos.map((it, i) => ({ ...it, quadro_comando_id: quadroId, ordem: i }));
    const { error } = await c.from('quadros_comando_intervalos_piso').insert(rows);
    if (error) throw error;
  }

  /* ---------- Filhas 1:1 (upsert por quadro_comando_id) ---------- */
  async function salvarGeometria(quadroId, geometria) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('quadros_comando_geometria')
      .upsert({ ...geometria, quadro_comando_id: quadroId, updated_at: new Date().toISOString() }, { onConflict: 'quadro_comando_id' });
    if (error) throw error;
  }

  async function salvarMaquina(quadroId, maquina) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('quadros_comando_maquina')
      .upsert({ ...maquina, quadro_comando_id: quadroId, updated_at: new Date().toISOString() }, { onConflict: 'quadro_comando_id' });
    if (error) throw error;
  }

  /* ---------- Catálogo ---------- */
  async function catalogoPorSku() {
    const c = sb(); if (!c) return {};
    const { data, error } = await c.from('materiais_catalogo').select('sku, descricao, categoria, unidade, observacao_divergencia').eq('ativo', true);
    if (error) throw error;
    const mapa = {};
    (data || []).forEach((m) => { mapa[m.sku] = m; });
    return mapa;
  }

  /* ---------- Cálculo: BOM + trechos de corte (Ramo A — fabricar interno) ----------
     Idempotente por regeneração: apaga o cálculo anterior deste quadro e
     grava o novo (o quadro em si e suas respostas de formulário não são
     tocados — só o resultado calculado). */
  async function gerarBomECortes(quadroId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const engine = window.QuadroComandoBomEngine;
    if (!engine) throw new Error('QuadroComandoBomEngine não carregado');

    const quadro = await obter(quadroId);
    if (!quadro) throw new Error('Quadro de comando não encontrado.');

    const varianteKey = engine.chaveVariante(quadro.maquina.potencia_kw, quadro.maquina.tensao_v);
    const catalogo = await catalogoPorSku();

    let bomItens = [];
    let erroVariante = null;
    if (varianteKey) {
      const r = engine.montarBomFixo(varianteKey, catalogo);
      bomItens = r.itens; erroVariante = r.erro;
    } else {
      erroVariante = 'Potência/tensão da máquina não preenchida ou fora das 4 variantes conhecidas (7,5/15 kW × 220/380 V) — BOM fixo não gerado. Preencha Máquina/Freio/Encoder e gere novamente.';
    }

    const trechosFixa = engine.montarTrechosFiacaoFixa(quadro.geometria);
    const trechoManobra = engine.montarTrechoCaboManobra(quadro.geometria, quadro.intervalos);
    const trechos = [...trechosFixa, trechoManobra];

    const { error: delBomErr } = await c.from('quadros_comando_bom_itens').delete().eq('quadro_comando_id', quadroId);
    if (delBomErr) throw delBomErr;
    const { error: delCorteErr } = await c.from('quadros_comando_trechos_corte').delete().eq('quadro_comando_id', quadroId);
    if (delCorteErr) throw delCorteErr;

    if (bomItens.length) {
      const rows = bomItens.map((i) => ({ ...i, quadro_comando_id: quadroId, materiais_catalogo_id: (catalogo[i.sku] || {}).id || null }));
      const { error } = await c.from('quadros_comando_bom_itens').insert(rows);
      if (error) throw error;
    }
    const { error: insCorteErr } = await c.from('quadros_comando_trechos_corte').insert(trechos.map((t) => ({ ...t, quadro_comando_id: quadroId })));
    if (insCorteErr) throw insCorteErr;

    await salvar(quadroId, { status: 'cotado' });
    return { bomItens, trechos, erroVariante };
  }

  async function obterBomECortes(quadroId) {
    const c = sb(); if (!c) return { bomItens: [], trechos: [] };
    const [{ data: bomItens }, { data: trechos }] = await Promise.all([
      c.from('quadros_comando_bom_itens').select('*').eq('quadro_comando_id', quadroId).order('grupo_separacao'),
      c.from('quadros_comando_trechos_corte').select('*').eq('quadro_comando_id', quadroId),
    ]);
    return { bomItens: bomItens || [], trechos: trechos || [] };
  }

  /* ---------- Checklist digital de separação ----------
     Gatilho manual ("quando quisermos"), não automático na aprovação —
     só cria uma versão nova se pedido explicitamente; a versão anterior
     nunca é apagada (auditoria de chão de fábrica). */
  async function gerarChecklistSeparacao(quadroId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const engine = window.QuadroComandoBomEngine;
    if (!engine) throw new Error('QuadroComandoBomEngine não carregado');

    const { bomItens, trechos } = await obterBomECortes(quadroId);
    if (!bomItens.length && !trechos.length) throw new Error('Gere o BOM/lista de corte antes de criar o checklist de separação.');
    const trechoManobra = trechos.find((t) => (t.tipo_cabo || '').startsWith('Cabo de manobra'));
    const trechosFixa = trechos.filter((t) => t !== trechoManobra);
    const linhas = engine.montarChecklist(bomItens, trechosFixa, trechoManobra || {});

    const { data: existentes } = await c.from('quadros_comando_checklist_separacao').select('versao').eq('quadro_comando_id', quadroId);
    const proximaVersao = (existentes && existentes.length) ? Math.max(...existentes.map((e) => e.versao)) + 1 : 1;

    const bomPorDescricao = {}; bomItens.forEach((b) => { bomPorDescricao[b.sku] = b; });
    const rows = linhas.map((l) => ({
      quadro_comando_id: quadroId,
      versao: proximaVersao,
      grupo: l.grupo,
      descricao: l.descricao,
      sku: l.sku,
      quantidade: l.quantidade,
      unidade: l.unidade,
      medida_mm: l.medida_mm,
      ordem: l.ordem,
    }));
    const { error } = await c.from('quadros_comando_checklist_separacao').insert(rows);
    if (error) throw error;
    return { versao: proximaVersao, total: rows.length };
  }

  async function obterChecklist(quadroId, versao) {
    const c = sb(); if (!c) return [];
    let q = c.from('quadros_comando_checklist_separacao').select('*').eq('quadro_comando_id', quadroId).order('ordem');
    if (versao) q = q.eq('versao', versao);
    else {
      const { data: existentes } = await c.from('quadros_comando_checklist_separacao').select('versao').eq('quadro_comando_id', quadroId);
      const maxVersao = (existentes && existentes.length) ? Math.max(...existentes.map((e) => e.versao)) : null;
      if (!maxVersao) return [];
      q = q.eq('versao', maxVersao);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function marcarChecklistItem(itemId, feito) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const patch = feito
      ? { feito: true, separado_por: (window.__VP_USER || {}).email || null, separado_em: new Date().toISOString() }
      : { feito: false, separado_por: null, separado_em: null };
    const { error } = await c.from('quadros_comando_checklist_separacao').update(patch).eq('id', itemId);
    if (error) throw error;
  }

  /* ---------- Ramo B — comprar pronto de fornecedor ----------
     Reusa 100% o mecanismo de CotacaoElevadorFornecedorStore (token,
     envio WhatsApp/E-mail/Link, portal público, Inbox) com a categoria
     'quadro_comando' já prevista naquele modelo de dados. A única
     exigência real (FK NOT NULL de cotacoes_elevador_fornecedor pra
     formularios_elevador) é que o quadro esteja vinculado a uma Unidade
     de um Formulário de Elevador já existente — um quadro avulso (sem
     vínculo) não tem "projeto" pro fornecedor cotar contra. */

  async function buscarUnidadesElevadorPorCotacao(numeroCotacao) {
    const c = sb(); if (!c || numeroCotacao == null) return [];
    const { data: formularios, error: e1 } = await c.from('formularios_elevador')
      .select('id, numero_cotacao').eq('numero_cotacao', numeroCotacao);
    if (e1) throw e1;
    if (!formularios || !formularios.length) return [];
    const formularioIds = formularios.map((f) => f.id);
    const { data: unidades, error: e2 } = await c.from('formularios_elevador_unidades')
      .select('id, formulario_id, identificador, tipo, capacidade_kg, velocidade_ms, paradas, porta_oposta, agrupamento')
      .in('formulario_id', formularioIds).order('identificador');
    if (e2) throw e2;
    return unidades || [];
  }

  async function vincularFormularioElevador(quadroId, unidadeElevadorId) {
    await salvar(quadroId, { formulario_elevador_unidade_id: unidadeElevadorId || null });
  }

  /* Monta o objeto "unidade" sintético que CEF_SPEC_DEFS_QUADRO_COMANDO
     (cotacao-elevador-fornecedor-store.js) vai ler campo a campo — nunca
     um valor inventado: o que não dá pra derivar do que já foi
     preenchido fica de fora (a tabela de especificação só mostra o que
     tem valor). */
  function construirUnidadeSintetica(quadro, unidadeElevador) {
    const engine = window.QuadroComandoBomEngine;
    const geo = quadro.geometria || {};
    const maq = quadro.maquina || {};
    const escopo = quadro.escopo_fornecimento || {};
    const decisaoFornecer = (item) => (escopo[item] || {}).decisao === 'fornecer';
    const { percurso_mm } = engine ? engine.alturaTotalMm(geo, quadro.intervalos) : { percurso_mm: null };
    const ue = unidadeElevador || {};
    return {
      id: quadro.id,
      identificador: `Quadro de Comando${quadro.modelo_comando ? ' — ' + quadro.modelo_comando : ''}`,
      quantidade: 1,
      quantidade_quadros: 1,
      aplicacao: quadro.tipo_aplicacao,
      novo_modernizacao: quadro.novo_ou_modernizacao,
      fabricante_desejado: quadro.fabricante_comando,
      modelo_desejado: quadro.modelo_comando,
      capacidade_kg: ue.capacidade_kg,
      velocidade_ms: ue.velocidade_ms,
      paradas: (quadro.paradas && quadro.paradas.length) || ue.paradas,
      porta_oposta: ue.porta_oposta === 'Sim' || ue.porta_oposta === true,
      controle: ue.agrupamento,
      tensao_rede: maq.tensao_v,
      tipo_maquina: maq.tipo_maquina,
      potencia_kw: maq.potencia_kw,
      corrente_a: maq.corrente_a,
      freio_tensao_acionamento: maq.freio_tensao_acionamento,
      freio_tensao_manutencao: maq.freio_tensao_manutencao,
      ard: escopo.resgate_automatico ? decisaoFornecer('resgate_automatico') : undefined,
      cop_modelo_acabamento: (escopo.cop || {}).detalhe,
      lop_modelo_acabamento: (escopo.lop || {}).detalhe,
      indicador_posicao_tipo: (escopo.lip || {}).detalhe,
      interfone_5_canais: escopo.interfone ? decisaoFornecer('interfone') : undefined,
      botoeira_inspecao_cabina: escopo.inspecao_teto ? decisaoFornecer('inspecao_teto') : undefined,
      caixa_emergencia_poco: escopo.caixa_botao_parada_poco ? decisaoFornecer('caixa_botao_parada_poco') : undefined,
      percurso_mm,
      ultima_altura_mm: geo.ultima_altura_mm,
      poco_mm: geo.poco_mm,
      distancia_quadro_maquina_mm: geo.distancia_quadro_maquina_mm,
      distancia_quadro_limitador_mm: geo.distancia_quadro_limitador_mm,
      distancia_quadro_entrada_caixa_mm: geo.distancia_quadro_entrada_caixa_mm,
      cabo_paralelo: ue.agrupamento ? (ue.agrupamento !== 'simplex') : undefined,
    };
  }

  /* Garante uma cotação a fornecedor (categoria quadro_comando) vinculada
     a este quadro — cria na 1ª chamada, reaproveita nas seguintes (não
     duplica documento a cada clique em "enviar" por outro canal). Exige
     vínculo prévio com uma Unidade do Formulário de Elevador. */
  async function obterOuCriarCotacaoFornecedor(quadroId, fornecedor) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const store = window.CotacaoElevadorFornecedorStore;
    if (!store) throw new Error('CotacaoElevadorFornecedorStore não carregado');

    const quadro = await obter(quadroId);
    if (!quadro) throw new Error('Quadro de comando não encontrado.');

    if (quadro.cotacao_fornecedor_id) {
      const existente = await store.getById(quadro.cotacao_fornecedor_id);
      if (existente) return existente;
    }

    if (!quadro.formulario_elevador_unidade_id) {
      throw new Error('Vincule este quadro a uma Unidade de um Formulário de Elevador (via Nº da Cotação) antes de enviar cotação a fornecedor.');
    }
    const { data: unidadeElevador, error: eUn } = await c.from('formularios_elevador_unidades')
      .select('*').eq('id', quadro.formulario_elevador_unidade_id).maybeSingle();
    if (eUn) throw eUn;
    if (!unidadeElevador) throw new Error('A Unidade do Formulário de Elevador vinculada não foi encontrada — vincule novamente.');

    const unidadeSintetica = construirUnidadeSintetica(quadro, unidadeElevador);
    const cot = await store.gerar(unidadeElevador.formulario_id, [unidadeSintetica], fornecedor, quadro.numero_cotacao, 'quadro_comando');
    await salvar(quadroId, { cotacao_fornecedor_id: cot.id });
    return cot;
  }

  window.QuadroComandoStore = {
    podeDecidirOrigemFabricacao,
    criar, salvar, obter, listarPorNumeroCotacao,
    salvarParadas, salvarIntervalos, salvarGeometria, salvarMaquina,
    catalogoPorSku,
    gerarBomECortes, obterBomECortes,
    gerarChecklistSeparacao, obterChecklist, marcarChecklistItem,
    buscarUnidadesElevadorPorCotacao, vincularFormularioElevador, obterOuCriarCotacaoFornecedor,
  };
}());
