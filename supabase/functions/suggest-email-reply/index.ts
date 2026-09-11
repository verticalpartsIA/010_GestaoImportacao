// ============================================================
// suggest-email-reply — Edge Function (vpprd)
// Sugere uma resposta pro e-mail aberto no Inbox (botão "Sugerir
// resposta (AI)", logistica.jsx). Mesmo padrão de IA já usado em
// vp-copiloto/ncm-duimp-assist — Anthropic Claude, secret ANTHROPIC_API_KEY.
//
// Body: { subject, fromName, from, bodyText, numeroCotacao? }
// Resposta: { ok:true, sugestao: string }
// ============================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const SYSTEM = `Você ajuda o time da VerticalParts (fabricante/importadora de elevadores, escadas e esteiras) a
responder e-mails de trabalho — fornecedores, clientes, despachantes, transportadoras. Escreva em
português do Brasil, tom profissional e direto, sem enrolar. Nunca invente fatos, valores, datas ou
compromissos que não estejam no e-mail original ou no contexto fornecido — quando faltar informação
pra responder algo específico, deixe um placeholder claro entre colchetes (ex.: "[confirmar prazo]").
Devolva APENAS o texto da resposta, pronto pra revisar e enviar — sem saudação de e-mail duplicada
desnecessária, sem comentário seu, sem aspas ao redor, sem markdown.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  const KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!KEY) return json({ error: "IA indisponível: ANTHROPIC_API_KEY não configurada" }, 503);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const subject = typeof payload?.subject === "string" ? payload.subject : "";
  const fromName = typeof payload?.fromName === "string" ? payload.fromName : "";
  const from = typeof payload?.from === "string" ? payload.from : "";
  const bodyText = typeof payload?.bodyText === "string" ? payload.bodyText.slice(0, 6000) : "";
  const numeroCotacao = payload?.numeroCotacao;

  if (!bodyText) return json({ error: "bodyText é obrigatório (texto do e-mail a responder)." }, 400);

  const contexto = `E-MAIL RECEBIDO:\nDe: ${fromName || from} <${from}>\nAssunto: ${subject}\n` +
    (numeroCotacao != null ? `Vinculado à Cotação Nº ${numeroCotacao} no sistema.\n` : "") +
    `\nCorpo:\n"""${bodyText}"""\n\nEscreva uma sugestão de resposta pra este e-mail.`;

  let resp: Response;
  try {
    resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 800, temperature: 0.4, system: SYSTEM, messages: [{ role: "user", content: contexto }] }),
    });
  } catch (e) {
    return json({ error: "Falha ao contatar a IA", detail: String(e) }, 503);
  }

  if (resp.status === 429) return json({ error: "Rate limit da IA — tente de novo em instantes." }, 429);
  if (!resp.ok) {
    const t = await resp.text();
    return json({ error: "Erro na IA", detail: t.slice(0, 300) }, resp.status >= 500 ? 503 : 500);
  }

  try {
    const data = await resp.json();
    const sugestao = (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
    return json({ ok: true, sugestao });
  } catch (e) {
    return json({ error: "Resposta da IA ilegível", detail: String(e) }, 500);
  }
});
