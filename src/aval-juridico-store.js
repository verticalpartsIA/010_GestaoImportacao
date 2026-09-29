/* ============================================================
   aval-juridico-store.js
   Aval Jurídico — abre JUNTO com o Aval Financeiro, quando o cliente
   aprova a Proposta (29/09/2026, pedido do usuário):

     Proposta aprovada (cliente assinou)
       -> trigger no banco (fn_avais_abrir_na_proposta) cria o registro
          aqui (proposta_id) e em avais_financeiros, e grava a notificação
          "Avais Financeiro e Jurídico iniciados" em `alertas`
       -> Jurídico dá o aval (aprova ou reprova) — manual
       -> [Aval Jurídico + Aval de Pagamento do Financeiro (depois do sinal)
          liberam a compra na China — ver AvalFinanceiroStore.podeIniciarCompra.
          Quando os dois ficam OK, o banco grava a 2ª notificação
          (fn_avais_notificar_ok).]
     Contrato de Venda (quando existir)
       -> contrato_venda_id é vinculado a este mesmo registro (vincularContrato)
       -> este aval também é uma das 3 condições do envio do Desenho do
          Projeto de Instalação (podeEnviarDesenho, junto com sinal pago e
          contrato assinado).

   Antes de 29/09 o registro só nascia do Contrato de Venda assinado
   (chave contrato_venda_id). Contrato avulso (sem Proposta) continua
   entrando na fila por esse caminho antigo.

   window.AvalJuridicoStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  async function getByPropostaId(propostaId) {
    const c = sb(); if (!c || !propostaId) return null;
    const { data } = await c.from('avais_juridicos').select('*').eq('proposta_id', propostaId).maybeSingle();
    return data || null;
  }

  async function getByNumeroCotacao(numeroCotacao) {
    const c = sb(); if (!c || numeroCotacao == null) return null;
    const { data } = await c.from('avais_juridicos').select('*')
      .eq('numero_cotacao', numeroCotacao).order('criado_em', { ascending: false }).limit(1).maybeSingle();
    return data || null;
  }

  /* Por contrato: primeiro o vínculo direto; senão, o aval da Proposta de
     origem do contrato (o aval pode ter sido dado antes do contrato existir). */
  async function getByContratoId(contratoVendaId) {
    const c = sb(); if (!c || !contratoVendaId) return null;
    const { data } = await c.from('avais_juridicos').select('*').eq('contrato_venda_id', contratoVendaId).maybeSingle();
    if (data) return data;
    const { data: ct } = await c.from('contratos_venda_equipamentos').select('proposta_id').eq('id', contratoVendaId).maybeSingle();
    return ct && ct.proposta_id ? getByPropostaId(ct.proposta_id) : null;
  }

  /* Registro a partir da Proposta aprovada (o trigger do banco já cria —
     isto é só rede de segurança, idempotente). */
  async function garantirRegistroProposta(proposta) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const existente = await getByPropostaId(proposta.id);
    if (existente) return existente;
    const cliente = (proposta.data_json && proposta.data_json.cliente) || {};
    const { data, error } = await c.from('avais_juridicos').insert({
      proposta_id: proposta.id,
      numero_cotacao: proposta.numero_cotacao ?? null,
      numero_documento: proposta.numero_documento || null,
      cliente_nome: cliente.nome || proposta.titulo || null,
      status: 'pendente',
    }).select().single();
    if (error) {
      // Corrida com o trigger/outra aba: o registro já existe.
      const outro = await getByPropostaId(proposta.id);
      if (outro) return outro;
      throw error;
    }
    return data;
  }

  /* Registro a partir de um contrato assinado SEM Proposta (avulso). */
  async function garantirRegistro(contrato) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const existente = await getByContratoId(contrato.id);
    if (existente) return existente;
    const { data, error } = await c.from('avais_juridicos').insert({
      contrato_venda_id: contrato.id,
      numero_cotacao: null,
      numero_documento: contrato.numero_documento || null,
      cliente_nome: contrato.comprador_razao_social || null,
      status: 'pendente',
    }).select().single();
    if (error) throw error;
    return data;
  }

  /* Vincula o Contrato de Venda criado ao aval jurídico da Proposta
     (chamado por createDraft, igual ao AvalFinanceiroStore.vincularContrato). */
  async function vincularContrato(propostaId, contratoVendaId) {
    const c = sb(); if (!c || !propostaId || !contratoVendaId) return;
    const { error } = await c.from('avais_juridicos')
      .update({ contrato_venda_id: contratoVendaId, atualizado_em: new Date().toISOString() })
      .eq('proposta_id', propostaId).is('contrato_venda_id', null);
    if (error) console.warn('[AvalJuridicoStore] vincularContrato falhou', error);
  }

  /* Fila do Jurídico: toda Proposta aprovada pelo cliente (com o contrato,
     se já existir) + contratos assinados avulsos (sem Proposta). */
  async function listarFila() {
    const c = sb(); if (!c) return [];
    const [{ data: propostas, error }, { data: contratos }] = await Promise.all([
      c.from('propostas')
        .select('id, numero_documento, titulo, valor_total, numero_cotacao, data_json, aprovada_em')
        .eq('status', 'aprovada').order('aprovada_em', { ascending: false }),
      c.from('contratos_venda_equipamentos')
        .select('id, numero_documento, status, comprador_razao_social, valor_total_num, proposta_id, signed_at'),
    ]);
    if (error) { console.warn('[AvalJuridicoStore] listarFila falhou', error); return []; }
    const contratoPorProposta = {};
    (contratos || []).forEach((ct) => { if (ct.proposta_id && !contratoPorProposta[ct.proposta_id]) contratoPorProposta[ct.proposta_id] = ct; });

    const linhasProposta = await Promise.all((propostas || []).map(async (p) => {
      const aval = await garantirRegistroProposta(p);
      const contrato = contratoPorProposta[p.id] || null;
      if (contrato && !aval.contrato_venda_id) vincularContrato(p.id, contrato.id);
      return { key: 'p-' + p.id, proposta: p, contrato, aval, valor: p.valor_total };
    }));
    const avulsos = (contratos || []).filter((ct) => !ct.proposta_id && ct.status === 'assinado');
    const linhasAvulso = await Promise.all(avulsos.map(async (ct) => ({
      key: 'c-' + ct.id, proposta: null, contrato: ct, aval: await garantirRegistro(ct), valor: ct.valor_total_num,
    })));
    return [...linhasProposta, ...linhasAvulso];
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
    const { data, error } = await c.from('avais_juridicos').update(patch).eq('id', id).select().single();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Aval Jurídico', acao: aprovado ? 'deu o aval jurídico ao contrato' : 'reprovou o contrato (Jurídico)',
      alvo: data.numero_documento, alvo_id: data.id,
    });
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: aprovado ? 'AVAL_JURIDICO_APROVADO' : 'AVAL_JURIDICO_REPROVADO',
      numeroCotacao: data.numero_cotacao, alvoLabel: data.cliente_nome || data.numero_documento, alvoId: data.id,
    });
    return data;
  }

  /* Gate: usado por contrato-venda.jsx antes de liberar o envio do Desenho
     do Projeto de Instalação (junto com AvalFinanceiroStore.sinal_pago e
     contrato.status === 'assinado' — ver CVDesenhoInstalacaoSection).
     Acha o aval pelo contrato OU pela Proposta de origem dele. */
  async function podeEnviarDesenho(contratoVendaId) {
    const av = await getByContratoId(contratoVendaId);
    if (!av || av.status !== 'aprovado') {
      return { ok: false, motivo: 'O Jurídico ainda não deu o aval deste contrato — aprove em "Aval Jurídico" antes de enviar o desenho.' };
    }
    return { ok: true };
  }

  window.AvalJuridicoStore = {
    getByContratoId, getByPropostaId, getByNumeroCotacao, garantirRegistro, garantirRegistroProposta,
    vincularContrato, listarFila, darAval, podeEnviarDesenho,
  };
}());
