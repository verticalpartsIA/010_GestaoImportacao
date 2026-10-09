// @ts-nocheck
/* ============================================================
   alerta-pcp-prazos — Edge Function (vpprd) · PCP, alerta automático de PRAZO (SLA) dos pedidos de venda.

   NÃO chama o Omie: só LÊ pcp_pedidos / pcp_ordens / pcp_expedicoes / pcp_pedido_acompanhamento e GRAVA em `alertas`.
   Usa a MESMA regra de SLA das telas Emissão de NF e Expedição (src/pcp-pedido-sla.js, bloco BEGIN/END CALC copiado aqui;
   src/alerta-pcp-paridade.test.js falha se os dois lados divergirem): OP em até 1 dia útil da entrada, produção até a
   previsão, NF em até 1 dia útil após a produção, despacho em até 1 dia útil após a NF. Pedido "histórico" não tem SLA.

   Quatro avisos (um por etapa atrasada), cada um para quem age nela:
     OP não criada / produção atrasada / despacho atrasado → líderes ATIVOS do departamento de Almoxarifado
     NF atrasada                                           → líderes ATIVOS do departamento de Financeiro
   Sem líder cadastrado cai no alerta global. Só entram pedidos que chegaram há até 60 dias (evita ruído de pedido antigo).

   Sem spam: id determinístico = semana ISO + assinatura da lista + e-mail; lista igual na mesma semana = nada novo; lista mudou
   ou virou a semana = alerta novo e os anteriores do mesmo tipo/pessoa são resolvidos; situação normalizada resolve todos.
   Body: { simular: true } devolve sem gravar; { email } cria só para essa pessoa (ids pcp-teste-…; apague depois).
   Sem supabase-js: PostgREST via fetch.
   ============================================================ */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"] as string; } catch { return ""; }
})() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const pgH = (extra: Record<string, string> = {}) => ({
  apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra,
});
async function pgSelectAll<T>(tabela: string, qs: string): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, { headers: pgH({ Range: `${de}-${de + 999}`, "Range-Unit": "items" }) });
    if (!r.ok) throw new Error(`select ${tabela}: ${r.status} ${await r.text()}`);
    const rows = (await r.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
async function pgRpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: pgH(), body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status}`);
  return await r.json();
}

/* ---------- SLA do pedido (cópia de src/pcp-pedido-sla.js) ---------- */
const SLA = (() => {
  // BEGIN CALC — copiado para supabase/functions/alerta-pcp-prazos/index.ts; src/alerta-pcp-paridade.test.js confere que seguem idênticos
  const dia = (s) => (s ? String(s).slice(0, 10) : null);
  const paraData = (s) => { const [a, m, d] = dia(s).split('-').map(Number); return new Date(a, m - 1, d); };
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  // Soma n dias úteis (n>=0).
  function somarDiasUteis(s, n) {
    const dt = paraData(s);
    let falta = n;
    while (falta > 0) { dt.setDate(dt.getDate() + 1); const w = dt.getDay(); if (w !== 0 && w !== 6) falta--; }
    return iso(dt);
  }

  // Resultado de uma etapa: { limite, feito, estado } — estado: 'ok' | 'ok_atraso' | 'andamento' | 'atrasada' | 'aguardando'
  function etapa(inicio, limite, feito, hoje) {
    if (!inicio || !limite) return { limite: null, feito: dia(feito), estado: 'aguardando' };
    const f = dia(feito);
    if (f) return { limite, feito: f, estado: f <= limite ? 'ok' : 'ok_atraso' };
    return { limite, feito: null, estado: hoje > limite ? 'atrasada' : 'andamento' };
  }

  // p: { entrada_em, opCriadaEm, producaoPrazo, producaoFeita, nfEm, despachoEm, historico }
  function calcular(p, hoje) {
    if (p.historico) return { historico: true, etapas: null, atrasado: false };
    const entrada = dia(p.entrada_em);
    const op = etapa(entrada, entrada ? somarDiasUteis(entrada, 1) : null, p.opCriadaEm, hoje);
    const prod = etapa(dia(p.opCriadaEm), dia(p.producaoPrazo), p.producaoFeita, hoje);
    const prodFeita = dia(p.producaoFeita);
    const nf = etapa(prodFeita, prodFeita ? somarDiasUteis(prodFeita, 1) : null, p.nfEm, hoje);
    const nfEm = dia(p.nfEm);
    const desp = etapa(nfEm, nfEm ? somarDiasUteis(nfEm, 1) : null, p.despachoEm, hoje);
    const etapas = { op, producao: prod, nf, despacho: desp };
    const atrasado = Object.values(etapas).some(e => e.estado === 'atrasada');
    return { historico: false, etapas, atrasado };
  }

  // END CALC
  return { calcular };
})();

/* ---------- utilidades ---------- */
const hojeBrasilia = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const somarDias = (isoData: string, n: number) => new Date(Date.parse(isoData + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
function semanaDe(isoData: string) {
  const d = new Date(Date.parse(isoData + "T00:00:00Z"));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const ano = d.getUTCFullYear();
  const inicio = Date.UTC(ano, 0, 1);
  return `${ano}W${String(Math.ceil(((d.getTime() - inicio) / 86400000 + 1) / 7)).padStart(2, "0")}`;
}
function assinatura(partes: string[]) {
  let h = 5381;
  const s = partes.slice().sort().join("|");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const lista = (itens: string[], max: number) => itens.length > max ? `${itens.slice(0, max).join(", ")} e mais ${itens.length - max}` : itens.join(", ");
const emailsValidos = (rows: any[]) => Array.from(new Set(rows.map((l) => String(l.email || "").trim().toLowerCase()).filter((m) => /^[^@\s]+@[^@\s]+$/.test(m))));

// Um aviso por etapa atrasada: quem age, módulo e para onde o clique leva.
const TIPOS = [
  { tipo: "op", etapa: "op", quem: "almox", modulo: "Almoxarifado", rota: "/logistica/pcp", titulo: (n: number) => `Prazo: ${n} pedido(s) sem OP além de 1 dia útil`, dica: "Gere as OPs em Logística › PCP › Pedidos para Produzir." },
  { tipo: "producao", etapa: "producao", quem: "almox", modulo: "Almoxarifado", rota: "/logistica/pcp", titulo: (n: number) => `Prazo: ${n} pedido(s) com produção atrasada`, dica: "Abra Logística › PCP › Controle." },
  { tipo: "nf", etapa: "nf", quem: "fin", modulo: "Financeiro", rota: "/adm-financeiro/emissao-nf", titulo: (n: number) => `Prazo: ${n} NF(s) a emitir além de 1 dia útil`, dica: "Abra Adm/Financeiro › Emissão de NF (Atrasados)." },
  { tipo: "despacho", etapa: "despacho", quem: "almox", modulo: "Almoxarifado", rota: "/logistica/expedicao", titulo: (n: number) => `Prazo: ${n} pedido(s) com NF emitida e sem despacho`, dica: "Abra Logística › Expedição." },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY) return json({ error: "Credenciais não configuradas" }, 500);

  let simular = false, email: string | null = null;
  try {
    const b = await req.json();
    simular = b?.simular === true;
    if (typeof b?.email === "string" && /^[^@\s]+@[^@\s]+$/.test(b.email)) email = b.email.trim().toLowerCase();
  } catch { /* sem body */ }

  try {
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const taxa = await pgRpc("api_rate_check", { p_bucket: "alerta-pcp-prazos", p_ip: ip, p_max_ip: 10, p_max_global: 20, p_janela_s: 600 });
    if (taxa !== "ok") return json({ error: "Muitas chamadas em pouco tempo. Aguarde alguns minutos." }, 429);
  } catch (e) {
    console.warn("[alerta-pcp-prazos] limite de taxa indisponível", e);
    return json({ error: "Indisponível (verificação de segurança)." }, 503);
  }

  try {
    const hoje = hojeBrasilia();
    const semana = semanaDe(hoje);
    const corte = somarDias(hoje, -60);
    const prefixoId = email ? "pcp-teste" : "pcp";
    const [pedidos, maes, exps, acomp] = await Promise.all([
      pgSelectAll<any>("pcp_pedidos", "select=codigo_pedido,numero_pedido,etapa,cliente_nome,cliente_fantasia,data_previsao,entrada_em,faturado,data_faturamento&cancelado=eq.false&order=codigo_pedido"),
      pgSelectAll<any>("pcp_ordens", "select=pedido_codigo,status,created_at,data_finalizacao,prazo_entrega&frente=eq.pedido&pedido_codigo=not.is.null"),
      pgSelectAll<any>("pcp_expedicoes", "select=pedido_codigo,data_saida"),
      pgSelectAll<any>("pcp_pedido_acompanhamento", "select=numero_pedido,historico"),
    ]);
    const maePor: Record<string, any> = {}; maes.forEach((m) => { maePor[m.pedido_codigo] = m; });
    const expPor: Record<string, any[]> = {}; exps.forEach((x) => { (expPor[x.pedido_codigo] = expPor[x.pedido_codigo] || []).push(x); });
    const acPor: Record<string, any> = {}; acomp.forEach((a) => { acPor[a.numero_pedido] = a; });
    const grupos: Record<string, any[]> = {}; pedidos.forEach((p) => { (grupos[p.numero_pedido] = grupos[p.numero_pedido] || []).push(p); });

    // Mesma montagem de Emissão de NF (resumo do grupo por nº de pedido).
    const atrasos: Record<string, { numero: string; nome: string }[]> = { op: [], producao: [], nf: [], despacho: [] };
    for (const [numero, regs] of Object.entries(grupos)) {
      if (regs.every((r) => r.etapa === "00")) continue;                    // proposta ainda não é venda firme: sem SLA
      const mae = regs.map((r) => maePor[r.codigo_pedido]).find(Boolean) || null;
      const saidas = regs.flatMap((r) => expPor[r.codigo_pedido] || []).map((x) => x.data_saida).filter(Boolean).sort();
      const fat = regs.filter((r) => r.faturado);
      const todosFat = fat.length === regs.length;
      const nfEm = todosFat ? fat.map((r) => r.data_faturamento).filter(Boolean).sort().pop() || null : null;
      const entrada = regs.map((r) => r.entrada_em).filter(Boolean).sort()[0] || null;
      if (!entrada || String(entrada).slice(0, 10) < corte) continue;       // só pedidos recentes
      const prazo = (mae && mae.prazo_entrega) || regs.map((r) => r.data_previsao).filter(Boolean).sort()[0] || null;
      const ac = acPor[numero] || null;
      const sla = SLA.calcular({
        historico: !!(ac && ac.historico), entrada_em: entrada, opCriadaEm: mae ? mae.created_at : null,
        producaoPrazo: prazo, producaoFeita: mae && mae.status === "concluida" ? (mae.data_finalizacao || hoje) : null,
        nfEm, despachoEm: saidas[0] || null,
      }, hoje);
      if (sla.historico || !sla.etapas) continue;
      const nome = String(regs[0].cliente_fantasia || regs[0].cliente_nome || "").slice(0, 28);
      for (const k of Object.keys(atrasos)) if (sla.etapas[k].estado === "atrasada") atrasos[k].push({ numero, nome });
    }

    // Quem recebe (teste com {email}: só essa pessoa).
    const selLider = (filtroDep: string) => pgSelectAll<any>("colaboradores_vpsistema", `select=email&is_department_lead=eq.true&is_active=eq.true&departamento=ilike.${filtroDep}&order=email`);
    const [lAlmox, lFin] = email ? [[], []] : await Promise.all([selLider("*Almoxarifado*"), selLider("*Financeiro*")]);
    const destinoPor = (quem: string): (string | null)[] => {
      if (email) return [email];
      const m = emailsValidos(quem === "fin" ? lFin : lAlmox);
      return m.length ? m : [null];
    };

    const candidatos: any[] = TIPOS.filter((t) => atrasos[t.etapa].length > 0).map((t) => {
      const itens = atrasos[t.etapa];
      const sig = assinatura(itens.map((i) => i.numero));
      return {
        tipo: t.tipo, quem: t.quem, modulo: t.modulo, rota: t.rota, level: "danger",
        id: `${prefixoId}-prazo${t.tipo}-${semana}-${sig}`,
        title: t.titulo(itens.length),
        sub: `${lista(itens.slice(0, 5).map((i) => `${i.numero}${i.nome ? " (" + i.nome + ")" : ""}`), 5)}. ${t.dica}`.slice(0, 480),
      };
    });

    const resumo = { hoje, semana, atrasados: Object.fromEntries(Object.entries(atrasos).map(([k, v]) => [k, v.length])) };
    if (simular) return json({ ok: true, simulado: true, resumo, alertas: candidatos.map((c) => ({ ...c, destinatarios: destinoPor(c.quem) })) });

    const criados: any[] = [];
    for (const t of TIPOS) {
      const novoBase = candidatos.find((c) => c.tipo === t.tipo);
      for (const dest of destinoPor(t.quem)) {
        const sufixo = dest ? "-" + dest.replace(/[^a-z0-9]/g, "") : "";
        const novo = novoBase ? { ...novoBase, id: novoBase.id + sufixo } : null;
        const filtroEmail = dest ? `&destinatario_email=eq.${encodeURIComponent(dest)}` : "&destinatario_email=is.null";
        if (novo) {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/alertas?on_conflict=id`, {
            method: "POST", headers: pgH({ Prefer: "resolution=ignore-duplicates,return=representation" }),
            body: JSON.stringify([{ id: novo.id, level: novo.level, title: novo.title, sub: novo.sub, module: novo.modulo, rota: novo.rota, resolved: false, destinatario_email: dest }]),
          });
          if (!r.ok) throw new Error(`insert alertas: ${r.status} ${await r.text()}`);
          const inseridos = await r.json();
          criados.push({ ...novo, destinatario: dest, novo: inseridos.length > 0 });
        }
        const padrao = encodeURIComponent(`${prefixoId}-prazo${t.tipo}-*`);
        const nao = novo ? `&id=neq.${encodeURIComponent(novo.id)}` : "";
        const p = await fetch(`${SUPABASE_URL}/rest/v1/alertas?id=like.${padrao}&resolved=eq.false${nao}${filtroEmail}`, {
          method: "PATCH", headers: pgH({ Prefer: "return=minimal" }), body: JSON.stringify({ resolved: true }),
        });
        if (!p.ok) throw new Error(`resolver alertas: ${p.status} ${await p.text()}`);
      }
    }
    return json({ ok: true, simulado: false, resumo, criados });
  } catch (e) {
    console.error("[alerta-pcp-prazos]", (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
