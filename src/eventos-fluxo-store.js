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
  const EVENTOS = {
    FORMULARIO_PREENCHIDO:       { modulo: 'Formulário Elevador',     label: 'Formulário preenchido' },
    COTACAO_ENVIADA_FORNECEDOR:  { modulo: 'Cotação a Fornecedor',    label: 'Cotação enviada ao fornecedor' },
    FORNECEDOR_RESPONDEU:        { modulo: 'Cotação a Fornecedor',    label: 'Fornecedor respondeu' },
    PROPOSTA_ELABORADA:          { modulo: 'Proposta Comercial',      label: 'Proposta elaborada' },
    PROPOSTA_ENVIADA:            { modulo: 'Proposta Comercial',      label: 'Proposta enviada ao cliente' },
    CLIENTE_RESPONDEU_PROPOSTA:  { modulo: 'Proposta Comercial',      label: 'Cliente respondeu a proposta' },
    FINANCEIRO_CONSULTOU_SCORE:  { modulo: 'Aval Financeiro',         label: 'Financeiro consultou o score do cliente' },
    FINANCEIRO_APROVOU_VENDA:    { modulo: 'Aval Financeiro',         label: 'Financeiro deu o aval pra vender' },
    FINANCEIRO_REPROVOU_VENDA:   { modulo: 'Aval Financeiro',         label: 'Financeiro reprovou a venda' },
    CONTRATO_VENDA_ENVIADO:      { modulo: 'Contrato de Venda',       label: 'Contrato de venda enviado' },
    CONTRATO_VENDA_ASSINADO:     { modulo: 'Contrato de Venda',       label: 'Contrato de venda assinado' },
    SINAL_PAGO:                  { modulo: 'Aval Financeiro',         label: 'Boleto pago pelo cliente' },
    AVAL_PAGAMENTO_CONFIRMADO:   { modulo: 'Aval Financeiro',         label: 'Financeiro deu o Aval de Pagamento' },
    COMPRA_FORNECEDOR_INICIADA:  { modulo: 'Cotação a Fornecedor',    label: 'Compra do equipamento iniciada no fornecedor' },
    COMPRA_FORNECEDOR_CONFIRMADA:{ modulo: 'Cotação a Fornecedor',    label: 'Compra do equipamento confirmada com o fornecedor' },
    PROJETO_ELEVADOR_FINALIZADO: { modulo: 'Engenharia',              label: 'Projeto de Elevadores finalizado' },
  };

  /* registrar({ evento, numeroCotacao, alvoLabel, alvoId, detalhe })
     `evento` é uma chave de EVENTOS (ex.: 'FORMULARIO_PREENCHIDO').
     Nunca derruba o fluxo principal por falha aqui — é rastro, não
     obrigação transacional (mesmo padrão de proteção do VPLog.registrar). */
  async function registrar({ evento, numeroCotacao, alvoLabel, alvoId, detalhe } = {}) {
    const def = EVENTOS[evento];
    if (!def) { console.warn('[EventosFluxo] evento desconhecido:', evento); return null; }
    try {
      const c = sb(); if (!c) return null;
      const { data, error } = await c.from('eventos_fluxo').insert({
        numero_cotacao: numeroCotacao ?? null,
        modulo: def.modulo,
        evento: def.label,
        alvo_label: alvoLabel || null,
        alvo_id: alvoId != null ? String(alvoId) : null,
        detalhe: detalhe || null,
      }).select().single();
      if (error) { console.warn('[EventosFluxo] registrar falhou', error); return null; }
      if (window.GatilhosEngine) window.GatilhosEngine.onEvento({ evento, numeroCotacao, detalhe });
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
