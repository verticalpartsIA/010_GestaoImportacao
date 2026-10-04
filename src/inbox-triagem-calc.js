/* ============================================================
   inbox-triagem-calc.js — política de exibição da triagem do Inbox (04/10/2026).
   Funções PURAS (testadas em inbox-triagem-calc.test.js). A decisão em si (assunto,
   departamento, urgência, exige_resposta, reclamação + confiança) é calculada no banco
   por regras (public.inbox_classificar) e gravada em emails_projeto.ia_decisao; aqui só
   se decide O QUE MOSTRAR, no espírito do JEV: o robô trabalha em silêncio e a tela
   mostra só o que importa.
   window.InboxTriagem = { ASSUNTO_LABEL, DEPARTAMENTO_LABEL, PRIORIDADE_LABEL, politica, rotulo }
   ============================================================ */
(function () {
  'use strict';

  const ASSUNTO_LABEL = {
    resposta_fornecedor: 'Fornecedor', resposta_cliente: 'Cliente', contrato_assinatura: 'Contrato',
    financeiro_pagamento: 'Pagamento', avaria_pos_venda: 'Avaria', pedido_novo: 'Pedido novo',
    obra_instalacao: 'Obra', fiscal_nf: 'Nota fiscal', automatico_spam: 'Automático', outro: 'Outro',
  };
  const DEPARTAMENTO_LABEL = {
    importacao: 'Importação', comercial: 'Comercial', juridico: 'Jurídico', financeiro: 'Financeiro',
    pos_venda: 'Pós-venda', engenharia: 'Engenharia', logistica: 'Logística', geral: 'Geral',
  };
  const PRIORIDADE_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

  /* Limites da política. A confiança vem de REGRAS (evidência × folga sobre a 2ª opção), não de um
     modelo calibrado — por isso o limite de "silencioso" é conservador e só esconde e-mail automático. */
  const LIMITE_SILENCIOSO = 0.75;

  /* politica(decisao, { vinculado }) → 'precisa_de_voce' | 'silencioso' | 'normal'
     - silencioso: e-mail automático/newsletter com confiança suficiente (fica agrupado, nunca apagado);
     - precisa_de_voce: prioridade alta, reclamação, ou e-mail ligado a uma cotação que pede resposta;
     - normal: o resto, listado como sempre. Sem decisão (não classificado) = normal. */
  function politica(decisao, opts) {
    if (!decisao || !decisao.resumo) return 'normal';
    const r = decisao.resumo;
    const vinculado = !!(opts && opts.vinculado);
    if (r.assunto === 'automatico_spam' && Number(r.confianca) >= LIMITE_SILENCIOSO) return 'silencioso';
    if (r.prioridade === 'alta') return 'precisa_de_voce';
    if (decisao.reclamacao && decisao.reclamacao.resposta) return 'precisa_de_voce';
    // pede resposta: chama você quando está ligado a uma cotação OU quando o assunto é de negócio (não "outro")
    if (decisao.exige_resposta && decisao.exige_resposta.resposta && (vinculado || r.assunto !== 'outro')) return 'precisa_de_voce';
    return 'normal';
  }

  /* Texto curto do chip: "Avaria · Pós-venda · Alta". */
  function rotulo(decisao) {
    if (!decisao || !decisao.resumo) return '';
    const r = decisao.resumo;
    return [ASSUNTO_LABEL[r.assunto] || r.assunto, DEPARTAMENTO_LABEL[r.departamento] || r.departamento, PRIORIDADE_LABEL[r.prioridade] || r.prioridade]
      .filter(Boolean).join(' · ');
  }

  const api = { ASSUNTO_LABEL, DEPARTAMENTO_LABEL, PRIORIDADE_LABEL, LIMITE_SILENCIOSO, politica, rotulo };
  if (typeof window !== 'undefined') window.InboxTriagem = api;
  if (typeof module !== 'undefined') module.exports = api;
}());
