/* ============================================================
   importacao-varejo-store.js
   Importação Varejo — estoque ao vivo + Curva ABC-D + Sugestão de
   Compra de produtos importados vendidos avulsos. Ver
   src/importacao-varejo.jsx e as Edge Functions
   list-importacao-varejo / sync-importacao-varejo /
   criar-requisicao-compra-importacao-varejo.
   window.ImportacaoVarejoStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }
  function usuario() { return window.__VP_USER || {}; }

  async function carregar() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.functions.invoke('list-importacao-varejo', { body: {} });
    if (error) throw new Error((window.extrairErroFuncao && window.extrairErroFuncao(error)) || error.message || 'Falha ao consultar Importação Varejo.');
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  async function salvarLoteConfig({ codigo, multiploCompra, loteMinimo }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const u = usuario();
    const row = {
      codigo,
      multiplo_compra: multiploCompra != null && multiploCompra !== '' ? Number(multiploCompra) : null,
      lote_minimo: loteMinimo != null && loteMinimo !== '' ? Number(loteMinimo) : null,
      atualizado_por: u.email || null,
      atualizado_por_nome: u.name || u.email || null,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await c.from('importacao_varejo_lote_config').upsert(row, { onConflict: 'codigo' });
    if (error) throw error;
  }

  async function lancarComprado({ codigo, quantidade, previsaoChegada }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!(Number(quantidade) > 0)) throw new Error('Informe uma quantidade válida.');
    if (!previsaoChegada) throw new Error('Informe a previsão de chegada.');
    const u = usuario();
    const row = {
      codigo, quantidade: Number(quantidade), previsao_chegada: previsaoChegada,
      criado_por: u.email || null, criado_por_nome: u.name || u.email || null,
    };
    const { data, error } = await c.from('importacao_varejo_comprado').insert(row).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Importação Varejo', acao: 'Lançou "Comprado"', alvo: codigo, alvo_id: data.id,
      detalhe: { quantidade: row.quantidade, previsao_chegada: row.previsao_chegada },
    });
    return data;
  }

  async function excluirComprado(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('importacao_varejo_comprado').delete().eq('id', id);
    if (error) throw error;
  }

  async function enviarRequisicaoOmie(itens) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.functions.invoke('criar-requisicao-compra-importacao-varejo', { body: { itens } });
    if (error) throw new Error((window.extrairErroFuncao && window.extrairErroFuncao(error)) || error.message || 'Falha ao criar requisição no Omie.');
    if (data && data.error) throw new Error(data.error);
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Importação Varejo', acao: 'Enviou Requisição de Compra ao Omie',
      alvo: 'REQ ' + data.codReqCompra, detalhe: { quantidadeItens: data.quantidadeItens },
    });
    return data;
  }

  async function dispararSyncManual() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.functions.invoke('sync-importacao-varejo', { body: {} });
    if (error) throw new Error((window.extrairErroFuncao && window.extrairErroFuncao(error)) || error.message || 'Falha ao disparar sincronização.');
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  window.ImportacaoVarejoStore = {
    carregar, salvarLoteConfig, lancarComprado, excluirComprado, enviarRequisicaoOmie, dispararSyncManual,
  };
}());
