/* ============================================================
   acompanhamento-obra-store.js — Diário de Obra (Acompanhamento de Obra)

   Diferente do Cronograma de Instalação (instalacao-checklist-store.js,
   status quo antes desta feature): aqui o Montador é quem preenche, por
   um link FIXO por dossiê (gerado quando o instalador assina o
   contrato), e cada envio vira uma linha datada em
   acompanhamento_obra_lancamentos — é isso que forma a linha do tempo
   real da obra, não só um status atual.

   Regra de negócio (pedido explícito do usuário, 04/09):
   - Qualquer um com o link vê o status atual em tempo real.
   - O Montador só ACRESCENTA (flega item + foto obrigatória) — nunca
     desmarca pelo link.
   - Só o operador, de dentro do sistema (aba "Acompanhamento de Obra"
     do Dossiê), pode desflegar — action gated pela alçada
     instalacao.editar_status_obra (ver financeiro.jsx ALCADAS_PROPOSTAS).
   - O progresso ponderado (pesos dos 17 itens, "não commitar/
     AcompanhamentoObra.md") alimenta o card de status em
     cadastro-instaladores.jsx (ver rh-homologacao-store.js
     listarHierarquiaClientesDoInstalador).

   window.AcompanhamentoObraStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return window.__VP_SB && window.__VP_SB.sb; }

  function gerarToken() {
    const bytes = new Uint8Array(24);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function listarItens(tipoEquipamento) {
    const c = sb();
    const { data, error } = await c.from('acompanhamento_obra_itens')
      .select('*').eq('tipo_equipamento', tipoEquipamento || 'elevador').order('ordem');
    if (error) throw error;
    return data || [];
  }

  async function obterLink(dossierId) {
    const c = sb();
    const { data } = await c.from('acompanhamento_obra_links').select('*').eq('dossier_id', dossierId).maybeSingle();
    return data || null;
  }

  /* Gera o link (se ainda não existir) e semeia acompanhamento_obra_status
     com um item por linha (flegado:false) — é essa semeadura que faz
     `criado` virar true no resumo, mesmo antes do 1º lançamento. */
  async function criarOuObterLink(dossierId, criadoPor, tipoEquipamento) {
    const c = sb();
    const existente = await obterLink(dossierId);
    if (existente) return existente;

    const itens = await listarItens(tipoEquipamento);
    const token = gerarToken();
    const { data: link, error } = await c.from('acompanhamento_obra_links')
      .insert({ dossier_id: dossierId, token, criado_por: criadoPor || null })
      .select().single();
    if (error) throw error;

    if (itens.length) {
      await c.from('acompanhamento_obra_status').upsert(
        itens.map((it) => ({ dossier_id: dossierId, item_id: it.id, flegado: false })),
        { onConflict: 'dossier_id,item_id', ignoreDuplicates: true }
      );
    }
    return link;
  }

  async function obterEstadoDossier(dossierId) {
    const c = sb();
    const [{ data: status }, { data: lancamentos }, { data: dossier }, { data: equipamentos }] = await Promise.all([
      c.from('acompanhamento_obra_status').select('*, acompanhamento_obra_itens(id, texto, ordem, peso)').eq('dossier_id', dossierId),
      c.from('acompanhamento_obra_lancamentos').select('*').eq('dossier_id', dossierId).order('data', { ascending: false }).order('enviado_em', { ascending: false }),
      c.from('dossier_obra').select('id, client_name, building_name, equip_type, numero_cotacao').eq('id', dossierId).maybeSingle(),
      /* Nº do Equipamento (Master ID) no cabeçalho — pedido do usuário
         04/09: mesmo cliente/prédio pode ter 2+ dossiês (1 elevador por
         dossiê) com a MESMA instaladora — client_name/building_name saem
         idênticos, então o montador não conseguia diferenciar qual link
         de qual obra. numero_serie desambigua sem mexer no schema de
         status/lançamentos (continuam por dossiê, 1 elevador = 1 dossiê). */
      c.from('equipamentos_obra').select('id, numero_serie, tipo').eq('dossier_id', dossierId),
    ]);
    return { dossier, status: status || [], lancamentos: lancamentos || [], equipamentos: equipamentos || [] };
  }

  /* Segurança real (#571, F1): a página pública /diario-obra/:token lê o estado por RPC `public_diario_obter` (recebe só
     o TOKEN; devolve cabeçalho, itens/status e nº de série — sem ler dossier_obra direto). Interruptor de emergência:
     localStorage.vp_public_rpc = 'off' volta ao caminho antigo. Se a RPC falhar (rede, ou migração ainda não aplicada),
     cai no caminho antigo. As gravações do Montador (registrarLancamento) seguem nas tabelas acompanhamento_obra_*. */
  function usarRpcPublica() {
    try { return localStorage.getItem('vp_public_rpc') !== 'off'; } catch (e) { return true; }
  }

  async function obterEstadoPorToken(token) {
    const c = sb();
    if (c && token && usarRpcPublica()) {
      try {
        const { data, error } = await c.rpc('public_diario_obter', { p_token: token });
        if (!error) {
          if (!data) return null;
          return { link: data.link, dossier: data.dossier || null, status: data.status || [], lancamentos: data.lancamentos || [], equipamentos: data.equipamentos || [] };
        }
        console.warn('[AcompanhamentoObraStore] RPC public_diario_obter falhou — usando caminho antigo', error);
      } catch (e) { console.warn('[AcompanhamentoObraStore] RPC public_diario_obter indisponível — usando caminho antigo', e); }
    }
    const { data: link } = await c.from('acompanhamento_obra_links').select('*').eq('token', token).maybeSingle();
    if (!link) return null;
    const estado = await obterEstadoDossier(link.dossier_id);
    return { link, ...estado };
  }

  async function uploadFoto(dossierId, itemId, file) {
    const c = sb();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `diario-obra/${dossierId}/${itemId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await c.storage.from('vistorias-anexos').upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    const { data } = c.storage.from('vistorias-anexos').getPublicUrl(path);
    return data.publicUrl;
  }

  /* Data de hoje no fuso de São Paulo (aaaa-mm-dd) — o servidor e o celular do montador podem estar em outro fuso. */
  function hojeSP() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  const CONCLUIDO_EM_JANELA_DIAS = 60;
  /* Vazio => hoje. Recusa formato inválido, data futura e data mais de 60 dias atrás. */
  /* Dia (fuso de São Paulo) de um instante ISO — usado como teto na correção: não dá para concluir depois do envio. */
  function diaSP(iso) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  }
  /* referencia = dia de envio (aaaa-mm-dd); sem informar, vale hoje (marcação nova). O banco repete a mesma regra (trigger). */
  function validarConcluidoEm(valor, referencia) {
    const ref = referencia || hojeSP();
    const v = (valor || ref);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v + 'T00:00:00Z'))) throw new Error('Data de conclusão inválida.');
    if (v > ref) throw new Error(referencia ? 'A data de conclusão não pode ser depois do dia do envio.' : 'A data de conclusão não pode ser no futuro.');
    const dias = (Date.parse(ref + 'T00:00:00Z') - Date.parse(v + 'T00:00:00Z')) / 864e5;
    if (dias > CONCLUIDO_EM_JANELA_DIAS) throw new Error(`A data de conclusão não pode ser de mais de ${CONCLUIDO_EM_JANELA_DIAS} dias antes do envio.`);
    return v;
  }

  /* Correção da data real pelo operador (alçada instalacao.editar_status_obra). A data de envio não muda. */
  async function corrigirConcluidoEm(dossierId, itemId, data, operadorEmail) {
    const c = sb();
    const { data: atual, error: errLeitura } = await c.from('acompanhamento_obra_status')
      .select('flegado, flegado_em').eq('dossier_id', dossierId).eq('item_id', itemId).maybeSingle();
    if (errLeitura) throw errLeitura;
    if (!atual || !atual.flegado || !atual.flegado_em) throw new Error('Só dá para informar a data de uma etapa já marcada como feita.');
    const v = validarConcluidoEm(data, diaSP(atual.flegado_em));
    const { error } = await c.from('acompanhamento_obra_status')
      .update({ concluido_em: v }).eq('dossier_id', dossierId).eq('item_id', itemId).eq('flegado', true);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Instalação', acao: 'Corrigiu a data de conclusão de uma etapa da obra', alvo_id: dossierId,
      ator_nome: operadorEmail || null, detalhe: { itemId, concluido_em: v },
    });
    return v;
  }

  /* itensHoje: [{ item_id, fotos: [url,...], observacao?, concluido_em? }]. observacao é
     opcional — texto livre de quem flegou (ex.: dificuldade encontrada),
     nunca bloqueia o envio. Add-only: itens já flegados são ignorados
     aqui (o Montador não consegue re-enviar um item já travado — a tela
     pública já filtra, isto é defesa extra).
     flegadoPor: null/undefined = veio do link do Montador (padrão);
     e-mail/label do operador quando flegado de dentro do sistema (ver
     flegarItensOperador) — grava em acompanhamento_obra_status.flegado_por
     pra manter o rastro de quem flegou cada item. */
  async function registrarLancamento(dossierId, itensHoje, observacao, flegadoPor) {
    const c = sb();
    if (!itensHoje || !itensHoje.length) throw new Error('Selecione ao menos 1 item feito hoje.');
    const semFoto = itensHoje.find((i) => !i.fotos || !i.fotos.length);
    if (semFoto) throw new Error('Toda atividade marcada precisa de ao menos 1 foto.');

    const { data: statusAtual } = await c.from('acompanhamento_obra_status')
      .select('item_id, flegado').eq('dossier_id', dossierId).in('item_id', itensHoje.map((i) => i.item_id));
    const jaFlegados = new Set((statusAtual || []).filter((s) => s.flegado).map((s) => s.item_id));
    const novos = itensHoje.filter((i) => !jaFlegados.has(i.item_id));
    if (!novos.length) throw new Error('Os itens selecionados já estavam marcados.');

    // Data real em que a etapa foi concluída (ver validarConcluidoEm); sem informar, vale hoje.
    novos.forEach((i) => { i.concluido_em = validarConcluidoEm(i.concluido_em); });

    const agora = new Date().toISOString();
    await Promise.all(novos.map((i) => c.from('acompanhamento_obra_status')
      .upsert({ dossier_id: dossierId, item_id: i.item_id, flegado: true, flegado_em: agora, concluido_em: i.concluido_em, fotos: i.fotos, observacao: i.observacao || null, flegado_por: flegadoPor || null, desflegado_por: null, desflegado_em: null }, { onConflict: 'dossier_id,item_id' })));

    const { error } = await c.from('acompanhamento_obra_lancamentos').insert({
      dossier_id: dossierId,
      data: new Date().toISOString().slice(0, 10),
      itens: novos,
      observacao: observacao || null,
    });
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Instalação', acao: 'Registrou lançamento de progresso na obra',
      ator_nome: flegadoPor || 'Montador (link público)', alvo_id: dossierId,
      detalhe: { itens: novos.map((i) => i.item_id), observacao: observacao || null },
    });
    await _checarMetadeExecucao(dossierId);
    return novos.length;
  }

  /* Achado A10 da auditoria (não commitar/tour.md): INSTALACAO_METADE_EXECUCAO
     era disparado pelo Cronograma de Instalação (checklist de template),
     desconectado do Acompanhamento de Obra — que o usuário confirmou ser
     quem de fato define o status da obra em campo (verificado com foto).
     Decisão de negócio 10/09/2026: mover o gatilho pra cá, usando o
     progresso PONDERADO (resumoProgresso, pesos por item) em vez de
     contagem simples de itens. Idempotente via checagem prévia em
     eventos_fluxo — mesmo padrão que instalacao-checklist-store.js usava
     (removido de lá na mesma mudança). Nunca derruba o fluxo de
     registrar lançamento por falha aqui — é gatilho, não obrigação. */
  async function _checarMetadeExecucao(dossierId) {
    try {
      const c = sb(); if (!c || !window.EventosFluxo) return;
      const estado = await obterEstadoDossier(dossierId);
      const resumo = resumoProgresso(estado.status);
      if (resumo.pct < 50) return;
      const label = window.EventosFluxo.EVENTOS.INSTALACAO_METADE_EXECUCAO.label;
      const { data: existe } = await c.from('eventos_fluxo').select('id').eq('alvo_id', dossierId).eq('evento', label).maybeSingle();
      if (existe) return;
      await window.EventosFluxo.registrar({
        evento: 'INSTALACAO_METADE_EXECUCAO', numeroCotacao: estado.dossier?.numero_cotacao ?? null,
        alvoLabel: estado.dossier?.building_name, alvoId: dossierId,
      });
    } catch (e) { console.warn('[AcompanhamentoObraStore] checar metade execução falhou', e); }
  }

  /* Flegar de dentro do sistema (não pelo link do Montador) — pedido do
     usuário 04/09: operador com a alçada instalacao.editar_status_obra
     também pode flegar (não só desflegar) itens que o Montador ainda não
     marcou (esquecimento, atraso no envio, etc.). Mesma exigência de
     foto por item; a origem fica registrada em flegado_por e a
     observação do lançamento deixa claro que foi manual. */
  async function flegarItensOperador(dossierId, itensHoje, operadorEmail) {
    return registrarLancamento(dossierId, itensHoje, 'Flegado manualmente pelo operador' + (operadorEmail ? ` (${operadorEmail})` : ''), operadorEmail || 'Operador');
  }

  async function desflegarItem(dossierId, itemId, operadorEmail) {
    const c = sb();
    const { error } = await c.from('acompanhamento_obra_status')
      .update({ flegado: false, concluido_em: null, desflegado_por: operadorEmail || null, desflegado_em: new Date().toISOString() })
      .eq('dossier_id', dossierId).eq('item_id', itemId);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Instalação', acao: 'Desmarcou item de progresso na obra', alvo_id: dossierId,
      detalhe: { itemId },
    });
  }

  /* statusRows: linhas de acompanhamento_obra_status já com o item
     embutido (acompanhamento_obra_itens: {id, texto, ordem, peso}) —
     tanto obterEstadoDossier quanto o batch de rh-homologacao-store.js
     alimentam nesse formato. */
  function resumoProgresso(statusRows) {
    if (!statusRows || !statusRows.length) return { criado: false, pct: 0, marcos: [], iniciadoEm: null };
    const ordenados = [...statusRows].sort((a, b) => (a.acompanhamento_obra_itens?.ordem || 0) - (b.acompanhamento_obra_itens?.ordem || 0));
    const marcosDef = [50, 75, 100];
    const marcos = marcosDef.map((t) => ({ id: 'm' + t, label: t + '%', completo: false, dataConclusao: null }));
    let acumulado = 0, iniciadoEm = null, marcoIdx = 0;
    ordenados.forEach((s) => {
      if (!s.flegado) return;
      const peso = Number(s.acompanhamento_obra_itens?.peso) || 0;
      acumulado += peso;
      if (!iniciadoEm || s.flegado_em < iniciadoEm) iniciadoEm = s.flegado_em;
      while (marcoIdx < marcos.length && acumulado >= marcosDef[marcoIdx] - 0.001) {
        marcos[marcoIdx].completo = true;
        marcos[marcoIdx].dataConclusao = s.flegado_em;
        marcoIdx++;
      }
    });
    /* 100% só com TODOS os itens flegados (inclui Pendências/acabamento);
       enquanto houver item aberto, o teto é 99% e o arredondamento é para baixo. */
    /* Também exige que as linhas devolvidas cubram o checklist completo (pesos somam 100):
       link antigo sem alguma linha semeada não pode virar 100% só porque o que existe está marcado. */
    const pesoTotal = ordenados.reduce((a, s) => a + (Number(s.acompanhamento_obra_itens?.peso) || 0), 0);
    const completo = ordenados.every((s) => s.flegado) && pesoTotal >= 100 - 0.001;
    const pct = completo ? 100 : Math.min(99, Math.floor(acumulado + 0.001));
    return { criado: true, pct, marcos, iniciadoEm };
  }

  /* 1 query em lote pra N dossiês — usado por
     rh-homologacao-store.js:listarHierarquiaClientesDoInstalador no
     lugar do antigo InstalacaoChecklistStore. */
  async function resumoProgressoBatch(dossierIds) {
    const c = sb();
    if (!dossierIds || !dossierIds.length) return {};
    const { data } = await c.from('acompanhamento_obra_status')
      .select('dossier_id, flegado, flegado_em, acompanhamento_obra_itens(id, ordem, peso)')
      .in('dossier_id', dossierIds);
    const agrupado = {};
    (data || []).forEach((row) => { (agrupado[row.dossier_id] = agrupado[row.dossier_id] || []).push(row); });
    const out = {};
    dossierIds.forEach((id) => { out[id] = resumoProgresso(agrupado[id] || []); });
    return out;
  }

  window.AcompanhamentoObraStore = {
    listarItens, obterLink, criarOuObterLink, obterEstadoDossier, obterEstadoPorToken,
    uploadFoto, registrarLancamento, flegarItensOperador, desflegarItem, resumoProgresso, resumoProgressoBatch,
    hojeSP, diaSP, validarConcluidoEm, corrigirConcluidoEm, CONCLUIDO_EM_JANELA_DIAS,
  };
}());
