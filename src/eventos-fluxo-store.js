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
