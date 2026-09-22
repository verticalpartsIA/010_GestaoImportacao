// ============================================================
// ncm-duimp-assist — Edge Function (vpprd) — FASE 2 (IA real, Claude com visão)
// Mesmo contrato §4 do stub. Chave em secret do Supabase (ANTHROPIC_API_KEY).
// ============================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = "claude-sonnet-4-6"; // sobe p/ claude-opus-4-8 se quiser máxima precisão fiscal
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

const SYSTEM = `Você é um especialista brasileiro em classificação fiscal NCM e em descrição de mercadoria para a DUIMP (Siscomex).
Domina a TEC/TIPI, as Notas Explicativas do Sistema Harmonizado (NESH), as Regras Gerais de Interpretação (RGI) e as Soluções de Consulta da Receita.

PRINCÍPIOS:
- DECIDA e entregue forte: recomende UM NCM (8 dígitos, formato 0000.00.00) e escreva a descrição DUIMP pronta para uso.
- A dúvida não vai na cara do usuário: a tese contrária vai em "antitese".
- Para PEÇAS dedicadas a uma máquina, considere a Nota 2 da Seção XVI: 2(a) aparelho com posição própria vai à sua posição; 2(b) peça reconhecidamente exclusiva vai à posição da máquina (ex.: partes de elevador 8431.31).
- Se faltar dado decisivo (insumo, função, se é parte de quê, forma), NÃO chute: devolva "perguntas_desempate" pedindo exatamente o que falta.
- Use as imagens (quando houver) para confirmar material e forma.

REDAÇÃO DA DESCRIÇÃO DUIMP (descricao_duimp):
- É o texto oficial do item na declaração de importação — precisa ser tecnicamente completo, não uma frase genérica. É o que a Receita usa pra identificar o produto e decidir o tratamento aduaneiro/tributário/administrativo correto (mesma lógica dos atributos estruturados de NCM).
- Incorpore OBRIGATORIAMENTE cada atributo não vazio recebido em ficha.atributos — sem exceção, sem resumir ou descartar nenhum. Some a isso ficha.insumo, ficha.funcao_aplicacao, ficha.eh_parte_de, ficha.forma_estado, ficha.descricao_tecnica_manual e ficha.descricao_comercial (quando existirem).
- Estrutura sugerida: material/insumo predominante → denominação/função → aplicação específica → cada característica técnica relevante com sua unidade (dimensões, composição, tensão, capacidade, acabamento etc.) → vínculo com o equipamento maior quando for peça/parte ("eh_parte_de").
- Redação objetiva, técnica e assertiva — trate a classificação como decidida. Nunca use "possivelmente", "aparentemente", "pode ser", "talvez"; essas dúvidas vão para "antitese", não para a descrição.
- Português formal, terceira pessoa, sem adjetivos comerciais ou de marketing — é um campo fiscal, não uma vitrine de produto.

RESPONDA APENAS com um JSON válido, sem texto fora dele, no formato:
{"ncm_recomendado":"0000.00.00","confianca":0.0,"ncm_descricao":"...","descricao_duimp":"...","atributos_sugeridos":{},"perguntas_desempate":[{"pergunta_id":"...","texto":"...","opcoes":[]}],"justificativa":"...","antitese":"...","fontes":[{"titulo":"...","url":"..."}],"precisa_homologacao":true}
- confianca: float 0..1. perguntas_desempate vazio quando decidiu. precisa_homologacao SEMPRE true.`;

function extractJson(text: string): any {
  const a = text.indexOf("{"); const b = text.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(text.slice(a, b + 1));
  throw new Error("resposta da IA sem JSON");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  const KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!KEY) return json({ error: "IA indisponível: ANTHROPIC_API_KEY não configurada" }, 503);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido" }, 500); }

  const ficha = payload?.ficha ?? {};
  const imagens: string[] = Array.isArray(payload?.imagens) ? payload.imagens : [];
  const historico = Array.isArray(payload?.historico_desempate) ? payload.historico_desempate : [];

  const content: any[] = [];
  for (const img of imagens) {
    if (typeof img !== "string" || !img.startsWith("data:")) continue;
    const m = img.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (!m) continue;
    const media_type = m[1]; const b64 = m[2];
    if (Math.floor((b64.length * 3) / 4) > 5 * 1024 * 1024) return json({ error: "Imagem maior que 5MB" }, 413);
    content.push({ type: "image", source: { type: "base64", media_type, data: b64 } });
  }
  content.push({
    type: "text",
    text:
      "Classifique o produto abaixo (NCM + descrição DUIMP). Dados da ficha:\n" +
      JSON.stringify(ficha, null, 2) +
      (historico.length ? "\n\nRespostas de desempate já dadas:\n" + JSON.stringify(historico) : ""),
  });

  let resp: Response;
  try {
    resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      // `temperature` removido — a API da Anthropic passa a rejeitar esse
      // parâmetro pro modelo em uso (invalid_request_error: "temperature is
      // deprecated for this model"), quebrando toda chamada com 500. Ver
      // mesmo fix em vp-copiloto/index.ts (21/09).
      body: JSON.stringify({ model: MODEL, max_tokens: 4096, system: SYSTEM, messages: [{ role: "user", content }] }),
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

  // garante o contrato completo
  const result = {
    ncm_recomendado: out.ncm_recomendado ?? "",
    confianca: typeof out.confianca === "number" ? out.confianca : 0,
    ncm_descricao: out.ncm_descricao ?? "",
    descricao_duimp: out.descricao_duimp ?? "",
    atributos_sugeridos: out.atributos_sugeridos ?? {},
    perguntas_desempate: Array.isArray(out.perguntas_desempate) ? out.perguntas_desempate : [],
    justificativa: out.justificativa ?? "",
    antitese: out.antitese ?? "",
    fontes: Array.isArray(out.fontes) ? out.fontes : [],
    precisa_homologacao: true,
  };
  return json(result);
});
