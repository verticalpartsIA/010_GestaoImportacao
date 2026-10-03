/* ============================================================
   sync-pcp-consumo — Edge Function (vpprd) · PCP, Reposição de materiais.

   SÓ LÊ do Omie. Nada é escrito lá. Grava em pcp_consumo_mov / pcp_consumo_cursor / pcp_posicao_compra.

   Body JSON: { modo: 'historico' }          → lê as SAÍDAS/ENTRADAS do estoque (estoque/movestoque ListarMovimentos)
                                              mês a mês desde pcp_reposicao_config.janela_desde, retomando do cursor.
                                              Cada chamada trabalha até ~100 s e devolve { concluido }. Repita até concluir.
              { modo: 'recente', dias?: 45 } → relê só os últimos N dias (rotina diária; idempotente por id do movimento).
              { modo: 'posicao' }            → ListarPosEstoque: pendente de compra / reservado / disponível dos itens do PCP.

   Regras que existem por motivo real:
   - ListarMovimentoEstoque (estoque/consulta) é usado com 50 por página e NÃO filtra por vários produtos: lê-se a conta inteira
     por janela de data e guarda-se só o que é de item do PCP (idProd ∈ pcp_produtos.codigo_produto_omie).
   - O Omie conta cada resposta de ERRO como consumo indevido (~10 seguidos bloqueiam a API inteira por 30 min, para TODAS
     as integrações). Por isso: nunca sonda item a item, aborta na 3ª falha seguida e NÃO repete após "consumo indevido".
   - O Omie recusa chamadas simultâneas do mesmo método: leitura sempre sequencial, com espera entre tentativas.
   Sem supabase-js (import remoto já derrubou produção em redeploy): PostgREST via fetch.
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
async function pgSelect<T>(tabela: string, qs: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, { headers: pgH({ Range: "0-4999" }) });
  if (!r.ok) throw new Error(`select ${tabela}: ${r.status} ${await r.text()}`);
  return (await r.json()) as T[];
}
async function pgUpsert(tabela: string, rows: Record<string, unknown>[], onConflict: string) {
  if (!rows.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?on_conflict=${onConflict}`, {
    method: "POST", headers: pgH({ Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`upsert ${tabela}: ${r.status} ${await r.text()}`);
}
async function pgPatch(tabela: string, qs: string, body: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, { method: "PATCH", headers: pgH({ Prefer: "return=minimal" }), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`patch ${tabela}: ${r.status} ${await r.text()}`);
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

/* ---------- datas (UTC, sem fuso) ---------- */
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

type Mov = {
  idMov: number; idProd: number; dtMov: string; qtde: number; tipo: string;
  codOrigem?: string; desOrigem?: string; cancelamento?: string; devolucao?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY || !OMIE_KEY || !OMIE_SECRET) return json({ error: "Credenciais não configuradas" }, 500);

  let modo = "", dias = 45;
  try {
    const b = await req.json();
    modo = String(b?.modo || "");
    if (b?.dias) dias = Math.min(120, Math.max(1, Number(b.dias) || 45));
  } catch { /* sem body */ }
  if (!["historico", "recente", "posicao"].includes(modo)) return json({ error: "Informe modo: historico, recente ou posicao" }, 400);

  // Limite de taxa (chamada do navegador, sem credencial de usuário verificável).
  try {
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const taxa = await pgRpc("api_rate_check", { p_bucket: "sync-pcp-consumo", p_ip: ip, p_max_ip: 40, p_max_global: 80, p_janela_s: 600 });
    if (taxa !== "ok") return json({ error: "Muitas consultas em pouco tempo. Aguarde alguns minutos." }, 429);
  } catch (e) {
    console.warn("[sync-pcp-consumo] limite de taxa indisponível", e);
    return json({ error: "Consulta temporariamente indisponível (verificação de segurança)." }, 503);
  }

  const inicio = Date.now();
  const ORCAMENTO_MS = 100_000;
  const resumo: Record<string, unknown> = { modo };
  try {
    const prods = await pgSelect<{ codigo: string; codigo_produto_omie: number | null }>("pcp_produtos", "select=codigo,codigo_produto_omie&codigo_produto_omie=not.is.null");
    const porId = new Map<number, string>(prods.map((p) => [Number(p.codigo_produto_omie), p.codigo]));
    const porCodigo = new Set(prods.map((p) => p.codigo));

    if (modo === "posicao") {
      const hoje = hojeUtc();
      let pagina = 1, total = 1, lidos = 0;
      const rows: Record<string, unknown>[] = [];
      const agora = new Date().toISOString();
      while (pagina <= total && pagina <= 60) {
        const r = await omie<{ nTotPaginas: number; produtos: any[] }>("estoque/consulta", "ListarPosEstoque", {
          nPagina: pagina, nRegPorPagina: 100, dDataPosicao: br(hoje),
        });
        total = r.nTotPaginas || 1;
        for (const it of r.produtos || []) {
          lidos++;
          if (!porCodigo.has(it.cCodigo)) continue;
          rows.push({
            codigo: it.cCodigo, fisico: it.fisico ?? 0, reservado: it.reservado ?? 0, disponivel: it.nSaldo ?? 0,
            pendente: it.nPendente ?? 0, atualizado_em: agora,
          });
        }
        pagina++;
      }
      await pgUpsert("pcp_posicao_compra", rows, "codigo");
      resumo.posicao = { lidos_no_omie: lidos, itens_pcp_gravados: rows.length };
      return json({ ok: true, ...resumo });
    }

    /* ---- movimentos (historico | recente) ---- */
    const hoje = hojeUtc();
    let paginasLidas = 0, gravados = 0, lidos = 0, falhasSeguidas = 0;
    const origens: Record<string, number> = {};

    // lê UMA página da janela [ini, fim]; devolve nTotPaginas
    const lerPagina = async (ini: Date, fim: Date, pagina: number): Promise<number> => {
      // ATENÇÃO: "estoque/movestoque ListarMovimentos" devolve outro formato (resumo por dia, sem origem) e dá 0 movimentos aqui.
      // O detalhado (com origem/cancelamento/devolução) é este, em estoque/consulta; "TODOS" cobre todos os locais de estoque.
      const r = await omie<{ nTotPaginas: number; movProdutoListar: Mov[] }>("estoque/consulta", "ListarMovimentoEstoque", {
        nPagina: pagina, nRegPorPagina: 50, dDtInicial: br(ini), dDtFinal: br(fim), lista_local_estoque: "TODOS",
      });
      const rows: Record<string, unknown>[] = [];
      for (const m of r.movProdutoListar || []) {
        lidos++;
        const cod = porId.get(Number(m.idProd));
        if (!cod) continue;
        const dt = dataIso(m.dtMov);
        if (!dt) continue;
        rows.push({
          id_mov: m.idMov, codigo: cod, dt_mov: dt, qtde: m.qtde, tipo: m.tipo || null,
          cod_origem: m.codOrigem || null, des_origem: m.desOrigem || null,
          cancelamento: m.cancelamento || null, devolucao: m.devolucao || null, atualizado_em: new Date().toISOString(),
        });
        const o = `${m.codOrigem || "?"} ${m.desOrigem || ""}`.trim();
        origens[o] = (origens[o] || 0) + 1;
      }
      await pgUpsert("pcp_consumo_mov", rows, "id_mov");
      gravados += rows.length;
      paginasLidas++;
      return r.nTotPaginas || 1;
    };

    if (modo === "recente") {
      const fim = hoje;
      const ini = new Date(fim.getTime() - dias * 86400000);
      // janelas mensais para manter cada consulta pequena
      let cursor = ini;
      while (cursor <= fim && Date.now() - inicio < ORCAMENTO_MS) {
        const fimJanela = fimDoMes(cursor) < fim ? fimDoMes(cursor) : fim;
        let pagina = 1, total = 1;
        while (pagina <= total && Date.now() - inicio < ORCAMENTO_MS) { total = await lerPagina(cursor, fimJanela, pagina); pagina++; }
        if (pagina <= total) { resumo.concluido = false; break; }
        cursor = new Date(fimJanela.getTime() + 86400000);
      }
      if (resumo.concluido === undefined) resumo.concluido = cursor > fim;
    } else {
      // historico: retoma do cursor
      const cfg = (await pgSelect<{ janela_desde: string }>("pcp_reposicao_config", "select=janela_desde"))[0];
      const cur = (await pgSelect<{ proxima_data: string | null; pagina: number }>("pcp_consumo_cursor", "select=proxima_data,pagina"))[0] || { proxima_data: null, pagina: 1 };
      let janelaIni = fromIso(cur.proxima_data || cfg?.janela_desde || "2024-01-01");
      let pagina = cur.pagina || 1;
      let concluido = false;
      while (Date.now() - inicio < ORCAMENTO_MS) {
        if (janelaIni > hoje) { concluido = true; break; }
        const fimJanela = fimDoMes(janelaIni) < hoje ? fimDoMes(janelaIni) : hoje;
        let total: number;
        try { total = await lerPagina(janelaIni, fimJanela, pagina); falhasSeguidas = 0; }
        catch (e) {
          if (e instanceof OmieBloqueado) throw e;
          if (++falhasSeguidas >= 3) throw e;
          await sleep(2000); continue;
        }
        if (pagina >= total) { janelaIni = new Date(fimJanela.getTime() + 86400000); pagina = 1; }
        else pagina++;
        await pgPatch("pcp_consumo_cursor", "id=eq.true", {
          proxima_data: iso(janelaIni), pagina, atualizado_em: new Date().toISOString(),
        });
      }
      if (concluido) await pgPatch("pcp_consumo_cursor", "id=eq.true", { concluido_ate: iso(hoje), atualizado_em: new Date().toISOString() });
      resumo.concluido = concluido;
      resumo.proxima_data = iso(janelaIni);
      resumo.pagina = pagina;
    }
    resumo.paginas_lidas = paginasLidas;
    resumo.movimentos_lidos = lidos;
    resumo.movimentos_pcp_gravados = gravados;
    resumo.origens = origens;
    return json({ ok: true, ...resumo });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[sync-pcp-consumo]", msg);
    if (e instanceof OmieBloqueado) return json({ ok: false, bloqueado: true, error: `O Omie bloqueou a API por consumo indevido. Aguarde ~35 minutos antes de tentar de novo. (${msg})`, ...resumo }, 503);
    return json({ ok: false, error: msg, ...resumo }, 500);
  }
});
