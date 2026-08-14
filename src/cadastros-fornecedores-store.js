/* ============================================================
   cadastros-fornecedores-store.js
   Cadastros · Fornecedores — cadastro único (com categorias[]) em vez de
   um cadastro por tipo de prestador (Fornecedor / Agente de Carga /
   Transportador / Prestador IMS). Código humano VPFOR-0001...

   window.CadastrosFornecedoresStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  const CATEGORIAS = ['Fornecedor', 'Agente de Carga', 'Transportador', 'Prestador IMS'];

  async function gerarCodigo() {
    const c = sb(); if (!c) return 'VPFOR-0001';
    const { count } = await c.from('fornecedores').select('id', { count: 'exact', head: true });
    return 'VPFOR-' + String((count || 0) + 1).padStart(4, '0');
  }

  async function listarTodos() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('fornecedores').select('*').order('criado_em', { ascending: false });
    if (error) { console.warn('[CadastrosFornecedoresStore] listarTodos falhou', error); return []; }
    return data || [];
  }

  async function obter(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('fornecedores').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  /* Sugestões pra datalist noutros módulos (P.I./RFQ/Embarques/IMS) — nome
     + categorias, sem obrigar ninguém a migrar campo livre pra FK ainda. */
  async function listarAtivos(categoria) {
    const c = sb(); if (!c) return [];
    let q = c.from('fornecedores').select('id, codigo, razao_social, nome_fantasia, categorias').eq('ativo', true);
    if (categoria) q = q.contains('categorias', [categoria]);
    const { data, error } = await q.order('razao_social');
    if (error) return [];
    return data || [];
  }

  function _payload(form) {
    const doc = (form.cnpj || form.cpf || '').replace(/\D/g, '');
    return {
      razao_social: form.razao_social || null, nome_fantasia: form.nome_fantasia || null,
      tipo_pessoa: form.tipo_pessoa || 'PJ',
      cnpj: form.tipo_pessoa === 'PF' ? null : (doc || null),
      cpf: form.tipo_pessoa === 'PF' ? (doc || null) : null,
      categorias: form.categorias || [],
      email: form.email || null, telefone: form.telefone || null, contato: form.contato || null,
      endereco_logradouro: form.endereco_logradouro || null, endereco_complemento: form.endereco_complemento || null,
      endereco_bairro: form.endereco_bairro || null, endereco_cep: form.endereco_cep || null,
      endereco_cidade: form.endereco_cidade || null, endereco_estado: form.endereco_estado || null,
      observacoes: form.observacoes || null, ativo: form.ativo !== false,
    };
  }

  async function criar(form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!form.razao_social || !form.razao_social.trim()) throw new Error('Informe a razão social / nome.');
    if (!form.categorias || form.categorias.length === 0) throw new Error('Selecione ao menos uma categoria.');
    const codigo = await gerarCodigo();
    const row = { ..._payload(form), codigo, criado_por: (window.__VP_USER || {}).email || null };
    const { data, error } = await c.from('fornecedores').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function atualizar(id, form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const row = { ..._payload(form), atualizado_em: new Date().toISOString() };
    const { data, error } = await c.from('fornecedores').update(row).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function remover(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('fornecedores').delete().eq('id', id);
    if (error) throw error;
  }

  window.CadastrosFornecedoresStore = { CATEGORIAS, gerarCodigo, listarTodos, listarAtivos, obter, criar, atualizar, remover };
}());
