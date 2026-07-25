/* ============================================================
   cotacao-elevador-fornecedor-store.js
   Envio do RFQ técnico de Unidades do Formulário de Elevadores para o
   fornecedor real (começando pela Glarie — "Elevator Inquiry Form" e
   "Homelift Inquiry Form"). Mesmo padrão de pedido-fornecedor-store.js:
   token público, link por WhatsApp/E-mail/Link, resposta do fornecedor
   grava direto no banco (sem PDF, sem digitação manual).
   window.CotacaoElevadorFornecedorStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function shortToken() { return uuid().split('-').join('').slice(0, 16); }

  function cotacaoUrl(token) {
    return `${window.location.origin}/cotacao-elevador-fornecedor/${encodeURIComponent(token)}`;
  }

  /* ---------- IP (auditoria leve, mesmo padrão do resto do app) ---------- */
  let _ipCache;
  async function getPublicIP() {
    if (_ipCache !== undefined) return _ipCache;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      const j = await r.json();
      _ipCache = j.ip || null;
    } catch (e) { _ipCache = null; }
    return _ipCache;
  }

  /* ---------- Categorias de produto — hoje só "elevador" (Glarie) tem
     formulário técnico implementado; as demais existem no modelo de dados
     pra quando entrarem os próximos fornecedores (mesmo sistema, sem criar
     um domínio novo tipo o Pedido a Fornecedor de peças). ---------- */
  const CATEGORIAS_PRODUTO = [
    { value: 'elevador', label: 'Elevador' },
    { value: 'escada_rolante', label: 'Escada Rolante' },
    { value: 'esteira_rolante', label: 'Esteira Rolante' },
    { value: 'quadro_comando', label: 'Quadro de Comando' },
    { value: 'porta', label: 'Porta' },
    { value: 'cabine', label: 'Cabine' },
  ];

  /* ---------- Rótulos (nomenclatura do fornecedor) — usados na tela pública
     e no resumo interno, a partir dos MESMOS valores já salvos na Unidade. ---------- */
  const CEF_LIFT_MODEL = {
    'Passageiro': 'Passenger Lift', 'Carga': 'Freight Lift',
    'Hospitalar': 'Hospital (Bed) Lift', 'Panorâmico': 'Sightseeing/Panoramic Lift',
  };
  function liftModelLabel(tipo) { return CEF_LIFT_MODEL[tipo] || tipo || ''; }

  function machineRoomLabel(casaMaquinas) {
    if (casaMaquinas === 'com') return 'Machine Room';
    if (casaMaquinas === 'sem') return 'Machine Room Less';
    return '';
  }

  const CEF_CONTROLE = { simplex: 'Simplex', duplex: 'Duplex', triplex: 'Triplex', group: 'Group Control' };
  function controleLabel(agrupamento) { return CEF_CONTROLE[agrupamento] || agrupamento || ''; }

  /* Tipo da Unidade → qual dos 2 formulários da Glarie enviar. */
  function tipoFormularioPara(tipo) { return tipo === 'Home Lift' ? 'homelift' : 'elevator'; }

  /* ---------- Numeração VPEL ---------- */
  async function gerarNumero() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.rpc('gerar_numero_cotacao_elevador_fornecedor');
    if (error) throw error;
    return data;
  }

  /* ---------- Snapshot do que é enviado (congela os dados no momento do
     envio — edições posteriores na Unidade não alteram o que já foi mandado) ---------- */
  function buildDadosEnvio(unidades, numeroCotacao) {
    const primeira = unidades[0] || {};
    return {
      header: {
        numero_cotacao: numeroCotacao ?? null,
        pais: 'Brazil',
        data: new Date().toISOString().slice(0, 10),
        tensao_principal: primeira.tensao_principal || '',
        tensao_iluminacao: primeira.tensao_iluminacao || '',
        norma_projeto: primeira.norma_projeto || '',
      },
      unidades: unidades.map((u) => ({
        unidade_id: u.id, identificador: u.identificador, tipo: u.tipo, modelo: u.modelo,
        quantidade: u.quantidade || 1,
        capacidade_kg: u.capacidade_kg, capacidade_pessoas: u.capacidade_pessoas,
        velocidade_ms: u.velocidade_ms, paradas: u.paradas, pavimentos_desc: u.pavimentos_desc,
        casa_maquinas: u.casa_maquinas, agrupamento: u.agrupamento, porta_oposta: u.porta_oposta,
        estrutura_caixa: u.estrutura_caixa, caixa_largura_mm: u.caixa_largura_mm, caixa_profundidade_mm: u.caixa_profundidade_mm,
        percurso_mm: u.percurso_mm, overhead_mm: u.overhead_mm, poco_mm: u.poco_mm,
        cabina_largura_mm: u.cabina_largura_mm, cabina_profundidade_mm: u.cabina_profundidade_mm, cabina_altura_mm: u.cabina_altura_mm,
        teto_falso: u.teto_falso, piso_cabina: u.piso_cabina, corrimao: u.corrimao,
        porta_tipo_abertura: u.porta_tipo_abertura, porta_modelo: u.porta_modelo,
        porta_largura_mm: u.porta_largura_mm, porta_altura_mm: u.porta_altura_mm,
        acabamento_porta_cabina: u.acabamento_porta_cabina, acabamento_porta_pavimento: u.acabamento_porta_pavimento,
        classe_corta_fogo: u.classe_corta_fogo,
        botoeira_cabine: u.botoeira_cabine, botoeira_pavimento: u.botoeira_pavimento,
        ard: u.ard, camera: u.camera, anuncio_voz: u.anuncio_voz, exigencias_especiais: u.exigencias_especiais,
      })),
    };
  }

  /* ---------- Gerar cotação (rascunho) ----------
     unidades: linhas de formularios_elevador_unidades já salvas (com id), todas
     do MESMO fornecedor e do mesmo tipo_formulario (elevator OU homelift).
     numeroCotacao: o Nº da Cotação do cliente (formularios_elevador.numero_cotacao,
     a mesma numeração que já vem sendo continuada desde a planilha histórica) —
     é o número que identifica o projeto pro fornecedor, equivalente ao "Project
     Name" que a Glarie usa nas próprias cotações. */
  async function gerar(formularioElevadorId, unidades, fornecedor, numeroCotacao, categoriaProduto) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const numero_documento = await gerarNumero();
    const tipo_formulario = tipoFormularioPara(unidades[0].tipo);
    const row = {
      numero_documento,
      token: shortToken(),
      formulario_elevador_id: formularioElevadorId,
      fornecedor,
      categoria_produto: categoriaProduto || 'elevador',
      tipo_formulario,
      unidade_ids: unidades.map((u) => u.id),
      dados_envio: buildDadosEnvio(unidades, numeroCotacao),
      status: 'rascunho',
    };
    const { data, error } = await c.from('cotacoes_elevador_fornecedor').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function marcarEnviado(id, channel, recipient) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const now = new Date().toISOString();
    const { error } = await c.from('cotacoes_elevador_fornecedor').update({
      status: 'enviado', channel: channel || null, recipient: recipient || null,
      sent_at: now, updated_at: now,
    }).eq('id', id);
    if (error) throw error;
  }

  async function listarPorFormulario(formularioElevadorId) {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('cotacoes_elevador_fornecedor')
      .select('*').eq('formulario_elevador_id', formularioElevadorId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /* ---------- Tela "Cotações a Fornecedor" (todas categorias, todos fornecedores) ---------- */
  async function listarTodas() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('cotacoes_elevador_fornecedor')
      .select('*, formularios_elevador(numero_cotacao, local_obra_cidade, local_obra_estado, clientes(razao_social))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getById(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('cotacoes_elevador_fornecedor').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  /* ---------- Decisão interna pós-resposta do fornecedor: time decide seguir
     com a compra (em_analise) e depois confirma a compra (aprovada). ---------- */
  async function decidirComprar(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const cur = await getById(id);
    if (!cur) throw new Error('Cotação não encontrada.');
    if (cur.status !== 'respondido') return cur;
    const now = new Date().toISOString();
    const patch = { status: 'em_analise', decidido_em: now, updated_at: now };
    const { error } = await c.from('cotacoes_elevador_fornecedor').update(patch).eq('id', id);
    if (error) throw error;
    return { ...cur, ...patch };
  }

  async function aprovar(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const cur = await getById(id);
    if (!cur) throw new Error('Cotação não encontrada.');
    if (cur.status !== 'em_analise') return cur;
    const now = new Date().toISOString();
    const patch = { status: 'aprovada', aprovado_em: now, updated_at: now };
    const { error } = await c.from('cotacoes_elevador_fornecedor').update(patch).eq('id', id);
    if (error) throw error;
    return { ...cur, ...patch };
  }

  /* ---------- Rótulos/cores de status — usados tanto no modal de envio
     (dentro do Formulário de Elevadores) quanto na tela de Cotações a
     Fornecedor, pra não duplicar a mesma tabela em dois arquivos. ---------- */
  const STATUS_LABEL = {
    rascunho: 'Rascunho', enviado: 'Enviado', visualizado: 'Visualizado',
    respondido: 'Respondido', em_analise: 'Em análise', aprovada: 'Aprovada', expirado: 'Expirado',
  };
  const STATUS_COR = {
    rascunho: '#64748b', enviado: '#2563eb', visualizado: '#b45309',
    respondido: '#059669', em_analise: '#7c3aed', aprovada: '#15803d', expirado: '#9f1239',
  };

  /* ---------- Portal público (/cotacao-elevador-fornecedor/:token) ---------- */
  async function getByToken(token) {
    const c = sb(); if (!c || !token) return null;
    const { data } = await c.from('cotacoes_elevador_fornecedor').select('*').eq('token', token).maybeSingle();
    return data || null;
  }

  async function marcarVisualizado(token) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    if (cur.status !== 'enviado') return cur;
    const now = new Date().toISOString();
    const patch = { status: 'visualizado', viewed_at: now, updated_at: now };
    await c.from('cotacoes_elevador_fornecedor').update(patch).eq('token', token);
    return { ...cur, ...patch };
  }

  /* respostas = { moeda, incoterm_porto, condicoes_pagamento, prazo_fabricacao,
     garantia, validade_dias, embalagem, container_no, documentos_embarque,
     observacoes_gerais, itens:[{unidade_id, modelo_fornecedor, floors_stops_doors,
     preco_unitario, preco_total, confirmacao_tecnica}] } */
  async function salvarResposta(token, respostas) {
    const c = sb();
    const cur = await getByToken(token);
    if (!cur) return null;
    const ip = await getPublicIP();
    const now = new Date().toISOString();
    const payload = { ...respostas, _meta: { ip, ua: navigator.userAgent, respondido_em: now } };
    const patch = { status: 'respondido', respostas: payload, responded_at: now, updated_at: now };
    await c.from('cotacoes_elevador_fornecedor').update(patch).eq('token', token);
    if (window.VPLog) window.VPLog.registrar({
      ator_nome: cur.fornecedor || 'Fornecedor', ator_setor: 'fornecedor',
      modulo: 'Formulário de Elevadores', acao: 'respondeu a cotação de fornecedor',
      alvo: cur.numero_documento, alvo_id: cur.id, detalhe: { ip },
    });
    return { ...cur, ...patch };
  }

  window.CotacaoElevadorFornecedorStore = {
    cotacaoUrl, tipoFormularioPara, liftModelLabel, machineRoomLabel, controleLabel,
    CATEGORIAS_PRODUTO, STATUS_LABEL, STATUS_COR,
    gerar, marcarEnviado, listarPorFormulario, listarTodas, getById,
    getByToken, marcarVisualizado, salvarResposta, getPublicIP,
    decidirComprar, aprovar,
  };
}());
