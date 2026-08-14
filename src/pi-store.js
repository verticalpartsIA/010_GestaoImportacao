/* ============================================================
   pi-store.js
   Gestão Importação · Proforma Invoice (P.I.) — Fase 1 da consolidação
   de importação dentro do VP Gestão (docs/governanca-matriz.md).

   Uma P.I. pode ser vinculada a um Embarque (opcional). Itens, pagamentos
   adicionais e dados de produção ficam como jsonb — mesmo formato usado na
   tela pra evitar tabelas satélite desnecessárias numa Fase 1.

   window.PIStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  function calcItemTotal(item) {
    const q = parseFloat(item.quantidade);
    const v = parseFloat(item.valor_unitario);
    if (!q || !v) return 0;
    return q * v;
  }
  function calcTotalGeral(itens) {
    return (itens || []).reduce((s, i) => s + calcItemTotal(i), 0);
  }
  function somaPagamentosAdicionais(pagamentos) {
    return (pagamentos || []).reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
  }
  function fmtMoeda(valor, moeda) {
    return `${moeda || 'USD'} ${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  async function listarTodas() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('pi_importacao').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[PIStore] listarTodas falhou', error); return []; }
    return data || [];
  }

  async function obter(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('pi_importacao').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  function _payload(form) {
    const itens = (form.itens || []).map((i) => {
      const q = parseFloat(i.quantidade) || 0;
      const v = parseFloat(i.valor_unitario) || 0;
      return { ...i, quantidade: q, valor_unitario: v, valor_total: q * v };
    });
    const cleanArr = (arr) => (arr || []).map((s) => (s || '').trim()).filter(Boolean);
    return {
      numero_pi: form.numero_pi, fornecedor: form.fornecedor || null, incoterms: form.incoterms || null,
      data_solicitacao_pagamento: form.data_solicitacao_pagamento || null, numero_requisicao: form.numero_requisicao || null,
      numeros_serie: cleanArr(form.numeros_serie), categorias: cleanArr(form.categorias),
      embarque_id: form.embarque_id || null, data_abertura: form.data_abertura || null, data_prontidao: form.data_prontidao || null,
      status: form.status || 'Em andamento', moeda: form.moeda || 'USD',
      itens, valor_total: calcTotalGeral(itens),
      data_primeiro_pagamento: form.data_primeiro_pagamento || null,
      valor_primeiro_pagamento: form.valor_primeiro_pagamento !== '' && form.valor_primeiro_pagamento != null ? Number(form.valor_primeiro_pagamento) : null,
      cotacao_dolar_primeiro_pagamento: form.cotacao_dolar_primeiro_pagamento !== '' && form.cotacao_dolar_primeiro_pagamento != null ? Number(form.cotacao_dolar_primeiro_pagamento) : null,
      data_segundo_pagamento: form.data_segundo_pagamento || null,
      valor_segundo_pagamento: form.valor_segundo_pagamento !== '' && form.valor_segundo_pagamento != null ? Number(form.valor_segundo_pagamento) : null,
      cotacao_dolar_segundo_pagamento: form.cotacao_dolar_segundo_pagamento !== '' && form.cotacao_dolar_segundo_pagamento != null ? Number(form.cotacao_dolar_segundo_pagamento) : null,
      pagamentos_adicionais: (form.pagamentos_adicionais || []).map((p) => ({
        data: p.data || null, valor: p.valor !== '' && p.valor != null ? Number(p.valor) : null,
        cotacao_dolar: p.cotacao_dolar !== '' && p.cotacao_dolar != null ? Number(p.cotacao_dolar) : null,
      })).filter((p) => p.data || p.valor),
      producao: form.producao || {}, observacoes: form.observacoes || null,
    };
  }

  async function criar(form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!form.numero_pi || !form.numero_pi.trim()) throw new Error('Informe o número da P.I.');
    const row = { ..._payload(form), created_by: (window.__VP_USER || {}).email || null };
    const { data, error } = await c.from('pi_importacao').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function atualizar(id, form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const row = { ..._payload(form), updated_at: new Date().toISOString() };
    const { data, error } = await c.from('pi_importacao').update(row).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function remover(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('pi_importacao').delete().eq('id', id);
    if (error) throw error;
  }

  async function vincularEmbarque(id, embarqueId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('pi_importacao').update({ embarque_id: embarqueId || null, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  /* Anexos da Produção — mesmo bucket já usado por Projeto de Elevadores. */
  async function uploadAnexoProducao(piId, file) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const path = `pi/${piId}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
    const { error } = await c.storage.from('engenharia').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = c.storage.from('engenharia').getPublicUrl(path);
    return { nome: file.name, url: data.publicUrl, tipo: file.type || 'documento', path };
  }
  async function removerAnexoProducao(path) {
    const c = sb(); if (!c || !path) return;
    await c.storage.from('engenharia').remove([path]);
  }

  window.PIStore = {
    listarTodas, obter, criar, atualizar, remover, vincularEmbarque,
    uploadAnexoProducao, removerAnexoProducao,
    calcItemTotal, calcTotalGeral, somaPagamentosAdicionais, fmtMoeda,
  };
}());
