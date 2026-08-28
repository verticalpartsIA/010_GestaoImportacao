/* ============================================================
   cadastro-custos-store.js
   Cadastros · Atualização de Custos — 3 tabelas de referência que
   alimentam a Precificação por herança (ver README no topo da migração
   supabase/migrations/20260828100000_cadastro_custos.sql):
     - Instalação de Equipamentos: Elevadores (tração×capacidade×paradas)
       e Escada/Esteira Rolante (valor fixo por estado).
     - Containers (specs ISO + comercial por cotação).
   window.CadastroCustosStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }
  function quemAtualizou() { return (window.__VP_USER || {}).email || null; }

  /* ---------- Instalação — Elevadores ---------- */
  async function listarCustosElevador() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('custos_instalacao_elevador').select('*')
      .order('tracao').order('capacidade_min_kg').order('paradas');
    if (error) { console.warn('[CadastroCustosStore] listarCustosElevador falhou', error); return []; }
    return data || [];
  }

  async function salvarCustoElevador(row) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const payload = { ...row, atualizado_em: new Date().toISOString(), atualizado_por: quemAtualizou() };
    if (!payload.id) delete payload.id;
    const { data, error } = await c.from('custos_instalacao_elevador').upsert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function removerCustoElevador(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('custos_instalacao_elevador').delete().eq('id', id);
    if (error) throw error;
  }

  /* Busca o custo de instalação pra uma unidade real (herança na
     Precificação): tração exata + paradas exata + capacidade dentro da
     faixa [min,max]. Se não achar, devolve null — quem chamou decide
     deixar em branco pro Financeiro preencher manualmente. */
  async function buscarCustoElevador(tracao, capacidadeKg, paradas) {
    const c = sb(); if (!c || !tracao || !paradas) return null;
    const { data, error } = await c.from('custos_instalacao_elevador').select('*')
      .eq('ativo', true).eq('tracao', tracao).eq('paradas', paradas)
      .lte('capacidade_min_kg', capacidadeKg).gte('capacidade_max_kg', capacidadeKg)
      .maybeSingle();
    if (error) { console.warn('[CadastroCustosStore] buscarCustoElevador falhou', error); return null; }
    return data || null;
  }

  /* ---------- Instalação — Escada/Esteira Rolante ---------- */
  async function listarCustosEscadaEsteira() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('custos_instalacao_escada_esteira').select('*').order('tipo');
    if (error) { console.warn('[CadastroCustosStore] listarCustosEscadaEsteira falhou', error); return []; }
    return data || [];
  }

  async function salvarCustoEscadaEsteira(row) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const payload = { ...row, atualizado_em: new Date().toISOString(), atualizado_por: quemAtualizou() };
    const { data, error } = await c.from('custos_instalacao_escada_esteira').upsert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function buscarCustoEscadaEsteira(tipo, estado) {
    const c = sb(); if (!c || !tipo) return null;
    const { data, error } = await c.from('custos_instalacao_escada_esteira').select('*')
      .eq('ativo', true).eq('tipo', tipo).maybeSingle();
    if (error || !data) return null;
    const valor = estado === 'SP' ? data.valor_sao_paulo_rs : data.valor_outros_estados_rs;
    return (valor == null) ? null : { ...data, valor_aplicavel_rs: valor };
  }

  /* ---------- Containers ---------- */
  async function listarContainers() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('custos_containers').select('*').order('tipo');
    if (error) { console.warn('[CadastroCustosStore] listarContainers falhou', error); return []; }
    return data || [];
  }

  async function salvarContainer(row) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const payload = { ...row, atualizado_em: new Date().toISOString(), atualizado_por: quemAtualizou() };
    if (!payload.id) delete payload.id;
    const { data, error } = await c.from('custos_containers').upsert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function removerContainer(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('custos_containers').delete().eq('id', id);
    if (error) throw error;
  }

  window.CadastroCustosStore = {
    listarCustosElevador, salvarCustoElevador, removerCustoElevador, buscarCustoElevador,
    listarCustosEscadaEsteira, salvarCustoEscadaEsteira, buscarCustoEscadaEsteira,
    listarContainers, salvarContainer, removerContainer,
  };
}());
