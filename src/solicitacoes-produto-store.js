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

  // Fluxo definido com o Gelson em 03/11/2026 (substitui o de 30/10, que avisava listas fixas):
  // 1) Quem abre a Solicitação ESCOLHE UMA pessoa da Engenharia (Gelson, Alexandre, Vinicius ou Brayan) para ser avisada
  //    por WhatsApp de que há uma Ficha Técnica a criar.
  // 2) Na edição da Ficha Técnica, quem terminou ESCOLHE UMA pessoa da Importação (Andreia, Beatriz ou Bianca) para
  //    conferir o NCM e publicar no Omie (avisarImportacao).
  // Quem foi avisado e quem de fato executa podem ser pessoas diferentes: a linha do tempo grava os dois separados
  // (tabela `solicitacao_produto_eventos`). O aviso é uma linha em `alertas` (o gi-avisos entrega no WhatsApp).
  // As listas de quem pode ser avisado ficam em window.SolProdTimeline (solicitacoes-produto-timeline-calc.js).
  const TL = () => window.SolProdTimeline;

  async function _avisar(emails, { idBase, title, sub, rota }) {
    try {
      const linhas = emails.map((email) => ({
        id: `${idBase}-${email.split('@')[0]}`,
        level: 'info',
        title,
        sub,
        module: 'Engenharia',
        rota: rota || null,
        resolved: false,
        destinatario_email: email,
      }));
      const { error } = await window.__VP_SB.sb.from('alertas').insert(linhas);
      if (error) { console.warn('[SolicitacoesProdutoStore] Erro ao avisar:', error); return false; }
      return true;
    } catch (e) {
      console.warn('[SolicitacoesProdutoStore] Erro ao avisar:', e);
      return false;
    }
  }

  /* Linha imutável da linha do tempo. O autor é SEMPRE o usuário logado (o banco confere). Falha de gravação nunca
     derruba a ação principal, mas é avisada na tela (Art. 9): sem o registro a linha do tempo fica com buraco. */
  async function _registrarEvento(solicitacaoId, tipo, { alvo, detalhe } = {}) {
    try {
      const u = window.__VP_USER || {};
      const { error } = await window.__VP_SB.sb.from('solicitacao_produto_eventos').insert([{
        solicitacao_id: solicitacaoId,
        tipo,
        ator_nome: u.nome || null,
        ator_email: u.email || '',
        alvo_nome: alvo ? alvo.nome : null,
        alvo_email: alvo ? alvo.email : null,
        detalhe: detalhe || {},
      }]);
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[SolicitacoesProdutoStore] evento não gravado:', tipo, e);
      window.toast?.('A ação foi feita, mas não consegui registrar na linha do tempo (' + tipo + '): ' + (e.message || e), 'error');
      return false;
    }
  }

  async function listarEventos(solicitacaoId) {
    const { data, error } = await window.__VP_SB.sb
      .from('solicitacao_produto_eventos')
      .select('*')
      .eq('solicitacao_id', solicitacaoId)
      .order('criado_em', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  /* Eventos de várias solicitações de uma vez (indicador de etapas da lista): { [solicitacao_id]: [eventos] }. */
  async function listarEventosDeVarias(ids) {
    const lista = (ids || []).filter((x) => x != null);
    if (!lista.length) return {};
    const { data, error } = await window.__VP_SB.sb
      .from('solicitacao_produto_eventos')
      .select('solicitacao_id, tipo, criado_em')
      .in('solicitacao_id', lista);
    if (error) throw error;
    const mapa = {};
    (data || []).forEach((e) => { (mapa[e.solicitacao_id] = mapa[e.solicitacao_id] || []).push(e); });
    return mapa;
  }

  /* O título do aviso leva um resumo do pedido: o gi-avisos agrupa por 24 h os avisos de mesmo título (sem números),
     então "Nova Solicitação — SOL-…" de duas solicitações no mesmo dia faria a segunda não sair. */
  function _notificarEngenharia(solicitacao, alvo) {
    return _avisar([alvo.email], {
      idBase: `sol-${solicitacao.numero_solicitacao}`,
      title: `${TL().resumo(solicitacao.descricao_inicial, 40)} — pedido de Ficha Técnica`,
      sub: [`${solicitacao.numero_solicitacao}`, solicitacao.cliente_nome, solicitacao.categoria_sku, `pedido por ${solicitacao.solicitante_nome}`].filter(Boolean).join(' · '),
      rota: `/engenharia/solicitacoes-produto/${solicitacao.id}`,
    });
  }

  /* Ficha → solicitação de origem (se houver). Fichas criadas direto na Ficha Técnica não têm. */
  async function porFicha(fichaId) {
    if (!fichaId) return null;
    try {
      const { data, error } = await window.__VP_SB.sb
        .from('solicitacoes_produto')
        .select('*')
        .eq('ficha_tecnica_id', fichaId)
        .is('excluido_em', null)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    } catch (e) {
      console.warn('[SolicitacoesProdutoStore] solicitação da ficha indisponível:', e);
      return null;
    }
  }

  /* Chamado na edição da Ficha Técnica: avisa UMA pessoa da Importação para conferir o NCM e publicar no Omie. */
  async function avisarImportacao(solicitacao, email, nomeProduto) {
    const alvo = TL().pessoa(TL().IMPORTACAO, email);
    if (!alvo) throw new Error('Escolha Andreia, Beatriz ou Bianca.');
    const ok = await _avisar([alvo.email], {
      idBase: `sol-ficha-${solicitacao.numero_solicitacao}-${Date.now().toString(36)}`,
      title: `${TL().resumo(nomeProduto || solicitacao.descricao_inicial, 40)} — ficha pronta: conferir NCM e publicar`,
      sub: [`${solicitacao.numero_solicitacao}`, solicitacao.categoria_sku, solicitacao.cliente_nome].filter(Boolean).join(' · '),
      rota: solicitacao.ficha_tecnica_id ? `/engenharia/ficha-tecnica/${solicitacao.ficha_tecnica_id}` : '/engenharia/ficha-tecnica',
    });
    if (!ok) throw new Error('Não consegui enviar o aviso para ' + alvo.nome + '.');
    await _registrarEvento(solicitacao.id, 'aviso_importacao', { alvo });
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Solicitações de Produto', acao: 'Avisou a Importação para conferir NCM e publicar',
      alvo: solicitacao.numero_solicitacao, alvo_id: solicitacao.id, detalhe: { avisado: alvo.email },
    });
    return alvo;
  }

  /* Chamado depois de publicar a ficha no Omie: registra quem publicou na linha do tempo da solicitação de origem. */
  async function registrarPublicacao(fichaId, { codigo_produto, republicou } = {}) {
    const sol = await porFicha(fichaId);
    if (!sol) return false;
    return _registrarEvento(sol.id, 'ficha_publicada', {
      detalhe: { codigo_produto: codigo_produto || null, acao: republicou ? 'republicou ficha no Omie' : 'publicou ficha no Omie' },
    });
  }

  /* ---------- Chat interno e devolução com pendência (8.3, spec de 04/11/2026) ---------- */
  const _sbc = () => { const c = window.__VP_SB && window.__VP_SB.sb; if (!c) throw new Error('Supabase não carregado'); return c; };

  let _adminCache = null;
  async function souAdmin() {
    if (_adminCache !== null) return _adminCache;
    try {
      const email = String((window.__VP_USER || {}).email || '').toLowerCase();
      const { data } = await _sbc().from('perfis').select('nivel').eq('email', email).maybeSingle();
      _adminCache = !!data && data.nivel === 'Administrador';
    } catch (e) { _adminCache = false; }
    return _adminCache;
  }

  /* Feriados que contam no SLA (mesma tabela do motor de gatilhos). Falha de leitura = só fim de semana, e avisa no console. */
  async function _feriados() {
    try {
      const { data, error } = await _sbc().from('calendario_feriados').select('data, conta_no_sla').eq('ativo', true);
      if (error) throw error;
      return (data || []).filter((l) => l.conta_no_sla !== false).map((l) => l.data);
    } catch (e) { console.warn('[SolicitacoesProdutoStore] feriados indisponíveis — prazo usa só fim de semana', e); return []; }
  }

  /* A Ficha já foi publicada no Omie? (lê omie_publicado_em, NÃO a `etapa`: 93 fichas publicadas e só 1 em "publicado".)
     null = não consegui ler (a função do banco confere de qualquer modo). */
  async function fichaPublicada(sol) {
    if (!sol || !sol.ficha_tecnica_id) return false;
    try {
      const { data, error } = await _sbc().from('fichas_tecnicas').select('omie_publicado_em').eq('id', sol.ficha_tecnica_id).maybeSingle();
      if (error) throw error;
      return !!(data && data.omie_publicado_em);
    } catch (e) { console.warn('[SolicitacoesProdutoStore] não li a publicação da ficha:', e); return null; }
  }

  async function listarMensagens(solicitacaoId) {
    const { data, error } = await _sbc().from('solicitacao_produto_mensagens')
      .select('*').eq('solicitacao_id', solicitacaoId).order('criado_em', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  /* Aviso por WhatsApp (alertas → gi-avisos). O título leva um resumo da mensagem: o gi-avisos agrupa por 24 h os avisos de
     mesmo título sem números e ignora "teste", "claude" e "excluir". Devolve { enviados, falhas } — nunca silencioso (Art. 9). */
  async function _avisarMensagem(sol, emails, texto, quem) {
    const lista = Array.from(new Set((emails || []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean)));
    if (!lista.length) return { enviados: 0, falhas: 0 };
    const ok = await _avisar(lista, {
      idBase: `sol-chat-${sol.numero_solicitacao}-${Date.now().toString(36)}`,
      title: `${TL().resumo(texto, 40)} — conversa sobre pedido de produto`,
      sub: [sol.numero_solicitacao, quem ? quem + ' escreveu' : null, sol.cliente_nome].filter(Boolean).join(' · '),
      rota: `/engenharia/solicitacoes-produto/${sol.id}/chat`,
    });
    return ok ? { enviados: lista.length, falhas: 0 } : { enviados: 0, falhas: lista.length };
  }

  async function enviarMensagem(sol, { texto, anexos, setor, whatsapp }) {
    const u = window.__VP_USER || {};
    const t = String(texto || '').trim();
    if (!t) throw new Error('Escreva a mensagem.');
    const { error } = await _sbc().from('solicitacao_produto_mensagens').insert([{
      solicitacao_id: sol.id, autor_email: String(u.email || '').toLowerCase(), autor_nome: u.nome || null,
      setor, tipo: 'mensagem', texto: t, anexos: anexos || [],
    }]);
    if (error) throw new Error(error.message);
    return _avisarMensagem(sol, whatsapp, t, u.nome);
  }

  /* Abre a pendência (a função do banco confere status, ficha publicada e pendência já aberta, e grava mensagem + evento). */
  async function devolver(sol, { para, motivo, setor, cita, whatsapp }) {
    const u = window.__VP_USER || {};
    const prazo = TL().prazoDevolucao(new Date(), await _feriados());
    const { error } = await _sbc().rpc('solicitacao_devolver', {
      p_id: sol.id, p_para: para, p_motivo: motivo, p_setor_autor: setor, p_autor_nome: u.nome || null,
      p_cita_email: cita ? cita.email : null, p_cita_nome: cita ? cita.nome : null, p_prazo: prazo.toISOString(),
    });
    if (error) throw new Error(error.message);
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Solicitações de Produto', acao: 'Devolveu a solicitação — ' + (TL().DESTINOS[para] || para),
      alvo: sol.numero_solicitacao, alvo_id: sol.id, detalhe: { para, prazo: prazo.toISOString() },
    });
    const aviso = await _avisarMensagem(sol, whatsapp, 'Devolvida: ' + motivo, u.nome);
    return { prazo, aviso };
  }

  async function responder(sol, { texto, anexos, setor, whatsapp }) {
    const u = window.__VP_USER || {};
    const { error } = await _sbc().rpc('solicitacao_responder', {
      p_id: sol.id, p_texto: texto, p_setor_autor: setor, p_autor_nome: u.nome || null, p_anexos: anexos || [],
    });
    if (error) throw new Error(error.message);
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Solicitações de Produto', acao: 'Respondeu a devolução', alvo: sol.numero_solicitacao, alvo_id: sol.id,
    });
    return _avisarMensagem(sol, whatsapp, 'Resposta: ' + texto, u.nome);
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
      const listas = await Promise.all([_codigosAtivos(c, 'importacao_varejo_produtos', true), _codigosAtivos(c, 'pcp_produtos', true)]);
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
      // Quem abre a solicitação escolhe UMA pessoa da Engenharia para ser avisada (decisão de 03/11/2026).
      const avisado = TL().pessoa(TL().ENGENHARIA, dados.avisar_email);
      if (!avisado) throw new Error('Escolha quem da Engenharia deve ser avisado(a).');
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
      await _registrarEvento(data.id, 'aberta');
      const avisou = await _notificarEngenharia(data, avisado);
      if (!avisou) window.toast?.('Solicitação criada, mas o aviso para ' + avisado.nome + ' não saiu. Avise essa pessoa.', 'error');
      await _registrarEvento(data.id, 'aviso_engenharia', { alvo: avisado, detalhe: avisou ? {} : { aviso_enviado: false } });
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
    await _registrarEvento(id, 'analise_iniciada');
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
    // Não avisa mais a Importação aqui: quem termina a ficha escolhe quem avisar, na edição da Ficha Técnica.
    await _registrarEvento(id, 'ficha_criada', { detalhe: { ficha_tecnica_id } });
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
    listarEventos,
    listarEventosDeVarias,
    souAdmin,
    fichaPublicada,
    listarMensagens,
    enviarMensagem,
    devolver,
    responder,
    porFicha,
    avisarImportacao,
    registrarPublicacao,
  };
})();
