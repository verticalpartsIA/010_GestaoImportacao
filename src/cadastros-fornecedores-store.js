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

  /* Deriva do MAIOR código já usado, não de count(*): com contagem, excluir
     um fornecedor fazia o próximo cadastro reusar um código existente e
     estourar o índice único (bug pego em teste ao vivo). */
  async function gerarCodigo() {
    const c = sb(); if (!c) return 'VPFOR-0001';
    const { data } = await c.from('fornecedores').select('codigo');
    const maior = (data || []).reduce((max, r) => {
      const n = parseInt(String(r.codigo || '').replace(/\D/g, ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return 'VPFOR-' + String(maior + 1).padStart(4, '0');
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

  /* ---------- Avaliações — nota + comentário, histórico por fornecedor ---------- */
  async function listarAvaliacoes(fornecedorId) {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('fornecedores_avaliacoes').select('*').eq('fornecedor_id', fornecedorId).order('avaliado_em', { ascending: false });
    if (error) return [];
    return data || [];
  }

  async function avaliar(fornecedorId, { nota, comentario }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!nota || nota < 1 || nota > 5) throw new Error('Nota deve ser de 1 a 5.');
    const user = window.__VP_USER || {};
    const row = { fornecedor_id: fornecedorId, nota, comentario: comentario || null, avaliado_por: user.nome || user.email || null };
    const { data, error } = await c.from('fornecedores_avaliacoes').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function removerAvaliacao(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('fornecedores_avaliacoes').delete().eq('id', id);
    if (error) throw error;
  }

  /* Média + contagem por fornecedor, pra mostrar na lista sem N+1 query. */
  async function mediasAvaliacoes() {
    const c = sb(); if (!c) return {};
    const { data, error } = await c.from('fornecedores_avaliacoes').select('fornecedor_id, nota');
    if (error) return {};
    const map = {};
    (data || []).forEach((a) => {
      const m = map[a.fornecedor_id] || { soma: 0, qtd: 0 };
      m.soma += a.nota; m.qtd += 1;
      map[a.fornecedor_id] = m;
    });
    Object.keys(map).forEach((k) => { map[k].media = map[k].soma / map[k].qtd; });
    return map;
  }

  window.CadastrosFornecedoresStore = {
    CATEGORIAS, gerarCodigo, listarTodos, listarAtivos, obter, criar, atualizar, remover,
    listarAvaliacoes, avaliar, removerAvaliacao, mediasAvaliacoes,
  };
}());
