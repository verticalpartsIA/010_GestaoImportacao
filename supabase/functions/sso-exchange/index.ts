// sso-exchange — troca o login do vpsistema por uma sessão do vpprd (segurança real, issue #571, caminho B).
//
// Fluxo: o navegador manda o access_token do vpsistema (Authorization: Bearer ...). A função
//   1) pergunta ao Auth do vpsistema se o token é válido (/auth/v1/user) — assim sessão revogada não passa;
//   2) exige que o e-mail exista e esteja ativo em `perfis` (vp_email_ativo);
//   3) gera (sem enviar e-mail) um link mágico do vpprd e devolve só o `token_hash`;
//   4) o front troca o token_hash por uma sessão nativa do vpprd (supabase.auth.verifyOtp).
// Nenhum segredo vai ao navegador. A chave "anon" do vpsistema abaixo é PÚBLICA (a mesma de src/supabase.js).
//
// verify_jwt = false de propósito: quem chama traz um token do VPSISTEMA, que o gateway do vpprd não reconhece.
// A validação é feita aqui dentro. Sem supabase-js (import remoto já derrubou produção): fetch cru.

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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const svcHeaders = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);
  if (!SVC) return json({ error: "função sem chave de serviço" }, 500);

  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return json({ error: "token ausente" }, 401);

  // limite de taxa (por IP e global) — falha ao consultar = bloqueia
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconhecido";
  try {
    const r = await fetch(`${URL_SB}/rest/v1/rpc/api_rate_check`, {
      method: "POST", headers: svcHeaders,
      body: JSON.stringify({ p_bucket: "sso-exchange", p_ip: ip, p_max_ip: 60, p_max_global: 600, p_janela_s: 600 }),
    });
    if (!r.ok) return json({ error: "verificação de segurança indisponível" }, 503);
    if ((await r.json()) !== "ok") return json({ error: "muitas tentativas, aguarde" }, 429);
  } catch (_) {
    return json({ error: "verificação de segurança indisponível" }, 503);
  }

  // 1) o vpsistema reconhece este token?
  let email = "";
  try {
    const u = await fetch(`${VPS_URL}/auth/v1/user`, { headers: { apikey: VPS_ANON, Authorization: `Bearer ${tok}` } });
    if (!u.ok) return json({ error: "token inválido ou expirado" }, 401);
    email = String((await u.json()).email || "").trim().toLowerCase();
  } catch (_) {
    return json({ error: "não foi possível validar o login agora" }, 502);
  }
  if (!email) return json({ error: "token sem e-mail" }, 401);

  // 2) usuário ativo no vpprd?
  try {
    const ok = await fetch(`${URL_SB}/rest/v1/rpc/vp_email_ativo`, {
      method: "POST", headers: svcHeaders, body: JSON.stringify({ p_email: email }),
    });
    if (!ok.ok) return json({ error: "não foi possível conferir o acesso" }, 503);
    if ((await ok.json()) !== true) return json({ error: "sem acesso ao VP Gestão" }, 403);
  } catch (_) {
    return json({ error: "não foi possível conferir o acesso" }, 503);
  }

  // 3) link mágico sem envio de e-mail (cria o usuário Auth do vpprd na primeira vez)
  try {
    const g = await fetch(`${URL_SB}/auth/v1/admin/generate_link`, {
      method: "POST", headers: svcHeaders, body: JSON.stringify({ type: "magiclink", email }),
    });
    const body = await g.json().catch(() => ({}));
    const hash = body.hashed_token || body.properties?.hashed_token;
    if (!g.ok || !hash) return json({ error: "falha ao gerar sessão" }, 502);
    return json({ token_hash: hash, email });
  } catch (_) {
    return json({ error: "falha ao gerar sessão" }, 502);
  }
});
