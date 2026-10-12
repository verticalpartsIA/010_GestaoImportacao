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

  /* Linhas de "Comprado" ainda abertas de um produto (com id), lidas direto da tabela: a lista da tela vem da função
     list-importacao-varejo, que não traz o id — sem ele não dá para corrigir a previsão nem excluir um lançamento. */
  async function listarCompradoAberto(codigo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('importacao_varejo_comprado')
      .select('id, quantidade, previsao_chegada, requisicao_omie, origem')
      .eq('codigo', codigo).eq('recebido', false).order('previsao_chegada', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function atualizarPrevisaoComprado(id, previsaoChegada) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!previsaoChegada) throw new Error('Informe a previsão de chegada.');
    const { data, error } = await c.from('importacao_varejo_comprado').update({ previsao_chegada: previsaoChegada }).eq('id', id).select('id, codigo').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Lançamento não encontrado (já foi excluído?).');
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Importação Varejo', acao: 'Corrigiu previsão de "Comprado"', alvo: data.codigo, alvo_id: id,
      detalhe: { previsao_chegada: previsaoChegada },
    });
    return data;
  }

  async function excluirComprado(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('importacao_varejo_comprado').delete().eq('id', id);
    if (error) throw error;
  }

  /* Prazo padrão até a chegada de uma requisição enviada (importação ≈ 90 dias, o mesmo prazo do PCP).
     Editável: o "Comprado" da linha pode ser excluído e relançado com a previsão real. */
  const PRAZO_IMPORTACAO_DIAS = 90;
  function previsaoPadrao(hoje, dias) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + (dias == null ? PRAZO_IMPORTACAO_DIAS : dias));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function enviarRequisicaoOmie(itens) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.functions.invoke('criar-requisicao-compra-importacao-varejo', { body: { itens } });
    if (error) throw new Error((window.extrairErroFuncao && window.extrairErroFuncao(error)) || error.message || 'Falha ao criar requisição no Omie.');
    if (data && data.error) throw new Error(data.error);
    // Registra o que foi pedido em "Comprado": a sugestão passa a abater a requisição até a previsão e o mesmo item
    // não é reenviado. A requisição já existe no Omie — se o registro falhar, NÃO lança (o usuário reenviaria e duplicaria):
    // devolve `avisoRegistro` para a tela avisar.
    const comErro = new Set(((data && data.itensComErro) || []).map((e) => e.codigo));
    const incluidos = (itens || []).filter((i) => !comErro.has(i.codigo) && Number(i.quantidade) > 0);
    if (data && incluidos.length) {
      const u = usuario();
      const previsao = previsaoPadrao(new Date());
      const { error: errReg } = await c.from('importacao_varejo_comprado').insert(incluidos.map((i) => ({
        codigo: i.codigo, quantidade: Number(i.quantidade), previsao_chegada: previsao,
        requisicao_omie: data.codReqCompra || null, origem: 'requisicao',
        criado_por: u.email || null, criado_por_nome: u.name || u.email || null,
      })));
      if (errReg) { console.warn('[ImportacaoVarejo] requisição criada, mas o "Comprado" não foi registrado', errReg); data.avisoRegistro = errReg.message || 'erro desconhecido'; }
    }
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Importação Varejo', acao: 'Enviou Requisição de Compra ao Omie',
      alvo: 'REQ ' + data.codReqCompra, detalhe: { quantidadeItens: data.quantidadeItens, registradoComoComprado: !data.avisoRegistro },
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

  async function dispararSyncEstoqueManual() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.functions.invoke('sync-importacao-varejo-estoque', { body: {} });
    if (error) throw new Error((window.extrairErroFuncao && window.extrairErroFuncao(error)) || error.message || 'Falha ao sincronizar estoque.');
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  window.ImportacaoVarejoStore = {
    carregar, salvarLoteConfig, lancarComprado, listarCompradoAberto, atualizarPrevisaoComprado, excluirComprado, enviarRequisicaoOmie, previsaoPadrao, dispararSyncManual, dispararSyncEstoqueManual,
  };
}());
