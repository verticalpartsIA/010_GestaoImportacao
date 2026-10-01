/* ============================================================
   sync-importacao-varejo — Edge Function (vpprd)
   Sincronização diária (cron `sync-importacao-varejo-daily`, 9h BRT) do
   módulo "Importação Varejo" (src/importacao-varejo.jsx):

   1) Fase 'catalogo' — pagina geral/produtos ListarProdutos e classifica
      cada produto: entra no catálogo quando
      recomendacoes_fiscais.origem_mercadoria === '1' (código fiscal real
      "Estrangeira - Importação direta", confirmado ao vivo contra
      produtos reais — bate em VPER/VPMP/VPB, não só VPEL) E inativo==='N'.
      Produtos que deixaram de qualificar num ciclo (não tocados nesta
      rodada) são marcados ativo=false, nunca apagados.

   2) Fase 'faturamento' — pagina produtos/nfconsultar ListarNF desde
      01/01/2024 até hoje (pedido explícito do usuário — NÃO é janela
      móvel de X meses como o sistema de referência, é a data fixa) e
      soma a quantidade faturada por código, só dos códigos que já estão
      no catálogo (fase 1 sempre roda primeiro no mesmo ciclo).

   3) Fase 'finalizando' — Curva ABC por volume faturado acumulado no
      período (A<=80%, B<=95%, C<=100%); Curva D = sem venda no período.
      Estoque mínimo calculado = média mensal × 3 (90 dias de cobertura)
      pra A/B/C; fixo em 1 unidade pra D (simplificação deliberada do
      sistema de referência, que distinguia por custo médio — aqui não
      cacheamos custo médio, ele vem ao vivo do estoque/resumo em
      list-importacao-varejo).

   NÃO sincroniza estoque nem "pendente" aqui — ambos vêm AO VIVO da API
   de estoque em lote do Omie (estoque/resumo), consultada por
   list-importacao-varejo a cada carregamento da tela. Só o que muda
   devagar (classificação fiscal + giro histórico) fica cacheado aqui.

   Encadeamento via EdgeRuntime.waitUntil (mesmo padrão de
   sync-omie-sales-velocity do repo verticalpartsIA/003_requisicoes) pra
   não estourar o timeout de uma invocação só — o histórico desde
   01/01/2024 pode ter muitas páginas de NF.
   ============================================================ */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];
const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";

const sb = createClient(supabaseUrl, supabaseServiceKey);

const REGISTROS_POR_PAGINA = 200;
const TEMPO_MAXIMO_MS = 100_000;
const CICLO_ORFAO_MS = 60 * 60_000;
const DATA_INICIAL_FATURAMENTO = "01/01/2024";
const LIMITE_CURVA_A = 0.8;
const LIMITE_CURVA_B = 0.95;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatarDataBR(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

async function omiePost<T>(endpoint: string, call: string, param: Record<string, unknown>, tentativa = 1): Promise<T> {
  const res = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ call, app_key: omieKey, app_secret: omieSecret, param: [param] }),
  });
  const data = (await res.json().catch(() => ({}))) as { faultstring?: string } & T;
  if (data.faultstring) {
    const redundante = /redundante|redundant|too many requests|j[aá] existe uma requisi/i.test(data.faultstring);
    if (redundante && tentativa < 6) {
      await sleep(tentativa * 3000);
      return omiePost<T>(endpoint, call, param, tentativa + 1);
    }
    throw new Error(`Omie: ${data.faultstring}`);
  }
  return data as T;
}

interface Cursor {
  phase: "catalogo" | "faturamento" | "finalizando" | "idle";
  next_pagina: number;
  total_paginas: number | null;
  started_at: string;
}

async function salvarCursor(cursor: Cursor) {
  await sb.from("importacao_varejo_sync_cursor").upsert({ id: true, ...cursor });
}

async function obterOuResetarCursor(continuacao: boolean): Promise<Cursor> {
  const { data } = await sb.from("importacao_varejo_sync_cursor").select("*").eq("id", true).maybeSingle();
  const existente = data as Cursor | null;
  const emAndamentoRecente =
    existente && existente.phase !== "idle" && Date.now() - new Date(existente.started_at).getTime() < CICLO_ORFAO_MS;

  if ((continuacao || emAndamentoRecente) && existente) return existente;

  const novo: Cursor = { phase: "catalogo", next_pagina: 1, total_paginas: null, started_at: new Date().toISOString() };
  await sb.from("importacao_varejo_giro_staging").delete().neq("codigo", "");
  await salvarCursor(novo);
  return novo;
}

type ProdutoOmie = {
  codigo: string;
  codigo_produto: number;
  descricao: string;
  unidade: string;
  ncm: string;
  lead_time: number;
  inativo: string;
  recomendacoes_fiscais?: { origem_mercadoria?: string };
};
type ListarProdutosResp = { total_de_paginas: number; produto_servico_cadastro: ProdutoOmie[] };

async function processarCatalogo(cursor: Cursor): Promise<Cursor> {
  // Achados reais (30/09), os 2 juntos — sem qualquer um dos dois o Omie
  // devolve 0 registros SEMPRE em ListarProdutos, sem erro nenhum
  // (faultstring vazio, HTTP 200) — silencioso, testado ao vivo com as
  // credenciais reais desta função via Edge Function de debug:
  //  1) NUNCA passar `apenas_importado_api` aqui — é parâmetro de
  //     ListarClientes, não de ListarProdutos (copiado por engano de outro
  //     endpoint numa rodada anterior).
  //  2) `filtrar_apenas_omiepdv: "N"` é OBRIGATÓRIO — sem ele o Omie
  //     devolve 0 registros mesmo sem esse produto ter nada a ver com
  //     PDV/OmiePDV (confirmado: com esse campo, `total_de_registros`
  //     bate os 7142 produtos reais da conta; sem ele, sempre 0).
  const resp = await omiePost<ListarProdutosResp>("geral/produtos", "ListarProdutos", {
    pagina: cursor.next_pagina,
    registros_por_pagina: REGISTROS_POR_PAGINA,
    filtrar_apenas_omiepdv: "N",
  });

  const qualificam = (resp.produto_servico_cadastro || []).filter(
    (p) => p.recomendacoes_fiscais?.origem_mercadoria === "1" && p.inativo !== "S",
  );

  if (qualificam.length) {
    const agora = new Date().toISOString();
    const rows = qualificam.map((p) => ({
      codigo: p.codigo,
      codigo_produto_omie: p.codigo_produto,
      descricao: p.descricao,
      unidade: p.unidade || null,
      ncm: p.ncm || null,
      lead_time_dias: p.lead_time || 0,
      ativo: true,
      updated_at: agora,
    }));
    const { error } = await sb.from("importacao_varejo_produtos").upsert(rows, { onConflict: "codigo" });
    if (error) throw new Error(`upsert importacao_varejo_produtos: ${error.message}`);
  }

  const totalPaginas = resp.total_de_paginas || 1;
  const proximaPagina = cursor.next_pagina + 1;
  if (proximaPagina > totalPaginas) {
    // Qualquer produto do catálogo que não foi tocado nesta rodada de
    // classificação (updated_at anterior ao início do ciclo) deixou de
    // qualificar (virou inativo no Omie, ou perdeu origem_mercadoria=1)
    // — marca ativo=false, nunca apaga (histórico de giro/comprado/lote
    // referenciam esse codigo por FK).
    await sb.from("importacao_varejo_produtos").update({ ativo: false }).lt("updated_at", cursor.started_at).eq("ativo", true);
    return { ...cursor, phase: "faturamento", next_pagina: 1, total_paginas: null };
  }
  return { ...cursor, next_pagina: proximaPagina, total_paginas: totalPaginas };
}

type NfItem = { prod: { cProd: string; qCom: number } };
type NfCadastro = { ide: { dCan: string }; det: NfItem[] };
type ListarNfResp = { total_de_paginas: number; nfCadastro: NfCadastro[] };

async function incrementarStaging(somasPorCodigo: Map<string, number>) {
  if (somasPorCodigo.size === 0) return;
  const codigos = [...somasPorCodigo.keys()];
  const { data: existentes } = await sb.from("importacao_varejo_giro_staging").select("codigo,qtd_faturada").in("codigo", codigos);
  const existentesMap = new Map((existentes ?? []).map((r) => [r.codigo as string, r.qtd_faturada as number]));
  const rows = codigos.map((codigo) => ({
    codigo,
    qtd_faturada: (existentesMap.get(codigo) ?? 0) + (somasPorCodigo.get(codigo) ?? 0),
  }));
  await sb.from("importacao_varejo_giro_staging").upsert(rows, { onConflict: "codigo" });
}

async function processarFaturamento(cursor: Cursor, codigosCatalogo: Set<string>): Promise<Cursor> {
  const resp = await omiePost<ListarNfResp>("produtos/nfconsultar", "ListarNF", {
    pagina: cursor.next_pagina,
    registros_por_pagina: REGISTROS_POR_PAGINA,
    dEmiInicial: DATA_INICIAL_FATURAMENTO,
    dEmiFinal: formatarDataBR(new Date()),
  });

  const somas = new Map<string, number>();
  for (const nf of resp.nfCadastro ?? []) {
    if (nf.ide?.dCan) continue; // NF cancelada não conta como venda
    for (const item of nf.det ?? []) {
      const codigo = item.prod?.cProd;
      const qtd = item.prod?.qCom ?? 0;
      if (!codigo || qtd <= 0 || !codigosCatalogo.has(codigo)) continue;
      somas.set(codigo, (somas.get(codigo) ?? 0) + qtd);
    }
  }
  await incrementarStaging(somas);

  const totalPaginas = resp.total_de_paginas || 1;
  const proximaPagina = cursor.next_pagina + 1;
  return proximaPagina > totalPaginas
    ? { ...cursor, phase: "finalizando", next_pagina: 1, total_paginas: null }
    : { ...cursor, next_pagina: proximaPagina, total_paginas: totalPaginas };
}

async function buscarTodasAsLinhas<T>(
  tabela: string,
  colunas: string,
  eq?: { coluna: string; valor: unknown },
): Promise<T[]> {
  const PAGINA = 1000;
  const linhas: T[] = [];
  let offset = 0;
  for (;;) {
    let query = sb.from(tabela).select(colunas).range(offset, offset + PAGINA - 1);
    if (eq) query = query.eq(eq.coluna, eq.valor);
    const { data, error } = await query;
    if (error) throw new Error(`select ${tabela}: ${error.message}`);
    linhas.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGINA) break;
    offset += PAGINA;
  }
  return linhas;
}

async function finalizar(cursor: Cursor): Promise<{ cursor: Cursor; giroCalculado: number }> {
  // Achado real (30/09): um .select() sem paginação no supabase-js cai no
  // limite padrão de 1000 linhas do PostgREST — com 1751 produtos ativos
  // isso descartava 751 deles da Curva/giro em silêncio (giro_calculado
  // voltava 1000, não 1751). Usar sempre buscarTodasAsLinhas aqui.
  const produtosAtivos = await buscarTodasAsLinhas<{ codigo: string }>(
    "importacao_varejo_produtos",
    "codigo",
    { coluna: "ativo", valor: true },
  );
  const codigosAtivos = new Set(produtosAtivos.map((p) => p.codigo).filter(Boolean));

  const staging = await buscarTodasAsLinhas<{ codigo: string; qtd_faturada: number }>(
    "importacao_varejo_giro_staging",
    "codigo,qtd_faturada",
  );
  const stagingMap = new Map(staging.map((s) => [s.codigo, s.qtd_faturada]));

  const inicio = new Date(2024, 0, 1);
  const hoje = new Date();
  const mesesDecorridos = Math.max(
    1,
    (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth()) + 1,
  );

  const vendedores = [...codigosAtivos]
    .map((codigo) => ({ codigo, qtd: stagingMap.get(codigo) ?? 0 }))
    .filter((p) => p.qtd > 0)
    .sort((a, b) => b.qtd - a.qtd);
  const totalFaturado = vendedores.reduce((acc, p) => acc + p.qtd, 0);
  const curvaPorCodigo = new Map<string, "A" | "B" | "C">();
  let acumulado = 0;
  for (const p of vendedores) {
    acumulado += p.qtd;
    const pct = totalFaturado > 0 ? acumulado / totalFaturado : 1;
    curvaPorCodigo.set(p.codigo, pct <= LIMITE_CURVA_A ? "A" : pct <= LIMITE_CURVA_B ? "B" : "C");
  }

  const agora = new Date().toISOString();
  const linhas = [...codigosAtivos].map((codigo) => {
    const qtdFaturada = stagingMap.get(codigo) ?? 0;
    const curva = curvaPorCodigo.get(codigo) ?? "D";
    const mediaMensal = qtdFaturada / mesesDecorridos;
    const estoqueMinimoCalculado = curva === "D" ? 1 : mediaMensal * 3;
    return {
      codigo,
      media_mensal_vendas: mediaMensal,
      curva,
      estoque_minimo_calculado: estoqueMinimoCalculado,
      janela_desde: "2024-01-01",
      updated_at: agora,
    };
  });

  const BATCH = 500;
  for (let i = 0; i < linhas.length; i += BATCH) {
    const { error } = await sb.from("importacao_varejo_giro").upsert(linhas.slice(i, i + BATCH), { onConflict: "codigo" });
    if (error) throw new Error(`upsert importacao_varejo_giro: ${error.message}`);
  }
  // Produto que caiu do catálogo nesta rodada (ativo=false) não precisa
  // mais de linha de giro atualizada, mas não apagamos (FK/histórico).
  await sb.from("importacao_varejo_giro_staging").delete().neq("codigo", "");

  return { cursor: { ...cursor, phase: "idle", next_pagina: 1, total_paginas: null }, giroCalculado: linhas.length };
}

async function continuarSync(isContinuation: boolean, logId: string | null) {
  let cursor = await obterOuResetarCursor(isContinuation);
  const inicio = Date.now();
  let giroCalculado: number | null = null;

  while (cursor.phase !== "idle" && Date.now() - inicio < TEMPO_MAXIMO_MS) {
    if (cursor.phase === "catalogo") {
      cursor = await processarCatalogo(cursor);
    } else if (cursor.phase === "faturamento") {
      // Mesmo cuidado de paginação do finalizar() abaixo — sem isso, NFs de
      // produtos além do 1000º ativo (ordem arbitrária do Postgres) nunca
      // batiam no Set e ficavam fora do giro calculado.
      const produtosAtivos = await buscarTodasAsLinhas<{ codigo: string }>(
        "importacao_varejo_produtos",
        "codigo",
        { coluna: "ativo", valor: true },
      );
      const codigosCatalogo = new Set(produtosAtivos.map((p) => p.codigo).filter(Boolean));
      cursor = await processarFaturamento(cursor, codigosCatalogo);
    } else {
      const resultado = await finalizar(cursor);
      cursor = resultado.cursor;
      giroCalculado = resultado.giroCalculado;
    }
    await salvarCursor(cursor);
  }

  if (cursor.phase === "idle" && logId) {
    const { count } = await sb.from("importacao_varejo_produtos").select("codigo", { count: "exact", head: true }).eq("ativo", true);
    await sb
      .from("importacao_varejo_sync_log")
      .update({ concluido_em: new Date().toISOString(), produtos_sincronizados: count ?? null, giro_calculado: giroCalculado })
      .eq("id", logId);
  }

  return cursor;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!omieKey || !omieSecret) return json({ error: "OMIE_API_KEY / OMIE_API_SECRET não configuradas" }, 500);

  try {
    const url = new URL(req.url);
    const isContinuation = url.searchParams.get("continue") === "1";

    let logId: string | null = null;
    if (!isContinuation) {
      const { data: logRow } = await sb.from("importacao_varejo_sync_log").insert({ iniciado_em: new Date().toISOString() }).select("id").single();
      logId = logRow?.id ?? null;
    } else {
      const { data: logRow } = await sb
        .from("importacao_varejo_sync_log")
        .select("id")
        .is("concluido_em", null)
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      logId = logRow?.id ?? null;
    }

    const cursor = await continuarSync(isContinuation, logId);

    if (cursor.phase !== "idle") {
      // Mesma chave publishable usada pelos crons deste projeto (ver
      // 20260928120000_cron_jobs_publishable_key.sql) — SUPABASE_ANON_KEY
      // não é uma env var garantida neste projeto (convenção daqui usa
      // SUPABASE_SECRET_KEYS pro service role), evitar depender dela.
      const publishableKey = "sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP";
      const selfUrl = `${supabaseUrl}/functions/v1/sync-importacao-varejo?continue=1`;
      const chain = fetch(selfUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
        body: "{}",
      }).catch((e) => console.error("chain error", e));
      // deno-lint-ignore no-explicit-any
      const runtime = globalThis as any;
      if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(chain);
      else await chain;
    }

    return json({ ok: true, phase: cursor.phase, next_pagina: cursor.next_pagina });
  } catch (error) {
    console.error("sync-importacao-varejo error:", error);
    if (String((error as Error).message || "").length) {
      await sb.from("importacao_varejo_sync_log").update({ erro: (error as Error).message }).is("concluido_em", null);
    }
    return json({ error: (error as Error).message || "Erro interno" }, 500);
  }
});
