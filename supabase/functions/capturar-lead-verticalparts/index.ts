/* ============================================================
   capturar-lead-verticalparts — Edge Function (vpprd)
   Recebe o webhook do formulário Elementor (site verticalparts.com.br)
   e cria o lead em `leads` + registra a atividade em `vp_logs` (mesma
   tabela que o Comercial (comercial.jsx) já lê para o histórico do lead).

   Sem imports externos (nada de supabase-js pelo esm.sh, nem
   deno.land/std/http/server — ver BOOT_ERROR documentado em
   quadro-comando-cruzamento-erp / omie-buscar-cliente). Usa Deno.serve()
   nativo + fetch cru contra a REST API do Supabase.

   Integração com Omie (criar oportunidade) foi propositalmente deixada
   de fora desta primeira versão: não existe hoje nenhuma function que
   já faça isso (só ListarClientes / omie-buscar-cliente, que são
   leitura), então o formato exato de IncluirOportunidade nunca foi
   validado contra o Omie real deste projeto.
   ============================================================ */

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function campo(form: Record<string, unknown>, ...nomes: string[]) {
  for (const n of nomes) {
    const v = form[n];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

async function restInsert(tabela: string, body: unknown) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`REST ${tabela} ${resp.status}: ${JSON.stringify(data)}`);
  return Array.isArray(data) ? data[0] : data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const payload = await req.json().catch(() => ({}));
    const form = payload.form_fields || payload.fields || payload;

    const nome = campo(form, "name", "nome", "your-name");
    const email = campo(form, "email", "your-email");
    const telefone = campo(form, "phone", "telefone", "your-phone");
    const empresa = campo(form, "company", "empresa", "predio", "building");
    const mensagem = campo(form, "message", "mensagem", "your-message");

    if (!nome) return json({ error: "Campo 'nome' é obrigatório" }, 400);

    const id = "LD-" + Date.now().toString().slice(-6);
    const hoje = new Date().toISOString().slice(0, 10);

    const lead = await restInsert("leads", {
      id,
      date: hoje,
      building: empresa || "(não informado)",
      contact: nome,
      phone: telefone || null,
      email: email || null,
      origin: "Site verticalparts.com.br",
      status: "Em qualificação",
      priority: "media",
      next_action: mensagem ? `Responder: ${mensagem.slice(0, 100)}` : "Aguardando primeiro contato",
      documento_pendente: false,
    });

    try {
      await restInsert("vp_logs", {
        ator_nome: "Site VerticalParts",
        modulo: "Comercial",
        acao: "Lead recebido pelo site verticalparts.com.br",
        alvo: empresa || nome,
        alvo_id: lead.id,
        detalhe: { email, telefone, mensagem: mensagem || null },
      });
    } catch (logErr) {
      console.warn("[capturar-lead] Aviso: não registrou atividade em vp_logs:", logErr);
    }

    return json({ success: true, lead_id: lead.id });
  } catch (e) {
    console.error("[capturar-lead] Erro:", e);
    return json({ error: (e as Error).message || "Erro ao capturar lead" }, 500);
  }
});
