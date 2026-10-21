/* ============================================================
   estoque-omie-endereco — Edge Function (vpprd) · endereço do almoxarifado: HUB → Omie.

   ⚠️ ESCRITA REAL no Omie. O Omie precisa refletir o chão: o que está em importacao_varejo_contagem.endereco
   ("R2I8 / R2H8 / H23") vai para a característica "Endereço" do produto (geral/prodcaract).

   Quem enche a fila é o gatilho trg_iv_contagem_enfileira_endereco_omie (migration 20261021120000): um registro por
   produto em estoque_omie_endereco_fila, sempre com o endereço MAIS RECENTE. Quem chama esta função é o cron
   estoque-omie-endereco-sync (a cada minuto). A função NÃO aceita dados de fora: lê só a fila, então chamá-la com a chave
   pública é inofensivo (no máximo adianta o processamento).

   Para cada pedido:
     1. acha o nº interno do produto no Omie (nCodProd): importacao_varejo_produtos.codigo_produto_omie, ou ConsultarProduto;
     2. AlterarCaractProduto da característica "Endereço" (nCodCaract fixo da conta); se o produto ainda não tem, IncluirCaractProduto;
        endereço vazio → ExcluirCaractProduto;
     3. marca 'enviado' — só se o endereço da fila não mudou no meio do caminho (senão fica 'pendente' com o valor novo).
   Falha do Omie → 'erro' com o motivo; tenta de novo depois (até 5 vezes, esperando 10 min entre as tentativas).

   Sem supabase-js (import remoto já derrubou produção em redeploy).
   ============================================================ */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"] as string; } catch { return ""; }
})() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OMIE_KEY = Deno.env.get("OMIE_API_KEY") || "";
const OMIE_SECRET = Deno.env.get("OMIE_API_SECRET") || "";

const N_COD_CARACT_ENDERECO = 2822103120;   // característica "Endereço" no catálogo geral da conta Omie
const LOTE = 40;                            // pedidos por execução
const ORCAMENTO_MS = 100_000;               // para de pegar pedido novo depois disso (o limite da função é maior)
const PAUSA_MS = 350;                       // folga entre chamadas ao Omie
const MAX_TENTATIVAS = 5;
const ESPERA_REENVIO_MIN = 10;

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

async function omie(endpoint: string, call: string, param: Record<string, unknown>): Promise<any> {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const res = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      // Acentos como \uXXXX: o Omie grava quebrado quando o corpo vai em UTF-8 cru.
      body: JSON.stringify({ call, app_key: OMIE_KEY, app_secret: OMIE_SECRET, param: [param] })
        .replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    const fault: string = data?.faultstring || "";
    if (fault) {
      const m = fault.match(/Aguarde (\d+) segundos/i);
      if (/redundante/i.test(fault) && m && tentativa < 4) { await sleep((Number(m[1]) + 1) * 1000); continue; }
      if (/j[aá] existe uma requisi/i.test(fault) && tentativa < 4) { await sleep(1200); continue; }
      throw new Error(fault);
    }
    if (!res.ok) throw new Error(`Omie HTTP ${res.status}`);
    return data;
  }
  throw new Error("Omie: tentativas esgotadas");
}

type Pedido = { codigo: string; endereco: string | null; status: string; tentativas: number; atualizado_em: string };

async function idOmieDoProduto(codigo: string): Promise<number> {
  const rows = await pg("GET", `importacao_varejo_produtos?select=codigo_produto_omie&codigo=eq.${encodeURIComponent(codigo)}&codigo_produto_omie=not.is.null&limit=1`);
  const local = Number(rows?.[0]?.codigo_produto_omie);
  if (local > 0) return local;
  const p = await omie("geral/produtos", "ConsultarProduto", { codigo });   // produto fora do cadastro local: pergunta ao Omie
  const id = Number(p?.codigo_produto);
  if (!(id > 0)) throw new Error(`Produto ${codigo} não encontrado no Omie.`);
  return id;
}

/* Grava (ou apaga) a característica "Endereço" do produto no Omie. */
async function gravarNoOmie(nCodProd: number, endereco: string | null) {
  if (!endereco) {
    try { await omie("geral/prodcaract", "ExcluirCaractProduto", { nCodProd, nCodCaract: N_COD_CARACT_ENDERECO }); }
    catch (e) { if (!/n[aã]o (cadastrad|encontrad|possui|existe)/i.test((e as Error).message)) throw e; }   // já não tinha: ok
    return;
  }
  const dados = { nCodProd, nCodCaract: N_COD_CARACT_ENDERECO, cConteudo: endereco.slice(0, 200) };
  try {
    await omie("geral/prodcaract", "AlterarCaractProduto", dados);
  } catch (e) {
    if (!/n[aã]o (cadastrad|encontrad|possui|existe)|inexistente/i.test((e as Error).message)) throw e;
    await omie("geral/prodcaract", "IncluirCaractProduto", { ...dados, cExibirItemNF: "N", cExibirItemPedido: "N", cExibirOrdemProd: "N" });   // produto ainda sem a característica
  }
}

async function processar(p: Pedido) {
  const marca = encodeURIComponent(p.atualizado_em);   // só fecha o pedido se ninguém mudou o endereço no meio do caminho
  try {
    const id = await idOmieDoProduto(p.codigo);
    await gravarNoOmie(id, p.endereco);
    await pg("PATCH", `estoque_omie_endereco_fila?codigo=eq.${encodeURIComponent(p.codigo)}&atualizado_em=eq.${marca}`,
      { status: "enviado", erro: null, enviado_endereco: p.endereco, enviado_em: new Date().toISOString() }, "return=minimal");
    return { codigo: p.codigo, ok: true };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 500);
    await pg("PATCH", `estoque_omie_endereco_fila?codigo=eq.${encodeURIComponent(p.codigo)}&atualizado_em=eq.${marca}`,
      { status: "erro", erro: msg, tentativas: p.tentativas + 1, atualizado_em: new Date().toISOString() }, "return=minimal").catch(() => {});
    return { codigo: p.codigo, ok: false, erro: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY || !OMIE_KEY || !OMIE_SECRET) return json({ error: "Credenciais não configuradas" }, 500);

  const inicio = Date.now();
  const limite = new Date(Date.now() - ESPERA_REENVIO_MIN * 60_000).toISOString();
  // pendentes primeiro (mais antigos antes); depois os que deram erro há mais de 10 min e ainda têm tentativas
  const pendentes: Pedido[] = await pg("GET",
    `estoque_omie_endereco_fila?select=codigo,endereco,status,tentativas,atualizado_em&status=eq.pendente&order=atualizado_em.asc&limit=${LOTE}`) || [];
  let fila = pendentes;
  if (fila.length < LOTE) {
    const erros: Pedido[] = await pg("GET",
      `estoque_omie_endereco_fila?select=codigo,endereco,status,tentativas,atualizado_em&status=eq.erro&tentativas=lt.${MAX_TENTATIVAS}&atualizado_em=lt.${encodeURIComponent(limite)}&order=atualizado_em.asc&limit=${LOTE - fila.length}`) || [];
    fila = fila.concat(erros);
  }

  const resultados: { codigo: string; ok: boolean; erro?: string }[] = [];
  for (const p of fila) {
    if (Date.now() - inicio > ORCAMENTO_MS) break;
    resultados.push(await processar(p));
    await sleep(PAUSA_MS);
  }
  const falhas = resultados.filter((r) => !r.ok);
  return json({ processados: resultados.length, enviados: resultados.length - falhas.length, falhas: falhas.slice(0, 10) });
});
