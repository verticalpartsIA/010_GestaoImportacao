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

  /* ---------- Contagem física (acuracidade) ----------
     Quem decide a compra precisa saber se o saldo do Omie está certo. A contagem da prateleira (importacao_varejo_contagem)
     vale por CONTAGEM_VALIDADE_DIAS; dentro do prazo, ela substitui o "disponível" do Omie na sugestão (físico contado − reservado do Omie,
     já que a prateleira conta também o que está reservado). Vencida ou inexistente: vale o Omie e a tela avisa "não conferido". */
  const CONTAGEM_VALIDADE_DIAS = 30;
  const DIA_D_AVISO_DIAS = 15;            // acorda o comprador quando faltam ≤ 15 d para o Dia D (importacao_varejo_sugestao_config.dia_d_aviso_dias)
  const MS_DIA = 24 * 3600 * 1000;

  function diasDesde(isoData, hoje) {
    if (!isoData) return null;
    const [y, m, d] = String(isoData).slice(0, 10).split('-').map(Number);
    const ini = Date.UTC(y, m - 1, d);
    const fim = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    return Math.floor((fim - ini) / MS_DIA);
  }

  /* Mesma conta de list-importacao-varejo (Edge Function): necessidade = mínimo − disponível + pendente − comprado, arredondada pra cima e ajustada por lote. */
  function ajustaLote(item, bruta) {
    let sug = bruta;
    const mult = Number(item.multiploCompra), lote = Number(item.loteMinimo);
    if (bruta > 0 && (mult > 0 || lote > 0)) {
      sug = mult > 0 ? Math.ceil(Math.max(bruta, lote || 0) / mult) * mult : Math.max(bruta, lote || 0);
    }
    return sug;
  }
  /* O que ainda vai entrar no estoque: "Comprado" (pedido do comprador, ainda sem P.I. embarcada) + "A caminho"
     (P.I. com embarque, ainda sem nota de importação) + P.I. ainda não embarcada + chegou e falta a nota.
     O comprado manual/requisição é abatido pelo que a P.I. já cobre (a requisição virou P.I.), para não contar 2x. */
  function posicaoFutura(item) {
    const caminho = item.caminhoTotal || 0;
    const comprado = item.compradoEf != null ? item.compradoEf : (item.comprado || 0);
    return comprado + caminho;
  }
  function sugestaoDe(item, disponivel) {
    const necessidade = Math.max(0, (item.estoqueMinimo || 0) - disponivel + (item.pendenteOmie || 0) - posicaoFutura(item));
    const bruta = Math.ceil(necessidade);
    return { bruta, sug: ajustaLote(item, bruta) };
  }

  /* Aplica a contagem (linha de importacao_varejo_contagem) a um item vindo da Edge Function. Idempotente: parte sempre do disponível do Omie. */
  function aplicarContagem(item, linha, hoje) {
    hoje = hoje || new Date();
    const dispOmie = item.estoqueDisponivelOmie != null ? item.estoqueDisponivelOmie : item.estoqueDisponivel;
    const out = Object.assign({}, item, { estoqueDisponivelOmie: dispOmie });
    const temQtd = !!linha && linha.quantidade != null;
    const dias = temQtd ? diasDesde(linha.contado_em, hoje) : null;
    const vencida = temQtd && (dias == null || dias > CONTAGEM_VALIDADE_DIAS);
    out.contagem = linha ? {
      quantidade: temQtd ? Number(linha.quantidade) : null,
      saldoSistemico: linha.saldo_sistemico != null ? Number(linha.saldo_sistemico) : null,
      contadoEm: linha.contado_em || null, contadoPor: linha.contado_por || null,
      endereco: linha.endereco || '', observacao: linha.observacao || '',
      dias, vencida,
    } : null;
    out.endereco = linha && linha.endereco ? linha.endereco : '';
    // Acuracidade = o que a prateleira tinha × o que o sistema dizia NO DIA da contagem (não o saldo de hoje, que já andou com vendas/entradas).
    out.acuracia = temQtd && out.contagem.saldoSistemico != null
      ? { ok: Math.abs(out.contagem.quantidade - out.contagem.saldoSistemico) < 1e-9, diferenca: out.contagem.quantidade - out.contagem.saldoSistemico }
      : null;
    const usaContado = temQtd && !vencida;
    out.baseEstoque = usaContado ? 'contado' : 'omie';
    out.estoqueDisponivel = usaContado ? Math.max(0, out.contagem.quantidade - (item.estoqueReservado || 0)) : dispOmie;
    const s = sugestaoDe(out, out.estoqueDisponivel);
    out.sugestaoBruta = s.bruta;
    out.sugestaoCompra = s.sug;
    // Sugestão de estoque mínimo/máximo (calculada no banco a partir das vendas reais do Omie — ver iv_calcular_sugestao_estoque).
    // "Comprar até o máximo" = máximo sugerido − (disponível + pendente + comprado), em coluna à parte: não troca a Sugestão existente.
    // REGRA ATUAL (pedido do usuário, 12/10): compra-se quando a posição (disponível + pendente + comprado) chega ao MÍNIMO sugerido,
    // e a quantidade leva a posição até o MÁXIMO sugerido. Sem sugestão calculada para o item, vale a regra antiga (mínimo × disponível).
    const se = item.sugestaoEstoque;
    if (se) {
      const posicao = out.estoqueDisponivel + (item.pendenteOmie || 0) + posicaoFutura(item);
      out.posicaoEstoque = posicao;
      // Revisão do comprador: ajuste manual vale no lugar do cálculo; "não repor" zera; venda esporádica (confiança baixa) sem revisão não compra.
      const rev = item.revisao || null;
      let mn = Number(se.minimo_sugerido) || 0, mx = Number(se.maximo_sugerido) || 0, origemEst = 'calculado';
      if (rev && rev.status === 'ajustado') { mn = Number(rev.minimo_manual) || 0; mx = Number(rev.maximo_manual) || 0; origemEst = 'manual'; }
      else if (rev && rev.status === 'descartado') { mn = 0; mx = 0; origemEst = 'descartado'; }
      else if (rev && rev.status === 'aprovado') origemEst = 'aprovado';
      const revisado = !!rev && ['aprovado', 'ajustado', 'descartado'].includes(rev.status);
      out.precisaRevisao = se.confianca === 'baixa' && mx > 0 && !revisado;
      out.estOrigem = origemEst;
      out.estMinSugCalc = Number(se.minimo_sugerido) || 0;   // o que o sistema calculou, mesmo com ajuste manual
      out.estMaxSugCalc = Number(se.maximo_sugerido) || 0;
      out.estMinSug = mn;
      out.estMaxSug = mx;
      out.estConfianca = se.confianca || 'baixa';
      out.estDemandaMensal = Number(se.demanda_mensal) || 0;
      out.estMesesVenda = se.meses_com_venda || 0;
      out.estPrazoDias = se.prazo_dias;
      out.estCicloDias = se.ciclo_dias;
      out.estSeguranca = Number(se.seguranca) || 0;
      out.estCusto = se.custo_unitario != null ? Number(se.custo_unitario) : null;
      out.estCustoOrigem = se.custo_origem || null;            // 'ultimo_preco' | 'cmc'
      out.estMargem = se.margem_unitaria != null ? Number(se.margem_unitaria) : null;
      out.estMargemOrigem = se.margem_origem || null;          // 'preco_venda' | 'estimada'
      out.estPrazoOrigem = se.prazo_origem || null;
      out.estDemanda12m = se.demanda_12m != null ? Number(se.demanda_12m) : null;
      out.estMotivo = se.motivo || '';
      out.estCapitalMax = se.valor_max_estoque != null ? Number(se.valor_max_estoque) : null;
      out.estSerie = Array.isArray(se.serie_12m) ? se.serie_12m.map(Number) : null;
      out.estSerieInicio = se.serie_inicio || null;
      out.estTendencia = se.tendencia || null;
      out.estTendenciaPct = se.tendencia_pct != null ? Number(se.tendencia_pct) : null;
      out.estMesPico = se.mes_pico || null;
      out.estMesVale = se.mes_vale || null;
      out.estAtrasoDias = se.atraso_dias != null ? Number(se.atraso_dias) : 0;       // criar o pedido + decidir (45 + 5 d nos importados)
      out.estMesesRuptura = se.meses_ruptura != null ? Number(se.meses_ruptura) : 0;
      out.estRuptura = Array.isArray(se.ruptura_12m) ? se.ruptura_12m.map(Number) : null;   // fração de dias sem estoque em cada um dos 12 meses
      // DIA D = data-limite para decidir o pedido: hoje + (cobertura da posição em dias − prazo total até o estoque chegar).
      out.estLeadTotalDias = (Number(se.prazo_dias) || 0) + out.estAtrasoDias;
      out.estCoberturaDias = null; out.estDiaDDias = null; out.estDiaDData = null; out.estDiaDStatus = null;
      if (out.estDemandaMensal > 0 && out.estMaxSug > 0) {
        out.estCoberturaDias = Math.floor(posicao / (out.estDemandaMensal / 30));
        out.estDiaDDias = out.estCoberturaDias - out.estLeadTotalDias;
        const d = new Date(); d.setDate(d.getDate() + out.estDiaDDias);
        out.estDiaDData = d.toISOString().slice(0, 10);
        out.estDiaDStatus = out.estDiaDDias <= 0 ? 'atrasado' : out.estDiaDDias <= DIA_D_AVISO_DIAS ? 'acordar' : 'ok';
      }
      out.abaixoMinSug = out.estMaxSug > 0 && posicao <= out.estMinSug;
      const aMax = out.estMaxSug > 0 ? Math.ceil(Math.max(0, out.estMaxSug - posicao)) : 0;
      const compraSeLiberada = out.abaixoMinSug ? ajustaLote(item, aMax) : 0;
      out.sugestaoSeAprovada = compraSeLiberada;           // o que compraria se o comprador aprovasse (aparece na fila de revisão)
      out.sugestaoBruta = out.abaixoMinSug && !out.precisaRevisao ? aMax : 0;
      out.sugestaoCompra = out.precisaRevisao ? 0 : compraSeLiberada;
      out.sugAteMax = out.sugestaoCompra;
    }
    out.conselho = item.curva === 'D' && out.estoqueDisponivel > 0
      ? 'Curva D — baixo giro (sem venda registrada desde 01/01/2024 o suficiente pra sair de D). Considere não comprar mais até vender o estoque parado.'
      : null;
    return out;
  }

  async function carregarContagens() {
    const c = sb(); if (!c) return {};
    const mapa = {};
    for (let off = 0; ; off += 1000) {
      const { data, error } = await c.from('importacao_varejo_contagem')
        .select('codigo, quantidade, saldo_sistemico, contado_em, contado_por, endereco, observacao')
        .order('codigo').range(off, off + 999);
      if (error) throw error;
      (data || []).forEach((l) => { mapa[String(l.codigo).toUpperCase()] = l; });
      if (!data || data.length < 1000) break;
    }
    return mapa;
  }

  async function carregarSugestoesEstoque() {
    const c = sb(); if (!c) return {};
    const mapa = {};
    for (let off = 0; ; off += 1000) {
      const { data, error } = await c.from('importacao_varejo_sugestao_estoque')
        .select('codigo, demanda_mensal, meses_com_venda, prazo_dias, ciclo_dias, seguranca, minimo_sugerido, maximo_sugerido, confianca, serie_12m, serie_inicio, tendencia, tendencia_pct, mes_pico, mes_vale, custo_unitario, custo_origem, margem_unitaria, margem_origem, prazo_origem, demanda_12m, motivo, valor_max_estoque, atraso_dias, meses_ruptura, ruptura_12m')
        .order('codigo').range(off, off + 999);
      if (error) throw error;
      (data || []).forEach((l) => { mapa[String(l.codigo).toUpperCase()] = l; });
      if (!data || data.length < 1000) break;
    }
    return mapa;
  }

  /* Por chegar, por produto (visão importacao_varejo_a_caminho: P.I. + embarque − notas de importação já lançadas no Omie). */
  async function carregarACaminho() {
    const c = sb(); if (!c) return {};
    const mapa = {};
    for (let off = 0; ; off += 1000) {
      const { data, error } = await c.from('importacao_varejo_a_caminho')
        .select('codigo, a_caminho, chegou_sem_nota, comprado_pi, detalhes')
        .order('codigo').range(off, off + 999);
      if (error) throw error;
      (data || []).forEach((l) => {
        mapa[String(l.codigo).toUpperCase()] = {
          aCaminho: Number(l.a_caminho) || 0, chegouSemNota: Number(l.chegou_sem_nota) || 0,
          compradoPi: Number(l.comprado_pi) || 0, detalhes: l.detalhes || [],
        };
      });
      if (!data || data.length < 1000) break;
    }
    return mapa;
  }

  async function carregarRevisoes() {
    const c = sb(); if (!c) return {};
    const mapa = {};
    for (let off = 0; ; off += 1000) {
      const { data, error } = await c.from('importacao_varejo_revisao')
        .select('codigo, status, minimo_manual, maximo_manual, observacao, revisado_por, revisado_em')
        .order('codigo').range(off, off + 999);
      if (error) throw error;
      (data || []).forEach((l) => { mapa[String(l.codigo).toUpperCase()] = l; });
      if (!data || data.length < 1000) break;
    }
    return mapa;
  }

  /* Revisão do comprador: acao = 'aprovar' | 'ajustar' | 'descartar' | 'desfazer'. */
  async function salvarRevisao({ item, acao, minimo, maximo, observacao }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const u = usuario();
    const codigo = String(item.codigo).toUpperCase();
    const status = { aprovar: 'aprovado', ajustar: 'ajustado', descartar: 'descartado', desfazer: 'pendente' }[acao];
    if (!status) throw new Error('Ação de revisão inválida.');
    const row = {
      codigo, status,
      minimo_manual: null, maximo_manual: null,
      observacao: observacao != null && String(observacao).trim() ? String(observacao).trim() : null,
      minimo_calculado: item.estMinSugCalc != null ? item.estMinSugCalc : null,
      maximo_calculado: item.estMaxSugCalc != null ? item.estMaxSugCalc : null,
      revisado_por: u.name || u.email || null, revisado_em: new Date().toISOString(),
    };
    if (status === 'ajustado') {
      const mn = Number(minimo), mx = Number(maximo);
      if (!(mn >= 0) || !(mx >= 0)) throw new Error('Informe mínimo e máximo (zero ou mais).');
      if (mx < mn) throw new Error('O máximo não pode ser menor que o mínimo.');
      row.minimo_manual = mn; row.maximo_manual = mx;
    }
    const { error } = await c.from('importacao_varejo_revisao').upsert(row, { onConflict: 'codigo' });
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Importação Varejo', acao: 'Revisão do comprador: ' + status, alvo: codigo,
      detalhe: { minimo_manual: row.minimo_manual, maximo_manual: row.maximo_manual, calculado: [row.minimo_calculado, row.maximo_calculado] },
    });
    return row;
  }

  /* Mínimo cadastrado à mão no Omie (inteiro). A coluna "Mínimo" da tela é SÓ este: o antigo "média mensal × 3" gerava 0,53 / 1,32
     (meia polia?) e foi aposentado — quem decide quanto manter é o Mín./Máx. sugerido (sempre número inteiro). */
  async function carregarMinimoOmie() {
    const c = sb(); if (!c) return {};
    const mapa = {};
    for (let off = 0; ; off += 1000) {
      const { data, error } = await c.from('importacao_varejo_estoque').select('codigo, minimo_omie').order('codigo').range(off, off + 999);
      if (error) throw error;
      (data || []).forEach((l) => { mapa[String(l.codigo).toUpperCase()] = Math.ceil(Number(l.minimo_omie) || 0); });
      if (!data || data.length < 1000) break;
    }
    return mapa;
  }

  async function carregar() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.functions.invoke('list-importacao-varejo', { body: {} });
    if (error) throw new Error((window.extrairErroFuncao && window.extrairErroFuncao(error)) || error.message || 'Falha ao consultar Importação Varejo.');
    if (data && data.error) throw new Error(data.error);
    // Falha ao ler as contagens não derruba a tela: cai no saldo do Omie, como antes, e avisa.
    let mapa = {}, avisoContagem = null;
    try { mapa = await carregarContagens(); } catch (e) { avisoContagem = 'Não foi possível ler as contagens físicas (' + (e.message || e) + '). A sugestão usa só o saldo do Omie.'; }
    let sugs = {};
    try { sugs = await carregarSugestoesEstoque(); } catch (e) { console.warn('[ImportacaoVarejo] sem sugestão de estoque mín/máx', e); }
    let revs = {};
    try { revs = await carregarRevisoes(); } catch (e) { console.warn('[ImportacaoVarejo] sem revisões do comprador', e); }
    let minOmie = {};
    try { minOmie = await carregarMinimoOmie(); } catch (e) { console.warn('[ImportacaoVarejo] sem mínimo do Omie', e); }
    let caminho = {};
    try { caminho = await carregarACaminho(); } catch (e) { console.warn('[ImportacaoVarejo] sem "a caminho" (P.I. × notas)', e); }
    const hoje = new Date();
    data.items = (data.items || []).map((i) => {
      const cod = String(i.codigo).toUpperCase();
      // estoqueMinimo (da Edge Function) = média de venda × 3, fracionado — aposentado. Vale só o mínimo do Omie (inteiro);
      // se a leitura do Omie falhou (mapa vazio), cai no antigo arredondado para cima; produto sem registro no Omie = 0.
      const base = Object.assign({}, i, { sugestaoEstoque: sugs[cod] || null, revisao: revs[cod] || null });
      const cm = caminho[cod] || null;
      base.aCaminho = cm ? cm.aCaminho : 0;
      base.chegouSemNota = cm ? cm.chegouSemNota : 0;
      base.compradoPi = cm ? cm.compradoPi : 0;
      base.caminhoTotal = base.aCaminho + base.chegouSemNota + base.compradoPi;
      base.caminhoDetalhe = cm ? cm.detalhes : [];
      base.compradoEf = Math.max(0, (Number(i.comprado) || 0) - base.caminhoTotal);
      base.estoqueMinimo = Object.keys(minOmie).length
        ? (minOmie[cod] || 0)
        : Math.ceil(Number(i.estoqueMinimo) || 0);
      return aplicarContagem(base, mapa[cod], hoje);
    });
    if (avisoContagem) data.avisoContagem = avisoContagem;
    return data;
  }

  /* Grava contagem e/ou endereço de um item. `quantidade` vazia = só endereço (não é uma contagem). */
  async function salvarContagem({ item, quantidade, endereco, observacao }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const u = usuario();
    const quem = u.name || u.email || null;
    const codigo = String(item.codigo).toUpperCase();
    const contou = quantidade != null && quantidade !== '';
    if (contou && !(Number(quantidade) >= 0)) throw new Error('Informe uma quantidade contada válida (zero ou mais).');
    const hojeIso = new Date().toISOString().slice(0, 10);
    const antes = item.contagem || null;
    if (endereco != null && window.EtiquetasCalc && window.EtiquetasCalc.validarEnderecoNovo) {
      const v = window.EtiquetasCalc.validarEnderecoNovo(endereco, antes && antes.endereco);
      if (!v.ok) throw new Error(v.msg);
      endereco = v.codigo || '';
    }
    const row = {
      codigo,
      endereco: endereco != null ? (String(endereco).trim() || null) : (antes && antes.endereco) || null,
      observacao: observacao != null ? (String(observacao).trim() || null) : (antes && antes.observacao) || null,
      atualizado_em: new Date().toISOString(), atualizado_por: u.email || null,
    };
    if (contou) {
      row.quantidade = Number(quantidade);
      row.saldo_sistemico = Number(item.estoqueFisico) || 0;     // o que o Omie dizia na hora da contagem
      row.contado_em = hojeIso; row.contado_por = quem;
    } else if (antes) {
      row.quantidade = antes.quantidade; row.saldo_sistemico = antes.saldoSistemico; row.contado_em = antes.contadoEm; row.contado_por = antes.contadoPor;
    }
    const { error } = await c.from('importacao_varejo_contagem').upsert(row, { onConflict: 'codigo' });
    if (error) throw error;
    if (contou) {
      const { error: eh } = await c.from('importacao_varejo_contagem_hist').insert({
        codigo, quantidade: row.quantidade, saldo_sistemico: row.saldo_sistemico, diferenca: row.quantidade - row.saldo_sistemico,
        contado_em: hojeIso, contado_por: quem, endereco: row.endereco, observacao: row.observacao, origem: 'tela', registrado_por: u.email || null,
      });
      if (eh) console.warn('[ImportacaoVarejo] contagem salva, mas o histórico não foi gravado', eh);
    }
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Importação Varejo', acao: contou ? 'Registrou contagem física' : 'Atualizou endereço', alvo: codigo,
      detalhe: contou ? { contado: row.quantidade, sistema: row.saldo_sistemico } : { endereco: row.endereco },
    });
    return row;
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
    carregar, aplicarContagem, salvarContagem, salvarRevisao, CONTAGEM_VALIDADE_DIAS, salvarLoteConfig, lancarComprado, listarCompradoAberto, atualizarPrevisaoComprado, excluirComprado, enviarRequisicaoOmie, previsaoPadrao, dispararSyncManual, dispararSyncEstoqueManual,
  };
}());
