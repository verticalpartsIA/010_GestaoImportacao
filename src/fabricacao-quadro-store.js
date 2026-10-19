/* ============================================================
   fabricacao-quadro-store.js — Evolução da Fabricação do Quadro de
   Comando (19/10/2026). Store Supabase direto, mesmo padrão de
   acompanhamento-obra-store.js (ver comentários naquele arquivo):
   link FIXO por OP (fabricacao_quadro_links), semeado com
   fabricacao_quadro_status (1 linha por item, flegado:false) no 1º
   acesso — é essa semeadura que faz o progresso aparecer em 0%
   (não "sem link nenhum") assim que o link é gerado.

   Diferente do Diário de Obra: aqui o "operador" É o próprio
   sistema (tela interna do PCP/MES), mas a tela pública (link do
   Quadro) também pode flegar — por isso marcarEtapa aceita
   flegadoPor nulo (veio do link público) ou um e-mail/label (veio
   de dentro do sistema), mesmo padrão de
   acompanhamento-obra-store.js:registrarLancamento.

   O cálculo de progresso/pausa NÃO mora aqui — vem de
   window.FabricacaoQuadroCalc (Task 2, fabricacao-quadro-calc.js),
   puro e já testado. Este arquivo só busca/grava linhas.

   window.FabricacaoQuadroStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return window.__VP_SB && window.__VP_SB.sb; }

  function gerarToken() {
    const bytes = new Uint8Array(24);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function listarItens() {
    const c = sb();
    const { data, error } = await c.from('fabricacao_quadro_itens').select('*').order('ordem');
    if (error) throw error;
    return data || [];
  }

  async function obterLink(ordemId) {
    const c = sb();
    const { data } = await c.from('fabricacao_quadro_links').select('*').eq('ordem_id', ordemId).maybeSingle();
    return data || null;
  }

  /* Gera o link (se ainda não existir) e semeia fabricacao_quadro_status
     com um item por linha (flegado:false) — mesmo papel de
     acompanhamento-obra-store.js:criarOuObterLink. */
  async function criarOuObterLink(ordemId, criadoPor) {
    const c = sb();
    const existente = await obterLink(ordemId);
    if (existente) return existente;

    const itens = await listarItens();
    const token = gerarToken();
    const { data: link, error } = await c.from('fabricacao_quadro_links')
      .insert({ ordem_id: ordemId, token, criado_por: criadoPor || null })
      .select().single();
    if (error) throw error;

    if (itens.length) {
      const { error: errSeed } = await c.from('fabricacao_quadro_status').upsert(
        itens.map((it) => ({ ordem_id: ordemId, item_id: it.id, flegado: false })),
        { onConflict: 'ordem_id,item_id', ignoreDuplicates: true }
      );
      if (errSeed) throw errSeed;
    }
    return link;
  }

  /* ordem = a OP (pcp_ordens) com o cabeçalho do Quadro de Comando embutido
     (cliente/máquina, via quadro_comando_id) e os itens do BOM do quadro
     (sku/descricao), que alimentam o datalist de "código do produto" do
     modal de ocorrência. OPs que não são de frente='quadro' não têm
     quadro_comando_id — o embed vem null, sem quebrar nada. */
  async function obterEstadoOrdem(ordemId) {
    const c = sb();
    const [{ data: ordem, error: errOrdem }, { data: status, error: errStatus }, { data: ocorrencias, error: errOcorrencias }] = await Promise.all([
      c.from('pcp_ordens')
        .select(`id, numero, titulo, produto, cliente, numero_cotacao, status, prazo_entrega, previsao_inicio, data_abertura, quadro_comando_id,
          quadros_comando (
            numero_pedido, numero_cotacao, cliente_id, fabricante_comando, modelo_comando,
            clientes ( razao_social, nome_fantasia ),
            quadros_comando_maquina ( modelo_maquina, fabricante_maquina, potencia_kw, tensao_v ),
            quadros_comando_bom_itens ( sku, descricao )
          )`)
        .eq('id', ordemId).maybeSingle(),
      c.from('fabricacao_quadro_status').select('*, fabricacao_quadro_itens(id, texto, ordem, peso)').eq('ordem_id', ordemId),
      c.from('fabricacao_quadro_ocorrencias').select('*').eq('ordem_id', ordemId).order('aberta_em', { ascending: false }),
    ]);
    if (errOrdem) throw errOrdem;
    if (errStatus) throw errStatus;
    if (errOcorrencias) throw errOcorrencias;
    /* quadros_comando_maquina pode vir como array ou objeto dependendo de
       como o PostgREST infere a cardinalidade do embed — mesma ambiguidade
       já documentada e normalizada em pcp.jsx:PCPPedidosQuadro
       (`Array.isArray(r.quadros_comando_maquina) ? r.quadros_comando_maquina[0] : r.quadros_comando_maquina`).
       Normaliza aqui pra Task 4 não precisar redescobrir isso. */
    if (ordem && ordem.quadros_comando && Array.isArray(ordem.quadros_comando.quadros_comando_maquina)) {
      ordem.quadros_comando.quadros_comando_maquina = ordem.quadros_comando.quadros_comando_maquina[0] || null;
    }
    return { ordem: ordem || null, status: status || [], ocorrencias: ocorrencias || [] };
  }

  /* Token do link (fixo por OP) -> acha a OP e delega pra obterEstadoOrdem,
     mesmo papel de acompanhamento-obra-store.js:obterEstadoPorToken (sem a
     RPC pública de lá — essa tela ainda não tem o mesmo endurecimento). */
  async function obterEstadoPorToken(token) {
    const c = sb();
    const { data: link } = await c.from('fabricacao_quadro_links').select('*').eq('token', token).maybeSingle();
    if (!link) return null;
    const estado = await obterEstadoOrdem(link.ordem_id);
    return { link, ...estado };
  }

  /* flegadoPor: null/undefined = veio do link público da OP (padrão);
     e-mail/label do operador quando flegado de dentro do sistema — grava
     em fabricacao_quadro_status.flegado_por pra manter o rastro de quem
     flegou cada item (mesmo padrão de acompanhamento-obra-store.js). */
  async function marcarEtapa(ordemId, itemId, flegadoPor) {
    const c = sb();
    const { error } = await c.from('fabricacao_quadro_status')
      .upsert(
        { ordem_id: ordemId, item_id: itemId, flegado: true, flegado_em: new Date().toISOString(), flegado_por: flegadoPor || null },
        { onConflict: 'ordem_id,item_id' }
      );
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'PCP', acao: 'Marcou etapa da fabricação do quadro', alvo_id: ordemId,
      ator_nome: flegadoPor || null, detalhe: { itemId },
    });
  }

  /* Sem checagem de alçada aqui (mesmo padrão de
     acompanhamento-obra-store.js:desflegarItem) — quem gate-keeps o botão
     é a tela (Task 4), via temCapacidade. */
  async function desmarcarEtapa(ordemId, itemId, operadorEmail) {
    const c = sb();
    const { error } = await c.from('fabricacao_quadro_status')
      .update({ flegado: false })
      .eq('ordem_id', ordemId).eq('item_id', itemId);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'PCP', acao: 'Desmarcou etapa da fabricação do quadro', alvo_id: ordemId,
      ator_nome: operadorEmail || null, detalhe: { itemId },
    });
  }

  async function listarOcorrencias(ordemId) {
    const c = sb();
    const { data, error } = await c.from('fabricacao_quadro_ocorrencias').select('*').eq('ordem_id', ordemId).order('aberta_em', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function abrirOcorrencia(ordemId, codigoProduto, descricaoProduto, temFrenteTrabalho) {
    const c = sb();
    const { error } = await c.from('fabricacao_quadro_ocorrencias').insert({
      ordem_id: ordemId, codigo_produto: codigoProduto, descricao_produto: descricaoProduto || null,
      tem_frente_trabalho: !!temFrenteTrabalho, status: 'aberta',
    });
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'PCP', acao: 'Abriu ocorrência na fabricação do quadro', alvo_id: ordemId,
      detalhe: { codigoProduto, temFrenteTrabalho: !!temFrenteTrabalho },
    });
  }

  async function resolverOcorrencia(ocorrenciaId) {
    const c = sb();
    const { error } = await c.from('fabricacao_quadro_ocorrencias')
      .update({ status: 'resolvida', resolvida_em: new Date().toISOString() })
      .eq('id', ocorrenciaId);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'PCP', acao: 'Resolveu ocorrência na fabricação do quadro', alvo_id: ocorrenciaId,
    });
  }

  /* OPs de quadro ainda em aberto (fila de trabalho) — cabeçalho do card
     (cliente/nº pedido/tensão/potência) vem do mesmo embed de
     obterEstadoOrdem, sem o BOM (não é preciso aqui). */
  async function listarOPsAbertas() {
    const c = sb();
    const { data, error } = await c.from('pcp_ordens')
      .select(`id, numero, titulo, produto, cliente, numero_cotacao, status, prazo_entrega, previsao_inicio, data_abertura, quadro_comando_id,
        quadros_comando (
          numero_pedido, cliente_id,
          clientes ( razao_social, nome_fantasia ),
          quadros_comando_maquina ( modelo_maquina, potencia_kw, tensao_v )
        )`)
      .eq('frente', 'quadro')
      .in('status', ['aguardando', 'em_producao'])
      .order('prazo_entrega', { ascending: true });
    if (error) throw error;
    /* Mesma ambiguidade de cardinalidade do embed já normalizada em
       obterEstadoOrdem (ver comentário lá) — repetida aqui pra cada linha. */
    (data || []).forEach((r) => {
      if (r && r.quadros_comando && Array.isArray(r.quadros_comando.quadros_comando_maquina)) {
        r.quadros_comando.quadros_comando_maquina = r.quadros_comando.quadros_comando_maquina[0] || null;
      }
    });
    return data || [];
  }

  window.FabricacaoQuadroStore = {
    listarItens, obterLink, criarOuObterLink, obterEstadoOrdem, obterEstadoPorToken,
    marcarEtapa, desmarcarEtapa, listarOcorrencias, abrirOcorrencia, resolverOcorrencia,
    listarOPsAbertas,
  };
}());
