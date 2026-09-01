/* ============================================================
   contrato-instalador-parcelas-store.js
   Trilha B (01/09) — controle de pagamento das parcelas do Contrato
   Instalador, ligado ao progresso real da instalação (Cronograma de
   Instalação, ver instalacao-checklist-store.js).

   Parcelas são geradas automaticamente na criação do contrato
   (contrato-instalador-store.js:createDraft), a partir de
   formState.formaPagamento — mesmas regras de texto usadas em
   contrato-instalador-engine.js:buildPagamentoItems:
     '2' → 2 parcelas: início dos trabalhos / finalização
     '3' → 3 parcelas: início / metade da execução / finalização
     outro (personalizado) → uma parcela por item de formState.parcelas,
       sem gatilho automático (Financeiro libera na mão)

   "Liberada" = o marco operacional correspondente já foi atingido (todos
   os dossiê_ids do contrato bateram o evento) — não significa paga, só
   que já pode ser paga. "paga" é sempre uma confirmação manual do
   Financeiro (dinheiro saindo de conta não é algo que o sistema controla
   sozinho).

   window.ContratoInstaladorParcelasStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  function gtId() { return 'CIP-' + Date.now().toString().slice(-6) + '-' + Math.random().toString(36).slice(2, 6); }

  /* Sem dossiê vinculado ao contrato, não há evento nenhum que vá liberar
     a parcela sozinho — nasce já liberada, senão travaria o Financeiro
     pra sempre esperando um gatilho que nunca dispara. */
  async function criarParcelas(contratoId, formState) {
    const c = sb(); if (!c) return;
    const valor = window.CI.moedaParaNumero(formState.valorTotal) || 0;
    const temDossier = (formState.dossierIds || []).length > 0;
    let rows = [];

    if (formState.formaPagamento === '2') {
      const metade = valor / 2;
      rows = [
        { numero: 1, descricao: 'Início dos trabalhos', valor: metade, gatilho_evento: 'INSTALACAO_INICIADA' },
        { numero: 2, descricao: 'Finalização do serviço', valor: metade, gatilho_evento: 'INSTALACAO_CONCLUIDA' },
      ];
    } else if (formState.formaPagamento === '3') {
      const terco = valor / 3;
      rows = [
        { numero: 1, descricao: 'Início dos trabalhos', valor: terco, gatilho_evento: 'INSTALACAO_INICIADA' },
        { numero: 2, descricao: 'Metade da execução dos serviços', valor: terco, gatilho_evento: 'INSTALACAO_METADE_EXECUCAO' },
        { numero: 3, descricao: 'Finalização do serviço', valor: terco, gatilho_evento: 'INSTALACAO_CONCLUIDA' },
      ];
    } else {
      rows = (formState.parcelas || []).map((p, i) => ({
        numero: i + 1,
        descricao: (p.descricao && p.descricao.trim()) || `Parcela ${i + 1}`,
        valor: window.CI.moedaParaNumero(p.valor) || 0,
        gatilho_evento: null,
      }));
    }
    if (!rows.length) return;

    const insertRows = rows.map((r) => ({
      id: gtId(), contrato_id: contratoId, numero: r.numero, descricao: r.descricao, valor: r.valor,
      gatilho_evento: r.gatilho_evento,
      liberada: !temDossier || !r.gatilho_evento,
      liberada_em: (!temDossier || !r.gatilho_evento) ? new Date().toISOString() : null,
      status: 'pendente',
    }));
    const { error } = await c.from('contrato_instalador_parcelas').insert(insertRows);
    if (error) console.warn('[ContratoInstaladorParcelasStore] criarParcelas falhou', error);
  }

  async function listarParcelas(contratoId) {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('contrato_instalador_parcelas').select('*').eq('contrato_id', contratoId).order('numero');
    if (error) { console.warn('[ContratoInstaladorParcelasStore] listarParcelas falhou', error); return []; }
    return data || [];
  }

  /* Pra tela do Financeiro — traz o contrato junto (nome do instalador, nº doc). */
  async function listarTodasComContrato() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('contrato_instalador_parcelas')
      .select('*, contratos_instalador(numero_documento, contratada_nome, dossier_ids)')
      .order('criado_em', { ascending: false });
    if (error) { console.warn('[ContratoInstaladorParcelasStore] listarTodasComContrato falhou', error); return []; }
    return data || [];
  }

  async function marcarPaga(parcelaId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const user = window.__VP_USER || {};
    const { error } = await c.from('contrato_instalador_parcelas').update({
      status: 'paga', pago_em: new Date().toISOString(), pago_por: user.nome || user.email || null,
    }).eq('id', parcelaId);
    if (error) throw error;
  }

  async function reabrirParcela(parcelaId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('contrato_instalador_parcelas').update({ status: 'pendente', pago_em: null, pago_por: null }).eq('id', parcelaId);
    if (error) throw error;
  }

  /* Todos os dossiê_ids do contrato já bateram o evento? Mesma fonte de
     verdade (eventos_fluxo) que gatilhos-engine.js usa — não duplica
     estado próprio. */
  async function _todosBateram(dossierIds, eventoKey) {
    const c = sb();
    const label = window.EventosFluxo?.EVENTOS?.[eventoKey]?.label;
    if (!label || !dossierIds.length) return false;
    const { data } = await c.from('eventos_fluxo').select('alvo_id').eq('evento', label).in('alvo_id', dossierIds);
    const bateram = new Set((data || []).map((r) => r.alvo_id));
    return dossierIds.every((id) => bateram.has(id));
  }

  /* Chamada por eventos-fluxo-store.js:registrar() a cada um dos 3
     eventos de instalação (INSTALACAO_INICIADA/METADE_EXECUCAO/CONCLUIDA)
     — libera a parcela correspondente em todo contrato que cobre esse
     dossiê, quando TODOS os dossiês do contrato já bateram aquele marco
     (pagamento é pela obra inteira do contrato, não equipamento a
     equipamento — um contrato pode cobrir vários elevadores da mesma
     obra sob o mesmo instalador). Idempotente: só mexe em parcela ainda
     não liberada. */
  async function verificarLiberacaoParcelas(dossierId, eventoKey) {
    const c = sb(); if (!c || !dossierId) return;
    try {
      const { data: contratos } = await c.from('contratos_instalador').select('id, dossier_ids').contains('dossier_ids', [dossierId]);
      for (const contrato of contratos || []) {
        const { data: parcela } = await c.from('contrato_instalador_parcelas')
          .select('id').eq('contrato_id', contrato.id).eq('gatilho_evento', eventoKey).eq('liberada', false).maybeSingle();
        if (!parcela) continue;
        const ok = await _todosBateram(contrato.dossier_ids, eventoKey);
        if (!ok) continue;
        await c.from('contrato_instalador_parcelas').update({ liberada: true, liberada_em: new Date().toISOString() }).eq('id', parcela.id);
      }
    } catch (e) { console.warn('[ContratoInstaladorParcelasStore] verificarLiberacaoParcelas falhou', e); }
  }

  /* Pra badge "Obra Concluída" (cadastro-instaladores.jsx): dado um lote
     de dossierIds, resume por dossiê se tem contrato vinculado e se está
     100% pago. Sem contrato vinculado (form antigo/manual), fica
     temContrato:false — o badge cai pro que já existia (Trilha A). */
  async function resumoPagamentoPorDossier(dossierIds) {
    const c = sb(); if (!c || !dossierIds || !dossierIds.length) return {};
    const { data: contratos } = await c.from('contratos_instalador').select('id, dossier_ids').overlaps('dossier_ids', dossierIds);
    const ids = (contratos || []).map((ct) => ct.id);
    let parcelas = [];
    if (ids.length) {
      const { data } = await c.from('contrato_instalador_parcelas').select('contrato_id, status').in('contrato_id', ids);
      parcelas = data || [];
    }
    const porDossier = {};
    dossierIds.forEach((id) => {
      const contratosDoDossier = (contratos || []).filter((ct) => (ct.dossier_ids || []).includes(id));
      if (!contratosDoDossier.length) { porDossier[id] = { temContrato: false, tudoPago: false }; return; }
      const parcelasDoDossier = parcelas.filter((p) => contratosDoDossier.some((ct) => ct.id === p.contrato_id));
      const tudoPago = parcelasDoDossier.length > 0 && parcelasDoDossier.every((p) => p.status === 'paga');
      porDossier[id] = { temContrato: true, tudoPago };
    });
    return porDossier;
  }

  window.ContratoInstaladorParcelasStore = {
    criarParcelas, listarParcelas, listarTodasComContrato,
    marcarPaga, reabrirParcela, verificarLiberacaoParcelas, resumoPagamentoPorDossier,
  };
}());
