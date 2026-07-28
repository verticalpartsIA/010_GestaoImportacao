/* ============================================================
   projeto-elevador-store.js
   "Projeto de Elevadores" (Engenharia) — trata/traduz os desenhos
   técnicos que o fornecedor manda junto da cotação (poço, cabine,
   porta, COP/LOP), correlacionado pelo Nº da Cotação.
   Tabela: projetos_elevador · bucket: engenharia (mesmo já usado por
   engenharia-config.jsx). window.ProjetoElevadorStore
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

  async function listarTodas() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('projetos_elevador').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[ProjetoElevador] listarTodas falhou', error); return []; }
    return data || [];
  }

  async function listarPorCotacao(numeroCotacao) {
    const c = sb(); if (!c || numeroCotacao == null) return [];
    const { data, error } = await c.from('projetos_elevador')
      .select('*').eq('numero_cotacao', numeroCotacao).order('created_at', { ascending: false });
    if (error) { console.warn('[ProjetoElevador] listarPorCotacao falhou', error); return []; }
    return data || [];
  }

  async function salvar({ id, isNew, numeroCotacao, cotacaoFornecedorId, referencia, responsavel, status, unidades, anexos, observacoes }) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    if (!referencia?.trim()) throw new Error('Referência (prédio/empreendimento) é obrigatória.');
    const row = {
      numero_cotacao: numeroCotacao ?? null,
      cotacao_fornecedor_id: cotacaoFornecedorId || null,
      referencia: referencia.trim(),
      responsavel: responsavel || null,
      status: status || 'rascunho',
      unidades: unidades || [],
      anexos: anexos || [],
      observacoes: observacoes || null,
      updated_at: new Date().toISOString(),
    };
    /* `id` vem sempre preenchido (pré-gerado no modal pra correlacionar
       anexos antes do 1º save) — quem decide insert vs. update é `isNew`,
       não a presença de `id` (senão o insert nunca acontece). */
    const q = isNew
      ? c.from('projetos_elevador').insert({ id: id || uuid(), ...row }).select().single()
      : c.from('projetos_elevador').update(row).eq('id', id).select().single();
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  }

  async function finalizar(id) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    const { data, error } = await c.from('projetos_elevador')
      .update({ status: 'finalizado', updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function uploadAnexo(id, file) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    const path = `${id}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
    const { error } = await c.storage.from('engenharia').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = c.storage.from('engenharia').getPublicUrl(path);
    return { nome: file.name, url: data.publicUrl, tipo: file.type, tamanho: file.size, path };
  }

  async function removerAnexo(path) {
    const c = sb(); if (!c || !path) return;
    await c.storage.from('engenharia').remove([path]);
  }

  window.ProjetoElevadorStore = { listarTodas, listarPorCotacao, salvar, finalizar, uploadAnexo, removerAnexo, uuid };
}());
