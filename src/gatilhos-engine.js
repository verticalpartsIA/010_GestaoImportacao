/* ============================================================
   gatilhos-engine.js
   Motor de "Gatilhos & Prazo" — cada nó nasce automaticamente quando
   o evento anterior da cadeia acontece (EventosFluxo), e fecha quando
   o próprio evento dele acontece. Cadeia de tarefas por Nº da Cotação,
   igual dependência de tarefas em ProjectLibre/MS Project — hoje só
   usamos TI (FS, término-início) e II (SS, início-início); ver
   instrucaocompra.md na raiz do repo para o desenho completo e os
   tipos de relacionamento ainda não usados (TT/IT).

   Prazos (SLA_HORAS) são os números reais passados pelo usuário —
   não são mais placeholder. `due_date` (coluna `date`, legado) fica
   como derivado pra CSV/ordenação; `prazo_em` (timestamptz) é a
   referência de verdade pra cálculo de Gantt em horas.

   window.GatilhosEngine = { NODES, SLA_HORAS, LEMBRETES, onEvento,
                              verificarPrazos }
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  const SLA_HORAS = {
    SLA_FORNECEDOR: 48,
    PRECIFICACAO: 5,
    AGUARDA_CLIENTE: 15 * 24,      // 360h
    CONTRATO_ENVIADO: 24,
    PROJETO_ENVIADO: 24,
    AGUARDA_ASSINATURA: 5 * 24,    // 120h
    AGUARDA_BOLETO: 3 * 24,        // 72h
    AVAL_PAGAMENTO: 4,
    NEGOCIACAO_COMPRA: 7 * 24,     // 168h
    EMBARQUE_CHEGADA: 90 * 24,     // 2160h
  };

  /* Lembretes de cobrança — nascem como um gatilho-filho (evento_key
     'LEMBRETE__<chaveDoPai>') quando o nó pai passa de X horas sem
     fechar. Verificados sob demanda em verificarPrazos() — não há
     cron neste projeto, então só atualiza quando alguém abre a tela
     "Gatilhos & Prazo" (ver instrucaocompra.md). */
  const LEMBRETES = {
    AGUARDA_CLIENTE:     { apósHoras: 7 * 24,  label: 'Cobrar cliente sobre a Proposta' },
    AGUARDA_ASSINATURA:  { apósHoras: 3 * 24,  label: 'Cobrar cliente sobre a assinatura do Contrato' },
  };

  /* Cada nó: { key, label, predecessores:[{key, rel}], nasce, fecha,
     fechamentoTipo, condicaoNasce(detalhe) opcional para branches. */
  const NODES = [
    { key: 'FORMULARIO', label: 'Formulário preenchido',
      predecessores: [], nasce: 'FORMULARIO_PREENCHIDO', fecha: 'COTACAO_ENVIADA_FORNECEDOR',
      fechamentoTipo: 'automatico' },

    { key: 'SLA_FORNECEDOR', label: 'Aguardando resposta do Fornecedor (SLA 48h)',
      predecessores: [{ key: 'FORMULARIO', rel: 'FS' }],
      nasce: 'COTACAO_ENVIADA_FORNECEDOR', fecha: 'FORNECEDOR_RESPONDEU',
      fechamentoTipo: 'automatico' },

    { key: 'PRECIFICACAO', label: 'Financeiro precificando (SLA 5h)',
      predecessores: [{ key: 'SLA_FORNECEDOR', rel: 'FS' }],
      nasce: 'FORNECEDOR_RESPONDEU', fecha: 'PROPOSTA_ELABORADA',
      fechamentoTipo: 'automatico' },

    { key: 'PROPOSTA_PREP', label: 'Proposta pronta — aguardando envio manual',
      predecessores: [{ key: 'PRECIFICACAO', rel: 'FS' }],
      nasce: 'PROPOSTA_ELABORADA', fecha: 'PROPOSTA_ENVIADA',
      fechamentoTipo: 'manual' },

    { key: 'AGUARDA_CLIENTE', label: 'Aguardando resposta do Cliente (SLA 15 dias)',
      predecessores: [{ key: 'PROPOSTA_PREP', rel: 'FS' }],
      nasce: 'PROPOSTA_ENVIADA', fecha: 'CLIENTE_RESPONDEU_PROPOSTA',
      fechamentoTipo: 'automatico' },

    { key: 'CONTRATO_ENVIADO', label: 'Contrato enviado ao Cliente (SLA 24h)',
      predecessores: [{ key: 'AGUARDA_CLIENTE', rel: 'FS' }],
      nasce: 'CLIENTE_RESPONDEU_PROPOSTA',
      condicaoNasce: (detalhe) => (detalhe || {}).resposta === 'aprovada',
      fecha: 'CONTRATO_VENDA_ENVIADO', fechamentoTipo: 'automatico' },

    { key: 'PROJETO_ENVIADO', label: 'Projeto de Engenharia enviado ao Cliente (SLA 24h)',
      predecessores: [{ key: 'AGUARDA_CLIENTE', rel: 'FS' }, { key: 'CONTRATO_ENVIADO', rel: 'SS' }],
      nasce: 'CLIENTE_RESPONDEU_PROPOSTA',
      condicaoNasce: (detalhe) => (detalhe || {}).resposta === 'aprovada',
      fecha: 'PROJETO_ELEVADOR_FINALIZADO', fechamentoTipo: 'automatico' },

    { key: 'AGUARDA_ASSINATURA', label: 'Aguardando assinatura do Contrato (SLA 5 dias)',
      predecessores: [{ key: 'CONTRATO_ENVIADO', rel: 'FS' }],
      nasce: 'CONTRATO_VENDA_ENVIADO', fecha: 'CONTRATO_VENDA_ASSINADO',
      fechamentoTipo: 'automatico' },

    { key: 'AGUARDA_BOLETO', label: 'Aguardando pagamento do Boleto (SLA 3 dias)',
      predecessores: [{ key: 'AGUARDA_ASSINATURA', rel: 'FS' }],
      nasce: 'CONTRATO_VENDA_ASSINADO', fecha: 'SINAL_PAGO',
      fechamentoTipo: 'manual' /* Financeiro clica "Boleto pago" — AvalFinanceiroStore.confirmarSinal() */ },

    { key: 'AVAL_PAGAMENTO', label: 'Aguardando Aval de Pagamento (SLA 4h)',
      predecessores: [{ key: 'AGUARDA_BOLETO', rel: 'FS' }],
      nasce: 'SINAL_PAGO', fecha: 'AVAL_PAGAMENTO_CONFIRMADO',
      fechamentoTipo: 'manual' /* Financeiro clica "Dar Aval de Pagamento" — confirmarAvalPagamento() */ },

    { key: 'COMPRA_LIBERADA', label: 'Compra ao Fornecedor liberada',
      predecessores: [{ key: 'AVAL_PAGAMENTO', rel: 'FS' }],
      nasce: 'AVAL_PAGAMENTO_CONFIRMADO', fecha: 'COMPRA_FORNECEDOR_INICIADA',
      fechamentoTipo: 'automatico' /* botão "Decidir Comprar" já existente em Cotação a Fornecedor */ },

    { key: 'NEGOCIACAO_COMPRA', label: 'Negociação e Compra do Produto (SLA 7 dias)',
      predecessores: [{ key: 'COMPRA_LIBERADA', rel: 'FS' }],
      nasce: 'COMPRA_FORNECEDOR_INICIADA', fecha: 'COMPRA_FORNECEDOR_CONFIRMADA',
      fechamentoTipo: 'automatico' },

    { key: 'EMBARQUE_CHEGADA', label: 'Embarque até chegada no Brasil (SLA 90 dias)',
      predecessores: [{ key: 'NEGOCIACAO_COMPRA', rel: 'FS' }],
      nasce: 'COMPRA_FORNECEDOR_CONFIRMADA', fecha: null /* ainda sem evento — logística não é wired em eventos_fluxo */,
      fechamentoTipo: 'manual' },
  ];

  function nodeByKey(key) { return NODES.find((n) => n.key === key); }

  function gtId(numeroCotacao, key) { return `GT-${numeroCotacao}-${key}`; }

  async function getRow(numeroCotacao, key) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('gatilhos').select('*')
      .eq('numero_cotacao', numeroCotacao).eq('evento_key', key).maybeSingle();
    return data || null;
  }

  async function fecharNo(numeroCotacao, node, statusFinal) {
    const c = sb(); if (!c) return null;
    const row = await getRow(numeroCotacao, node.key);
    if (!row || row.concluido_em) return row; // já fechado ou nunca nasceu
    const now = new Date().toISOString();
    const { data, error } = await c.from('gatilhos').update({
      concluido_em: now, status: statusFinal || 'ok',
    }).eq('id', row.id).select().single();
    if (error) { console.warn('[GatilhosEngine] fecharNo falhou', error); return row; }
    return data;
  }

  async function nascerNo(numeroCotacao, node, predecessorId) {
    const c = sb(); if (!c) return null;
    const existente = await getRow(numeroCotacao, node.key);
    if (existente) return existente; // idempotente
    const now = new Date();
    const nowIso = now.toISOString();
    const slaHoras = SLA_HORAS[node.key] ?? null;
    const prazoEm = slaHoras != null ? new Date(now.getTime() + slaHoras * 3600000) : null;
    const relPrincipal = (node.predecessores[0] || {}).rel || 'FS';
    const row = {
      id: gtId(numeroCotacao, node.key),
      numero_cotacao: numeroCotacao,
      evento_key: node.key,
      trigger_name: node.label,
      predecessor_id: predecessorId || null,
      tipo_relacionamento: relPrincipal,
      origem: 'automatico',
      conclusao_tipo: node.fechamentoTipo,
      nascido_em: nowIso,
      prazo_em: prazoEm ? prazoEm.toISOString() : null,
      due_date: prazoEm ? prazoEm.toISOString().slice(0, 10) : null,
      days_left: slaHoras != null ? Math.round(slaHoras / 24) : null,
      status: 'pendente',
      chain: [],
    };
    const { data, error } = await c.from('gatilhos').insert(row).select().single();
    if (error) { console.warn('[GatilhosEngine] nascerNo falhou', error); return null; }
    return data;
  }

  /* onEvento({ evento, numeroCotacao, detalhe })
     Chamada única disparada por EventosFluxo.registrar(). Nunca derruba
     o fluxo principal por falha — é automação, não obrigação transacional. */
  async function onEvento({ evento, numeroCotacao, detalhe } = {}) {
    if (numeroCotacao == null) return;
    try {
      /* 1) fecha quem tiver esse evento como fechamento */
      for (const node of NODES) {
        if (node.fecha !== evento) continue;
        await fecharNo(numeroCotacao, node, 'ok');
      }

      /* Caso especial: cliente recusou a proposta — encerra a cadeia
         em AGUARDA_CLIENTE sem abrir Contrato/Projeto. */
      if (evento === 'CLIENTE_RESPONDEU_PROPOSTA' && (detalhe || {}).resposta === 'recusada') {
        await fecharNo(numeroCotacao, nodeByKey('AGUARDA_CLIENTE'), 'encerrado');
      }

      /* 2) nasce quem tiver esse evento como nascimento */
      for (const node of NODES) {
        if (node.nasce !== evento) continue;
        if (node.condicaoNasce && !node.condicaoNasce(detalhe)) continue;
        const predKey = (node.predecessores[0] || {}).key;
        const predRow = predKey ? await getRow(numeroCotacao, predKey) : null;
        await nascerNo(numeroCotacao, node, predRow ? predRow.id : null);
      }
    } catch (e) {
      console.warn('[GatilhosEngine] onEvento falhou', e);
    }
  }

  /* verificarPrazos(rows) — chamado ao carregar a tela "Gatilhos & Prazo"
     (não há cron neste projeto). Recebe os gatilhos automáticos já
     carregados em memória, nasce lembretes de cobrança quando o prazo
     do nó pai já passou do limite parcial (LEMBRETES), e marca
     AGUARDA_CLIENTE como "revisao_necessaria" quando estourar os 15
     dias sem fechar. Retorna true se algo mudou (chamador deve
     recarregar). */
  async function verificarPrazos(rows) {
    const c = sb(); if (!c) return false;
    let mudou = false;
    const abertos = (rows || []).filter((r) =>
      r.origem === 'automatico' && !r.concluido_em && !String(r.evento_key || '').startsWith('LEMBRETE__'));

    for (const r of abertos) {
      const nascidoEm = r.nascido_em ? new Date(r.nascido_em).getTime() : null;
      if (!nascidoEm) continue;
      const horasDecorridas = (Date.now() - nascidoEm) / 3600000;

      const lembrete = LEMBRETES[r.evento_key];
      if (lembrete && horasDecorridas >= lembrete.apósHoras) {
        const chaveLembrete = 'LEMBRETE__' + r.evento_key;
        const jaExiste = (rows || []).some((x) => x.numero_cotacao === r.numero_cotacao && x.evento_key === chaveLembrete);
        if (!jaExiste) {
          const { error } = await c.from('gatilhos').insert({
            id: gtId(r.numero_cotacao, chaveLembrete),
            numero_cotacao: r.numero_cotacao,
            evento_key: chaveLembrete,
            trigger_name: lembrete.label,
            predecessor_id: r.id,
            tipo_relacionamento: 'FS',
            origem: 'automatico',
            conclusao_tipo: 'manual',
            nascido_em: new Date().toISOString(),
            status: 'atencao',
            chain: [],
          });
          if (error) console.warn('[GatilhosEngine] lembrete falhou', error);
          else mudou = true;
        }
      }

      if (r.evento_key === 'AGUARDA_CLIENTE' && horasDecorridas >= SLA_HORAS.AGUARDA_CLIENTE && r.status !== 'revisao_necessaria') {
        const { error } = await c.from('gatilhos').update({ status: 'revisao_necessaria' }).eq('id', r.id);
        if (error) console.warn('[GatilhosEngine] revisão falhou', error);
        else mudou = true;
      }
    }
    return mudou;
  }

  /* Fecha um gatilho-filho de lembrete manualmente ("marquei que já cobrei o cliente"). */
  async function fecharLembrete(id) {
    const c = sb(); if (!c) return null;
    const { data, error } = await c.from('gatilhos').update({
      concluido_em: new Date().toISOString(), status: 'ok',
    }).eq('id', id).select().single();
    if (error) { console.warn('[GatilhosEngine] fecharLembrete falhou', error); return null; }
    return data;
  }

  window.GatilhosEngine = { NODES, SLA_HORAS, LEMBRETES, onEvento, verificarPrazos, fecharLembrete };
}());
