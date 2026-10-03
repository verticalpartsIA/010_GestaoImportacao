/* ============================================================
   pcp-omie-escrever — Edge Function (vpprd) · PCP, etapa 2: PCP → Omie.

   ⚠️ ESCRITA REAL no Omie. Só roda quando o Almoxarife confirma na tela do
   Almoxarifado. Duas ações:
     - requisicao_compra : produtos/requisicaocompra IncluirReq. Uma requisição por
       categoria contábil, escolhida pela origem do produto no cadastro:
       origem 0 (nacional) → 2.01.90 Matéria Prima Nacional;
       origem 1 (importado) → 2.01.99 Matéria Prima Importada.
     - ajuste_estoque    : estoque/ajuste IncluirAjusteEstoque no local VERTICAL MP
       (2723544541). Tipos: ENT (entrada), SAI (saída), SLD (acertar saldo).

   Toda ação é gravada em pcp_omie_fila ANTES de chamar o Omie ('pendente') e termina
   'enviado' ou 'erro' (com o retorno do Omie). A chave (codIntReqCompra /
   cod_int_ajuste) vai pro Omie: ele recusa a repetição da mesma chave.
   `simular: true` devolve o que seria enviado, sem gravar nada em lugar nenhum.
   `acao: 'reenviar', id` repete uma ação que terminou em erro, com a mesma chave.

   Sem supabase-js (import remoto já derrubou produção em redeploy).
   ============================================================ */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"] as string; } catch { return ""; }
})() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OMIE_KEY = Deno.env.get("OMIE_API_KEY") || "";
const OMIE_SECRET = Deno.env.get("OMIE_API_SECRET") || "";

const LOCAL_ESTOQUE_VERTICAL_MP = 2723544541;
const CATEGORIA_NACIONAL = "2.01.90";
const CATEGORIA_IMPORTADA = "2.01.99";
const MOTIVOS: Record<string, string[]> = { ENT: ["INV", "INI"], SAI: ["INV", "PER"], SLD: ["INV", "INI"] };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hoje = () => {
  const d = new Date(Date.now() - 3 * 3600 * 1000); // Brasília
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};
const chaveNova = () => "PCP-" + crypto.randomUUID().replace(/-/g, "").slice(0, 14);

const pgH = (extra: Record<string, string> = {}) => ({
  apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra,
});
async function pg(method: string, path: string, body?: unknown, prefer = "return=representation") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers: pgH({ Prefer: prefer }), body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${path.split("?")[0]}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function pgRpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: pgH(), body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status}`);
  return await r.json();
}

async function omie(endpoint: string, call: string, param: Record<string, unknown>): Promise<any> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const res = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      // Acentos como \uXXXX: o Omie estava gravando "—" e "í" quebrados ("sa¿¿¿da") quando o corpo ia em UTF-8 cru.
      body: JSON.stringify({ call, app_key: OMIE_KEY, app_secret: OMIE_SECRET, param: [param] })
        .replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    const fault: string = data?.faultstring || "";
    if (fault) {
      // "Consumo redundante" = o Omie RECUSOU a chamada (nada foi gravado): seguro tentar de novo.
      const m = fault.match(/Aguarde (\d+) segundos/i);
      if (/redundante/i.test(fault) && m && tentativa < 2) { await sleep((Number(m[1]) + 1) * 1000); continue; }
      throw new Error(fault);
    }
    if (!res.ok) throw new Error(`Omie HTTP ${res.status}`);
    return data;
  }
  throw new Error("Omie: tentativas esgotadas");
}

type Prod = { codigo: string; codigo_produto_omie: number | null; descricao: string; origem_mercadoria: string | null; preco_custo: number | null; unidade: string | null };

/* Executa uma linha da fila: chama o Omie e grava o resultado. */
async function executar(fila: { id: string; payload: any; tipo: string }) {
  const { endpoint, call, param, meta } = fila.payload;
  try {
    const resp = await omie(endpoint, call, param);
    await pg("PATCH", `pcp_omie_fila?id=eq.${fila.id}`, { status: "enviado", resposta: resp, erro: null, enviado_em: new Date().toISOString() }, "return=minimal");
    if (fila.tipo === "ajuste_estoque" && meta?.codigo) await ajustarSaldoLocal(meta.codigo, meta.tipo, Number(meta.quantidade), Number(meta.valor) || null);
    return { ok: true, resposta: resp };
  } catch (e) {
    const msg = (e as Error).message;
    await pg("PATCH", `pcp_omie_fila?id=eq.${fila.id}`, { status: "erro", erro: msg }, "return=minimal").catch(() => {});
    return { ok: false, erro: msg };
  }
}

/* Reflete o ajuste no saldo local na hora; o próximo sync (cron) confirma com o Omie. */
async function ajustarSaldoLocal(codigo: string, tipo: string, quantidade: number, custo: number | null) {
  try {
    const atual = await pg("GET", `pcp_estoque?select=quantidade&codigo=eq.${encodeURIComponent(codigo)}&local_estoque=eq.Omie%20(total)`);
    const q0 = Number(atual?.[0]?.quantidade ?? 0);
    const q1 = tipo === "ENT" ? q0 + quantidade : tipo === "SAI" ? q0 - quantidade : quantidade;
    await pg("POST", "pcp_estoque?on_conflict=codigo,local_estoque", [{
      codigo, local_estoque: "Omie (total)", quantidade: q1, custo_unitario: custo,
      data_ajuste: new Date().toISOString().slice(0, 10), atualizado_em: new Date().toISOString(),
    }], "resolution=merge-duplicates,return=minimal");
  } catch (e) { console.warn("[pcp-omie-escrever] saldo local não atualizado", e); }
}

async function carregarProdutos(codigos: string[]): Promise<Map<string, Prod>> {
  const lista = codigos.map((c) => `"${c.replace(/"/g, "")}"`).join(",");
  const rows: Prod[] = await pg("GET", `pcp_produtos?select=codigo,codigo_produto_omie,descricao,origem_mercadoria,preco_custo,unidade&ativo=eq.true&codigo=in.(${encodeURIComponent(lista)})`);
  return new Map(rows.map((r) => [r.codigo, r]));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY || !OMIE_KEY || !OMIE_SECRET) return json({ error: "Credenciais não configuradas" }, 500);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const acao = String(b?.acao || "");
  const simular = b?.simular === true;
  const solicitante = String(b?.solicitante || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(solicitante)) return json({ error: "Identificação do solicitante ausente." }, 400);

  // Limite de taxa — a chamada vem do navegador, sem credencial de usuário verificável. Falha = bloqueia.
  if (!simular) {
    try {
      const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
      const taxa = await pgRpc("api_rate_check", { p_bucket: "pcp-omie-escrever", p_ip: ip, p_max_ip: 30, p_max_global: 60, p_janela_s: 600 });
      if (taxa !== "ok") return json({ error: "Muitos envios em pouco tempo. Aguarde alguns minutos." }, 429);
    } catch (e) {
      console.warn("[pcp-omie-escrever] limite de taxa indisponível", e);
      return json({ error: "Envio temporariamente indisponível (verificação de segurança)." }, 503);
    }
  }

  try {
    /* ---------- reenviar ---------- */
    if (acao === "reenviar") {
      const id = String(b?.id || "");
      const rows = await pg("GET", `pcp_omie_fila?select=id,tipo,status,payload&id=eq.${encodeURIComponent(id)}`);
      const fila = rows?.[0];
      if (!fila) return json({ error: "Item da fila não encontrado." }, 404);
      if (fila.status !== "erro") return json({ error: "Só dá para reenviar o que terminou em erro." }, 409);
      const r = await executar(fila);
      return json(r, r.ok ? 200 : 502);
    }

    /* ---------- requisição de compra ---------- */
    if (acao === "requisicao_compra") {
      const itens: { codigo: string; quantidade: number; obs?: string }[] = Array.isArray(b?.itens) ? b.itens : [];
      if (itens.length === 0) return json({ error: "Informe ao menos 1 item." }, 400);
      if (itens.length > 100) return json({ error: "Máximo de 100 itens por requisição." }, 400);
      const prods = await carregarProdutos(itens.map((i) => String(i.codigo)));
      const erros: { codigo: string; motivo: string }[] = [];
      const grupos = new Map<string, any[]>();
      for (const it of itens) {
        const p = prods.get(String(it.codigo));
        const q = Number(it.quantidade);
        if (!p) { erros.push({ codigo: it.codigo, motivo: "Produto não encontrado (ou inativo) no PCP." }); continue; }
        if (!p.codigo_produto_omie) { erros.push({ codigo: it.codigo, motivo: "Produto sem código do Omie — sincronize antes." }); continue; }
        if (!(q > 0) || q > 1_000_000) { erros.push({ codigo: it.codigo, motivo: "Quantidade inválida." }); continue; }
        const categ = p.origem_mercadoria === "1" ? CATEGORIA_IMPORTADA : CATEGORIA_NACIONAL;
        const obs = [p.descricao, it.obs ? String(it.obs).slice(0, 200) : ""].filter(Boolean).join(" — ");
        (grupos.get(categ) || grupos.set(categ, []).get(categ)!).push({ codProd: p.codigo_produto_omie, qtde: q, precoUnit: Number(p.preco_custo) > 0 ? Number(p.preco_custo) : 0, obsItem: obs, _codigo: p.codigo });
      }
      if (grupos.size === 0) return json({ error: "Nenhum item válido.", erros }, 400);

      const planos = Array.from(grupos.entries()).map(([categ, lista]) => {
        const chave = chaveNova();
        return {
          chave, categ,
          payload: {
            endpoint: "produtos/requisicaocompra", call: "IncluirReq",
            param: {
              codCateg: categ, codIntReqCompra: chave, dtSugestao: hoje(),
              obsIntReqCompra: `Requisição do PCP/Almoxarifado — ${solicitante}`,
              ItensReqCompra: lista.map(({ _codigo, ...resto }) => resto),
            },
            meta: { itens: lista.map((l) => ({ codigo: l._codigo, quantidade: l.qtde })) },
          },
        };
      });
      if (simular) return json({ simulado: true, requisicoes: planos.map((p) => ({ categoria: p.categ, ...p.payload.param })), erros });

      const resultados: any[] = [];
      for (const pl of planos) {
        const [fila] = await pg("POST", "pcp_omie_fila", [{ tipo: "requisicao_compra", chave: pl.chave, solicitante_email: solicitante, payload: pl.payload }]);
        const r = await executar({ id: fila.id, payload: pl.payload, tipo: "requisicao_compra" });
        resultados.push({ categoria: pl.categ, fila_id: fila.id, ...r });
      }
      const ok = resultados.every((r) => r.ok);
      return json({ ok, resultados, erros }, ok ? 200 : 207);
    }

    /* ---------- ajuste de estoque ---------- */
    if (acao === "ajuste_estoque") {
      const codigo = String(b?.codigo || "");
      const tipo = String(b?.tipo || "");
      const motivo = String(b?.motivo || "");
      const quantidade = Number(b?.quantidade);
      if (!MOTIVOS[tipo]) return json({ error: "Tipo inválido (ENT, SAI ou SLD)." }, 400);
      if (!MOTIVOS[tipo].includes(motivo)) return json({ error: `Motivo inválido para ${tipo} (${MOTIVOS[tipo].join(", ")}).` }, 400);
      if (!Number.isFinite(quantidade) || quantidade > 10_000_000 || (tipo === "SLD" ? quantidade < 0 : quantidade <= 0)) return json({ error: "Quantidade inválida." }, 400);
      const p = (await carregarProdutos([codigo])).get(codigo);
      if (!p) return json({ error: "Produto não encontrado (ou inativo) no PCP." }, 404);
      if (!p.codigo_produto_omie) return json({ error: "Produto sem código do Omie — sincronize antes." }, 400);
      // O Omie exige "valor" ≠ 0 em todo ajuste: usa o informado; senão o custo cadastrado (CMC).
      const valor = Number(b?.valor) > 0 ? Number(b.valor) : (Number(p.preco_custo) > 0 ? Number(p.preco_custo) : 0);
      if (!(valor > 0)) return json({ error: "Informe o valor unitário (R$): o produto não tem custo cadastrado e o Omie exige um valor." }, 400);
      const chave = chaveNova();
      const payload = {
        endpoint: "estoque/ajuste", call: "IncluirAjusteEstoque",
        param: {
          codigo_local_estoque: LOCAL_ESTOQUE_VERTICAL_MP, id_prod: p.codigo_produto_omie, cod_int_ajuste: chave,
          data: hoje(), tipo, quan: String(quantidade), valor, origem: "AJU", motivo,
          obs: `PCP/Almoxarifado — ${solicitante}${b?.obs ? " — " + String(b.obs).slice(0, 300) : ""}`,
        },
        meta: { codigo, tipo, quantidade, valor },
      };
      if (simular) return json({ simulado: true, ajuste: payload.param });
      const [fila] = await pg("POST", "pcp_omie_fila", [{ tipo: "ajuste_estoque", chave, solicitante_email: solicitante, payload }]);
      const r = await executar({ id: fila.id, payload, tipo: "ajuste_estoque" });
      return json({ fila_id: fila.id, ...r }, r.ok ? 200 : 502);
    }

    /* ---------- etapa 3: estrutura (BOM) — geral/malha ---------- */
    if (acao === "estrutura_incluir" || acao === "estrutura_alterar" || acao === "estrutura_excluir") {
      const paiC = String(b?.pai || ""), filC = String(b?.filho || "");
      const prods = await carregarProdutos([paiC, filC]);
      const pai = prods.get(paiC), fil = prods.get(filC);
      if (!pai || !fil) return json({ error: "Produto pai ou componente não encontrado (ou inativo) no PCP." }, 404);
      if (!pai.codigo_produto_omie || !fil.codigo_produto_omie) return json({ error: "Produto sem código do Omie — sincronize antes." }, 400);
      const q = Number(b?.quantidade);
      if (acao !== "estrutura_excluir" && (!(q > 0) || q > 1_000_000)) return json({ error: "Quantidade inválida." }, 400);

      let payload: any;
      const meta = { acao, pai: paiC, filho: filC, quantidade: q };
      if (acao === "estrutura_incluir") {
        payload = {
          endpoint: "geral/malha", call: "IncluirEstrutura", meta,
          param: { idProduto: pai.codigo_produto_omie, itemMalhaIncluir: [{
            intMalha: chaveNova(), idProdMalha: fil.codigo_produto_omie, quantProdMalha: q,
            percPerdaProdMalha: Number(b?.perda_pct) > 0 ? Number(b.perda_pct) : 0, obsProdMalha: String(b?.obs || "").slice(0, 200),
          }] },
        };
      } else {
        // idMalha vem do Omie na hora (a linha pode ter sido criada lá depois do último sync).
        const est = await omie("geral/malha", "ConsultarEstrutura", { idProduto: pai.codigo_produto_omie });
        const item = (est.itens || []).find((i: any) => i.codProdMalha === filC);
        if (!item) return json({ error: "Esse componente não está na estrutura do Omie (use incluir)." }, 404);
        payload = acao === "estrutura_alterar" ? {
          endpoint: "geral/malha", call: "AlterarEstrutura", meta,
          param: { idProduto: pai.codigo_produto_omie, itemMalhaAlterar: [{
            idMalha: item.idMalha, idProdMalha: fil.codigo_produto_omie, quantProdMalha: q,
            percPerdaProdMalha: item.percPerdaProdMalha || 0, obsProdMalha: item.obsProdMalha || "",
          }] },
        } : {
          endpoint: "geral/malha", call: "ExcluirEstrutura", meta,
          param: { idProduto: pai.codigo_produto_omie, idMalha: item.idMalha },
        };
      }
      if (simular) return json({ simulado: true, omie: { endpoint: payload.endpoint, call: payload.call, param: payload.param } });
      const chave = chaveNova();
      const [fila] = await pg("POST", "pcp_omie_fila", [{ tipo: "estrutura", chave, solicitante_email: solicitante, payload }]);
      const r = await executar({ id: fila.id, payload, tipo: "estrutura" });
      if (r.ok) {
        if (acao === "estrutura_excluir") {
          await pg("DELETE", `pcp_estrutura?codigo_pai=eq.${encodeURIComponent(paiC)}&codigo_filho=eq.${encodeURIComponent(filC)}`, undefined, "return=minimal");
        } else {
          await pg("POST", "pcp_estrutura?on_conflict=codigo_pai,codigo_filho", [{ codigo_pai: paiC, codigo_filho: filC, quantidade: q, origem: "omie" }], "resolution=merge-duplicates,return=minimal");
        }
      }
      return json({ fila_id: fila.id, ...r }, r.ok ? 200 : 502);
    }

    /* ---------- etapa 3: cadastro do produto (descrição, observação interna, estoque mínimo) ---------- */
    if (acao === "produto_editar") {
      const codigo = String(b?.codigo || "");
      const p = (await carregarProdutos([codigo])).get(codigo);
      if (!p) return json({ error: "Produto não encontrado (ou inativo) no PCP." }, 404);
      if (!p.codigo_produto_omie) return json({ error: "Produto sem código do Omie — sincronize antes." }, 400);
      const full: any = (await pg("GET", `pcp_produtos?select=descricao,unidade,ncm,observacao_interna,estoque_minimo&codigo=eq.${encodeURIComponent(codigo)}`))?.[0] || {};
      const novaDescricao = typeof b?.descricao === "string" ? b.descricao.trim() : undefined;
      const novaObs = typeof b?.observacao_interna === "string" ? b.observacao_interna.trim() : undefined;
      const novoMin = b?.estoque_minimo === undefined || b?.estoque_minimo === null || b?.estoque_minimo === "" ? undefined : Number(b.estoque_minimo);
      if (novaDescricao !== undefined && (novaDescricao.length < 3 || novaDescricao.length > 120)) return json({ error: "Descrição deve ter de 3 a 120 caracteres." }, 400);
      if (novaObs !== undefined && novaObs.length > 2000) return json({ error: "Observação interna muito longa (máx. 2000)." }, 400);
      if (novoMin !== undefined && (!Number.isFinite(novoMin) || novoMin < 0 || novoMin > 10_000_000)) return json({ error: "Estoque mínimo inválido." }, 400);
      const mudaCadastro = (novaDescricao !== undefined && novaDescricao !== full.descricao) || (novaObs !== undefined && novaObs !== (full.observacao_interna || ""));
      const mudaMin = novoMin !== undefined && novoMin !== Number(full.estoque_minimo ?? 0);
      if (!mudaCadastro && !mudaMin) return json({ error: "Nada mudou." }, 400);

      const ops: any[] = [];
      if (mudaCadastro) {
        const param: Record<string, unknown> = { codigo, descricao: novaDescricao ?? full.descricao, unidade: full.unidade, ncm: full.ncm };
        if (novaObs !== undefined) param.obs_internas = novaObs;
        ops.push({ tipo: "cadastro_produto", payload: { endpoint: "geral/produtos", call: "AlterarProduto", param, meta: { codigo } } });
      }
      if (mudaMin) {
        ops.push({ tipo: "estoque_minimo", payload: { endpoint: "estoque/ajuste", call: "AlterarEstoqueMinimo", param: { codigo_local_estoque: LOCAL_ESTOQUE_VERTICAL_MP, id_prod: p.codigo_produto_omie, quan_min: novoMin }, meta: { codigo } } });
      }
      if (simular) return json({ simulado: true, operacoes: ops.map((o) => ({ call: o.payload.call, param: o.payload.param })) });

      const resultados: any[] = [];
      for (const op of ops) {
        const chave = chaveNova();
        const [fila] = await pg("POST", "pcp_omie_fila", [{ tipo: op.tipo, chave, solicitante_email: solicitante, payload: op.payload }]);
        const r = await executar({ id: fila.id, payload: op.payload, tipo: op.tipo });
        resultados.push({ tipo: op.tipo, fila_id: fila.id, ...r });
      }
      const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
      const okCad = resultados.find((r) => r.tipo === "cadastro_produto")?.ok;
      const okMin = resultados.find((r) => r.tipo === "estoque_minimo")?.ok;
      if (okCad) { if (novaDescricao !== undefined) patch.descricao = novaDescricao; if (novaObs !== undefined) patch.observacao_interna = novaObs; }
      if (okMin) patch.estoque_minimo = novoMin;
      await pg("PATCH", `pcp_produtos?codigo=eq.${encodeURIComponent(codigo)}`, patch, "return=minimal");
      const ok = resultados.every((r) => r.ok);
      return json({ ok, resultados }, ok ? 200 : 207);
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error("[pcp-omie-escrever]", e);
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
