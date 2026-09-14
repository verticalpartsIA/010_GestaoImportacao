// ============================================================
// sign-email-anexos — Edge Function (vpprd)
// Gera links assinados (signed URLs) pra anexos já salvos no bucket
// privado emails-anexos, pra download pela Inbox.
//
// 14/09 — achado real (auditoria campo-a-campo do tour.md): anexos da
// pasta "Enviados" nunca tinham link clicável (badge só com o nome do
// arquivo). Causa: o bucket emails-anexos só dá SELECT pra roles
// authenticated/service_role (RLS confirmado via SQL) — o app roda
// sempre como anon (não usa sessão Supabase Auth real, ver supabase.js),
// então o navegador nunca conseguiria assinar essas URLs sozinho. A
// Caixa de Entrada já contornava isso porque read-inbox assina no
// servidor (service role) antes de devolver pro cliente; "Enviados" lê
// emails_projeto direto do cliente e nunca passava por esse passo. Esta
// function replica exatamente o mesmo padrão de assinatura do
// read-inbox (mesmo bucket, mesma validade de 7 dias), só que sob
// demanda pra uma lista de paths — sem repetir toda a lógica de IMAP.
//
// Secrets: usa as mesmas SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY já
// configuradas no projeto (injetadas automaticamente pelo runtime).
//
// Body: { paths: string[] } — cada path é o campo `anexos[].path`
// gravado em emails_projeto (ex.: "saida/<uuid>/arquivo.pdf").
// Resposta: { ok: true, urls: { [path]: string | null } }
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const BUCKET = "emails-anexos";
const EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 dias — mesma validade do read-inbox
const MAX_PATHS_POR_CHAMADA = 100; // defesa simples contra payload absurdo

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  let body: { paths?: unknown };
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "JSON inválido no corpo da requisição" }, 400);
  }

  const paths = Array.isArray(body.paths) ? body.paths.filter((p) => typeof p === "string" && p.length > 0) : [];
  if (!paths.length) return json({ ok: true, urls: {} });
  if (paths.length > MAX_PATHS_POR_CHAMADA) {
    return json({ error: `Máximo de ${MAX_PATHS_POR_CHAMADA} anexos por chamada.` }, 400);
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const urls: Record<string, string | null> = {};
    await Promise.all(paths.map(async (path) => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, EXPIRY_SECONDS);
      if (error) { console.warn("[sign-email-anexos] falha ao assinar", path, error); urls[path] = null; return; }
      urls[path] = data?.signedUrl || null;
    }));
    return json({ ok: true, urls });
  } catch (e) {
    console.warn("[sign-email-anexos] falha geral", e);
    return json({ error: "Falha ao gerar links de anexo", detail: String((e as Error)?.message || e) }, 502);
  }
});
