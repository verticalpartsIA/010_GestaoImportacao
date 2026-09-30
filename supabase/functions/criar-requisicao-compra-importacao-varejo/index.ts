/* ============================================================
   criar-requisicao-compra-importacao-varejo — Edge Function (vpprd)
   Cria uma Requisição de Compra REAL no Omie (produtos/requisicaocompra
   IncluirReq) a partir dos itens selecionados na tela Importação Varejo
   — mesmo padrão do Estoque Omie de referência (repo
   verticalpartsIA/003_requisicoes), trocando só a categoria contábil:

   codCateg = "2.01.95" — "Compras de Mercadorias para Revenda
   Importada" (confirmada ao vivo no Omie, distinta da "2.01.01" nacional
   que o sistema de referência usa — mais correta pro escopo deste
   módulo, que é especificamente produtos importados).

   ⚠️ ESCRITA REAL no Omie — nunca chamado automaticamente, só quando o
   comprador confirma no modal "Enviar requisição de compra em massa" do
   frontend. Não cria/atualiza nada em importacao_varejo_comprado
   sozinho — igual ao sistema de referência, o lançamento de "Comprado"
   continua sendo uma ação manual separada (senão a Sugestão de Compra
   não reflete a requisição recém-criada até alguém logar).
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
  if (data.faultstring) throw new Error(data.faultstring);
  if (!res.ok) throw new Error(`Omie HTTP ${res.status}`);
  return data as T;
}

type ItemEntrada = { codigo: string; descricao: string; quantidade: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!omieKey || !omieSecret) return json({ error: "OMIE_API_KEY / OMIE_API_SECRET não configuradas" }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    const itens = (body.itens || []) as ItemEntrada[];
    if (!Array.isArray(itens) || itens.length === 0) return json({ error: "Informe ao menos 1 item." }, 400);
    if (itens.length > 200) return json({ error: "Máximo de 200 itens por requisição." }, 400);

    const codigos = itens.map((i) => i.codigo);
    const { data: produtos, error: errProdutos } = await sb
      .from("importacao_varejo_produtos")
      .select("codigo,codigo_produto_omie")
      .in("codigo", codigos);
    if (errProdutos) throw new Error(`select importacao_varejo_produtos: ${errProdutos.message}`);
    const codProdPorCodigo = new Map((produtos ?? []).map((p) => [p.codigo as string, p.codigo_produto_omie as number]));

    const itensValidos: { codProd: number; qtde: number; obsItem: string }[] = [];
    const itensComErro: { codigo: string; motivo: string }[] = [];
    for (const item of itens) {
      const codProd = codProdPorCodigo.get(item.codigo);
      if (!codProd) {
        itensComErro.push({ codigo: item.codigo, motivo: "Código não encontrado no catálogo sincronizado de Importação Varejo." });
        continue;
      }
      if (!(Number(item.quantidade) > 0)) {
        itensComErro.push({ codigo: item.codigo, motivo: "Quantidade inválida." });
        continue;
      }
      itensValidos.push({ codProd, qtde: Number(item.quantidade), obsItem: item.descricao || item.codigo });
    }

    if (itensValidos.length === 0) return json({ error: "Nenhum item válido pra enviar.", itensComErro }, 400);

    const resp = await omiePost<{ codReqCompra: number }>("produtos/requisicaocompra", "IncluirReq", {
      codCateg: "2.01.95",
      codIntReqCompra: `IV-${Date.now()}`,
      dtSugestao: formatarDataBR(new Date()),
      obsIntReqCompra: "Reposição de estoque — gerado via Sugestão de Compra (Importação Varejo)",
      ItensReqCompra: itensValidos.map((item) => ({ codProd: item.codProd, qtde: item.qtde, precoUnit: 0, obsItem: item.obsItem })),
    });

    return json({ codReqCompra: resp.codReqCompra, quantidadeItens: itensValidos.length, itensComErro });
  } catch (error) {
    console.error("criar-requisicao-compra-importacao-varejo error:", error);
    return json({ error: (error as Error).message || "Erro interno" }, 500);
  }
});
