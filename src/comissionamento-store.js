/* ============================================================
   comissionamento-store.js
   Motor de regras de comissionamento por origem_venda (issue #68).

   Antes: `origem_venda` no Formulário trazia o percentual embutido só como
   texto da opção do dropdown, e a tabela `comissoes` era um livro-razão
   manual sem nenhum vínculo com a origem real da venda — mudar o percentual
   de comissão exigia mexer no código do formulário de intake.

   Agora: `regras_comissionamento` guarda origem → split(s) de recebedor(es)
   + limite de alçada, editável sem deploy. `gerarComissoesDaProposta()`
   lê a proposta assinada + o Formulário de origem e grava as linhas de
   comissão automaticamente, respeitando o split e travando acima do limite.

   window.ComissionamentoStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  async function listarRegras() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('regras_comissionamento').select('*').order('origem_venda');
    if (error) throw error;
    return data || [];
  }

  async function salvarRegra(origemVenda, patch) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { error } = await c.from('regras_comissionamento').update({
      ...patch, updated_at: new Date().toISOString(), updated_by: (window.__VP_USER || {}).email || null,
    }).eq('origem_venda', origemVenda);
    if (error) throw error;
  }

  /* Um split "requer aprovação de diretoria" quando o pct pedido ultrapassa
     o limite configurado pra aquela origem (ex.: Indicação Terceiros > 2%). */
  function requerAprovacaoDiretoria(regra, pct) {
    if (!regra || regra.limite_sem_aprovacao_pct == null) return false;
    return Number(pct) > Number(regra.limite_sem_aprovacao_pct);
  }

  /* ---------- Fila: propostas assinadas ainda sem comissão gerada ----------
     Sem isto, gerar comissão dependia de alguém lembrar de criar a linha na
     mão em Comissões — e a esteira "proposta assinada → comissão" perdia
     rastreabilidade com a origem real da venda. */
  async function listarPropostasAguardandoComissao() {
    const c = sb(); if (!c) return [];
    const { data: propostas } = await c.from('propostas')
      .select('id, numero_documento, numero_cotacao, titulo, valor_total, aprovada_em')
      .eq('status', 'aprovada').order('aprovada_em', { ascending: false }).limit(50);
    if (!propostas || !propostas.length) return [];
    const { data: comissoes } = await c.from('comissoes').select('proposta_id');
    const jaGerado = new Set((comissoes || []).map((x) => x.proposta_id).filter(Boolean));
    return propostas.filter((p) => !jaGerado.has(p.id));
  }

  /* ---------- Gera as linhas de comissão a partir da Proposta assinada ----------
     Busca origem_venda + vendedor no Formulário de Elevadores pelo mesmo
     Nº de Cotação da proposta (mesma fonte usada em proposta-heranca.js).
     Idempotente: se já existe comissão pra esta proposta, não duplica. */
  async function gerarComissoesDaProposta(propostaId) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');

    const { data: existentes } = await c.from('comissoes').select('id').eq('proposta_id', propostaId).limit(1);
    if (existentes && existentes.length) throw new Error('Comissão já gerada para esta proposta.');

    const { data: proposta, error: e1 } = await c.from('propostas').select('*').eq('id', propostaId).single();
    if (e1) throw e1;
    if (proposta.status !== 'aprovada') throw new Error('Só é possível gerar comissão de proposta assinada (aprovada).');

    const { data: formulario } = await c.from('formularios_elevador')
      .select('origem_venda, vendedor').eq('numero_cotacao', proposta.numero_cotacao).maybeSingle();
    const origemVenda = (formulario && formulario.origem_venda) || null;
    if (!origemVenda) throw new Error('Formulário de origem não informou "Origem da venda" — não é possível aplicar a regra de comissão.');

    const { data: regra, error: e2 } = await c.from('regras_comissionamento').select('*').eq('origem_venda', origemVenda).maybeSingle();
    if (e2) throw e2;
    if (!regra) throw new Error(`Nenhuma regra de comissionamento cadastrada para "${origemVenda}".`);

    const valorTotal = Number(proposta.valor_total) || 0;
    const vendedor = (formulario && formulario.vendedor) || 'Não informado';
    const now = new Date().toISOString();

    const linhas = (regra.splits || []).map((split) => {
      const pct = Number(split.pct) || 0;
      const requerAprovacao = requerAprovacaoDiretoria(regra, pct);
      return {
        vendedor: split.recebedor_tipo === 'vendedor_vp' || split.recebedor_tipo === 'vendedor_escamax' ? vendedor : split.recebedor_label,
        role: split.recebedor_label,
        faturado: valorTotal,
        pct: pct * 100,
        comissao: valorTotal * pct,
        status: requerAprovacao ? 'Aguardando aprovação diretoria' : 'Aguardando aprovação',
        numero_cotacao: proposta.numero_cotacao,
        proposta_id: propostaId,
        origem_venda: origemVenda,
        recebedor_tipo: split.recebedor_tipo,
        requer_aprovacao_diretoria: requerAprovacao,
        aprovador_necessario: requerAprovacao ? regra.aprovador : null,
        created_at: now,
      };
    });

    const { data, error } = await c.from('comissoes').insert(linhas).select();
    if (error) throw error;
    return data;
  }

  window.ComissionamentoStore = {
    listarRegras, salvarRegra, requerAprovacaoDiretoria,
    listarPropostasAguardandoComissao, gerarComissoesDaProposta,
  };
}());
