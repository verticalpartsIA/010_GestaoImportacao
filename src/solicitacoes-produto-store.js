/* ============================================================
   solicitacoes-produto-store.js — Gerenciamento de solicitações de produto
   ============================================================ */

window.SolicitacoesProdutoStore = (() => {
  const TIPOS = ['elevador', 'escada_rolante', 'esteira'];
  const STATUS_LIST = ['novo', 'em_analise', 'aguardando_desenho', 'pronto', 'convertido_em_ficha'];
  // Categoria de SKU — define o prefixo do código no Omie. Sem trava por
  // setor: tanto Comercial quanto Importação podem escolher qualquer uma.
  const CATEGORIAS_SKU = [
    { valor: 'VPEL', label: 'VPEL — Peça de Elevador (VerticalParts)' },
    { valor: 'VPER', label: 'VPER — Peça de Escada/Esteira Rolante (VerticalParts)' },
    { valor: 'VPB', label: 'VPB — Peça fornecida por BST' },
    { valor: 'VPMP', label: 'VPMP — Matéria-Prima (VerticalParts)' },
  ];

  // Fluxo definido com o usuário em 20/09/2026:
  // 1) Solicitação enviada avisa Arilene (Engenharia), que designa quem da
  //    equipe resolve.
  // 2) Engenharia termina (marcarPronto) avisa Bianca (Importação), que
  //    avalia/aprova/reprova e designa quem publica no Omie.
  const EMAIL_ENGENHARIA_RESPONSAVEL = 'arilene.avila@verticalparts.com.br';
  const EMAIL_IMPORTACAO_RESPONSAVEL = 'bianca@verticalparts.com.br';

  async function _notificarEngenharia(solicitacao) {
    try {
      const { error } = await window.__VP_SB.sb.from('alertas').insert([{
        id: `sol-${solicitacao.numero_solicitacao}`,
        level: 'info',
        title: `Nova Solicitação de Produto — ${solicitacao.numero_solicitacao}`,
        sub: `${solicitacao.cliente_nome} · ${solicitacao.categoria_sku} · ${solicitacao.solicitante_nome}`,
        module: 'Engenharia',
        resolved: false,
        destinatario_email: EMAIL_ENGENHARIA_RESPONSAVEL,
      }]);
      if (error) console.warn('[SolicitacoesProdutoStore] Erro ao notificar Engenharia:', error);
    } catch (e) {
      console.warn('[SolicitacoesProdutoStore] Erro ao notificar Engenharia:', e);
    }
  }

  async function _notificarImportacao(solicitacao) {
    try {
      const { error } = await window.__VP_SB.sb.from('alertas').insert([{
        id: `sol-pronto-${solicitacao.numero_solicitacao}`,
        level: 'info',
        title: `Solicitação pronta para avaliação — ${solicitacao.numero_solicitacao}`,
        sub: `${solicitacao.cliente_nome} · ${solicitacao.categoria_sku} · Engenharia: ${solicitacao.engenheiro_responsavel || '—'}`,
        module: 'Engenharia',
        resolved: false,
        destinatario_email: EMAIL_IMPORTACAO_RESPONSAVEL,
      }]);
      if (error) console.warn('[SolicitacoesProdutoStore] Erro ao notificar Importação:', error);
    } catch (e) {
      console.warn('[SolicitacoesProdutoStore] Erro ao notificar Importação:', e);
    }
  }

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
        categoria_sku: dados.categoria_sku,
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
      _notificarEngenharia(data);
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

  async function marcarPronto(id, especificacoes, desenho_url, complementos_descobertos) {
    const atualizada = await atualizar(id, {
      status: 'pronto',
      especificacoes_completas: especificacoes,
      desenho_url: desenho_url,
      complementos_descobertos: complementos_descobertos,
      data_conclusao: new Date().toISOString(),
    });
    _notificarImportacao(atualizada);
    return atualizada;
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
    CATEGORIAS_SKU,
    criar,
    listar,
    obter,
    atualizar,
    iniciarAnalise,
    marcarPronto,
    converterEmFicha,
  };
})();
