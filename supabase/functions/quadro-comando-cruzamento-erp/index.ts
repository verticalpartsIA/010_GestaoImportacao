/* ============================================================
   quadro-comando-cruzamento-erp — Edge Function (vpprd)
   Cruza os SKUs calculados na BOM de um Quadro de Comando contra o
   cadastro REAL de produtos no Omie (ConsultarProduto por código) —
   item 6 da instrução original (instrucaoPedidoQC.md): identificar
   "cadastrado e solicitado" vs "solicitado sem cadastro", mais
   divergência de descrição/unidade entre o catálogo local
   (materiais_catalogo) e o Omie.

   Só CONSULTA — nunca escreve no Omie nem altera a BOM/pedido. Quem
   decide o que fazer com "solicitado sem cadastro" é o usuário
   (spec: "sem adicionar automaticamente ao pedido os itens que só
   aparecem no ERP" — aqui vale o inverso também: nunca cadastra no
   Omie sozinho um item que só existe no pedido).

   Mesmo padrão de chamada/rate-limit de omie_sync_pagamentos_instaladores
   (350ms entre chamadas — Omie tem rate-limit real, achado naquela
   função). Só que aqui não há paginação: ConsultarProduto é 1
   requisição por SKU.
   ============================================================ */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ResultadoSku = {
  encontrado: boolean | null; // true=achou, false=confirmado que não existe, null=erro real de consulta (não confunda com "não existe")
  descricao?: string | null;
  unidade?: string | null;
  erro?: string;
};

async function consultarProduto(codigo: string): Promise<ResultadoSku> {
  const res = await fetch("https://app.omie.com.br/api/v1/geral/produtos/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      call: "ConsultarProduto",
      app_key: omieKey,
      app_secret: omieSecret,
      param: [{ codigo }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && !data.faultstring) {
    return { encontrado: true, descricao: data.descricao ?? null, unidade: data.unidade ?? null };
  }
  const fault = String(data.faultstring || `HTTP ${res.status}`);
  // Omie devolve essa mensagem específica (HTTP 500, sem faultstring
  // padrão) quando o código simplesmente não está cadastrado — distinguir
  // de erro real de API (rede, credencial expirada, rate-limit); senão
  // qualquer falha de infraestrutura vira "solicitado sem cadastro" por
  // engano, o que seria um falso positivo grave (achado testando ao vivo
  // com um código inexistente antes de escrever esta função).
  if (/n[aã]o cadastrad[oa]/i.test(fault)) return { encontrado: false };
  return { encontrado: null, erro: fault.slice(0, 300) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);
  if (!omieKey || !omieSecret) {
    return json({ error: "OMIE_API_KEY / OMIE_API_SECRET não configuradas no Supabase" }, 500);
  }

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const skusBrutos: unknown[] = Array.isArray(payload?.skus) ? payload.skus : [];
  const skus: string[] = [...new Set(skusBrutos.filter((s): s is string => typeof s === "string" && s.trim().length > 0))];
  if (!skus.length) return json({ error: "Nenhum SKU informado (payload.skus)" }, 400);
  if (skus.length > 150) return json({ error: "Máximo de 150 SKUs por chamada — divida em lotes menores" }, 400);

  const resultados: Record<string, ResultadoSku> = {};
  for (const sku of skus) {
    try {
      resultados[sku] = await consultarProduto(sku);
    } catch (e) {
      resultados[sku] = { encontrado: null, erro: String(e).slice(0, 300) };
    }
    await sleep(350);
  }

  return json({ resultados });
});
