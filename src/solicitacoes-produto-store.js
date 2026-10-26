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

  // Listas do formulário FO-612 (Solicitação de Cadastro de Produto) — aba "Dados de lista".
  const TIPOS_CADASTRO = [
    { valor: 'pecas', label: 'Peças e equipamentos', ajuda: 'Para revenda / uso em equipamentos' },
    { valor: 'insumo', label: 'Insumo, consumo, matéria-prima ou ativo', ajuda: 'Uso interno' },
  ];
  const UNIDADES = ["Barra (BR)","Chapa (CH)","Cilindro (CIL)","Conjunto (CJ)","Cento (CNT)","Caixa (CX)","Fardo (FD)","Folha (FL)","Frasco (FR)","Grama (G)","Galão (GL)","Jogo (JG)","Quilograma (KG)","Kit (KIT)","Litro (L)","Lata (LTA)","Metro (M)","Peça (PC)","Pacote (PCT)","Placa (PL)","Par (PR)","Rolo (RL)","Saco (SC)","Tambor (TB)","Tubo (TUB)","Unidade (UN)"];
  const FAMILIAS_INSUMO = ["ATIVO","USO E CONSUMO","INSUMOS","MATÉRIA PRIMA","EPI","LIMPEZA - EQP","LIMPEZA - MATERIAL","INFORMÁTICA","COPA"];
  const FAMILIAS_PECAS = ["CENTOPÉIAS E ROLOS DE CURVA","COMPONENTES ELETROMECÂNICOS E ELETRÔNICOS","CORREIAS","CORRENTES DE DEGRAUS/PALLETS","CORRENTES MOTRIZ/CORRIMÃO","CORRIMÃOS","DEGRAUS","DISPOSITIVOS DE FRENAGEM","DISPOSITIVOS MECÂNICOS DE TRAÇÃO","EIXOS DE DEGRAU E PARTES","EIXOS MOTRIZ/CORRIMÃO E PARTES","ELEVADORES/BARREIRA","ELEVADORES/BOTOEIRAS","ELEVADORES/CABOS E CINTAS","ELEVADORES/GUIAS","ELEVADORES/MÁQUINAS","ELEVADORES/OPERADOR DE PORTAS","ELEVADORES/PEÇAS/COMPONENTES","ELEVADORES/PORTAS","ELEVADORES/QUADRO DE COMANDOS","EQP/ELEVADORES CARGA","EQP/ELEVADORES PASSAGEIROS","EQP/ESCADA","EQP/ESTEIRA","EQP/PLATAFORMA","EQUIPAMENTOS","ESCADA/QUADRO DE COMANDOS","GUIAS E PERFIS","INOVANCE/BOTOEIRAS","INOVANCE/CABOS","INOVANCE/PORTAS","INOVANCE/QUADRO DE COMANDO","INSERTOS","ITENS DE SEGURANÇA","LUBRIFICAÇÃO E PARTES","MOTORES E PARTES","PALLETS","PARAFUSOS / PORCAS / ARRUELAS / PRESILHAS","PENTES","POLIAS","ROLDANAS / ROLOS / ROLETES"];
  const ESTOQUE_MIN = ["1","5","10","15","30","120","135"];
  const APLICACOES = ['Escadas ou Esteiras Rolantes', 'Elevadores', 'Outra'];
  const LOCAIS_COMPRA = ['Nacional', 'Importada'];
  // Campos que só existem para "Peças e equipamentos" (no insumo são descartados).
  const DC_SO_PECAS = ['referencia', 'marca', 'serie'];
  const DC_CHAVES = ['descricao_comercial', 'referencia', 'marca', 'modelo', 'unidade', 'familia', 'funcao', 'material', 'serie',
    'compra', 'leadtime', 'caracteristica', 'part_number', 'cor', 'aplicacao', 'estoque_min', 'estoque_min_justif', 'cliente_whatsapp'];

  function _dadosCadastro(dados) {
    const tipo = dados.tipo_cadastro || 'pecas';
    const dc = dados.dc || {};
    const out = {};
    DC_CHAVES.forEach((k) => {
      if (tipo === 'insumo' && DC_SO_PECAS.includes(k)) return;
      if (k === 'cliente_whatsapp' && !dados.foiPedidoCliente) return;
      const v = dc[k] == null ? '' : String(dc[k]).trim();
      if (v) out[k] = v;
    });
    if (!out.estoque_min) delete out.estoque_min_justif;
    return out;
  }

  // Fluxo definido com o usuário em 20/09/2026:
  // 1) Solicitação enviada avisa a Engenharia (Maurício), que designa quem da
  //    equipe resolve.
  // 2) Engenharia termina (marcarPronto) avisa Bianca (Importação), que
  //    avalia/aprova/reprova e designa quem publica no Omie.
  const EMAIL_ENGENHARIA_RESPONSAVEL = 'mauricio.araujo@verticalparts.com.br'; // 16/10/2026: Maurício no lugar da Arilene (inativa)
  const EMAIL_IMPORTACAO_RESPONSAVEL = 'bianca@verticalparts.com.br';

  async function _notificarEngenharia(solicitacao) {
    try {
      const { error } = await window.__VP_SB.sb.from('alertas').insert([{
        id: `sol-${solicitacao.numero_solicitacao}`,
        level: 'info',
        title: `Nova Solicitação de Produto — ${solicitacao.numero_solicitacao}`,
        sub: [solicitacao.cliente_nome, solicitacao.categoria_sku, solicitacao.solicitante_nome].filter(Boolean).join(' · '),
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
        sub: [solicitacao.cliente_nome, solicitacao.categoria_sku, 'Engenharia: ' + (solicitacao.engenheiro_responsavel || '—')].filter(Boolean).join(' · '),
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

  /* Prefixos de código (VPER, VPEL, VPIN…) que existem ativos no catálogo — alimenta a lista "Código".
     Fonte: catálogo de importação + produtos do PCP já espelhados do Omie. Prefixos com "geracao: true"
     têm geração automática do próximo número na publicação (function proximo-codigo-produto);
     os demais a Engenharia informa o código completo na Ficha. */
  const PREFIXOS_COM_GERACAO = ['VPEL', 'VPER', 'VPB', 'VPMP'];
  const _DESC_PREFIXO = {
    VPEL: 'Peça de Elevador', VPER: 'Peça de Escada/Esteira Rolante', VPB: 'Peça fornecida por BST', VPMP: 'Matéria-Prima',
    VPIN: 'Insumo', VPKIT: 'Kit', VPCON: 'Consumo', VPAT: 'Ativo',
  };
  async function _codigosAtivos(c, tabela, filtroAtivo) {
    const out = [];
    for (let de = 0; de < 20000; de += 1000) {
      let q = c.from(tabela).select('codigo').range(de, de + 999);
      if (filtroAtivo) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      (data || []).forEach((r) => out.push(r.codigo));
      if (!data || data.length < 1000) break;
    }
    return out;
  }
  async function listarPrefixosCodigo() {
    const conta = {};
    try {
      const c = window.__VP_SB.sb;
      const listas = await Promise.all([_codigosAtivos(c, 'importacao_varejo_produtos', true), _codigosAtivos(c, 'pcp_produtos', false)]);
      const vistos = new Set();
      listas.flat().forEach((cod) => {
        const code = String(cod || '').toUpperCase().trim();
        if (!code || vistos.has(code)) return;
        vistos.add(code);
        const m = code.match(/^(VP[A-Z]*)-?\d/);
        if (m) conta[m[1]] = (conta[m[1]] || 0) + 1;
      });
    } catch (e) { console.warn('[SolicitacoesProdutoStore] prefixos do catálogo indisponíveis:', e); }
    PREFIXOS_COM_GERACAO.forEach((p) => { if (!conta[p]) conta[p] = 0; });
    const lista = Object.keys(conta)
      .filter((p) => PREFIXOS_COM_GERACAO.includes(p) || conta[p] >= 2)
      .map((p) => ({ prefixo: p, qtd: conta[p], geracao: PREFIXOS_COM_GERACAO.includes(p), descricao: _DESC_PREFIXO[p] || '' }));
    lista.sort((a, b) => (b.geracao - a.geracao) || (b.qtd - a.qtd) || a.prefixo.localeCompare(b.prefixo));
    return lista;
  }

  async function criar(dados) {
    try {
      const payload = {
        numero_solicitacao: _gerarNumero(),
        status: 'novo',
        tipo_equipamento: dados.tipo_equipamento,
        categoria_sku: dados.categoria_sku || null, // opcional: só o prefixo do código (VPER, VPEL…)
        tipo_cadastro: dados.tipo_cadastro || 'pecas',
        dados_cadastro: _dadosCadastro(dados),
        solicitante_nome: dados.solicitante_nome,
        solicitante_email: dados.solicitante_email,
        // Cliente só entra se a solicitação de fato nasceu de um pedido de
        // cliente (form.foiPedidoCliente) — nunca obrigatório.
        cliente_nome: dados.foiPedidoCliente ? (dados.cliente_nome || null) : null,
        cliente_industria: dados.foiPedidoCliente ? (dados.cliente_industria || null) : null,
        cliente_contato: dados.foiPedidoCliente ? (dados.cliente_contato || null) : null,
        descricao_inicial: dados.descricao_inicial,
        observacoes_comercial: dados.observacoes_comercial,
        fornecedor_contato: dados.fornecedor_contato || null,
        link_produto: dados.link_produto || null,
        anexos: dados.anexos || [],
      };

      const { data, error } = await window.__VP_SB.sb
        .from('solicitacoes_produto')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      console.log('[SolicitacoesProdutoStore] Solicitação criada:', data);
      if (window.VPLog) window.VPLog.registrar({
        modulo: 'Solicitações de Produto', acao: 'Criou solicitação de produto',
        alvo: data.numero_solicitacao, alvo_id: data.id,
        detalhe: { tipo_equipamento: data.tipo_equipamento, categoria_sku: data.categoria_sku, cliente_nome: data.cliente_nome || null },
      });
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
        .select('*')
        .is('excluido_em', null);

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

    const atualizada = await atualizar(id, {
      status: 'em_analise',
      engenheiro_responsavel: user.email,
      data_inicio_analise: agora,
    });
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Solicitações de Produto', acao: 'Iniciou análise da solicitação',
      alvo: atualizada.numero_solicitacao, alvo_id: id,
    });
    return atualizada;
  }

  async function marcarPronto(id, especificacoes, desenho_url, complementos_descobertos) {
    const atualizada = await atualizar(id, {
      status: 'pronto',
      especificacoes_completas: especificacoes,
      desenho_url: desenho_url,
      complementos_descobertos: complementos_descobertos,
      data_conclusao: new Date().toISOString(),
    });
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Solicitações de Produto', acao: 'Marcou solicitação como pronta',
      alvo: atualizada.numero_solicitacao, alvo_id: id,
    });
    _notificarImportacao(atualizada);
    return atualizada;
  }

  async function converterEmFicha(id, ficha_tecnica_id) {
    const atualizada = await atualizar(id, {
      status: 'convertido_em_ficha',
      ficha_tecnica_id: ficha_tecnica_id,
    });
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Solicitações de Produto', acao: 'Converteu solicitação em Ficha Técnica',
      alvo: atualizada.numero_solicitacao, alvo_id: id, detalhe: { ficha_tecnica_id },
    });
    return atualizada;
  }

  /* Soft-delete (excluido_em/excluido_por) — nada aponta de volta pra
     solicitacoes_produto (sem FK), então não há risco de registro órfão,
     mas o registro fica guardado no banco (recuperável pelo suporte) em
     vez de apagado de verdade, mesmo padrão de leads (comercial.jsx).
     .select('id') pra confirmar que a linha foi mesmo alterada — um update
     barrado por RLS volta sem erro e sem linhas. */
  async function excluir(id) {
    try {
      const { data, error } = await window.__VP_SB.sb
        .from('solicitacoes_produto')
        .update({
          excluido_em: new Date().toISOString(),
          excluido_por: (window.__VP_USER && window.__VP_USER.email) || null,
        })
        .eq('id', id)
        .select('id');

      if (error) throw error;
      if (!data || !data.length) throw new Error('nenhum registro foi alterado');
      console.log('[SolicitacoesProdutoStore] Solicitação excluída:', id);
      if (window.VPLog) window.VPLog.registrar({
        modulo: 'Solicitações de Produto', acao: 'Excluiu solicitação de produto', alvo_id: id,
      });
      return true;
    } catch (e) {
      console.error('[SolicitacoesProdutoStore] Erro ao excluir:', e);
      throw e;
    }
  }

  /* ---------- Anexos (imagem/PDF do produto) ----------
     Mesmo bucket público "engenharia" já usado por Projeto de Elevadores/
     P.I./Termo de Entrega — sem bucket novo. A solicitação ainda não tem
     id no momento do upload (formulário "Nova"), então usa uma pasta
     temporária (tmp-<random>), igual ao padrão já usado em fichas-imagens. */
  function _pastaTemp() { return 'tmp-' + Math.random().toString(36).slice(2, 10); }

  async function uploadAnexo(file, solicitacaoIdOuPastaTemp) {
    const c = window.__VP_SB && window.__VP_SB.sb;
    if (!c) throw new Error('Supabase não carregado');
    const pasta = solicitacaoIdOuPastaTemp || _pastaTemp();
    const path = `solicitacoes/${pasta}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
    const { error } = await c.storage.from('engenharia').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = c.storage.from('engenharia').getPublicUrl(path);
    const tipo = file.type && file.type.startsWith('image/') ? 'imagem' : 'pdf';
    return { nome: file.name, url: data.publicUrl, tipo, path };
  }

  async function removerAnexo(path) {
    const c = window.__VP_SB && window.__VP_SB.sb;
    if (!c || !path) return;
    await c.storage.from('engenharia').remove([path]);
  }

  return {
    TIPOS,
    STATUS_LIST,
    CATEGORIAS_SKU,
    listarPrefixosCodigo,
    TIPOS_CADASTRO,
    UNIDADES,
    FAMILIAS_INSUMO,
    FAMILIAS_PECAS,
    ESTOQUE_MIN,
    APLICACOES,
    LOCAIS_COMPRA,
    criar,
    listar,
    obter,
    atualizar,
    uploadAnexo,
    removerAnexo,
    _pastaTemp,
    iniciarAnalise,
    marcarPronto,
    converterEmFicha,
    excluir,
  };
})();
