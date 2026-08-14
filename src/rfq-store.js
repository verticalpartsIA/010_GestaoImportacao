/* ============================================================
   rfq-store.js
   Gestão Importação · RFQ (Request for Quotation) — Fase 2 da
   consolidação de importação dentro do VP Gestão.

   Uma RFQ compara preços de vários fornecedores pra um conjunto de itens.
   Fornecedores e itens ficam como jsonb (snapshot da cotação, não FK pra
   cadastros mestres) — mesmo racional do pi-store.js: evita acoplamento
   com catálogos ainda não unificados numa Fase 1/2.

   window.RFQStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  const SIMBOLO_MOEDA = { BRL: 'R$', USD: 'US$', EUR: '€', CNY: '¥', GBP: '£' };

  function fmtMoeda(v, moeda) {
    const simbolo = SIMBOLO_MOEDA[moeda] || 'R$';
    if (typeof v !== 'number' || isNaN(v)) return '—';
    return `${simbolo} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function novoId() {
    return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* Total pago ao fornecedor vencedor de cada item (respeitando modo
     global x vencedor por item) — usado no card da listagem. */
  function totalVencedor(rfq) {
    const itens = rfq.itens || [];
    const globalId = rfq.fornecedor_vencedor_global_id;
    return itens.reduce((acc, item) => {
      const vencedorId = globalId || item.fornecedor_vencedor_id;
      const preco = (item.precos || []).find((p) => p.fornecedor_id === vencedorId);
      return acc + (preco && typeof preco.valor_total === 'number' ? preco.valor_total : 0);
    }, 0);
  }

  function totalPorFornecedor(itens) {
    const map = {};
    (itens || []).forEach((item) => {
      (item.precos || []).forEach((p) => {
        map[p.fornecedor_id] = (map[p.fornecedor_id] || 0) + (p.valor_total || 0);
      });
    });
    return map;
  }

  async function listarTodas() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('rfq_importacao').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[RFQStore] listarTodas falhou', error); return []; }
    return data || [];
  }

  async function obter(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('rfq_importacao').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  async function gerarNumero() {
    const c = sb(); if (!c) return 'RFQ-' + new Date().getFullYear() + '-0001';
    const { count } = await c.from('rfq_importacao').select('id', { count: 'exact', head: true });
    const n = (count || 0) + 1;
    return `RFQ-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
  }

  function _payload(form) {
    return {
      numero_rfq: form.numero_rfq, data: form.data || null, data_validade: form.data_validade || null,
      status: form.status || 'Aberta',
      fornecedores: form.fornecedores || [], itens: form.itens || [],
      fornecedor_vencedor_global_id: form.fornecedor_vencedor_global_id || null,
      moeda_total_item: form.moeda_total_item || 'BRL',
      observacoes: form.observacoes || null,
    };
  }

  async function criar(form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!form.numero_rfq || !form.numero_rfq.trim()) throw new Error('Informe o número da RFQ.');
    const row = { ..._payload(form), created_by: (window.__VP_USER || {}).email || null };
    const { data, error } = await c.from('rfq_importacao').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function atualizar(id, form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const row = { ..._payload(form), updated_at: new Date().toISOString() };
    const { data, error } = await c.from('rfq_importacao').update(row).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function remover(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('rfq_importacao').delete().eq('id', id);
    if (error) throw error;
  }

  window.RFQStore = {
    listarTodas, obter, criar, atualizar, remover, gerarNumero,
    novoId, fmtMoeda, totalVencedor, totalPorFornecedor,
    SIMBOLO_MOEDA,
  };
}());
