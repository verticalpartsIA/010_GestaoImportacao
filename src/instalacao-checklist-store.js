/* ============================================================
   instalacao-checklist-store.js
   Cronograma de Instalação (15/08) — checklist detalhado de execução da
   obra, dividido em semanas, "camaleão" por tipo de equipamento (o
   template muda conforme elevador/escada/esteira — pedido do usuário).

   Dois níveis:
   - instalacao_checklist_templates: a receita, por tipo_equipamento.
     Qualquer usuário pode adicionar item novo (mesmo padrão da
     biblioteca compartilhada da Ficha Técnica — ver CLAUDE.md) — é assim
     que o usuário vai alimentar os templates de escada/esteira, que hoje
     só têm o de elevador (28 itens, transcritos do infográfico dele).
   - instalacao_checklist_itens: a cópia POR OBRA, tirada do template no
     momento em que o checklist é criado (snapshot — igual
     fichas_tecnicas.cats: mudar o template depois não altera obras que já
     têm o checklist criado).

   Ordem de conclusão é livre (não força sequência) — o próprio
   infográfico do usuário avisa que corte civil e elétrica podem rodar em
   paralelo; a semana é só agrupamento visual, não gate.

   window.InstalacaoChecklistStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* dossier_obra.equip_type tem lixo histórico (ex.: "1× elevador (1
     paradas)" em vez de "elevador") — normaliza pra bater com o
     tipo_equipamento do template. */
  function normalizarTipoEquipamento(raw) {
    const s = (raw || '').toLowerCase();
    if (s.includes('escada')) return 'escada';
    if (s.includes('esteira')) return 'esteira';
    return 'elevador'; // default — é o único template que existe hoje
  }

  const SEMANA_META = {
    1: { titulo: 'Preparação e liberação', cor: '#1f3a6e' },
    2: { titulo: 'Ajustes civis e preparação', cor: '#2f7d5f' },
    3: { titulo: 'Estruturação mecânica I', cor: '#b5540a' },
    4: { titulo: 'Mecânica II', cor: '#a83232' },
    5: { titulo: 'Montagem da cabina e portas', cor: '#7a3b8a' },
    6: { titulo: 'Instalação elétrica', cor: '#1f6feb' },
    7: { titulo: 'Testes e entrega', cor: '#0f8a72' },
  };
  function semanaTitulo(n) { return (SEMANA_META[n] || {}).titulo || `Semana ${n}`; }
  function semanaCor(n) { return (SEMANA_META[n] || {}).cor || '#555'; }

  /* Marcos técnicos (rollup dos itens granulares do checklist, pedido do
     usuário 01/09) — pra Central de Instaladores mostrar progresso por
     equipamento sem precisar listar as ~28 etapas. Só elevador tem itens
     tagueados hoje (ver migração checklist_instalacao_marcos_tecnicos). */
  const MARCOS = [
    { id: 'guias', label: 'Guias' },
    { id: 'cabina', label: 'Cabina' },
    { id: 'portas', label: 'Portas' },
    { id: 'eletrica', label: 'Elétrica' },
    { id: 'entrega', label: 'Entrega' },
  ];

  /* Cálculo puro (sem I/O) a partir de uma lista de itens já carregada —
     usado tanto na aba Cronograma quanto na hierarquia da Central de
     Instaladores. iniciadoEm = primeiro item concluído (qualquer marco);
     cada marco só ganha data quando TODOS os itens daquele marco estão
     concluídos (data = o mais recente entre eles). */
  function resumoProgresso(itens) {
    const lista = itens || [];
    const total = lista.length;
    const concluidos = lista.filter((i) => i.status === 'concluido');
    const pct = total ? Math.round((concluidos.length / total) * 100) : 0;
    const datas = concluidos.map((i) => i.concluido_em).filter(Boolean).sort();
    const iniciadoEm = datas[0] || null;
    const marcos = MARCOS.map((m) => {
      const doMarco = lista.filter((i) => i.marco === m.id);
      const concluidosDoMarco = doMarco.filter((i) => i.status === 'concluido');
      const completo = doMarco.length > 0 && concluidosDoMarco.length === doMarco.length;
      const dataConclusao = completo
        ? concluidosDoMarco.map((i) => i.concluido_em).filter(Boolean).sort().slice(-1)[0] || null
        : null;
      return { ...m, completo, dataConclusao };
    });
    return { criado: total > 0, total, concluidos: concluidos.length, pct, iniciadoEm, marcos };
  }

  async function listarTemplate(tipoEquipamento) {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('instalacao_checklist_templates')
      .select('*').eq('tipo_equipamento', tipoEquipamento).order('semana').order('ordem');
    if (error) { console.warn('[InstalacaoChecklistStore] listarTemplate falhou', error); return []; }
    return data || [];
  }

  async function adicionarItemTemplate({ tipoEquipamento, semana, etapa, servicos, resultadoEsperado }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const existentes = await listarTemplate(tipoEquipamento);
    const proximaOrdem = existentes.length ? Math.max(...existentes.map((i) => i.ordem)) + 1 : 1;
    const row = {
      tipo_equipamento: tipoEquipamento, semana: Number(semana) || 1, ordem: proximaOrdem,
      etapa, servicos: (servicos || []).filter(Boolean),
      resultado_esperado: resultadoEsperado || null,
      criado_por: (window.__VP_USER || {}).email || null,
    };
    const { data, error } = await c.from('instalacao_checklist_templates').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  /* Idempotente: se o dossiê já tem itens, retorna eles direto (não
     recria — respeitaria progresso já marcado). */
  async function criarChecklistDossier(dossierId, equipTypeRaw) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const existentes = await listarPorDossier(dossierId);
    if (existentes.length) return existentes;
    const tipo = normalizarTipoEquipamento(equipTypeRaw);
    const template = await listarTemplate(tipo);
    if (!template.length) throw new Error(`Sem template cadastrado ainda para "${tipo}" — adicione itens ao template primeiro.`);
    const rows = template.map((t) => ({
      dossier_id: dossierId, tipo_equipamento: tipo, semana: t.semana, ordem: t.ordem,
      etapa: t.etapa, servicos: t.servicos, resultado_esperado: t.resultado_esperado,
      marco: t.marco || null,
      status: 'pendente',
    }));
    const { data, error } = await c.from('instalacao_checklist_itens').insert(rows).select();
    if (error) throw error;
    return data.sort((a, b) => a.semana - b.semana || a.ordem - b.ordem);
  }

  async function listarPorDossier(dossierId) {
    const c = sb(); if (!c || !dossierId) return [];
    const { data, error } = await c.from('instalacao_checklist_itens')
      .select('*').eq('dossier_id', dossierId).order('semana').order('ordem');
    if (error) { console.warn('[InstalacaoChecklistStore] listarPorDossier falhou', error); return []; }
    return data || [];
  }

  async function marcarItem(itemId, { status, observacoes }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const user = window.__VP_USER || {};
    const patch = { status, observacoes: observacoes ?? undefined };
    if (status === 'concluido') { patch.concluido_em = new Date().toISOString(); patch.concluido_por = user.nome || user.email || null; }
    else { patch.concluido_em = null; patch.concluido_por = null; }
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
    const { data: item, error } = await c.from('instalacao_checklist_itens').update(patch).eq('id', itemId).select('dossier_id').single();
    if (error) throw error;
    if (status === 'concluido' && item?.dossier_id) await _checarMetadeExecucao(item.dossier_id);
  }

  /* Dispara INSTALACAO_METADE_EXECUCAO (gatilhos-engine.js) na primeira
     vez que o checklist do dossiê bate ≥50% concluído — alimenta a 2ª
     parcela do contrato de instalador (formatos de 2/3 parcelas, ver
     contrato-instalador-engine.js:buildPagamentoItems). Idempotente via
     checagem prévia em eventos_fluxo (não recalcula "antes/depois",
     só evita duplicar o evento se já foi registrado). Nunca derruba o
     fluxo de marcar item por falha aqui — é gatilho, não obrigação. */
  async function _checarMetadeExecucao(dossierId) {
    try {
      const c = sb(); if (!c || !window.EventosFluxo) return;
      const itens = await listarPorDossier(dossierId);
      if (!itens.length) return;
      const pct = itens.filter((i) => i.status === 'concluido').length / itens.length;
      if (pct < 0.5) return;
      const label = window.EventosFluxo.EVENTOS.INSTALACAO_METADE_EXECUCAO.label;
      const { data: existe } = await c.from('eventos_fluxo').select('id').eq('alvo_id', dossierId).eq('evento', label).maybeSingle();
      if (existe) return;
      const { data: dossier } = await c.from('dossier_obra').select('numero_cotacao, building_name').eq('id', dossierId).maybeSingle();
      await window.EventosFluxo.registrar({
        evento: 'INSTALACAO_METADE_EXECUCAO', numeroCotacao: dossier?.numero_cotacao ?? null,
        alvoLabel: dossier?.building_name, alvoId: dossierId,
      });
    } catch (e) { console.warn('[InstalacaoChecklistStore] checar metade execução falhou', e); }
  }

  function gtId() { return 'stt-' + Math.random().toString(36).slice(2, 10); }

  /* Link público — mesmo padrão de token das outras páginas públicas
     (proposta, formulário do cliente): rota dedicada fora do SPA
     autenticado, servida por server.js (/status-obra/:token). */
  async function gerarLinkPublico(dossierId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: atual } = await c.from('dossier_obra').select('link_publico_token').eq('id', dossierId).maybeSingle();
    let token = atual && atual.link_publico_token;
    if (!token) {
      token = gtId();
      const { error } = await c.from('dossier_obra').update({ link_publico_token: token }).eq('id', dossierId);
      if (error) throw error;
    }
    return `${window.location.origin}/status-obra/${encodeURIComponent(token)}`;
  }

  async function obterPorToken(token) {
    const c = sb(); if (!c || !token) return null;
    const { data: dossier } = await c.from('dossier_obra').select('*').eq('link_publico_token', token).maybeSingle();
    if (!dossier) return null;
    const itens = await listarPorDossier(dossier.id);
    return { dossier, itens };
  }

  /* Link interno (VerticalParts) — mesma mecânica do link público, token
     próprio (link_interno_token) pra poder revogar um sem mexer no outro.
     Usado em reunião com a equipe: além de ler, permite anotar a Sessão
     Administrativa (ver salvarAnotacao). */
  async function gerarLinkInterno(dossierId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data: atual } = await c.from('dossier_obra').select('link_interno_token').eq('id', dossierId).maybeSingle();
    let token = atual && atual.link_interno_token;
    if (!token) {
      token = gtId();
      const { error } = await c.from('dossier_obra').update({ link_interno_token: token }).eq('id', dossierId);
      if (error) throw error;
    }
    return `${window.location.origin}/status-obra-interno/${encodeURIComponent(token)}`;
  }

  async function obterPorTokenInterno(token) {
    const c = sb(); if (!c || !token) return null;
    const { data: dossier } = await c.from('dossier_obra').select('*').eq('link_interno_token', token).maybeSingle();
    if (!dossier) return null;
    const itens = await listarPorDossier(dossier.id);
    return { dossier, itens };
  }

  /* Sessão Administrativa — agrega dado que já existe em outras tabelas
     (não duplica nada): vendedor (leads.owner via proposta), status do
     Contrato Venda (rascunho/enviado/assinado — dossier_id nem sempre
     preenchido lá, item some se não achar), as 3 vistorias inclusas
     (vistorias_obras.numero_fase), envio da doc. do instalador (campo
     simples em dossier_obra, controlado pela Central de Documentos) e os
     documentos VerticalParts anexados (dossier_documentos, já grava quem
     e quando). */
  async function obterSessaoAdministrativa(dossier) {
    const c = sb(); if (!c) return [];
    const itens = [];

    // Vendedor — via proposta vinculada -> lead
    if (dossier.proposta_id) {
      const { data: prop } = await c.from('propostas').select('lead_id').eq('id', dossier.proposta_id).maybeSingle();
      if (prop && prop.lead_id) {
        const { data: lead } = await c.from('leads').select('owner').eq('id', prop.lead_id).maybeSingle();
        if (lead && lead.owner) itens.push({ chave: 'vendedor', titulo: 'Vendedor', pessoa: lead.owner, data: null, informativo: true });
      }
    }

    // Contrato de Venda — tabela real é "contratos_venda_equipamentos" (plural,
    // sem "dossier_id" — o vínculo de verdade é por proposta_id, que o
    // dossiê também carrega). Sem campo de "quem enviou" nessa tabela, só
    // status + sent_at.
    if (dossier.proposta_id) {
      const { data: contrato } = await c.from('contratos_venda_equipamentos')
        .select('status, sent_at').eq('proposta_id', dossier.proposta_id).maybeSingle();
      if (contrato) {
        const enviado = ['enviado', 'visualizado', 'assinado'].includes(contrato.status);
        itens.push({ chave: 'contrato', titulo: 'Envio de Contrato', concluido: enviado, pessoa: null, data: enviado ? contrato.sent_at : null });
      }
    }

    // 3 vistorias inclusas
    const { data: vistorias } = await c.from('vistorias_obras').select('numero_fase, vistoriador, status, atualizado_em').eq('obra_id', dossier.id).in('numero_fase', [1, 2, 3]);
    [1, 2, 3].forEach((n) => {
      const v = (vistorias || []).find((x) => x.numero_fase === n && x.status === 'concluida');
      itens.push({ chave: `vistoria_${n}`, titulo: `Vistoria Nº ${n}`, concluido: !!v, pessoa: v?.vistoriador || null, data: v?.atualizado_em || null });
    });

    // Envio da documentação do instalador — controle simples (botão em
    // Central de Documentos), sem pipeline/anexo.
    itens.push({
      chave: 'doc_instalador', titulo: 'Envio da Documentação do Instalador',
      concluido: !!dossier.doc_instalador_enviado_em,
      pessoa: dossier.doc_instalador_enviado_por || null, data: dossier.doc_instalador_enviado_em || null,
    });

    // Documentos VerticalParts (ART, Termo de Entrega, DataBook)
    const { data: docs } = await c.from('dossier_documentos').select('tipo, responsavel, data_criacao').eq('dossier_id', dossier.id).in('tipo', ['ART', 'Termo de Entrega', 'DataBook']);
    ['ART', 'Termo de Entrega', 'DataBook'].forEach((tipo) => {
      const d = (docs || []).find((x) => x.tipo === tipo);
      itens.push({ chave: `doc_vp_${tipo}`, titulo: `Envio — ${tipo}`, concluido: !!d, pessoa: d?.responsavel || null, data: d?.data_criacao || null });
    });

    return itens;
  }

  async function marcarDocInstaladorEnviado(dossierId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const user = window.__VP_USER || {};
    const { error } = await c.from('dossier_obra').update({
      doc_instalador_enviado_em: new Date().toISOString(),
      doc_instalador_enviado_por: user.nome || user.email || 'system',
    }).eq('id', dossierId);
    if (error) throw error;
  }

  async function listarAnotacoes(dossierId) {
    const c = sb(); if (!c || !dossierId) return {};
    const { data } = await c.from('status_obra_anotacoes').select('*').eq('dossier_id', dossierId);
    const map = {};
    (data || []).forEach((a) => { map[a.item_chave] = a; });
    return map;
  }

  /* Só chamada a partir do link interno (não-SSO) — pessoa se identifica
     digitando o nome na hora (não tem login nessa página). */
  async function salvarAnotacao(dossierId, itemChave, { naoAplicavel, previsaoData, nota, atualizadoPor }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('status_obra_anotacoes').upsert({
      dossier_id: dossierId, item_chave: itemChave,
      nao_aplicavel: !!naoAplicavel, previsao_data: previsaoData || null, nota: nota || null,
      atualizado_por: atualizadoPor || null, atualizado_em: new Date().toISOString(),
    }, { onConflict: 'dossier_id,item_chave' });
    if (error) throw error;
  }

  window.InstalacaoChecklistStore = {
    normalizarTipoEquipamento, semanaTitulo, semanaCor,
    MARCOS, resumoProgresso,
    listarTemplate, adicionarItemTemplate,
    criarChecklistDossier, listarPorDossier, marcarItem,
    gerarLinkInterno, obterPorTokenInterno, obterSessaoAdministrativa,
    marcarDocInstaladorEnviado, listarAnotacoes, salvarAnotacao,
    gerarLinkPublico, obterPorToken,
  };
}());
