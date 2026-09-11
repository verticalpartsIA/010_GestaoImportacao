// ============================================================
// send-email — Edge Function (vpprd)
// Envio de e-mail direto (sem abrir Outlook/cliente local) via SMTP da
// própria VerticalParts (Hostinger). Genérica — qualquer tela do site
// pode chamar, não só o envio de RFQ ao fornecedor.
//
// 10/09 — e-mails vinculados a projeto (numero_cotacao): quando o
// chamador passa numeroCotacao, geramos um Message-ID nosso e gravamos a
// linha de saída em emails_projeto. "Vínculo certo" se o destinatário
// responder citando esse Message-ID.
//
// 10/09 (2) — suporte a anexo: body.attachments = [{filename,
// contentType, base64}].
//
// 11/09 — BUG REAL corrigido: `content` como Uint8Array cru pro
// denomailer produzia anexo de 0 bytes. Fix inicial: decodificar
// base64→bytes e reconstruir bytes→base64 antes de mandar — funcionou
// pra arquivo pequeno, mas quebrou com PDF real de 4.2MB do usuário
// ("WORKER_RESOURCE_LIMIT"). Removido o vai-e-volta (base64 do cliente
// vai direto pro SMTP), mas o limite persistiu — confirmado via testes
// reais com arquivo aleatório: 2.5MB passa, 3.5MB estoura recurso.
// Conclusão: o teto real é do próprio ambiente (Edge Function + o jeito
// que o denomailer monta o MIME do anexo), não do meu código. Limite
// fixado em 2.5MB (confirmado funcionando), avisado claramente ao
// usuário em vez de deixar tentar e falhar com erro genérico.
//
// Secrets: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS. Opcional:
// SMTP_FROM_NAME.
//
// Body: { to, subject, text?, html?, replyTo?, numeroCotacao?,
//         referenciaTipo?, referenciaId?, attachments?: [{filename,
//         contentType, base64}] }
// ============================================================
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
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

/* 11/09 — confirmado via teste real (arquivo aleatório, não suposição):
   2.5MB passa, 3.5MB estoura WORKER_RESOURCE_LIMIT. Fixado em 2.5MB —
   dentro da faixa confirmada, com margem antes do ponto de falha real
   observado. */
const MAX_ANEXO_TOTAL_BYTES = 2.5 * 1024 * 1024;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  const HOST = Deno.env.get("SMTP_HOST");
  const PORT = Number(Deno.env.get("SMTP_PORT") || "465");
  const USER = Deno.env.get("SMTP_USER");
  const PASS = Deno.env.get("SMTP_PASS");
  const FROM_NAME = Deno.env.get("SMTP_FROM_NAME") || "VerticalParts";

  if (!HOST || !USER || !PASS) {
    return json({ error: "SMTP não configurado — faltam secrets SMTP_HOST/SMTP_USER/SMTP_PASS. Configure em Project Settings → Edge Functions → Secrets." }, 503);
  }

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const destinatarios = parseDestinatarios(payload?.to);
  const subject = typeof payload?.subject === "string" ? payload.subject : "";
  const text = typeof payload?.text === "string" ? payload.text : undefined;
  const html = typeof payload?.html === "string" ? payload.html : undefined;
  const replyTo = typeof payload?.replyTo === "string" ? payload.replyTo : undefined;
  const numeroCotacao = Number.isFinite(Number(payload?.numeroCotacao)) && payload?.numeroCotacao != null ? Number(payload.numeroCotacao) : null;
  const referenciaTipo = typeof payload?.referenciaTipo === "string" ? payload.referenciaTipo : null;
  const referenciaId = payload?.referenciaId != null ? String(payload.referenciaId) : null;
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
    return json({ error: `Anexos somam ~${(totalBytesEstimado / 1024 / 1024).toFixed(1)}MB — limite de ${(MAX_ANEXO_TOTAL_BYTES / 1024 / 1024).toFixed(1)}MB por envio (limite real do ambiente de envio, confirmado em teste — não é uma escolha arbitrária).` }, 400);
  }

  const messageId = `<${crypto.randomUUID()}@vpsistema.com>`;

  const client = new SMTPClient({
    connection: {
      hostname: HOST,
      port: PORT,
      tls: PORT === 465,
      auth: { username: USER, password: PASS },
    },
  });

  try {
    await client.send({
      from: `${FROM_NAME} <${USER}>`,
      to: destinatarios,
      replyTo: replyTo || undefined,
      subject,
      content: text || "Ver versão HTML.",
      html: html || undefined,
      headers: { "Message-ID": messageId },
      attachments: anexos.length
        ? anexos.map((a) => ({ filename: a.filename, content: a.base64, encoding: "base64", contentType: a.contentType }))
        : undefined,
    } as any);
    await client.close();

    let anexosSalvos: { filename: string; content_type: string; size: number; path: string }[] = [];
    if (numeroCotacao != null && anexos.length) {
      try {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const grupoId = crypto.randomUUID();
        for (const a of anexos) {
          const bytes = base64ToBytes(a.base64);
          const path = `saida/${grupoId}/${a.filename}`;
          const { error: upErrAnexo } = await supabase.storage.from("emails-anexos")
            .upload(path, bytes, { contentType: a.contentType, upsert: true });
          if (upErrAnexo) { console.warn("[send-email] upload anexo falhou", a.filename, upErrAnexo); continue; }
          anexosSalvos.push({ filename: a.filename, content_type: a.contentType, size: bytes.length, path });
        }
      } catch (e) {
        console.warn("[send-email] falha ao subir anexo pro Storage", e);
      }
    }

    if (numeroCotacao != null) {
      try {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabase.from("emails_projeto").insert({
          numero_cotacao: numeroCotacao,
          referencia_tipo: referenciaTipo,
          referencia_id: referenciaId,
          direcao: "saida",
          de_email: USER,
          de_nome: FROM_NAME,
          para: destinatarios,
          assunto: subject,
          corpo_texto: text || null,
          corpo_html: html || null,
          message_id: messageId,
          data_mensagem: new Date().toISOString(),
          anexos: anexosSalvos,
        });
      } catch (e) {
        // Nunca derruba o envio (já aconteceu) por falha de persistência.
        console.warn("[send-email] falha ao gravar em emails_projeto", e);
      }
    }

    return json({ ok: true, destinatarios, messageId });
  } catch (e) {
    try { await client.close(); } catch (_) { /* já pode ter fechado sozinho no erro */ }
    console.warn("[send-email] falha ao enviar", e);
    return json({ error: "Falha ao enviar e-mail via SMTP", detail: String((e as Error)?.message || e) }, 502);
  }
});
