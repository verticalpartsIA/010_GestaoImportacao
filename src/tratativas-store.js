/* ============================================================
   tratativas-store.js
   Histórico de conversa/negociação de uma Cotação a Fornecedor —
   substitui o vaivém de e-mail: um thread único por cotação,
   correlacionado pelo Nº da Cotação, com anexo (bucket `tratativas`).
   Tabela: tratativas_cotacao. window.TratativasStore.
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Mesmo critério de identidade do VPLog: SSO real > rótulo do setor. */
  function autorAtual() {
    let r = 'admin';
    try { r = JSON.parse(localStorage.getItem('vpprd.role')) || 'admin'; } catch (e) {}
    let u = window.__VP_USER;
    if (!u) { try { u = JSON.parse(sessionStorage.getItem('vpprd_user')); } catch (e) {} }
    const nomes = { comercial: 'Comercial', engenharia: 'Engenharia', financeiro: 'Financeiro', importacao: 'Importação', admin: 'Admin' };
    return (u && u.nome) || nomes[r] || r;
  }

  async function listarPorCotacao(cotacaoFornecedorId) {
    const c = sb(); if (!c || !cotacaoFornecedorId) return [];
    const { data, error } = await c.from('tratativas_cotacao')
      .select('*').eq('cotacao_fornecedor_id', cotacaoFornecedorId).order('created_at', { ascending: true });
    if (error) { console.warn('[Tratativas] listarPorCotacao falhou', error); return []; }
    return data || [];
  }

  async function enviar({ cotacaoFornecedorId, numeroCotacao, mensagem, anexos, autor } = {}) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    if (!cotacaoFornecedorId) throw new Error('Cotação a fornecedor não informada.');
    if (!mensagem?.trim() && !(anexos || []).length) throw new Error('Escreva uma mensagem ou anexe um arquivo.');
    const { data, error } = await c.from('tratativas_cotacao').insert({
      cotacao_fornecedor_id: cotacaoFornecedorId,
      numero_cotacao: numeroCotacao ?? null,
      autor: autor || autorAtual(),
      mensagem: mensagem?.trim() || null,
      anexos: anexos || [],
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function uploadAnexo(cotacaoFornecedorId, file) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    const path = `${cotacaoFornecedorId}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
    const { error } = await c.storage.from('tratativas').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = c.storage.from('tratativas').getPublicUrl(path);
    return { nome: file.name, url: data.publicUrl, tipo: file.type, tamanho: file.size, path };
  }

  window.TratativasStore = { listarPorCotacao, enviar, uploadAnexo };
}());
