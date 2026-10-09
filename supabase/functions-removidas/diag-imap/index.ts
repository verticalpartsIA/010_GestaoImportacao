// BACKUP — função removida do Supabase em 01/10/2026 (ClaudeNotebook, issue #572).
// Diagnóstico temporário de IMAP que ficou deployado sem código no repo. NÃO redeployar.
// Diagnóstico temporário — conecta via Deno.connectTls cru (sem lib IMAP)
// no imap.hostinger.com:993 e lê o banner de saudação, pra isolar se o
// problema é de rede/servidor ou da lib ImapFlow. Apagar depois de usar.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const HOST = Deno.env.get("IMAP_HOST") || "imap.hostinger.com";
  const PORT = Number(Deno.env.get("IMAP_PORT") || "993");
  const steps: string[] = [];
  try {
    steps.push(`conectando TLS em ${HOST}:${PORT}...`);
    const conn = await Deno.connectTls({ hostname: HOST, port: PORT });
    steps.push("TLS conectado, lendo banner...");
    const buf = new Uint8Array(1024);
    const readPromise = conn.read(buf);
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 8s esperando banner")), 8000));
    const n = await Promise.race([readPromise, timeout]) as number | null;
    const banner = n ? new TextDecoder().decode(buf.subarray(0, n)) : "(sem dados lidos)";
    steps.push(`banner recebido: ${JSON.stringify(banner)}`);
    conn.close();
    return new Response(JSON.stringify({ ok: true, steps }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    steps.push(`erro: ${String((e as Error)?.message || e)}`);
    return new Response(JSON.stringify({ ok: false, steps, error: String((e as Error)?.stack || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
