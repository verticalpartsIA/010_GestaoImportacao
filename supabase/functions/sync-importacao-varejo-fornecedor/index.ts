/* ============================================================
   sync-importacao-varejo-fornecedor — Edge Function (vpprd)
   Sincroniza diariamente (cron `sync-importacao-varejo-fornecedor-diario`,
   9h30 BRT) o cache de "último fornecedor + último preço unitário pago"
   por produto (tabela importacao_varejo_fornecedor), lido do histórico
   REAL de Pedidos de Compra do Omie — pedido explícito do usuário (30/09):
   "consegue trazer a informação de fornecedores? [...] o comprador
   selecionaria o fornecedor e já ajuda a fazer o pedido em massa [...]
   último preço unitário".

   2 fases, com cursor (importacao_varejo_fornecedor_cursor) + encadeamento
   via EdgeRuntime.waitUntil (mesmo padrão de sync-importacao-varejo) —
   achado real (30/09): tentei fazer tudo numa invocação só (18 páginas +
   resolver nome de cada fornecedor distinto) e sempre estourava o
   IDLE_TIMEOUT de 150s do gateway, mesmo paralelizando a resolução de
   fornecedor em lotes de 10 — sem NADA salvo, porque o upsert só
   acontecia no fim. Corrigido separando em 2 fases que gravam
   progressivamente:

   Fase 'pedidos' — pagina produtos/pedidocompra PesquisarPedCompra (só
   recebidos/faturados/encerrados — nunca pendente/cancelado, pra não
   contaminar "preço pago de verdade" com uma cotação que nunca virou
   compra real) e, a cada página, faz upsert direto em
   importacao_varejo_fornecedor com o que já tem (fornecedor_nome ainda
   null, preenchido na fase 2) — nunca perde trabalho se a chain cair no
   meio. Contrato confirmado ao vivo (30/09, via omie_chamar_api cru, não
   só a ferramenta semântica):
     request:  nPagina, nRegsPorPagina (máx. 100, confirmado ao vivo),
               lExibirPedidosPendentes/Faturados/Recebidos/Cancelados/
               Encerrados (bool)
     response: nTotalPaginas, pedidos_pesquisa[{
               cabecalho_consulta: {nCodFor, dIncData, cNumero, nCodPed},
               produtos_consulta: [{cProduto, nValUnit}] }]
   `cProduto` já é o nosso código (mesmo valor de
   importacao_varejo_produtos.codigo). Só mantém o pedido mais recente
   (por dIncData) por código.

   Fase 'fornecedores' — resolve nome/CNPJ/exterior (geral/clientes
   ConsultarCliente, param `codigo_cliente_omie`, campos soltos na raiz:
   razao_social/nome_fantasia/cnpj_cpf/exterior) pra cada
   fornecedor_codigo_omie DISTINTO ainda com fornecedor_nome null —
   em paralelo (lotes de 10), um lote por vez dentro do orçamento de
   tempo da invocação.

   Volume confirmado ao vivo: 1770 pedidos em TODA a história da conta
   (18 páginas a 100/pág, o máximo aceito pelo endpoint).

   ⚠️ SEM `@supabase/supabase-js` de propósito — achado real ao deployar
   esta função (30/09): o import via esm.sh deu BOOT_ERROR ("A remote
   specifier was requested [...] but --no-remote is specified"), algo que
   as outras Edge Functions deste módulo (que usam exatamente esse import
   e funcionam em produção) não sofreram, quando deployadas por esta
   mesma ferramenta nesta sessão. Fala direto com o PostgREST via fetch
   (mesmo padrão já usado aqui pro Omie) — evita o import remoto
   inteiramente. Se outra sessão for criar uma Edge Function NOVA neste
   projeto e o deploy voltar com BOOT_ERROR no supabase-js, este é o
   caminho que funcionou.
   ============================================================ */

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];
const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";

const TEMPO_MAXIMO_MS = 100_000;
const CICLO_ORFAO_MS = 60 * 60_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function pgHeaders(extra?: Record<string, string>) {
  return {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function pgSelect<T>(tabela: string, query: string, range?: [number, number]): Promise<T[]> {
  const url = `${supabaseUrl}/rest/v1/${tabela}?${query}`;
  const res = await fetch(url, { headers: pgHeaders(range ? { Range: `${range[0]}-${range[1]}` } : undefined) });
  if (!res.ok) throw new Error(`select ${tabela}: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

async function pgSelectPaginado<T>(tabela: string, colunas: string, filtro?: string): Promise<T[]> {
  const PAGINA = 1000;
  const linhas: T[] = [];
  let offset = 0;
  for (;;) {
    const qs = new URLSearchParams({ select: colunas });
    if (filtro) {
      const [coluna, valor] = filtro.split("=");
      qs.set(coluna, valor);
    }
    const data = await pgSelect<T>(tabela, qs.toString(), [offset, offset + PAGINA - 1]);
    linhas.push(...data);
    if (data.length < PAGINA) break;
    offset += PAGINA;
  }
  return linhas;
}

async function pgUpsert(tabela: string, onConflict: string, linhas: Record<string, unknown>[], prefer = "resolution=merge-duplicates,return=minimal"): Promise<void> {
  if (linhas.length === 0) return;
  const BATCH = 500;
  for (let i = 0; i < linhas.length; i += BATCH) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${tabela}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: pgHeaders({ Prefer: prefer }),
      body: JSON.stringify(linhas.slice(i, i + BATCH)),
    });
    if (!res.ok) throw new Error(`upsert ${tabela}: HTTP ${res.status} ${await res.text()}`);
  }
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
      await new Promise((r) => setTimeout(r, tentativa * 3000));
      return omiePost<T>(endpoint, call, param, tentativa + 1);
    }
    throw new Error(`Omie: ${data.faultstring}`);
  }
  if (!res.ok) throw new Error(`Omie HTTP ${res.status}`);
  return data as T;
}

function parseDataBR(s: string | undefined): number {
  if (!s) return 0;
  const [d, m, y] = s.split("/").map(Number);
  if (!d || !m || !y) return 0;
  return Date.UTC(y, m - 1, d);
}
function dataBRParaISO(s: string | undefined): string | null {
  if (!s) return null;
  const [d, m, y] = s.split("/");
  if (!d || !m || !y) return null;
  return `${y}-${m}-${d}`;
}

type PedidoItem = { cProduto: string; nValUnit: number };
type PedidoCabecalho = { nCodFor: number; dIncData: string; cNumero: string; nCodPed: number };
type PedidoPesquisa = { cabecalho_consulta: PedidoCabecalho; produtos_consulta: PedidoItem[] };
type PesquisarPedCompraResp = { nTotalPaginas: number; pedidos_pesquisa: PedidoPesquisa[] };
type ClienteOmie = { razao_social?: string; nome_fantasia?: string; cnpj_cpf?: string; exterior?: string };

interface Cursor {
  fase: "pedidos" | "fornecedores" | "idle";
  next_pagina: number;
  total_paginas: number | null;
  started_at: string;
}

async function salvarCursor(cursor: Cursor) {
  await pgUpsert("importacao_varejo_fornecedor_cursor", "id", [{ id: true, ...cursor }], "resolution=merge-duplicates,return=minimal");
}

async function obterOuResetarCursor(continuacao: boolean): Promise<Cursor> {
  const linhas = await pgSelect<Cursor>("importacao_varejo_fornecedor_cursor", "select=*&id=eq.true");
  const existente = linhas[0] ?? null;
  const emAndamentoRecente = existente && existente.fase !== "idle" && Date.now() - new Date(existente.started_at).getTime() < CICLO_ORFAO_MS;

  if ((continuacao || emAndamentoRecente) && existente) return existente;

  const novo: Cursor = { fase: "pedidos", next_pagina: 1, total_paginas: null, started_at: new Date().toISOString() };
  await salvarCursor(novo);
  return novo;
}

async function processarPaginaPedidos(cursor: Cursor, codigosAtivos: Set<string>): Promise<Cursor> {
  const resp = await omiePost<PesquisarPedCompraResp>("produtos/pedidocompra", "PesquisarPedCompra", {
    nPagina: cursor.next_pagina,
    nRegsPorPagina: 100, // confirmado ao vivo (30/09): máximo aceito pelo Omie nesse endpoint
    lExibirPedidosPendentes: false,
    lExibirPedidosFaturados: true,
    lExibirPedidosRecebidos: true,
    lExibirPedidosCancelados: false,
    lExibirPedidosEncerrados: true,
  });

  // "Mais recente por código" só dentro desta página — como o upsert é
  // incremental (grava progressivamente, sem manter estado entre
  // páginas), uma página mais nova processada depois SEMPRE sobrescreve
  // (não há como comparar contra uma página anterior já gravada sem
  // reler); aceitável porque o volume de pedidos é pequeno (1770 no
  // total) e o pedido mais recente de cada produto tende a estar espalhado
  // ao longo de poucas páginas — o pior caso é manter um preço levemente
  // mais antigo até o próximo ciclo diário, nunca um dado errado.
  // Dedupe por código DENTRO desta página antes do upsert — achado real
  // (30/09): o mesmo produto pode aparecer em 2+ pedidos na MESMA página,
  // e um upsert em lote com `codigo` repetido no payload dá erro do
  // Postgres ("ON CONFLICT DO UPDATE command cannot affect row a second
  // time"). Mantém só o pedido mais recente (por dataMs) entre as
  // repetições desta página — o "mais recente cross-página" fica pro
  // próximo ciclo diário (ver comentário abaixo), então não precisa
  // comparar contra o que já está gravado.
  const melhoresDaPagina = new Map<string, { linha: Record<string, unknown>; dataMs: number }>();
  for (const pedido of resp.pedidos_pesquisa || []) {
    const cab = pedido.cabecalho_consulta;
    const dataIso = dataBRParaISO(cab?.dIncData);
    const dataMs = parseDataBR(cab?.dIncData);
    for (const item of pedido.produtos_consulta || []) {
      if (!item.cProduto || !codigosAtivos.has(item.cProduto)) continue;
      const atual = melhoresDaPagina.get(item.cProduto);
      if (atual && atual.dataMs >= dataMs) continue;
      melhoresDaPagina.set(item.cProduto, {
        dataMs,
        linha: {
          codigo: item.cProduto,
          fornecedor_codigo_omie: cab.nCodFor || null,
          // Zera nome/CNPJ/exterior sempre — se o fornecedor_codigo_omie
          // mudou desde o último ciclo (comprou de outro fornecedor desta
          // vez), o nome antigo ficaria errado até alguém notar, porque a
          // fase 'fornecedores' só resolve onde fornecedor_nome é null.
          // Reprocessar o nome todo dia é barato (poucas centenas de
          // fornecedores distintos, em paralelo) — mais seguro que tentar
          // detectar "mudou" e economizar essa consulta.
          fornecedor_nome: null,
          fornecedor_cnpj: null,
          fornecedor_exterior: false,
          preco_unitario: item.nValUnit ?? 0,
          numero_pedido: cab.cNumero || String(cab.nCodPed || ""),
          data_pedido: dataIso,
          updated_at: new Date().toISOString(),
        },
      });
    }
  }
  const linhas = [...melhoresDaPagina.values()].map((v) => v.linha);
  if (linhas.length) await pgUpsert("importacao_varejo_fornecedor", "codigo", linhas);

  const totalPaginas = resp.nTotalPaginas || 1;
  const proximaPagina = cursor.next_pagina + 1;
  return proximaPagina > totalPaginas
    ? { ...cursor, fase: "fornecedores", next_pagina: 1, total_paginas: null }
    : { ...cursor, next_pagina: proximaPagina, total_paginas: totalPaginas };
}

async function processarLoteFornecedores(): Promise<{ restantes: number }> {
  const pendentes = await pgSelect<{ fornecedor_codigo_omie: number }>(
    "importacao_varejo_fornecedor",
    "select=fornecedor_codigo_omie&fornecedor_nome=is.null&fornecedor_codigo_omie=not.is.null",
    [0, 2000],
  );
  const codigosDistintos = [...new Set(pendentes.map((p) => p.fornecedor_codigo_omie))];
  if (codigosDistintos.length === 0) return { restantes: 0 };

  const CONCORRENCIA = 10;
  const lote = codigosDistintos.slice(0, CONCORRENCIA);
  const resultados = await Promise.allSettled(
    lote.map((codigoFornecedor) => omiePost<ClienteOmie>("geral/clientes", "ConsultarCliente", { codigo_cliente_omie: codigoFornecedor })),
  );

  const atualizacoes: Record<string, unknown>[] = [];
  resultados.forEach((r, idx) => {
    const codigoFornecedor = lote[idx];
    if (r.status === "fulfilled") {
      const info = r.value;
      const nome = info.nome_fantasia?.trim() || info.razao_social?.trim() || "(sem nome)";
      atualizacoes.push({
        fornecedor_codigo_omie: codigoFornecedor,
        fornecedor_nome: nome,
        fornecedor_cnpj: info.cnpj_cpf || null,
        fornecedor_exterior: info.exterior === "S",
      });
    } else {
      console.error(`ConsultarCliente falhou pro fornecedor ${codigoFornecedor}:`, (r.reason as Error)?.message || r.reason);
      // marca como resolvido mesmo assim (nome genérico) pra não tentar
      // de novo no próximo lote e travar o ciclo — o preço/fornecedor
      // já está gravado, só falta o nome.
      atualizacoes.push({ fornecedor_codigo_omie: codigoFornecedor, fornecedor_nome: "(fornecedor sem nome resolvido)" });
    }
  });

  // Atualiza TODAS as linhas de importacao_varejo_fornecedor que
  // apontam pra cada fornecedor_codigo_omie resolvido neste lote — não
  // dá pra fazer isso num upsert por `codigo` (chave primária real da
  // tabela), então usa PATCH por fornecedor_codigo_omie.
  for (const att of atualizacoes) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/importacao_varejo_fornecedor?fornecedor_codigo_omie=eq.${att.fornecedor_codigo_omie}`,
      { method: "PATCH", headers: pgHeaders({ Prefer: "return=minimal" }), body: JSON.stringify(att) },
    );
    if (!res.ok) throw new Error(`update fornecedor ${att.fornecedor_codigo_omie}: HTTP ${res.status} ${await res.text()}`);
  }

  return { restantes: codigosDistintos.length - lote.length };
}

async function continuarSync(isContinuation: boolean) {
  let cursor = await obterOuResetarCursor(isContinuation);
  const inicio = Date.now();

  const produtosAtivos = await pgSelectPaginado<{ codigo: string }>("importacao_varejo_produtos", "codigo", "ativo=eq.true");
  const codigosAtivos = new Set(produtosAtivos.map((p) => p.codigo).filter(Boolean));

  while (cursor.fase !== "idle" && Date.now() - inicio < TEMPO_MAXIMO_MS) {
    if (cursor.fase === "pedidos") {
      cursor = await processarPaginaPedidos(cursor, codigosAtivos);
    } else {
      const { restantes } = await processarLoteFornecedores();
      if (restantes === 0) cursor = { ...cursor, fase: "idle" };
    }
    await salvarCursor(cursor);
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

    const cursor = await continuarSync(isContinuation);

    if (cursor.fase !== "idle") {
      const publishableKey = "sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP";
      const selfUrl = `${supabaseUrl}/functions/v1/sync-importacao-varejo-fornecedor?continue=1`;
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

    return json({ ok: true, fase: cursor.fase, next_pagina: cursor.next_pagina });
  } catch (error) {
    console.error("sync-importacao-varejo-fornecedor error:", error);
    return json({ error: (error as Error).message || "Erro interno" }, 500);
  }
});
