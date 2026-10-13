// estoque-revisao — porta HTTP da REVISÃO do VP Estoque (telas de gestão no app 013_Estoque, estoque.vpsistema.com).
//
// Quem revisa (alçada `estoque.revisar`) manda o access_token do login do vpsistema e uma ação. Esta função:
//   1) limita a taxa (por IP e global; falha ao consultar = bloqueia);
//   2) pergunta ao Auth do vpsistema se o token é válido (/auth/v1/user);
//   3) chama a função SQL `estoque_revisao_chamar(email, acao, args)` com a chave de serviço. O SQL confere a alçada de
//      novo e repassa às funções estoque_* (resumo, decidir, aprovar, fechar…). Aqui só há transporte — nenhuma regra.
//
// Contrato (POST, Authorization: Bearer <access_token do vpsistema>, Content-Type: application/json):
//   { "acao": "<nome>", ...argumentos }  ->  200 { "ok": true, "dados": <resposta da ação> }
//   Ações e argumentos:
//     sessoes                                              -> { sessoes: [{ id, nome, tipo, estado, criado_em, total_itens, contados, eventos_pendentes, … }] }
//     resumo      { sessao_id, situacoes?: [..] }          -> { sessao, contagem: {situacao: n}, itens: [{ codigo, saldo_omie, contado_r1, contado_r2, quantidade_apurada, diferenca, divergente, situacao, … }] }
//     leituras    { sessao_id, codigo }                    -> { leituras: [{ id, quantidade, rodada, usuario, status, recebido_em, … }] }
//     abrir       { tipo, nome?, escopo?, limite?, tolerancia?, recontagem_obrigatoria? } -> { sessao_id }   (alçada `abrir_sessao`)
//     recontagem  { sessao_id, codigos: [..] }             -> { itens: n }        (coleta precisa estar `aberta`)
//     decidir     { sessao_id, codigo, decisao: aceito|justificado|zero|manual, quantidade?, justificativa? }
//     justificar_nao_contados { sessao_id, justificativa }
//     rejeitar    { ids: [uuid], motivo }                  (motivo obrigatório)
//     estado      { sessao_id, estado: aberta|em_revisao }
//     aprovar     { sessao_id, codigos?: [..] }            -> { aprovados, pulados: [{codigo, motivo}] }   (alçada `aprovar`; grava no hub)
//     fechar      { sessao_id }                            (alçada `aprovar`; só com tudo aprovado ou justificado)
//   Erros: 401 token ausente/inválido · 403 sem alçada · 400 regra/pedido inválido (mensagem em `error`) · 413 corpo grande ·
//          429 limite · 502/503 indisponível.
//
// verify_jwt = false de propósito: quem chama traz um token do VPSISTEMA, que o gateway do hub não reconhece.
// Sem supabase-js (import remoto já derrubou produção): fetch cru. A chave "anon" do vpsistema é PÚBLICA (a de src/supabase.js).

const VPS_URL = "https://ubdkoqxfwcraftesgmbw.supabase.co";
const VPS_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZGtvcXhmd2NyYWZ0ZXNnbWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjUwMjcsImV4cCI6MjA5MDY0MTAyN30.s1A15nFQVne94gbz0511L2IYvHdTcgYeL0H8YU80iI8";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
function chaveServico(): string {
  try {
    const m = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    if (m.default) return m.default;
  } catch (_) { /* cai no padrão antigo */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
const SVC = chaveServico();
const svcHeaders = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" };

const ACOES = new Set([
  "sessoes", "resumo", "leituras", "abrir", "recontagem", "decidir",
  "justificar_nao_contados", "rejeitar", "estado", "aprovar", "fechar",
]);
const MAX_BYTES = 200_000;

function corsHeaders(req: Request): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  const o = req.headers.get("origin") || "";
  if (o === "https://estoque.vpsistema.com" || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) {
    h["Access-Control-Allow-Origin"] = o;
  }
  return h;
}
function resp(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}
async function rpc(nome: string, args: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetch(`${URL_SB}/rest/v1/rpc/${nome}`, { method: "POST", headers: svcHeaders, body: JSON.stringify(args) });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return resp(req, { error: "método não permitido" }, 405);
  if (!SVC) return resp(req, { error: "função sem chave de serviço" }, 500);

  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return resp(req, { error: "token ausente" }, 401);
  if (Number(req.headers.get("content-length") || 0) > MAX_BYTES) return resp(req, { error: "pedido grande demais" }, 413);

  // 1) limite de taxa — falha ao consultar = bloqueia
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconhecido";
  try {
    const t = await rpc("api_rate_check", { p_bucket: "estoque-revisao", p_ip: ip, p_max_ip: 120, p_max_global: 600, p_janela_s: 600 });
    if (!t.ok) return resp(req, { error: "verificação de segurança indisponível" }, 503);
    if (t.data !== "ok") return resp(req, { error: "muitas requisições, aguarde um instante" }, 429);
  } catch (_) {
    return resp(req, { error: "verificação de segurança indisponível" }, 503);
  }

  // 2) o vpsistema reconhece este token?
  let email = "";
  try {
    const u = await fetch(`${VPS_URL}/auth/v1/user`, { headers: { apikey: VPS_ANON, Authorization: `Bearer ${tok}` } });
    if (u.status === 401 || u.status === 403) return resp(req, { error: "token inválido ou expirado" }, 401);
    if (!u.ok) return resp(req, { error: "não foi possível validar o login agora" }, 502);
    email = String((await u.json()).email || "").trim().toLowerCase();
  } catch (_) {
    return resp(req, { error: "não foi possível validar o login agora" }, 502);
  }
  if (!email) return resp(req, { error: "token sem e-mail" }, 401);

  // 3) corpo e ação
  let body: any;
  try {
    const texto = await req.text();
    if (texto.length > MAX_BYTES) return resp(req, { error: "pedido grande demais" }, 413);
    body = JSON.parse(texto);
  } catch (_) {
    return resp(req, { error: "JSON inválido" }, 400);
  }
  if (!body || typeof body !== "object") return resp(req, { error: "JSON inválido" }, 400);
  const acao = String(body.acao || "");
  if (!ACOES.has(acao)) return resp(req, { error: "ação desconhecida" }, 400);
  const { acao: _a, ...args } = body;

  try {
    const r = await rpc("estoque_revisao_chamar", { p_email: email, p_acao: acao, p_args: args });
    if (!r.ok) {
      const msg = String(r.data?.message || "falha ao executar a ação");
      if (r.status >= 500 && !/^estoque:/.test(msg)) return resp(req, { error: "falha ao executar a ação" }, 502);
      return resp(req, { error: msg }, /não tem alçada/.test(msg) ? 403 : 400);
    }
    return resp(req, { ok: true, dados: r.data });
  } catch (e) {
    console.error("[estoque-revisao]", (e as Error).message);
    return resp(req, { error: "falha ao processar o pedido" }, 502);
  }
});
