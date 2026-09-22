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

  async function enviar({ cotacaoFornecedorId, numeroCotacao, mensagem, anexos, autor, emailFornecedor } = {}) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    if (!cotacaoFornecedorId) throw new Error('Cotação a fornecedor não informada.');
    if (!mensagem?.trim() && !(anexos || []).length) throw new Error('Escreva uma mensagem ou anexe um arquivo.');

    // Salvar mensagem no banco
    const { data, error } = await c.from('tratativas_cotacao').insert({
      cotacao_fornecedor_id: cotacaoFornecedorId,
      numero_cotacao: numeroCotacao ?? null,
      autor: autor || autorAtual(),
      mensagem: mensagem?.trim() || null,
      anexos: anexos || [],
    }).select().single();
    if (error) throw new Error(error.message);

    // Buscar e-mail do fornecedor se não foi fornecido
    let email = emailFornecedor;
    if (!email) {
      try {
        const { data: cot } = await c.from('cotacoes_elevador_fornecedor').select('fornecedor').eq('id', cotacaoFornecedorId).maybeSingle();
        if (cot?.fornecedor) {
          const { data: forn } = await c.from('fornecedores').select('email').ilike('razao_social', cot.fornecedor).maybeSingle();
          email = forn?.email;
        }
      } catch (e) {
        console.warn('[Tratativas] erro ao buscar email do fornecedor', e);
      }
    }

    // Enviar e-mail ao fornecedor (async, não bloqueia se falhar)
    if (email && email.trim()) {
      try {
        const { error: emailError } = await c.functions.invoke('send-email', {
          to: email,
          subject: `Nova mensagem na Cotação ${numeroCotacao || ''}`,
          html: `<p>Você recebeu uma nova mensagem sobre a cotação.</p>
                 <p><strong>${autor || autorAtual()}:</strong></p>
                 <p>${mensagem?.trim()?.replace(/\n/g, '<br/>') || '(Sem texto, apenas anexos)'}</p>
                 <p><a href="${window.location.origin || 'https://vpgestaoimportacao.vpsistema.com'}/cotacao-elevador-fornecedor">Ver cotação no portal</a></p>`,
        });
        if (emailError) console.warn('[Tratativas] send-email falhou (não crítico)', emailError);
      } catch (e) {
        console.warn('[Tratativas] erro ao invocar send-email', e);
      }
    }

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
