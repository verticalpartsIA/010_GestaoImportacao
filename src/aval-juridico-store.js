/* ============================================================
   aval-juridico-store.js
   Gate do Jurídico depois da assinatura do Contrato de Venda:

     Contrato assinado (cliente assinou via link público)
       -> Jurídico revisa e dá o aval (aprova ou reprova)
       -> [só com sinal pago (Aval Financeiro) + contrato assinado + este
          aval, a Engenharia pode enviar o Desenho do Projeto de Instalação
          — ver podeEnviarDesenho abaixo e uploadDesenhoInstalacao/
          enviarDesenhoInstalacao em contrato-venda-store.js]

   Espelha o padrão de aval-financeiro-store.js, bem mais simples (só
   aprovar/reprovar, sem consulta de score nem múltiplas aprovações).

   window.AvalJuridicoStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  async function getByContratoId(contratoVendaId) {
    const c = sb(); if (!c || !contratoVendaId) return null;
    const { data } = await c.from('avais_juridicos').select('*').eq('contrato_venda_id', contratoVendaId).maybeSingle();
    return data || null;
  }

  async function _numeroCotacaoDaProposta(propostaId) {
    if (!propostaId) return null;
    const c = sb(); if (!c) return null;
    const { data } = await c.from('propostas').select('numero_cotacao').eq('id', propostaId).maybeSingle();
    return data ? data.numero_cotacao : null;
  }

  /* Garante que existe um registro pra esse contrato assinado (cria se
     ainda não existir) — chamado tanto ao listar a fila do Jurídico quanto
     pelo gate, pra nunca travar por falta de registro. */
  async function garantirRegistro(contrato) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const existente = await getByContratoId(contrato.id);
    if (existente) return existente;
    const numeroCotacao = await _numeroCotacaoDaProposta(contrato.proposta_id);
    const { data, error } = await c.from('avais_juridicos').insert({
      contrato_venda_id: contrato.id,
      numero_cotacao: numeroCotacao,
      numero_documento: contrato.numero_documento || null,
      cliente_nome: contrato.comprador_razao_social || null,
      status: 'pendente',
    }).select().single();
    if (error) throw error;
    return data;
  }

  /* Fila do Jurídico: todo Contrato de Venda já assinado pelo cliente, com
     o status do aval (cria o registro na hora, se ainda não existir). */
  async function listarFila() {
    const c = sb(); if (!c) return [];
    const { data: contratos, error } = await c.from('contratos_venda_equipamentos')
      .select('id, numero_documento, comprador_razao_social, valor_total_num, proposta_id, signed_at')
      .eq('status', 'assinado').order('signed_at', { ascending: false });
    if (error) { console.warn('[AvalJuridicoStore] listarFila falhou', error); return []; }
    const avais = await Promise.all((contratos || []).map((ct) => garantirRegistro(ct)));
    return (contratos || []).map((ct, i) => ({ contrato: ct, aval: avais[i] }));
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
     contrato.status === 'assinado' — ver CVDesenhoInstalacaoSection). */
  async function podeEnviarDesenho(contratoVendaId) {
    const av = await getByContratoId(contratoVendaId);
    if (!av || av.status !== 'aprovado') {
      return { ok: false, motivo: 'O Jurídico ainda não deu o aval deste contrato — aprove em "Aval Jurídico" antes de enviar o desenho.' };
    }
    return { ok: true };
  }

  window.AvalJuridicoStore = { getByContratoId, garantirRegistro, listarFila, darAval, podeEnviarDesenho };
}());
