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

  /* 31/08 — bug real: salvarCustoElevador (acima) usa upsert, que sempre
     tenta um INSERT primeiro — mesmo em edição de linha já existente,
     Postgres valida as colunas NOT NULL do INSERT (tracao, capacidade_*,
     paradas, valor_reajustado_rs) ANTES de sequer chegar no ON CONFLICT DO
     UPDATE. Um payload parcial (só {id, paradas} por exemplo) falha com
     "null value in column tracao violates not-null constraint" — mesmo a
     linha já existindo com tracao preenchida. Pra editar 1-2 campos de uma
     linha que já existe (o caso de toda edição célula-a-célula da tabela),
     usar UPDATE de verdade — nunca precisa das outras colunas. */
  async function atualizarCampoElevador(id, patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const payload = { ...patch, atualizado_em: new Date().toISOString(), atualizado_por: quemAtualizou() };
    const { data, error } = await c.from('custos_instalacao_elevador').update(payload).eq('id', id).select().single();
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

  /* ---------- Estimativa de valor (regressão) pra faixas sem cotação real ----------
     29/08 — pedido explícito do usuário: "quero uma estimativa aproximada,
     claramente marcada" — NUNCA usar isso como preço confirmado. Os valores
     reais desta tabela vêm de cotação de instalador (não têm fórmula —
     testado: não seguem R$/homem-dia constante, saltam de faixa em faixa).
     Por isso a "estimativa" é uma extrapolação estatística honesta (mínimos
     quadrados sobre as linhas REAIS já cotadas da mesma tração), nunca um
     cálculo determinístico — e o chamador é responsável por marcar
     is_estimativa=true e nunca deixar entrar como "confirmado" sem revisão
     humana (ver classificarMaoDeObraUnidade em precificacao-elevador-store.js). */

  /* Resolve X'X·β = X'y por eliminação de Gauss-Jordan (matriz pequena,
     no máx. 4x4 — sem lib externa, só o suficiente pro caso de uso). Se o
     sistema for singular (ex.: coluna sem variação nenhuma), devolve null
     — quem chamou já retirou a coluna problemática antes de chegar aqui. */
  function _resolverSistemaLinear(A, b) {
    const n = A.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let pivo = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivo][col])) pivo = r;
      if (Math.abs(M[pivo][col]) < 1e-9) return null;
      [M[col], M[pivo]] = [M[pivo], M[col]];
      const div = M[col][col];
      for (let c = col; c <= n; c++) M[col][c] /= div;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const fator = M[r][col];
        for (let c = col; c <= n; c++) M[r][c] -= fator * M[col][c];
      }
    }
    return M.map((row) => row[n]);
  }

  /* Ajusta valor_reajustado_rs ~ intercepto + capacidade_kg +
     (dias_montagem × qtd_montadores), só com as linhas REAIS (valor > 0,
     is_estimativa=false) da mesma tração. "paradas" fica FORA de propósito:
     nos dados reais, paradas e homem-dia (dias×montadores) são quase a
     mesma variável (cada faixa de paradas já tem um dias_montagem quase
     fixo) — incluir os dois juntos numa regressão linear pequena deixa os
     coeficientes instáveis (testado ao vivo: previu R$13.800 pra 2 paradas/
     50 dias, MENOR que a linha real de 2 paradas/30 dias = R$16.500, um
     resultado sem sentido). Homem-dia sozinho já carrega o efeito de
     paradas nos dados reais, então é o preditor mais confiável disponível.
     Descarta sozinha qualquer variável sem variação real (ex.: tração 4:1
     hoje só tem a faixa 0-2000kg — não existe base real pra "efeito da
     capacidade" ali; o retorno avisa isso via usouCapacidade). */
  async function estimarValorElevador(tracao, { capacidadeKg, paradas, diasMontagem, qtdMontadores }) {
    const c = sb(); if (!c) return null;
    const { data, error } = await c.from('custos_instalacao_elevador').select('*')
      .eq('ativo', true).eq('tracao', tracao).eq('is_estimativa', false).gt('valor_reajustado_rs', 0);
    if (error || !data || data.length < 4) return null;

    const pontos = data.map((r) => ({
      capacidade: (Number(r.capacidade_min_kg) + Number(r.capacidade_max_kg)) / 2,
      homemDia: Number(r.dias_montagem || 0) * Number(r.qtd_montadores || 0),
      valor: Number(r.valor_reajustado_rs),
    }));

    const temVariacao = (chave) => new Set(pontos.map((p) => p[chave])).size > 1;
    const usaCapacidade = temVariacao('capacidade');
    const usaHomemDia = temVariacao('homemDia');
    const colunas = ['intercepto', usaCapacidade && 'capacidade', usaHomemDia && 'homemDia'].filter(Boolean);
    if (colunas.length < 2) return null; // dado real de menos pra qualquer estimativa honesta

    const linha = (p) => colunas.map((k) => (k === 'intercepto' ? 1 : p[k]));
    const X = pontos.map(linha);
    const y = pontos.map((p) => p.valor);
    const n = colunas.length;
    const XtX = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => X.reduce((s, row) => s + row[i] * row[j], 0)));
    const Xty = Array.from({ length: n }, (_, i) => X.reduce((s, row, k) => s + row[i] * y[k], 0));
    const beta = _resolverSistemaLinear(XtX, Xty);
    if (!beta) return null;

    const alvo = { intercepto: 1, capacidade: capacidadeKg, homemDia: diasMontagem * qtdMontadores };
    const previsto = colunas.reduce((s, k, i) => s + beta[i] * alvo[k], 0);
    if (!(previsto > 0)) return null;

    return {
      valor: Math.round(previsto / 50) * 50, // arredonda pro múltiplo de 50 (padrão observado nos valores reais)
      baseadoEmLinhas: pontos.length,
      usouCapacidade: usaCapacidade,
    };
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
    listarCustosElevador, salvarCustoElevador, atualizarCampoElevador, removerCustoElevador, buscarCustoElevador, estimarValorElevador,
    listarCustosEscadaEsteira, salvarCustoEscadaEsteira, buscarCustoEscadaEsteira,
    listarContainers, salvarContainer, removerContainer,
  };
}());
