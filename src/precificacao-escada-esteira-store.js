/* Precificação de Escada/Esteira Rolante — acesso a dados (05/11/2026, cotação 1009).
   Tabela própria `precificacoes_escada_esteira` (ver migration 20261105110000). */
(function () {
  'use strict';
  function sb() { return (window.__VP_SB || {}).sb; }
  const C = () => window.PrecificacaoEscEstCalc;
  const quem = () => (window.__VP_USER || {}).email || null;

  async function obter(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('precificacoes_escada_esteira').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  /* Abre (ou cria) a precificação da cotação do fornecedor / do formulário direto. */
  async function criar(formularioId, cotacaoFornecedorId, categoria) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!C().ehEscEst(categoria)) throw new Error('Categoria inválida para precificação de escada/esteira.');

    const qExistente = c.from('precificacoes_escada_esteira').select('*');
    const { data: existente } = cotacaoFornecedorId
      ? await qExistente.eq('cotacao_fornecedor_id', cotacaoFornecedorId).limit(1).maybeSingle()
      : await qExistente.eq('formulario_elevador_id', formularioId).eq('categoria', categoria).is('cotacao_fornecedor_id', null).limit(1).maybeSingle();
    if (existente) return existente;

    const { data: form, error: e1 } = await c.from('formularios_elevador').select('id, numero_cotacao').eq('id', formularioId).single();
    if (e1) throw e1;
    let itens, letra = null;
    if (cotacaoFornecedorId) {
      const { data: cot, error: e2 } = await c.from('cotacoes_elevador_fornecedor').select('*').eq('id', cotacaoFornecedorId).single();
      if (e2) throw e2;
      itens = C().itensDaCotacao(cot);
      letra = cot.revisao || null;
    } else {
      const { data: unidades, error: e3 } = await c.from('formularios_elevador_unidades').select('id, identificador, modelo, quantidade, tipo_equipamento').eq('formulario_id', formularioId).order('indice_ativo');
      if (e3) throw e3;
      itens = C().itensDasUnidades(unidades, C().CATEGORIAS[categoria].tipo);
    }
    let numero = C().numeroDocumento(categoria, form.numero_cotacao, letra);
    if (!numero) throw new Error('O formulário não tem Nº de cotação.');
    for (let t = 0; t < 26; t++) {
      const { data, error } = await c.from('precificacoes_escada_esteira').insert({
        numero_documento: numero, numero_cotacao: form.numero_cotacao, formulario_elevador_id: formularioId,
        cotacao_fornecedor_id: cotacaoFornecedorId || null, categoria, itens, created_by: quem(),
      }).select().single();
      if (!error) return data;
      if (error.code !== '23505') throw error;
      /* colisão: alguém criou a mesma ao mesmo tempo (reaproveita) — senão tenta a próxima letra */
      const { data: ja } = cotacaoFornecedorId
        ? await c.from('precificacoes_escada_esteira').select('*').eq('cotacao_fornecedor_id', cotacaoFornecedorId).limit(1).maybeSingle()
        : { data: null };
      if (ja) return ja;
      letra = window.MasterIdEngine ? window.MasterIdEngine.proximaRevisao(letra) : 'A';
      numero = C().numeroDocumento(categoria, form.numero_cotacao, letra);
    }
    throw new Error('Não foi possível gerar um número de precificação livre.');
  }

  async function salvar(id, { itens, observacao }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('precificacoes_escada_esteira')
      .update({ itens, observacao: observacao || null, updated_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'rascunho').select('id');
    if (error) throw error;
    if (!data || !data.length) throw new Error('Não foi possível salvar (precificação já finalizada ou sem permissão).');
  }

  async function finalizar(id, { itens, observacao }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const falta = C().faltando({ itens });
    if (falta.length) throw new Error('Falta preencher: ' + falta.join(', ') + '.');
    const agora = new Date().toISOString();
    const { data, error } = await c.from('precificacoes_escada_esteira')
      .update({ itens, observacao: observacao || null, status: 'finalizado', aprovado_em: agora, aprovado_por: quem(), updated_at: agora })
      .eq('id', id).eq('status', 'rascunho').select('id, numero_documento');
    if (error) throw error;
    if (!data || !data.length) throw new Error('Não foi possível finalizar (já finalizada ou sem permissão).');
    window.VPLog?.registrar({ modulo: 'Precificação', acao: 'Finalizou a precificação de escada/esteira', alvo: data[0].numero_documento, alvo_id: id, detalhe: { total: C().totais(itens).venda } });
  }

  async function reabrir(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('precificacoes_escada_esteira')
      .update({ status: 'rascunho', aprovado_em: null, aprovado_por: null, updated_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'finalizado').select('id, numero_documento');
    if (error) throw error;
    if (!data || !data.length) throw new Error('Não foi possível reabrir.');
    window.VPLog?.registrar({ modulo: 'Precificação', acao: 'Reabriu a precificação de escada/esteira', alvo: data[0].numero_documento, alvo_id: id });
  }

  /* O id aberto (deep-link) é de escada/esteira? Falha de leitura = não. */
  async function existe(id) {
    const c = sb(); if (!c) return false;
    try {
      const { data } = await c.from('precificacoes_escada_esteira').select('id').eq('id', id).maybeSingle();
      return !!data;
    } catch (e) { return false; }
  }

  window.PrecificacaoEscEstStore = { existe, obter, criar, salvar, finalizar, reabrir };
})();
