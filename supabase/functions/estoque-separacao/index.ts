// estoque-separacao — porta HTTP da FILA DE SEPARAÇÃO do VP Estoque (celular dos almoxarifes, estoque.vpsistema.com).
//
// O celular nunca fala com o Omie: ele lê os pedidos de venda que o HUB já trouxe (pcp_pedidos, etapa 20) e devolve aqui o que separou.
// Separar NÃO baixa estoque (a NF de saída baixa, e só é pedida pela expedição quando o cliente retira). O hub só registra
// "separado, aguardando NF". Esta função: 1) limita a taxa; 2) confere o token no Auth do vpsistema; 3) chama a função SQL
// `estoque_separacao_chamar(email, acao, args)` com a chave de serviço (a alçada `estoque.saida` é conferida no SQL). Só transporte.
//
// Contrato (POST, Authorization: Bearer <access_token do vpsistema>, Content-Type: application/json):
//   { "acao": "<nome>", ...argumentos }  ->  200 { "ok": true, "dados": <resposta da ação> }
//   Ações e argumentos:
//     fila                                          -> { pedidos: [{ codigo_pedido, numero_pedido, cliente, data_previsao, itens, separados, status, pego_por, pego_em }] }
//     itens   { codigo_pedido }                     -> { pedido, itens: [{ seq, codigo, descricao, unidade, qtd_pedida, qtd_separada, enderecos: [..] }] }
//     pegar   { codigo_pedido }                     (erro se já estiver com outra pessoa)
//     assumir { codigo_pedido }                     (toma o pedido de quem está separando; fica no histórico)
//     soltar  { codigo_pedido }                     (devolve à fila; só quem pegou, ou quem tem alçada `revisar`)
//     separar { codigo_pedido, codigo, quantidade, endereco }   (quantidade é DELTA; endereço precisa existir em estoque_enderecos)
//     concluir { codigo_pedido, forcar? }           (com falta só conclui se `forcar` = true)
//     chegadas                                      -> { chegadas: [{ codigo_pedido, itens_faltando, aguardando_chegada, sem_previsao, proxima_chegada }] }
//     chegadas { codigo_pedido }                    -> { chegadas: [{ codigo, pedida, fisico, situacao, a_caminho, chegou_sem_nota, comprado_pi, proxima_chegada, embarque }] }
//                                                      (só leitura: estoque físico do Omie × quantidade pedida × importação por chegar)
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

const ACOES = new Set(["fila", "itens", "pegar", "assumir", "soltar", "separar", "concluir", "chegadas"]);
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
    const t = await rpc("api_rate_check", { p_bucket: "estoque-separacao", p_ip: ip, p_max_ip: 120, p_max_global: 600, p_janela_s: 600 });
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
    const r = acao === "chegadas"
      ? await rpc("estoque_separacao_chegadas", { p_email: email, p_codigo_pedido: args.codigo_pedido ? Number(args.codigo_pedido) : null })
      : await rpc("estoque_separacao_chamar", { p_email: email, p_acao: acao, p_args: args });
    if (!r.ok) {
      const msg = String(r.data?.message || "falha ao executar a ação");
      if (r.status >= 500 && !/^estoque:/.test(msg)) return resp(req, { error: "falha ao executar a ação" }, 502);
      return resp(req, { error: msg }, /não tem alçada/.test(msg) ? 403 : 400);
    }
    return resp(req, { ok: true, dados: r.data });
  } catch (e) {
    console.error("[estoque-separacao]", (e as Error).message);
    return resp(req, { error: "falha ao processar o pedido" }, 502);
  }
});
