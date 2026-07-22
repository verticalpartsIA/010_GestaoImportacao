/* ============================================================
   formulario-elevador-store.js
   CRUD do Formulário de Coleta de Dados — Elevadores (Comercial).
   Header (formularios_elevador) + Unidades (formularios_elevador_unidades),
   ver issue #66. Mesmo padrão de token público de pedido-fornecedor-store.js
   (RLS permissiva — segurança real é o token ser imprevisível).
   window.FormularioElevadorStore
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
  function novoId(prefixo) { return `${prefixo}-${Date.now().toString(36).toUpperCase()}`; }

  function publicUrl(token) {
    return `${window.location.origin}/formulario-cliente/${encodeURIComponent(token)}`;
  }

  /* ---------- Cliente (fiscal) ---------- */
  async function buscarOuCriarCliente(dados) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const doc = (dados.cnpj || dados.cpf || '').replace(/\D/g, '');
    if (doc) {
      const campo = dados.tipo_pessoa === 'PF' ? 'cpf' : 'cnpj';
      const { data: existente } = await c.from('clientes').select('*').eq(campo, doc).maybeSingle();
      if (existente) return existente;
    }
    const { data, error } = await c.from('clientes').insert({
      razao_social: dados.razao_social || null,
      cnpj: dados.tipo_pessoa === 'PF' ? null : (doc || null),
      cpf: dados.tipo_pessoa === 'PF' ? (doc || null) : null,
      tipo_pessoa: dados.tipo_pessoa || 'PJ',
      inscricao_estadual: dados.inscricao_estadual || null,
      contribuinte_icms: dados.contribuinte_icms ?? null,
      endereco: dados.endereco || null,
      email: dados.email || null,
      telefone: dados.telefone || null,
      cidade: dados.cidade || null,
      estado: dados.estado || null,
      contato: dados.contato || null,
    }).select().single();
    if (error) throw error;
    return data;
  }

  /* ---------- Header ---------- */
  async function criar(dados) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const id = novoId('FE');
    const token = dados.canal === 'self_service' ? shortToken() : null;
    const { data, error } = await c.from('formularios_elevador').insert({
      id,
      lead_id: dados.lead_id || null,
      dossier_id: dados.dossier_id || null,
      cliente_id: dados.cliente_id || null,
      canal: dados.canal || 'assistido',
      token,
      local_obra_cidade: dados.local_obra_cidade || null,
      local_obra_estado: dados.local_obra_estado || null,
      endereco_obra: dados.endereco_obra || null,
      prazo_desejado: dados.prazo_desejado || null,
      tipo_mao_de_obra: dados.tipo_mao_de_obra || null,
      responsavel_entrega: dados.responsavel_entrega || null,
      origem_venda: dados.origem_venda || null,
      observacoes: dados.observacoes || null,
      created_by: (window.__VP_USER || {}).email || null,
    }).select().single();
    if (error) throw error;
    return data;
  }

  async function salvar(id, patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('formularios_elevador')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  async function obter(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: header, error } = await c.from('formularios_elevador').select('*').eq('id', id).single();
    if (error) throw error;
    const { data: unidades } = await c.from('formularios_elevador_unidades')
      .select('*').eq('formulario_id', id).order('created_at', { ascending: true });
    return { ...header, unidades: unidades || [] };
  }

  async function obterPorToken(token) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: header, error } = await c.from('formularios_elevador').select('*').eq('token', token).maybeSingle();
    if (error) throw error;
    if (!header) return null;
    const { data: unidades } = await c.from('formularios_elevador_unidades')
      .select('*').eq('formulario_id', header.id).order('created_at', { ascending: true });
    return { ...header, unidades: unidades || [] };
  }

  async function gerarLinkPublico(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: atual } = await c.from('formularios_elevador').select('token').eq('id', id).single();
    const token = atual?.token || shortToken();
    if (!atual?.token) {
      await c.from('formularios_elevador').update({ canal: 'self_service', token }).eq('id', id);
    }
    return publicUrl(token);
  }

  async function enviar(id) {
    await salvar(id, { status: 'enviado' });
  }

  /* ---------- Unidades (um elevador por linha) ---------- */
  async function adicionarUnidade(formularioId, unidade) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const id = novoId('FEU');
    const { data, error } = await c.from('formularios_elevador_unidades').insert({
      id, formulario_id: formularioId, ...unidade,
    }).select().single();
    if (error) throw error;
    return data;
  }

  async function atualizarUnidade(unidadeId, patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('formularios_elevador_unidades').update(patch).eq('id', unidadeId);
    if (error) throw error;
  }

  async function removerUnidade(unidadeId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('formularios_elevador_unidades').delete().eq('id', unidadeId);
    if (error) throw error;
  }

  async function listar(filtros = {}) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    let q = c.from('formularios_elevador').select('*, formularios_elevador_unidades(count)').order('created_at', { ascending: false });
    if (filtros.status) q = q.eq('status', filtros.status);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  window.FormularioElevadorStore = {
    buscarOuCriarCliente,
    criar, salvar, obter, obterPorToken, gerarLinkPublico, enviar, listar,
    adicionarUnidade, atualizarUnidade, removerUnidade,
    publicUrl,
  };
})();
