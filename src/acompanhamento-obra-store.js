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
    const [{ data: status }, { data: lancamentos }, { data: dossier }] = await Promise.all([
      c.from('acompanhamento_obra_status').select('*, acompanhamento_obra_itens(id, texto, ordem, peso)').eq('dossier_id', dossierId),
      c.from('acompanhamento_obra_lancamentos').select('*').eq('dossier_id', dossierId).order('data', { ascending: false }).order('enviado_em', { ascending: false }),
      c.from('dossier_obra').select('id, client_name, building_name, equip_type').eq('id', dossierId).maybeSingle(),
    ]);
    return { dossier, status: status || [], lancamentos: lancamentos || [] };
  }

  async function obterEstadoPorToken(token) {
    const c = sb();
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

  /* itensHoje: [{ item_id, fotos: [url,...] }]. Add-only: itens já
     flegados são ignorados aqui (o Montador não consegue re-enviar um
     item já travado — a tela pública já filtra, isto é defesa extra). */
  async function registrarLancamento(dossierId, itensHoje, observacao) {
    const c = sb();
    if (!itensHoje || !itensHoje.length) throw new Error('Selecione ao menos 1 item feito hoje.');
    const semFoto = itensHoje.find((i) => !i.fotos || !i.fotos.length);
    if (semFoto) throw new Error('Toda atividade marcada precisa de ao menos 1 foto.');

    const { data: statusAtual } = await c.from('acompanhamento_obra_status')
      .select('item_id, flegado').eq('dossier_id', dossierId).in('item_id', itensHoje.map((i) => i.item_id));
    const jaFlegados = new Set((statusAtual || []).filter((s) => s.flegado).map((s) => s.item_id));
    const novos = itensHoje.filter((i) => !jaFlegados.has(i.item_id));
    if (!novos.length) throw new Error('Os itens selecionados já estavam marcados.');

    const agora = new Date().toISOString();
    await Promise.all(novos.map((i) => c.from('acompanhamento_obra_status')
      .upsert({ dossier_id: dossierId, item_id: i.item_id, flegado: true, flegado_em: agora, fotos: i.fotos, desflegado_por: null, desflegado_em: null }, { onConflict: 'dossier_id,item_id' })));

    const { error } = await c.from('acompanhamento_obra_lancamentos').insert({
      dossier_id: dossierId,
      data: new Date().toISOString().slice(0, 10),
      itens: novos,
      observacao: observacao || null,
    });
    if (error) throw error;
    return novos.length;
  }

  async function desflegarItem(dossierId, itemId, operadorEmail) {
    const c = sb();
    const { error } = await c.from('acompanhamento_obra_status')
      .update({ flegado: false, desflegado_por: operadorEmail || null, desflegado_em: new Date().toISOString() })
      .eq('dossier_id', dossierId).eq('item_id', itemId);
    if (error) throw error;
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
    return { criado: true, pct: Math.round(acumulado), marcos, iniciadoEm };
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
    uploadFoto, registrarLancamento, desflegarItem, resumoProgresso, resumoProgressoBatch,
  };
}());
