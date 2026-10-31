// @ts-nocheck
/* ============================================================
   eventos-publicar — Edge Function (vpprd) · publica na Central de Eventos (vpsistema.com/eventos) os eventos da fila
   local `eventos_outbox` (origem 'vphub'). Cron a cada minuto. Só publica o FATO; quem recebe, o texto e o canal (WhatsApp)
   são regras da Central.

   Contrato da Central (vpsistema › eventos-ingest): POST com X-Origem (slug), X-Timestamp (segundos, janela de 5 min) e
   X-Assinatura = "sha256=" + HMAC-SHA256(segredo da origem, `${timestamp}.${corpo}`) em hex.
   Corpo: { tipo, idempotency_key, ocorrido_em, ator, entidade:{tipo,id,numero}, payload }.
   Respostas: 202/200 aceito (200 = duplicado); 401 assinatura/origem; 403 origem desativada; 404 tipo fora do catálogo;
   400 envelope inválido; 429/503 tentar de novo mais tarde.

   Segredos (variáveis da função, NUNCA no código): EVENTOS_SEGREDO (obrigatório). Opcionais: EVENTOS_ORIGEM (padrão 'vphub'),
   EVENTOS_INGEST_URL. Sem EVENTOS_SEGREDO a fila fica intacta (não gasta tentativa) e a resposta diz "sem_segredo".
   Retry: 1, 5, 15, 60 min; depois de 5 tentativas vira 'falha' (visível na tabela; reenfileirar = status 'pendente').
   Sem supabase-js (import remoto já derrubou produção em redeploy): PostgREST via fetch.
   ============================================================ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"] as string; } catch { return ""; }
})() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SEGREDO = Deno.env.get("EVENTOS_SEGREDO") || "";
const ORIGEM = Deno.env.get("EVENTOS_ORIGEM") || "vphub";
const INGEST_URL = Deno.env.get("EVENTOS_INGEST_URL") || "https://ubdkoqxfwcraftesgmbw.supabase.co/functions/v1/eventos-ingest";
const BACKOFF_MIN = [1, 5, 15, 60, 60];
const MAX_TENTATIVAS = 5;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const pgH = (extra: Record<string, string> = {}) => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra });
const enc = new TextEncoder();

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function publicar(ev: any) {
  const corpo = JSON.stringify({
    tipo: ev.tipo, idempotency_key: ev.idempotency_key, ocorrido_em: new Date(ev.ocorrido_em).toISOString(),
    ator: ev.ator ?? null, entidade: ev.entidade ?? {}, payload: ev.payload ?? {},
  });
  const ts = String(Math.floor(Date.now() / 1000));
  const assinatura = "sha256=" + await hmacHex(SEGREDO, `${ts}.${corpo}`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(INGEST_URL, { method: "POST", signal: ctrl.signal, body: corpo,
      headers: { "Content-Type": "application/json", "X-Origem": ORIGEM, "X-Timestamp": ts, "X-Assinatura": assinatura } });
    let j: any = null; try { j = await r.json(); } catch { /* corpo vazio */ }
    return { status: r.status, body: j };
  } finally { clearTimeout(t); }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (!SEGREDO) return json({ ok: false, erro: "sem_segredo", dica: "Configure EVENTOS_SEGREDO nas variáveis desta função." });

  const agora = new Date().toISOString();
  const q = await fetch(`${SUPABASE_URL}/rest/v1/eventos_outbox?status=eq.pendente&proximo_em=lte.${encodeURIComponent(agora)}&order=id.asc&limit=20`, { headers: pgH() });
  if (!q.ok) return json({ ok: false, erro: "leitura_da_fila", status: q.status }, 500);
  const fila: any[] = await q.json();
  const resultados: any[] = [];

  for (const ev of fila) {
    let upd: Record<string, unknown>;
    try {
      const r = await publicar(ev);
      if (r.status === 202 || r.status === 200) {
        upd = { status: "enviado", enviado_em: new Date().toISOString(), evento_id: r.body?.evento_id ?? null, ultimo_erro: null, tentativas: ev.tentativas + 1 };
      } else {
        const tent = ev.tentativas + 1;
        const erro = r.status === 404 ? "tipo_nao_cadastrado_na_central" : r.status === 401 ? "assinatura_ou_origem_recusada" : r.status === 403 ? "origem_desativada"
          : r.status === 400 ? "envelope_invalido: " + JSON.stringify(r.body?.detalhes ?? r.body ?? "").slice(0, 300) : "http_" + r.status;
        upd = tent >= MAX_TENTATIVAS
          ? { status: "falha", tentativas: tent, ultimo_erro: erro }
          : { tentativas: tent, ultimo_erro: erro, proximo_em: new Date(Date.now() + BACKOFF_MIN[Math.min(tent - 1, BACKOFF_MIN.length - 1)] * 60000).toISOString() };
      }
    } catch (e) {
      const tent = ev.tentativas + 1;
      upd = tent >= MAX_TENTATIVAS ? { status: "falha", tentativas: tent, ultimo_erro: "rede: " + String(e).slice(0, 200) }
        : { tentativas: tent, ultimo_erro: "rede: " + String(e).slice(0, 200), proximo_em: new Date(Date.now() + BACKOFF_MIN[Math.min(tent - 1, BACKOFF_MIN.length - 1)] * 60000).toISOString() };
    }
    await fetch(`${SUPABASE_URL}/rest/v1/eventos_outbox?id=eq.${ev.id}`, { method: "PATCH", headers: pgH({ Prefer: "return=minimal" }), body: JSON.stringify(upd) });
    resultados.push({ id: ev.id, tipo: ev.tipo, status: upd.status ?? "pendente", erro: upd.ultimo_erro ?? null });
  }
  return json({ ok: true, processados: resultados.length, resultados });
});
