/* ============================================================
   sync-importacao-varejo-nf-importacao — Edge Function (vpprd)
   Lê as NOTAS FISCAIS DE ENTRADA DE IMPORTAÇÃO do Omie (CFOP 3.xxx) e
   atualiza o "último fornecedor + último preço" da tela Importação Varejo.

   Por quê (16/10/2026, pedido do usuário): as importações da China não
   passam por Pedido de Compra nem por Recebimento de NF-e do fornecedor
   (só CT-e de frete). O lançamento de estoque de origem "IMP" aponta para
   uma NF-e de ENTRADA emitida pela própria VerticalParts, que traz tudo:
     produtos/nfconsultar · ListarNF · tpNF "0" (entrada)
       ide.dEmi / ide.nNF / ide.dCan
       nfDestInt.nCodCli / cRazao  → fornecedor estrangeiro
       det[].prod.cProd / qCom / vUnCom / CFOP  (CFOP "3.xxx" = importação)
   Conferido ao vivo: NF 00017018 (20/02/2025), CFOP 3.101, fornecedor
   HANGZHOU JIEPEI..., VPMP-591 10 un a R$ 125,05.

   2 fases com cursor (importacao_varejo_nf_cursor) + encadeamento via
   EdgeRuntime.waitUntil (mesmo padrão de sync-importacao-varejo-fornecedor):
     'nfs'     — pagina ListarNF e grava os ITENS com CFOP 3.* em
                 importacao_varejo_nf_import (histórico; upsert por nf_id+item).
                 Primeira carga desde 01/01/2024; depois só os últimos 60 dias.
     'derivar' — por produto ATIVO, pega a nota mais recente e atualiza
                 importacao_varejo_fornecedor (fonte 'nf_importacao'), sem
                 sobrescrever uma linha já mais nova (mesma regra da fase 'pi').

   ⚠️ SEM @supabase/supabase-js (BOOT_ERROR já visto neste projeto): fala com
   o PostgREST via fetch. Só LÊ do Omie. Protegida por x-cron-secret.
   ============================================================ */

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];
const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";

const TEMPO_MAXIMO_MS = 100_000;
const CICLO_ORFAO_MS = 60 * 60_000;
const NFS_POR_PAGINA = 50;
const DIAS_INCREMENTAL = 60;

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
  const res = await fetch(`${supabaseUrl}/rest/v1/${tabela}?${query}`, {
    headers: pgHeaders(range ? { Range: `${range[0]}-${range[1]}` } : undefined),
  });
  if (!res.ok) throw new Error(`select ${tabela}: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

async function pgSelectPaginado<T>(tabela: string, query: string): Promise<T[]> {
  const PAGINA = 1000;
  const linhas: T[] = [];
  let offset = 0;
  for (;;) {
    const data = await pgSelect<T>(tabela, query, [offset, offset + PAGINA - 1]);
    linhas.push(...data);
    if (data.length < PAGINA) break;
    offset += PAGINA;
  }
  return linhas;
}

async function pgUpsert(tabela: string, onConflict: string, linhas: Record<string, unknown>[]): Promise<void> {
  if (linhas.length === 0) return;
  const BATCH = 500;
  for (let i = 0; i < linhas.length; i += BATCH) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${tabela}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: pgHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
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

function dataBRParaISO(s: string | undefined): string | null {
  if (!s) return null;
  const [d, m, y] = s.split("/");
  if (!d || !m || !y) return null;
  return `${y}-${m}-${d}`;
}
function hojeBR(deslocamentoDias = 0): string {
  const d = new Date(Date.now() + deslocamentoDias * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

type NfItem = {
  nfProdInt?: { nCodItem?: number; nCodProd?: number };
  prod?: { cProd?: string; CFOP?: string; qCom?: number; vUnCom?: number; vTotItem?: number; vProd?: number };
};
type Nf = {
  compl?: { nIdNF?: number };
  det?: NfItem[];
  ide?: { dEmi?: string; nNF?: string; dCan?: string };
  nfDestInt?: { nCodCli?: number; cRazao?: string };
};
type ListarNfResp = { nTotalPaginas?: number; total_de_paginas?: number; nfCadastro?: Nf[] };

interface Cursor {
  fase: "nfs" | "derivar" | "idle";
  next_pagina: number;
  total_paginas: number | null;
  desde: string;
  started_at: string;
}

async function salvarCursor(c: Cursor) {
  await pgUpsert("importacao_varejo_nf_cursor", "id", [{ id: true, ...c }]);
}

async function obterOuResetarCursor(continuacao: boolean): Promise<Cursor> {
  const linhas = await pgSelect<Cursor>("importacao_varejo_nf_cursor", "select=*&id=eq.true");
  const existente = linhas[0] ?? null;
  const emAndamentoRecente = existente && existente.fase !== "idle" && Date.now() - new Date(existente.started_at).getTime() < CICLO_ORFAO_MS;
  if ((continuacao || emAndamentoRecente) && existente) return existente;

  // Primeira carga (tabela vazia) = desde 01/01/2024; depois, só os últimos 60 dias.
  const jaTem = await pgSelect<{ nf_id: number }>("importacao_varejo_nf_import", "select=nf_id&limit=1");
  const desde = jaTem.length === 0 ? "01/01/2024" : hojeBR(-DIAS_INCREMENTAL);
  const novo: Cursor = { fase: "nfs", next_pagina: 1, total_paginas: null, desde, started_at: new Date().toISOString() };
  await salvarCursor(novo);
  return novo;
}

async function processarPaginaNfs(cursor: Cursor): Promise<Cursor> {
  const resp = await omiePost<ListarNfResp>("produtos/nfconsultar", "ListarNF", {
    pagina: cursor.next_pagina,
    registros_por_pagina: NFS_POR_PAGINA,
    dEmiInicial: cursor.desde,
    dEmiFinal: hojeBR(),
    tpNF: "0",
  });

  const linhas: Record<string, unknown>[] = [];
  for (const nf of resp.nfCadastro || []) {
    if (nf.ide?.dCan) continue; // cancelada
    const nfId = nf.compl?.nIdNF;
    if (!nfId) continue;
    for (const item of nf.det || []) {
      const p = item.prod;
      if (!p?.cProd || !String(p.CFOP || "").startsWith("3.")) continue; // só importação
      const codItem = item.nfProdInt?.nCodItem;
      if (!codItem) continue;
      linhas.push({
        nf_id: nfId,
        cod_item: codItem,
        nf_numero: nf.ide?.nNF || null,
        data_emissao: dataBRParaISO(nf.ide?.dEmi),
        codigo: p.cProd.trim(),
        fornecedor_cod_omie: nf.nfDestInt?.nCodCli || null,
        fornecedor_nome: (nf.nfDestInt?.cRazao || "").trim() || null,
        qtd: p.qCom ?? null,
        preco_unitario: p.vUnCom ?? null,
        valor_item: p.vTotItem ?? p.vProd ?? null,
        cfop: p.CFOP || null,
        updated_at: new Date().toISOString(),
      });
    }
  }
  await pgUpsert("importacao_varejo_nf_import", "nf_id,cod_item", linhas);

  const total = resp.nTotalPaginas || resp.total_de_paginas || 1;
  const proxima = cursor.next_pagina + 1;
  return proxima > total
    ? { ...cursor, fase: "derivar", next_pagina: 1, total_paginas: null }
    : { ...cursor, next_pagina: proxima, total_paginas: total };
}

async function derivarFornecedor(): Promise<void> {
  const produtos = await pgSelectPaginado<{ codigo: string }>("importacao_varejo_produtos", "select=codigo&ativo=eq.true");
  const ativos = new Set(produtos.map((p) => p.codigo));
  const itens = await pgSelectPaginado<{
    codigo: string; data_emissao: string | null; nf_numero: string | null;
    fornecedor_cod_omie: number | null; fornecedor_nome: string | null; preco_unitario: number | null;
  }>(
    "importacao_varejo_nf_import",
    "select=codigo,data_emissao,nf_numero,fornecedor_cod_omie,fornecedor_nome,preco_unitario&order=data_emissao.desc.nullslast,nf_numero.desc",
  );

  const melhor = new Map<string, (typeof itens)[number]>();
  for (const it of itens) {
    if (!ativos.has(it.codigo) || !it.data_emissao || !it.fornecedor_nome) continue;
    if (!melhor.has(it.codigo)) melhor.set(it.codigo, it); // lista já vem da mais recente para a mais antiga
  }
  if (melhor.size === 0) return;

  const existentes = await pgSelectPaginado<{ codigo: string; data_pedido: string | null }>(
    "importacao_varejo_fornecedor",
    "select=codigo,data_pedido",
  );
  const dataExistente = new Map(existentes.map((e) => [e.codigo, e.data_pedido]));

  const linhas: Record<string, unknown>[] = [];
  for (const [codigo, it] of melhor) {
    const atual = dataExistente.get(codigo);
    if (atual && atual > (it.data_emissao as string)) continue; // já existe algo mais novo
    linhas.push({
      codigo,
      fornecedor_codigo_omie: it.fornecedor_cod_omie,
      fornecedor_nome: it.fornecedor_nome,
      fornecedor_cnpj: null,
      fornecedor_exterior: true, // CFOP 3.xxx = importação
      preco_unitario: it.preco_unitario ?? 0,
      numero_pedido: it.nf_numero,
      data_pedido: it.data_emissao,
      fonte: "nf_importacao",
      updated_at: new Date().toISOString(),
    });
  }
  await pgUpsert("importacao_varejo_fornecedor", "codigo", linhas);
}

async function continuarSync(isContinuation: boolean): Promise<Cursor> {
  let cursor = await obterOuResetarCursor(isContinuation);
  const inicio = Date.now();
  while (cursor.fase !== "idle" && Date.now() - inicio < TEMPO_MAXIMO_MS) {
    if (cursor.fase === "nfs") {
      cursor = await processarPaginaNfs(cursor);
    } else {
      await derivarFornecedor();
      cursor = { ...cursor, fase: "idle" };
    }
    await salvarCursor(cursor);
  }
  return cursor;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!omieKey || !omieSecret) return json({ error: "OMIE_API_KEY / OMIE_API_SECRET não configuradas" }, 500);

  // Só cron e o encadeamento da própria função chamam isto (nunca o navegador).
  const segredoRecebido = req.headers.get("x-cron-secret") || "";
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/segredo_valido`, {
      method: "POST",
      headers: pgHeaders(),
      body: JSON.stringify({ p_nome: "cron_secret", p_valor: segredoRecebido }),
    });
    if (!r.ok || (await r.json()) !== true) return json({ error: "Não autorizado" }, 401);
  } catch (e) {
    console.error("validação do segredo falhou", e);
    return json({ error: "Não autorizado" }, 401);
  }

  try {
    const isContinuation = new URL(req.url).searchParams.get("continue") === "1";
    const cursor = await continuarSync(isContinuation);

    if (cursor.fase !== "idle") {
      const publishableKey = "sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP";
      const chain = fetch(`${supabaseUrl}/functions/v1/sync-importacao-varejo-nf-importacao?continue=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, "x-cron-secret": segredoRecebido },
        body: "{}",
      }).catch((e) => console.error("chain error", e));
      // deno-lint-ignore no-explicit-any
      const runtime = globalThis as any;
      if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(chain);
      else await chain;
    }
    return json({ ok: true, fase: cursor.fase, next_pagina: cursor.next_pagina, total_paginas: cursor.total_paginas });
  } catch (error) {
    console.error("sync-importacao-varejo-nf-importacao error:", error);
    return json({ error: (error as Error).message || "Erro interno" }, 500);
  }
});
