// ============================================================
// vp-translate — Edge Function (vpprd)
// Tradutor técnico PT-BR → EN para documentos de importação/aduana
// (peças de elevadores, escadas e esteiras rolantes · contexto NCM/DUIMP).
// IA: Anthropic Claude (secret ANTHROPIC_API_KEY).
//
// Request:  { target?: "en", intro?, observacoes?, items: [
//             { k, denominacao, detalhamento, ncm_descricao, atributos:[{nome,valor}] } ] }
// Response: { intro_en, observacoes_en, items: [
//             { k, denominacao_en, detalhamento_en, ncm_descricao_en, atributos:[{nome_en,valor_en}] } ] }
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

const SYSTEM = `You are a professional technical translator (Brazilian Portuguese → English) for the
VerticalParts import/procurement department. The documents are purchase quotation requests (RFQ)
sent to suppliers (China, Germany, etc.) for parts of elevators, escalators and moving walkways.

RULES:
- Translate into clear, professional, industry-standard English used in international trade and customs.
- Keep technical accuracy (materials, dimensions, norms, mechanical/electrical terms).
- DO NOT translate or alter: NCM/HS codes, numbers, measurements, units (mm, kg, V, m/s…),
  SKU/internal codes, proper names, model codes. Keep them verbatim.
- Translate attribute LABELS and VALUES (e.g. "Material predominante" → "Predominant material",
  "Aço inoxidável" → "Stainless steel").
- If a field is empty, return an empty string for it.
- Preserve the "k" key of each item EXACTLY as received so the client can map back.

OUTPUT: respond with a SINGLE valid JSON object, no text outside it, no markdown, in this shape:
{"intro_en":"...","observacoes_en":"...","items":[{"k":"<same key>","denominacao_en":"...","detalhamento_en":"...","ncm_descricao_en":"...","atributos":[{"nome_en":"...","valor_en":"..."}]}]}`;

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

  const items: any[] = Array.isArray(payload?.items) ? payload.items : [];
  const intro: string = typeof payload?.intro === "string" ? payload.intro : "";
  const observacoes: string = typeof payload?.observacoes === "string" ? payload.observacoes : "";

  if (items.length === 0 && !intro && !observacoes) {
    return json({ intro_en: "", observacoes_en: "", items: [] });
  }

  const userContent =
    "Translate the following RFQ content to English. Keep the JSON structure and the 'k' keys.\n\n" +
    JSON.stringify({ intro, observacoes, items }, null, 1);

  let resp: Response;
  try {
    resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      // `temperature` removido — API Anthropic rejeita esse parâmetro pro
      // modelo em uso (invalid_request_error: "temperature is deprecated
      // for this model"). Ver mesmo fix em vp-copiloto/index.ts (21/09).
      body: JSON.stringify({
        model: MODEL, max_tokens: 4096, system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
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
    const text = (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    out = extractJson(text);
  } catch (e) {
    return json({ error: "Resposta da IA ilegível", detail: String(e) }, 500);
  }

  return json({
    intro_en: typeof out.intro_en === "string" ? out.intro_en : "",
    observacoes_en: typeof out.observacoes_en === "string" ? out.observacoes_en : "",
    items: Array.isArray(out.items) ? out.items : [],
  });
});
