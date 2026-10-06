/* ============================================================
   sync-pcp-compras — Edge Function (vpprd) · PCP, custo do componente a partir das COMPRAS.

   SÓ LÊ do Omie (produtos/pedidocompra · PesquisarPedCompra). Nada é escrito lá.
   Grava em pcp_compras_itens (linhas de compra dos itens do PCP) e nas colunas custo_compra* de pcp_produtos.

   Por quê: o "Custo Omie" do PCP vem do custo médio do ESTOQUE, que o Omie só informa enquanto há saldo; o item já
   comprado e sem saldo aparecia "sem custo". Regra aprovada: média PONDERADA por quantidade das compras RECEBIDAS dos
   últimos 12 meses → preço do pedido PENDENTE (o cálculo está em src/custo-calc.js, copiado abaixo entre os marcadores
   BEGIN/END CALC; src/custo-compras-paridade.test.js falha se uma cópia mudar sem a outra).

   Body JSON: { simular?: true, meses?: 12 }   — simular devolve o que gravaria, sem gravar nada em lugar nenhum.

   Regras que existem por motivo real:
   - Omie conta cada resposta de ERRO como consumo indevido (~10 seguidos bloqueiam a API inteira por 30 min, para TODAS
     as integrações): leitura sempre sequencial, paginada (nunca produto a produto) e NUNCA repete após "consumo indevido".
   - Pedido com preço 0 (ex.: requisição convertida sem preço) é ignorado pelo cálculo.
   - Linha de pedido pendente que sumiu do Omie (pedido cancelado) é apagada daqui, mas só se TODAS as páginas foram lidas.
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
  for (let i = 0; i < rows.length; i += 400) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?on_conflict=${onConflict}`, {
      method: "POST", headers: pgH({ Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify(rows.slice(i, i + 400)),
    });
    if (!r.ok) throw new Error(`upsert ${tabela}: ${r.status} ${await r.text()}`);
  }
}
async function pgPatch(tabela: string, qs: string, body: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, { method: "PATCH", headers: pgH({ Prefer: "return=minimal" }), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`patch ${tabela}: ${r.status} ${await r.text()}`);
}
async function pgDelete(tabela: string, qs: string): Promise<number> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, { method: "DELETE", headers: pgH({ Prefer: "return=representation" }) });
  if (!r.ok) throw new Error(`delete ${tabela}: ${r.status} ${await r.text()}`);
  return ((await r.json()) as unknown[]).length;
}
async function pgRpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: pgH(), body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status}`);
  return await r.json();
}

/* ---------- Omie (só leitura) ---------- */
class OmieBloqueado extends Error {}
// deno-lint-ignore no-explicit-any
async function omie<T = any>(endpoint: string, call: string, param: Record<string, unknown>): Promise<T> {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const res = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call, app_key: OMIE_KEY, app_secret: OMIE_SECRET, param: [param] }),
    });
    // deno-lint-ignore no-explicit-any
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

/* ---------- datas (UTC) ---------- */
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const br = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
function dataIso(d: unknown): string | null {
  const m = String(d || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/* ---------- cálculo (cópia de src/custo-calc.js — manter IGUAL) ---------- */
// BEGIN CALC custoPorCompras
function custoPorCompras(linhas, hojeIso, meses) {
  const num = (x) => Number(x) || 0;
  const d = new Date(hojeIso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() - (meses || 12));
  const desde = d.toISOString().slice(0, 10);
  const todas = linhas || [];
  const rec = todas.filter((l) => l.situacao === 'recebido' && num(l.valor_unitario) > 0 && num(l.qtde_recebida) > 0 && l.data_pedido && l.data_pedido >= desde);
  const pend = todas.filter((l) => l.situacao === 'pendente' && num(l.valor_unitario) > 0 && num(l.quantidade) > 0);
  const media = (ls, campo) => {
    const q = ls.reduce((s, l) => s + num(l[campo]), 0);
    const v = ls.reduce((s, l) => s + num(l[campo]) * num(l.valor_unitario), 0);
    return Math.round((v / q) * 10000) / 10000;
  };
  const maisRecente = (ls) => ls.map((l) => l.data_pedido || '').sort().pop() || null;
  if (rec.length) return { custo: media(rec, 'qtde_recebida'), fonte: 'media_12m', em: maisRecente(rec), n: rec.length };
  if (pend.length) return { custo: media(pend, 'quantidade'), fonte: 'pedido_pendente', em: maisRecente(pend), n: pend.length };
  return null;
}
// END CALC

type Linha = {
  pedido_id: number; item_id: number; numero_pedido: string; data_pedido: string | null; etapa: string; situacao: "recebido" | "pendente";
  fornecedor_cod: number | null; codigo: string; unidade: string | null; quantidade: number; qtde_recebida: number;
  valor_unitario: number; valor_total: number; data_previsao: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY || !OMIE_KEY || !OMIE_SECRET) return json({ error: "Credenciais não configuradas" }, 500);

  let simular = false, meses = 12;
  try {
    const b = await req.json();
    simular = b?.simular === true;
    if (b?.meses) meses = Math.min(24, Math.max(1, Number(b.meses) || 12));
  } catch { /* sem body */ }

  // Limite de taxa (pode ser chamada do navegador, sem credencial de usuário verificável).
  try {
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const taxa = await pgRpc("api_rate_check", { p_bucket: "sync-pcp-compras", p_ip: ip, p_max_ip: 12, p_max_global: 30, p_janela_s: 600 });
    if (taxa !== "ok") return json({ error: "Muitas consultas em pouco tempo. Aguarde alguns minutos." }, 429);
  } catch (e) {
    console.warn("[sync-pcp-compras] limite de taxa indisponível", e);
    return json({ error: "Consulta temporariamente indisponível (verificação de segurança)." }, 503);
  }

  const inicio = Date.now();
  const inicioIso = new Date(inicio).toISOString();
  try {
    const prods = await pgSelect<{ codigo: string; custo_compra: number | null }>("pcp_produtos", "select=codigo,custo_compra&ativo=eq.true");
    const codigos = new Set(prods.map((p) => p.codigo));
    const hoje = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const hojeIso = iso(hoje);

    const linhas = new Map<string, Linha>();   // chave pedido_id:item_id (um pedido pode aparecer nas duas buscas)
    let pedidosLidos = 0, completo = true;

    // Lê todas as páginas de uma busca, sequencialmente. Para ao primeiro erro (não repete) e marca como incompleto.
    async function ler(filtros: Record<string, string>, desde: Date) {
      let pagina = 1, total = 1;
      while (pagina <= total && pagina <= 30) {
        if (Date.now() - inicio > 110_000) { completo = false; return; }
        // deno-lint-ignore no-explicit-any
        const r = await omie<any>("produtos/pedidocompra", "PesquisarPedCompra", {
          nPagina: pagina, nRegsPorPagina: 100, lApenasImportadoApi: "F", lApenasAlterados: "F",
          lExibirPedidosCancelados: "F", dDataInicial: br(desde), dDataFinal: br(hoje), ...filtros,
        });
        total = r.nTotalPaginas || 1;
        for (const p of r.pedidos_pesquisa || []) {
          pedidosLidos++;
          const c = p.cabecalho_consulta || {};
          for (const it of p.produtos_consulta || []) {
            if (!codigos.has(it.cProduto)) continue;
            const qrec = Number(it.nQtdeRec) || 0;
            const l: Linha = {
              pedido_id: Number(c.nCodPed), item_id: Number(it.nCodItem), numero_pedido: String(c.cNumero || ""),
              data_pedido: dataIso(c.dIncData), etapa: String(c.cEtapa || ""), situacao: qrec > 0 ? "recebido" : "pendente",
              fornecedor_cod: c.nCodFor ? Number(c.nCodFor) : null, codigo: it.cProduto, unidade: it.cUnidade || null,
              quantidade: Number(it.nQtde) || 0, qtde_recebida: qrec, valor_unitario: Number(it.nValUnit) || 0, valor_total: Number(it.nValTot) || 0,
              data_previsao: dataIso(c.dDtPrevisao),
            };
            if (l.pedido_id && l.item_id) linhas.set(`${l.pedido_id}:${l.item_id}`, l);
          }
        }
        pagina++;
        if (pagina <= total) await sleep(400);
      }
    }
    const desdeRec = new Date(hoje); desdeRec.setUTCMonth(desdeRec.getUTCMonth() - meses); desdeRec.setUTCDate(desdeRec.getUTCDate() - 7);
    const desdePend = new Date(hoje); desdePend.setUTCMonth(desdePend.getUTCMonth() - 6);
    // 1) pedidos já recebidos/faturados (inclui parciais) nos últimos `meses`
    await ler({ lExibirPedidosPendentes: "F", lExibirPedidosFaturados: "T", lExibirPedidosRecebidos: "T", lExibirPedidosEncerrados: "T", lExibirPedidosRecParciais: "T", lExibirPedidosFatParciais: "T" }, desdeRec);
    // 2) pedidos pendentes (últimos 6 meses)
    await ler({ lExibirPedidosPendentes: "T", lExibirPedidosFaturados: "F", lExibirPedidosRecebidos: "F", lExibirPedidosEncerrados: "F", lExibirPedidosRecParciais: "F", lExibirPedidosFatParciais: "F" }, desdePend);

    // Cálculo por produto
    const porCodigo = new Map<string, Linha[]>();
    for (const l of linhas.values()) (porCodigo.get(l.codigo) || porCodigo.set(l.codigo, []).get(l.codigo)!).push(l);
    const resultado = new Map<string, { custo: number; fonte: string; em: string | null; n: number }>();
    for (const [cod, ls] of porCodigo) {
      const r = custoPorCompras(ls, hojeIso, meses);
      if (r) resultado.set(cod, r);
    }
    const perderam = prods.filter((p) => p.custo_compra != null && !resultado.has(p.codigo)).map((p) => p.codigo);
    const porFonte = { media_12m: 0, pedido_pendente: 0 } as Record<string, number>;
    resultado.forEach((r) => { porFonte[r.fonte] = (porFonte[r.fonte] || 0) + 1; });

    const resumo: Record<string, unknown> = {
      ok: true, simulado: simular, completo, pedidos_lidos: pedidosLidos, linhas_pcp: linhas.size,
      produtos_com_custo: resultado.size, por_fonte: porFonte, perderam_custo: perderam.length,
      amostra: Array.from(resultado.entries()).slice(0, 12).map(([codigo, r]) => ({ codigo, ...r })),
    };
    if (simular) return json(resumo);
    if (!completo) { resumo.aviso = "Leitura incompleta (tempo ou paginação): nada foi gravado."; resumo.ok = false; return json(resumo, 206); }

    // Grava: linhas (upsert) → pendentes que sumiram (delete) → custo nos produtos
    await pgUpsert("pcp_compras_itens", Array.from(linhas.values()).map((l) => ({ ...l, atualizado_em: inicioIso })), "pedido_id,item_id");
    resumo.pendentes_removidas = await pgDelete("pcp_compras_itens", `situacao=eq.pendente&atualizado_em=lt.${encodeURIComponent(inicioIso)}`);
    // Nomes dos fornecedores (cache em pcp_fornecedores_omie): só consulta quem ainda não tem nome, no máximo 20 por rodada, e
    // para no 2º erro seguido (cada erro conta para o bloqueio por consumo indevido do Omie).
    const codsFor = Array.from(new Set(Array.from(linhas.values()).map((l) => l.fornecedor_cod).filter((c): c is number => !!c)));
    const jaTem = new Set((await pgSelect<{ codigo: number }>("pcp_fornecedores_omie", "select=codigo&nome=not.is.null")).map((x) => Number(x.codigo)));
    const novosFor: Record<string, unknown>[] = []; let errosFor = 0;
    for (const cod of codsFor.filter((c) => !jaTem.has(c)).slice(0, 20)) {
      try {
        // deno-lint-ignore no-explicit-any
        const r = await omie<any>("geral/clientes", "ConsultarCliente", { codigo_cliente_omie: cod });
        novosFor.push({ codigo: cod, nome: r.nome_fantasia || r.razao_social || null, atualizado_em: inicioIso });
        errosFor = 0;
      } catch (e) { if (e instanceof OmieBloqueado) throw e; if (++errosFor >= 2) break; }
      await sleep(400);
    }
    if (novosFor.length) await pgUpsert("pcp_fornecedores_omie", novosFor, "codigo");
    resumo.fornecedores_novos = novosFor.length;
    const alvo = Array.from(resultado.entries());
    for (let i = 0; i < alvo.length; i += 8) {
      await Promise.all(alvo.slice(i, i + 8).map(([cod, r]) => pgPatch("pcp_produtos", `codigo=eq.${encodeURIComponent(cod)}`, {
        custo_compra: r.custo, custo_compra_fonte: r.fonte, custo_compra_em: r.em, custo_compra_n: r.n, custo_compra_atualizado_em: inicioIso,
      })));
    }
    for (const cod of perderam) {
      await pgPatch("pcp_produtos", `codigo=eq.${encodeURIComponent(cod)}`, { custo_compra: null, custo_compra_fonte: null, custo_compra_em: null, custo_compra_n: null, custo_compra_atualizado_em: inicioIso });
    }
    resumo.duracao_ms = Date.now() - inicio;
    return json(resumo);
  } catch (e) {
    const msg = (e as Error).message || String(e);
    console.error("[sync-pcp-compras]", msg);
    return json({ ok: false, error: e instanceof OmieBloqueado ? "Omie bloqueou a API por consumo indevido; aguarde 30 minutos." : msg }, e instanceof OmieBloqueado ? 503 : 500);
  }
});
