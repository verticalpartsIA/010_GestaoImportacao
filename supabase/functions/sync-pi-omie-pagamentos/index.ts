/* sync-pi-omie-pagamentos — ver supabase/functions/sync-pi-omie-pagamentos/index.ts no repo (coluna "Pago no Omie" da lista de P.I.). Só consulta o Omie. */
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];
const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";
const sb = createClient(supabaseUrl, supabaseServiceKey);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function dataISO(br: string | null | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

type Mov = { detalhes: Record<string, any>; resumo: Record<string, any> };

const cacheTitulos = new Map<string, Mov[]>();

async function listarPorTitulo(titulo: string): Promise<Mov[]> {
  const chave = titulo.replace(/\s+/g, "").toUpperCase();
  const guardado = cacheTitulos.get(chave);
  if (guardado) return guardado;
  const r = await listarPorTituloOmie(titulo);
  cacheTitulos.set(chave, r);
  return r;
}

async function listarPorTituloOmie(titulo: string): Promise<Mov[]> {
  const out: Mov[] = [];
  let pagina = 1, total = 1, tentativa = 0;
  while (pagina <= total && pagina <= 5) {
    const res = await fetch("https://app.omie.com.br/api/v1/financas/mf/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call: "ListarMovimentos", app_key: omieKey, app_secret: omieSecret,
        param: [{ nPagina: pagina, nRegPorPagina: 100, cNatureza: "P", cNumTitulo: titulo }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.faultstring) {
      if (/n[ãa]o existem registros/i.test(data.faultstring)) return out;
      if (/j[áa] existe uma requisi|redundante/i.test(data.faultstring) && tentativa < 3) {
        const seg = Number(/aguarde\s+(\d+)\s+seg/i.exec(data.faultstring)?.[1]) || 3 * (tentativa + 1);
        if (seg <= 40) {
          tentativa++;
          await sleep((seg + 1) * 1000);
          continue;
        }
      }
      throw new Error(`Omie: ${data.faultstring}`);
    }
    tentativa = 0;
    if (!res.ok) throw new Error(`Omie HTTP ${res.status}`);
    for (const m of data.movimentos || []) out.push(m);
    total = data.nTotPaginas || 1;
    pagina++;
  }
  const alvo = titulo.replace(/\s+/g, "").toUpperCase();
  return out.filter((m) =>
    m.detalhes.cGrupo === "CONTA_A_PAGAR" &&
    String(m.detalhes.cStatus || "").toUpperCase() !== "CANCELADO" &&
    String(m.detalhes.cNumTitulo || "").replace(/\s+/g, "").toUpperCase() === alvo
  );
}

function variantes(numeroPi: string): { titulo: string; compartilhado: boolean }[] {
  const pi = numeroPi.trim();
  const lista: { titulo: string; compartilhado: boolean }[] = [{ titulo: pi, compartilhado: false }];
  const m = /^(.*?)\s*-\s*(\d+)$/.exec(pi);
  if (m) {
    lista.push({ titulo: `${m[1]} -${m[2]}`, compartilhado: false });
    lista.push({ titulo: m[1].trim(), compartilhado: true });
  }
  const vistos = new Set<string>();
  return lista.filter((v) => (vistos.has(v.titulo) ? false : (vistos.add(v.titulo), true)));
}

async function resolver(numeroPi: string) {
  for (const v of variantes(numeroPi)) {
    const movs = await listarPorTitulo(v.titulo);
    if (movs.length) return { movs, ...v };
    await sleep(300);
  }
  return { movs: [] as Mov[], titulo: numeroPi.trim(), compartilhado: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!omieKey || !omieSecret) return json({ error: "OMIE_API_KEY / OMIE_API_SECRET não configuradas" }, 500);

  {
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const { data: taxa, error: errTaxa } = await sb.rpc("api_rate_check", {
      p_bucket: "pi-omie-pagamentos", p_ip: ip, p_max_ip: 6, p_max_global: 20, p_janela_s: 600,
    });
    if (errTaxa) return json({ error: "Sincronização temporariamente indisponível (verificação de segurança)." }, 503);
    if (taxa !== "ok") return json({ error: "Muitas consultas em pouco tempo. Aguarde alguns minutos e tente de novo." }, 429);
  }

  cacheTitulos.clear();
  try {
    const body = await req.json().catch(() => ({}));
    const filtro: string[] | null = Array.isArray(body.numeros_pi) ? body.numeros_pi.map((s: string) => String(s).trim()) : null;

    const { data: pis, error } = await sb.from("pi_importacao").select("numero_pi, status");
    if (error) throw new Error(`select pi_importacao: ${error.message}`);
    const alvos = (pis || [])
      .filter((p) => p.status !== "Cancelada")
      .map((p) => String(p.numero_pi || "").trim())
      .filter((n) => n && (!filtro || filtro.includes(n)));

    const agora = new Date().toISOString();
    const linhas: Record<string, unknown>[] = [];
    const erros: string[] = [];

    for (const numero of alvos) {
      try {
        const { movs, titulo, compartilhado } = await resolver(numero);
        const titulos = movs.map((m) => ({
          parcela: m.detalhes.cNumParcela || null,
          status: m.detalhes.cStatus || null,
          vencimento: dataISO(m.detalhes.dDtVenc),
          pagamento: dataISO(m.detalhes.dDtPagamento),
          valor: Number(m.detalhes.nValorTitulo) || 0,
          pago: Number(m.resumo?.nValPago) || 0,
          liquidado: m.resumo?.cLiquidado === "S",
        }));
        const pagos = titulos.filter((t) => t.liquidado);
        const situacao = !titulos.length ? "nao_encontrado"
          : pagos.length === titulos.length ? "pago"
          : pagos.length > 0 ? "parcial" : "em_aberto";
        const ultimo = pagos.map((t) => t.pagamento).filter(Boolean).sort().pop() || null;
        linhas.push({
          numero_pi: numero, situacao, titulo_busca: titulos.length ? titulo : null,
          titulo_compartilhado: titulos.length ? compartilhado : false,
          total_titulos: titulos.length, titulos_pagos: pagos.length,
          total_brl: titulos.reduce((s, t) => s + t.valor, 0),
          pago_brl: titulos.reduce((s, t) => s + t.pago, 0),
          ultimo_pagamento: ultimo, titulos, atualizado_em: agora,
        });
      } catch (e) {
        erros.push(`${numero}: ${(e as Error).message}`);
        await sleep(1000);
      }
    }

    if (linhas.length) {
      const { error: upErr } = await sb.from("pi_omie_pagamentos").upsert(linhas, { onConflict: "numero_pi" });
      if (upErr) throw new Error(`upsert pi_omie_pagamentos: ${upErr.message}`);
    }
    return json({ ok: true, consultadas: alvos.length, gravadas: linhas.length, erros });
  } catch (e) {
    console.error("sync-pi-omie-pagamentos error:", e);
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
