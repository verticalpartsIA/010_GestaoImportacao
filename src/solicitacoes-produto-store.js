/* ============================================================
   solicitacoes-produto-store.js — Gerenciamento de solicitações de produto
   ============================================================ */

window.SolicitacoesProdutoStore = (() => {
  const TIPOS = ['elevador', 'escada_rolante', 'esteira'];
  const STATUS_LIST = ['novo', 'em_analise', 'aguardando_desenho', 'pronto', 'convertido_em_ficha'];

  function _gerarNumero() {
    const now = new Date();
    const ano = now.getFullYear();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const dia = String(now.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 10000)).padStart(5, '0');
    return `SOL-${ano}${mes}${dia}-${random}`;
  }

  async function criar(dados) {
    try {
      const payload = {
        numero_solicitacao: _gerarNumero(),
        status: 'novo',
        tipo_equipamento: dados.tipo_equipamento,
        solicitante_nome: dados.solicitante_nome,
        solicitante_email: dados.solicitante_email,
        cliente_nome: dados.cliente_nome,
        cliente_industria: dados.cliente_industria,
        descricao_inicial: dados.descricao_inicial,
        observacoes_comercial: dados.observacoes_comercial,
        fotos_url: dados.fotos_url || [],
      };

      const { data, error } = await window.__VP_SB.sb
        .from('solicitacoes_produto')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      console.log('[SolicitacoesProdutoStore] Solicitação criada:', data);
      return data;
    } catch (e) {
      console.error('[SolicitacoesProdutoStore] Erro ao criar:', e);
      throw e;
    }
  }

  async function listar(filtros = {}) {
    try {
      let query = window.__VP_SB.sb
        .from('solicitacoes_produto')
        .select('*');

      if (filtros.status) {
        query = query.eq('status', filtros.status);
      }
      if (filtros.tipo_equipamento) {
        query = query.eq('tipo_equipamento', filtros.tipo_equipamento);
      }
      if (filtros.solicitante_email) {
        query = query.eq('solicitante_email', filtros.solicitante_email);
      }

      const { data, error } = await query.order('data_criacao', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('[SolicitacoesProdutoStore] Erro ao listar:', e);
      return [];
    }
  }

  async function obter(id) {
    try {
      const { data, error } = await window.__VP_SB.sb
        .from('solicitacoes_produto')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (e) {
      console.error('[SolicitacoesProdutoStore] Erro ao obter:', e);
      return null;
    }
  }

  async function atualizar(id, dados) {
    try {
      const payload = { ...dados, data_atualizacao: new Date().toISOString() };

      const { data, error } = await window.__VP_SB.sb
        .from('solicitacoes_produto')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      console.log('[SolicitacoesProdutoStore] Solicitação atualizada:', data);
      return data;
    } catch (e) {
      console.error('[SolicitacoesProdutoStore] Erro ao atualizar:', e);
      throw e;
    }
  }

  async function iniciarAnalise(id) {
    const agora = new Date().toISOString();
    const user = window.__VP_USER || {};

    return atualizar(id, {
      status: 'em_analise',
      engenheiro_responsavel: user.email,
      data_inicio_analise: agora,
    });
  }

  async function marcarPronto(id, especificacoes, desenho_url) {
    return atualizar(id, {
      status: 'pronto',
      especificacoes_completas: especificacoes,
      desenho_url: desenho_url,
      data_conclusao: new Date().toISOString(),
    });
  }

  async function converterEmFicha(id, ficha_tecnica_id) {
    return atualizar(id, {
      status: 'convertido_em_ficha',
      ficha_tecnica_id: ficha_tecnica_id,
    });
  }

  return {
    TIPOS,
    STATUS_LIST,
    criar,
    listar,
    obter,
    atualizar,
    iniciarAnalise,
    marcarPronto,
    converterEmFicha,
  };
})();
