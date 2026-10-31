/* ============================================================
   embarques-importacao-store.js
   Gestão Importação · Embarques — Fase 4 da consolidação de importação
   dentro do VP Gestão.

   Não confundir com a tabela `embarques` (rastreamento AIS / mapa de
   navios, item "Importação" > "Mapa de navios" na Logística) — essa
   continua separada e intocada, por decisão explícita. Este módulo é o
   Embarques rico da Gestão Importação, vinculado às P.I. (pi_importacao)
   via embarque_id.

   window.EmbarquesImportacaoStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  async function listarTodas() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('embarques_importacao').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[EmbarquesImportacaoStore] listarTodas falhou', error); return []; }
    return data || [];
  }

  async function obter(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('embarques_importacao').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  /* PIs vinculadas a este embarque — fonte automática de fornecedor,
     incoterms, categorias, nºs de série, pagamentos e produção (mesma
     lógica do Base44 original: a P.I. é a fonte da verdade, o Embarque só
     agrega/exibe). */
  async function listarPIsVinculadas(embarqueId) {
    const c = sb(); if (!c || !embarqueId) return [];
    const { data, error } = await c.from('pi_importacao').select('*').eq('embarque_id', embarqueId);
    if (error) { console.warn('[EmbarquesImportacaoStore] listarPIsVinculadas falhou', error); return []; }
    return data || [];
  }

  function unique(arr) { return [...new Set((arr || []).filter(Boolean))]; }

  function resumoPIs(pis) {
    const piNumbers = unique(pis.map((p) => p.numero_pi));
    const fornecedores = unique(pis.map((p) => p.fornecedor));
    const incoterms = unique(pis.map((p) => p.incoterms));
    const categorias = unique(pis.flatMap((p) => p.categorias || []));
    const numerosSerie = unique(pis.flatMap((p) => p.numeros_serie || []));
    const numerosRequisicao = unique(pis.map((p) => p.numero_requisicao));
    const datasAbertura = pis.map((p) => p.data_abertura).filter(Boolean).sort();
    /* Ordem estável (o banco não garante a ordem de listarPIsVinculadas): P.I. mais antiga primeiro, desempate pelo número. */
    const ordenadas = pis.slice().sort((a, b) => String(a.data_abertura || '9999').localeCompare(String(b.data_abertura || '9999')) || String(a.numero_pi || '').localeCompare(String(b.numero_pi || '')) || String(a.id || '').localeCompare(String(b.id || '')));
    const moeda = (ordenadas[0] && ordenadas[0].moeda) || 'USD';
    /* Onda 1 (30/10/2026): o total gravado soma só as P.I. na moeda da primeira (antes somava tudo como se fosse a mesma
       moeda). As demais aparecem em totaisPorMoeda e a tela avisa (moedasMistas). */
    const totaisPorMoeda = {};
    pis.forEach((p) => { const m = p.moeda || 'USD'; totaisPorMoeda[m] = (totaisPorMoeda[m] || 0) + (Number(p.valor_total) || 0); });
    const moedasMistas = Object.keys(totaisPorMoeda).length > 1;
    const valorTotal = totaisPorMoeda[moeda] || 0;
    const cotacoesDistintas = unique(pis.map((p) => p.numero_cotacao).filter((v) => v != null));
    /* 23/08 — achado real: embarques-importacao.jsx nunca expõe
       numero_cotacao na tela (o embarque só se liga à cotação
       INDIRETAMENTE, via P.I. vinculada). Sem isso, todo o disparo de
       eventos logísticos (agente de carga, cargo ready, chegada,
       entrega) ficaria mudo pra sempre em produção — nenhum embarque
       real teria numero_cotacao gravado. Deriva da primeira P.I.
       vinculada, mesma lógica de fornecedor/incoterms acima. */
    const numeroCotacao = ordenadas.map((p) => p.numero_cotacao).find((v) => v != null) ?? null;
    return { piNumbers, fornecedores, incoterms, categorias, numerosSerie, numerosRequisicao, dataPi: datasAbertura[0] || '', valorTotal, moeda, numeroCotacao, totaisPorMoeda, moedasMistas, cotacoesDistintas };
  }

  function _payload(form, pis) {
    // Container com tipo e sem número ainda também fica (issue #384): os
    // herdados da cotação chegam assim, antes do booking dar os números.
    const containers = (form.containers || []).map((c) => ({ ...c, peso: c.peso !== '' && c.peso != null ? Number(c.peso) : null })).filter((c) => c.numero || c.tipo_tamanho);
    const nfes = (form.nfes || []).map((n) => ({ ...n, valor: n.valor !== '' && n.valor != null ? Number(n.valor) : null })).filter((n) => n.numero);
    const resumo = resumoPIs(pis || []);
    const num = (v) => (v === '' || v == null ? null : Number(v));
    // Cotações de frete (aba Frete): a vencedora preenche os campos únicos que o resto do sistema já lê.
    const EF = window.EmbFreteCalc;
    const cotacoesFrete = EF ? EF.normalizar(form.cotacoes_frete) : [];
    const vencida = EF ? EF.resumoVencedor(cotacoesFrete) : null;
    const f = vencida ? { ...form, ...vencida } : form;
    return {
      cotacoes_frete: cotacoesFrete,
      numero_cotacao: resumo.numeroCotacao ?? (form.numero_cotacao ?? null),
      nome_embarque: form.nome_embarque || null, status_etapa: form.status_etapa || 'Pagamento',
      valor_total: resumo.valorTotal || null, moeda_valor_total: resumo.moeda || form.moeda_valor_total || 'USD',
      referencia_embarque: form.referencia_embarque || null, porto_origem: form.porto_origem || null, porto_destino: form.porto_destino || null,
      navio: form.navio || null, awb_bl: form.awb_bl || null, sealine: form.sealine || null, redestinacao: form.redestinacao || null,
      data_pedido_redestinacao: form.data_pedido_redestinacao || null,
      etd_original: form.etd_original || null, etd_atual: form.etd_atual || null, houve_rolagem: !!form.houve_rolagem,
      historico_rolagens: form.historico_rolagens || [], containers,
      tipo_frete: form.tipo_frete || null, modalidade_frete: form.modalidade_frete || null, agente_carga: f.agente_carga || null,
      cotacao_frete: num(f.cotacao_frete), moeda_frete: f.moeda_frete || 'USD', aprovacao_frete: form.aprovacao_frete || 'Pendente',
      pedido_booking: form.pedido_booking || null, transit_time: num(f.transit_time), free_time: num(f.free_time),
      referencia_despachante: form.referencia_despachante || null, custos_estimativa: num(form.custos_estimativa),
      documentos_marimex: form.documentos_marimex || null, transit_time_total: num(form.transit_time_total),
      di: form.di || null, data_registro_di: form.data_registro_di || null, canal_parametrizacao: form.canal_parametrizacao || null,
      ultima_data_free_time: form.ultima_data_free_time || null, eta_santos: form.eta_atual || form.eta_santos || null, eta_original: form.eta_original || null, eta_atual: form.eta_atual || null, presenca_carga: form.presenca_carga || null, historico_eta: form.historico_eta || [],
      conferencia_status: form.conferencia_status || null, conferencia_motivo: form.conferencia_motivo || null, conferencia_data: form.conferencia_data || null,
      empresa_desembaraco: form.empresa_desembaraco || null, faturamento_desembaraco: num(form.faturamento_desembaraco),
      numerario_desembaraco: num(form.numerario_desembaraco), valor_reembolso: num(form.valor_reembolso),
      status_reembolso: form.status_reembolso || 'Não solicitado', data_solicitacao_reembolso: form.data_solicitacao_reembolso || null,
      data_recebimento_reembolso: form.data_recebimento_reembolso || null, observacoes_financeiras: form.observacoes_financeiras || null,
      data_limite_entrega: form.data_limite_entrega || null, local_entrega: form.local_entrega || null,
      data_carregamento: form.data_carregamento || null, data_entrega: form.data_entrega || null, devolucao_container: form.devolucao_container || null,
      nfes, observacoes: form.observacoes || null, historico: form.historico || [], arquivado: !!form.arquivado,
    };
  }

  /* Espelha este embarque (Gestão Importação) em `embarques` (rastreamento
     AIS/Sinay) quando há AWB/BL preenchido — Embarques é a fonte da
     verdade, `embarques` só existe pra alimentar o mapa/timeline reais.
     Não confundir com a tabela `embarques` intocada por decisão antiga:
     essa decisão (comentário no topo do arquivo) foi revista em 29/08,
     nesta integração — ver Opção 1 discutida com o usuário. */
  async function _sincronizarRastreio(embarqueImportacaoId, saved) {
    const c = sb(); if (!c) return;
    const bl = saved.awb_bl || null;
    const containerNumero = (saved.containers && saved.containers[0] && saved.containers[0].numero) || null;
    if (!bl && !containerNumero) return; // nada pra rastrear ainda

    const STATUS_MAP = { Embarque: 'Em trânsito', Desembaraço: 'Aguardando liberação', Entrega: 'Aguardando liberação', Concluído: 'Entregue' };
    const status = STATUS_MAP[saved.status_etapa] || 'Em trânsito';

    const patch = {
      client: saved.nome_embarque || saved.referencia_embarque || 'Gestão Importação',
      vessel: saved.navio || null, bl, sealine: saved.sealine || null,
      container_number: containerNumero, containers: (saved.containers || []).length || 1,
      containers_lista: (saved.containers || []).map((x) => ({ numero: x.numero || null, tipo_tamanho: x.tipo_tamanho || null, lacre: x.lacre || null })),
      container_type: (saved.containers && saved.containers[0] && saved.containers[0].tipo_tamanho) || null,
      origin: saved.porto_origem || null, destination: saved.porto_destino || null,
      etd: saved.etd_atual || saved.etd_original || null,
      eta: saved.eta_atual || saved.eta_santos || null, eta_original: saved.eta_original || saved.eta_atual || saved.eta_santos || null,
      status, numero_cotacao: saved.numero_cotacao || null,
    };

    try {
      const { data: existente, error: errBusca } = await c.from('embarques').select('id, eta, last_ais_sync')
        .eq('origem_embarque_importacao_id', embarqueImportacaoId).maybeSingle();
      if (errBusca) throw errBusca;
      if (existente) {
        /* O rastreio (AIS) pode ter atualizado o ETA depois do último ETA digitado: não apaga. */
        if (existente.eta && existente.last_ais_sync) {
          const hist = saved.historico_eta || [];
          const ultimo = hist.reduce((m, h) => (h && h.registrado_em && h.registrado_em > m ? h.registrado_em : m), '');
          if (!ultimo || String(ultimo) < String(existente.last_ais_sync)) { delete patch.eta; }
        }
        const { error } = await c.from('embarques').update(patch).eq('id', existente.id);
        if (error) throw error;
      } else {
        const id = 'EM-' + Date.now().toString().slice(-6);
        const { error } = await c.from('embarques').insert({ id, position: 0, docs: [], milestones: [], ...patch, origem_embarque_importacao_id: embarqueImportacaoId });
        if (error) throw error;
        c.functions.invoke('ais-sync').catch(() => {}); // popula posição/timeline já na criação
      }
    } catch (e) {
      console.warn('[EmbarquesImportacaoStore] _sincronizarRastreio falhou (não bloqueia o salvamento do embarque)', e);
      window.toast?.('Embarque salvo, mas o espelho do rastreamento não foi atualizado: ' + ((e && e.message) || 'erro desconhecido'), 'error');
    }
  }

  async function criar(form, pis) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const user = window.__VP_USER || {};
    const historico = [{ data: new Date().toISOString(), descricao: 'Embarque criado', usuario: user.nome || user.email || 'Sistema' }];
    const row = { ..._payload({ ...form, historico }, pis), created_by: user.email || null };
    const { data, error } = await c.from('embarques_importacao').insert(row).select().single();
    if (error) throw error;
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'EMBARQUE_CRIADO', numeroCotacao: data.numero_cotacao, alvoLabel: data.nome_embarque || data.id, alvoId: data.id,
    });
    await _sincronizarRastreio(data.id, data);
    return data;
  }

  /* 23/08 (achado do app de importação da Andreia/Base44 — mesmo schema,
     confirmado campo a campo): o gap não era falta de coluna, agente_carga/
     data_carregamento/canal_parametrizacao/data_entrega já existem desde
     que este módulo foi herdado de lá. O gap era ninguém disparar evento
     quando esses campos reais são preenchidos pela primeira vez. Cada
     detecção abaixo é "estava vazio, agora tem valor" — dispara uma vez só,
     na transição, não a cada updated_at. */
  async function atualizar(id, form, pis) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const antes = await obter(id);
    const user = window.__VP_USER || {};
    const historico = [...(form.historico || []), { data: new Date().toISOString(), descricao: 'Embarque atualizado', usuario: user.nome || user.email || 'Sistema' }];
    const row = { ..._payload({ ...form, historico }, pis), updated_at: new Date().toISOString() };
    const { data, error } = await c.from('embarques_importacao').update(row).eq('id', id).select().single();
    if (error) throw error;
    if (window.EventosFluxo) {
      const alvoLabel = data.nome_embarque || data.id;
      window.EventosFluxo.registrar({ evento: 'EMBARQUE_ATUALIZADO', numeroCotacao: data.numero_cotacao, alvoLabel, alvoId: data.id });
      /* Embarque costuma nascer sem P.I. (a tela pede "salve para vincular") e só ganha o Nº da cotação depois — os
         eventos disparados antes saíram sem Nº e o motor de gatilhos os ignorou. Na transição "sem Nº → com Nº" repete
         EMBARQUE_CRIADO e as transições de campo já preenchidas, agora com o Nº (auditoria de 11/10). */
      const ganhouCotacao = !!(antes && antes.numero_cotacao == null && data.numero_cotacao != null);
      if (ganhouCotacao) window.EventosFluxo.registrar({ evento: 'EMBARQUE_CRIADO', numeroCotacao: data.numero_cotacao, alvoLabel, alvoId: data.id });
      const transicao = (campo, evento) => {
        if ((antes && !antes[campo] && data[campo]) || (ganhouCotacao && data[campo])) {
          window.EventosFluxo.registrar({ evento, numeroCotacao: data.numero_cotacao, alvoLabel, alvoId: data.id, detalhe: { [campo]: data[campo] } });
        }
      };
      /* Testado ao vivo 23/08: cadeia inteira fecha certo com timing
         realista (1 transição por salvamento, como o uso real — esses
         campos são preenchidos em momentos bem separados). Só em teste
         sintético disparando as 4 transições numa única chamada (fora do
         uso real) apareceu "duplicate key" — corrida entre nós que
         compartilham o mesmo nasce (garantirNo criando o mesmo
         predecessor 2x). Não tratado agora por não refletir uso real. */
      transicao('agente_carga', 'AGENTE_CARGA_DEFINIDO');
      transicao('data_carregamento', 'CARGO_READY_CONFIRMADO');
      transicao('canal_parametrizacao', 'EMBARQUE_CHEGOU_BRASIL');
      transicao('data_entrega', 'EMBARQUE_ENTREGUE_OBRA');
    }
    await _sincronizarRastreio(data.id, data);
    return data;
  }

  async function remover(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('embarques_importacao').delete().eq('id', id);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Embarques', acao: 'Excluiu embarque', alvo_id: id,
    });
  }

  async function arquivar(id, arquivado) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('embarques_importacao').update({ arquivado, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Embarques', acao: arquivado ? 'Arquivou embarque' : 'Desarquivou embarque', alvo_id: id,
    });
  }

  /* Issue #384 — containers que a cotação já tem estruturados, pra logística
     não redigitar no embarque. Mesma prioridade de PropostaHeranca: a
     precificação aprovada (status 'finalizado') vale mais que o rascunho
     mais recente; sem precificação (ou com a lista vazia), cai no texto
     livre do fornecedor (`respostas.container_no`, ex. "1x40HC + 1x20GP"),
     lido pelo mesmo parseContainerNo() da Precificação. Devolve linhas
     agregadas {tipo_tamanho, quantidade} — quem expande em containers
     físicos (1 por linha do embarque) é expandirContainers() abaixo.
     Nunca grava nada: a tela só oferece os containers pro usuário aceitar. */
  async function containersDaCotacao(numeroCotacao) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const numero = window.MasterIdEngine ? window.MasterIdEngine.parseNumeroCotacao(numeroCotacao) : Number(numeroCotacao);
    if (!numero) throw new Error('Informe um Nº da Cotação válido.');
    const limpar = (linhas) => (linhas || [])
      .map((l) => ({ tipo_tamanho: l.tipo_tamanho || 'Outro', quantidade: Math.max(1, Math.floor(Number(l.quantidade) || 1)) }));

    const { data: pzs, error: errPz } = await c.from('precificacoes_elevador').select('status, containers')
      .eq('numero_cotacao', numero).order('created_at', { ascending: false });
    if (errPz) throw errPz;
    const lista = pzs || [];
    const pz = lista.find((p) => p.status === 'finalizado') || lista[0] || null;
    if (pz && (pz.containers || []).length) return { numeroCotacao: numero, origem: 'precificacao', linhas: limpar(pz.containers) };

    const { data: form, error: errF } = await c.from('formularios_elevador').select('id').eq('numero_cotacao', numero).maybeSingle();
    if (errF) throw errF;
    if (!form) return { numeroCotacao: numero, origem: null, linhas: [], formularioEncontrado: false };
    const { data: cots, error: errC } = await c.from('cotacoes_elevador_fornecedor').select('status, respostas')
      .eq('formulario_elevador_id', form.id).order('created_at', { ascending: false });
    if (errC) throw errC;
    const comContainer = (cots || []).filter((x) => String((x.respostas || {}).container_no || '').trim());
    const cot = comContainer.find((x) => x.status === 'aprovada') || comContainer.find((x) => x.status === 'em_analise')
      || comContainer.find((x) => x.status === 'respondido') || comContainer[0] || null;
    const parse = window.PrecificacaoElevadorStore && window.PrecificacaoElevadorStore.parseContainerNo;
    if (!cot || !parse) return { numeroCotacao: numero, origem: null, linhas: [], formularioEncontrado: true };
    return { numeroCotacao: numero, origem: 'fornecedor', linhas: limpar(parse(cot.respostas.container_no)), textoFornecedor: cot.respostas.container_no };
  }

  /* 2x 40'HC → 2 containers físicos (numero/lacre/peso em branco pra
     logística completar). Teto de 50 por linha contra quantidade absurda
     digitada por engano na Precificação. */
  function expandirContainers(linhas) {
    return (linhas || []).flatMap((l) => Array.from({ length: Math.min(50, l.quantidade || 1) }, () => (
      { numero: '', tipo_tamanho: l.tipo_tamanho, lacre: '', peso: '', data_embarque: '', data_chegada: '' }
    )));
  }

  /* Chamado por PIStore quando o Nº da cotação chega ao embarque fora de atualizar() (vínculo pela P.I.): registra os
     eventos que tinham saído sem Nº e atualiza o espelho do rastreio (embarques.numero_cotacao). */
  async function aoGanharCotacao(id) {
    const data = await obter(id);
    if (!data || data.numero_cotacao == null) return;
    if (window.EventosFluxo) {
      const alvoLabel = data.nome_embarque || data.id;
      window.EventosFluxo.registrar({ evento: 'EMBARQUE_CRIADO', numeroCotacao: data.numero_cotacao, alvoLabel, alvoId: data.id });
      [['agente_carga', 'AGENTE_CARGA_DEFINIDO'], ['data_carregamento', 'CARGO_READY_CONFIRMADO'],
       ['canal_parametrizacao', 'EMBARQUE_CHEGOU_BRASIL'], ['data_entrega', 'EMBARQUE_ENTREGUE_OBRA']].forEach(([campo, evento]) => {
        if (data[campo]) window.EventosFluxo.registrar({ evento, numeroCotacao: data.numero_cotacao, alvoLabel, alvoId: data.id, detalhe: { [campo]: data[campo] } });
      });
    }
    await _sincronizarRastreio(data.id, data);
  }


  /* ---------- Cotações de frete marítimo (aba Frete) ----------
     Cada cotação tem id "<embarque>:F<n>" (vira referencia_id do e-mail em
     emails_projeto, referencia_tipo 'cotacao_frete'). Anexos no bucket
     `engenharia`. O envio usa o helper único de e-mail (send-email): nada
     da Edge Function/Inbox foi alterado. */
  const FRETE_ANEXO_MAX = 25 * 1024 * 1024;
  const FRETE_EMAIL_MAX = 2.5 * 1024 * 1024; // limite real do send-email (MAX_ANEXO_TOTAL)

  // Grava só a coluna das cotações. Quem é vencedora NÃO muda aqui (isso só vale no "Salvar" do embarque,
  // que também atualiza agente/frete/prazos e dispara os eventos): a marca de vencedora vem do banco.
  async function salvarCotacoesFrete(id, cotacoes) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: atual, error: e0 } = await c.from('embarques_importacao').select('cotacoes_frete').eq('id', id).single();
    if (e0) throw e0;
    const gravadas = {};
    ((atual && atual.cotacoes_frete) || []).forEach((g) => { gravadas[g.id] = !!g.vencedor; });
    const lista = window.EmbFreteCalc.normalizar(cotacoes).map((g) => ({ ...g, vencedor: !!gravadas[g.id] }));
    const { error } = await c.from('embarques_importacao').update({ cotacoes_frete: lista, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    return lista;
  }

  async function uploadAnexoFrete(embarqueId, cotacaoId, file) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!file) throw new Error('Arquivo não informado.');
    if (file.size > FRETE_ANEXO_MAX) throw new Error('Arquivo acima de 25 MB.');
    const ok = /^(image\/|application\/pdf)/.test(file.type || '') || /\.(pdf|png|jpe?g|webp|gif|xlsx?|docx?|csv)$/i.test(file.name || '');
    if (!ok) throw new Error('Envie PDF, imagem ou planilha/documento.');
    const seguro = String(file.name).replace(/[^\w.\-]/g, '_');
    const path = `embarques-frete/${String(embarqueId)}/${String(cotacaoId).replace(/[^\w\-]/g, '_')}/${Date.now()}_${seguro}`;
    const { error } = await c.storage.from('engenharia').upload(path, file, { upsert: false });
    if (error) throw new Error(error.message);
    const { data: pub } = c.storage.from('engenharia').getPublicUrl(path);
    const user = window.__VP_USER || {};
    return { nome: file.name, url: pub.publicUrl, path, tipo: file.type || '', tamanho: file.size, por: user.email || null, em: new Date().toISOString() };
  }

  // Anexos que cabem no e-mail (≤ 2,5 MB somados) vão como arquivo; o resto vai como link no texto.
  async function anexosParaEmail(anexos) {
    const attachments = []; const links = [];
    let total = 0;
    for (const a of (anexos || [])) {
      if (total + (a.tamanho || 0) > FRETE_EMAIL_MAX) { links.push(a); continue; }
      try {
        const resp = await fetch(a.url);
        if (!resp.ok) { links.push(a); continue; }
        const buf = new Uint8Array(await resp.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        attachments.push({ filename: a.nome, contentType: a.tipo || 'application/octet-stream', base64: btoa(bin) });
        total += buf.length;
      } catch (e) { links.push(a); }
    }
    return { attachments, links };
  }

  // Envia o pedido de cotação ao agente pelo send-email (aparece em Enviados no Inbox) e registra o envio.
  async function enviarPedidoCotacaoFrete(emb, cotacao, { to, cc, subject, text }) {
    if (!emb || !emb.id) throw new Error('Salve o embarque antes de enviar a cotação.');
    if (!to) throw new Error('Informe o e-mail do agente.');
    const { attachments, links } = await anexosParaEmail(cotacao.anexos);
    const corpo = links.length
      ? text + '\n\n' + links.map((a) => `• ${a.nome}: ${a.url}`).join('\n')
      : text;
    const r = await window.EmailEnvioHelper.tentarEnviarDireto({
      to, cc, subject, text: corpo,
      numeroCotacao: emb.numero_cotacao ?? undefined,
      referenciaTipo: 'cotacao_frete', referenciaId: cotacao.id,
      attachments: attachments.length ? attachments : undefined,
    });
    if (!r.enviouDireto) return { ok: false, links, erro: r.emailData || r.emailError };
    const user = window.__VP_USER || {};
    const envio = { em: new Date().toISOString(), por: user.email || null, para: to, assunto: subject, anexos: attachments.length, links: links.length };
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Embarques de Importação', acao: 'Enviou pedido de cotação de frete ao agente',
      alvo: emb.nome_embarque || emb.id, alvo_id: emb.id, detalhe: { agente: cotacao.agente, para: to },
    });
    return { ok: true, envio };
  }

  // E-mails de ENTRADA vinculados a esta cotação (Message-ID da resposta ao e-mail enviado pelo site).
  async function respostasFrete(cotacaoId) {
    const c = sb(); if (!c || !cotacaoId) return [];
    const { data, error } = await c.from('emails_projeto')
      .select('id, assunto, de_email, de_nome, data_mensagem')
      .eq('direcao', 'entrada').is('excluido_em', null).eq('referencia_id', String(cotacaoId))
      .order('data_mensagem', { ascending: false }).limit(20);
    if (error) return [];
    return data || [];
  }

  window.EmbarquesImportacaoStore = { salvarCotacoesFrete, uploadAnexoFrete, enviarPedidoCotacaoFrete, respostasFrete, aoGanharCotacao, listarTodas, obter, listarPIsVinculadas, resumoPIs, criar, atualizar, remover, arquivar, containersDaCotacao, expandirContainers };
}());
