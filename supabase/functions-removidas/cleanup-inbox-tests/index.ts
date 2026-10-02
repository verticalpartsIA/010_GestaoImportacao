// BACKUP — função removida do Supabase em 01/10/2026 (ClaudeNotebook, issue #572).
// Estava deployada sem código no repo e apagava e-mails reais da caixa suporte@vpsistema.com
// para qualquer chamador com a chave pública. NÃO redeployar.
// ============================================================
// cleanup-inbox-tests — uso Único, descartável
// Apaga da caixa real (vía IMAP) os e-mails de teste de tamanho criados
// durante o debug do limite de anexo (11/09) — estavam poluindo o Inbox
// de produção. Body: { uids: string[] } — UIDs IMAP a apagar.
// ============================================================
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

class ImapConn {
  conn: Deno.TlsConn; buf = new Uint8Array(0);
  constructor(c: Deno.TlsConn) { this.conn = c; }
  async fill() { const chunk = new Uint8Array(65536); const n = await this.conn.read(chunk); if (n === null) throw new Error("conexão fechada"); const m = new Uint8Array(this.buf.length + n); m.set(this.buf); m.set(chunk.subarray(0, n), this.buf.length); this.buf = m; }
  async readLine(): Promise<string> { while (true) { let idx = -1; for (let i = 0; i < this.buf.length - 1; i++) { if (this.buf[i] === 13 && this.buf[i + 1] === 10) { idx = i; break; } } if (idx >= 0) { const l = new TextDecoder("latin1").decode(this.buf.subarray(0, idx)); this.buf = this.buf.subarray(idx + 2); return l; } await this.fill(); } }
  async write(s: string) { await this.conn.write(new TextEncoder().encode(s)); }
}
function imapQuote(s: string) { return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }
async function readUntilTagged(c: ImapConn, tag: string) { const lines: string[] = []; while (true) { const l = await c.readLine(); lines.push(l); if (l.startsWith(tag + " ")) return lines; } }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const HOST = Deno.env.get("IMAP_HOST") || "imap.hostinger.com";
  const PORT = Number(Deno.env.get("IMAP_PORT") || "993");
  const USER = Deno.env.get("SMTP_USER"); const PASS = Deno.env.get("SMTP_PASS");
  if (!USER || !PASS) return json({ error: "sem credenciais" }, 503);
  let payload: any = {}; try { payload = await req.json(); } catch {}
  const uids: string[] = Array.isArray(payload?.uids) ? payload.uids.map(String) : [];
  if (!uids.length) return json({ error: "informe uids: string[]" }, 400);

  const tls = await Deno.connectTls({ hostname: HOST, port: PORT });
  const c = new ImapConn(tls);
  try {
    await c.readLine();
    await c.write(`a1 LOGIN ${imapQuote(USER)} ${imapQuote(PASS)}\r\n`);
    await readUntilTagged(c, "a1");
    await c.write(`a2 SELECT INBOX\r\n`);
    await readUntilTagged(c, "a2");
    await c.write(`a3 UID STORE ${uids.join(",")} +FLAGS (\\Deleted)\r\n`);
    const storeLines = await readUntilTagged(c, "a3");
    await c.write(`a4 EXPUNGE\r\n`);
    const expungeLines = await readUntilTagged(c, "a4");
    await c.write(`a5 LOGOUT\r\n`).catch(() => {});
    return json({ ok: true, uids, store: storeLines.join(" | "), expunge: expungeLines.join(" | ") });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 502);
  } finally {
    try { tls.close(); } catch {}
  }
});
