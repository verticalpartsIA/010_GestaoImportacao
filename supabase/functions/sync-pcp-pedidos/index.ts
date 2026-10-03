/* ============================================================
   sync-pcp-pedidos — Edge Function (vpprd) · PCP, relatórios Pedidos e Clientes.

   SÓ LÊ do Omie (ListarPedidos de produtos/pedido e ConsultarCliente de geral/clientes) e grava
   em pcp_pedidos / pcp_pedido_itens. Nada é escrito no Omie.

   Guarda apenas os itens "do PCP": quadros de comando, corrimãos e cabos (aço / manobra),
   identificados pela família em pcp_produtos. Pedido sem nenhum desses itens é ignorado.

   Body JSON: { numeros?: string[] }  → busca esses números de pedido (um número pode ter mais de
                                          um registro no Omie, p.ex. pedido parcial);
              { dias?: number }        → busca pedidos incluídos nos últimos N dias (máx. 90).

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
async function pgInsert(tabela: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
    method: "POST", headers: pgH({ Prefer: "return=minimal" }), body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`insert ${tabela}: ${r.status} ${await r.text()}`);
}
async function pgDelete(tabela: string, qs: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, { method: "DELETE", headers: pgH({ Prefer: "return=minimal" }) });
  if (!r.ok) throw new Error(`delete ${tabela}: ${r.status} ${await r.text()}`);
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

const limpa = (s: unknown) => String(s ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
function dataIso(d: unknown): string | null {
  const m = String(d || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
function dataBr(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY || !OMIE_KEY || !OMIE_SECRET) return json({ error: "Credenciais não configuradas" }, 500);

  let numeros: string[] = [];
  let dias = 0;
  let etapa = "";
  let atualizarAbertos = false;
  try {
    const b = await req.json();
    if (Array.isArray(b?.numeros)) numeros = b.numeros.map((n: unknown) => String(n).replace(/\D/g, "")).filter(Boolean).slice(0, 30);
    if (b?.dias) dias = Math.min(90, Math.max(1, Number(b.dias) || 0));
    if (b?.etapa) etapa = String(b.etapa).replace(/\D/g, "").slice(0, 2);
    atualizarAbertos = !!b?.atualizar_abertos;
  } catch { /* sem body */ }
  if (!numeros.length && !dias && !etapa && !atualizarAbertos) return json({ error: "Informe numeros[], dias, etapa ou atualizar_abertos" }, 400);

  // Limite de taxa (chamada do navegador, sem credencial de usuário verificável).
  try {
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const taxa = await pgRpc("api_rate_check", { p_bucket: "sync-pcp-pedidos", p_ip: ip, p_max_ip: 20, p_max_global: 40, p_janela_s: 600 });
    if (taxa !== "ok") return json({ error: "Muitas consultas em pouco tempo. Aguarde alguns minutos." }, 429);
  } catch (e) {
    console.warn("[sync-pcp-pedidos] limite de taxa indisponível", e);
    return json({ error: "Consulta temporariamente indisponível (verificação de segurança)." }, 503);
  }

  const erros: string[] = [];
  const resumo: Record<string, unknown> = {};
  try {
    // Produtos "do PCP": quadros de comando, corrimãos e cabos (família).
    const prods = await pgSelect<{ codigo: string }>(
      "pcp_produtos",
      "select=codigo&ativo=eq.true&or=(familia.ilike.*QUADRO DE COMANDOS*,familia.ilike.*CORRIM*,familia.ilike.*CABOS*)");
    const meus = new Set(prods.map((p) => p.codigo));
    // Códigos antigos (pedidos antigos ainda usam VPB-xxx para os quadros) → código atual.
    const alias = await pgSelect<{ codigo_antigo: string; codigo_atual: string }>("pcp_codigo_alias", "select=codigo_antigo,codigo_atual");
    const atual = new Map(alias.map((a) => [a.codigo_antigo, a.codigo_atual]));
    const ehPcp = (c: string) => meus.has(c) || atual.has(c);
    const codAtual = (c: string) => atual.get(c) ?? c;

    // Atualizar abertos: relê no Omie os pedidos que já temos e ainda não foram entregues (para pegar NF emitida / mudança de etapa).
    if (atualizarAbertos) {
      const entregues = new Set((await pgSelect<{ pedido_codigo: number }>("pcp_expedicoes", "select=pedido_codigo&status=eq.entregue")).map((x) => Number(x.pedido_codigo)));
      const abertos = (await pgSelect<{ codigo_pedido: number; numero_pedido: string }>("pcp_pedidos", "select=codigo_pedido,numero_pedido&cancelado=eq.false&order=atualizado_em.asc&limit=60"))
        .filter((p) => !entregues.has(Number(p.codigo_pedido)));
      numeros = Array.from(new Set(abertos.map((p) => p.numero_pedido))).slice(0, 25);
      if (!numeros.length) return json({ ok: true, lidos: 0, gravados: 0, sem_item_do_pcp: 0, erros: [] });
    }

    // 1) Pedidos do Omie
    const pedidos: any[] = [];
    if (etapa && !numeros.length) {
      // Todos os pedidos numa etapa (ex.: 20 = "Separar Estoque / Produção"). O filtro de data do Omie é o da previsão: janela larga.
      let pagina = 1, total = 1;
      while (pagina <= total && pagina <= 8) {
        const r = await omie<any>("produtos/pedido", "ListarPedidos", {
          pagina, registros_por_pagina: 50, apenas_importado_api: "N", etapa,
          filtrar_por_data_de: "01/01/2025", filtrar_por_data_ate: "31/12/2027",
        });
        total = r.total_de_paginas || 1;
        pedidos.push(...(r.pedido_venda_produto || []));
        pagina++;
      }
      if (total > 8) resumo.aviso = `Só as 8 primeiras páginas de ${total} foram lidas.`;
    } else if (numeros.length) {
      for (const n of numeros) {
        try {
          const r = await omie<any>("produtos/pedido", "ListarPedidos", {
            pagina: 1, registros_por_pagina: 20, apenas_importado_api: "N",
            numero_pedido_de: Number(n), numero_pedido_ate: Number(n),
          });
          for (const p of r.pedido_venda_produto || []) if (String(p.cabecalho?.numero_pedido) === String(Number(n))) pedidos.push(p);
        } catch (e) { erros.push(`pedido ${n}: ${(e as Error).message}`); }
      }
    } else {
      const de = new Date(Date.now() - dias * 86400000);
      let pagina = 1, total = 1;
      while (pagina <= total && pagina <= 12) {
        const r = await omie<any>("produtos/pedido", "ListarPedidos", {
          pagina, registros_por_pagina: 50, apenas_importado_api: "N", filtrar_por_data_de: dataBr(de), filtrar_por_data_ate: dataBr(new Date()),
        });
        total = r.total_de_paginas || 1;
        pedidos.push(...(r.pedido_venda_produto || []));
        pagina++;
      }
      if (total > 12) resumo.aviso = `Só as 12 primeiras páginas de ${total} foram lidas; reduza o período.`;
    }
    resumo.lidos = pedidos.length;

    // Etapa 10 ("Pedido", antes de "Separar Estoque / Produção") é SÓ PREVISÃO: vai para pcp_previsao_pedidos/itens, tabelas
    // que nenhuma tela de produção, NF, expedição ou relatório lê (só a aba Necessidade). Assim ela nunca vira venda firme
    // por engano, não entra no SLA e não aparece na Emissão de NF/Expedição. Quando o pedido chega à etapa 20, o job da
    // etapa 20 o grava em pcp_pedidos (com entrada_em = agora) e a limpeza abaixo o tira da previsão.
    if (etapa === "10" && !numeros.length) {
      const completa = !resumo.aviso;
      const clientesPrev = new Map<number, any>();
      const vistos = new Set<number>();
      let guardados = 0;
      for (const p of pedidos) {
        const c = p.cabecalho || {}, ic = p.infoCadastro || {};
        const todos = (p.det || []).map((d: any, i: number) => ({ d: d.produto || {}, seq: i + 1 }));
        const itensPcp = todos.filter((x: any) => ehPcp(x.d.codigo));
        if (!itensPcp.length || ic.cancelado === "S" || ic.faturado === "S" || !(Number(c.codigo_pedido) > 0)) continue;
        let cli = clientesPrev.get(c.codigo_cliente);
        if (cli === undefined) {
          try { cli = await omie<any>("geral/clientes", "ConsultarCliente", { codigo_cliente_omie: c.codigo_cliente }); }
          catch (e) { cli = null; erros.push(`cliente ${c.codigo_cliente}: ${(e as Error).message}`); }
          clientesPrev.set(c.codigo_cliente, cli);
        }
        await pgUpsert("pcp_previsao_pedidos", [{
          codigo_pedido: c.codigo_pedido, numero_pedido: String(c.numero_pedido),
          cliente_nome: cli ? limpa(cli.razao_social) : null, cliente_fantasia: cli ? limpa(cli.nome_fantasia) : null,
          data_pedido: dataIso(ic.dInc), data_previsao: dataIso(c.data_previsao),
          valor_total: p.total_pedido?.valor_total_pedido ?? null, atualizado_em: new Date().toISOString(),
        }], "codigo_pedido");
        await pgDelete("pcp_previsao_itens", `codigo_pedido=eq.${c.codigo_pedido}`);
        await pgInsert("pcp_previsao_itens", itensPcp.map((x: any) => ({
          codigo_pedido: c.codigo_pedido, seq: x.seq, codigo: codAtual(x.d.codigo), descricao: limpa(x.d.descricao),
          unidade: x.d.unidade || null, quantidade: x.d.quantidade ?? 0,
        })));
        vistos.add(Number(c.codigo_pedido));
        guardados++;
      }
      // Limpeza: o que não veio mais na etapa 10 avançou de etapa ou foi cancelado/faturado. Só limpa com leitura COMPLETA e sem erro.
      if (completa && erros.length === 0) {
        const existentes = await pgSelect<{ codigo_pedido: number }>("pcp_previsao_pedidos", "select=codigo_pedido");
        const sobra = existentes.map((x) => Number(x.codigo_pedido)).filter((id) => !vistos.has(id));
        for (let i = 0; i < sobra.length; i += 100) await pgDelete("pcp_previsao_pedidos", `codigo_pedido=in.(${sobra.slice(i, i + 100).join(",")})`);
        resumo.removidos = sobra.length;
      }
      resumo.previsao = guardados;
      resumo.sem_item_do_pcp = pedidos.length - guardados;
      resumo.erros = erros;
      return json({ ok: erros.length === 0, ...resumo }, erros.length === 0 ? 200 : 207);
    }

    // 2) Mantém só pedidos com item do PCP; resolve cliente; grava.
    const clientes = new Map<number, any>();
    let gravados = 0, ignorados = 0;
    for (const p of pedidos) {
      const c = p.cabecalho || {};
      const todos = (p.det || []).map((d: any, i: number) => ({ d: d.produto || {}, seq: i + 1 }));
      const itens = todos.filter((x: any) => ehPcp(x.d.codigo));
      if (!itens.length) { ignorados++; continue; }       // só guardamos pedidos que têm item do PCP; nesses, o pedido inteiro (a Expedição envia tudo)
      const ic = p.infoCadastro || {}, fr = p.frete || {};

      let cli = clientes.get(c.codigo_cliente);
      if (cli === undefined) {
        try { cli = await omie<any>("geral/clientes", "ConsultarCliente", { codigo_cliente_omie: c.codigo_cliente }); }
        catch (e) { cli = null; erros.push(`cliente ${c.codigo_cliente}: ${(e as Error).message}`); }
        clientes.set(c.codigo_cliente, cli);
      }
      const end = cli ? [cli.endereco, cli.endereco_numero, cli.bairro, [cli.cidade, cli.estado].filter(Boolean).join("/"), cli.cep].filter(Boolean).join(", ") : null;
      const fone = cli && cli.telefone1_numero ? `${cli.telefone1_ddd ? "(" + cli.telefone1_ddd + ") " : ""}${cli.telefone1_numero}` : null;

      await pgUpsert("pcp_pedidos", [{
        codigo_pedido: c.codigo_pedido, numero_pedido: String(c.numero_pedido), etapa: c.etapa || null,
        codigo_cliente: c.codigo_cliente || null,
        cliente_nome: cli ? limpa(cli.razao_social) : null, cliente_fantasia: cli ? limpa(cli.nome_fantasia) : null,
        cliente_documento: cli ? cli.cnpj_cpf || null : null, cliente_endereco: end, cliente_telefone: fone,
        cliente_email: cli ? cli.email || null : null,
        data_pedido: dataIso(p.infoCadastro?.dInc), data_previsao: dataIso(c.data_previsao),
        valor_total: p.total_pedido?.valor_total_pedido ?? null,
        observacao: limpa(p.observacoes?.obs_venda) || null,
        faturado: ic.faturado === "S", data_faturamento: dataIso(ic.dFat), nf_autorizada: ic.autorizado === "S",
        cancelado: ic.cancelado === "S", volumes: fr.quantidade_volumes ?? null, peso_bruto: fr.peso_bruto ?? null,
        modalidade_frete: fr.modalidade != null ? String(fr.modalidade) : null, transportadora_codigo: fr.codigo_transportadora || null,
        atualizado_em: new Date().toISOString(),
      }], "codigo_pedido");
      await pgDelete("pcp_pedido_itens", `codigo_pedido=eq.${c.codigo_pedido}`);
      await pgInsert("pcp_pedido_itens", todos.map((x: any) => ({
        codigo_pedido: c.codigo_pedido, seq: x.seq, item_pcp: ehPcp(x.d.codigo),
        codigo: codAtual(x.d.codigo), codigo_original: atual.has(x.d.codigo) ? x.d.codigo : null, descricao: limpa(x.d.descricao), unidade: x.d.unidade || null,
        quantidade: x.d.quantidade ?? 0, valor_unitario: x.d.valor_unitario ?? 0,
        desconto: x.d.valor_desconto ?? 0, valor_total: x.d.valor_total ?? 0,
      })));
      gravados++;
    }
    resumo.gravados = gravados;
    resumo.sem_item_do_pcp = ignorados;
  } catch (e) {
    erros.push((e as Error).message);
  }
  resumo.erros = erros;
  return json({ ok: erros.length === 0, ...resumo }, erros.length === 0 ? 200 : 207);
});
