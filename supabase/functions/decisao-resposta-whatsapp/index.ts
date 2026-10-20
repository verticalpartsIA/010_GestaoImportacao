// @ts-nocheck
/* ============================================================
   decisao-resposta-whatsapp — Edge Function (vpprd)
   Recebe da Central de Eventos (vpsistema) a RESPOSTA que o Diego deu no WhatsApp ao pedido de aval de contratação de
   montador ("SIM" / "NÃO" [código do contrato]) e aplica na decisão (`decisoes_gerenciais`, tipo contratacao_mao_obra_ceo)
   pela função SQL `decisao_whatsapp_responder` (só service_role). A função devolve o texto que a Central deve responder ao Diego.

   Contrato (mesmo esquema de assinatura da origem vphub em eventos-publicar, só que no sentido inverso):
     POST  Content-Type: application/json
     X-Timestamp:  segundos (janela de 5 min)
     X-Assinatura: "sha256=" + HMAC-SHA256(EVENTOS_SEGREDO, `${timestamp}.${corpo}`) em hex
     Corpo: { "telefone": "5511994621946", "texto": "Sim", "mensagem_ref": "M009" (opcional) }
   Respostas: 200 { ok, resultado?, erro?, resposta }  (erro: numero_desconhecido | resposta_invalida | nada_pendente | ambiguo | ja_decidida)
              401 assinatura inválida · 400 corpo inválido · 503 sem segredo.
   Segurança: só o número cadastrado como aprovador (decisao_whatsapp_numeros) decide; o segredo é o mesmo da origem vphub.
   Sem supabase-js (import remoto já derrubou produção em redeploy): PostgREST via fetch.
   ============================================================ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"] as string; } catch { return ""; }
})() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SEGREDO = Deno.env.get("EVENTOS_SEGREDO") || "";
const enc = new TextEncoder();
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-timestamp, x-assinatura, x-origem" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function iguais(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, erro: "metodo_nao_permitido" }, 405);
  if (!SEGREDO) return json({ ok: false, erro: "sem_segredo" }, 503);

  const corpo = await req.text();
  const ts = req.headers.get("x-timestamp") || "";
  const assinatura = (req.headers.get("x-assinatura") || "").replace(/^sha256=/, "");
  const agora = Math.floor(Date.now() / 1000);
  if (!/^\d{9,12}$/.test(ts) || Math.abs(agora - Number(ts)) > 300) return json({ ok: false, erro: "timestamp_invalido" }, 401);
  const esperado = await hmacHex(SEGREDO, `${ts}.${corpo}`);
  if (!iguais(esperado, assinatura.toLowerCase())) return json({ ok: false, erro: "assinatura_invalida" }, 401);

  let dados: any;
  try { dados = JSON.parse(corpo); } catch { return json({ ok: false, erro: "corpo_invalido" }, 400); }
  const telefone = String(dados.telefone || "").slice(0, 30);
  const texto = String(dados.texto || "").slice(0, 200);
  const ref = dados.mensagem_ref ? String(dados.mensagem_ref).slice(0, 80) : null;
  if (!telefone || !texto) return json({ ok: false, erro: "corpo_invalido" }, 400);

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/decisao_whatsapp_responder`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_telefone: telefone, p_texto: texto, p_ref: ref }),
  });
  if (!r.ok) return json({ ok: false, erro: "falha_interna", status: r.status }, 502);
  const res = await r.json();
  // número desconhecido: não confirma nada a quem não é o aprovador (a Central simplesmente não responde)
  if (res && res.erro === "numero_desconhecido") return json({ ok: false, erro: "numero_desconhecido" });
  return json(res);
});
