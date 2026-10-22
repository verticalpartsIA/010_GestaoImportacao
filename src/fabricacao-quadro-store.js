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

   O cálculo de progresso/pausa (resumoProgresso/etapaAtualId/
   estaPausado) NÃO mora aqui — fica em window.FabricacaoQuadroCalc
   (fabricacao-quadro-calc.js), puro e já testado, chamado pelas telas
   (evolucao-fabricacao-quadro.jsx / fabricacao-quadro-app.jsx). Este
   arquivo só chama em Calc o helper mergeStatusComItens (fix do review
   final, 19/10/2026): obterEstadoOrdem sempre devolve o checklist
   completo (catálogo inteiro + o que já foi flegado), nunca confiando
   que criarOuObterLink semeou todas as linhas — ver comentário na
   própria função.

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

  /* Catálogo fixo dos 4 itens extras de fiação (Cabo de Manobra, Fiação
     Passadiço, Fiação Topo do Carro, Fiação de Poço) — ver comentário em
     obterEstadoOrdem/fiacaoAplicavelParaOrdem sobre quando eles entram. */
  async function listarFiacaoItens() {
    const c = sb();
    const { data, error } = await c.from('fabricacao_quadro_fiacao_itens').select('*').order('ordem');
    if (error) throw error;
    return data || [];
  }

  /* Mesma mescla de mergeStatusComItens (fabricacao-quadro-calc.js), mas
     pros itens de fiação — mantida separada do motor do Quadro de
     propósito (fiação não tem peso/percentual, cada item é um booleano
     independente; nunca mexe em FabricacaoQuadroCalc). A chave
     `fabricacao_quadro_itens` no objeto devolvido é só pra reaproveitar,
     sem duplicar, os componentes de UI que já sabem renderizar esse
     formato (FQPasso/FQPEtapaLinha) — não é um erro de nome, é o mesmo
     "shape" de propósito. */
  function mergeFiacaoStatus(itens, status) {
    const porItem = {};
    (status || []).forEach((s) => { porItem[s.item_id] = s; });
    return (itens || []).map((it) => {
      const s = porItem[it.id];
      return {
        item_id: it.id,
        flegado: !!(s && s.flegado),
        flegado_em: s ? s.flegado_em : null,
        flegado_por: s ? s.flegado_por : null,
        fabricacao_quadro_itens: it,
      };
    });
  }

  /* A OP do Quadro (ou a OP-mãe dela, via ordem_mae_id) está vinculada a um
     Pedido de Venda do Omie? Decisão do usuário (20/10/2026): os 4 itens
     de fiação só entram quando a resposta é sim (elevador completo) —
     quadro avulso (sem pedido_codigo em nenhum dos dois) continua só com
     as 6 etapas de sempre. `pedido_codigo` é o mesmo campo que já liga a
     Emissão de NF/Expedição/Painel; algumas rotas de geração de OP
     gravam ele direto na OP do quadro (fila "Pedidos para Produzir"),
     outras só na OP-mãe (assistente "Pedidos de Quadro") — por isso
     confere os dois lugares. */
  async function fiacaoAplicavelParaOrdem(ordem) {
    if (!ordem) return false;
    if (ordem.pedido_codigo != null) return true;
    if (!ordem.ordem_mae_id) return false;
    const c = sb();
    const { data, error } = await c.from('pcp_ordens').select('pedido_codigo').eq('id', ordem.ordem_mae_id).maybeSingle();
    if (error) {
      console.warn('[FabricacaoQuadroStore] fiacaoAplicavelParaOrdem: falha ao buscar a OP-mãe — assumindo sem fiação extra.', error);
      return false;
    }
    return !!(data && data.pedido_codigo != null);
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
     quadro_comando_id — o embed vem null, sem quebrar nada.

     Fix do review final (19/10/2026):
     1) status SEMPRE sai como o checklist completo do catálogo
        (listarItens() + fabricacao_quadro_status mesclados via
        FabricacaoQuadroCalc.mergeStatusComItens) — nunca os status crus.
        Isso corrige a página pública (fabricacao-quadro-app.jsx), que
        antes usava estado.status direto e confiava cegamente que
        criarOuObterLink tinha semeado as 6 linhas; se a semeadura falhar
        parcialmente (ou o catálogo crescer), a página pública mostrava
        "0/0 etapas — 0%" em silêncio. A tela interna já fazia esse merge
        no próprio componente (evolucao-fabricacao-quadro.jsx) — fazer
        aqui também, sem remover o merge de lá, é inofensivo (mesclar um
        array já mesclado é idempotente) e corrige as DUAS telas de uma
        vez só.
     2) A consulta de cabeçalho (pcp_ordens + quadros_comando + clientes +
        quadros_comando_maquina + quadros_comando_bom_itens) deixou de ser
        fatal: ela só alimenta uma linha de exibição (cliente/modelo) no
        topo da tela, não é necessária pro operador flegar etapa nem
        relatar ocorrência. Uma falha transitória nela não pode mais
        derrubar a tela inteira — vira warning e segue com `ordem: null`.
        As consultas de status/ocorrências continuam fatais (lançam):
        são as únicas que o operador realmente precisa pra funcionar. */
  async function obterEstadoOrdem(ordemId) {
    const c = sb();
    const [itens, headerResult, statusResult, ocorrenciasResult] = await Promise.all([
      listarItens(),
      c.from('pcp_ordens')
        .select('id, numero, titulo, produto, cliente, numero_cotacao, status, prazo_entrega, previsao_inicio, data_abertura, quadro_comando_id, pedido_codigo, ordem_mae_id')
        .eq('id', ordemId).maybeSingle(),
      c.from('fabricacao_quadro_status').select('*, fabricacao_quadro_itens(id, texto, ordem, peso)').eq('ordem_id', ordemId),
      c.from('fabricacao_quadro_ocorrencias').select('*').eq('ordem_id', ordemId).order('aberta_em', { ascending: false }),
    ]);
    const { data: statusRows, error: errStatus } = statusResult;
    const { data: ocorrencias, error: errOcorrencias } = ocorrenciasResult;
    if (errStatus) throw errStatus;
    if (errOcorrencias) throw errOcorrencias;

    let ordem = null;
    if (headerResult.error) {
      console.warn('[FabricacaoQuadroStore] obterEstadoOrdem: falha ao buscar o cabeçalho da OP ' + ordemId + ' — seguindo sem esses dados (não impede marcar etapa/relatar ocorrência).', headerResult.error);
    } else {
      ordem = headerResult.data || null;
    }

    if (ordem && ordem.quadro_comando_id) {
      const quadroResult = await buscarQuadroComando(ordem.quadro_comando_id);
      if (quadroResult.error) {
        console.warn('[FabricacaoQuadroStore] obterEstadoOrdem: falha ao buscar o cabeçalho (cliente/modelo) do Quadro de Comando ' + ordem.quadro_comando_id + ' — seguindo sem esses dados.', quadroResult.error);
        ordem.quadros_comando = null;
      } else {
        ordem.quadros_comando = quadroResult.data || null;
      }
    } else if (ordem) {
      ordem.quadros_comando = null;
    }

    const status = (window.FabricacaoQuadroCalc && window.FabricacaoQuadroCalc.mergeStatusComItens)
      ? window.FabricacaoQuadroCalc.mergeStatusComItens(itens, statusRows)
      : (statusRows || []);

    /* Fiação extra (Cabo de Manobra/Passadiço/Topo do Carro/Poço) — só
       quando a OP (ou a OP-mãe) tem Pedido de Venda vinculado, ver
       fiacaoAplicavelParaOrdem. Sem isso, fiacaoStatus sai vazio e a tela
       simplesmente não mostra a seção — comportamento idêntico ao de
       antes desta feature pra quadro avulso. */
    const fiacaoAplicavel = await fiacaoAplicavelParaOrdem(ordem);
    let fiacaoStatus = [];
    if (fiacaoAplicavel) {
      const [fiacaoItens, fiacaoStatusResult] = await Promise.all([
        listarFiacaoItens(),
        c.from('fabricacao_quadro_fiacao_status').select('*').eq('ordem_id', ordemId),
      ]);
      if (fiacaoStatusResult.error) {
        console.warn('[FabricacaoQuadroStore] obterEstadoOrdem: falha ao buscar o status da fiação extra — seguindo com a seção vazia.', fiacaoStatusResult.error);
      } else {
        fiacaoStatus = mergeFiacaoStatus(fiacaoItens, fiacaoStatusResult.data);
      }
    }

    return { ordem: ordem || null, status, ocorrencias: ocorrencias || [], fiacaoAplicavel, fiacaoStatus };
  }

  /* Busca o cabeçalho do Quadro de Comando (cliente/modelo/máquina/BOM) a
     partir do seu próprio id — SEMPRE em uma consulta separada de
     pcp_ordens, nunca aninhada a partir dela (`pcp_ordens.quadro_comando_id`
     não tem FK declarada no banco para `quadros_comando.id`; sem FK o
     PostgREST não consegue montar o embed e lança "Could not find a
     relationship between 'pcp_ordens' and 'quadros_comando' in the schema
     cache" — bug real visto em produção em 20/10/2026). As demais relações
     daqui pra baixo (clientes, quadros_comando_maquina,
     quadros_comando_bom_itens) TÊM FK e continuam aninhadas normalmente.
     Mesmo padrão de duas consultas separadas já usado em
     pcp.jsx:PCPPedidosQuadro por este mesmo motivo. */
  async function buscarQuadroComando(quadroComandoId) {
    const c = sb();
    const result = await c.from('quadros_comando')
      .select(`numero_pedido, numero_cotacao, cliente_id, fabricante_comando, modelo_comando,
        clientes ( razao_social, nome_fantasia ),
        quadros_comando_maquina ( modelo_maquina, fabricante_maquina, potencia_kw, tensao_v ),
        quadros_comando_bom_itens ( sku, descricao )
      `)
      .eq('id', quadroComandoId).maybeSingle();
    if (!result.error && result.data && Array.isArray(result.data.quadros_comando_maquina)) {
      /* quadros_comando_maquina pode vir como array ou objeto dependendo de
         como o PostgREST infere a cardinalidade do embed — mesma ambiguidade
         já documentada e normalizada em pcp.jsx:PCPPedidosQuadro. */
      result.data.quadros_comando_maquina = result.data.quadros_comando_maquina[0] || null;
    }
    return result;
  }

  /* Token do link (fixo por OP) -> acha a OP e delega pra obterEstadoOrdem,
     mesmo papel de acompanhamento-obra-store.js:obterEstadoPorToken.

     Segurança (Finding 3 do review final, 19/10/2026): diferente do
     Diário de Obra (que lê por uma RPC pública dedicada,
     acompanhamento-obra-store.js:obterEstadoPorToken), esta página
     pública ainda lê diretamente, com a chave anon, as 5 tabelas abaixo
     — ela só continua funcionando enquanto todas elas seguirem
     anon-legíveis. O endurecimento progressivo da issue #571 pode fechar
     qualquer uma destas tabelas antes de esta tela ganhar sua própria RPC
     `public_fabricacao_obter` (ainda não construída — depende de
     migration não aplicada, fora do escopo desta correção):
       - fabricacao_quadro_links (resolve o token)
       - pcp_ordens (cabeçalho da OP)
       - quadros_comando (cabeçalho do quadro, embutido em pcp_ordens)
       - clientes (nome do cliente, embutido em quadros_comando)
       - quadros_comando_bom_itens (datalist de "código do produto" da
         ocorrência, embutido em quadros_comando)
     (fabricacao_quadro_status/_itens/_ocorrencias também são lidas por
     obterEstadoOrdem, mas essas 5 acima são as que fazem esta tela
     divergir do padrão já endurecido do Diário de Obra.)

     Erro de leitura (Finding 2): `null` aqui significa estritamente
     "token não existe" (link realmente não encontrado/expirado) — nunca
     o resultado de uma falha de consulta. Qualquer erro real na consulta
     do link, ou qualquer erro vindo de obterEstadoOrdem (status/
     ocorrências), é relançado (throw) pra quem chamou NÃO confundir
     "falha transitória" com "link morto" (ver fabricacao-quadro-app.jsx). */
  async function obterEstadoPorToken(token) {
    const c = sb();
    const { data: link, error: errLink } = await c.from('fabricacao_quadro_links').select('*').eq('token', token).maybeSingle();
    if (errLink) throw errLink;
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

  /* Mesmo papel de marcarEtapa/desmarcarEtapa, mas pros 4 itens extras de
     fiação (tabela própria, ver migration 20261020150000) — flegadoPor
     null quando vem do link público, e-mail/label quando é de dentro do
     sistema, mesma regra de desmarcar só por dentro (gate fica na tela). */
  async function marcarEtapaFiacao(ordemId, itemId, flegadoPor) {
    const c = sb();
    const { error } = await c.from('fabricacao_quadro_fiacao_status')
      .upsert(
        { ordem_id: ordemId, item_id: itemId, flegado: true, flegado_em: new Date().toISOString(), flegado_por: flegadoPor || null },
        { onConflict: 'ordem_id,item_id' }
      );
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'PCP', acao: 'Marcou etapa de fiação extra da fabricação do quadro', alvo_id: ordemId,
      ator_nome: flegadoPor || null, detalhe: { itemId },
    });
  }

  async function desmarcarEtapaFiacao(ordemId, itemId, operadorEmail) {
    const c = sb();
    const { error } = await c.from('fabricacao_quadro_fiacao_status')
      .update({ flegado: false })
      .eq('ordem_id', ordemId).eq('item_id', itemId);
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'PCP', acao: 'Desmarcou etapa de fiação extra da fabricação do quadro', alvo_id: ordemId,
      ator_nome: operadorEmail || null, detalhe: { itemId },
    });
  }

  /* Não chamada por nenhuma das 2 telas hoje — obterEstadoOrdem já
     devolve a lista de ocorrências embutida (ver acima), que é tudo que
     evolucao-fabricacao-quadro.jsx/fabricacao-quadro-app.jsx precisam.
     Mantida exportada por simetria com o resto do store (toda entidade
     tem seu listar próprio) e pra um consumidor futuro que precise só
     das ocorrências, sem pagar o custo das outras 2 consultas de
     obterEstadoOrdem. */
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

  /* alvo_id = ordem_id da ocorrência (não o id da própria ocorrência),
     igual às outras 3 funções de mutação deste arquivo (marcarEtapa/
     desmarcarEtapa/abrirOcorrencia) — fix do review final (19/10/2026):
     o id da ocorrência fica em detalhe.ocorrenciaId, pra toda a
     auditoria de uma OP continuar grepável por um único id (alvo_id). A
     função não recebe ordemId como parâmetro (só o id da ocorrência),
     então o `.select()` abaixo recupera o ordem_id da própria linha
     atualizada, sem precisar de uma consulta extra nem mudar a
     assinatura (único chamador, fabricacao-quadro-app.jsx, só passa o
     id da ocorrência). */
  async function resolverOcorrencia(ocorrenciaId) {
    const c = sb();
    const { data, error } = await c.from('fabricacao_quadro_ocorrencias')
      .update({ status: 'resolvida', resolvida_em: new Date().toISOString() })
      .eq('id', ocorrenciaId)
      .select('ordem_id').maybeSingle();
    if (error) throw error;
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'PCP', acao: 'Resolveu ocorrência na fabricação do quadro', alvo_id: data ? data.ordem_id : null,
      detalhe: { ocorrenciaId },
    });
  }

  /* OPs de quadro ainda em aberto (fila de trabalho) — cabeçalho do card
     (cliente/nº pedido/tensão/potência) vem do mesmo embed de
     obterEstadoOrdem, sem o BOM (não é preciso aqui). */
  async function listarOPsAbertas() {
    const c = sb();
    const { data, error } = await c.from('pcp_ordens')
      .select('id, numero, titulo, produto, cliente, numero_cotacao, status, prazo_entrega, previsao_inicio, data_abertura, quadro_comando_id, pedido_codigo')
      .eq('frente', 'quadro')
      .in('status', ['aguardando', 'em_producao'])
      .order('prazo_entrega', { ascending: true });
    if (error) throw error;
    const ordens = data || [];

    /* quadro_comando_id não tem FK para quadros_comando.id — ver comentário
       em buscarQuadroComando/obterEstadoOrdem. Busca os cabeçalhos únicos
       numa 2ª consulta (sem repetir por OP) e junta em JS. */
    const ids = Array.from(new Set(ordens.map((r) => r.quadro_comando_id).filter(Boolean)));
    let porId = {};
    if (ids.length) {
      const { data: quadros, error: errQuadros } = await c.from('quadros_comando')
        .select(`id, numero_pedido, cliente_id,
          clientes ( razao_social, nome_fantasia ),
          quadros_comando_maquina ( modelo_maquina, potencia_kw, tensao_v )
        `)
        .in('id', ids);
      if (errQuadros) {
        console.warn('[FabricacaoQuadroStore] listarOPsAbertas: falha ao buscar os cabeçalhos dos Quadros de Comando — seguindo sem esses dados.', errQuadros);
      } else {
        (quadros || []).forEach((q) => {
          if (Array.isArray(q.quadros_comando_maquina)) {
            q.quadros_comando_maquina = q.quadros_comando_maquina[0] || null;
          }
          porId[q.id] = q;
        });
      }
    }
    ordens.forEach((r) => { r.quadros_comando = porId[r.quadro_comando_id] || null; });
    return ordens;
  }

  window.FabricacaoQuadroStore = {
    listarItens, obterLink, criarOuObterLink, obterEstadoOrdem, obterEstadoPorToken,
    marcarEtapa, desmarcarEtapa, listarOcorrencias, abrirOcorrencia, resolverOcorrencia,
    listarOPsAbertas, listarFiacaoItens, marcarEtapaFiacao, desmarcarEtapaFiacao,
  };
}());
