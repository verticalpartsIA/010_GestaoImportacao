// ============================================================
// send-email — Edge Function (vpprd)
// Envio de e-mail direto (sem abrir Outlook/cliente local) via SMTP da
// própria VerticalParts (Hostinger). Genérica — qualquer tela do site
// pode chamar, não só o envio de RFQ ao fornecedor.
//
// 10/09 — e-mails vinculados a projeto (numero_cotacao): quando o
// chamador passa numeroCotacao, geramos um Message-ID nosso e gravamos a
// linha de saída em emails_projeto. Isso é o "vínculo certo" — se o
// destinatário responder citando esse Message-ID (In-Reply-To/References,
// que praticamente todo cliente de e-mail preserva ao responder),
// read-inbox casa com certeza absoluta. Sem numeroCotacao, o e-mail é
// só enviado normal, sem persistência (uso genérico/avulso).
//
// Secrets: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS. Opcional:
// SMTP_FROM_NAME.
//
// Body: { to, subject, text?, html?, replyTo?, numeroCotacao?,
//         referenciaTipo?, referenciaId? }
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

  if (!destinatarios.length) return json({ error: "Nenhum destinatário válido em \"to\"." }, 400);
  if (!subject) return json({ error: "Assunto (\"subject\") é obrigatório." }, 400);
  if (!text && !html) return json({ error: "Informe \"text\" ou \"html\"." }, 400);

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
      // 10/09 — tentativa de fixar nosso próprio Message-ID via headers
      // customizados do denomailer. Não documentado com certeza absoluta
      // nesta versão — se o servidor SMTP substituir por um Message-ID
      // próprio, o vínculo "certo" por In-Reply-To simplesmente não
      // acontece nessa mensagem específica; read-inbox tem fallback por
      // regex no assunto ("provável") que não depende disso. Nunca falha
      // o envio por causa disso.
      headers: { "Message-ID": messageId },
    } as any);
    await client.close();

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
