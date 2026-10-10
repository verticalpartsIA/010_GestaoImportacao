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
      .order('tracao').order('capacidade_max_kg').order('paradas');
    if (error) { console.warn('[CadastroCustosStore] listarCustosElevador falhou', error); return []; }
    return data || [];
  }

  async function salvarCustoElevador(row) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const payload = { ...row, atualizado_em: new Date().toISOString(), atualizado_por: quemAtualizou() };
    if (!payload.id) delete payload.id;
    const { data, error } = await c.from('custos_instalacao_elevador').upsert(payload).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Salvou custo de instalação de elevador', alvo_id: data.id,
      detalhe: { tracao: data.tracao, capacidade_max_kg: data.capacidade_max_kg, paradas: data.paradas, valor_reajustado_rs: data.valor_reajustado_rs },
    });
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
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Editou custo de instalação de elevador', alvo_id: id, detalhe: patch,
    });
    return data;
  }

  async function removerCustoElevador(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('custos_instalacao_elevador').delete().eq('id', id);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Excluiu custo de instalação de elevador', alvo_id: id,
    });
  }

  /* Busca o custo de instalação pra uma unidade real (herança na
     Precificação): tração exata + paradas exata + capacidade dentro da
     faixa [min,max]. Se não achar, devolve null — quem chamou decide
     deixar em branco pro Financeiro preencher manualmente.
     26/09 — faixas sobrepostas (achado real: uma linha 2:1 × 2 paradas ×
     0-2000kg com R$ 0,00 cobria as faixas certas de 400-630/631-1000/
     1001-1500): com .maybeSingle() a busca dava erro de "múltiplas linhas",
     voltava null e a unidade virava "projeto especial" com MO R$ 0 sem
     aviso nenhum. Agora, se mais de uma linha casar, vale a mais específica:
     com valor > 0 primeiro, cotação real antes de estimativa, faixa de
     capacidade mais estreita — e avisa no console pra alguém limpar a
     tabela em Cadastros → Atualização de Custos. */
  async function buscarCustoElevador(tracao, capacidadeKg, paradas) {
    const c = sb(); if (!c || !tracao || !paradas) return null;
    const { data, error } = await c.from('custos_instalacao_elevador').select('*')
      .eq('ativo', true).eq('tracao', tracao).eq('paradas', paradas)
      .gte('capacidade_max_kg', capacidadeKg);
    if (error) { console.warn('[CadastroCustosStore] buscarCustoElevador falhou', error); return null; }
    /* 10/10/2026 — a "Capacidade mín." deixou de existir: só a Capacidade máx. (kg) doa dado. A faixa que vale é a
       MENOR capacidade máxima que ainda comporta o elevador (ex.: 500 kg → faixa de 630 kg). Dentro dela, valor > 0
       primeiro e cotação real antes de estimativa. */
    const linhas = data || [];
    if (linhas.length <= 1) return linhas[0] || null;
    const escolhida = [...linhas].sort((a, b) =>
      (Number(a.capacidade_max_kg) - Number(b.capacidade_max_kg))
      || ((Number(b.valor_reajustado_rs) > 0) - (Number(a.valor_reajustado_rs) > 0))
      || ((!!a.is_estimativa) - (!!b.is_estimativa)))[0];
    const empatadas = linhas.filter((l) => Number(l.capacidade_max_kg) === Number(escolhida.capacidade_max_kg));
    if (empatadas.length > 1) console.warn(`[CadastroCustosStore] ${empatadas.length} linhas de MO com a mesma capacidade máx. (${escolhida.capacidade_max_kg}kg) pra tração ${tracao} × ${paradas} paradas — usando id ${escolhida.id}. Revise em Cadastros → Atualização de Custos.`, empatadas);
    return escolhida;
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
      capacidade: Number(r.capacidade_max_kg),
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
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Salvou custo de instalação de escada/esteira', alvo_id: data.id, detalhe: { tipo: data.tipo },
    });
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
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Salvou custo de container', alvo_id: data.id, detalhe: { tipo: data.tipo },
    });
    return data;
  }

  async function removerContainer(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('custos_containers').delete().eq('id', id);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Excluiu custo de container', alvo_id: id,
    });
  }

  /* ---------- Frete interno (Santos → capitais) — 10/10/2026 ----------
     Tabela das 2 transportadoras (carreta L = carga solta, LS = container
     fechado) copiada da aba FRETE da planilha do Financeiro, que não tem
     fórmula nenhuma (é só consulta digitada). A Precificação sugere o frete
     interno a partir daqui: cidade da obra × nº de containers; o usuário
     troca transportadora/modalidade e pode digitar o valor que quiser. */
  async function listarFrete() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('custos_frete_interno').select('*').order('destino');
    if (error) { console.warn('[CadastroCustosStore] listarFrete falhou', error); return []; }
    return data || [];
  }

  async function atualizarCampoFrete(id, patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const payload = { ...patch, atualizado_em: new Date().toISOString(), atualizado_por: quemAtualizou() };
    const { data, error } = await c.from('custos_frete_interno').update(payload).eq('id', id).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Cadastros', acao: 'Editou custo de frete interno', alvo: data.destino, alvo_id: id, detalhe: patch,
    });
    return data;
  }

  async function listarFreteObservacoes() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('custos_frete_observacoes').select('*').eq('ativo', true).order('bloco').order('ordem');
    if (error) { console.warn('[CadastroCustosStore] listarFreteObservacoes falhou', error); return []; }
    return data || [];
  }

  async function atualizarFreteObservacao(id, texto) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('custos_frete_observacoes')
      .update({ texto, atualizado_em: new Date().toISOString(), atualizado_por: quemAtualizou() }).eq('id', id).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Cadastros', acao: 'Editou observação de frete', alvo_id: id, detalhe: { bloco: data.bloco } });
    return data;
  }

  /* Sem acento/maiúscula/espaço sobrando — "Brasilia", "BRASÍLIA " e "brasília" são a mesma cidade. */
  function normalizarTexto(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  const FRETE_OPCOES = [
    { transportadora: 1, modalidade: 'LS', campo: 'transp1_ls_rs' },
    { transportadora: 2, modalidade: 'LS', campo: 'transp2_ls_rs' },
    { transportadora: 1, modalidade: 'L', campo: 'transp1_l_rs' },
    { transportadora: 2, modalidade: 'L', campo: 'transp2_l_rs' },
  ];

  /* SUGESTÃO AUTOMÁTICA do frete interno (função pura, testável).
     - Destino: cidade da obra se for uma das capitais da tabela; senão a
       capital do estado (UF) — avisa "porUf" porque a tabela só vale a até
       20 km da capital (observação 4 da planilha).
     - Modalidade padrão = LS (caminhão compatível com CONTAINER FECHADO, que é
       como a carga importada chega); vence a transportadora mais barata.
       L (carga solta) só entra como padrão se nenhuma LS tiver valor.
     - Valor é POR CONTAINER (observação 5): total = valor × nº de containers.
     - Campo vazio/zero ("cotado caso a caso") não é opção. */
  function sugerirFrete(linhas, { cidade, uf, containers, transportadora, modalidade } = {}) {
    const lista = Array.isArray(linhas) ? linhas.filter((l) => l.ativo !== false) : [];
    const alvo = normalizarTexto(cidade);
    let destino = alvo ? lista.find((l) => normalizarTexto(l.destino) === alvo) : null;
    let porUf = false;
    if (!destino && uf) {
      destino = lista.find((l) => String(l.uf || '').toUpperCase() === String(uf).toUpperCase()) || null;
      porUf = !!destino;
    }
    if (!destino) return { destino: null, porUf: false, opcoes: [], escolhida: null, valorPorContainer: 0, containers: Number(containers) || 0, total: 0 };
    const opcoes = FRETE_OPCOES
      .map((o) => ({ ...o, valor: Number(destino[o.campo]) || 0 }))
      .filter((o) => o.valor > 0);
    const pedida = (transportadora && modalidade)
      ? opcoes.find((o) => o.transportadora === Number(transportadora) && o.modalidade === modalidade)
      : null;
    const menor = (arr) => arr.slice().sort((a, b) => a.valor - b.valor)[0] || null;
    const escolhida = pedida || menor(opcoes.filter((o) => o.modalidade === 'LS')) || menor(opcoes);
    const qtd = Math.max(0, Number(containers) || 0);
    const valorPorContainer = escolhida ? escolhida.valor : 0;
    return { destino, porUf, opcoes, escolhida, valorPorContainer, containers: qtd, total: Math.round(valorPorContainer * qtd * 100) / 100 };
  }

  /* ---------- DIFAL por estado (10/10/2026) ----------
     Mesma tabela da aba BASE do DIFAL.xlsx do Financeiro (categoria, alíquota interna, interestadual
     nacional/estrangeira e fundo de combate por UF). O DifalEngine lê daqui; antes não havia tela para
     manter esses valores. Origem fixa SP (sede da VerticalParts). */
  async function listarDifalEstados() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('difal_estados').select('*').order('uf');
    if (error) { console.warn('[CadastroCustosStore] listarDifalEstados falhou', error); return []; }
    return data || [];
  }

  async function atualizarDifalEstado(uf, patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('difal_estados').update(patch).eq('uf', uf).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({ modulo: 'Cadastros', acao: 'Editou DIFAL do estado', alvo: uf, alvo_id: uf, detalhe: patch });
    return data;
  }

  window.CadastroCustosStore = {
    listarDifalEstados, atualizarDifalEstado,
    listarCustosElevador, salvarCustoElevador, atualizarCampoElevador, removerCustoElevador, buscarCustoElevador, estimarValorElevador,
    listarCustosEscadaEsteira, salvarCustoEscadaEsteira, buscarCustoEscadaEsteira,
    listarContainers, salvarContainer, removerContainer,
    listarFrete, atualizarCampoFrete, listarFreteObservacoes, atualizarFreteObservacao, sugerirFrete, normalizarTexto,
  };
}());
