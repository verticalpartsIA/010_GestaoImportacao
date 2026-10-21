/* ============================================================
   sync-pcp-os — Edge Function (vpprd) · PCP, Ordens de Serviço com quadro de comando.

   Regra do usuário (20/10/2026): clientes de licitação (Capex/Opex) compram quadro de
   comando via SERVIÇO (Ordem de Serviço do Omie), não via Pedido de Venda de produto —
   por isso o `sync-pcp-pedidos` (que só lê `produtos/pedido`) nunca os via. Esta função
   SÓ LÊ do Omie (`servicos/os` ListarOS, `geral/clientes` ConsultarCliente) e grava em
   pcp_pedidos / pcp_pedido_itens — exatamente as mesmas tabelas que a tela "Pedidos para
   Produzir" já lê — com `origem = 'ordem_servico'`. Nada é escrito no Omie. Nunca mexe em
   nenhuma linha com `origem = 'pedido_venda'` (a função sync-pcp-pedidos continua sendo a
   única dona dessas).

   Detecção do serviço de quadro: por `nCodServico` do item (ServicosPrestados[].nCodServico),
   contra o catálogo pequeno `pcp_servico_quadro` (migration 20261020160000) — nunca por texto
   livre de `cDescServ`, que vem com observações coladas e não é estável.

   ⚠️ Achado real (20/10/2026): o Omie devolve valores de OS em CENTAVOS (`nValorTotal`,
   `nValUnit` etc.) — diferente do Pedido de Venda, que vem em reais. Todo valor monetário
   aqui é dividido por 100 antes de gravar.

   Body JSON: { etapa?: string }  → padrão "20" (mesma etapa "liberado pra produção" que o
                                     Pedido de Venda usa; confirmado ao vivo em 20/10/2026 que
                                     a OS 1212 — já em produção manual — estava nessa etapa).

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
/* Omie grava valor de OS em centavos (nValorTotal/nValUnit) — achado real, 20/10/2026,
   confirmado batendo 9 × 88983 centavos = 800847 centavos = R$ 8.008,47 na OS 1212.
   Pedido de Venda (sync-pcp-pedidos) NÃO tem esse problema — vem direto em reais. */
const centavosParaReais = (v: unknown): number => Math.round((Number(v) || 0)) / 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY || !OMIE_KEY || !OMIE_SECRET) return json({ error: "Credenciais não configuradas" }, 500);

  let etapa = "20";
  let simular = false;
  try {
    const b = await req.json();
    if (b?.etapa) etapa = String(b.etapa).replace(/\D/g, "").slice(0, 2) || "20";
    simular = !!b?.simular;
  } catch { /* sem body: usa o padrão */ }

  // Limite de taxa (chamada do navegador, sem credencial de usuário verificável).
  try {
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const taxa = await pgRpc("api_rate_check", { p_bucket: "sync-pcp-os", p_ip: ip, p_max_ip: 20, p_max_global: 40, p_janela_s: 600 });
    if (taxa !== "ok") return json({ error: "Muitas consultas em pouco tempo. Aguarde alguns minutos." }, 429);
  } catch (e) {
    console.warn("[sync-pcp-os] limite de taxa indisponível", e);
    return json({ error: "Consulta temporariamente indisponível (verificação de segurança)." }, 503);
  }

  const erros: string[] = [];
  const resumo: Record<string, unknown> = {};
  try {
    // Catálogo pequeno: quais serviços do Omie são "quadro de comando" (nCodServico -> codigo VPSVC-xxx).
    const servicosQuadro = await pgSelect<{ n_cod_servico: number; codigo: string }>("pcp_servico_quadro", "select=n_cod_servico,codigo");
    const porNCodServico = new Map(servicosQuadro.map((s) => [Number(s.n_cod_servico), s.codigo]));
    if (!porNCodServico.size) return json({ error: "pcp_servico_quadro está vazia — nada a detectar." }, 500);

    // 1) Ordens de Serviço do Omie na etapa pedida, não canceladas e não faturadas ainda
    //    (filtrar_por_status: "N" = não faturada — documentação oficial confirmada ao vivo,
    //    20/10/2026). cExibirProdutos:"S" traz também os componentes já baixados (produtosUtilizados),
    //    quando existirem, pra servir de referência (não viram lista de materiais da OP: a
    //    quantidade de cada componente é do SERVIÇO INTEIRO, não dá pra dividir por quadro físico
    //    com segurança — fica só registrado na observação da OP-mãe).
    const osList: any[] = [];
    let pagina = 1, total = 1;
    while (pagina <= total && pagina <= 10) {
      const r = await omie<any>("servicos/os", "ListarOS", {
        pagina, registros_por_pagina: 50, filtrar_por_etapa: etapa, filtrar_por_status: "N", cExibirProdutos: "S",
      });
      total = r.total_de_paginas || 1;
      osList.push(...(r.osCadastro || []));
      pagina++;
    }
    if (total > 10) resumo.aviso = `Só as 10 primeiras páginas de ${total} foram lidas.`;
    resumo.lidas = osList.length;

    const clientes = new Map<number, any>();
    let gravadas = 0, simuladas: any[] = [];
    for (const os of osList) {
      const c = os.Cabecalho || {};
      const ic = os.InfoCadastro || {};
      const servicos: any[] = os.ServicosPrestados || [];
      const itensQuadro = servicos.filter((s) => porNCodServico.has(Number(s.nCodServico)));
      if (!itensQuadro.length) continue; // OS sem serviço de quadro: fora do escopo desta função
      if (ic.cancelado === "S" || ic.faturado === "S" || !(Number(c.codigo_pedido ?? c.nCodOS) > 0)) continue;

      if (simular) {
        simuladas.push({
          numero_os: c.cNumOS, codigo_os: c.nCodOS,
          itens_quadro: itensQuadro.map((s) => ({ codigo: porNCodServico.get(Number(s.nCodServico)), quantidade: Number(s.nQtde) || 1 })),
        });
        continue;
      }

      let cli = clientes.get(c.nCodCli);
      if (cli === undefined) {
        try { cli = await omie<any>("geral/clientes", "ConsultarCliente", { codigo_cliente_omie: c.nCodCli }); }
        catch (e) { cli = null; erros.push(`cliente ${c.nCodCli}: ${(e as Error).message}`); }
        clientes.set(c.nCodCli, cli);
      }

      const todosItens = servicos.map((s, i) => ({ s, seq: i + 1 }));
      const materiaisJaBaixados = (os.produtosUtilizados?.produtoUtilizado || []).length;
      const obsPartes = [
        limpa(os.Observacoes?.cObsOS) || null,
        materiaisJaBaixados ? `${materiaisJaBaixados} componente(s) já baixado(s) do estoque nesta OS (Remessa) — quantidade do serviço inteiro, não dividida por quadro.` : null,
      ].filter(Boolean);

      await pgUpsert("pcp_pedidos", [{
        codigo_pedido: c.nCodOS, numero_pedido: String(c.cNumOS), etapa: c.cEtapa || null, origem: "ordem_servico",
        codigo_cliente: c.nCodCli || null,
        cliente_nome: cli ? limpa(cli.razao_social) : null, cliente_fantasia: cli ? limpa(cli.nome_fantasia) : null,
        cliente_documento: cli ? cli.cnpj_cpf || null : null,
        cliente_endereco: cli ? [cli.endereco, cli.endereco_numero, cli.bairro, [cli.cidade, cli.estado].filter(Boolean).join("/"), cli.cep].filter(Boolean).join(", ") : null,
        cliente_telefone: cli && cli.telefone1_numero ? `${cli.telefone1_ddd ? "(" + cli.telefone1_ddd + ") " : ""}${cli.telefone1_numero}` : null,
        cliente_email: cli ? cli.email || null : null,
        data_pedido: dataIso(ic.dDtInc), data_previsao: dataIso(c.dDtPrevisao),
        valor_total: centavosParaReais(c.nValorTotal),
        observacao: obsPartes.join(" | ") || null,
        faturado: ic.cFaturada === "S", data_faturamento: null, nf_autorizada: false,
        cancelado: ic.cCancelada === "S",
        volumes: null, peso_bruto: null, modalidade_frete: null, transportadora_codigo: null, transportadora_nome: null,
        so_separacao: false, atualizado_em: new Date().toISOString(),
      }], "codigo_pedido");
      await pgDelete("pcp_pedido_itens", `codigo_pedido=eq.${c.nCodOS}`);
      await pgInsert("pcp_pedido_itens", todosItens.map(({ s, seq }) => {
        const codigoQuadro = porNCodServico.get(Number(s.nCodServico));
        return {
          codigo_pedido: c.nCodOS, seq, item_pcp: !!codigoQuadro,
          codigo: codigoQuadro || null, codigo_original: null, descricao: limpa(s.cDescServ).split("|")[0] || null, unidade: null,
          quantidade: s.nQtde ?? 0, valor_unitario: centavosParaReais(s.nValUnit),
          desconto: centavosParaReais(s.nValorDesconto), valor_total: centavosParaReais((Number(s.nValUnit) || 0) * (Number(s.nQtde) || 0)),
        };
      }));
      gravadas++;
    }
    resumo.simulado = simular;
    if (simular) resumo.encontradas = simuladas;
    resumo.gravadas = gravadas;
  } catch (e) {
    erros.push((e as Error).message);
  }
  resumo.erros = erros;
  return json({ ok: erros.length === 0, ...resumo }, erros.length === 0 ? 200 : 207);
});
