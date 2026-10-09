/* ============================================================
   list-importacao-varejo — Edge Function (vpprd)
   Chamada pela tela /logistica/compras (src/importacao-varejo.jsx) a
   cada carregamento/clique em "Atualizar". Junta:

   - Catálogo (importacao_varejo_produtos, ativo=true) + giro/Curva ABC-D
     (importacao_varejo_giro, calculado desde 01/01/2024 por
     sync-importacao-varejo) — CACHEADOS, mudam devagar.
   - Estoque físico/reservado/disponível/mínimo nativo/pendente/custo
     médio — **CACHEADO** (importacao_varejo_estoque, sincronizado 4x/dia
     por sync-importacao-varejo-estoque). Pedido do usuário (30/09):
     a versão anterior consultava o Omie AO VIVO aqui (~20-60 páginas de
     estoque/consulta ListarPosEstoque) a cada carregamento, e isso
     deixava a tela lenta — "não seria legal se isso morasse no Supabase
     e lá dentro atualizasse tipo 4 vezes por dia? assim o site apareceria
     quase instantâneo?". Essa troca é exatamente isso: esta função agora
     só lê tabelas do nosso banco, sem nenhuma chamada de rede ao Omie —
     carregamento quase instantâneo, ao custo de até ~6h de defasagem no
     estoque (aceito explicitamente pelo usuário em troca de velocidade).
   - Comprado (importacao_varejo_comprado, lançamento manual) e Lote
     (importacao_varejo_lote_config) — do nosso banco.
   - Último fornecedor + último preço unitário pago — CACHEADO
     (importacao_varejo_fornecedor, sincronizado 1x/dia por
     sync-importacao-varejo-fornecedor a partir do histórico REAL de
     Pedidos de Compra do Omie). Pedido do usuário (30/09): "consegue
     trazer a informação de fornecedores? [...] o comprador selecionaria
     o fornecedor e já ajuda a fazer o pedido em massa [...] último preço
     unitário". Produto sem nenhum Pedido de Compra no histórico (comum —
     é a maioria do catálogo, cuja reposição nunca passou pelo Omie local)
     não tem linha nesta tabela — `ultimoFornecedor`/`ultimoPrecoUnitario`
     saem `null`/`0`, tratado na tela como "sem histórico".
     **(01/10/2026)** essa mesma tabela também recebe fornecedor/preço
     cruzados de `pi_importacao` (P.I. do próprio site — ver fase 'pi' em
     sync-importacao-varejo-fornecedor) quando é a fonte mais recente;
     `fonte` diz qual das duas alimentou a linha — exposta como
     `ultimoFornecedorFonte` pra tela poder diferenciar visualmente.

   Sugestão de Compra = max(0, estoqueMinimo − disponível + pendente(Omie,
   cacheado) − comprado) — arredondada pra cima e ajustada por lote quando
   configurado.

   Conselho de compra: Curva D (baixo giro/sem venda desde 01/01/2024) +
   estoque disponível > 0 = "demora demais pra vender, considere pausar
   a compra" (critério pedido explicitamente pelo usuário).

   ⚠️ SEM `@supabase/supabase-js` de propósito (01/10/2026) — achado real
   e grave: redeployar esta função via MCP (sb_deploy_edge_function) com
   o import de sempre (`https://esm.sh/@supabase/supabase-js@2`) causou
   BOOT_ERROR em PRODUÇÃO por ~4 minutos ("A remote specifier was
   requested [...] but --no-remote is specified") — a função já estava
   rodando normalmente há meses com esse import, então **não é só função
   nova que sofre disso**: qualquer redeploy por esta ferramenta pode
   quebrar o bundling de um import remoto que antes funcionava. Corrigido
   na hora trocando pro mesmo padrão já usado em
   sync-importacao-varejo-fornecedor: falar direto com o PostgREST via
   fetch (sem client nenhum) — elimina o risco por completo. **Se outra
   sessão for editar QUALQUER Edge Function deste projeto que ainda
   importa supabase-js, considere migrar pro mesmo padrão antes de
   mexer**, ou ao menos testar com uma invocação real imediatamente após
   o deploy (não assumir que "já funcionava antes" é garantia).
   ============================================================ */

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function pgHeaders(extra?: Record<string, string>) {
  return {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function buscarTodasAsLinhas<T>(
  tabela: string,
  colunas: string,
  eq?: { coluna: string; valor: unknown },
): Promise<T[]> {
  // Achado real (30/09, no sync-importacao-varejo, mesmo padrão aqui): um
  // select sem paginação cai no limite padrão de 1000 linhas do
  // PostgREST — com >1000 produtos/giro isso truncava a tela em
  // silêncio. Sempre paginar via header Range nestas tabelas.
  const PAGINA = 1000;
  const linhas: T[] = [];
  let offset = 0;
  for (;;) {
    const qs = new URLSearchParams({ select: colunas });
    if (eq) qs.set(eq.coluna, `eq.${eq.valor}`);
    const res = await fetch(`${supabaseUrl}/rest/v1/${tabela}?${qs.toString()}`, {
      headers: pgHeaders({ Range: `${offset}-${offset + PAGINA - 1}` }),
    });
    if (!res.ok) throw new Error(`select ${tabela}: HTTP ${res.status} ${await res.text()}`);
    const data = (await res.json()) as T[];
    linhas.push(...data);
    if (data.length < PAGINA) break;
    offset += PAGINA;
  }
  return linhas;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const [produtos, giro, estoque, lote, comprado, fornecedor] = await Promise.all([
      buscarTodasAsLinhas<{ codigo: string; codigo_produto_omie: number; descricao: string; unidade: string | null; lead_time_dias: number }>(
        "importacao_varejo_produtos",
        "codigo,codigo_produto_omie,descricao,unidade,lead_time_dias",
        { coluna: "ativo", valor: true },
      ),
      buscarTodasAsLinhas<{ codigo: string; curva: string; media_mensal_vendas: number; estoque_minimo_calculado: number; updated_at: string }>(
        "importacao_varejo_giro",
        "codigo,curva,media_mensal_vendas,estoque_minimo_calculado,updated_at",
      ),
      buscarTodasAsLinhas<{ codigo: string; codigo_produto_omie: number; descricao: string | null; fisico: number; reservado: number; disponivel: number; minimo_omie: number; pendente: number; cmc: number; preco_unitario: number; atualizado_em: string }>(
        "importacao_varejo_estoque",
        "codigo,codigo_produto_omie,descricao,fisico,reservado,disponivel,minimo_omie,pendente,cmc,preco_unitario,atualizado_em",
      ),
      buscarTodasAsLinhas<{ codigo: string; multiplo_compra: number | null; lote_minimo: number | null }>(
        "importacao_varejo_lote_config",
        "codigo,multiplo_compra,lote_minimo",
      ),
      buscarTodasAsLinhas<{ codigo: string; quantidade: number; previsao_chegada: string }>(
        "importacao_varejo_comprado",
        "codigo,quantidade,previsao_chegada",
        { coluna: "recebido", valor: false },
      ),
      buscarTodasAsLinhas<{ codigo: string; fornecedor_nome: string | null; fornecedor_cnpj: string | null; fornecedor_exterior: boolean; preco_unitario: number | null; numero_pedido: string | null; data_pedido: string | null; fonte: string | null }>(
        "importacao_varejo_fornecedor",
        "codigo,fornecedor_nome,fornecedor_cnpj,fornecedor_exterior,preco_unitario,numero_pedido,data_pedido,fonte",
      ),
    ]);
    if (!produtos || produtos.length === 0) {
      return json({ items: [], lastEstoqueSyncAt: null, lastGiroSyncAt: null, aviso: "Catálogo ainda vazio — aguarde a próxima sincronização diária (sync-importacao-varejo) ou dispare manualmente." });
    }

    const giroMap = new Map((giro ?? []).map((g) => [g.codigo as string, g]));
    const estoqueMap = new Map((estoque ?? []).map((e) => [e.codigo as string, e]));
    const loteMap = new Map((lote ?? []).map((l) => [l.codigo as string, l]));
    const fornecedorMap = new Map((fornecedor ?? []).map((f) => [f.codigo as string, f]));

    const hojeISO = new Date().toISOString().slice(0, 10);
    const compradoPorCodigo = new Map<string, { total: number; pedidos: { quantidade: number; previsao: string }[] }>();
    for (const c of comprado ?? []) {
      if ((c.previsao_chegada as string) < hojeISO) continue; // previsão já passou: não conta mais como "a caminho"
      const atual = compradoPorCodigo.get(c.codigo as string) ?? { total: 0, pedidos: [] };
      atual.total += Number(c.quantidade) || 0;
      atual.pedidos.push({ quantidade: Number(c.quantidade) || 0, previsao: c.previsao_chegada as string });
      compradoPorCodigo.set(c.codigo as string, atual);
    }

    const items = produtos.map((p) => {
      const codigo = p.codigo as string;
      const est = estoqueMap.get(codigo) as
        | { codigo_produto_omie?: number; descricao?: string | null; fisico?: number; reservado?: number; disponivel?: number; minimo_omie?: number; pendente?: number; cmc?: number; preco_unitario?: number; atualizado_em?: string }
        | undefined;
      const g = giroMap.get(codigo) as { curva?: string; media_mensal_vendas?: number; estoque_minimo_calculado?: number; updated_at?: string } | undefined;
      const lc = loteMap.get(codigo) as { multiplo_compra?: number; lote_minimo?: number } | undefined;
      const comp = compradoPorCodigo.get(codigo) ?? { total: 0, pedidos: [] };
      const forn = fornecedorMap.get(codigo) as
        | { fornecedor_nome?: string | null; fornecedor_cnpj?: string | null; fornecedor_exterior?: boolean; preco_unitario?: number | null; numero_pedido?: string | null; data_pedido?: string | null; fonte?: string | null }
        | undefined;

      const estoqueFisico = est?.fisico ?? 0;
      const estoqueReservado = est?.reservado ?? 0;
      const estoqueDisponivel = est?.disponivel ?? 0;
      const pendenteOmie = est?.pendente ?? 0;
      const curva = (g?.curva as "A" | "B" | "C" | "D" | undefined) ?? "D";
      // Estoque mínimo: nosso cálculo (giro desde 01/01/2024) quando já
      // sincronizado; senão cai pro campo nativo do Omie (cacheado,
      // configurado manualmente por alguém) — nunca fica em branco só
      // por falta de sync.
      const estoqueMinimo = g?.estoque_minimo_calculado != null ? g.estoque_minimo_calculado : est?.minimo_omie ?? 0;

      const necessidadeBruta = Math.max(0, estoqueMinimo - estoqueDisponivel + pendenteOmie - comp.total);
      const sugestaoBruta = Math.ceil(necessidadeBruta);
      let sugestaoCompra = sugestaoBruta;
      if (sugestaoBruta > 0 && (Number(lc?.multiplo_compra) > 0 || Number(lc?.lote_minimo) > 0)) {
        if (Number(lc?.multiplo_compra) > 0) {
          sugestaoCompra = Math.ceil(Math.max(sugestaoBruta, Number(lc?.lote_minimo) || 0) / Number(lc!.multiplo_compra)) * Number(lc!.multiplo_compra);
        } else {
          sugestaoCompra = Math.max(sugestaoBruta, Number(lc?.lote_minimo) || 0);
        }
      }

      const conselho =
        curva === "D" && estoqueDisponivel > 0
          ? "Curva D — baixo giro (sem venda registrada desde 01/01/2024 o suficiente pra sair de D). Considere não comprar mais até vender o estoque parado."
          : null;

      return {
        codigo,
        codigoProdutoOmie: est?.codigo_produto_omie ?? p.codigo_produto_omie,
        descricao: est?.descricao || (p.descricao as string),
        unidade: p.unidade as string | null,
        curva,
        mediaMensalVendas: g?.media_mensal_vendas ?? 0,
        estoqueFisico,
        estoqueReservado,
        estoqueDisponivel,
        estoqueMinimo,
        pendenteOmie,
        comprado: comp.total,
        pedidosComprado: comp.pedidos,
        cmc: est?.cmc ?? 0,
        precoUnitario: est?.preco_unitario ?? 0,
        ultimoFornecedorNome: forn?.fornecedor_nome ?? null,
        ultimoFornecedorCnpj: forn?.fornecedor_cnpj ?? null,
        ultimoFornecedorExterior: forn?.fornecedor_exterior ?? false,
        ultimoPrecoUnitario: forn?.preco_unitario ?? null,
        ultimoPedidoNumero: forn?.numero_pedido ?? null,
        ultimoPedidoData: forn?.data_pedido ?? null,
        ultimoFornecedorFonte: forn?.fonte ?? null,
        multiploCompra: lc?.multiplo_compra ?? null,
        loteMinimo: lc?.lote_minimo ?? null,
        sugestaoBruta,
        sugestaoCompra,
        conselho,
        semRegistroEstoque: !est,
        giroCalculadoEm: g?.updated_at ?? null,
        estoqueAtualizadoEm: est?.atualizado_em ?? null,
      };
    });

    const lastGiroSyncAt = items.reduce<string | null>((max, i) => (i.giroCalculadoEm && (!max || i.giroCalculadoEm > max) ? i.giroCalculadoEm : max), null);
    const lastEstoqueSyncAt = items.reduce<string | null>((max, i) => (i.estoqueAtualizadoEm && (!max || i.estoqueAtualizadoEm > max) ? i.estoqueAtualizadoEm : max), null);

    return json({ items, lastEstoqueSyncAt, lastGiroSyncAt });
  } catch (error) {
    console.error("list-importacao-varejo error:", error);
    return json({ error: (error as Error).message || "Erro interno" }, 500);
  }
});
