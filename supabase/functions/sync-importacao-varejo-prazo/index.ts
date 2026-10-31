/* ============================================================
   sync-importacao-varejo-prazo — Edge Function (vpprd)
   Lê do Omie (SÓ LEITURA) TODO o histórico de Pedidos de Compra
   (produtos/pedidocompra PesquisarPedCompra, contrato confirmado em
   sync-importacao-varejo-fornecedor) e grava, por (pedido, produto),
   data do pedido, previsão, quantidade pedida/recebida em
   importacao_varejo_pedidos_hist — só dos produtos da Importação Varejo.
   Depois, a função SQL iv_calcular_prazo_real() casa esses pedidos com as
   entradas de estoque (importacao_varejo_mov) e calcula o prazo real.

   Corpo opcional: { pagina?: n } — retoma de uma página. Se não terminar em
   ~100 s devolve { concluido:false, proxima_pagina }; chame de novo.
   Sem supabase-js (BOOT_ERROR em redeploy); nunca insiste com o Omie bloqueado.
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

function dataIso(d: unknown): string | null {
  const m = String(d || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY || !OMIE_KEY || !OMIE_SECRET) return json({ error: "Credenciais não configuradas" }, 500);

  let pagina = 1, recentes = false;
  try { const b = await req.json(); if (Number(b?.pagina) > 0) pagina = Number(b.pagina); recentes = b?.recentes === true; } catch { /* sem corpo */ }

  try {
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const taxa = await pgRpc("api_rate_check", { p_bucket: "sync-importacao-varejo-prazo", p_ip: ip, p_max_ip: 20, p_max_global: 40, p_janela_s: 600 });
    if (taxa !== "ok") return json({ error: "Muitas consultas em pouco tempo. Aguarde alguns minutos." }, 429);
  } catch (e) {
    console.warn("[sync-importacao-varejo-prazo] limite de taxa indisponível", e);
    return json({ error: "Consulta temporariamente indisponível (verificação de segurança)." }, 503);
  }

  const inicio = Date.now();
  const ORCAMENTO_MS = 100_000;
  try {
    const prods = await pgSelectTodas<{ codigo: string }>("importacao_varejo_produtos", "select=codigo&ativo=eq.true");
    const ativos = new Set(prods.map((p) => p.codigo.toUpperCase()));

    let totalPaginas = pagina, lidos = 0, gravados = 0, paginas = 0;   // atualizado após a 1ª leitura; ao retomar, não pode começar em 1
    let concluido = true;
    while (pagina <= totalPaginas) {
      if (Date.now() - inicio > ORCAMENTO_MS) { concluido = false; break; }
      const r = await omie<{ nTotalPaginas: number; pedidos_pesquisa: any[] }>("produtos/pedidocompra", "PesquisarPedCompra", {
        nPagina: pagina, nRegsPorPagina: 100,
        lExibirPedidosPendentes: false, lExibirPedidosFaturados: true, lExibirPedidosRecebidos: true,
        lExibirPedidosCancelados: false, lExibirPedidosEncerrados: true,
      });
      totalPaginas = r.nTotalPaginas || 1;
      const linhas = new Map<string, Record<string, unknown>>();
      for (const ped of r.pedidos_pesquisa || []) {
        lidos++;
        const cab = ped.cabecalho_consulta || {};
        const dt = dataIso(cab.dIncData);
        if (!dt || !cab.cNumero) continue;
        for (const it of ped.produtos_consulta || []) {
          const cod = String(it.cProduto || "").trim().toUpperCase();
          if (!cod || !ativos.has(cod)) continue;
          const chave = `${cab.cNumero}|${cod}`;
          const atual = linhas.get(chave);
          if (atual) {
            atual.qtde = Number(atual.qtde) + (Number(it.nQtde) || 0);
            atual.qtde_recebida = Number(atual.qtde_recebida) + (Number(it.nQtdeRec) || 0);
          } else {
            linhas.set(chave, {
              pedido: String(cab.cNumero), codigo: cod, data_pedido: dt, data_previsao: dataIso(cab.dDtPrevisao),
              qtde: Number(it.nQtde) || 0, qtde_recebida: Number(it.nQtdeRec) || 0,
              fornecedor_codigo_omie: cab.nCodFor ? Number(cab.nCodFor) : null, etapa: cab.cEtapa ? String(cab.cEtapa) : null,
              atualizado_em: new Date().toISOString(),
            });
          }
        }
      }
      await pgUpsert("importacao_varejo_pedidos_hist", [...linhas.values()], "pedido,codigo");
      gravados += linhas.size; paginas++; pagina++;
      // modo diário: a lista vem do mais antigo para o mais novo, então só as últimas páginas trazem pedido novo
      if (recentes && paginas === 1 && pagina === 2 && totalPaginas > 5) pagina = totalPaginas - 3;
    }
    return json({ ok: true, concluido, proxima_pagina: pagina, total_paginas: totalPaginas, paginas_lidas: paginas, pedidos_lidos: lidos, linhas_gravadas: gravados });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[sync-importacao-varejo-prazo]", msg);
    if (e instanceof OmieBloqueado) return json({ ok: false, bloqueado: true, error: `O Omie bloqueou a API por consumo indevido. Aguarde ~35 minutos antes de tentar de novo. (${msg})` }, 503);
    return json({ ok: false, error: msg }, 500);
  }
});
