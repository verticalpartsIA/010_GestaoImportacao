/* ============================================================
   sync-pcp-omie — Edge Function (vpprd) · PCP, etapa 1: Omie → PCP.

   SÓ LÊ do Omie (ConsultarProduto, ListarPosEstoque, ConsultarEstrutura) e
   grava nas tabelas pcp_* (pcp_produtos, pcp_estoque, pcp_estrutura). Nada é
   escrito no Omie. A mão dupla (PCP → Omie) vem nas próximas etapas.

   Escopo (body JSON, tudo opcional): { escopo: 'tudo'|'cadastro'|'estoque'|'estrutura'|'familia' }.
   'familia' (corrimãos, 03/10/2026): { escopo:'familia', familia_id:<código da família no Omie>, simular?:true }.
   O passo 'estrutura' só consulta quem JÁ é "pai" em pcp_estrutura (semeado pelos quadros), então produto de outra
   família nunca tinha a estrutura buscada. 'familia' lê ListarEstruturas (todos os produtos com estrutura no Omie, poucas
   páginas), fica com os da família pedida (idFamilia) e, se não for simulação, grava no PCP pai + componentes +
   linhas de estrutura (origem 'omie'). Depois disso o produto passa a ser "pai" e o sync normal o mantém atualizado.
   ⚠ NUNCA varrer produto a produto com ConsultarEstrutura: "Produto não encontrado!" (= sem estrutura) conta como erro
   e ~10 seguidos bloqueiam a API do Omie por 30 min para TODAS as integrações.
   Em conflito, o Omie vale. Exceção: linha de estrutura com origem='pcp'
   (criada só no PCP, ainda não existe no Omie) nunca é apagada.

   Sem supabase-js (import remoto já derrubou produção em redeploy): fala com o
   PostgREST via fetch, como as outras funções de sync deste projeto.
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
async function pgDeleteIds(tabela: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += 100) {
    const lista = ids.slice(i, i + 100).join(",");
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=in.(${lista})`, { method: "DELETE", headers: pgH({ Prefer: "return=minimal" }) });
    if (!r.ok) throw new Error(`delete ${tabela}: ${r.status} ${await r.text()}`);
  }
}
async function pgRpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: pgH(), body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status}`);
  return await r.json();
}

/* ---------- Omie (só leitura) ---------- */
async function omie<T = any>(endpoint: string, call: string, param: Record<string, unknown>): Promise<T> {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const res = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call, app_key: OMIE_KEY, app_secret: OMIE_SECRET, param: [param] }),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    const fault: string = data?.faultstring || "";
    if (fault) {
      const m = fault.match(/Aguarde (\d+) segundos/i);
      if (/redundante/i.test(fault) && m && tentativa < 3) { await sleep((Number(m[1]) + 1) * 1000); continue; }
      throw new Error(fault);
    }
    if (!res.ok) throw new Error(`Omie HTTP ${res.status}`);
    return data as T;
  }
  throw new Error("Omie: tentativas esgotadas");
}

type Prod = { codigo: string; codigo_produto_omie: number | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY || !OMIE_KEY || !OMIE_SECRET) return json({ error: "Credenciais não configuradas" }, 500);

  let escopo = "tudo", familiaId = 0, simular = false;
  try {
    const b = await req.json();
    if (b?.escopo) escopo = String(b.escopo);
    familiaId = Number(b?.familia_id) || 0;
    simular = b?.simular === true;
  } catch { /* sem body */ }
  if (!["tudo", "cadastro", "estoque", "estrutura", "familia"].includes(escopo)) return json({ error: "escopo inválido" }, 400);
  if (escopo === "familia" && !(familiaId > 0)) return json({ error: "Informe familia_id (código numérico da família no Omie)." }, 400);

  // Limite de taxa (a chamada é do navegador, sem credencial de usuário verificável).
  try {
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const taxa = await pgRpc("api_rate_check", { p_bucket: "sync-pcp-omie", p_ip: ip, p_max_ip: 10, p_max_global: 20, p_janela_s: 600 });
    if (taxa !== "ok") return json({ error: "Muitas sincronizações em pouco tempo. Aguarde alguns minutos." }, 429);
  } catch (e) {
    console.warn("[sync-pcp-omie] limite de taxa indisponível", e);
    return json({ error: "Sincronização temporariamente indisponível (verificação de segurança)." }, 503);
  }

  const inicio = new Date().toISOString();
  const resumo: Record<string, unknown> = { escopo };
  const erros: string[] = [];
  let logId: string | null = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/pcp_sync_log`, {
      method: "POST", headers: pgH({ Prefer: "return=representation" }), body: JSON.stringify({ escopo, iniciado_em: inicio }),
    });
    if (r.ok) logId = ((await r.json()) as any[])[0]?.id ?? null;
  } catch { /* log é best-effort */ }

  try {
    let produtos = await pgSelectAll<Prod>("pcp_produtos", "select=codigo,codigo_produto_omie&ativo=eq.true");

    /* ---- 1) Cadastro ---- */
    if (escopo === "tudo" || escopo === "cadastro") {
      const linhas: Record<string, unknown>[] = [];
      let desativados = 0, naoEncontrados = 0;
      for (let i = 0; i < produtos.length; i += 4) {
        const lote = produtos.slice(i, i + 4);
        const resp = await Promise.allSettled(lote.map((p) => omie("geral/produtos", "ConsultarProduto", { codigo: p.codigo })));
        resp.forEach((r, k) => {
          const cod = lote[k].codigo;
          if (r.status === "rejected") { naoEncontrados++; erros.push(`cadastro ${cod}: ${(r.reason as Error).message}`); return; }
          const o = r.value;
          const inativo = o.inativo === "S";
          if (inativo) desativados++;
          linhas.push({
            codigo: cod,
            codigo_produto_omie: o.codigo_produto ?? null,
            codigo_integracao: o.codigo_produto_integracao || null,
            descricao: o.descricao,
            ncm: o.ncm || null,
            cest: o.recomendacoes_fiscais?.id_cest || o.cest || null,
            ean: o.ean || null,
            unidade: o.unidade || null,
            familia: o.descricao_familia || null,
            tipo_sped: o.tipoItem || null,
            origem_mercadoria: o.recomendacoes_fiscais?.origem_mercadoria ?? null,
            preco_venda: o.valor_unitario ?? null,
            peso_liquido_kg: o.peso_liq ?? null,
            peso_bruto_kg: o.peso_bruto ?? null,
            altura_cm: o.altura ?? null,
            largura_cm: o.largura ?? null,
            profundidade_cm: o.profundidade ?? null,
            marca: o.marca || null,
            modelo: o.modelo || null,
            leadtime_dias: o.lead_time ?? null,
            descricao_detalhada: o.descr_detalhada || null,
            observacao_interna: o.obs_internas || null,
            ativo: !inativo,
            atualizado_em: new Date().toISOString(),
          });
        });
      }
      await pgUpsert("pcp_produtos", linhas, "codigo");
      resumo.cadastro = { atualizados: linhas.length, desativados, nao_encontrados: naoEncontrados };
      produtos = await pgSelectAll<Prod>("pcp_produtos", "select=codigo,codigo_produto_omie&ativo=eq.true");
    }

    /* ---- 2) Estoque (total por produto, todos os locais) ---- */
    if (escopo === "tudo" || escopo === "estoque") {
      const meus = new Map(produtos.map((p) => [p.codigo, p]));
      const hoje = new Date();
      const dataPos = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
      const achados = new Map<string, any>();
      let pagina = 1, total = 1;
      while (pagina <= total && pagina <= 60) {
        const resp = await omie<{ nTotPaginas: number; produtos: any[] }>("estoque/consulta", "ListarPosEstoque", {
          nPagina: pagina, nRegPorPagina: 100, dDataPosicao: dataPos,
        });
        total = resp.nTotPaginas || 1;
        for (const it of resp.produtos || []) if (meus.has(it.cCodigo)) achados.set(it.cCodigo, it);
        pagina++;
      }
      const dataAjuste = new Date().toISOString().slice(0, 10);
      const estoqueRows: Record<string, unknown>[] = [];
      const prodRows: Record<string, unknown>[] = [];
      for (const [cod] of meus) {
        const it = achados.get(cod);
        estoqueRows.push({
          codigo: cod, local_estoque: "Omie (total)", quantidade: it?.fisico ?? 0,
          custo_unitario: it?.nCMC ?? null, data_ajuste: dataAjuste, atualizado_em: new Date().toISOString(),
        });
        if (it) prodRows.push({ codigo: cod, descricao: it.cDescricao || cod, estoque_minimo: it.estoque_minimo ?? 0, preco_custo: it.nCMC ?? null });
      }
      await pgUpsert("pcp_estoque", estoqueRows, "codigo,local_estoque");
      if (prodRows.length) await pgUpsert("pcp_produtos", prodRows, "codigo");
      resumo.estoque = { produtos: estoqueRows.length, com_posicao_no_omie: achados.size, sem_posicao_zerados: estoqueRows.length - achados.size };
    }

    /* ---- 3) Estrutura (BOM) dos produtos que já são "pai" no PCP ---- */
    if (escopo === "tudo" || escopo === "estrutura") {
      const pais = Array.from(new Set((await pgSelectAll<{ codigo_pai: string }>("pcp_estrutura", "select=codigo_pai")).map((l) => l.codigo_pai)));
      const idPorCodigo = new Map(produtos.map((p) => [p.codigo, p.codigo_produto_omie]));
      let linhasOmie = 0, removidas = 0, novosProdutos = 0;
      for (const pai of pais) {
        const id = idPorCodigo.get(pai);
        if (!id) { erros.push(`estrutura ${pai}: sem codigo_produto_omie`); continue; }
        let est: any;
        try { est = await omie("geral/malha", "ConsultarEstrutura", { idProduto: id }); }
        catch (e) { erros.push(`estrutura ${pai}: ${(e as Error).message}`); continue; }
        const itens: any[] = est.itens || [];
        // componentes que ainda não existem no cadastro do PCP
        const jaTem = new Set((await pgSelectAll<{ codigo: string }>("pcp_produtos", "select=codigo")).map((x) => x.codigo));
        const novos = itens.filter((it) => it.codProdMalha && !jaTem.has(it.codProdMalha)).map((it) => ({
          codigo: it.codProdMalha, codigo_produto_omie: it.idProdMalha ?? null, descricao: it.descrProdMalha || it.codProdMalha,
          unidade: it.unidProdMalha || null, familia: it.descrFamMalha || null, tipo_sped: it.tipoProdMalha || null, ativo: true,
        }));
        if (novos.length) { await pgUpsert("pcp_produtos", novos, "codigo"); novosProdutos += novos.length; }
        const linhas = itens.filter((it) => it.codProdMalha).map((it) => ({
          codigo_pai: pai, codigo_filho: it.codProdMalha, quantidade: it.quantProdMalha ?? 0,
          perda_pct: it.percPerdaProdMalha ?? null, origem: "omie",
        }));
        await pgUpsert("pcp_estrutura", linhas, "codigo_pai,codigo_filho");
        linhasOmie += linhas.length;
        // apaga só o que veio do Omie e saiu de lá; linha origem='pcp' fica.
        const noOmie = new Set(linhas.map((l) => l.codigo_filho));
        const atuais = await pgSelectAll<{ id: string; codigo_filho: string; origem: string }>(
          "pcp_estrutura", `select=id,codigo_filho,origem&codigo_pai=eq.${encodeURIComponent(pai)}`);
        const sobrando = atuais.filter((a) => a.origem === "omie" && !noOmie.has(a.codigo_filho)).map((a) => a.id);
        if (sobrando.length) { await pgDeleteIds("pcp_estrutura", sobrando); removidas += sobrando.length; }
      }
      resumo.estrutura = { pais: pais.length, linhas_omie: linhasOmie, removidas, componentes_novos: novosProdutos };
    }

    /* ---- 4) Família inteira: traz para o PCP o que tem estrutura no Omie (ex.: corrimãos) ---- */
    if (escopo === "familia") {
      // ListarEstruturas devolve TODOS os produtos que têm estrutura (com família e componentes) em poucas páginas.
      // NÃO consultar produto a produto com ConsultarEstrutura: cada "Produto não encontrado!" conta como erro e ~10
      // seguidos fazem o Omie BLOQUEAR a API inteira por 30 min ("consumo indevido") — aconteceu em 03/10/2026.
      const comEstrutura: { pai: any; itens: any[] }[] = [];
      let pagina = 1, total = 1, estruturasNoOmie = 0;
      while (pagina <= total && pagina <= 20) {
        const r = await omie<any>("geral/malha", "ListarEstruturas", { nPagina: pagina, nRegPorPagina: 100, cOrdenarPor: "CODIGO" });
        total = r.nTotPaginas || 1;
        for (const e of r.produtosEncontrados || []) {
          estruturasNoOmie++;
          const id = e.ident || {};
          if (Number(id.idFamilia) !== familiaId) continue;
          const itens: any[] = (e.itens || []).filter((it: any) => it.codProdMalha);
          if (!id.codProduto || !itens.length) continue;
          comEstrutura.push({
            pai: { codigo: id.codProduto, codigo_produto: id.idProduto, descricao: id.descrProduto, unidade: id.unidProduto, descricao_familia: id.descrFamilia, tipoItem: id.tipoProduto, ncm: null },
            itens,
          });
        }
        pagina++;
      }
      let paisNovos = 0, componentesNovos = 0, linhasGravadas = 0, removidas = 0;
      if (!simular && comEstrutura.length) {
        const jaTem = new Set((await pgSelectAll<{ codigo: string }>("pcp_produtos", "select=codigo")).map((x) => x.codigo));
        for (const { pai, itens } of comEstrutura) {
          if (!jaTem.has(pai.codigo)) {
            await pgUpsert("pcp_produtos", [{
              codigo: pai.codigo, codigo_produto_omie: pai.codigo_produto ?? null, descricao: pai.descricao || pai.codigo,
              unidade: pai.unidade || null, familia: pai.descricao_familia || null, tipo_sped: pai.tipoItem || null,
              ncm: pai.ncm || null, ativo: true,
            }], "codigo");
            jaTem.add(pai.codigo); paisNovos++;
          }
          const novos = itens.filter((it) => !jaTem.has(it.codProdMalha)).map((it) => ({
            codigo: it.codProdMalha, codigo_produto_omie: it.idProdMalha ?? null, descricao: it.descrProdMalha || it.codProdMalha,
            unidade: it.unidProdMalha || null, familia: it.descrFamMalha || null, tipo_sped: it.tipoProdMalha || null, ativo: true,
          }));
          if (novos.length) { await pgUpsert("pcp_produtos", novos, "codigo"); novos.forEach((n) => jaTem.add(n.codigo)); componentesNovos += novos.length; }
          const linhas = itens.map((it) => ({
            codigo_pai: pai.codigo, codigo_filho: it.codProdMalha, quantidade: it.quantProdMalha ?? 0,
            perda_pct: it.percPerdaProdMalha ?? null, origem: "omie",
          }));
          await pgUpsert("pcp_estrutura", linhas, "codigo_pai,codigo_filho");
          linhasGravadas += linhas.length;
          const noOmie = new Set(linhas.map((l) => l.codigo_filho));
          const atuais = await pgSelectAll<{ id: string; codigo_filho: string; origem: string }>(
            "pcp_estrutura", `select=id,codigo_filho,origem&codigo_pai=eq.${encodeURIComponent(pai.codigo)}`);
          const sobrando = atuais.filter((a) => a.origem === "omie" && !noOmie.has(a.codigo_filho)).map((a) => a.id);
          if (sobrando.length) { await pgDeleteIds("pcp_estrutura", sobrando); removidas += sobrando.length; }
        }
      }
      resumo.familia = {
        familia_id: familiaId, simulado: simular, estruturas_no_omie: estruturasNoOmie,
        com_estrutura: comEstrutura.length, pais_novos: paisNovos, componentes_novos: componentesNovos, linhas: linhasGravadas, removidas,
        detalhe: comEstrutura.map(({ pai, itens }) => ({
          codigo: pai.codigo, descricao: pai.descricao, tipo: pai.tipoItem, unidade: pai.unidade,
          itens: itens.map((it) => ({ codigo: it.codProdMalha, descricao: it.descrProdMalha, quantidade: it.quantProdMalha, unidade: it.unidProdMalha, perda_pct: it.percPerdaProdMalha })),
        })),
      };
    }
  } catch (e) {
    erros.push((e as Error).message);
  }

  resumo.erros = erros;
  const ok = erros.length === 0;
  if (logId) {
    await fetch(`${SUPABASE_URL}/rest/v1/pcp_sync_log?id=eq.${logId}`, {
      method: "PATCH", headers: pgH({ Prefer: "return=minimal" }),
      body: JSON.stringify({ finalizado_em: new Date().toISOString(), ok, resumo }),
    }).catch(() => {});
  }
  return json({ ok, ...resumo }, ok ? 200 : 207);
});
