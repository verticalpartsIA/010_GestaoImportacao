/* ============================================================
   eventos-fluxo-store.js
   Trilha genérica do fluxo operacional — Formulário → Cotação a
   Fornecedor → Proposta → Cliente — correlacionada pelo Nº da Cotação.
   Alimenta a tabela eventos_fluxo e, a cada registro, aciona o
   GatilhosEngine (gatilhos-engine.js) — que nasce/fecha os nós da
   cadeia de "Gatilhos & Prazo" (tabela `gatilhos`) automaticamente.
   Não é o log de auditoria (isso é o VPLog) — aqui é só "o que já
   aconteceu nesta cotação, nesta ordem".
   window.EventosFluxo = { EVENTOS, registrar, listarPorCotacao }
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Catálogo fechado de eventos — todo call-site usa uma destas chaves,
     pra nunca divergir o texto entre módulos diferentes. */
  /* `papel` = quem tipicamente faz essa ação (pra Linha do Tempo da
     Cotação) — não é sempre a mesma pessoa, mas é o papel padrão do
     evento. Quando o usuário logado no momento do registro é conhecido,
     `ator_nome` grava o nome real também; `papel` fica como rótulo fixo
     de qualquer forma (é o que o "personagem" faz na história, mesmo
     trocando o ator). */
  const EVENTOS = {
    FORMULARIO_PREENCHIDO:       { modulo: 'Formulário Elevador',     label: 'Formulário preenchido',                        papel: 'Vendedor' },
    COTACAO_ENVIADA_FORNECEDOR:  { modulo: 'Cotação a Fornecedor',    label: 'Cotação enviada ao fornecedor',                papel: 'Vendedor' },
    FORNECEDOR_RESPONDEU:        { modulo: 'Cotação a Fornecedor',    label: 'Fornecedor respondeu',                         papel: 'Fornecedor' },
    PROPOSTA_ELABORADA:          { modulo: 'Proposta Comercial',      label: 'Proposta elaborada',                           papel: 'Financeiro' },
    PROPOSTA_ENVIADA:            { modulo: 'Proposta Comercial',      label: 'Proposta enviada ao cliente',                  papel: 'Vendedor' },
    CLIENTE_RESPONDEU_PROPOSTA:  { modulo: 'Proposta Comercial',      label: 'Cliente respondeu a proposta',                 papel: 'Cliente' },
    FINANCEIRO_CONSULTOU_SCORE:  { modulo: 'Aval Financeiro',         label: 'Financeiro consultou o score do cliente',      papel: 'Financeiro' },
    FINANCEIRO_APROVOU_VENDA:    { modulo: 'Aval Financeiro',         label: 'Financeiro deu o aval pra vender',             papel: 'Financeiro' },
    FINANCEIRO_REPROVOU_VENDA:   { modulo: 'Aval Financeiro',         label: 'Financeiro reprovou a venda',                  papel: 'Financeiro' },
    CONTRATO_VENDA_ENVIADO:      { modulo: 'Contrato de Venda',       label: 'Contrato de venda enviado',                    papel: 'Jurídico' },
    CONTRATO_VENDA_ASSINADO:     { modulo: 'Contrato de Venda',       label: 'Contrato de venda assinado',                   papel: 'Cliente' },
    SINAL_PAGO:                  { modulo: 'Aval Financeiro',         label: 'Boleto pago pelo cliente',                     papel: 'Cliente' },
    AVAL_PAGAMENTO_CONFIRMADO:   { modulo: 'Aval Financeiro',         label: 'Financeiro deu o Aval de Pagamento',           papel: 'Financeiro' },
    COMPRA_FORNECEDOR_INICIADA:  { modulo: 'Cotação a Fornecedor',    label: 'Compra do equipamento iniciada no fornecedor', papel: 'Importação' },
    COMPRA_FORNECEDOR_CONFIRMADA:{ modulo: 'Cotação a Fornecedor',    label: 'Compra do equipamento confirmada com o fornecedor', papel: 'Fornecedor' },
    PROJETO_ELEVADOR_FINALIZADO: { modulo: 'Engenharia',              label: 'Projeto de Elevadores finalizado',             papel: 'Engenharia' },

    /* ---- Extensão 23/08 — checklist completo de 73 etapas (Gatilhos.md).
       Itens 1-32 já cobertos acima; daqui pra baixo é Engenharia final,
       Compra/Embarque, Dossiê/Vistoria, RH/Instalador, Instalação,
       Documentação final. Ver comentário em gatilhos-engine.js NODES
       pra saber quais destes já têm ponto de disparo real no código e
       quais ainda não (fecha:null = evento existe, ninguém dispara). */
    FINANCEIRO_APROVOU_CEO:       { modulo: 'Aval Financeiro',        label: 'CEO aprovou',                                   papel: 'Financeiro' },
    FINANCEIRO_APROVOU_OWNER:     { modulo: 'Aval Financeiro',        label: 'Responsável pelo sistema aprovou',              papel: 'Financeiro' },
    PROJETO_ELEVADOR_CRIADO:      { modulo: 'Engenharia',             label: 'Projeto de Elevadores criado',                 papel: 'Engenharia' },
    PROJETO_APROVADO_CLIENTE:     { modulo: 'Engenharia',             label: 'Cliente aprovou o Projeto',                    papel: 'Cliente' },
    FICHA_TECNICA_CRIADA:         { modulo: 'Ficha Técnica',          label: 'Ficha técnica criada',                         papel: 'Engenharia' },
    PI_CRIADA:                    { modulo: 'P.I.',                   label: 'P.I. criada',                                  papel: 'Importação' },
    PAGAMENTO_FORNECEDOR_1_SOLICITADO:  { modulo: 'P.I.',             label: '1º pagamento ao fornecedor solicitado',        papel: 'Financeiro' },
    PAGAMENTO_FORNECEDOR_1_CONFIRMADO:  { modulo: 'P.I.',             label: '1º pagamento ao fornecedor confirmado',        papel: 'Financeiro' },
    CARGO_READY_CONFIRMADO:       { modulo: 'Embarques',              label: 'Cargo Ready confirmado',                       papel: 'Importação' },
    RFQ_FRETE_ENVIADO:            { modulo: 'RFQ',                    label: 'RFQ de frete enviado',                         papel: 'Importação' },
    AGENTE_CARGA_DEFINIDO:        { modulo: 'Embarques',              label: 'Agente de carga definido',                     papel: 'Importação' },
    EMBARQUE_CHEGOU_BRASIL:       { modulo: 'Embarques',              label: 'Embarque chegou no Brasil (canal aduaneiro atribuído)', papel: 'Importação' },
    EMBARQUE_ENTREGUE_OBRA:       { modulo: 'Embarques',              label: 'Equipamento entregue na obra (embarque)',      papel: 'Importação' },
    EMBARQUE_CRIADO:              { modulo: 'Embarques',              label: 'Embarque criado',                              papel: 'Importação' },
    EMBARQUE_ATUALIZADO:          { modulo: 'Embarques',              label: 'Embarque atualizado',                          papel: 'Importação' },
    DOSSIE_CRIADO:                { modulo: 'Dossiê da Obra',         label: 'Dossiê da Obra criado',                        papel: 'Engenharia' },
    VISTORIA_AGENDADA:            { modulo: 'Vistorias',              label: 'Vistoria agendada',                            papel: 'Engenharia' },
    VISTORIA_REALIZADA:           { modulo: 'Vistorias',              label: 'Vistoria realizada',                           papel: 'Engenharia' },
    PENDENCIA_RESOLVIDA:          { modulo: 'Dossiê da Obra',         label: 'Pendência resolvida',                          papel: 'Engenharia' },
    RECURSOS_OBRA_VERIFICADOS:    { modulo: 'Instalação',             label: 'Recursos da obra verificados',                 papel: 'Engenharia' },
    IMS_CONTRATADO:               { modulo: 'IMS',                    label: 'Recurso IMS contratado',                       papel: 'Importação' },
    INSTALADOR_HOMOLOGADO:        { modulo: 'RH Homologação',         label: 'Instalador homologado',                        papel: 'RH' },
    INSTALADOR_VINCULADO:         { modulo: 'Instalação',             label: 'Instalador vinculado à obra',                  papel: 'Engenharia' },
    CONTRATO_INSTALADOR_GERADO:   { modulo: 'Contrato Instalador',    label: 'Contrato Instalador gerado',                   papel: 'Jurídico' },
    CONTRATO_INSTALADOR_ASSINADO: { modulo: 'Contrato Instalador',    label: 'Contrato Instalador assinado',                 papel: 'Instalador' },
    EQUIPAMENTO_RECEBIDO:         { modulo: 'Instalação',             label: 'Equipamento recebido na obra',                 papel: 'Instalador' },
    EQUIPAMENTO_CONFERIDO:        { modulo: 'Instalação',             label: 'Equipamento conferido',                        papel: 'Instalador' },
    INSTALACAO_INICIADA:          { modulo: 'Instalação',             label: 'Instalação iniciada',                          papel: 'Instalador' },
    INSTALACAO_METADE_EXECUCAO:   { modulo: 'Instalação',             label: 'Metade da execução da instalação',             papel: 'Instalador' },
    PENDENCIA_INSTALACAO_REGISTRADA: { modulo: 'Instalação',          label: 'Pendência de instalação registrada',           papel: 'Instalador' },
    INSTALACAO_CONCLUIDA:         { modulo: 'Instalação',             label: 'Instalação concluída',                         papel: 'Instalador' },
    ART_EMITIDA:                  { modulo: 'Documentação',           label: 'ART emitida',                                  papel: 'Engenharia' },
    TESTES_REALIZADOS:            { modulo: 'Instalação',             label: 'Testes realizados',                            papel: 'Instalador' },
    DATABOOK_MONTADO:             { modulo: 'Data Book',              label: 'Data Book montado',                            papel: 'Engenharia' },
    TERMO_PREPARADO:              { modulo: 'Termo de Entrega',       label: 'Termo de Entrega preparado (link gerado)',     papel: 'Engenharia' },
    TERMO_ASSINADO:               { modulo: 'Termo de Entrega',       label: 'Termo de Entrega assinado',                    papel: 'Cliente' },
    HANDOVER_CONCLUIDO:           { modulo: 'Handover',               label: 'Handover concluído',                           papel: 'Engenharia' },
    POS_VENDA_ATIVADO:            { modulo: 'Pós-venda',              label: 'Pós-venda ativado (Escamax)',                  papel: 'Pós-venda' },

    /* ---- Subcircuito de revisão de proposta (23/08, achado do Dossiê PCB) —
       antes só existia CLIENTE_RESPONDEU_PROPOSTA com detalhe.resposta=
       'revisao_solicitada', sem decisão interna formal. Isso separa
       "cliente pediu revisão" de "VerticalParts aceita/recusa o pedido",
       pra nunca confundir recusa do cliente com recusa interna. */
    VERTICALPARTS_ACEITOU_REVISAO: { modulo: 'Proposta Comercial',    label: 'VerticalParts aceitou a revisão pedida',       papel: 'Comercial' },
    VERTICALPARTS_RECUSOU_REVISAO: { modulo: 'Proposta Comercial',    label: 'VerticalParts recusou a revisão internamente', papel: 'Comercial' },
    PROPOSTA_REENVIADA:            { modulo: 'Proposta Comercial',    label: 'Proposta revisada reenviada ao cliente',       papel: 'Comercial' },
  };

  /* registrar({ evento, numeroCotacao, alvoLabel, alvoId, detalhe })
     `evento` é uma chave de EVENTOS (ex.: 'FORMULARIO_PREENCHIDO').
     `ator_nome`/`ator_papel` (15/08, Linha do Tempo da Cotação) são
     preenchidos sozinhos — ator do usuário logado no momento, papel do
     catálogo acima — nenhum call-site precisa passar isso.
     Nunca derruba o fluxo principal por falha aqui — é rastro, não
     obrigação transacional (mesmo padrão de proteção do VPLog.registrar). */
  async function registrar({ evento, numeroCotacao, alvoLabel, alvoId, detalhe } = {}) {
    const def = EVENTOS[evento];
    if (!def) { console.warn('[EventosFluxo] evento desconhecido:', evento); return null; }
    try {
      const c = sb(); if (!c) return null;
      const user = window.__VP_USER || {};
      const { data, error } = await c.from('eventos_fluxo').insert({
        numero_cotacao: numeroCotacao ?? null,
        modulo: def.modulo,
        evento: def.label,
        alvo_label: alvoLabel || null,
        alvo_id: alvoId != null ? String(alvoId) : null,
        detalhe: detalhe || null,
        ator_nome: user.nome || user.email || null,
        ator_papel: def.papel || null,
      }).select().single();
      if (error) { console.warn('[EventosFluxo] registrar falhou', error); return null; }
      if (window.GatilhosEngine) window.GatilhosEngine.onEvento({ evento, numeroCotacao, alvoId, detalhe });
      /* Trilha B (01/09) — os 3 eventos de instalação também podem
         liberar parcela de pagamento ao instalador (contrato vinculado
         a este dossiê via alvoId). Nunca derruba o registro do evento
         por falha aqui (mesma proteção do restante desta função). */
      if (window.ContratoInstaladorParcelasStore && alvoId &&
          ['INSTALACAO_INICIADA', 'INSTALACAO_METADE_EXECUCAO', 'INSTALACAO_CONCLUIDA'].includes(evento)) {
        await window.ContratoInstaladorParcelasStore.verificarLiberacaoParcelas(alvoId, evento);
      }
      return data;
    } catch (e) {
      console.warn('[EventosFluxo] registrar falhou', e);
      return null;
    }
  }

  async function listarPorCotacao(numeroCotacao) {
    const c = sb(); if (!c || numeroCotacao == null) return [];
    const { data, error } = await c.from('eventos_fluxo')
      .select('*').eq('numero_cotacao', numeroCotacao).order('created_at', { ascending: true });
    if (error) { console.warn('[EventosFluxo] listarPorCotacao falhou', error); return []; }
    return data || [];
  }

  window.EventosFluxo = { EVENTOS, registrar, listarPorCotacao };
}());
