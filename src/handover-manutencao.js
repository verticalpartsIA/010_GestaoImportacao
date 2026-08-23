/* ============================================================
   handover-manutencao.js
   Gestão de entrega, pós-venda e transição para Escamax
   window.HandoverManutencao — expõe funções de handover
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  const CHECKLIST_ENTREGA = [
    { id: 'equipamento_testado', label: 'Equipamento testado e funcionando', categoria: 'tecnico' },
    { id: 'documentacao_entregue', label: 'Documentação e manuais entregues', categoria: 'documentacao' },
    { id: 'databook_assinado', label: 'Data Book assinado pelo cliente', categoria: 'documentacao' },
    { id: 'certificados_entregues', label: 'Certificados e ART entregues', categoria: 'legal' },
    { id: 'treinamento_realizado', label: 'Treinamento do cliente realizado', categoria: 'operacional' },
    { id: 'contato_suporte_informado', label: 'Informação de suporte 24/7 confirmada', categoria: 'operacional' },
    { id: 'garantia_explicada', label: 'Período de garantia explicado', categoria: 'comercial' },
    { id: 'assinatura_cliente', label: 'Assinatura do cliente no Termo de Entrega', categoria: 'legal' },
  ];

  /* Fonte trocada de `projetos` (legada, desconectada — issue #274) pra
     `dossier_obra` (esteira real). Coluna `handover` (jsonb) criada na
     migração add_handover_to_dossier_obra, mesmo padrão da coluna
     `vistoria` que já existe na mesma tabela. Achado "Importante" da
     auditoria de código. */
  async function registrarHandover(dossierId, clienteNome, dadosHandover) {
    const c = sb();
    if (!c || !dossierId) throw new Error('dossierId inválido');

    const handover = {
      dossier_id: dossierId,
      cliente_nome: clienteNome,
      data_entrega: new Date().toISOString(),
      checklists_concluidos: dadosHandover.checklists || [],
      periodo_garantia_meses: dadosHandover.periodoGarantia || 12,
      data_fim_garantia: new Date(Date.now() + (dadosHandover.periodoGarantia || 12) * 30 * 24 * 60 * 60 * 1000).toISOString(),
      contato_suporte: dadosHandover.contatoSuporte || '+55 11 xxxx-xxxx',
      email_suporte: dadosHandover.emailSuporte || 'suporte@verticalparts.com.br',
      escamax_transferido: false,
      data_transferencia_escamax: null,
      observacoes: dadosHandover.observacoes || '',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    const { data: dossier, error } = await c.from('dossier_obra')
      .update({ handover })
      .eq('id', dossierId).select('numero_cotacao, building_name').single();

    if (error) throw error;
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'HANDOVER_CONCLUIDO', numeroCotacao: dossier?.numero_cotacao ?? null,
      alvoLabel: dossier?.building_name || clienteNome, alvoId: dossierId,
    });
    return handover;
  }

  async function obterHandover(dossierId) {
    const c = sb();
    if (!c || !dossierId) return null;

    const { data } = await c.from('dossier_obra')
      .select('handover')
      .eq('id', dossierId)
      .single();

    return data?.handover || null;
  }

  async function transferirParaEscamax(dossierId) {
    const c = sb();
    if (!c || !dossierId) throw new Error('dossierId inválido');

    const { data } = await c.from('dossier_obra')
      .select('handover')
      .eq('id', dossierId)
      .single();

    const handover = data?.handover;
    if (handover) {
      handover.escamax_transferido = true;
      handover.data_transferencia_escamax = new Date().toISOString();

      const { data: proj, error } = await c.from('dossier_obra')
        .update({ handover })
        .eq('id', dossierId).select('numero_cotacao, building_name').single();

      if (error) throw error;
      if (window.EventosFluxo) window.EventosFluxo.registrar({
        evento: 'POS_VENDA_ATIVADO', numeroCotacao: proj?.numero_cotacao ?? null,
        alvoLabel: proj?.building_name, alvoId: dossierId,
      });
    }

    return handover;
  }

  function getProgressoChecklist(checklistsConcluidos) {
    const total = CHECKLIST_ENTREGA.length;
    const concluidos = (checklistsConcluidos || []).length;
    return Math.round((concluidos / total) * 100);
  }

  function fmtData(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  function tempoRestanteGarantia(dataFimGarantia) {
    if (!dataFimGarantia) return null;
    const agora = new Date();
    const fim = new Date(dataFimGarantia);
    const diasRestantes = Math.ceil((fim - agora) / (1000 * 60 * 60 * 24));
    return diasRestantes > 0 ? diasRestantes : 0;
  }

  window.HandoverManutencao = {
    CHECKLIST_ENTREGA,
    registrarHandover,
    obterHandover,
    transferirParaEscamax,
    getProgressoChecklist,
    fmtData,
    tempoRestanteGarantia,
  };
})();
