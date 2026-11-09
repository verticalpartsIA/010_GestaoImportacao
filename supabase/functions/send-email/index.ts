// ============================================================
// send-email — Edge Function (vpprd). Desde 09/11/2026 envia pela Microsoft Graph, caixa
// hub@verticalparts.com.br (antes: SMTP da Hostinger, suporte@vpsistema.com — a versão antiga
// está no Git, commit b40b53e). Os e-mails saem com a assinatura corporativa do hub@.
//
// Mesmo contrato de entrada/saída do send-email, mesmas travas (formato do e-mail,
// máx. 10 destinatários, allowlist, limite de taxa, fail-closed) e mesmo registro em
// emails_projeto. O que muda é o transporte:
//   - login: client credentials da Microsoft (AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET)
//   - envio: cria o rascunho na caixa SENDER_EMAIL, lê o internetMessageId que o
//     Exchange atribui e só então envia. Esse id é o "Message-ID" que o read-inbox
//     usa para vincular a resposta (a Graph não deixa escolher o Message-ID).
// Anexo: limite de 2,5 MB somados (mantido; o limite antigo era do SMTP, aqui é
// escolha de cautela até testar maior).
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseDestinatarios(to: unknown): string[] {
  if (Array.isArray(to)) return to.map((x) => String(x).trim()).filter(Boolean);
  if (typeof to === "string") return to.split(",").map((x) => x.trim()).filter(Boolean);
  return [];
}

function limparBase64(b64: string): string {
  return String(b64 || "").replace(/^data:[^,]*,/, "").replace(/[^A-Za-z0-9+/=]/g, "");
}
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

const MAX_ANEXO_TOTAL_BYTES = 2.5 * 1024 * 1024;

// O Storage recusa chave com acento/espaço ("InvalidKey"); o caminho usa um nome só com ASCII,
// o nome original continua no campo `filename` (é o que a tela mostra).
function nomeSeguro(nome: string): string {
  const s = String(nome || "anexo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (s || "anexo").slice(0, 120);
}

/* Travas anti-relay (issue #584) — iguais às do send-email de produção. */
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;
const MAX_DESTINATARIOS = 10;
const MAX_ENVIOS_IP_10MIN = 25;
const MAX_ENVIOS_GLOBAL_10MIN = 60;
const DOMINIOS_INTERNOS = ["verticalparts.com.br", "vpsistema.com"];
const EXTRAS_PERMITIDOS = ["gelsonsimoes@gmail.com"];

/* ---------- Assinatura corporativa do hub@ (aprovada pelo Gelson em 09/11/2026) ----------
   Banner hospedado no bucket público `engenharia` + texto de reserva (o Outlook/Gmail podem bloquear
   a imagem até o destinatário liberar). Vai só no e-mail enviado; o que fica gravado em emails_projeto
   é o corpo original, sem a assinatura. Desligar sem redeploy: secret ASSINATURA_HUB=off. */
const ASSINATURA_MARCA = "vp-assinatura-hub";
const ASSINATURA_IMG = Deno.env.get("ASSINATURA_IMG_URL") ||
  "https://jxtqwzmpgofwctqajewt.supabase.co/storage/v1/object/public/engenharia/email-assinatura/assinatura-hub.jpg";

function assinaturaHtml(): string {
  return `<table role="presentation" id="${ASSINATURA_MARCA}" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;border-collapse:collapse;max-width:600px"><tr><td>` +
    `<a href="https://verticalparts.com.br" target="_blank" style="text-decoration:none">` +
    `<img src="${ASSINATURA_IMG}" width="600" alt="VerticalParts — Assistente Virtual | hub@verticalparts.com.br | verticalparts.com.br | Rua Armandina Braga de Almeida, 383, Guarulhos/SP" style="display:block;width:100%;max-width:600px;height:auto;border:0">` +
    `</a></td></tr><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#777;padding-top:6px">` +
    `<b>VerticalParts</b> | Assistente Virtual &middot; <a href="mailto:hub@verticalparts.com.br" style="color:#777">hub@verticalparts.com.br</a> &middot; ` +
    `<a href="https://verticalparts.com.br" style="color:#777">verticalparts.com.br</a><br>` +
    `Canal digital automatizado da VerticalParts, destinado ao recebimento e envio de mensagens.</td></tr></table>`;
}

function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Corpo que vai pela Microsoft: o original + assinatura. Texto puro vira HTML (quebras de linha preservadas). */
function comAssinatura(html: string | undefined, text: string | undefined): string {
  const base = html ?? `<div style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;font-size:14px">${escaparHtml(text ?? "")}</div>`;
  if (base.includes(ASSINATURA_MARCA)) return base;
  return base + assinaturaHtml();
}

/* ---------- Microsoft Graph ---------- */
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

async function graph(method: string, caminho: string, token: string, corpo?: unknown) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${caminho}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const j = r.status === 202 || r.status === 204 ? {} : await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  const SENDER = (Deno.env.get("SENDER_EMAIL") ?? "").trim().toLowerCase();
  const FROM_NAME = Deno.env.get("SMTP_FROM_NAME") || "VerticalParts";
  if (!SENDER || !Deno.env.get("AZURE_TENANT_ID") || !Deno.env.get("AZURE_CLIENT_ID") || !Deno.env.get("AZURE_CLIENT_SECRET")) {
    return json({ error: "Microsoft Graph não configurada — faltam secrets AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET/SENDER_EMAIL." }, 503);
  }

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const destinatarios = parseDestinatarios(payload?.to);
  const subject = typeof payload?.subject === "string" ? payload.subject.replace(/[\r\n]+/g, " ").trim() : "";
  const text = typeof payload?.text === "string" ? payload.text : undefined;
  const cc = parseDestinatarios(payload?.cc).filter((c) => !destinatarios.some((d) => d.toLowerCase() === c.toLowerCase()));
  const html = typeof payload?.html === "string" ? payload.html : undefined;
  const replyTo = typeof payload?.replyTo === "string" ? payload.replyTo : undefined;
  const numeroCotacao = Number.isFinite(Number(payload?.numeroCotacao)) && payload?.numeroCotacao != null ? Number(payload.numeroCotacao) : null;
  const referenciaTipo = typeof payload?.referenciaTipo === "string" ? payload.referenciaTipo : null;
  const referenciaId = payload?.referenciaId != null ? String(payload.referenciaId) : null;
  const enviadoPorRaw = typeof payload?.enviadoPor === "string" ? payload.enviadoPor.trim().toLowerCase() : "";
  const enviadoPor = enviadoPorRaw.length <= 120 && EMAIL_RE.test(enviadoPorRaw) ? enviadoPorRaw : null;
  const anexosIn: any[] = Array.isArray(payload?.attachments) ? payload.attachments : [];

  if (!destinatarios.length) return json({ error: "Nenhum destinatário válido em \"to\"." }, 400);
  if (!subject) return json({ error: "Assunto (\"subject\") é obrigatório." }, 400);
  if (!text && !html) return json({ error: "Informe \"text\" ou \"html\"." }, 400);

  const anexos = anexosIn.map((a) => ({
    filename: String(a?.filename || "anexo"),
    contentType: String(a?.contentType || "application/octet-stream"),
    base64: limparBase64(a?.base64 || ""),
  }));
  const totalBytesEstimado = anexos.reduce((s, a) => s + Math.floor(a.base64.length * 3 / 4), 0);
  if (totalBytesEstimado > MAX_ANEXO_TOTAL_BYTES) {
    return json({ error: `Anexos somam ~${(totalBytesEstimado / 1024 / 1024).toFixed(1)}MB — limite de ${(MAX_ANEXO_TOTAL_BYTES / 1024 / 1024).toFixed(1)}MB por envio.` }, 400);
  }

  /* Travas ANTES do envio (idênticas ao send-email de produção; falha ao consultar o banco = bloqueia). */
  const todosDest = [...destinatarios, ...cc];
  const invalidos = todosDest.filter((d) => !EMAIL_RE.test(d));
  if (invalidos.length) return json({ error: `Destinatário inválido: ${invalidos.join(", ")}` }, 400);
  if (todosDest.length > MAX_DESTINATARIOS) {
    return json({ error: `Máximo de ${MAX_DESTINATARIOS} destinatários por envio.` }, 400);
  }

  let guard: ReturnType<typeof createClient>;
  try {
    guard = createClient(Deno.env.get("SUPABASE_URL")!, JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"]);
  } catch (e) {
    console.warn("[send-email] guard: cliente de serviço indisponível", e);
    return json({ error: "Envio temporariamente indisponível (verificação de segurança)." }, 503);
  }

  const externos = todosDest.filter((d) => {
    const dom = d.split("@")[1]?.toLowerCase() || "";
    return !DOMINIOS_INTERNOS.includes(dom) && !EXTRAS_PERMITIDOS.includes(d.toLowerCase());
  });
  if (externos.length) {
    const { data: conhecidos, error: errConh } = await guard.rpc("email_conhecidos", { p_emails: externos });
    if (errConh) {
      console.warn("[send-email] guard: email_conhecidos falhou", errConh);
      return json({ error: "Envio temporariamente indisponível (verificação de segurança)." }, 503);
    }
    const ok = new Set((conhecidos as string[] | null || []).map((x) => x.toLowerCase()));
    const desconhecidos = externos.filter((d) => !ok.has(d.toLowerCase()));
    if (desconhecidos.length) {
      return json({ error: `Destinatário(s) não cadastrado(s) no sistema: ${desconhecidos.join(", ")}. Cadastre o contato (cliente, fornecedor, lead ou colaborador) antes de enviar.` }, 403);
    }
  }

  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
  const { data: taxa, error: errTaxa } = await guard.rpc("email_rate_check", { p_ip: ip, p_n: todosDest.length, p_max_ip: MAX_ENVIOS_IP_10MIN, p_max_global: MAX_ENVIOS_GLOBAL_10MIN });
  if (errTaxa) {
    console.warn("[send-email] guard: email_rate_check falhou", errTaxa);
    return json({ error: "Envio temporariamente indisponível (verificação de segurança)." }, 503);
  }
  if (taxa !== "ok") {
    return json({ error: "Muitos envios em pouco tempo. Aguarde alguns minutos e tente de novo." }, 429);
  }

  /* ---------- Envio pela Graph: rascunho → internetMessageId → enviar ---------- */
  let token: string;
  try { token = await tokenGraph(); } catch (e) {
    console.warn("[send-email] login Microsoft falhou", e);
    return json({ error: "Falha ao autenticar na Microsoft", detail: String((e as Error)?.message || e) }, 502);
  }

  const usarAssinatura = (Deno.env.get("ASSINATURA_HUB") ?? "on").toLowerCase() !== "off";
  const rascunho: Record<string, unknown> = {
    subject,
    body: usarAssinatura
      ? { contentType: "HTML", content: comAssinatura(html, text) }
      : { contentType: html ? "HTML" : "Text", content: html || text },
    toRecipients: destinatarios.map((a) => ({ emailAddress: { address: a } })),
    ccRecipients: cc.map((a) => ({ emailAddress: { address: a } })),
    from: { emailAddress: { address: SENDER, name: FROM_NAME } },
  };
  if (replyTo && EMAIL_RE.test(replyTo)) rascunho.replyTo = [{ emailAddress: { address: replyTo } }];
  if (anexos.length) {
    rascunho.attachments = anexos.map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.filename,
      contentType: a.contentType,
      contentBytes: a.base64,
    }));
  }

  const caixa = `/users/${encodeURIComponent(SENDER)}`;
  const criado = await graph("POST", `${caixa}/messages`, token, rascunho);
  if (!criado.ok || !(criado.j as any)?.id) {
    console.warn("[send-email] rascunho falhou", criado.status, (criado.j as any)?.error?.code);
    return json({ error: "Falha ao preparar o e-mail na Microsoft", detail: (criado.j as any)?.error?.code || String(criado.status) }, 502);
  }
  const idRascunho = (criado.j as any).id as string;
  let messageId: string | null = (criado.j as any).internetMessageId ?? null;
  if (!messageId) {
    const lido = await graph("GET", `${caixa}/messages/${encodeURIComponent(idRascunho)}?$select=internetMessageId`, token);
    messageId = (lido.j as any)?.internetMessageId ?? null;
  }

  const enviado = await graph("POST", `${caixa}/messages/${encodeURIComponent(idRascunho)}/send`, token);
  if (!enviado.ok) {
    console.warn("[send-email] envio falhou", enviado.status, (enviado.j as any)?.error?.code);
    await graph("DELETE", `${caixa}/messages/${encodeURIComponent(idRascunho)}`, token).catch(() => {});
    return json({ error: "Falha ao enviar e-mail via Microsoft", detail: (enviado.j as any)?.error?.code || String(enviado.status) }, 502);
  }

  /* ---------- Registro em emails_projeto (igual ao send-email) ---------- */
  let anexosSalvos: { filename: string; content_type: string; size: number; path: string }[] = [];
  if (anexos.length) {
    try {
      const grupoId = crypto.randomUUID();
      for (const a of anexos) {
        const bytes = base64ToBytes(a.base64);
        const path = `saida/${grupoId}/${nomeSeguro(a.filename)}`;
        const { error: upErrAnexo } = await guard.storage.from("emails-anexos")
          .upload(path, bytes, { contentType: a.contentType, upsert: true });
        if (upErrAnexo) { console.warn("[send-email] upload anexo falhou", a.filename, upErrAnexo); continue; }
        anexosSalvos.push({ filename: a.filename, content_type: a.contentType, size: bytes.length, path });
      }
    } catch (e) {
      console.warn("[send-email] falha ao subir anexo pro Storage", e);
    }
  }

  let avisoPersistencia: string | null = null;
  if (!messageId) {
    avisoPersistencia = "E-mail enviado, mas a Microsoft não informou o identificador da mensagem — a resposta pode não ser vinculada automaticamente a esta cotação.";
  }
  try {
    const { error: insertErr } = await guard.from("emails_projeto").insert({
      numero_cotacao: numeroCotacao,
      referencia_tipo: referenciaTipo,
      referencia_id: referenciaId,
      direcao: "saida",
      de_email: SENDER,
      de_nome: FROM_NAME,
      para: destinatarios,
      cc: cc,
      assunto: subject,
      corpo_texto: text || null,
      corpo_html: html || null,
      message_id: messageId,
      data_mensagem: new Date().toISOString(),
      anexos: anexosSalvos,
      enviado_por: enviadoPor,
    });
    if (insertErr) {
      console.warn("[send-email] falha ao gravar em emails_projeto", insertErr);
      avisoPersistencia = "E-mail enviado normalmente, mas não foi possível registrá-lo em Enviados/Linha do Tempo desta cotação — avise o suporte se isso persistir.";
    }
  } catch (e) {
    console.warn("[send-email] falha ao gravar em emails_projeto (exceção)", e);
    avisoPersistencia = "E-mail enviado normalmente, mas não foi possível registrá-lo em Enviados/Linha do Tempo desta cotação — avise o suporte se isso persistir.";
  }

  return json({ ok: true, destinatarios, cc, messageId, avisoPersistencia });
});
