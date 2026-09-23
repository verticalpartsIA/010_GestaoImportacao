/* ============================================================
   cotacao-quadro-comando-store.js
   Gerenciamento de cotações de Quadro de Comando — fluxo completo:
   Pedido QC → Cotação a Fornecedor → Precificação → Proposta
   ============================================================ */

window.CotacaoQuadroComandoStore = {
  async listarCotacoes() {
    const c = window.__VP_SB?.sb;
    if (!c) throw new Error('Supabase não inicializado');

    const { data, error } = await c.from('quadros_comando').select(`
      id, numero_pedido, numero_cotacao, status, criado_em, cliente_id,
      tipo_aplicacao, origem_fabricacao,
      maquina:quadros_comando_maquina(potencia_kw, tensao_v)
    `).order('criado_em', { ascending: false }).limit(200);

    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      numero_pedido: row.numero_pedido,
      numero_cotacao: row.numero_cotacao,
      status: row.status,
      criado_em: row.criado_em,
      cliente_id: row.cliente_id,
      tipo_aplicacao: row.tipo_aplicacao,
      origem_fabricacao: row.origem_fabricacao,
      potencia_kw: row.maquina?.potencia_kw,
      tensao_v: row.maquina?.tensao_v,
    }));
  },

  async obter(quadroId) {
    const c = window.__VP_SB?.sb;
    if (!c) throw new Error('Supabase não inicializado');

    const { data, error } = await c.from('quadros_comando').select('*')
      .eq('id', quadroId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async gerar(quadroId, fornecedorNome, contato) {
    const c = window.__VP_SB?.sb;
    if (!c) throw new Error('Supabase não inicializado');

    const quadro = await this.obter(quadroId);
    if (!quadro) throw new Error('Pedido não encontrado');

    // Gera número de cotação único
    const { data: existentes } = await c.from('quadros_comando')
      .select('numero_cotacao').not('numero_cotacao', 'is', null);
    const proximoNum = Math.max(0, ...(existentes || []).map(r => parseInt(r.numero_cotacao) || 0)) + 1;
    const numeroCotacao = String(proximoNum).padStart(6, '0');

    // Atualiza o quadro com número de cotação
    const { error: errUpd } = await c.from('quadros_comando')
      .update({ numero_cotacao: numeroCotacao }).eq('id', quadroId);
    if (errUpd) throw errUpd;

    return { numeroCotacao, quadro };
  },

  async atualizarStatusCotacao(quadroId, novoStatus) {
    const c = window.__VP_SB?.sb;
    if (!c) throw new Error('Supabase não inicializado');

    const { error } = await c.from('quadros_comando')
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq('id', quadroId);
    if (error) throw error;
  },
};
