/* ============================================================
   pcp-hh — Edge Function (vpprd) · PCP, mão de obra (hora-homem) nas OPs.

   O operador com a alçada pcp.apontar_hh escolhe QUEM trabalhou e QUANTAS HORAS; esta função busca o valor
   da hora no Omie (Contas a Pagar da pessoa) e grava o custo. O valor da hora e o custo ficam em tabelas que o
   navegador não lê (RLS sem policy): só quem tem a alçada pcp.ver_hh recebe esses números, e apenas pela ação 'custos'.

   Regra do valor da hora (parâmetros em pcp_hh_config, editáveis sem redeploy):
     base mensal  = soma dos títulos da pessoa no Omie nas categorias configuradas (padrão 2.03.78 e 2.03.87),
                    pela data de emissão, no último mês fechado que tiver lançamento (até 'meses_busca' meses para trás)
     valor da hora = base mensal × fator_encargos ÷ horas_uteis_mes
   A pessoa é localizada no Omie pelo nome (ou pelo CPF informado) e o vínculo fica salvo em pcp_hh_vinculo.

   LIMITE HONESTO: o app não tem login verificável por função (usa a chave pública); 'solicitante_email' é
   declarado pelo navegador. O que é garantido: o valor só sai desta função para quem tem a alçada no cadastro,
   e nunca é gravado em tabela legível pelo navegador. Isolamento total depende da issue #571.

   Só LÊ do Omie (ListarClientes, ListarContasPagar). Sem supabase-js (PostgREST via fetch).
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
const enc = encodeURIComponent;

const pgH = (extra: Record<string, string> = {}) => ({
  apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra,
});
async function pgSelect<T>(tabela: string, qs: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, { headers: pgH({ Range: "0-4999" }) });
  if (!r.ok) throw new Error(`select ${tabela}: ${r.status}`);
  return (await r.json()) as T[];
}
async function pgInsert<T>(tabela: string, row: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}`, { method: "POST", headers: pgH({ Prefer: "return=representation" }), body: JSON.stringify(row) });
  if (!r.ok) throw new Error(`insert ${tabela}: ${r.status} ${await r.text()}`);
  return ((await r.json()) as T[])[0];
}
async function pgUpsert(tabela: string, row: Record<string, unknown> | Record<string, unknown>[], onConflict: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?on_conflict=${onConflict}`, {
    method: "POST", headers: pgH({ Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`upsert ${tabela}: ${r.status} ${await r.text()}`);
}
async function pgPatch(tabela: string, qs: string, row: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, { method: "PATCH", headers: pgH({ Prefer: "return=minimal" }), body: JSON.stringify(row) });
  if (!r.ok) throw new Error(`patch ${tabela}: ${r.status} ${await r.text()}`);
}
async function pgDelete(tabela: string, qs: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, { method: "DELETE", headers: pgH({ Prefer: "return=minimal" }) });
  if (!r.ok) throw new Error(`delete ${tabela}: ${r.status}`);
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

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const dataBr = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/* ---------- Alçadas (mesma tabela do app: alcadas_capacidade; Administrador sempre passa) ---------- */
async function perfilPorEmail(email: string) {
  const r = await pgSelect<{ id: string; nome: string; nivel: string; departamento: string | null; email: string; ativo: boolean }>(
    "perfis", `select=id,nome,nivel,departamento,email,ativo&email=ilike.${enc(email)}&limit=1`);
  return r[0] || null;
}
async function temAlcada(email: string, capacidade: string): Promise<boolean> {
  if (!email) return false;
  const p = await perfilPorEmail(email);
  if (!p || !p.ativo) return false;
  if (p.nivel === "Administrador") return true;
  const r = await pgSelect<{ id: string }>("alcadas_capacidade", `select=id&perfil_id=eq.${p.id}&modulo=eq.pcp&capacidade=eq.${capacidade}&limit=1`);
  return r.length > 0;
}

/* ---------- Configuração ---------- */
async function config() {
  const rows = await pgSelect<{ chave: string; valor: string }>("pcp_hh_config", "select=chave,valor");
  const m: Record<string, string> = {}; rows.forEach((r) => { m[r.chave] = r.valor; });
  return {
    horasUteis: Number(m.horas_uteis_mes) > 0 ? Number(m.horas_uteis_mes) : 176,
    fator: Number(m.fator_encargos) > 0 ? Number(m.fator_encargos) : 1,
    categorias: (m.categorias || "2.03.78,2.03.87").split(",").map((s) => s.trim()).filter(Boolean),
    mesesBusca: Math.min(12, Math.max(1, Number(m.meses_busca) || 3)),
    validadeDias: Math.max(0, Number(m.validade_dias) || 15),
  };
}

/* ---------- Folha no Omie: quem recebe nas categorias de salário (só nomes, sem valores) ---------- */
type Candidato = { codigo: number; nome: string };
async function folhaCache(): Promise<Candidato[]> {
  const r = await pgSelect<{ omie_codigo: number; nome: string }>("pcp_hh_folha", "select=omie_codigo,nome&order=nome");
  return r.map((x) => ({ codigo: Number(x.omie_codigo), nome: x.nome }));
}
// Varre o Contas a Pagar dos últimos meses pegando os favorecidos das categorias de salário e busca o nome de cada um.
async function carregarFolha(): Promise<{ total: number; completo: boolean }> {
  const cfg = await config();
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const codigos = new Set<number>();
  const t0 = Date.now();
  let completo = true, pagina = 1, total = 1;
  while (pagina <= total) {
    if (pagina > 40 || Date.now() - t0 > 70000) { completo = false; break; }
    const r = await omie<any>("financas/contapagar", "ListarContasPagar", {
      pagina, registros_por_pagina: 100, apenas_importado_api: "N", filtrar_por_data_de: dataBr(ini), filtrar_por_data_ate: dataBr(fim),
    });
    total = r.total_de_paginas || 1;
    for (const t of r.conta_pagar_cadastro || []) if (cfg.categorias.includes(String(t.codigo_categoria))) codigos.add(Number(t.codigo_cliente_fornecedor));
    pagina++;
  }
  const lista = Array.from(codigos);
  const linhas: Record<string, unknown>[] = [];
  for (let i = 0; i < lista.length; i += 5) {
    if (Date.now() - t0 > 120000) { completo = false; break; }
    const lote = lista.slice(i, i + 5);
    const rs = await Promise.allSettled(lote.map((c) => omie<any>("geral/clientes", "ConsultarCliente", { codigo_cliente_omie: c })));
    rs.forEach((x, k) => {
      if (x.status === "fulfilled") linhas.push({ omie_codigo: lote[k], nome: String(x.value.razao_social || x.value.nome_fantasia || "").trim(), atualizado_em: new Date().toISOString() });
    });
  }
  if (linhas.length) await pgUpsert("pcp_hh_folha", linhas, "omie_codigo");
  return { total: linhas.length, completo };
}
async function vincular(email: string, c: Candidato) {
  await pgUpsert("pcp_hh_vinculo", { colaborador_email: email, omie_codigo: c.codigo, omie_nome: c.nome, vinculado_em: new Date().toISOString() }, "colaborador_email");
}

/* ---------- Valor da hora (busca no Omie) ---------- */
type Resolucao = { ok: true; valor_hora: number; origem: string } | { ok: false; motivo: string; mensagem: string };

async function localizarNoOmie(email: string, nome: string, cpf?: string, omieCodigo?: number): Promise<{ codigo: number; nome: string } | { erro: string; mensagem: string }> {
  // Escolha direta feita por quem tem a alçada (entre os candidatos da folha).
  if (omieCodigo) {
    const c = (await folhaCache()).find((x) => x.codigo === omieCodigo);
    if (!c) return { erro: "sem_vinculo", mensagem: "Essa pessoa não está na lista da folha carregada. Recarregue a lista ou informe o CPF/CNPJ." };
    await vincular(email, c);
    return { codigo: c.codigo, nome: c.nome };
  }
  const v = await pgSelect<{ omie_codigo: number; omie_nome: string }>("pcp_hh_vinculo", `select=omie_codigo,omie_nome&colaborador_email=eq.${enc(email)}&limit=1`);
  if (v[0] && !cpf) return { codigo: Number(v[0].omie_codigo), nome: v[0].omie_nome };
  const filtro: Record<string, unknown> = cpf ? { cnpj_cpf: cpf.replace(/\D/g, "") } : { razao_social: nome };
  let cad: any[] = [];
  try {
    const r = await omie<any>("geral/clientes", "ListarClientes", { pagina: 1, registros_por_pagina: 30, apenas_importado_api: "N", clientesFiltro: filtro });
    cad = r.clientes_cadastro || [];
  } catch (e) {
    const msg = (e as Error).message;
    if (/n[aã]o existem registros/i.test(msg)) cad = []; else throw e;
  }
  if (!cpf) {
    const alvo = norm(nome);
    const exatos = cad.filter((c) => norm(c.razao_social) === alvo || norm(c.nome_fantasia) === alvo);
    cad = exatos.length ? exatos : cad.filter((c) => alvo.split(" ").every((t) => norm(c.razao_social).includes(t)));
  }
  if (cad.length === 1) {
    const c = cad[0];
    await pgUpsert("pcp_hh_vinculo", { colaborador_email: email, omie_codigo: c.codigo_cliente_omie, omie_nome: c.razao_social, vinculado_em: new Date().toISOString() }, "colaborador_email");
    return { codigo: Number(c.codigo_cliente_omie), nome: c.razao_social };
  }
  // Não achou pelo nome: tenta casar com a lista da folha (favorecidos das categorias de salário) já carregada.
  if (!cpf) {
    const tokens = norm(nome).split(" ").filter((t) => t.length > 1);
    const casam = (await folhaCache()).filter((c) => tokens.length > 0 && tokens.every((t) => norm(c.nome).includes(t)));
    if (casam.length === 1) { await vincular(email, casam[0]); return { codigo: casam[0].codigo, nome: casam[0].nome }; }
  }
  const dica = "Escolha quem é na lista da folha do Omie ou informe o CPF/CNPJ.";
  if (cad.length === 0) return { erro: "sem_vinculo", mensagem: `Não localizei "${nome}" pelo nome no Omie. ${dica}` };
  return { erro: "ambiguo", mensagem: `Há ${cad.length} cadastros parecidos com "${nome}" no Omie. ${dica}` };
}

async function valorHoraDe(email: string, nome: string, cpf?: string, forcar = false, omieCodigo?: number): Promise<Resolucao> {
  const cfg = await config();
  if (!forcar && !cpf && !omieCodigo) {
    const c = await pgSelect<{ valor_hora: number; origem: string; atualizado_em: string }>("pcp_hh_valores", `select=valor_hora,origem,atualizado_em&colaborador_email=eq.${enc(email)}&limit=1`);
    if (c[0] && c[0].valor_hora != null && Date.now() - new Date(c[0].atualizado_em).getTime() < cfg.validadeDias * 86400000) {
      return { ok: true, valor_hora: Number(c[0].valor_hora), origem: c[0].origem };
    }
  }
  const loc = await localizarNoOmie(email, nome, cpf, omieCodigo);
  if ("erro" in loc) return { ok: false, motivo: loc.erro, mensagem: loc.mensagem };

  // Títulos da pessoa nos últimos meses (a data do filtro é a de vencimento; a competência é a da emissão).
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth() - cfg.mesesBusca - 1, 1);
  const titulos: any[] = [];
  let pagina = 1, total = 1;
  while (pagina <= total && pagina <= 5) {
    const r = await omie<any>("financas/contapagar", "ListarContasPagar", {
      pagina, registros_por_pagina: 100, apenas_importado_api: "N", filtrar_cliente: loc.codigo,
      filtrar_por_data_de: dataBr(ini), filtrar_por_data_ate: dataBr(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
    });
    total = r.total_de_paginas || 1;
    titulos.push(...(r.conta_pagar_cadastro || []));
    pagina++;
  }
  const porMes = new Map<string, number>();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  for (const t of titulos) {
    if (!cfg.categorias.includes(String(t.codigo_categoria))) continue;
    const m = String(t.data_emissao || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) continue;
    const comp = `${m[3]}-${m[2]}`;
    if (comp >= mesAtual) continue;                      // só mês fechado
    porMes.set(comp, (porMes.get(comp) || 0) + Number(t.valor_documento || 0));
  }
  const comps = Array.from(porMes.keys()).sort().reverse();
  if (!comps.length) return { ok: false, motivo: "sem_lancamento", mensagem: `Sem lançamento de salário de "${loc.nome}" nas categorias ${cfg.categorias.join(", ")} nos últimos ${cfg.mesesBusca} meses fechados.` };
  const comp = comps[0];
  const base = porMes.get(comp)!;
  const valor = (base * cfg.fator) / cfg.horasUteis;
  const origem = `Omie · ${cfg.categorias.join("+")} · competência ${comp} · ÷ ${cfg.horasUteis} h${cfg.fator !== 1 ? " × " + cfg.fator : ""}`;
  await pgUpsert("pcp_hh_valores", { colaborador_email: email, valor_hora: valor, base_mensal: base, competencia: comp, origem, atualizado_em: new Date().toISOString() }, "colaborador_email");
  return { ok: true, valor_hora: valor, origem };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY || !OMIE_KEY || !OMIE_SECRET) return json({ error: "Credenciais não configuradas" }, 500);

  let b: any = {};
  try { b = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const acao = String(b.acao || "");
  const quem = String(b.solicitante_email || "").trim();

  try {
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const taxa = await pgRpc("api_rate_check", { p_bucket: "pcp-hh", p_ip: ip, p_max_ip: 60, p_max_global: 120, p_janela_s: 600 });
    if (taxa !== "ok") return json({ error: "Muitas consultas em pouco tempo. Aguarde alguns minutos." }, 429);
  } catch (e) {
    console.warn("[pcp-hh] limite de taxa indisponível", e);
    return json({ error: "Indisponível (verificação de segurança)." }, 503);
  }

  try {
    /* ---- custos: só quem tem pcp.ver_hh recebe valores ---- */
    if (acao === "custos") {
      if (!(await temAlcada(quem, "ver_hh"))) return json({ error: "Sem permissão para ver o custo de mão de obra." }, 403);
      const ids: string[] = Array.isArray(b.ordem_ids) ? b.ordem_ids.map(String).filter((s: string) => /^[0-9a-f-]{36}$/i.test(s)) : [];
      if (!ids.length) return json({ ok: true, custos: {}, total_por_ordem: {} });
      const ap = await pgSelect<{ id: string; ordem_id: string; horas: number }>("pcp_hh_apontamentos", `select=id,ordem_id,horas&ordem_id=in.(${ids.join(",")})`);
      if (!ap.length) return json({ ok: true, custos: {}, total_por_ordem: {} });
      const cs = await pgSelect<{ apontamento_id: string; valor_hora: number; custo: number; origem: string }>(
        "pcp_hh_custos", `select=apontamento_id,valor_hora,custo,origem&apontamento_id=in.(${ap.map((a) => a.id).join(",")})`);
      const custos: Record<string, unknown> = {}; const total: Record<string, number> = {};
      cs.forEach((c) => { custos[c.apontamento_id] = { valor_hora: c.valor_hora, custo: c.custo, origem: c.origem }; });
      ap.forEach((a) => { const c = cs.find((x) => x.apontamento_id === a.id); if (c && c.custo != null) total[a.ordem_id] = (total[a.ordem_id] || 0) + Number(c.custo); });
      return json({ ok: true, custos, total_por_ordem: total });
    }

    /* ---- as demais ações exigem pcp.apontar_hh ---- */
    if (!(await temAlcada(quem, "apontar_hh"))) return json({ error: "Sem permissão para apontar mão de obra (alçada pcp.apontar_hh)." }, 403);

    if (acao === "candidatos") {
      let cache = await folhaCache();
      let completo = true;
      if (b.recarregar || !cache.length) { const r = await carregarFolha(); completo = r.completo; cache = await folhaCache(); }
      return json({ ok: true, candidatos: cache, completo });
    }

    if (acao === "remover") {
      const id = String(b.apontamento_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "apontamento inválido" }, 400);
      await pgDelete("pcp_hh_apontamentos", `id=eq.${id}`);
      return json({ ok: true });
    }

    if (acao === "apontar" || acao === "editar") {
      const horas = Number(String(b.horas ?? "").replace(",", "."));
      if (!(horas > 0 && horas <= 1000)) return json({ error: "Informe as horas (maior que zero)." }, 400);

      let ap: any = null;
      if (acao === "editar") {
        const id = String(b.apontamento_id || "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "apontamento inválido" }, 400);
        ap = (await pgSelect<any>("pcp_hh_apontamentos", `select=*&id=eq.${id}&limit=1`))[0];
        if (!ap) return json({ error: "apontamento não encontrado" }, 404);
      }
      const emailColab = String(b.colaborador_email || (ap && ap.colaborador_email) || "").trim();
      const perfil = await perfilPorEmail(emailColab);
      if (!perfil || !perfil.ativo) return json({ error: "Colaborador não encontrado ou inativo na Administração." }, 400);

      const res = await valorHoraDe(perfil.email, perfil.nome, b.cpf ? String(b.cpf) : undefined, !!b.recalcular, b.omie_codigo ? Number(b.omie_codigo) : undefined);
      // O apontamento (quem/horas) é gravado mesmo sem valor; o custo fica pendente até vincular ao Omie.
      const dados = {
        colaborador_email: perfil.email, colaborador_nome: perfil.nome, departamento: perfil.departamento, horas,
        observacao: b.observacao ? String(b.observacao).slice(0, 300) : (ap ? ap.observacao : null), updated_at: new Date().toISOString(),
      };
      let id: string;
      if (ap) { await pgPatch("pcp_hh_apontamentos", `id=eq.${ap.id}`, dados); id = ap.id; }
      else {
        const novo = await pgInsert<{ id: string }>("pcp_hh_apontamentos", { ...dados, ordem_id: String(b.ordem_id), etapa_id: b.etapa_id || null, registrado_por: quem });
        id = novo.id;
      }
      if (res.ok) {
        await pgUpsert("pcp_hh_custos", { apontamento_id: id, valor_hora: res.valor_hora, custo: res.valor_hora * horas, origem: res.origem, calculado_em: new Date().toISOString() }, "apontamento_id");
        return json({ ok: true, apontamento_id: id, custo_calculado: true });
      }
      await pgDelete("pcp_hh_custos", `apontamento_id=eq.${id}`);
      return json({ ok: true, apontamento_id: id, custo_calculado: false, pendente: res.motivo, mensagem: res.mensagem, candidatos: await folhaCache() });
    }
    return json({ error: "ação inválida" }, 400);
  } catch (e) {
    console.error("[pcp-hh]", (e as Error).message);
    return json({ error: "Falha ao processar. Tente de novo." }, 500);
  }
});
