// estoque-eventos — porta de entrada do app VP Estoque (013_Estoque, estoque.vpsistema.com) no hub.
//
// O app NUNCA grava no banco do hub direto. Ele manda o access_token do login do vpsistema e esta função:
//   1) limita a taxa (por IP e global; falha ao consultar = bloqueia);
//   2) pergunta ao Auth do vpsistema se o token é válido (/auth/v1/user) — sessão revogada não passa;
//   3) chama a função SQL com a chave de serviço, passando o e-mail JÁ validado. TODA regra de negócio
//      (alçada por e-mail, sessão aberta, código na lista congelada, limite de aparelhos, recontagem por outra
//      pessoa, finalidade da saída…) mora no SQL — migrations 20261013120000 e 20261013150000. Aqui só há transporte.
//
// Contrato (POST, Authorization: Bearer <access_token do vpsistema>, Content-Type: application/json):
//   { "eventos": [ { id(uuid), tipo, codigo, quantidade, sessao_id?, rodada?, endereco?, referencia?,
//                    finalidade?, aparelho?, lido_em?, observacao?, foto_url?, divergencia? } ] }   (até 500)
//     -> 200 { "resultados": [ { id, ok, duplicado?, erro? } ] }   (um evento com erro não derruba os outros;
//                                                                    reenviar o mesmo id é seguro — vira duplicado)
//   { "acao": "lista", "sessao_id": "<uuid>" }
//     -> 200 { "itens": [ { codigo, descricao, endereco, rodada_atual, recontar, contado_nesta_rodada } ] }   (SEM saldo)
//   Regras que o app precisa respeitar (o SQL devolve o erro por evento): `tipo` do evento = `tipo` da sessão (sessão de
//   'inventario' só aceita 'inventario'; de 'contagem', 'contagem'); contagem/inventário exigem `sessao_id` e código da lista
//   da sessão; recebimento/saída NÃO usam sessão (recebimento pede `referencia` ou `observacao`; saída pede `finalidade`);
//   recontagem (`rodada` > 1) tem de ser de OUTRA pessoa; `quantidade` é DELTA (correção/desfazer = negativo).
//   Erros: 401 token ausente/inválido · 400 pedido inválido/regra · 413 corpo grande · 429 limite · 502/503 indisponível.
//
// verify_jwt = false de propósito: quem chama traz um token do VPSISTEMA, que o gateway do hub não reconhece.
// A validação é feita aqui dentro. Sem supabase-js (import remoto já derrubou produção): fetch cru.
// A chave "anon" do vpsistema abaixo é PÚBLICA (a mesma de src/supabase.js e de sso-exchange).

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

const MAX_EVENTOS = 500;
const MAX_BYTES = 1_000_000; // 500 eventos com observação cabem folgados
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// CORS: só o app e o ambiente local de desenvolvimento leem a resposta no navegador
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

  const declarado = Number(req.headers.get("content-length") || 0);
  if (declarado > MAX_BYTES) return resp(req, { error: "pedido grande demais" }, 413);

  // 1) limite de taxa (por IP e global) — falha ao consultar = bloqueia
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconhecido";
  try {
    const t = await rpc("api_rate_check", { p_bucket: "estoque-eventos", p_ip: ip, p_max_ip: 300, p_max_global: 1500, p_janela_s: 600 });
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

  // 3) corpo
  let texto = "";
  try { texto = await req.text(); } catch (_) { return resp(req, { error: "corpo ilegível" }, 400); }
  if (texto.length > MAX_BYTES) return resp(req, { error: "pedido grande demais" }, 413);
  let body: any;
  try { body = JSON.parse(texto); } catch (_) { return resp(req, { error: "JSON inválido" }, 400); }
  if (!body || typeof body !== "object") return resp(req, { error: "JSON inválido" }, 400);

  try {
    // 3a) lista de itens da sessão, sem saldo (contagem cega)
    if (body.acao === "lista") {
      const sessao = String(body.sessao_id || "");
      if (!UUID.test(sessao)) return resp(req, { error: "sessao_id inválido" }, 400);
      const r = await rpc("estoque_sessao_lista_email", { p_email: email, p_sessao: sessao });
      if (!r.ok) return resp(req, { error: String(r.data?.message || "não foi possível ler a lista") }, r.status >= 500 ? 502 : 400);
      return resp(req, { itens: r.data ?? [] });
    }

    // 3b) lote de eventos
    if (!Array.isArray(body.eventos)) return resp(req, { error: "esperado { eventos: [...] }" }, 400);
    if (body.eventos.length === 0) return resp(req, { resultados: [] });
    if (body.eventos.length > MAX_EVENTOS) return resp(req, { error: `máximo de ${MAX_EVENTOS} eventos por envio` }, 400);
    const r = await rpc("estoque_registrar_eventos", { p_email: email, p_eventos: body.eventos });
    if (!r.ok) return resp(req, { error: String(r.data?.message || "falha ao registrar") }, r.status >= 500 ? 502 : 400);
    return resp(req, { resultados: r.data ?? [] });
  } catch (e) {
    console.error("[estoque-eventos]", (e as Error).message);
    return resp(req, { error: "falha ao processar o pedido" }, 502);
  }
});
