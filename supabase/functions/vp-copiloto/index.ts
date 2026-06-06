// ============================================================
// vp-copiloto — Edge Function (vpprd)
// Assistente global do VP Gestão. Acompanha o usuário em TODAS as telas.
// IA: Anthropic Claude (secret ANTHROPIC_API_KEY). Mesmo padrão da ncm-duimp-assist.
//
// 3 modos (campo "mode"):
//   • chat    → responde perguntas sobre a tela/sistema
//   • fill    → lê os campos da tela e devolve o que preencher; pergunta o que falta
//   • analyze → revisa o documento/preenchimento e aponta erros + sugestões
//
// Contrato de resposta (JSON):
//   { reply, fills?:[{idx,label,value}], questions?:[{id,text}],
//     issues?:[{severity,where,problem,suggestion}] }
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

const SYSTEM = `Você é o Copiloto VP, assistente de IA da VerticalParts dentro do sistema interno "VP Gestão"
(plataforma de importação, engenharia, comercial, jurídico e financeiro de equipamentos de transporte
vertical — elevadores, escadas e esteiras rolantes). Você acompanha o usuário em TODAS as telas.
Fala português do Brasil, com tom direto, cordial e prático. Trata o usuário como colega de equipe.

Você SEMPRE recebe o contexto da tela atual em "page":
- route: identificador da rota; title: título da tela.
- fields: lista dos campos do formulário visível. Cada campo tem:
  idx (índice estável), label (rótulo), type (text|select|textarea|number|date…),
  value (valor atual), options (valores válidos, quando select), required (true/false).
Quando houver, "documentText" traz o texto do documento/preview renderizado na tela.

Comporte-se conforme "mode":

• mode "chat":
  Responda à mensagem do usuário sobre a tela atual ou o sistema. Seja útil e objetivo.
  Se ele pedir para ir a outra tela, explique como (não navegue sozinho).

• mode "fill":
  O usuário quer que você PREENCHA o formulário da tela.
  - Use os dados fornecidos pelo usuário (mensagem atual + histórico da conversa) para preencher.
  - Só preencha campos que EXISTAM em page.fields; referencie cada um pelo "idx".
  - Para selects, "value" DEVE ser um dos valores em "options".
  - Para campos OBRIGATÓRIOS (ou claramente necessários) cujo valor você não tem como saber
    (ex.: CNPJ, razão social, endereço, valor do contrato), NÃO INVENTE. Em vez disso gere
    "questions" perguntando exatamente o que falta — perguntas curtas, específicas, uma por dado.
  - Em "fills" devolva apenas os campos que você consegue preencher com segurança AGORA.
  - "reply": resuma o que preencheu e/ou diga que precisa das respostas das perguntas.

• mode "analyze":
  O usuário quer que você REVISE o documento/preenchimento procurando erros.
  - Examine documentText + os valores dos campos. Aponte: dados faltando, inconsistências,
    valores suspeitos (datas, CNPJ, moeda), cláusulas problemáticas ou ambíguas, riscos.
  - Para cada achado gere um item em "issues" com:
    severity ("alta"|"media"|"baixa"), where (onde está), problem (o que está errado),
    suggestion (sugestão concreta de melhoria — pode propor um texto melhor).
  - Se estiver tudo certo, devolva issues vazio e diga isso em "reply".
  - Liste no máximo os ~10 achados MAIS RELEVANTES (prioridade alta > média > baixa),
    para manter a resposta concisa e dentro do limite de tokens.

REGRAS DE SAÍDA (obrigatórias):
- Responda APENAS com um único JSON válido, sem nenhum texto fora dele, sem markdown, sem cercas.
- Formato:
  {"reply":"...","fills":[{"idx":0,"label":"...","value":"..."}],"questions":[{"id":"cnpj","text":"..."}],"issues":[{"severity":"alta","where":"...","problem":"...","suggestion":"..."}]}
- Inclua somente as chaves relevantes ao modo. "reply" é SEMPRE obrigatório (1 a 3 frases).
- Nunca invente CNPJ, valores, nomes ou datas: o que não souber, pergunte.`;

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

  const mode: string = ["chat", "fill", "analyze"].includes(payload?.mode) ? payload.mode : "chat";
  const message: string = typeof payload?.message === "string" ? payload.message : "";
  const history: any[] = Array.isArray(payload?.history) ? payload.history.slice(-12) : [];
  const page = payload?.page ?? {};
  const documentText: string = typeof payload?.documentText === "string"
    ? payload.documentText.slice(0, 12000) : "";

  // Monta as mensagens: histórico curto + o turno atual com todo o contexto da tela.
  const messages: any[] = [];
  for (const h of history) {
    const role = h?.role === "assistant" ? "assistant" : "user";
    const content = typeof h?.content === "string" ? h.content : "";
    if (content) messages.push({ role, content });
  }

  const ctx =
    `MODO: ${mode}\n` +
    `TELA ATUAL: ${JSON.stringify({ route: page.route ?? "", title: page.title ?? "" })}\n` +
    `CAMPOS DA TELA:\n${JSON.stringify(page.fields ?? [], null, 1)}\n` +
    (documentText ? `\nTEXTO DO DOCUMENTO NA TELA:\n"""${documentText}"""\n` : "") +
    `\nMENSAGEM DO USUÁRIO:\n${message || "(sem texto — use o modo e o contexto acima)"}`;
  messages.push({ role: "user", content: ctx });

  let resp: Response;
  try {
    resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 4096, temperature: 0.2, system: SYSTEM, messages }),
    });
  } catch (e) {
    return json({ error: "Falha ao contatar a IA", detail: String(e) }, 503);
  }

  if (resp.status === 429) {
    const ra = resp.headers.get("retry-after") ?? "";
    return json({ error: "Rate limit da IA" }, 429, ra ? { "Retry-After": ra } : {});
  }
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

  // Normaliza o contrato — devolve sempre as chaves, vazias quando não se aplicam.
  return json({
    reply: typeof out.reply === "string" ? out.reply : "",
    fills: Array.isArray(out.fills) ? out.fills : [],
    questions: Array.isArray(out.questions) ? out.questions : [],
    issues: Array.isArray(out.issues) ? out.issues : [],
  });
});
