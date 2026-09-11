// ============================================================
// read-inbox — Edge Function (vpprd)
// Lê as mensagens mais recentes da caixa suporte@vpsistema.com via IMAP,
// persiste em emails_projeto (idempotente por UID), extrai anexos reais
// pro bucket emails-anexos, e tenta vincular cada uma a um projeto
// (numero_cotacao).
//
// 10/09 — a lib npm "imapflow" fecha a conexão logo após o TLS neste
// runtime ("ClosedAfterConnectTLS") — confirmado via teste isolado que a
// rede/host/porta estão corretos. Então o protocolo IMAP é falado à mão
// aqui, só com Deno.connectTls — sem dependência de socket de terceiro.
//
// 11/09 — achado real do usuário: depois de mandar/receber mensagens
// grandes (testes de limite de anexo do send-email), o Inbox inteiro
// parou de carregar ("Erro na conexão", lista vazia) — os dados
// continuavam no banco, mas a FUNÇÃO TODA travava (WORKER_RESOURCE_LIMIT)
// só porque UMA mensagem grande estava no lote sendo processado, e o
// processamento é sequencial — uma mensagem estourando derruba a
// resposta inteira, nenhuma das outras aparece. Corrigido com checagem
// de tamanho em 2 fases: primeiro busca só UID/FLAGS/RFC822.SIZE/header
// (barato), só baixa o corpo inteiro (BODY.PEEK[]) se a mensagem for
// menor que SIZE_LIMIT_BYTES — mensagem grande vira um resumo com aviso,
// nunca mais derruba o lote inteiro. Protege contra QUALQUER e-mail
// grande futuro (fornecedor mandando anexo pesado), não só os testes.
//
// Vínculo a projeto (duas camadas, nunca finge certeza que não tem):
//   'certo'    — In-Reply-To/References bate com Message-ID que o
//                 PRÓPRIO site mandou.
//   'provavel' — fallback por regex no assunto, validado contra
//                 numero_cotacao real existente.
//
// Secrets: IMAP_HOST, IMAP_PORT (default 993), reaproveita SMTP_USER/
// SMTP_PASS. Body opcional: { limit?: number }
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

/* ---------- Transporte IMAP cru (só Deno.connectTls) ---------- */
class ImapConn {
  conn: Deno.TlsConn;
  buf: Uint8Array = new Uint8Array(0);
  constructor(conn: Deno.TlsConn) { this.conn = conn; }
  async fill() {
    const chunk = new Uint8Array(65536);
    const n = await this.conn.read(chunk);
    if (n === null) throw new Error("conexão fechada pelo servidor");
    const merged = new Uint8Array(this.buf.length + n);
    merged.set(this.buf); merged.set(chunk.subarray(0, n), this.buf.length);
    this.buf = merged;
  }
  async readLine(): Promise<string> {
    while (true) {
      let idx = -1;
      for (let i = 0; i < this.buf.length - 1; i++) { if (this.buf[i] === 13 && this.buf[i + 1] === 10) { idx = i; break; } }
      if (idx >= 0) {
        const line = new TextDecoder("latin1").decode(this.buf.subarray(0, idx));
        this.buf = this.buf.subarray(idx + 2);
        return line;
      }
      await this.fill();
    }
  }
  async readExact(n: number): Promise<Uint8Array> {
    while (this.buf.length < n) await this.fill();
    const out = this.buf.subarray(0, n);
    this.buf = this.buf.subarray(n);
    return out;
  }
  async write(s: string) { await this.conn.write(new TextEncoder().encode(s)); }
}

function imapQuote(s: string) { return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }

async function readUntilTagged(c: ImapConn, tag: string): Promise<string[]> {
  const lines: string[] = [];
  while (true) {
    const line = await c.readLine();
    lines.push(line);
    if (line.startsWith(tag + " ")) return lines;
  }
}

/* Genérico: lê uma resposta FETCH inteira, capturando FLAGS/UID/
   RFC822.SIZE de qualquer linha, e o ÚNICO literal ({n}) que aparecer
   (seja BODY.PEEK[HEADER] ou BODY.PEEK[] — o call-site escolhe qual
   pedir). */
async function readFetchOne(c: ImapConn, tag: string): Promise<{ flags: string; uid: string; size: number; source: Uint8Array | null }> {
  let flags = "", uid = "", size = 0, source: Uint8Array | null = null;
  while (true) {
    const line = await c.readLine();
    const flagsM = line.match(/FLAGS \(([^)]*)\)/);
    if (flagsM) flags = flagsM[1];
    const uidM = line.match(/\bUID (\d+)/);
    if (uidM) uid = uidM[1];
    const sizeM = line.match(/RFC822\.SIZE (\d+)/);
    if (sizeM) size = parseInt(sizeM[1], 10);
    const lit = line.match(/\{(\d+)\}\s*$/);
    if (lit) {
      source = await c.readExact(parseInt(lit[1], 10));
      continue;
    }
    if (line.startsWith(tag + " ")) return { flags, uid, size, source };
  }
}

/* ---------- Parser MIME mínimo (sem lib externa) ---------- */
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, "");
  const bin = atob(clean);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
function quotedPrintableToBytes(s: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "=" && i + 1 < s.length) {
      if (s[i + 1] === "\r" && s[i + 2] === "\n") { i += 2; continue; }
      if (s[i + 1] === "\n") { i += 1; continue; }
      const hex = s.substr(i + 1, 2);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) { bytes.push(parseInt(hex, 16)); i += 2; continue; }
    }
    bytes.push(s.charCodeAt(i) & 0xff);
  }
  return new Uint8Array(bytes);
}
function latin1ToBytes(s: string): Uint8Array { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xff; return a; }
function decodeHeaderValue(v: string): string {
  return v.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m, charset, enc, data) => {
    try {
      const bytes = enc.toUpperCase() === "B" ? base64ToBytes(data) : quotedPrintableToBytes(data.replace(/_/g, " "));
      return new TextDecoder(charset.toLowerCase()).decode(bytes);
    } catch { return data; }
  });
}
function decodeFilename(v: string): string {
  const m = v.match(/^[^']*'[^']*'(.+)$/);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }
  return decodeHeaderValue(v.replace(/^"|"$/g, ""));
}
function parseHeaders(headerText: string): Record<string, string> {
  const lines = headerText.split(/\r\n/);
  const headers: Record<string, string> = {};
  let lastKey = "";
  for (const line of lines) {
    if (/^[ \t]/.test(line) && lastKey) { headers[lastKey] += " " + line.trim(); continue; }
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    lastKey = line.slice(0, idx).trim().toLowerCase();
    headers[lastKey] = line.slice(idx + 1).trim();
  }
  return headers;
}
function parsePart(raw: string) {
  const sep = raw.indexOf("\r\n\r\n");
  const headerText = sep >= 0 ? raw.slice(0, sep) : raw;
  const body = sep >= 0 ? raw.slice(sep + 4) : "";
  const headers = parseHeaders(headerText);
  const ct = headers["content-type"] || "text/plain";
  const contentType = (ct.match(/^([^;]+)/)?.[1] || "text/plain").trim().toLowerCase();
  const charset = ct.match(/charset="?([^";]+)"?/i)?.[1] || "utf-8";
  const boundary = ct.match(/boundary="?([^";]+)"?/i)?.[1];
  const encoding = (headers["content-transfer-encoding"] || "7bit").toLowerCase();
  const cd = headers["content-disposition"] || "";
  const filenameRaw = cd.match(/filename\*?=\s*"?([^";]+)"?/i)?.[1] || ct.match(/name\*?=\s*"?([^";]+)"?/i)?.[1] || null;
  return { contentType, charset, boundary, encoding, headers, body, isAttachment: /attachment/i.test(cd), filename: filenameRaw ? decodeFilename(filenameRaw) : null };
}
function splitBody(body: string, boundary: string): string[] {
  const delim = "--" + boundary;
  return body.split(delim).slice(1, -1).map((p) => p.replace(/^\r\n/, ""));
}

type Extracted = { text: string; html: string; attachments: { filename: string; contentType: string; bytes: Uint8Array }[] };
function extractParts(raw: string, depth = 0): Extracted {
  if (depth > 6) return { text: "", html: "", attachments: [] };
  const part = parsePart(raw);
  if (part.contentType.startsWith("multipart/") && part.boundary) {
    let text = "", html = "";
    const attachments: Extracted["attachments"] = [];
    for (const sp of splitBody(part.body, part.boundary)) {
      const r = extractParts(sp, depth + 1);
      if (r.text && !text) text = r.text;
      if (r.html && !html) html = r.html;
      attachments.push(...r.attachments);
    }
    return { text, html, attachments };
  }
  let decoded: Uint8Array;
  if (part.encoding === "base64") decoded = base64ToBytes(part.body);
  else if (part.encoding === "quoted-printable") decoded = quotedPrintableToBytes(part.body);
  else decoded = latin1ToBytes(part.body);

  const ehAnexo = part.filename && (part.isAttachment || !part.contentType.startsWith("text/"));
  if (ehAnexo) return { text: "", html: "", attachments: [{ filename: part.filename!, contentType: part.contentType, bytes: decoded }] };

  let content = "";
  try { content = new TextDecoder(part.charset).decode(decoded); } catch { try { content = new TextDecoder("utf-8").decode(decoded); } catch { content = part.body; } }
  return part.contentType === "text/html" ? { text: "", html: content, attachments: [] } : { text: content, html: "", attachments: [] };
}
function parseFromHeader(v: string): { email: string; name: string } {
  const m = v.match(/<([^>]+)>/);
  const email = (m ? m[1] : v).trim();
  const name = decodeHeaderValue((m ? v.slice(0, m.index) : "").replace(/^"|"$/g, "").trim());
  return { email, name };
}
function parseEnderecos(v: string): string[] {
  if (!v) return [];
  return v.split(",").map((part) => {
    const m = part.match(/<([^>]+)>/);
    return (m ? m[1] : part).trim();
  }).filter(Boolean);
}
function parseReferenciaId(headers: Record<string, string>): string | null {
  const inReplyTo = headers["in-reply-to"];
  if (inReplyTo) { const m = inReplyTo.match(/<[^>]+>/); if (m) return m[0]; }
  const refs = headers["references"];
  if (refs) { const all = refs.match(/<[^>]+>/g); if (all && all.length) return all[all.length - 1]; }
  return null;
}
function extrairNumeroCotacaoDoAssunto(subject: string): number | null {
  const m1 = subject.match(/VP[A-Z]{2,4}-(?:[A-Z]{1,3})?0*(\d{2,6})/);
  if (m1) return parseInt(m1[1], 10);
  const m2 = subject.match(/Cota[cç][aã]o\s*N[ºo]\.?\s*0*(\d{2,6})/i);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

/* 11/09 — mensagem é considerada "grande" acima disso; corpo não é
   baixado (só os headers), evitando o WORKER_RESOURCE_LIMIT que
   derrubava o lote inteiro. */
const SIZE_LIMIT_BYTES = 3 * 1024 * 1024;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  const HOST = Deno.env.get("IMAP_HOST") || "imap.hostinger.com";
  const PORT = Number(Deno.env.get("IMAP_PORT") || "993");
  const USER = Deno.env.get("SMTP_USER");
  const PASS = Deno.env.get("SMTP_PASS");
  if (!USER || !PASS) return json({ error: "IMAP não configurado — faltam secrets SMTP_USER/SMTP_PASS." }, 503);

  let payload: any = {};
  try { payload = await req.json(); } catch { /* body vazio ok */ }
  const limit = Math.min(Math.max(Number(payload?.limit) || 15, 1), 25);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let c: ImapConn | null = null;
  try {
    const tlsConn = await Deno.connectTls({ hostname: HOST, port: PORT });
    c = new ImapConn(tlsConn);
    await c.readLine();

    await c.write(`a1 LOGIN ${imapQuote(USER)} ${imapQuote(PASS)}\r\n`);
    const loginLines = await readUntilTagged(c, "a1");
    if (!loginLines[loginLines.length - 1].startsWith("a1 OK")) {
      return json({ error: "Login IMAP falhou — confira SMTP_USER/SMTP_PASS.", detail: loginLines.join(" | ") }, 401);
    }

    await c.write(`a2 SELECT INBOX\r\n`);
    const selectLines = await readUntilTagged(c, "a2");
    const existsLine = selectLines.find((l) => /^\* \d+ EXISTS/.test(l));
    const total = existsLine ? parseInt(existsLine.match(/^\* (\d+) EXISTS/)![1], 10) : 0;

    const mensagens: any[] = [];
    if (total > 0) {
      const from = Math.max(1, total - limit + 1);
      const seqs: number[] = [];
      for (let seq = total; seq >= from; seq--) seqs.push(seq);
      let ti = 3;
      for (const seq of seqs) {
        // Passo 1 (barato): UID/FLAGS/tamanho/só headers.
        const tagH = `a${ti++}`;
        await c.write(`${tagH} FETCH ${seq} (UID FLAGS RFC822.SIZE BODY.PEEK[HEADER])\r\n`);
        const { flags, uid, size, source: headerSrc } = await readFetchOne(c, tagH);
        if (!uid) continue;
        const headerLatin1 = headerSrc ? new TextDecoder("latin1").decode(headerSrc) : "";
        const headers = parseHeaders(headerLatin1);

        const fromParsed = parseFromHeader(headers["from"] || "");
        const toList = parseEnderecos(headers["to"] || "");
        const ccList = parseEnderecos(headers["cc"] || "");
        const subject = decodeHeaderValue(headers["subject"] || "(sem assunto)");
        const dataMsg = headers["date"] ? new Date(headers["date"]) : null;
        const messageIdHeader = (headers["message-id"] || "").match(/<[^>]+>/)?.[0] || null;
        const referenciaId = parseReferenciaId(headers);

        // Passo 2 (só se couber): corpo inteiro + anexos. Mensagem grande
        // vira um resumo com aviso, nunca derruba o lote inteiro.
        let text = "", html = "", attachments: Extracted["attachments"] = [];
        const grandeDemais = size > 0 && size > SIZE_LIMIT_BYTES;
        if (!grandeDemais) {
          const tagB = `a${ti++}`;
          await c.write(`${tagB} FETCH ${seq} (BODY.PEEK[])\r\n`);
          const { source } = await readFetchOne(c, tagB);
          if (source) {
            const rawLatin1 = new TextDecoder("latin1").decode(source);
            const extracted = extractParts(rawLatin1);
            text = extracted.text; html = extracted.html; attachments = extracted.attachments;
          }
        }

        let numeroCotacao: number | null = null;
        let vinculo: string | null = null;
        if (referenciaId) {
          const { data: pai } = await supabase.from("emails_projeto")
            .select("numero_cotacao").eq("message_id", referenciaId).eq("direcao", "saida").maybeSingle();
          if (pai && pai.numero_cotacao != null) { numeroCotacao = pai.numero_cotacao; vinculo = "certo"; }
        }
        if (numeroCotacao == null) {
          const candidato = extrairNumeroCotacaoDoAssunto(subject);
          if (candidato != null) {
            const { data: existe } = await supabase.from("formularios_elevador")
              .select("numero_cotacao").eq("numero_cotacao", candidato).limit(1).maybeSingle();
            if (existe) { numeroCotacao = candidato; vinculo = "provavel"; }
          }
        }

        const anexosSalvos: { filename: string; content_type: string; size: number; path: string }[] = [];
        for (const a of attachments) {
          const path = `entrada/${uid}/${a.filename}`;
          const { error: upErrAnexo } = await supabase.storage.from("emails-anexos")
            .upload(path, a.bytes, { contentType: a.contentType || "application/octet-stream", upsert: true });
          if (upErrAnexo) { console.warn("[read-inbox] upload anexo falhou", a.filename, upErrAnexo); continue; }
          anexosSalvos.push({ filename: a.filename, content_type: a.contentType, size: a.bytes.length, path });
        }

        const row = {
          numero_cotacao: numeroCotacao,
          direcao: "entrada",
          de_email: fromParsed.email,
          de_nome: fromParsed.name,
          para: [...toList, ...ccList],
          assunto: subject,
          corpo_texto: grandeDemais ? null : (text || null),
          corpo_html: grandeDemais ? null : (html ? html.slice(0, 50000) : null),
          message_id: messageIdHeader,
          in_reply_to: referenciaId,
          imap_uid: uid,
          vinculo_confianca: vinculo,
          lido: /\\Seen/.test(flags),
          data_mensagem: dataMsg ? dataMsg.toISOString() : null,
          anexos: anexosSalvos,
        };
        const { data: salvo, error: upErr } = await supabase.from("emails_projeto")
          .upsert(row, { onConflict: "imap_uid" }).select().maybeSingle();
        if (upErr) console.warn("[read-inbox] upsert falhou", uid, upErr);

        const anexosComUrl = await Promise.all(anexosSalvos.map(async (a) => {
          const { data: signed } = await supabase.storage.from("emails-anexos").createSignedUrl(a.path, 60 * 60 * 24 * 7);
          return { ...a, url: signed?.signedUrl || null };
        }));

        mensagens.push({
          id: (salvo && salvo.id) || uid,
          from: fromParsed.email,
          fromName: fromParsed.name,
          subject,
          date: dataMsg ? dataMsg.toISOString() : null,
          unread: !/\\Seen/.test(flags),
          preview: grandeDemais
            ? `[Mensagem de ${(size / 1024 / 1024).toFixed(1)}MB — grande demais pra abrir aqui; acesse direto pela caixa suporte@vpsistema.com]`
            : (text || html.replace(/<[^>]+>/g, " ")).trim().slice(0, 2000),
          html: grandeDemais ? null : (html ? html.slice(0, 20000) : null),
          numeroCotacao,
          vinculoConfianca: vinculo,
          anexos: anexosComUrl,
          to: toList,
          cc: ccList,
          grandeDemais,
        });
      }
    }

    await c.write(`a99 LOGOUT\r\n`).catch(() => {});
    mensagens.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return json({ ok: true, messages: mensagens, total });
  } catch (e) {
    console.warn("[read-inbox] falha IMAP", e);
    return json({ error: "Falha ao ler a caixa via IMAP", detail: String((e as Error)?.message || e) }, 502);
  } finally {
    try { (c as any)?.conn?.close(); } catch (_) { /* já pode ter caído sozinho */ }
  }
});
