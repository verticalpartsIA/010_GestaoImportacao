/* ============================================================
   list-importacao-varejo — Edge Function (vpprd)
   Chamada pela tela /logistica/compras (src/importacao-varejo.jsx) a
   cada carregamento/clique em "Atualizar". Junta:

   - Catálogo (importacao_varejo_produtos, ativo=true) + giro/Curva ABC-D
     (importacao_varejo_giro, calculado desde 01/01/2024 por
     sync-importacao-varejo) — CACHEADOS, mudam devagar.
   - Estoque físico/reservado/disponível/mínimo nativo/pendente/custo
     médio — AO VIVO, direto do Omie (estoque/consulta ListarPosEstoque,
     endpoint em lote confirmado ao vivo: ~1946 produtos em ~20 páginas
     de 100, sem risco de rate-limit por item). "Se saiu, aparece" —
     pedido explícito do usuário, nunca fica atrás de um cache de hora
     em hora como o sistema de referência (que existia justamente pra
     evitar bater direto no Omie a cada load — aqui o escopo é bem menor
     e o endpoint é em lote, então dá pra ser ao vivo sem o mesmo risco).
   - Comprado (importacao_varejo_comprado, lançamento manual) e Lote
     (importacao_varejo_lote_config) — do nosso banco.

   Sugestão de Compra = max(0, estoqueMinimo − disponível + pendente(Omie,
   ao vivo) − comprado) — arredondada pra cima e ajustada por lote quando
   configurado.

   Conselho de compra: Curva D (baixo giro/sem venda desde 01/01/2024) +
   estoque disponível > 0 = "demora demais pra vender, considere pausar
   a compra" (critério pedido explicitamente pelo usuário).
   ============================================================ */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];
const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";

const sb = createClient(supabaseUrl, supabaseServiceKey);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function formatarDataBR(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

async function omiePost<T>(endpoint: string, call: string, param: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ call, app_key: omieKey, app_secret: omieSecret, param: [param] }),
  });
  const data = (await res.json().catch(() => ({}))) as { faultstring?: string } & T;
  if (data.faultstring) throw new Error(`Omie: ${data.faultstring}`);
  if (!res.ok) throw new Error(`Omie HTTP ${res.status}`);
  return data as T;
}

type PosEstoqueItem = {
  cCodigo: string;
  cDescricao: string;
  estoque_minimo: number;
  fisico: number;
  reservado: number;
  nSaldo: number;
  nPendente: number;
  nCMC: number;
  nPrecoUnitario: number;
  nCodProd: number;
};
type ListarPosEstoqueResp = { nTotPaginas: number; produtos: PosEstoqueItem[] };

async function buscarEstoqueAoVivo(): Promise<Map<string, PosEstoqueItem>> {
  const mapa = new Map<string, PosEstoqueItem>();
  const dataPosicao = formatarDataBR(new Date());
  let pagina = 1;
  let totalPaginas = 1;
  // Confirmado ao vivo: Omie limita a 100 registros por página neste
  // endpoint mesmo pedindo mais — não usar um nRegPorPagina maior
  // achando que reduz o nº de chamadas.
  while (pagina <= totalPaginas && pagina <= 60) {
    const resp = await omiePost<ListarPosEstoqueResp>("estoque/consulta", "ListarPosEstoque", {
      nPagina: pagina,
      nRegPorPagina: 100,
      dDataPosicao: dataPosicao,
    });
    for (const item of resp.produtos || []) mapa.set(item.cCodigo, item);
    totalPaginas = resp.nTotPaginas || 1;
    pagina++;
  }
  return mapa;
}

async function buscarTodasAsLinhas<T>(
  tabela: string,
  colunas: string,
  eq?: { coluna: string; valor: unknown },
): Promise<T[]> {
  // Achado real (30/09, no sync-importacao-varejo, mesmo padrão aqui): um
  // .select() sem paginação no supabase-js cai no limite padrão de 1000
  // linhas do PostgREST — com >1000 produtos/giro isso truncava a tela em
  // silêncio. Sempre paginar com .range() nestas 2 tabelas.
  const PAGINA = 1000;
  const linhas: T[] = [];
  let offset = 0;
  for (;;) {
    let query = sb.from(tabela).select(colunas).range(offset, offset + PAGINA - 1);
    if (eq) query = query.eq(eq.coluna, eq.valor);
    const { data, error } = await query;
    if (error) throw new Error(`select ${tabela}: ${error.message}`);
    linhas.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGINA) break;
    offset += PAGINA;
  }
  return linhas;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!omieKey || !omieSecret) return json({ error: "OMIE_API_KEY / OMIE_API_SECRET não configuradas" }, 500);

  try {
    const [produtos, giro, lote, comprado] = await Promise.all([
      buscarTodasAsLinhas<{ codigo: string; codigo_produto_omie: number; descricao: string; unidade: string | null; lead_time_dias: number }>(
        "importacao_varejo_produtos",
        "codigo,codigo_produto_omie,descricao,unidade,lead_time_dias",
        { coluna: "ativo", valor: true },
      ),
      buscarTodasAsLinhas<{ codigo: string; curva: string; media_mensal_vendas: number; estoque_minimo_calculado: number; updated_at: string }>(
        "importacao_varejo_giro",
        "codigo,curva,media_mensal_vendas,estoque_minimo_calculado,updated_at",
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
    ]);
    if (!produtos || produtos.length === 0) {
      return json({ items: [], lastLiveCheckAt: new Date().toISOString(), lastGiroSyncAt: null, aviso: "Catálogo ainda vazio — aguarde a próxima sincronização diária (sync-importacao-varejo) ou dispare manualmente." });
    }

    const giroMap = new Map((giro ?? []).map((g) => [g.codigo as string, g]));
    const loteMap = new Map((lote ?? []).map((l) => [l.codigo as string, l]));

    const hojeISO = new Date().toISOString().slice(0, 10);
    const compradoPorCodigo = new Map<string, { total: number; pedidos: { quantidade: number; previsao: string }[] }>();
    for (const c of comprado ?? []) {
      if ((c.previsao_chegada as string) < hojeISO) continue; // previsão já passou: não conta mais como "a caminho"
      const atual = compradoPorCodigo.get(c.codigo as string) ?? { total: 0, pedidos: [] };
      atual.total += Number(c.quantidade) || 0;
      atual.pedidos.push({ quantidade: Number(c.quantidade) || 0, previsao: c.previsao_chegada as string });
      compradoPorCodigo.set(c.codigo as string, atual);
    }

    const estoqueAoVivo = await buscarEstoqueAoVivo();

    const items = produtos.map((p) => {
      const codigo = p.codigo as string;
      const est = estoqueAoVivo.get(codigo);
      const g = giroMap.get(codigo) as { curva?: string; media_mensal_vendas?: number; estoque_minimo_calculado?: number; updated_at?: string } | undefined;
      const lc = loteMap.get(codigo) as { multiplo_compra?: number; lote_minimo?: number } | undefined;
      const comp = compradoPorCodigo.get(codigo) ?? { total: 0, pedidos: [] };

      const estoqueFisico = est?.fisico ?? 0;
      const estoqueReservado = est?.reservado ?? 0;
      const estoqueDisponivel = est?.nSaldo ?? 0;
      const pendenteOmie = est?.nPendente ?? 0;
      const curva = (g?.curva as "A" | "B" | "C" | "D" | undefined) ?? "D";
      // Estoque mínimo: nosso cálculo (giro desde 01/01/2024) quando já
      // sincronizado; senão cai pro campo nativo do Omie (configurado
      // manualmente por alguém, usado também na notificação diária do
      // próprio Omie) — nunca fica em branco só por falta de sync.
      const estoqueMinimo = g?.estoque_minimo_calculado != null ? g.estoque_minimo_calculado : est?.estoque_minimo ?? 0;

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
        codigoProdutoOmie: est?.nCodProd ?? p.codigo_produto_omie,
        descricao: est?.cDescricao || (p.descricao as string),
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
        cmc: est?.nCMC ?? 0,
        precoUnitario: est?.nPrecoUnitario ?? 0,
        multiploCompra: lc?.multiplo_compra ?? null,
        loteMinimo: lc?.lote_minimo ?? null,
        sugestaoBruta,
        sugestaoCompra,
        conselho,
        semRegistroEstoque: !est,
        giroCalculadoEm: g?.updated_at ?? null,
      };
    });

    const lastGiroSyncAt = items.reduce<string | null>((max, i) => (i.giroCalculadoEm && (!max || i.giroCalculadoEm > max) ? i.giroCalculadoEm : max), null);

    return json({ items, lastLiveCheckAt: new Date().toISOString(), lastGiroSyncAt });
  } catch (error) {
    console.error("list-importacao-varejo error:", error);
    return json({ error: (error as Error).message || "Erro interno" }, 500);
  }
});
