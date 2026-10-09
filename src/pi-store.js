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
  /* Transferência de pagamento entre P.I.s (30/09): um pagamento feito na P.I.
     de origem que, na verdade, quitava (parte de) outra P.I. — ex.: o sinal da
     SCVP260522-2 foi pago junto com a SCVP260522. Os pagamentos originais não
     mudam; só o "% paga" desconta o que saiu ('enviada') e soma o que entrou
     ('recebida'). Saldo líquido = recebidas − enviadas. */
  function saldoTransferencias(transf) {
    return (transf || []).reduce((s, t) => {
      const v = parseFloat(t.valor) || 0;
      return s + (t.direcao === 'enviada' ? -v : v);
    }, 0);
  }
  /* Valor que conta pra quitar ESTA P.I. (pagamentos próprios + transferências). */
  function calcValorQuitado(pi) {
    const pago = (parseFloat(pi.valor_primeiro_pagamento) || 0) + (parseFloat(pi.valor_segundo_pagamento) || 0)
      + somaPagamentosAdicionais(pi.pagamentos_adicionais);
    return pago + saldoTransferencias(pi.transferencias_pagamento);
  }
  function fmtMoeda(valor, moeda) {
    return `${moeda || 'USD'} ${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /* Taxas adicionais (Frete Local, Seguro, Taxa administrativa etc.).
     tipo: '%' calcula sobre o subtotal dos itens; 'BRL'/'USD' é um valor
     fixo nessa moeda. Uma taxa em moeda diferente da moeda da P.I. não é
     somada automaticamente ao total (não há taxa de câmbio confiável aqui —
     mesma cautela já usada em `cotacao_dolar_*` dos pagamentos). */
  function calcTaxaValor(taxa, subtotalItens) {
    const v = parseFloat(taxa.valor) || 0;
    if (taxa.tipo === '%') return (subtotalItens || 0) * (v / 100);
    return v;
  }
  function calcTotalTaxas(taxas, subtotalItens, moedaPI) {
    return (taxas || []).reduce((s, t) => {
      if (t.tipo === '%' || t.tipo === moedaPI) return s + calcTaxaValor(t, subtotalItens);
      return s;
    }, 0);
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
    const moeda = form.moeda || 'USD';
    const taxas = (form.taxas || []).map((t) => ({
      tipo: t.tipo || '%', descricao: (t.descricao || '').trim(),
      valor: t.valor !== '' && t.valor != null ? Number(t.valor) : null,
    })).filter((t) => t.descricao || t.valor);
    const subtotalItens = calcTotalGeral(itens);
    const cleanArr = (arr) => (arr || []).map((s) => (s || '').trim()).filter(Boolean);
    return {
      numero_pi: form.numero_pi, fornecedor: form.fornecedor || null, incoterms: form.incoterms || null,
      data_solicitacao_pagamento: form.data_solicitacao_pagamento || null, numero_requisicao: form.numero_requisicao || null,
      numero_cotacao: form.numero_cotacao !== '' && form.numero_cotacao != null ? Number(form.numero_cotacao) : null,
      numeros_serie: cleanArr(form.numeros_serie), categorias: cleanArr(form.categorias),
      embarque_id: form.embarque_id || null, data_abertura: form.data_abertura || null, data_prontidao: form.data_prontidao || null,
      status: form.status || 'Em andamento', moeda,
      itens, valor_total: subtotalItens + calcTotalTaxas(taxas, subtotalItens, moeda),
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
      transferencias_pagamento: (form.transferencias_pagamento || []).map((t) => ({
        direcao: t.direcao === 'enviada' ? 'enviada' : 'recebida', pi_numero: (t.pi_numero || '').trim(),
        data: t.data || null, valor: t.valor !== '' && t.valor != null ? Number(t.valor) : null, obs: (t.obs || '').trim(),
      })).filter((t) => t.pi_numero || t.valor),
      taxas, producao: form.producao || {}, observacoes: form.observacoes || null,
    };
  }

  async function criar(form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!form.numero_pi || !form.numero_pi.trim()) throw new Error('Informe o número da P.I.');
    const row = { ..._payload(form), created_by: (window.__VP_USER || {}).email || null };
    const { data, error } = await c.from('pi_importacao').insert(row).select().single();
    if (error) throw error;
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'PI_CRIADA', numeroCotacao: data.numero_cotacao, alvoLabel: data.numero_pi, alvoId: data.id,
    });
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
    /* Propaga o Nº Cotação da P.I. pro Embarque (15/08, Linha do Tempo da
       Cotação) — o Embarque não tem como saber sozinho de qual cotação ele
       é, quem sabe é a P.I. Só preenche se o embarque ainda não tiver um
       (não sobrescreve um valor já definido por outra P.I. vinculada). */
    if (embarqueId) {
      const { data: pi } = await c.from('pi_importacao').select('numero_cotacao').eq('id', id).maybeSingle();
      if (pi && pi.numero_cotacao != null) {
        const { data: emb } = await c.from('embarques_importacao').select('numero_cotacao').eq('id', embarqueId).maybeSingle();
        if (emb && emb.numero_cotacao == null) {
          await c.from('embarques_importacao').update({ numero_cotacao: pi.numero_cotacao }).eq('id', embarqueId);
        }
      }
    }
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

  /* Busca o produto pelo código para preencher o item da P.I.
     Fontes (nesta ordem): catálogo de importação do Omie (descrição/unidade/NCM),
     cadastro do PCP e Ficha Técnica (só completa o que faltar). Só leitura. */
  const UNIDADE_PI = { PC: 'un', PÇ: 'un', UN: 'un', UND: 'un', PEÇA: 'un', PECA: 'un', KG: 'kg', G: 'g', TON: 'ton', T: 'ton', M: 'm', MT: 'm', 'M²': 'm²', M2: 'm²', 'M³': 'm³', M3: 'm³', L: 'L', LT: 'L', ML: 'mL', CX: 'cx', CAIXA: 'cx', PCT: 'pct', PAR: 'par', CJ: 'cj', KIT: 'cj', JG: 'cj' };
  const _cacheProduto = new Map();
  async function buscarProdutoPorCodigo(codigo) {
    const cod = String(codigo || '').trim();
    if (cod.length < 3) return null;
    const chave = cod.toUpperCase();
    if (_cacheProduto.has(chave)) return _cacheProduto.get(chave);
    const c = sb(); if (!c) return null;
    const un = (u) => UNIDADE_PI[String(u || '').trim().toUpperCase()] || '';
    let r = { descricao: '', unidade: '', ncm: '' };
    try {
      const q = (t, cols) => c.from(t).select(cols).ilike(t === 'fichas_tecnicas' ? 'codigo_produto' : 'codigo', cod).limit(1);
      const [iv, pcp, ft] = await Promise.all([
        q('importacao_varejo_produtos', 'descricao,unidade,ncm'),
        q('pcp_produtos', 'descricao,unidade,ncm'),
        q('fichas_tecnicas', 'nome_produto,ncm_recomendado').eq('arquivado', false).limit(1),
      ]);
      const a = (iv.data || [])[0] || {}, b = (pcp.data || [])[0] || {}, f = (ft.error ? [] : ft.data || [])[0] || {};
      r = {
        descricao: a.descricao || b.descricao || f.nome_produto || '',
        unidade: un(a.unidade) || un(b.unidade),
        ncm: a.ncm || b.ncm || f.ncm_recomendado || '',
      };
    } catch (e) { console.warn('[PIStore] buscarProdutoPorCodigo', e); return null; }
    const out = (r.descricao || r.ncm) ? r : null;
    if (out) _cacheProduto.set(chave, out);
    return out;
  }

  window.PIStore = {
    buscarProdutoPorCodigo,
    listarTodas, obter, criar, atualizar, remover, vincularEmbarque,
    uploadAnexoProducao, removerAnexoProducao,
    calcItemTotal, calcTotalGeral, somaPagamentosAdicionais, fmtMoeda,
    calcTaxaValor, calcTotalTaxas, saldoTransferencias, calcValorQuitado,
  };
}());
