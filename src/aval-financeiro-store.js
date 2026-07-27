/* ============================================================
   aval-financeiro-store.js
   Gate do Financeiro no meio do funil comercial:

     Proposta aprovada (cliente assinou)
       -> Financeiro consulta o score do cliente
       -> Financeiro dá o aval (aprova ou reprova a venda)
       -> [só então o Contrato de Venda pode ser enviado — ver createDraft
          em contrato-venda-store.js]
     Contrato assinado (Jurídico)
       -> Financeiro confirma que o sinal foi pago
       -> [só então a Cotação a Fornecedor pode iniciar a compra na China —
          ver decidirComprar em cotacao-elevador-fornecedor-store.js]

   window.AvalFinanceiroStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  async function getById(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('avais_financeiros').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  async function getByPropostaId(propostaId) {
    const c = sb(); if (!c || !propostaId) return null;
    const { data } = await c.from('avais_financeiros').select('*').eq('proposta_id', propostaId).maybeSingle();
    return data || null;
  }

  async function getByNumeroCotacao(numeroCotacao) {
    const c = sb(); if (!c || numeroCotacao == null) return null;
    const { data } = await c.from('avais_financeiros').select('*')
      .eq('numero_cotacao', numeroCotacao).order('criado_em', { ascending: false }).limit(1).maybeSingle();
    return data || null;
  }

  /* Garante que existe um registro pra essa proposta (cria se ainda não
     existir) — chamado tanto ao listar a fila do Financeiro quanto pelos
     gates, pra nunca travar por falta de registro. */
  async function garantirRegistro(proposta) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const existente = await getByPropostaId(proposta.id);
    if (existente) return existente;
    const cliente = (proposta.data_json && proposta.data_json.cliente) || {};
    const { data, error } = await c.from('avais_financeiros').insert({
      numero_cotacao: proposta.numero_cotacao ?? null,
      proposta_id: proposta.id,
      numero_documento: proposta.numero_documento || null,
      cliente_nome: cliente.nome || proposta.titulo || null,
      valor_total: proposta.valor_total ?? null,
      status: 'pendente_consulta',
    }).select().single();
    if (error) throw error;
    return data;
  }

  /* Fila do Financeiro: toda proposta aprovada pelo cliente, com o status
     do aval (cria o registro de aval na hora, se ainda não existir). */
  async function listarFila() {
    const c = sb(); if (!c) return [];
    const { data: propostas, error } = await c.from('propostas')
      .select('id, numero_documento, titulo, valor_total, numero_cotacao, data_json, aprovada_em')
      .eq('status', 'aprovada').order('aprovada_em', { ascending: false });
    if (error) { console.warn('[AvalFinanceiroStore] listarFila falhou', error); return []; }
    const avais = await Promise.all((propostas || []).map((p) => garantirRegistro(p)));
    return (propostas || []).map((p, i) => ({ proposta: p, aval: avais[i] }));
  }

  async function registrarConsulta(propostaOuId, consulta) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const propostaId = typeof propostaOuId === 'object' ? propostaOuId.id : propostaOuId;
    const atual = await getByPropostaId(propostaId);
    if (!atual) throw new Error('Registro de aval não encontrado — recarregue a fila.');
    const now = new Date().toISOString();
    const patch = {
      consulta: {
        fonte: consulta.fonte || null, score: consulta.score || null, nota: consulta.nota || null,
        observacoes: consulta.observacoes || null,
        consultado_em: now, consultado_por: (window.__VP_USER || {}).email || null,
      },
      status: 'pendente_aval',
      atualizado_em: now,
    };
    const { data, error } = await c.from('avais_financeiros').update(patch).eq('id', atual.id).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Aval Financeiro', acao: 'consultou o score do cliente',
      alvo: atual.numero_documento, alvo_id: atual.id,
    });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'FINANCEIRO_CONSULTOU_SCORE', numeroCotacao: data.numero_cotacao,
      alvoLabel: data.cliente_nome || data.numero_documento, alvoId: data.id,
      detalhe: { fonte: consulta.fonte, score: consulta.score },
    });
    return data;
  }

  async function darAval(id, aprovado, observacoes) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const now = new Date().toISOString();
    const patch = {
      status: aprovado ? 'aprovado' : 'reprovado',
      aval: {
        decisao: aprovado ? 'aprovado' : 'reprovado', observacoes: observacoes || null,
        aprovado_por: (window.__VP_USER || {}).email || null, aprovado_em: now,
      },
      atualizado_em: now,
    };
    const { data, error } = await c.from('avais_financeiros').update(patch).eq('id', id).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Aval Financeiro', acao: aprovado ? 'deu aval pra vender' : 'reprovou a venda',
      alvo: data.numero_documento, alvo_id: data.id,
    });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: aprovado ? 'FINANCEIRO_APROVOU_VENDA' : 'FINANCEIRO_REPROVOU_VENDA',
      numeroCotacao: data.numero_cotacao, alvoLabel: data.cliente_nome || data.numero_documento, alvoId: data.id,
    });
    return data;
  }

  async function confirmarSinal(id, { valor, pagoEm } = {}) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const now = new Date().toISOString();
    const patch = {
      sinal_pago: true,
      sinal: {
        valor: valor != null ? Number(valor) : null, pago_em: pagoEm || now.slice(0, 10),
        confirmado_por: (window.__VP_USER || {}).email || null, confirmado_em: now,
      },
      atualizado_em: now,
    };
    const { data, error } = await c.from('avais_financeiros').update(patch).eq('id', id).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Aval Financeiro', acao: 'confirmou o sinal pago', alvo: data.numero_documento, alvo_id: data.id,
    });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'SINAL_PAGO', numeroCotacao: data.numero_cotacao,
      alvoLabel: data.cliente_nome || data.numero_documento, alvoId: data.id, detalhe: { valor },
    });
    return data;
  }

  /* Vincula o Contrato de Venda criado a esse aval — pra "Aval Financeiro"
     saber de qual contrato confirmar o sinal (chamado por createDraft). */
  async function vincularContrato(propostaId, contratoVendaId) {
    const c = sb(); if (!c || !propostaId) return;
    await c.from('avais_financeiros').update({ contrato_venda_id: contratoVendaId, atualizado_em: new Date().toISOString() })
      .eq('proposta_id', propostaId);
  }

  /* ---------- Gates ---------- */
  async function podeEnviarContrato(propostaId) {
    if (!propostaId) return { ok: true }; // wizard 100% manual, sem Master ID — não trava
    const av = await getByPropostaId(propostaId);
    if (!av || av.status !== 'aprovado') {
      return { ok: false, motivo: 'O Financeiro ainda não deu o aval pra essa venda. Consulte o score e aprove em "Aval Financeiro" antes de enviar o contrato.' };
    }
    return { ok: true };
  }

  async function podeIniciarCompra(numeroCotacao) {
    if (numeroCotacao == null) return { ok: true }; // sem correlação — não trava
    const av = await getByNumeroCotacao(numeroCotacao);
    if (!av || !av.sinal_pago) {
      return { ok: false, motivo: 'O sinal do cliente ainda não foi confirmado pelo Financeiro. Confirme em "Aval Financeiro" antes de iniciar a compra no fornecedor.' };
    }
    return { ok: true };
  }

  window.AvalFinanceiroStore = {
    getById, getByPropostaId, getByNumeroCotacao, garantirRegistro, listarFila,
    registrarConsulta, darAval, confirmarSinal, vincularContrato,
    podeEnviarContrato, podeIniciarCompra,
  };
}());
