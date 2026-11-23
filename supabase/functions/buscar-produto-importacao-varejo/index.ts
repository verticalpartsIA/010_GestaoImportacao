/* ============================================================
   buscar-produto-importacao-varejo — Edge Function (vpprd) · botão "Buscar no Omie" de /logistica/compras.

   Recebe { codigo }, consulta o produto no Omie (geral/produtos ConsultarProduto — SÓ LEITURA) e:
     - não existe no Omie            → { encontrado: false }            (a tela avisa "Produto não cadastrado no Omie!")
     - existe mas está inativo       → { encontrado: true, inativo: true }  (não entra)
     - já está na lista da tela      → { encontrado: true, jaNaLista: true }
     - existe e está ativo           → grava em importacao_varejo_produtos com manual = true (o sync diário não desativa)
                                       e devolve { encontrado: true, adicionado: true, produto }.
   Estoque, giro e preço entram nas próximas sincronizações (a tela chama "Sincronizar estoque agora" em seguida).
   Nada é escrito no Omie. Sem supabase-js (mesmo padrão de estoque-omie-endereco).
   ============================================================ */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"] as string; } catch { return ""; }
})() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OMIE_KEY = Deno.env.get("OMIE_API_KEY") || "";
const OMIE_SECRET = Deno.env.get("OMIE_API_SECRET") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const pgH = (extra: Record<string, string> = {}) => ({
  apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra,
});
async function pg(method: string, path: string, body?: unknown, prefer = "return=representation") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers: pgH({ Prefer: prefer }), body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${path.split("?")[0]}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

class NaoCadastrado extends Error {}

async function consultarProduto(codigo: string): Promise<any> {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const res = await fetch("https://app.omie.com.br/api/v1/geral/produtos/", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call: "ConsultarProduto", app_key: OMIE_KEY, app_secret: OMIE_SECRET, param: [{ codigo }] }),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    const fault: string = data?.faultstring || "";
    if (fault) {
      if (/n[aã]o cadastrad|n[aã]o encontrad/i.test(fault)) throw new NaoCadastrado(fault);
      const m = fault.match(/Aguarde (\d+) segundos/i);
      if (/redundante/i.test(fault) && tentativa < 3) { await sleep(((m ? Number(m[1]) : 3) + 1) * 1000); continue; }
      throw new Error(`Omie: ${fault}`);
    }
    if (!res.ok) throw new Error(`Omie HTTP ${res.status}`);
    return data;
  }
  throw new Error("Omie: tentativas esgotadas");
}

function emailDoJwt(req: Request): string | null {
  try {
    const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").split(".")[1];
    if (!t) return null;
    const p = JSON.parse(atob(t.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof p.email === "string" ? p.email : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY || !OMIE_KEY || !OMIE_SECRET) return json({ error: "Credenciais não configuradas" }, 500);

  let codigo = "";
  try { codigo = String((await req.json())?.codigo ?? "").trim(); } catch { /* corpo vazio */ }
  if (!codigo || codigo.length > 60) return json({ error: "Informe o código do produto." }, 400);

  try {
    // Primeiro o código como foi digitado; se o Omie não conhece, tenta em maiúsculas.
    let p: any;
    try { p = await consultarProduto(codigo); }
    catch (e) {
      if (!(e instanceof NaoCadastrado) || codigo === codigo.toUpperCase()) throw e;
      codigo = codigo.toUpperCase();
      p = await consultarProduto(codigo);
    }

    const codigoOmie: string = String(p?.codigo || codigo);
    const idOmie = Number(p?.codigo_produto);
    if (!(idOmie > 0)) return json({ encontrado: false });
    if (p?.inativo === "S") return json({ encontrado: true, inativo: true, codigo: codigoOmie, descricao: p?.descricao || "" });

    const existente = await pg("GET", `importacao_varejo_produtos?select=codigo,ativo&codigo=eq.${encodeURIComponent(codigoOmie)}&limit=1`);
    if (existente?.[0]?.ativo === true) {
      return json({ encontrado: true, jaNaLista: true, codigo: codigoOmie, descricao: p?.descricao || "" });
    }

    const agora = new Date().toISOString();
    const row = {
      codigo: codigoOmie,
      codigo_produto_omie: idOmie,
      descricao: p?.descricao || codigoOmie,
      unidade: p?.unidade || null,
      ncm: p?.ncm || null,
      lead_time_dias: Number(p?.lead_time) || 0,
      ativo: true,
      manual: true,
      manual_por: emailDoJwt(req),
      manual_em: agora,
      updated_at: agora,
    };
    await pg("POST", "importacao_varejo_produtos?on_conflict=codigo", row, "resolution=merge-duplicates,return=minimal");
    return json({
      encontrado: true, adicionado: true,
      produto: { codigo: row.codigo, descricao: row.descricao, origemMercadoria: p?.recomendacoes_fiscais?.origem_mercadoria ?? null },
    });
  } catch (e) {
    if (e instanceof NaoCadastrado) return json({ encontrado: false });
    return json({ error: (e as Error).message.slice(0, 400) }, 500);
  }
});
