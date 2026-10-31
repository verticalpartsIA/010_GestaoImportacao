/* ============================================================
   sync-estoque-omie — Edge Function (vpprd) · sincronizador ÚNICO de estoque
   SÓ LÊ do Omie (estoque/consulta · ListarPosEstoque, ~20 páginas de 100) e grava, numa só passada, nos três destinos que antes
   tinham cada um a sua rotina (as três leem o MESMO endpoint do Omie):
     1) importacao_varejo_estoque  — tela Compras (só itens ativos do catálogo de importação)         [era sync-importacao-varejo-estoque]
     2) pcp_estoque + pcp_produtos — Almoxarifado/PCP (saldo físico "Omie (total)", custo, mínimo)  [era sync-pcp-omie, escopo 'estoque']
     3) pcp_posicao_compra         — reservado/disponível/pendente dos itens do PCP                   [era sync-pcp-consumo, modo 'posicao']
   As três funções antigas continuam existindo (botões manuais); só os crons passam a chamar esta. Ver CLAUDE.md, "Estoque — fase 2".

   Regras que existem por motivo real (herdadas das funções antigas — não afrouxe):
   - Leitura SEMPRE sequencial: o Omie recusa chamadas simultâneas do mesmo método.
   - O Omie conta cada resposta de ERRO como consumo indevido (~10 seguidos bloqueiam a API inteira por 30 min, para TODAS as
     integrações): nunca repete após "consumo indevido" e nunca sonda item a item.
   - Todo select paginado (o PostgREST corta em 1000 linhas em silêncio).
   - Sem supabase-js (import remoto já derrubou produção em redeploy): PostgREST via fetch.
   - Se a leitura do Omie falhar no meio, NADA é gravado (pcp_estoque zera o que não achou — gravar com leitura parcial zeraria saldo).
   Body JSON (opcional): { simular: true } → lê o Omie e devolve o que gravaria, sem gravar nada.
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

/* ---------- PostgREST cru ---------- */
const pgH = (extra: Record<string, string> = {}) => ({
  apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra,
});
async function pgSelectAll<T>(tabela: string, qs: string): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, { headers: pgH({ Range: `${off}-${off + 999}` }) });
    if (!r.ok) throw new Error(`select ${tabela}: ${r.status} ${await r.text()}`);
    const rows = (await r.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
async function pgUpsert(tabela: string, rows: Record<string, unknown>[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 200) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?on_conflict=${onConflict}`, {
      method: "POST", headers: pgH({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(rows.slice(i, i + 200)),
    });
    if (!r.ok) throw new Error(`upsert ${tabela}: ${r.status} ${await r.text()}`);
  }
}
async function pgRpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: pgH(), body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status}`);
  return await r.json();
}

/* ---------- Omie (só leitura) ---------- */
class OmieBloqueado extends Error {}
async function omie<T = any>(endpoint: string, call: string, param: Record<string, unknown>): Promise<T> {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const res = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call, app_key: OMIE_KEY, app_secret: OMIE_SECRET, param: [param] }),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    const fault: string = data?.faultstring || "";
    if (fault) {
      if (/consumo indevido|API bloqueada/i.test(fault)) throw new OmieBloqueado(fault);   // nunca insistir
      const m = fault.match(/Aguarde (\d+) segundos/i);
      if (/redundante/i.test(fault) && m && tentativa < 3) { await sleep((Number(m[1]) + 1) * 1000); continue; }
      if (/j[aá] existe uma requisi[cç][aã]o desse m[eé]todo/i.test(fault) && tentativa < 3) { await sleep(3000); continue; }
      throw new Error(fault);
    }
    if (!res.ok) throw new Error(`Omie HTTP ${res.status}`);
    return data as T;
  }
  throw new Error("Omie: tentativas esgotadas");
}

const pad = (n: number) => String(n).padStart(2, "0");
const dataBR = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY || !OMIE_KEY || !OMIE_SECRET) return json({ error: "Credenciais não configuradas" }, 500);

  let simular = false;
  try { simular = (await req.json())?.simular === true; } catch { /* sem body */ }

  // Limite de taxa (a chamada também vem de botão no navegador, sem credencial de usuário verificável). O cron roda 4x/dia.
  try {
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const taxa = await pgRpc("api_rate_check", { p_bucket: "sync-estoque-omie", p_ip: ip, p_max_ip: 10, p_max_global: 20, p_janela_s: 600 });
    if (taxa !== "ok") return json({ error: "Muitas sincronizações em pouco tempo. Aguarde alguns minutos." }, 429);
  } catch (e) {
    console.warn("[sync-estoque-omie] limite de taxa indisponível", e);
    return json({ error: "Sincronização temporariamente indisponível (verificação de segurança)." }, 503);
  }

  const inicio = new Date().toISOString();
  let logId: string | null = null;
  if (!simular) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pcp_sync_log`, {
        method: "POST", headers: pgH({ Prefer: "return=representation" }), body: JSON.stringify({ escopo: "estoque_unico", iniciado_em: inicio }),
      });
      if (r.ok) logId = ((await r.json()) as any[])[0]?.id ?? null;
    } catch { /* log é best-effort */ }
  }

  const resumo: Record<string, unknown> = { escopo: "estoque_unico", simulado: simular };
  let erro: string | null = null;
  try {
    // 1) Quem interessa: itens ativos da Importação Varejo e produtos do PCP (tudo paginado).
    const iv = new Set((await pgSelectAll<{ codigo: string }>("importacao_varejo_produtos", "select=codigo&ativo=eq.true")).map((p) => p.codigo));
    const pcp = await pgSelectAll<{ codigo: string; codigo_produto_omie: number | null; ativo: boolean }>(
      "pcp_produtos", "select=codigo,codigo_produto_omie,ativo");
    const pcpAtivos = new Set(pcp.filter((p) => p.ativo).map((p) => p.codigo));
    const pcpComIdOmie = new Set(pcp.filter((p) => p.codigo_produto_omie != null).map((p) => p.codigo));

    // 2) UMA passada pelo Omie (sequencial; 100 por página, teto de 60 páginas de segurança).
    const achados = new Map<string, any>();
    let pagina = 1, total = 1, lidos = 0;
    const dataPos = dataBR(new Date());
    while (pagina <= total && pagina <= 60) {
      const r = await omie<{ nTotPaginas: number; produtos: any[] }>("estoque/consulta", "ListarPosEstoque", {
        nPagina: pagina, nRegPorPagina: 100, dDataPosicao: dataPos,
      });
      total = r.nTotPaginas || 1;
      for (const it of r.produtos || []) {
        lidos++;
        const c = it.cCodigo as string;
        if (iv.has(c) || pcpAtivos.has(c) || pcpComIdOmie.has(c)) achados.set(c, it);
      }
      pagina++;
    }
    if (lidos === 0) throw new Error("O Omie não devolveu nenhum produto — nada foi gravado (evita zerar o estoque por leitura vazia).");

    const agora = new Date().toISOString();
    const dataAjuste = agora.slice(0, 10);

    // 3a) Importação Varejo (Compras): só quem está no catálogo ativo e tem posição no Omie.
    const rowsIv: Record<string, unknown>[] = [];
    for (const c of iv) {
      const it = achados.get(c);
      if (!it) continue;
      rowsIv.push({
        codigo: c, codigo_produto_omie: it.nCodProd ?? null, descricao: it.cDescricao || null,
        fisico: it.fisico ?? 0, reservado: it.reservado ?? 0, disponivel: it.nSaldo ?? 0, minimo_omie: it.estoque_minimo ?? 0,
        pendente: it.nPendente ?? 0, cmc: it.nCMC ?? 0, preco_unitario: it.nPrecoUnitario ?? 0, atualizado_em: agora,
      });
    }

    // 3b) PCP/Almoxarifado: toda linha de produto ativo (sem posição no Omie = 0, como sempre), e cadastro dos que têm posição.
    const rowsEstoque: Record<string, unknown>[] = [];
    const rowsProd: Record<string, unknown>[] = [];
    for (const c of pcpAtivos) {
      const it = achados.get(c);
      rowsEstoque.push({
        codigo: c, local_estoque: "Omie (total)", quantidade: it?.fisico ?? 0,
        custo_unitario: it?.nCMC ?? null, data_ajuste: dataAjuste, atualizado_em: agora,
      });
      if (it) rowsProd.push({ codigo: c, descricao: it.cDescricao || c, estoque_minimo: it.estoque_minimo ?? 0, preco_custo: it.nCMC ?? null });
    }

    // 3c) Posição de compra do PCP (reservado/disponível/pendente) — quem tem id do Omie e posição.
    const rowsPos: Record<string, unknown>[] = [];
    for (const c of pcpComIdOmie) {
      const it = achados.get(c);
      if (!it) continue;
      rowsPos.push({ codigo: c, fisico: it.fisico ?? 0, reservado: it.reservado ?? 0, disponivel: it.nSaldo ?? 0, pendente: it.nPendente ?? 0, atualizado_em: agora });
    }

    resumo.lidos_no_omie = lidos;
    resumo.importacao_varejo = { catalogo_ativo: iv.size, gravados: rowsIv.length };
    resumo.pcp_estoque = { produtos: rowsEstoque.length, com_posicao_no_omie: rowsEstoque.length - rowsEstoque.filter((r) => !achados.has(r.codigo as string)).length };
    resumo.pcp_posicao_compra = { gravados: rowsPos.length };

    if (!simular) {
      await pgUpsert("importacao_varejo_estoque", rowsIv, "codigo");
      await pgUpsert("pcp_estoque", rowsEstoque, "codigo,local_estoque");
      if (rowsProd.length) await pgUpsert("pcp_produtos", rowsProd, "codigo");
      await pgUpsert("pcp_posicao_compra", rowsPos, "codigo");
    }
  } catch (e) {
    erro = (e as Error).message;
    console.error("sync-estoque-omie error:", erro);
  }

  const ok = erro === null;
  resumo.erros = erro ? [erro] : [];
  if (logId) {
    await fetch(`${SUPABASE_URL}/rest/v1/pcp_sync_log?id=eq.${logId}`, {
      method: "PATCH", headers: pgH({ Prefer: "return=minimal" }),
      body: JSON.stringify({ finalizado_em: new Date().toISOString(), ok, resumo }),
    }).catch(() => {});
  }
  return json({ ok, ...resumo }, ok ? 200 : 500);
});
