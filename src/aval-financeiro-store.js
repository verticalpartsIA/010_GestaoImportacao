/* ============================================================
   aval-financeiro-store.js
   Gate do Financeiro no meio do funil comercial:

     Proposta aprovada (cliente assinou)
       -> Financeiro consulta o score do cliente
       -> Financeiro dá o aval (aprova ou reprova a venda)
       -> [só então o Contrato de Venda pode ser enviado — ver createDraft
          em contrato-venda-store.js]
     Contrato enviado
       -> Jurídico assina o contrato (automático, via link público)
       -> Boleto gerado -> Financeiro confirma que foi pago (manual)
       -> Financeiro dá o Aval de Pagamento (manual, NOVO — distinto
          deste aval de score acima)
       -> [só com contrato assinado + boleto pago + Aval de Pagamento
          a Cotação a Fornecedor pode iniciar a compra na China — ver
          decidirComprar em cotacao-elevador-fornecedor-store.js e
          podeIniciarCompra abaixo. Ver instrucaocompra.md.]

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
  async function podeEnviarContrato(propostaId) {
    if (!propostaId) return { ok: true }; // wizard 100% manual, sem Master ID — não trava
    const av = await getByPropostaId(propostaId);
    if (!av || av.status !== 'aprovado') {
      return { ok: false, motivo: 'O Financeiro ainda não deu o aval pra essa venda. Consulte o score e aprove em "Aval Financeiro" antes de enviar o contrato.' };
    }
    return { ok: true };
  }

  /* Aprovação do CEO (Diego) e do responsável/criador do sistema (Gelson) —
     mesmo poder entre as duas, nenhuma subordina a outra. A do CEO não tem
     trava de identidade (não há login próprio pra ele no sistema ainda);
     a "minha" fica restrita — ver isOwner(). */
  /* Teto de custo (23/08, Gelson) — no momento em que o CEO aprova, tira a
     "foto" do custo/margem calculados na Precificação e congela em
     avais_financeiros. Daqui pra frente, cada gasto real que entrar via
     registrarCustoReal() é comparado contra esse teto — nunca contra um
     número recalculado depois, senão o teto "foge" junto com o gasto. */
  async function _snapshotTetoCusto(numeroCotacao) {
    const c = sb();
    const { data: pz } = await c.from('precificacoes_elevador')
      .select('resultado').eq('numero_cotacao', numeroCotacao).eq('status', 'aprovado')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const precificacao = pz?.resultado?.precificacao;
    if (!precificacao) return null;
    /* 23/08 (Gelson): teto inclui comissão do vendedor — "todos os custos
       pensáveis", dinheiro real saindo do caixa da cotação, mesma lógica
       de ART/frete/instalador. custoTotalMercadorias (bens/frete/impostos)
       já vem separado da comissão no motor de cálculo — soma aqui. */
    const custoBase = Number(precificacao.custoTotalMercadorias) || 0;
    const comissaoVendedor = Number(precificacao.comissaoVendedorRs) || 0;
    const custoTeto = custoBase + comissaoVendedor;
    return {
      custo_teto: custoTeto,
      margem_aceita: (Number(precificacao.precoVendaProposta) || 0) - custoTeto,
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

  /* Gate final antes de iniciar a compra no fornecedor. Checa, na ordem de
     prioridade pedida (mostra sempre a PRIMEIRA condição que falta, mesmo
     que outras também estejam pendentes): aprovação do CEO, aprovação do
     responsável, sinal pago, Aval de Pagamento, contrato assinado, revisão
     técnica do projeto pela Engenharia. Sinal/contrato continuam
     acontecendo quando o cliente agir — não dependem de ordem estrita com
     as aprovações internas, só entram todos juntos na conta final. */
  async function podeIniciarCompra(numeroCotacao) {
    if (numeroCotacao == null) return { ok: true }; // sem correlação — não trava
    const c = sb();
    const av = await getByNumeroCotacao(numeroCotacao);

    let contratoAssinado = false;
    if (av && av.contrato_venda_id) {
      const { data: contrato } = await c.from('contratos_venda_equipamentos')
        .select('status').eq('id', av.contrato_venda_id).maybeSingle();
      contratoAssinado = contrato?.status === 'assinado';
    }

    const { data: projeto } = await c.from('projetos_elevador')
      .select('status').eq('numero_cotacao', numeroCotacao).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const revisaoProjeto = projeto?.status === 'finalizado';

    const checagens = [
      { ok: !!(av && av.aprovacao_ceo_em), motivo: 'a aprovação do CEO (Diego)' },
      { ok: !!(av && av.aprovacao_owner_em), motivo: 'a aprovação do responsável pelo sistema' },
      { ok: !!(av && av.sinal_pago), motivo: 'o pagamento do boleto pelo cliente (Financeiro)' },
      { ok: !!(av && av.aval_pagamento_confirmado), motivo: 'o Aval de Pagamento (Financeiro)' },
      { ok: contratoAssinado, motivo: 'a assinatura do contrato (Jurídico)' },
      { ok: revisaoProjeto, motivo: 'a revisão técnica do projeto (Engenharia)' },
    ];
    const primeiraFaltando = checagens.find((ck) => !ck.ok);
    if (primeiraFaltando) {
      return { ok: false, motivo: `Ainda falta confirmar: ${primeiraFaltando.motivo}. Verifique em "Aval Financeiro" antes de iniciar a compra no fornecedor.` };
    }
    return { ok: true };
  }

  window.AvalFinanceiroStore = {
    getById, getByPropostaId, getByNumeroCotacao, garantirRegistro, listarFila,
    registrarConsulta, darAval, confirmarSinal, confirmarAvalPagamento, vincularContrato,
    podeEnviarContrato, podeIniciarCompra, aprovarComoCEO, aprovarComoOwner, isOwner,
    registrarCustoReal,
  };
}());
