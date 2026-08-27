// ============================================================
// vp-translate-to-pt — Edge Function (vpprd)
// Traduz texto livre do fornecedor (qualquer idioma) para português do
// Brasil — usado na "Confirmação técnica" da resposta do fornecedor
// (cotacao-elevador-fornecedor.jsx), pra exibir junto do original no
// Detalhe de Cotação (formulario-elevador.jsx). Direção oposta de
// vp-translate (que traduz PT-BR → EN pro RFQ enviado ao fornecedor).
// IA: Anthropic Claude (secret ANTHROPIC_API_KEY).
//
// Request:  { text: string }
// Response: { translated: string|null }
//   translated = null quando o texto já está em português do Brasil
//   (ou está vazio) — nesse caso não há nada pra mostrar de duplicado.
// ============================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

const SYSTEM = `Você é um tradutor técnico para a VerticalParts, empresa de elevadores, escadas e
esteiras rolantes. Você recebe um texto livre escrito por um FORNECEDOR (China, Alemanha etc.) como
confirmação técnica de uma cotação — pode estar em inglês, chinês, ou qualquer outro idioma.

TAREFA:
- Se o texto já estiver em português do Brasil, responda {"translated":null} — não duplique.
- Se o texto estiver vazio ou for só código/números sem palavras de nenhum idioma, responda {"translated":null}.
- Caso contrário, traduza para português do Brasil claro e técnico, preservando:
  números, unidades (mm, kg, V, m/s…), códigos de modelo/norma (ex.: EN81-20/50/70, COP-05C),
  nomes próprios e siglas — mantenha esses elementos EXATAMENTE como no original, traduza só o texto
  ao redor deles.

OUTPUT: responda APENAS com um único JSON válido, sem texto fora dele, sem markdown, sem cercas.
Formato: {"translated":"..."} ou {"translated":null}`;

function extractJson(text: string): any {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(text.slice(a, b + 1));
  throw new Error("resposta da IA sem JSON");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  const KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!KEY) return json({ error: "IA indisponível: ANTHROPIC_API_KEY não configurada" }, 503);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const text: string = typeof payload?.text === "string" ? payload.text.trim() : "";
  if (!text) return json({ translated: null });

  let resp: Response;
  try {
    resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1024, temperature: 0.1, system: SYSTEM,
        messages: [{ role: "user", content: text.slice(0, 4000) }],
      }),
    });
  } catch (e) {
    return json({ error: "Falha ao contatar a IA", detail: String(e) }, 503);
  }

  if (resp.status === 429) return json({ error: "Rate limit da IA" }, 429);
  if (!resp.ok) {
    const t = await resp.text();
    return json({ error: "Erro na IA", detail: t.slice(0, 300) }, resp.status >= 500 ? 503 : 500);
  }

  let out: any;
  try {
    const data = await resp.json();
    const outText = (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    out = extractJson(outText);
  } catch (e) {
    return json({ error: "Resposta da IA ilegível", detail: String(e) }, 500);
  }

  return json({ translated: typeof out.translated === "string" && out.translated.trim() ? out.translated.trim() : null });
});
