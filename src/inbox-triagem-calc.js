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

  /* ---------- Fase 2 (04/10/2026) — mesmas regras do JEV: decisão estruturada com confiança; a tela só mostra o que ajuda ---------- */

  /* politicaSugestao(sug) → 'forte' | 'perguntar' | 'silencio'
     `sug` = retorno de public.inbox_sugerir_vinculo ({ candidatos:[{numero, nome, score, probabilidade}], confianca }).
     - forte: uma candidata clara (pontos ≥ 0,60, probabilidade ≥ 0,60 e folga ≥ 0,25 sobre a 2ª) → barra de 1 clique;
     - perguntar: há evidência (pontos ≥ 0,45) mas ambígua → lista para escolher;
     - silencio: pouca evidência → o pop-up NÃO aparece (nada de pergunta à toa).
     Ainda NÃO vincula sozinho: ação automática é liberada uma a uma, depois de ver as sugestões acertando. */
  function politicaSugestao(sug) {
    const c = (sug && sug.candidatos) || [];
    if (!c.length) return 'silencio';
    const top = c[0];
    const margem = Number(top.probabilidade || 0) - Number(c[1] ? c[1].probabilidade || 0 : 0);
    if (Number(top.score) >= 0.6 && Number(top.probabilidade) >= 0.6 && margem >= 0.25) return 'forte';
    // evidência existe mas está diluída entre muitas cotações (ex.: fornecedor que atende várias) → não ajuda, fica em silêncio
    if (Number(top.score) >= 0.45 && Number(top.probabilidade) >= 0.3) return 'perguntar';
    return 'silencio';
  }

  /* Departamento da classificação → departamento do cadastro de colaboradores (para sugerir o responsável de um e-mail sem dono). */
  const DEPARTAMENTO_CADASTRO = {
    importacao: 'Jurídico/Importação/Suprimentos', juridico: 'Jurídico/Importação/Suprimentos', comercial: 'Comercial',
    pos_venda: 'Comercial', financeiro: 'Adm/Financeiro', engenharia: 'Engenharia',
  };

  /* sugerirResponsavel({ decisao, colaboradores, eu }) → [{ email, nome, probabilidade, motivo }] (até 4).
     Heurística de regras: líderes do departamento indicado pela classificação (0,5 cada, dividido) e, abaixo, a equipe (0,1).
     Só serve para ORDENAR a lista do "Atribuir" — a pessoa sempre confirma. */
  function sugerirResponsavel(p) {
    const dec = p && p.decisao;
    const depto = dec && dec.resumo ? DEPARTAMENTO_CADASTRO[dec.resumo.departamento] : null;
    if (!depto) return [];
    const pessoas = ((p && p.colaboradores) || []).filter((x) => x.email && x.departamento === depto);
    const lideres = pessoas.filter((x) => x.is_department_lead);
    const resto = pessoas.filter((x) => !x.is_department_lead).slice(0, 3);
    const rotuloDepto = DEPARTAMENTO_LABEL[dec.resumo.departamento] || depto;
    return [
      ...lideres.map((x) => ({ email: x.email, nome: x.nome, probabilidade: Math.round((0.5 / lideres.length) * 100) / 100, motivo: 'líder de ' + rotuloDepto })),
      ...resto.map((x) => ({ email: x.email, nome: x.nome, probabilidade: 0.1, motivo: 'equipe de ' + rotuloDepto })),
    ].slice(0, 4);
  }

  /* Responsável atual = quem recebeu a atribuição, senão o dono. */
  const responsavelDe = (dono, atribuido) => String(atribuido || dono || '').trim().toLowerCase() || null;

  /* avisoOutroDono({ dono, atribuido, eu }) → e-mail do responsável quando ele NÃO sou eu (aí a tela avisa antes de responder), senão null. */
  function avisoOutroDono(p) {
    const resp = responsavelDe(p && p.dono, p && p.atribuido);
    const eu = String((p && p.eu) || '').trim().toLowerCase();
    return resp && resp !== eu ? resp : null;
  }

  /* naoLidaPara(imapNaoLida, estado) — "lido" POR PESSOA: se eu já abri (linha em inbox_estado_pessoa), é lida para mim;
     senão vale a bandeira da caixa (IMAP). */
  const naoLidaPara = (imapNaoLida, estado) => (estado && estado.lido ? false : !!imapNaoLida);

  const api = { ASSUNTO_LABEL, DEPARTAMENTO_LABEL, PRIORIDADE_LABEL, LIMITE_SILENCIOSO, politica, rotulo,
    politicaSugestao, sugerirResponsavel, responsavelDe, avisoOutroDono, naoLidaPara };
  if (typeof window !== 'undefined') window.InboxTriagem = api;
  if (typeof module !== 'undefined') module.exports = api;
}());
