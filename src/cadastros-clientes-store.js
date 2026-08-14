/* ============================================================
   cadastros-clientes-store.js
   Cadastros · Clientes — CRUD sobre a tabela `clientes` já existente
   (criada nos bastidores pelo Formulário de Elevador quando alguém
   preenche CNPJ/razão social — ver formulario-elevador-store.js). Esta
   tela dá a essa tabela uma interface própria de consulta/edição/criação
   manual, além do código humano (VPCLI-0001...).

   window.CadastrosClientesStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Próximo código sequencial — conta os que já existem, não depende de
     nenhum outro motor (mesma técnica usada em rfq-store.js/gerarNumero). */
  async function gerarCodigo() {
    const c = sb(); if (!c) return 'VPCLI-0001';
    const { count } = await c.from('clientes').select('id', { count: 'exact', head: true });
    return 'VPCLI-' + String((count || 0) + 1).padStart(4, '0');
  }

  async function listarTodos() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('clientes').select('*').order('criado_em', { ascending: false });
    if (error) { console.warn('[CadastrosClientesStore] listarTodos falhou', error); return []; }
    return data || [];
  }

  async function obter(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('clientes').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  function formatarEndereco(p) {
    const partes = [p.logradouro, p.complemento, p.bairro, p.cidade && p.estado ? `${p.cidade}/${p.estado}` : (p.cidade || p.estado), p.cep].filter(Boolean);
    return partes.join(', ') || null;
  }

  function _payload(form) {
    const doc = (form.cnpj || form.cpf || '').replace(/\D/g, '');
    const endereco = {
      logradouro: form.endereco_logradouro, complemento: form.endereco_complemento, bairro: form.endereco_bairro,
      cep: form.endereco_cep, cidade: form.endereco_cidade, estado: form.endereco_estado,
    };
    return {
      razao_social: form.razao_social || null, nome_fantasia: form.nome_fantasia || null,
      tipo_pessoa: form.tipo_pessoa || 'PJ',
      cnpj: form.tipo_pessoa === 'PF' ? null : (doc || null),
      cpf: form.tipo_pessoa === 'PF' ? (doc || null) : null,
      inscricao_estadual: form.inscricao_estadual || null,
      contribuinte_icms: typeof form.contribuinte_icms === 'boolean' ? form.contribuinte_icms : null,
      email: form.email || null, telefone: form.telefone || null, contato: form.contato || null,
      endereco_logradouro: form.endereco_logradouro || null, endereco_complemento: form.endereco_complemento || null,
      endereco_bairro: form.endereco_bairro || null, endereco_cep: form.endereco_cep || null,
      endereco_cidade: form.endereco_cidade || null, endereco_estado: form.endereco_estado || null,
      endereco: formatarEndereco(endereco), cidade: form.endereco_cidade || null, estado: form.endereco_estado || null,
      ativo: form.ativo !== false,
    };
  }

  async function criar(form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!form.razao_social || !form.razao_social.trim()) throw new Error('Informe a razão social / nome.');
    const codigo = await gerarCodigo();
    /* criado_por na tabela clientes é uuid (auth.users) — não dá pra gravar
       o e-mail ali (formulario-elevador-store.js também não grava). */
    const row = { ..._payload(form), codigo };
    const { data, error } = await c.from('clientes').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function atualizar(id, form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const row = { ..._payload(form), atualizado_em: new Date().toISOString() };
    const { data, error } = await c.from('clientes').update(row).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function remover(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('clientes').delete().eq('id', id);
    if (error) throw error;
  }

  window.CadastrosClientesStore = { gerarCodigo, listarTodos, obter, criar, atualizar, remover };
}());
