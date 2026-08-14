/* ============================================================
   ims-store.js
   Gestão Importação · IMS (controle de recursos operacionais) —
   Fase 3 da consolidação de importação dentro do VP Gestão.

   Uma solicitação agrupa N recursos (Transporte/Munck/Empilhadeira/
   Andaime/Mão de obra) e N fornecedores cotados — ambos jsonb, mesmo
   racional dos módulos anteriores (P.I., RFQ): snapshot, não FK.

   window.IMSStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  function diasEntre(inicio, fim) {
    if (!inicio || !fim) return null;
    const a = new Date(inicio + 'T00:00:00'), b = new Date(fim + 'T00:00:00');
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 86400000) + 1;
  }

  function estaAtrasado(s) {
    if (!s.data_fim || s.servico_concluido) return false;
    return new Date() > new Date(s.data_fim + 'T23:59:59');
  }

  async function listarTodas() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('ims_importacao').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[IMSStore] listarTodas falhou', error); return []; }
    return data || [];
  }

  async function obter(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('ims_importacao').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  function _payload(form) {
    const fornecedores = (form.fornecedores || []).map((f) => ({ ...f, valor: parseFloat(f.valor) || 0 }));
    const valorTotal = fornecedores.reduce((s, f) => s + (f.valor || 0), 0);
    return {
      numero_solicitacao: form.numero_solicitacao || null, status: form.status || 'Solicitado',
      solicitante: form.solicitante || null, projeto: form.projeto || null, responsavel_interno: form.responsavel_interno || null,
      recursos: form.recursos || [], data_inicio: form.data_inicio || null, data_fim: form.data_fim || null,
      local_execucao: form.local_execucao || null, cidade: form.cidade || null,
      observacoes_operacionais: form.observacoes_operacionais || null,
      fornecedores, valor_total_previsto: valorTotal, numero_pedido_compra: form.numero_pedido_compra || null,
      aprovado: !!form.aprovado, aprovador: form.aprovador || null, data_aprovacao: form.data_aprovacao || null,
      observacao_aprovacao: form.observacao_aprovacao || null,
      checkin_execucao: form.checkin_execucao || null, checkout_execucao: form.checkout_execucao || null,
      servico_concluido: !!form.servico_concluido, avaliacao_servico: form.avaliacao_servico || null,
      observacoes_finais: form.observacoes_finais || null, arquivado: !!form.arquivado,
      historico: form.historico || [],
    };
  }

  function _addHistorico(form, anterior, userLabel) {
    const historico = [...(form.historico || [])];
    const agora = new Date().toISOString();
    if (anterior) {
      const mudancas = [];
      if (form.status !== anterior.status) mudancas.push(`Status: ${form.status}`);
      if (!!form.aprovado !== !!anterior.aprovado) mudancas.push(form.aprovado ? 'Aprovado' : 'Aprovação removida');
      if (!!form.servico_concluido !== !!anterior.servico_concluido) mudancas.push(form.servico_concluido ? 'Serviço concluído' : 'Conclusão revertida');
      if (mudancas.length) historico.push({ data: agora, descricao: `Atualização: ${mudancas.join(', ')}`, usuario: userLabel });
    } else {
      const recursos = (form.recursos || []).map((r) => r.tipo_recurso).join(', ') || 'Recursos diversos';
      historico.push({ data: agora, descricao: `Solicitação criada — ${recursos}`, usuario: userLabel });
    }
    return historico;
  }

  async function criar(form) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!form.solicitante || !form.solicitante.trim()) throw new Error('Informe o solicitante.');
    if (!form.projeto || !form.projeto.trim()) throw new Error('Informe o projeto.');
    const user = window.__VP_USER || {};
    const userLabel = user.nome || user.email || 'Sistema';
    const historico = _addHistorico(form, null, userLabel);
    const row = { ..._payload({ ...form, historico }), created_by: user.email || null };
    const { data, error } = await c.from('ims_importacao').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function atualizar(id, form, anterior) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const user = window.__VP_USER || {};
    const userLabel = user.nome || user.email || 'Sistema';
    const historico = _addHistorico(form, anterior, userLabel);
    const row = { ..._payload({ ...form, historico }), updated_at: new Date().toISOString() };
    const { data, error } = await c.from('ims_importacao').update(row).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function remover(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('ims_importacao').delete().eq('id', id);
    if (error) throw error;
  }

  async function arquivar(id, arquivado) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('ims_importacao').update({ arquivado, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  window.IMSStore = { listarTodas, obter, criar, atualizar, remover, arquivar, diasEntre, estaAtrasado };
}());
