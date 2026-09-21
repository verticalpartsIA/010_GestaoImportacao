// ============================================================
// whatsapp-notify — Edge Function (vpprd)
// Notifica por WhatsApp os envolvidos numa decisão da Central de Decisões
// (decisoes_gerenciais). Nunca lança exceção pro chamador — todo caminho
// (sucesso, erro HTTP, sem número, sem API key) termina em uma linha de
// whatsapp_notification_log e um Response 200. WhatsApp é sempre efeito
// colateral, nunca dependência da ação principal do chamador.
// Ver docs/superpowers/specs/2026-09-17-whatsapp-central-decisoes-design.md
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client as PgClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

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

const TIPO_LABEL: Record<string, string> = {
  envio_proposta_gestor: "Envio de proposta — aprovação do Gestor Comercial",
  envio_proposta_ceo: "Envio de proposta — aprovação do CEO",
  contratacao_mao_obra_ceo: "Contratação de mão de obra — aprovação do CEO",
  montador_entra_obra_rh: "Montador entra na obra — aprovação da Engenharia",
  compra_equipamento_ceo: "Compra do equipamento — aprovação do CEO",
  compra_varejo_logistica: "Compra de varejo — aprovação da Logística",
  desconto_proposta: "Desconto em proposta",
  pagamento_instalador_parcela: "Pagamento a instalador — aprovação do Gestor Comercial",
};

function labelTipo(tipo: string): string {
  return TIPO_LABEL[tipo] || tipo;
}

function montarTexto(input: {
  stage: string; tipo: string; numeroCotacao?: number | null;
  statusFinal?: string; motivo?: string | null;
}): string {
  const label = labelTipo(input.tipo);
  if (input.stage === "decisao_pendente") {
    const cotacao = input.numeroCotacao != null ? ` (Cotação Nº ${input.numeroCotacao})` : "";
    return `📋 Nova aprovação pendente: ${label}${cotacao}. Acesse o VP Gestão para decidir.`;
  }
  const emoji = input.statusFinal === "aprovada" ? "✅" : "❌";
  const motivo = input.motivo ? ` Motivo: ${input.motivo}` : "";
  return `${emoji} Sua decisão de ${label} foi ${input.statusFinal}.${motivo}`;
}

/* Busca as 3 credenciais da Evolution API no cofre central do vpsistema —
   uma vez por invocação, nunca por destinatário. Papel svc_gestaoimportacao
   e VPSISTEMA_DB_URL provisionados fora deste projeto (ver Global
   Constraints); enquanto não existirem, retorna null e todo destinatário
   vira skipped_no_apikey — não é um erro, é o estado esperado até lá.

   FIX 21/09/2026 (Gelson): client.queryObject(sql, arg) com `arg` passado
   solto (não dentro de um array) não faz bind posicional de verdade — a
   lib espalha a string caractere por caractere, resultando em
   credentials.get_secret('gestaoimportacao', 'V') em vez de
   ('gestaoimportacao', 'EVOLUTION_API_URL'). Confirmado ao vivo via
   credentials.access_log (key_name gravado como "V", reason "not found").
   A assinatura correta de queryObject para bind posicional por string SQL
   é (text, args: unknown[]) — o array é obrigatório mesmo com 1 argumento. */
async function buscarCredenciaisEvolution(): Promise<{ url: string; apikey: string; instance: string } | null> {
  const dsn = Deno.env.get("VPSISTEMA_DB_URL");
  if (!dsn) return null;
  const client = new PgClient(dsn);
  try {
    await client.connect();
    const chaves = ["EVOLUTION_API_URL", "EVOLUTION_APIKEY", "EVOLUTION_INSTANCE"];
    const valores: Record<string, string> = {};
    for (const chave of chaves) {
      const { rows } = await client.queryObject<{ get_secret: string }>(
        "select credentials.get_secret('gestaoimportacao', $1) as get_secret", [chave],
      );
      valores[chave] = rows[0]?.get_secret || "";
    }
    if (!valores.EVOLUTION_APIKEY) return null;
    return { url: valores.EVOLUTION_API_URL, apikey: valores.EVOLUTION_APIKEY, instance: valores.EVOLUTION_INSTANCE };
  } catch {
    return null;
  } finally {
    try { await client.end(); } catch { /* já desconectado */ }
  }
}

async function enviarEvolution(
  numero: string, texto: string, creds: { url: string; apikey: string; instance: string },
): Promise<{ ok: boolean; status: number; body: string }> {
  const resp = await fetch(`${creds.url}/message/sendText/${creds.instance}`, {
    method: "POST",
    headers: { apikey: creds.apikey, "content-type": "application/json" },
    body: JSON.stringify({ number: numero, text: texto }),
  });
  const body = await resp.text();
  return { ok: resp.ok, status: resp.status, body: body.slice(0, 500) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const stage = payload?.stage;
  if (stage !== "decisao_pendente" && stage !== "decisao_resultado") {
    return json({ error: "stage inválido" }, 400);
  }
  const decisaoId: string | null = typeof payload?.decisaoId === "string" ? payload.decisaoId : null;
  const tipo: string = typeof payload?.tipo === "string" ? payload.tipo : "";
  const numeroCotacao = typeof payload?.numeroCotacao === "number" ? payload.numeroCotacao : null;
  const recipients: string[] = Array.isArray(payload?.recipients)
    ? payload.recipients.filter((e: any) => typeof e === "string" && e.trim())
    : [];
  const statusFinal: string | undefined = typeof payload?.statusFinal === "string" ? payload.statusFinal : undefined;
  const motivo: string | null = typeof payload?.motivo === "string" ? payload.motivo : null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const texto = montarTexto({ stage, tipo, numeroCotacao, statusFinal, motivo });
  const creds = await buscarCredenciaisEvolution(); // uma vez por invocação, não por destinatário
  const resultados: Array<{ email: string; status: string }> = [];

  for (const email of recipients) {
    const { data: perfil } = await admin.from("perfis").select("whatsapp_number").eq("email", email).maybeSingle();
    const numero = (perfil?.whatsapp_number || "").replace(/\D/g, "");

    if (!numero) {
      const { error: logError } = await admin.from("whatsapp_notification_log").insert({
        stage, decisao_id: decisaoId, recipient_email: email, recipient_number: null, status: "skipped_no_number",
      });
      if (logError) console.error("[whatsapp-notify] log insert failed", logError);
      resultados.push({ email, status: "skipped_no_number" });
      continue;
    }

    if (!creds) {
      const { error: logError } = await admin.from("whatsapp_notification_log").insert({
        stage, decisao_id: decisaoId, recipient_email: email, recipient_number: numero, status: "skipped_no_apikey",
      });
      if (logError) console.error("[whatsapp-notify] log insert failed", logError);
      resultados.push({ email, status: "skipped_no_apikey" });
      continue;
    }

    try {
      const envio = await enviarEvolution(numero, texto, creds);
      const { error: logError } = await admin.from("whatsapp_notification_log").insert({
        stage, decisao_id: decisaoId, recipient_email: email, recipient_number: numero,
        status: envio.ok ? "sent" : "error", http_status: envio.status,
        error_detail: envio.ok ? null : envio.body,
      });
      if (logError) console.error("[whatsapp-notify] log insert failed", logError);
      resultados.push({ email, status: envio.ok ? "sent" : "error" });
    } catch (e) {
      const { error: logError } = await admin.from("whatsapp_notification_log").insert({
        stage, decisao_id: decisaoId, recipient_email: email, recipient_number: numero,
        status: "error", error_detail: String(e).slice(0, 500),
      });
      if (logError) console.error("[whatsapp-notify] log insert failed", logError);
      resultados.push({ email, status: "error" });
    }
  }

  return json({ ok: true, resultados });
});
