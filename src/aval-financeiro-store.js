/* ============================================================
   aval-financeiro-store.js
   Gate do Financeiro no meio do funil comercial:

     Proposta aprovada (cliente assinou)
       -> Contrato de Venda é gerado e enviado SEM esperar o Financeiro
          (29/09: a consulta de score/aval de venda deixou de bloquear o
          contrato — ver podeEnviarContrato abaixo; continua disponível
          como registro opcional na tela Aval Financeiro)
     Contrato enviado
       -> Cliente assina (automático, via link público)
       -> Boleto do sinal gerado -> Financeiro confirma que foi pago (manual)
       -> Financeiro dá o Aval de Pagamento (manual) = "Aval Financeiro"
     Em paralelo, desde a Proposta aprovada:
       -> Jurídico dá o Aval Jurídico (manual — ver aval-juridico-store.js;
          o registro nasce junto com este, via trigger no banco)
     [Aval de Pagamento + Aval Jurídico (+ CEO só se a margem < 15%)
      liberam a compra na China — ver podeIniciarCompra abaixo e
      decidirComprar em cotacao-elevador-fornecedor-store.js. Ver
      instrucaocompra.md. Regra de 29/09/2026 (2ª rodada do dia).]

   window.AvalFinanceiroStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Aprovação do dono/criador do sistema — mesmo poder da aprovação do CEO,
     mas restrita por identidade (ninguém além dela pode clicar). Aceita o
     e-mail corporativo real e o dev@localhost (bypass de ambiente local). */
  const OWNER_EMAILS = ['gelson.simoes@verticalparts.com.br', 'dev@localhost'];
  function isOwner() {
    const email = ((window.__VP_USER || {}).email || '').trim().toLowerCase();
    return OWNER_EMAILS.includes(email);
  }

  async function getById(id) {
    const c = sb(); if (!c) return null;
    const { data } = await c.from('avais_financeiros').select('*').eq('id', id).maybeSingle();
    return data || null;
  }

  async function getByPropostaId(propostaId) {
    const c = sb(); if (!c || !propostaId) return null;
    const { data } = await c.from('avais_financeiros').select('*').eq('proposta_id', propostaId).maybeSingle();
    return data || null;
  }

  async function getByNumeroCotacao(numeroCotacao) {
    const c = sb(); if (!c || numeroCotacao == null) return null;
    const { data } = await c.from('avais_financeiros').select('*')
      .eq('numero_cotacao', numeroCotacao).order('criado_em', { ascending: false }).limit(1).maybeSingle();
    return data || null;
  }

  /* Usado por CVDesenhoInstalacaoSection (contrato-venda.jsx) pra checar
     sinal_pago a partir do Contrato de Venda — vincularContrato() abaixo é
     quem grava esse contrato_venda_id. */
  async function getByContratoVendaId(contratoVendaId) {
    const c = sb(); if (!c || !contratoVendaId) return null;
    const { data } = await c.from('avais_financeiros').select('*').eq('contrato_venda_id', contratoVendaId).maybeSingle();
    return data || null;
  }

  /* Garante que existe um registro pra essa proposta (cria se ainda não
     existir) — chamado tanto ao listar a fila do Financeiro quanto pelos
     gates, pra nunca travar por falta de registro. */
  async function garantirRegistro(proposta) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const existente = await getByPropostaId(proposta.id);
    if (existente) return existente;
    const cliente = (proposta.data_json && proposta.data_json.cliente) || {};
    const { data, error } = await c.from('avais_financeiros').insert({
      numero_cotacao: proposta.numero_cotacao ?? null,
      proposta_id: proposta.id,
      numero_documento: proposta.numero_documento || null,
      cliente_nome: cliente.nome || proposta.titulo || null,
      valor_total: proposta.valor_total ?? null,
      status: 'pendente_consulta',
    }).select().single();
    if (error) throw error;
    return data;
  }

  /* Fila do Financeiro: toda proposta aprovada pelo cliente, com o status
     do aval (cria o registro de aval na hora, se ainda não existir). */
  async function listarFila() {
    const c = sb(); if (!c) return [];
    const { data: propostas, error } = await c.from('propostas')
      .select('id, numero_documento, titulo, valor_total, numero_cotacao, data_json, aprovada_em')
      .eq('status', 'aprovada').order('aprovada_em', { ascending: false });
    if (error) { console.warn('[AvalFinanceiroStore] listarFila falhou', error); return []; }
    const avais = await Promise.all((propostas || []).map((p) => garantirRegistro(p)));
    return (propostas || []).map((p, i) => ({ proposta: p, aval: avais[i] }));
  }

  async function registrarConsulta(propostaOuId, consulta) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const propostaId = typeof propostaOuId === 'object' ? propostaOuId.id : propostaOuId;
    const atual = await getByPropostaId(propostaId);
    if (!atual) throw new Error('Registro de aval não encontrado — recarregue a fila.');
    const now = new Date().toISOString();
    const patch = {
      consulta: {
        fonte: consulta.fonte || null, score: consulta.score || null, nota: consulta.nota || null,
        observacoes: consulta.observacoes || null,
        consultado_em: now, consultado_por: (window.__VP_USER || {}).email || null,
      },
      status: 'pendente_aval',
      atualizado_em: now,
    };
    const { data, error } = await c.from('avais_financeiros').update(patch).eq('id', atual.id).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Aval Financeiro', acao: 'consultou o score do cliente',
      alvo: atual.numero_documento, alvo_id: atual.id,
    });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'FINANCEIRO_CONSULTOU_SCORE', numeroCotacao: data.numero_cotacao,
      alvoLabel: data.cliente_nome || data.numero_documento, alvoId: data.id,
      detalhe: { fonte: consulta.fonte, score: consulta.score },
    });
    return data;
  }

  async function darAval(id, aprovado, observacoes) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const now = new Date().toISOString();
    const patch = {
      status: aprovado ? 'aprovado' : 'reprovado',
      aval: {
        decisao: aprovado ? 'aprovado' : 'reprovado', observacoes: observacoes || null,
        aprovado_por: (window.__VP_USER || {}).email || null, aprovado_em: now,
      },
      atualizado_em: now,
    };
    const { data, error } = await c.from('avais_financeiros').update(patch).eq('id', id).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Aval Financeiro', acao: aprovado ? 'deu aval pra vender' : 'reprovou a venda',
      alvo: data.numero_documento, alvo_id: data.id,
    });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: aprovado ? 'FINANCEIRO_APROVOU_VENDA' : 'FINANCEIRO_REPROVOU_VENDA',
      numeroCotacao: data.numero_cotacao, alvoLabel: data.cliente_nome || data.numero_documento, alvoId: data.id,
    });
    return data;
  }

  async function confirmarSinal(id, { valor, pagoEm } = {}) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const now = new Date().toISOString();
    const patch = {
      sinal_pago: true,
      sinal: {
        valor: valor != null ? Number(valor) : null, pago_em: pagoEm || now.slice(0, 10),
        confirmado_por: (window.__VP_USER || {}).email || null, confirmado_em: now,
      },
      atualizado_em: now,
    };
    const { data, error } = await c.from('avais_financeiros').update(patch).eq('id', id).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Aval Financeiro', acao: 'confirmou o sinal pago', alvo: data.numero_documento, alvo_id: data.id,
    });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'SINAL_PAGO', numeroCotacao: data.numero_cotacao,
      alvoLabel: data.cliente_nome || data.numero_documento, alvoId: data.id, detalhe: { valor },
    });
    return data;
  }

  /* Aval de Pagamento — checkpoint NOVO e distinto do aval de score/crédito
     acima. Roda depois do boleto pago (confirmarSinal), antes de liberar a
     compra ao fornecedor. Ver instrucaocompra.md. */
  async function confirmarAvalPagamento(id, observacoes) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const now = new Date().toISOString();
    const patch = {
      aval_pagamento_confirmado: true,
      aval_pagamento: {
        observacoes: observacoes || null,
        confirmado_por: (window.__VP_USER || {}).email || null, confirmado_em: now,
      },
      atualizado_em: now,
    };
    const { data, error } = await c.from('avais_financeiros').update(patch).eq('id', id).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Aval Financeiro', acao: 'deu o Aval de Pagamento', alvo: data.numero_documento, alvo_id: data.id,
    });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'AVAL_PAGAMENTO_CONFIRMADO', numeroCotacao: data.numero_cotacao,
      alvoLabel: data.cliente_nome || data.numero_documento, alvoId: data.id,
    });
    return data;
  }

  /* Vincula o Contrato de Venda criado a esse aval — pra "Aval Financeiro"
     saber de qual contrato confirmar o sinal (chamado por createDraft). */
  async function vincularContrato(propostaId, contratoVendaId) {
    const c = sb(); if (!c || !propostaId) return;
    await c.from('avais_financeiros').update({ contrato_venda_id: contratoVendaId, atualizado_em: new Date().toISOString() })
      .eq('proposta_id', propostaId);
  }

  /* ---------- Gates ---------- */
  /* 29/09 — DEIXOU de bloquear. Antes exigia o aval de score/crédito do
     Financeiro (status 'aprovado') antes de gerar/enviar o Contrato de Venda.
     Processo real (confirmado pelo usuário): o Aval Financeiro é um evento à
     parte, DEPOIS do sinal pago (Aval de Pagamento, manual) — não existe
     aprovação do Financeiro antes do contrato. A consulta de score e o
     "aval de venda" continuam existindo na tela Aval Financeiro como
     registro opcional. Mantida a função (mesma assinatura) só porque
     createDraft ainda a chama. */
  async function podeEnviarContrato(_propostaId) {
    return { ok: true };
  }

  /* Aprovação do CEO (Diego) e do responsável/criador do sistema (Gelson) —
     mesmo poder entre as duas, nenhuma subordina a outra. A do CEO não tem
     trava de identidade (não há login próprio pra ele no sistema ainda);
     a "minha" fica restrita — ver isOwner(). */
  /* Teto de custo — no momento em que o CEO aprova, tira a "foto" do preço
     calculado na Precificação e congela em avais_financeiros. Daqui pra
     frente, cada gasto real que entrar via registrarCustoReal() é
     comparado contra esse teto — nunca contra um número recalculado
     depois, senão o teto "foge" junto com o gasto.

     Reescrito 29/08 (Gelson) — a versão de 23/08 tinha 2 bugs que juntos
     deixavam a função sempre voltar null (teto nunca era gravado, o
     alerta de estouro nunca disparava):
       1. filtrava status='aprovado', valor que não existe no enum de
          precificacoes_elevador (é 'rascunho'|'calculado'|'finalizado');
       2. lia custoTotalMercadorias de dentro de `resultado.precificacao`,
          mas esse campo só existe em `resultado.importacao`.
     Fórmula nova (decisão do usuário, 29/08): teto = preço de venda ×
     (1 − margem mínima configurada). Ex.: venda R$130, margem mínima 30%
     → teto R$91. Mais simples e não depende de recompor "custo total" a
     partir de vários campos do motor — só preço de venda (motor V2,
     oficial) e a margem mínima já configurada em Alavancas do Financeiro
     (mesmo número que trava a aprovação da Precificação). */
  async function _snapshotTetoCusto(numeroCotacao) {
    const c = sb();
    const { data: pz } = await c.from('precificacoes_elevador')
      .select('resultado, resultado_v2, parametros_fiscais_snapshot').eq('numero_cotacao', numeroCotacao).eq('status', 'finalizado')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (!pz) return null;
    // V2 é o motor oficial — cai pro V1 só se a precificação nunca rodou o V2.
    const precificacaoV2 = pz.resultado_v2 && pz.resultado_v2.precificacao;
    const precoVenda = Number((precificacaoV2 || (pz.resultado || {}).precificacao || {}).precoVendaProposta) || 0;
    if (!precoVenda) return null;
    const margemMinima = Number((pz.parametros_fiscais_snapshot || {}).margem_minima_pct) || 0;
    const custoTeto = precoVenda * (1 - margemMinima);
    return {
      custo_teto: custoTeto,
      margem_aceita: precoVenda - custoTeto,
    };
  }

  async function aprovarComoCEO(numeroCotacao) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const av = await getByNumeroCotacao(numeroCotacao);
    if (!av) throw new Error('Aval financeiro não encontrado para esta cotação.');
    const now = new Date().toISOString();
    const teto = await _snapshotTetoCusto(numeroCotacao);
    const { error } = await c.from('avais_financeiros').update({
      aprovacao_ceo_em: now, aprovacao_ceo_por: (window.__VP_USER || {}).email || 'CEO (Diego)', atualizado_em: now,
      ...(teto || {}),
    }).eq('id', av.id);
    if (error) throw error;
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'FINANCEIRO_APROVOU_CEO', numeroCotacao, alvoLabel: av.cliente_nome || av.numero_documento, alvoId: av.id,
    });
  }

  /* Extrato de gasto real (23/08, Gelson) — chamada por qualquer módulo que
     incorre custo real numa cotação já aprovada pelo CEO (Contrato
     Instalador, Andaime/Munck, ART…). Grava a linha, soma o acumulado, e
     se estourar o teto congelado em aprovarComoCEO, dispara um alerta novo
     — nunca bloqueia o módulo que gerou o gasto (decisão de 23/08: só
     alerta, o CEO toma ciência depois). Se a cotação nunca teve teto
     definido (não passou por aprovarComoCEO ainda), só registra o gasto,
     sem comparar com nada. */
  async function registrarCustoReal({ numeroCotacao, origem, descricao, valor }) {
    const c = sb(); if (!c || numeroCotacao == null || !(Number(valor) > 0)) return null;
    const id = 'CCR-' + Date.now().toString().slice(-6);
    const { error } = await c.from('cotacao_custos_reais').insert({
      id, numero_cotacao: numeroCotacao, origem, descricao: descricao || null,
      valor: Number(valor), criado_por: (window.__VP_USER || {}).email || null,
    });
    if (error) { console.warn('[AvalFinanceiroStore] registrarCustoReal falhou', error); return null; }

    const av = await getByNumeroCotacao(numeroCotacao);
    if (!av || av.custo_teto == null) return { alertou: false }; // sem teto definido — só registrou

    const { data: linhas } = await c.from('cotacao_custos_reais').select('valor').eq('numero_cotacao', numeroCotacao);
    const acumulado = (linhas || []).reduce((s, l) => s + Number(l.valor || 0), 0);
    if (acumulado <= Number(av.custo_teto)) return { alertou: false, acumulado };

    const estouro = acumulado - Number(av.custo_teto);
    await c.from('alertas').insert({
      id: 'estouro-' + id, level: 'danger',
      title: `Cotação ${numeroCotacao} estourou o teto de custo`,
      sub: `Acumulado R$ ${acumulado.toLocaleString('pt-BR')} · teto R$ ${Number(av.custo_teto).toLocaleString('pt-BR')} · estouro de R$ ${estouro.toLocaleString('pt-BR')} — último gasto: ${descricao || origem} (R$ ${Number(valor).toLocaleString('pt-BR')})`,
      module: 'Financeiro', resolved: false,
    });
    return { alertou: true, acumulado, estouro };
  }

  async function aprovarComoOwner(numeroCotacao) {
    if (!isOwner()) throw new Error('Só o responsável/criador do sistema pode dar esta aprovação.');
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const av = await getByNumeroCotacao(numeroCotacao);
    if (!av) throw new Error('Aval financeiro não encontrado para esta cotação.');
    const now = new Date().toISOString();
    const { error } = await c.from('avais_financeiros').update({
      aprovacao_owner_em: now, aprovacao_owner_por: (window.__VP_USER || {}).email || null, atualizado_em: now,
    }).eq('id', av.id);
    if (error) throw error;
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'FINANCEIRO_APROVOU_OWNER', numeroCotacao, alvoLabel: av.cliente_nome || av.numero_documento, alvoId: av.id,
    });
  }

  /* CEO só entra quando a margem efetiva da precificação fica abaixo de 15%
     (ou é desconhecida) — mesma regra de LIMITE_MARGEM_SEM_CEO do envio de
     proposta, em decisoes-store.js (29/09, usuário: "CEO só chega nele
     dentro de discrepâncias"). Sem DecisoesStore carregado, mantém o CEO
     por segurança. */
  async function precisaAprovacaoCeo(numeroCotacao) {
    const d = window.DecisoesStore;
    if (!d || !d.precisaAprovacaoCeo) return { precisa: true, margem: null };
    return d.precisaAprovacaoCeo(numeroCotacao);
  }

  /* Aval Jurídico da mesma venda — pela Proposta (o registro nasce junto com
     este, quando o cliente aprova), senão pelo Nº da cotação. */
  async function avalJuridicoDe(av, numeroCotacao) {
    const c = sb(); if (!c) return null;
    if (av && av.proposta_id) {
      const { data } = await c.from('avais_juridicos').select('status').eq('proposta_id', av.proposta_id).maybeSingle();
      if (data) return data;
    }
    const { data } = await c.from('avais_juridicos').select('status')
      .eq('numero_cotacao', numeroCotacao).order('criado_em', { ascending: false }).limit(1).maybeSingle();
    return data || null;
  }

  /* Gate final antes de iniciar a compra no fornecedor (29/09/2026, pedido
     do usuário: "para a compra na China, dois avais precisam estar OK,
     financeiro e jurídico"):
       1. Aval de Pagamento do Financeiro (manual, depois do sinal pago —
          é o "Aval Financeiro" do processo real, ver #503)
       2. Aval Jurídico (manual, abre junto com o Financeiro quando o
          cliente aprova a Proposta)
       3. Aval Engenharia (08/10/2026): o cliente assinou o Projeto de
          Instalação — POR COTAÇÃO, todos os projetos dela (AvalEngenhariaStore)
       4. CEO — só se a margem efetiva ficou abaixo de 15% (ou desconhecida)
     Mostra sempre a PRIMEIRA que faltar. Deixaram de travar a compra:
     aprovação do responsável pelo sistema, sinal pago como checagem própria
     (o Aval de Pagamento já vem depois dele), contrato assinado e revisão
     técnica de Engenharia. */
  async function podeIniciarCompra(numeroCotacao) {
    if (numeroCotacao == null) return { ok: true }; // sem correlação — não trava
    const av = await getByNumeroCotacao(numeroCotacao);
    const aj = await avalJuridicoDe(av, numeroCotacao);
    const ceo = await precisaAprovacaoCeo(numeroCotacao);
    const eng = window.AvalEngenhariaStore ? await window.AvalEngenhariaStore.status(numeroCotacao) : { estado: 'erro' };
    const motivoEng = eng.estado === 'sem_projeto' ? 'a assinatura do Projeto de Instalação (o projeto ainda não foi salvo em "Projeto de Elevadores")'
      : eng.estado === 'recusado' ? 'a assinatura do Projeto de Instalação (o cliente recusou — gere um novo link em "Projeto de Elevadores")'
      : eng.estado === 'erro' ? 'a assinatura do Projeto de Instalação (não foi possível conferir agora)'
      : `a assinatura do Projeto de Instalação (${eng.assinados} de ${eng.total} assinado${eng.total === 1 ? '' : 's'} — veja em "Projeto de Elevadores")`;
    const margemTxt = ceo.margem != null ? `margem ${(ceo.margem * 100).toFixed(1).replace('.', ',')}%, abaixo de 15%` : 'margem desconhecida';

    const checagens = [
      { ok: !!(av && av.aval_pagamento_confirmado), motivo: 'o Aval de Pagamento do Financeiro (depois do sinal pago — botão "Dar Aval de Pagamento" na tela "Aval Financeiro" ou em "Prazos & Pendências")' },
      { ok: aj?.status === 'aprovado', motivo: 'o Aval Jurídico (tela "Aval Jurídico")' },
      { ok: eng.estado === 'ok', motivo: motivoEng },
      { ok: !ceo.precisa || !!(av && av.aprovacao_ceo_em), motivo: `a aprovação do CEO (Diego) — ${margemTxt}` },
    ];
    const primeiraFaltando = checagens.find((ck) => !ck.ok);
    if (primeiraFaltando) {
      return { ok: false, motivo: `Ainda falta confirmar: ${primeiraFaltando.motivo}. Só então a compra no fornecedor pode ser iniciada.` };
    }
    return { ok: true };
  }

  window.AvalFinanceiroStore = {
    getById, getByPropostaId, getByNumeroCotacao, getByContratoVendaId, garantirRegistro, listarFila,
    registrarConsulta, darAval, confirmarSinal, confirmarAvalPagamento, vincularContrato,
    podeEnviarContrato, podeIniciarCompra, precisaAprovacaoCeo, aprovarComoCEO, aprovarComoOwner, isOwner,
    registrarCustoReal,
  };
}());
