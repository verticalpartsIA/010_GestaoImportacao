/* ============================================================
   quadro-comando-cruzamento-erp — Edge Function (vpprd)
   Cruza os SKUs calculados na BOM de um Quadro de Comando contra o
   cadastro REAL de produtos no Omie (ConsultarProduto por código) —
   item 6 da instrução original (instrucaoPedidoQC.md): identificar
   "cadastrado e solicitado" vs "solicitado sem cadastro", mais
   divergência de descrição/unidade entre o catálogo local
   (materiais_catalogo) e o Omie.

   Também cruza a QUANTIDADE EM ESTOQUE (Omie) de cada SKU contra a
   quantidade necessária da BOM — pedido do usuário (24/09/2026):
   mesmo caráter de diagnóstico, nunca escreve nada. ConsultarProduto
   NÃO tem o saldo de estoque confiável (campo quantidade_estoque
   sempre veio 0 em teste real, mesmo pra SKU com estoque físico
   confirmado) — o saldo de verdade vem de ListarPosEstoque
   (estoque/consulta/), que é uma lista paginada (sem filtro por SKU)
   com cap de 100 registros/página. Pra não bater ~20 páginas no Omie
   a cada cruzamento, o snapshot completo fica cacheado na tabela
   omie_estoque_cache e só é refeito se tiver mais de CACHE_TTL_MIN
   minutos — item 7 da tarefa.

   Só CONSULTA — nunca escreve no Omie nem altera a BOM/pedido. Quem
   decide o que fazer com "solicitado sem cadastro" é o usuário
   (spec: "sem adicionar automaticamente ao pedido os itens que só
   aparecem no ERP" — aqui vale o inverso também: nunca cadastra no
   Omie sozinho um item que só existe no pedido).

   Mesmo padrão de chamada/rate-limit de omie_sync_pagamentos_instaladores
   (350ms entre chamadas — Omie tem rate-limit real, achado naquela
   função). ConsultarProduto não tem paginação (1 requisição por SKU);
   ListarPosEstoque é paginada, só rodada no refresh do cache.

   Acesso ao Postgres via REST puro (fetch), NÃO via @supabase/supabase-js:
   o import do supabase-js pelo esm.sh derrubou o boot desta função com
   BOOT_ERROR (confirmado isolando o problema num deploy mínimo só com
   esse import, 24/09/2026 — falha na infra de bundling do Supabase ao
   buscar o pacote no esm.sh, não bug de código; funções antigas que já
   tinham esse import bundlado continuavam rodando, mas qualquer deploy
   NOVO com esse import falhava). fetch cru contra /rest/v1/ com a
   service role key resolve sem essa dependência externa.
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
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function restHeaders(extra?: Record<string, string>) {
  return { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json", ...extra };
}

const CACHE_TTL_MIN = 5;

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

/* ---------- Estoque (ListarPosEstoque, snapshot cacheado) ----------
   cCodigo bate com o SKU local. nSaldo = fisico - reservado (saldo
   realmente disponível, não o físico bruto — reservado já está
   comprometido com outro pedido). Cap real observado: 100
   registros/página mesmo pedindo mais. */
type LinhaEstoqueOmie = {
  cCodigo: string;
  nCodProd: number;
  fisico: number;
  reservado: number;
  nSaldo: number;
};

async function buscarPaginaEstoque(pagina: number): Promise<{ produtos: LinhaEstoqueOmie[]; totalPaginas: number }> {
  const res = await fetch("https://app.omie.com.br/api/v1/estoque/consulta/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      call: "ListarPosEstoque",
      app_key: omieKey,
      app_secret: omieSecret,
      param: [{ nPagina: pagina, nRegPorPagina: 100, dDataPosicao: "", cExibeTodos: "N" }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.faultstring) throw new Error(String(data.faultstring || `HTTP ${res.status}`));
  return { produtos: data.produtos || [], totalPaginas: data.nTotPaginas || 1 };
}

async function refreshEstoqueCache(): Promise<void> {
  let pagina = 1;
  let totalPaginas = 1;
  do {
    const { produtos, totalPaginas: tp } = await buscarPaginaEstoque(pagina);
    totalPaginas = tp;
    if (produtos.length) {
      const agora = new Date().toISOString();
      const rows = produtos.map((p) => ({
        sku: p.cCodigo,
        codigo_produto: p.nCodProd,
        fisico: p.fisico,
        reservado: p.reservado,
        saldo: p.nSaldo,
        atualizado_em: agora,
      }));
      const res = await fetch(`${supabaseUrl}/rest/v1/omie_estoque_cache?on_conflict=sku`, {
        method: "POST",
        headers: restHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(rows),
      });
      if (!res.ok) throw new Error(`Falha ao gravar cache de estoque: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
    }
    pagina++;
    if (pagina <= totalPaginas) await sleep(350);
  } while (pagina <= totalPaginas);
}

async function cacheEstaFresco(): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/rest/v1/omie_estoque_cache?select=atualizado_em&order=atualizado_em.desc&limit=1`, {
    headers: restHeaders(),
  });
  if (!res.ok) return false;
  const rows = await res.json().catch(() => []);
  if (!rows || !rows.length) return false;
  const idadeMin = (Date.now() - new Date(rows[0].atualizado_em).getTime()) / 60000;
  return idadeMin < CACHE_TTL_MIN;
}

/* Retorna o mapa sku -> saldo pros SKUs pedidos. erroGeral != null quando
   o refresh do cache falhou de ponta a ponta (rede/credencial Omie) — aí
   TODAS as linhas mostram "Erro ao consultar" no estoque, mas o
   cadastro/descrição/unidade (que usa outra chamada, ConsultarProduto)
   continua funcionando normal — uma falha não trava a outra (item 6). */
async function buscarEstoquePorSkus(skus: string[]): Promise<{ mapa: Record<string, number | null>; erroGeral: string | null }> {
  let erroGeral: string | null = null;
  if (!(await cacheEstaFresco())) {
    try {
      await refreshEstoqueCache();
    } catch (e) {
      erroGeral = String(e).slice(0, 300);
    }
  }
  const lista = skus.map((s) => encodeURIComponent(s)).join(",");
  const res = await fetch(`${supabaseUrl}/rest/v1/omie_estoque_cache?select=sku,saldo&sku=in.(${lista})`, {
    headers: restHeaders(),
  });
  if (!res.ok) { erroGeral = erroGeral || `Falha ao ler cache de estoque: HTTP ${res.status}`; return { mapa: {}, erroGeral }; }
  const data = await res.json().catch(() => []);
  const mapa: Record<string, number | null> = {};
  (data || []).forEach((r: { sku: string; saldo: number | null }) => { mapa[r.sku] = r.saldo; });
  return { mapa, erroGeral };
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

  const { mapa: estoque, erroGeral: estoqueErro } = await buscarEstoquePorSkus(skus);

  return json({ resultados, estoque, estoqueErro });
});
