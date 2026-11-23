// ============================================================
// read-inbox — Edge Function (vpprd)
// TRANSIÇÃO DE CAIXA (09/11/2026): lê as DUAS caixas e junta numa lista só, para a tela do
// Inbox não precisar mudar:
//   - hub@verticalparts.com.br (principal)   → Microsoft Graph
//   - suporte@vpsistema.com (só recebendo)   → IMAP, o transporte antigo, mantido até desligar
// Se uma das duas falhar, a outra continua aparecendo (a resposta traz `fontes` com o estado de cada).
// Para desligar o suporte@ SEM redeploy: criar o secret LEITURA_SUPORTE=off.
//
// Persiste em emails_projeto (idempotente: imap_uid = UID do IMAP, ou "g:<id imutável Graph>"),
// extrai anexos reais pro bucket emails-anexos e vincula cada mensagem a uma cotação:
//   'certo'    — In-Reply-To/References bate com Message-ID que o PRÓPRIO site mandou.
//   'provavel' — fallback por regex no assunto, validado contra numero_cotacao real.
// Modo de teste: body { simular: true } lê e tenta vincular SEM gravar em emails_projeto,
// vp_logs nem Storage.
//
// Histórico do IMAP (mantido): o protocolo é falado à mão (Deno.connectTls) porque a lib imapflow
// fecha a conexão neste runtime; a mensagem grande (> 3 MB) vira um resumo com aviso em vez de derrubar
// o lote (WORKER_RESOURCE_LIMIT, 11/09).
// 09/11: o Storage recusa chave com acento ("InvalidKey") — o caminho do anexo usa nome só com ASCII;
// o nome original fica em `filename`.
//
// Secrets: AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET + SENDER_EMAIL (hub); IMAP_HOST, IMAP_PORT,
// SMTP_USER/SMTP_PASS (suporte). Body: { limit?: 1..25, simular?: boolean }
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

/* ================= utilitários comuns ================= */
function nomeSeguro(nome: string): string {
  const s = String(nome || "anexo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (s || "anexo").slice(0, 120);
}
function extrairNumeroCotacaoDoAssunto(subject: string): number | null {
  const m1 = subject.match(/VP[A-Z]{2,4}-(?:[A-Z]{1,3})?0*(\d{2,6})/);
  if (m1) return parseInt(m1[1], 10);
  const m2 = subject.match(/Cota[cç][aã]o\s*N[ºo]\.?\s*0*(\d{2,6})/i);
  if (m2) return parseInt(m2[1], 10);
  return null;
}
type Anexo = { filename: string; content_type: string; size: number; path: string };
type Vinculo = { numeroCotacao: number | null; vinculo: string | null; refId: string | null; refTipo: string | null };

/* Vínculo a cotação (igual nas duas caixas). 'certo' = Message-ID; 'provavel' só se 'certo' não achou nada. */
async function vincular(supabase: any, referenciaId: string | null, subject: string): Promise<Vinculo> {
  let numeroCotacao: number | null = null, vinculo: string | null = null, refId: string | null = null, refTipo: string | null = null;
  if (referenciaId) {
    const { data: pai } = await supabase.from("emails_projeto")
      .select("numero_cotacao, referencia_id, referencia_tipo").eq("message_id", referenciaId).eq("direcao", "saida").maybeSingle();
    if (pai && (pai.numero_cotacao != null || pai.referencia_id != null)) {
      numeroCotacao = pai.numero_cotacao ?? null; vinculo = "certo";
      refId = pai.referencia_id ?? null; refTipo = pai.referencia_tipo ?? null;
    }
  }
  if (vinculo == null) {
    const candidato = extrairNumeroCotacaoDoAssunto(subject);
    if (candidato != null) {
      const { data: existe } = await supabase.from("formularios_elevador")
        .select("numero_cotacao").eq("numero_cotacao", candidato).limit(1).maybeSingle();
      if (existe) { numeroCotacao = candidato; vinculo = "provavel"; }
    }
  }
  return { numeroCotacao, vinculo, refId, refTipo };
}

/* Grava a mensagem (upsert por imap_uid) e registra "E-mail recebido" em vp_logs só quando é NOVA. */
async function gravarEntrada(supabase: any, chave: string, row: Record<string, unknown>, fromName: string, fromEmail: string, subject: string, v: Vinculo): Promise<string | null> {
  const { data: jaExistia } = await supabase.from("emails_projeto").select("id").eq("imap_uid", chave).maybeSingle();
  const { data: salvo, error: upErr } = await supabase.from("emails_projeto").upsert(row, { onConflict: "imap_uid" }).select().maybeSingle();
  if (upErr) console.warn("[read-inbox] upsert falhou", chave, upErr);
  if (!jaExistia && salvo && !upErr) {
    const { error: logErr } = await supabase.from("vp_logs").insert({
      ator_nome: fromName || fromEmail || "Remetente externo",
      ator_setor: "externo",
      modulo: "Inbox de E-mail",
      acao: "E-mail recebido",
      alvo: subject,
      alvo_id: salvo.id,
      detalhe: { de_email: fromEmail, numero_cotacao: v.numeroCotacao, vinculo_confianca: v.vinculo },
    });
    if (logErr) console.warn("[read-inbox] vp_logs falhou", logErr);
  }
  return salvo?.id ?? null;
}

async function comUrl(supabase: any, anexos: Anexo[], simular: boolean) {
  if (simular) return anexos.map((a) => ({ ...a, url: null }));
  return await Promise.all(anexos.map(async (a) => {
    const { data: signed } = await supabase.storage.from("emails-anexos").createSignedUrl(a.path, 60 * 60 * 24 * 7);
    return { ...a, url: signed?.signedUrl || null };
  }));
}

/* ================= CAIXA 1: hub@ pela Microsoft Graph ================= */
let tokenCache: { token: string; expira: number } | null = null;
async function tokenGraph(): Promise<string> {
  if (tokenCache && tokenCache.expira > Date.now() + 60_000) return tokenCache.token;
  const tenant = Deno.env.get("AZURE_TENANT_ID") ?? "";
  const body = new URLSearchParams({
    client_id: Deno.env.get("AZURE_CLIENT_ID") ?? "",
    client_secret: Deno.env.get("AZURE_CLIENT_SECRET") ?? "",
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    const cod = String(j?.error_description ?? "").match(/AADSTS\d+/)?.[0] ?? j?.error ?? r.status;
    throw new Error(`login Microsoft recusado (${cod})`);
  }
  tokenCache = { token: j.access_token, expira: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return j.access_token;
}
async function graphGet(caminho: string, token: string) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${caminho}`, {
    headers: { Authorization: `Bearer ${token}`, Prefer: 'IdType="ImmutableId"' },
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
function b64Bytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/[^A-Za-z0-9+/=]/g, ""));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
function htmlParaTexto(h: string): string {
  return h
    .replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n").replace(/<\/t[dh]>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
async function hashCurto(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function refDosHeadersGraph(headers: { name: string; value: string }[]): string | null {
  const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n)?.value || "";
  const inReplyTo = h("in-reply-to");
  if (inReplyTo) { const m = inReplyTo.match(/<[^>]+>/); if (m) return m[0]; }
  const refs = h("references");
  if (refs) { const all = refs.match(/<[^>]+>/g); if (all && all.length) return all[all.length - 1]; }
  return null;
}
const ANEXO_LIMITE_BYTES = 2.5 * 1024 * 1024;

async function lerHub(supabase: any, limit: number, simular: boolean): Promise<{ mensagens: any[]; total: number }> {
  const CAIXA = (Deno.env.get("SENDER_EMAIL") ?? "").trim().toLowerCase();
  if (!CAIXA || !Deno.env.get("AZURE_TENANT_ID") || !Deno.env.get("AZURE_CLIENT_ID") || !Deno.env.get("AZURE_CLIENT_SECRET")) {
    throw new Error("Microsoft Graph não configurada (AZURE_* / SENDER_EMAIL)");
  }
  const token = await tokenGraph();
  const base = `/users/${encodeURIComponent(CAIXA)}/mailFolders/inbox`;
  const pasta = await graphGet(`${base}?$select=totalItemCount`, token);
  if (!pasta.ok) throw new Error(`abrir a caixa ${CAIXA}: ${(pasta.j as any)?.error?.code || pasta.status}`);
  const total = Number((pasta.j as any)?.totalItemCount) || 0;

  const campos = "id,internetMessageId,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,body,internetMessageHeaders";
  const lista = await graphGet(`${base}/messages?$top=${limit}&$orderby=receivedDateTime desc&$select=${campos}`, token);
  if (!lista.ok) throw new Error(`ler mensagens de ${CAIXA}: ${(lista.j as any)?.error?.code || lista.status}`);
  const itens: any[] = Array.isArray((lista.j as any)?.value) ? (lista.j as any).value : [];

  const mensagens: any[] = [];
  for (const m of itens) {
    const chave = `g:${m.id}`;
    const fromEmail = String(m.from?.emailAddress?.address ?? "").trim();
    const fromName = String(m.from?.emailAddress?.name ?? "").trim();
    const toList: string[] = (m.toRecipients ?? []).map((x: any) => x?.emailAddress?.address).filter(Boolean);
    const ccList: string[] = (m.ccRecipients ?? []).map((x: any) => x?.emailAddress?.address).filter(Boolean);
    const subject = String(m.subject ?? "(sem assunto)");
    const dataMsg = m.receivedDateTime ? new Date(m.receivedDateTime) : null;
    const referenciaId = refDosHeadersGraph(Array.isArray(m.internetMessageHeaders) ? m.internetMessageHeaders : []);

    const ehHtml = String(m.body?.contentType ?? "").toLowerCase() === "html";
    const conteudo = String(m.body?.content ?? "");
    const html = ehHtml ? conteudo : "";
    const text = ehHtml ? htmlParaTexto(conteudo) : conteudo;

    const v = await vincular(supabase, referenciaId, subject);

    const anexosSalvos: Anexo[] = [];
    const anexosIgnorados: string[] = [];
    if (m.hasAttachments) {
      const pastaAnexo = await hashCurto(chave);
      const la = await graphGet(`/users/${encodeURIComponent(CAIXA)}/messages/${encodeURIComponent(m.id)}/attachments?$select=id,name,contentType,size`, token);
      const lista2: any[] = Array.isArray((la.j as any)?.value) ? (la.j as any).value : [];
      for (const a of lista2) {
        if (a["@odata.type"] !== "#microsoft.graph.fileAttachment") continue;
        const nome = String(a.name || "anexo");
        const ctype = a.contentType || "application/octet-stream";
        if ((Number(a.size) || 0) > ANEXO_LIMITE_BYTES) { anexosIgnorados.push(nome); continue; }
        if (simular) { anexosSalvos.push({ filename: nome, content_type: ctype, size: Number(a.size) || 0, path: "(simulado)" }); continue; }
        const det = await graphGet(`/users/${encodeURIComponent(CAIXA)}/messages/${encodeURIComponent(m.id)}/attachments/${encodeURIComponent(a.id)}`, token);
        const b64 = (det.j as any)?.contentBytes;
        if (!det.ok || !b64) { anexosIgnorados.push(nome); continue; }
        const bytes = b64Bytes(b64);
        const path = `entrada/${pastaAnexo}/${nomeSeguro(nome)}`;
        const { error: upErr } = await supabase.storage.from("emails-anexos").upload(path, bytes, { contentType: ctype, upsert: true });
        if (upErr) { console.warn("[read-inbox] upload anexo falhou", nome, upErr); anexosIgnorados.push(nome); continue; }
        anexosSalvos.push({ filename: nome, content_type: ctype, size: bytes.length, path });
      }
    }

    let salvoId: string | null = null;
    if (!simular) {
      salvoId = await gravarEntrada(supabase, chave, {
        numero_cotacao: v.numeroCotacao,
        referencia_id: v.refId,
        referencia_tipo: v.refTipo,
        direcao: "entrada",
        de_email: fromEmail,
        de_nome: fromName,
        para: [...toList, ...ccList],
        assunto: subject,
        corpo_texto: text || null,
        corpo_html: html ? html.slice(0, 50000) : null,
        message_id: m.internetMessageId ?? null,
        in_reply_to: referenciaId,
        imap_uid: chave,
        vinculo_confianca: v.vinculo,
        lido: m.isRead === true,
        data_mensagem: dataMsg ? dataMsg.toISOString() : null,
        anexos: anexosSalvos,
      }, fromName, fromEmail, subject, v);
    }

    mensagens.push({
      id: salvoId || chave,
      from: fromEmail,
      fromName,
      subject,
      date: dataMsg ? dataMsg.toISOString() : null,
      unread: m.isRead !== true,
      preview: (text || html.replace(/<[^>]+>/g, " ")).trim().slice(0, 2000),
      html: html ? html.slice(0, 20000) : null,
      numeroCotacao: v.numeroCotacao,
      vinculoConfianca: v.vinculo,
      referenciaTipo: v.refTipo,
      anexos: await comUrl(supabase, anexosSalvos, simular),
      anexosIgnorados,
      to: toList,
      cc: ccList,
      grandeDemais: false,
      caixa: CAIXA,
    });
  }
  return { mensagens, total };
}

/* ================= CAIXA 2: suporte@ por IMAP (transporte antigo, até desligar) ================= */
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
    if (lit) { source = await c.readExact(parseInt(lit[1], 10)); continue; }
    if (line.startsWith(tag + " ")) return { flags, uid, size, source };
  }
}

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
  const re = /=\?([^?\s]+)\?([BbQq])\?([^?\s]*)\?=/g;
  let out = "", last = 0, m: RegExpExecArray | null;
  let grupo: { charset: string; bytes: number[] } | null = null;
  const fechar = () => {
    if (!grupo) return;
    try { out += new TextDecoder(grupo.charset).decode(new Uint8Array(grupo.bytes)); } catch { out += new TextDecoder("utf-8").decode(new Uint8Array(grupo.bytes)); }
    grupo = null;
  };
  while ((m = re.exec(v)) !== null) {
    const entre = v.slice(last, m.index);
    if (grupo && entre.trim() === "") { /* ignora espaço entre palavras codificadas */ } else { fechar(); out += entre; }
    const charset = m[1].replace(/\*.*$/, "").toLowerCase();
    let bytes: Uint8Array;
    try { bytes = m[2].toUpperCase() === "B" ? base64ToBytes(m[3]) : quotedPrintableToBytes(m[3].replace(/_/g, " ")); }
    catch { fechar(); out += m[0]; last = m.index + m[0].length; continue; }
    if (grupo && grupo.charset !== charset) fechar();
    if (!grupo) grupo = { charset, bytes: [] };
    for (const b of bytes) grupo.bytes.push(b);
    last = m.index + m[0].length;
  }
  fechar();
  out += v.slice(last);
  return corrigirUtf8Cru(out);
}
function corrigirUtf8Cru(s: string): string {
  if (!/[\u0080-ÿ]/.test(s) || /[^\u0000-ÿ]/.test(s)) return s;
  try { return new TextDecoder("utf-8", { fatal: true }).decode(latin1ToBytes(s)); } catch { return s; }
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
const SIZE_LIMIT_BYTES = 3 * 1024 * 1024;

async function lerSuporte(supabase: any, limit: number, simular: boolean): Promise<{ mensagens: any[]; total: number }> {
  const HOST = Deno.env.get("IMAP_HOST") || "imap.hostinger.com";
  const PORT = Number(Deno.env.get("IMAP_PORT") || "993");
  const USER = Deno.env.get("SMTP_USER");
  const PASS = Deno.env.get("SMTP_PASS");
  if (!USER || !PASS) throw new Error("IMAP não configurado (SMTP_USER/SMTP_PASS)");

  let c: ImapConn | null = null;
  try {
    const tlsConn = await Deno.connectTls({ hostname: HOST, port: PORT });
    c = new ImapConn(tlsConn);
    await c.readLine();

    await c.write(`a1 LOGIN ${imapQuote(USER)} ${imapQuote(PASS)}\r\n`);
    const loginLines = await readUntilTagged(c, "a1");
    if (!loginLines[loginLines.length - 1].startsWith("a1 OK")) throw new Error("login IMAP falhou");

    await c.write(`a2 SELECT INBOX\r\n`);
    const selectLines = await readUntilTagged(c, "a2");
    const existsLine = selectLines.find((l) => /^\* \d+ EXISTS/.test(l));
    const total = existsLine ? parseInt(existsLine.match(/^\* (\d+) EXISTS/)![1], 10) : 0;

    const mensagens: any[] = [];
    if (total > 0) {
      const from = Math.max(1, total - limit + 1);
      let ti = 3;
      for (let seq = total; seq >= from; seq--) {
        const tagH = `a${ti++}`;
        await c.write(`${tagH} FETCH ${seq} (UID FLAGS RFC822.SIZE BODY.PEEK[HEADER])\r\n`);
        const { flags, uid, size, source: headerSrc } = await readFetchOne(c, tagH);
        if (!uid) continue;
        const headers = parseHeaders(headerSrc ? new TextDecoder("latin1").decode(headerSrc) : "");

        const fromParsed = parseFromHeader(headers["from"] || "");
        const toList = parseEnderecos(headers["to"] || "");
        const ccList = parseEnderecos(headers["cc"] || "");
        const subject = decodeHeaderValue(headers["subject"] || "(sem assunto)");
        const dataMsg = headers["date"] ? new Date(headers["date"]) : null;
        const messageIdHeader = (headers["message-id"] || "").match(/<[^>]+>/)?.[0] || null;
        const referenciaId = parseReferenciaId(headers);

        let text = "", html = "", attachments: Extracted["attachments"] = [];
        const grandeDemais = size > 0 && size > SIZE_LIMIT_BYTES;
        if (!grandeDemais) {
          const tagB = `a${ti++}`;
          await c.write(`${tagB} FETCH ${seq} (BODY.PEEK[])\r\n`);
          const { source } = await readFetchOne(c, tagB);
          if (source) {
            const extracted = extractParts(new TextDecoder("latin1").decode(source));
            text = extracted.text; html = extracted.html; attachments = extracted.attachments;
          }
        }

        const v = await vincular(supabase, referenciaId, subject);

        const anexosSalvos: Anexo[] = [];
        for (const a of attachments) {
          if (simular) { anexosSalvos.push({ filename: a.filename, content_type: a.contentType, size: a.bytes.length, path: "(simulado)" }); continue; }
          const path = `entrada/${uid}/${nomeSeguro(a.filename)}`;
          const { error: upErr } = await supabase.storage.from("emails-anexos")
            .upload(path, a.bytes, { contentType: a.contentType || "application/octet-stream", upsert: true });
          if (upErr) { console.warn("[read-inbox] upload anexo falhou", a.filename, upErr); continue; }
          anexosSalvos.push({ filename: a.filename, content_type: a.contentType, size: a.bytes.length, path });
        }

        let salvoId: string | null = null;
        if (!simular) {
          salvoId = await gravarEntrada(supabase, uid, {
            numero_cotacao: v.numeroCotacao,
            referencia_id: v.refId,
            referencia_tipo: v.refTipo,
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
            vinculo_confianca: v.vinculo,
            lido: /\\Seen/.test(flags),
            data_mensagem: dataMsg ? dataMsg.toISOString() : null,
            anexos: anexosSalvos,
          }, fromParsed.name, fromParsed.email, subject, v);
        }

        mensagens.push({
          id: salvoId || uid,
          from: fromParsed.email,
          fromName: fromParsed.name,
          subject,
          date: dataMsg ? dataMsg.toISOString() : null,
          unread: !/\\Seen/.test(flags),
          preview: grandeDemais
            ? `[Mensagem de ${(size / 1024 / 1024).toFixed(1)}MB — grande demais pra abrir aqui; acesse direto pela caixa suporte@vpsistema.com]`
            : (text || html.replace(/<[^>]+>/g, " ")).trim().slice(0, 2000),
          html: grandeDemais ? null : (html ? html.slice(0, 20000) : null),
          numeroCotacao: v.numeroCotacao,
          vinculoConfianca: v.vinculo,
          referenciaTipo: v.refTipo,
          anexos: await comUrl(supabase, anexosSalvos, simular),
          to: toList,
          cc: ccList,
          grandeDemais,
          caixa: "suporte@vpsistema.com",
        });
      }
    }
    await c.write(`a99 LOGOUT\r\n`).catch(() => {});
    return { mensagens, total };
  } finally {
    try { (c as any)?.conn?.close(); } catch (_) { /* já pode ter caído sozinho */ }
  }
}

/* ================= entrada ================= */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  let payload: any = {};
  try { payload = await req.json(); } catch { /* body vazio ok */ }
  const limit = Math.min(Math.max(Number(payload?.limit) || 15, 1), 25);
  const simular = payload?.simular === true;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"]);

  const nomes = ["hub"];
  const tarefas: Promise<{ mensagens: any[]; total: number }>[] = [lerHub(supabase, limit, simular)];
  if ((Deno.env.get("LEITURA_SUPORTE") ?? "on").trim().toLowerCase() !== "off") {
    nomes.push("suporte");
    tarefas.push(lerSuporte(supabase, limit, simular));
  }

  const resultados = await Promise.allSettled(tarefas);
  const fontes: Record<string, unknown> = {};
  let mensagens: any[] = [];
  let total = 0;
  let algumaOk = false;
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") {
      fontes[nomes[i]] = { ok: true, lidas: r.value.mensagens.length, total: r.value.total };
      mensagens.push(...r.value.mensagens);
      total += r.value.total;
      algumaOk = true;
    } else {
      const motivo = String((r.reason as Error)?.message || r.reason).slice(0, 160);
      console.warn(`[read-inbox] caixa ${nomes[i]} falhou`, r.reason);
      fontes[nomes[i]] = { ok: false, erro: motivo };
    }
  });
  if (!algumaOk) return json({ error: "Falha ao ler as caixas de e-mail", fontes }, 502);

  mensagens.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  mensagens = mensagens.slice(0, limit);
  return json({ ok: true, messages: mensagens, total, fontes, ...(simular ? { simulado: true } : {}) });
});
