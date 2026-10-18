/* ============================================================
   sync-importacao-varejo-estoque — Edge Function (vpprd)
   Sincroniza o cache de estoque (tabela importacao_varejo_estoque) 4x/dia
   (cron `sync-importacao-varejo-estoque-4x-dia`, 7h/11h/15h/19h BRT).

   Pedido do usuário (30/09): a tela Importação Varejo estava lenta porque
   list-importacao-varejo consultava o Omie AO VIVO (estoque/consulta
   ListarPosEstoque, até ~60 páginas) em toda carga. Essa função assume
   essa consulta em lote e grava o resultado aqui — list-importacao-varejo
   passa a só ler esta tabela, sem nenhuma chamada ao Omie no caminho
   crítico da tela (carregamento quase instantâneo).

   Reaproveita exatamente a mesma lógica de paginação que list-importacao-
   varejo usava antes (buscarEstoqueAoVivo) — só muda o destino: upsert no
   Supabase em vez de devolver direto na resposta HTTP.
   ============================================================ */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];
const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";

const sb = createClient(supabaseUrl, supabaseServiceKey);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!omieKey || !omieSecret) return json({ error: "OMIE_API_KEY / OMIE_API_SECRET não configuradas" }, 500);

  try {
    // Só atualiza estoque dos produtos que já estão no catálogo de
    // Importação Varejo (ativo=true) — evita gravar ~5000 produtos
    // irrelevantes (o restante do catálogo Omie que não é importação).
    // Achado real (30/09, mesma classe de bug já corrigida em
    // sync-importacao-varejo/list-importacao-varejo): um .select() sem
    // .range() cai no limite padrão de 1000 linhas do PostgREST — com
    // 1751 produtos ativos isso descartava 751 deles. Paginar sempre.
    const codigosImportacao = new Set<string>();
    {
      const PAGINA = 1000;
      let offset = 0;
      for (;;) {
        const { data, error } = await sb
          .from("importacao_varejo_produtos")
          .select("codigo")
          .eq("ativo", true)
          .range(offset, offset + PAGINA - 1);
        if (error) throw new Error(`select importacao_varejo_produtos: ${error.message}`);
        for (const p of data ?? []) codigosImportacao.add(p.codigo as string);
        if (!data || data.length < PAGINA) break;
        offset += PAGINA;
      }
    }

    const dataPosicao = formatarDataBR(new Date());
    let pagina = 1;
    let totalPaginas = 1;
    let totalLido = 0;
    const agora = new Date().toISOString();
    const linhasParaGravar: Record<string, unknown>[] = [];

    // Mesmo limite de 100/página confirmado ao vivo (Omie ignora um
    // nRegPorPagina maior) e o mesmo teto de 60 páginas de segurança.
    while (pagina <= totalPaginas && pagina <= 60) {
      const resp = await omiePost<ListarPosEstoqueResp>("estoque/consulta", "ListarPosEstoque", {
        nPagina: pagina,
        nRegPorPagina: 100,
        dDataPosicao: dataPosicao,
      });
      for (const item of resp.produtos || []) {
        totalLido++;
        if (!codigosImportacao.has(item.cCodigo)) continue; // fora do escopo de Importação Varejo
        linhasParaGravar.push({
          codigo: item.cCodigo,
          codigo_produto_omie: item.nCodProd ?? null,
          descricao: item.cDescricao || null,
          fisico: item.fisico ?? 0,
          reservado: item.reservado ?? 0,
          disponivel: item.nSaldo ?? 0,
          minimo_omie: item.estoque_minimo ?? 0,
          pendente: item.nPendente ?? 0,
          cmc: item.nCMC ?? 0,
          preco_unitario: item.nPrecoUnitario ?? 0,
          atualizado_em: agora,
        });
      }
      totalPaginas = resp.nTotPaginas || 1;
      pagina++;
    }

    const BATCH = 500;
    for (let i = 0; i < linhasParaGravar.length; i += BATCH) {
      const { error } = await sb
        .from("importacao_varejo_estoque")
        .upsert(linhasParaGravar.slice(i, i + BATCH), { onConflict: "codigo" });
      if (error) throw new Error(`upsert importacao_varejo_estoque: ${error.message}`);
    }

    return json({ ok: true, produtosImportacao: codigosImportacao.size, estoqueGravado: linhasParaGravar.length, totalLidoOmie: totalLido });
  } catch (error) {
    console.error("sync-importacao-varejo-estoque error:", error);
    return json({ error: (error as Error).message || "Erro interno" }, 500);
  }
});
