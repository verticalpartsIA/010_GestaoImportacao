/* ============================================================
   decisoes-store.js
   Central de Decisões — decisão gerencial genérica (Fase 1).

   Não cria um papel novo pra cada tipo de decisão: uma linha em
   `decisoes_gerenciais` descreve "isto precisa ser decidido por alguém",
   com dependência opcional em outra decisão (ex.: aprovação do CEO só
   libera depois da aprovação do Gestor Comercial).

   Identidade continua vindo do vpsistema (Supabase ubdkoqxfwcraftesgmbw) —
   RLS de lá bloqueia leitura direta do client-side deste app pra qualquer
   colaborador (só admin/self), então usamos um espelho somente-leitura
   (`colaboradores_vpsistema`), ressincronizado manualmente via MCP — o
   organograma muda pouco, não precisa ser em tempo real.

   window.DecisoesStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }
  function meuEmail() { return ((window.__VP_USER || {}).email || '').trim().toLowerCase(); }

  /* Papéis fixos hoje (Fase 1) — evolui pra leitura 100% do espelho quando
     fizer sentido, mas os 5 primeiros são autoridades únicas e conhecidas;
     só o Gestor Comercial tem mais de um titular possível. */
  const EMAILS_FIXOS = {
    ceo: ['diego@verticalparts.com.br'],
    owner: ['gelson.simoes@verticalparts.com.br'],
    gestor_comercial: ['regiane.rocha@verticalparts.com.br', 'guilherme@verticalparts.com.br'],
    rh: ['karla.silva@verticalparts.com.br'],
    engenharia_lider: ['arilene.avila@verticalparts.com.br'],
    logistica_lider: ['danilo@verticalparts.com.br'],
  };

  async function resolverAprovadores(papel) {
    if (EMAILS_FIXOS[papel]) return EMAILS_FIXOS[papel];
    return [];
  }

  function souAprovador(decisao) {
    const email = meuEmail();
    if (!email) return false;
    return (decisao.aprovadores_esperados || []).some((e) => (e || '').toLowerCase() === email);
  }

  /* ---------- Criação ---------- */
  async function criarDecisao({ tipo, papelRequerido, numeroCotacao, dossierId, referenciaTabela, referenciaId, dependeDe, contexto }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const aprovadores = await resolverAprovadores(papelRequerido);
    const status = (dependeDe && dependeDe.length) ? 'bloqueada_por_dependencia' : 'pendente';
    const row = {
      tipo, papel_requerido: papelRequerido,
      numero_cotacao: numeroCotacao ?? null, dossier_id: dossierId ?? null,
      referencia_tabela: referenciaTabela ?? null, referencia_id: referenciaId ?? null,
      depende_de: dependeDe || [], status,
      aprovadores_esperados: aprovadores,
      aprovador_esperado_email: aprovadores[0] || null,
      contexto: contexto || {},
    };
    const { data, error } = await c.from('decisoes_gerenciais').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  /* Idempotente por (tipo, numero_cotacao) — chamada de novo não duplica. */
  async function criarDecisaoSeNaoExiste(args) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: existente } = await c.from('decisoes_gerenciais').select('id')
      .eq('tipo', args.tipo).eq('numero_cotacao', args.numeroCotacao ?? null).maybeSingle();
    if (existente) return existente;
    return criarDecisao(args);
  }

  /* ---------- Consulta ---------- */
  async function listarPendentesParaMim() {
    const c = sb(); if (!c) return [];
    const email = meuEmail();
    if (!email) return [];
    const { data, error } = await c.from('decisoes_gerenciais')
      .select('*').in('status', ['pendente']).order('criado_em', { ascending: false });
    if (error) { console.warn('[DecisoesStore] listarPendentesParaMim falhou', error); return []; }
    return (data || []).filter(souAprovador);
  }

  async function listarPorCotacao(numeroCotacao) {
    const c = sb(); if (!c || numeroCotacao == null) return [];
    const { data } = await c.from('decisoes_gerenciais').select('*').eq('numero_cotacao', numeroCotacao).order('criado_em');
    return data || [];
  }

  /* ---------- Decisão ---------- */
  async function desbloquearDependentes(c, decisaoId) {
    const { data: dependentes } = await c.from('decisoes_gerenciais')
      .select('id, depende_de').eq('status', 'bloqueada_por_dependencia').contains('depende_de', [decisaoId]);
    for (const dep of dependentes || []) {
      const { data: pais } = await c.from('decisoes_gerenciais').select('id, status').in('id', dep.depende_de);
      const todasAprovadas = (pais || []).every((p) => p.status === 'aprovada');
      if (todasAprovadas) {
        await c.from('decisoes_gerenciais').update({ status: 'pendente', atualizado_em: new Date().toISOString() }).eq('id', dep.id);
      }
    }
  }

  async function aprovar(id, motivo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: decisao, error: e1 } = await c.from('decisoes_gerenciais').select('*').eq('id', id).single();
    if (e1) throw e1;
    if (decisao.status !== 'pendente') throw new Error('Esta decisão não está pendente.');
    if (!souAprovador(decisao)) throw new Error('Você não é um dos aprovadores esperados desta decisão.');
    const now = new Date().toISOString();
    const { error } = await c.from('decisoes_gerenciais').update({
      status: 'aprovada', decidido_por: meuEmail(), decidido_em: now, motivo: motivo || null, atualizado_em: now,
    }).eq('id', id);
    if (error) throw error;
    await desbloquearDependentes(c, id);
  }

  async function reprovar(id, motivo) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: decisao, error: e1 } = await c.from('decisoes_gerenciais').select('*').eq('id', id).single();
    if (e1) throw e1;
    if (decisao.status !== 'pendente') throw new Error('Esta decisão não está pendente.');
    if (!souAprovador(decisao)) throw new Error('Você não é um dos aprovadores esperados desta decisão.');
    if (!motivo || !motivo.trim()) throw new Error('Informe o motivo da reprovação.');
    const now = new Date().toISOString();
    const { error } = await c.from('decisoes_gerenciais').update({
      status: 'reprovada', decidido_por: meuEmail(), decidido_em: now, motivo: motivo.trim(), atualizado_em: now,
    }).eq('id', id);
    if (error) throw error;
  }

  /* ---------- Gates ---------- */
  /* Envio de proposta exige Gestor Comercial (Regiane OU Guilherme) + CEO,
     nesta ordem — o registro do CEO nasce bloqueado até o do Gestor ser
     aprovado. Cria as decisões sob demanda (idempotente) se ainda não
     existirem pra essa cotação. */
  async function podeEnviarProposta(numeroCotacao) {
    if (numeroCotacao == null) return { ok: true };
    const c = sb(); if (!c) return { ok: true };
    let decisoes = await listarPorCotacao(numeroCotacao);
    let gestor = decisoes.find((d) => d.tipo === 'envio_proposta_gestor');
    let ceo = decisoes.find((d) => d.tipo === 'envio_proposta_ceo');
    if (!gestor) {
      gestor = await criarDecisaoSeNaoExiste({ tipo: 'envio_proposta_gestor', papelRequerido: 'gestor_comercial', numeroCotacao });
    }
    if (!ceo) {
      ceo = await criarDecisaoSeNaoExiste({ tipo: 'envio_proposta_ceo', papelRequerido: 'ceo', numeroCotacao, dependeDe: [gestor.id] });
    }
    if (gestor.status === 'reprovada') return { ok: false, motivo: `Envio reprovado pelo Gestor Comercial (${gestor.decidido_por || ''}): ${gestor.motivo || 'sem motivo informado'}.` };
    if (gestor.status !== 'aprovada') return { ok: false, motivo: 'Aguardando aprovação do Gestor Comercial (Regiane ou Guilherme) para enviar a proposta.' };
    if (ceo.status === 'reprovada') return { ok: false, motivo: `Envio reprovado pelo CEO (${ceo.decidido_por || ''}): ${ceo.motivo || 'sem motivo informado'}.` };
    if (ceo.status !== 'aprovada') return { ok: false, motivo: 'Aguardando aprovação do CEO (Diego) para enviar a proposta.' };
    return { ok: true };
  }

  window.DecisoesStore = {
    resolverAprovadores, souAprovador,
    criarDecisao, criarDecisaoSeNaoExiste,
    listarPendentesParaMim, listarPorCotacao,
    aprovar, reprovar,
    podeEnviarProposta,
  };
}());
