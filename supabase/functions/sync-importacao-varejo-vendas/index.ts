/* ============================================================
   sync-importacao-varejo-vendas — Edge Function (vpprd)
   Lê do Omie (SÓ LEITURA) os movimentos de estoque detalhados
   (estoque/consulta ListarMovimentoEstoque, local "TODOS") e grava em
   importacao_varejo_mov os que são de produtos da Importação Varejo
   (importacao_varejo_produtos, ativo). É a base da sugestão de estoque
   mínimo/máximo (vendas por mês de 2025 e 2026).

   Corpo: { desde?: 'AAAA-MM-DD', ate?: 'AAAA-MM-DD' }. Sem corpo = últimos 60 dias (cron diário).
   Carga histórica: { desde: '2025-01-01' }; se não terminar em ~100 s devolve
   { concluido:false, proxima_data } — chame de novo com desde = proxima_data.

   Mesmo padrão de sync-pcp-consumo: fetch cru (sem supabase-js, ver BOOT_ERROR
   em list-importacao-varejo), nunca insiste quando o Omie bloqueia por consumo indevido.
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
async function pgSelectTodas<T>(tabela: string, qs: string): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, { headers: pgH({ Range: `${off}-${off + 999}` }) });
    if (!r.ok) throw new Error(`select ${tabela}: ${r.status} ${await r.text()}`);
    const d = (await r.json()) as T[];
    out.push(...d);
    if (d.length < 1000) break;
  }
  return out;
}
async function pgUpsert(tabela: string, rows: Record<string, unknown>[], onConflict: string) {
  if (!rows.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?on_conflict=${onConflict}`, {
    method: "POST", headers: pgH({ Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`upsert ${tabela}: ${r.status} ${await r.text()}`);
}
async function pgRpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: pgH(), body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status}`);
  return await r.json();
}

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
      if (/consumo indevido|API bloqueada/i.test(fault)) throw new OmieBloqueado(fault);
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
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const br = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
const fromIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fimDoMes = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
const hojeUtc = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); };
function dataIso(d: unknown): string | null {
  const m = String(d || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

type Mov = { idMov: number; idProd: number; dtMov: string; qtde: number; tipo: string; codOrigem?: string; desOrigem?: string; cancelamento?: string; devolucao?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY || !OMIE_KEY || !OMIE_SECRET) return json({ error: "Credenciais não configuradas" }, 500);

  let desde: string | null = null, ate: string | null = null;
  try { const b = await req.json(); desde = b?.desde || null; ate = b?.ate || null; } catch { /* sem corpo */ }
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if ((desde && !re.test(desde)) || (ate && !re.test(ate))) return json({ error: "Datas no formato AAAA-MM-DD" }, 400);

  try {
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const taxa = await pgRpc("api_rate_check", { p_bucket: "sync-importacao-varejo-vendas", p_ip: ip, p_max_ip: 40, p_max_global: 80, p_janela_s: 600 });
    if (taxa !== "ok") return json({ error: "Muitas consultas em pouco tempo. Aguarde alguns minutos." }, 429);
  } catch (e) {
    console.warn("[sync-importacao-varejo-vendas] limite de taxa indisponível", e);
    return json({ error: "Consulta temporariamente indisponível (verificação de segurança)." }, 503);
  }

  const inicio = Date.now();
  const ORCAMENTO_MS = 100_000;
  const hoje = hojeUtc();
  const resumo: Record<string, unknown> = {};
  try {
    const prods = await pgSelectTodas<{ codigo: string; codigo_produto_omie: number | null }>("importacao_varejo_produtos", "select=codigo,codigo_produto_omie&ativo=eq.true&codigo_produto_omie=not.is.null");
    const porId = new Map<number, string>(prods.map((p) => [Number(p.codigo_produto_omie), p.codigo.toUpperCase()]));

    const fim = ate ? fromIso(ate) : hoje;
    let cursor = desde ? fromIso(desde) : new Date(hoje.getTime() - 60 * 86400000);
    let lidos = 0, gravados = 0, paginas = 0, falhas = 0;
    const origens: Record<string, number> = {};
    let concluido = true;

    while (cursor <= fim) {
      const fimJanela = fimDoMes(cursor) < fim ? fimDoMes(cursor) : fim;
      let pagina = 1, total = 1;
      while (pagina <= total) {
        if (Date.now() - inicio > ORCAMENTO_MS) { concluido = false; break; }
        try {
          const r = await omie<{ nTotPaginas: number; movProdutoListar: Mov[] }>("estoque/consulta", "ListarMovimentoEstoque", {
            nPagina: pagina, nRegPorPagina: 50, dDtInicial: br(cursor), dDtFinal: br(fimJanela), lista_local_estoque: "TODOS",
          });
          falhas = 0;
          total = r.nTotPaginas || 1;
          const rows: Record<string, unknown>[] = [];
          for (const m of r.movProdutoListar || []) {
            lidos++;
            const cod = porId.get(Number(m.idProd));
            const dt = dataIso(m.dtMov);
            if (!cod || !dt) continue;
            rows.push({
              id_mov: m.idMov, codigo: cod, dt_mov: dt, qtde: m.qtde, tipo: m.tipo || null,
              cod_origem: m.codOrigem || null, des_origem: m.desOrigem || null,
              cancelamento: m.cancelamento || null, devolucao: m.devolucao || null, atualizado_em: new Date().toISOString(),
            });
            const o = `${m.codOrigem || "?"} ${m.desOrigem || ""}`.trim();
            origens[o] = (origens[o] || 0) + 1;
          }
          await pgUpsert("importacao_varejo_mov", rows, "id_mov");
          gravados += rows.length; paginas++; pagina++;
        } catch (e) {
          if (e instanceof OmieBloqueado) throw e;
          if (++falhas >= 3) throw e;
          await sleep(2000);
        }
      }
      if (!concluido) break;
      cursor = new Date(fimJanela.getTime() + 86400000);
    }
    resumo.concluido = concluido;
    resumo.proxima_data = iso(cursor);
    resumo.paginas_lidas = paginas;
    resumo.movimentos_lidos = lidos;
    resumo.movimentos_gravados = gravados;
    resumo.origens = origens;
    return json({ ok: true, ...resumo });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[sync-importacao-varejo-vendas]", msg);
    if (e instanceof OmieBloqueado) return json({ ok: false, bloqueado: true, error: `O Omie bloqueou a API por consumo indevido. Aguarde ~35 minutos antes de tentar de novo. (${msg})`, ...resumo }, 503);
    return json({ ok: false, error: msg, ...resumo }, 500);
  }
});
