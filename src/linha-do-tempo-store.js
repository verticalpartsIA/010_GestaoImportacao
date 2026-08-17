/* ============================================================
   linha-do-tempo-store.js
   Linha do Tempo da Cotação (15/08) — junta tudo que já aconteceu numa
   cotação, de todas as tabelas onde já existe data real, num só lugar
   ordenado. NÃO cria uma tabela de eventos nova pra cada módulo — cada
   tabela já sabe quando aquilo aconteceu (data_abertura, etd_original,
   decidido_em, criado_em...), aqui só se lê e se junta.

   O Nº Cotação (numero_cotacao) é o "Ator principal": nasce sozinho no
   Formulário (sequência do banco, nunca editável — ver
   formulario-elevador-store.js) e é a chave que amarra tudo daqui pra
   frente: P.I., Embarque, Dossiê da Obra, Vistorias, Decisões Gerenciais.

   window.LinhaDoTempoStore = { obterPorCotacao, resolverNumero }
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Aceita "902" ou "VPEL-EL0902" (o Master ID formatado) — o usuário
     pode digitar de qualquer jeito. */
  function resolverNumero(raw) {
    if (window.MasterIdEngine) return window.MasterIdEngine.parseNumeroCotacao(raw);
    const n = parseInt(String(raw || '').replace(/\D/g, ''), 10);
    return isNaN(n) ? null : n;
  }

  /* Papel por status_to do STATUS_FLOW (dossier-store.js) — cada transição
     de status do Dossiê aponta pra quem tipicamente faz aquele passo.
     Cobre justamente os dois trechos que não tinham NENHUM outro rastro
     (Instalação e Manutenção preventiva) — desde que a tela real avance o
     status do Dossiê por essas etapas, quando existir. */
  const PAPEL_STATUS_DOSSIER = {
    'Lead qualificado': 'Vendedor', 'Dossier criado': 'Vendedor',
    'Análise técnica': 'Engenharia', 'Precificação': 'Financeiro',
    'Proposta enviada': 'Vendedor', 'Contrato assinado': 'Cliente',
    'Importação': 'Importação', 'Homologação instalador': 'RH',
    'Instalação': 'Instalador', 'DataBook': 'Engenharia',
    'Entregue': 'Cliente', 'Manutenção preventiva': 'Empresa de Manutenção',
  };

  async function obterPorCotacao(numeroCotacao) {
    const c = sb();
    const vazio = { numeroCotacao, dossier: null, itens: [] };
    if (!c || numeroCotacao == null) return vazio;

    const itens = [];
    const add = (ts, papel, acao, ator, fonte, detalhe) => {
      if (!ts) return;
      itens.push({ ts, papel, acao, ator: ator || papel, fonte, detalhe: detalhe || null });
    };

    /* 1. Eventos do funil comercial (Formulário → Engenharia) */
    if (window.EventosFluxo) {
      const eventos = await window.EventosFluxo.listarPorCotacao(numeroCotacao);
      eventos.forEach((e) => add(e.created_at, e.ator_papel || e.modulo, e.evento, e.ator_nome, e.modulo, e.detalhe));
    }

    /* 2. Dossiê da Obra + histórico de status + vistorias (só existe se o
       Lead já virou Dossiê) */
    const { data: dossier } = await c.from('dossier_obra').select('*').eq('numero_cotacao', numeroCotacao).maybeSingle();
    if (dossier) {
      const { data: historico } = await c.from('dossier_history').select('*').eq('dossier_id', dossier.id).order('created_at', { ascending: true });
      (historico || []).forEach((h) => add(h.created_at, PAPEL_STATUS_DOSSIER[h.status_to] || 'Engenharia', `Status: ${h.status_from || '—'} → ${h.status_to}${h.notes ? ' — ' + h.notes : ''}`, h.actor, 'Dossiê da Obra'));

      const { data: vistorias } = await c.from('vistorias_obras').select('*').eq('obra_id', dossier.id).eq('status', 'concluida');
      (vistorias || []).forEach((v) => add(v.data_conclusao || v.atualizado_em, 'Engenharia', `Vistoria ${v.numero_fase ? 'Fase ' + v.numero_fase : 'avulsa'} concluída`, v.vistoriador, 'Vistoria'));

      if (dossier.equipamento_entregue_em) {
        add(dossier.equipamento_entregue_em, 'Cliente', 'Equipamento recebido na obra' + (dossier.equipamento_qtd_pessoas_recebimento ? ` (${dossier.equipamento_qtd_pessoas_recebimento} pessoa(s))` : ''), dossier.equipamento_recebido_por, 'Dossiê da Obra');
      }

      const { data: checklistItens } = await c.from('instalacao_checklist_itens').select('*').eq('dossier_id', dossier.id).eq('status', 'concluido');
      (checklistItens || []).forEach((it) => add(it.concluido_em, 'Instalador', `Instalação — ${it.etapa}`, it.concluido_por, 'Cronograma de Instalação'));
    }

    /* 3. Decisões gerenciais (CEO/RH/Gestor) — aprovadas ou reprovadas */
    const decisoes = await window.DecisoesStore.listarPorCotacao(numeroCotacao);
    const decisoesDossier = dossier ? await window.DecisoesStore.listarPorDossier(dossier.id) : [];
    [...decisoes, ...decisoesDossier].forEach((d) => {
      if (d.status !== 'aprovada' && d.status !== 'reprovada') return;
      const papel = window.DecisoesStore.PAPEL_LABEL[d.papel_requerido] || 'Gestão';
      const verbo = d.status === 'aprovada' ? 'aprovou' : 'reprovou';
      add(d.decidido_em, papel, `${papel} ${verbo}: ${d.tipo.replace(/_/g, ' ')}`, d.decidido_por, 'Central de Decisões', d.motivo ? { motivo: d.motivo } : null);
    });

    /* 4. P.I. — abertura e pagamentos ao fornecedor */
    const { data: pis } = await c.from('pi_importacao').select('*').eq('numero_cotacao', numeroCotacao);
    (pis || []).forEach((pi) => {
      add(pi.data_abertura, 'Importação', `P.I. ${pi.numero_pi} aberta`, null, 'P.I.');
      add(pi.data_primeiro_pagamento, 'Financeiro', `1º pagamento ao fornecedor (P.I. ${pi.numero_pi})`, null, 'P.I.');
      add(pi.data_segundo_pagamento, 'Financeiro', `2º pagamento ao fornecedor (P.I. ${pi.numero_pi})`, null, 'P.I.');
    });

    /* 5. Embarque — trânsito marítimo, aduaneiro, entrega terrestre */
    const { data: embarques } = await c.from('embarques_importacao').select('*').eq('numero_cotacao', numeroCotacao);
    (embarques || []).forEach((e) => {
      add(e.etd_atual || e.etd_original, 'Transporte marítimo', 'Navio saiu do porto de origem', null, 'Embarque');
      add(e.eta_santos, 'Transporte marítimo', 'Navio chegou no porto de Santos', null, 'Embarque');
      add(e.data_registro_di, 'Despachante', 'DUIMP registrada', null, 'Embarque');
      add(e.conferencia_data, 'Despachante', `Conferência aduaneira: ${e.conferencia_status || '—'}`, null, 'Embarque');
      add(e.data_entrega, 'Transporte terrestre', 'Equipamento entregue no endereço do cliente', null, 'Embarque');
    });

    itens.sort((a, b) => new Date(a.ts) - new Date(b.ts));
    return { numeroCotacao, dossier: dossier || null, itens };
  }

  window.LinhaDoTempoStore = { obterPorCotacao, resolverNumero };
}());
