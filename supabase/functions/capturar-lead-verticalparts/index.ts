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
const SERVICE_KEY = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"] || "";

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
    /* 02/10 — ClaudeNotebook (issue #572): webhook público (o POST vem do servidor do
       site, sem como esconder segredo no navegador). Limite de taxa por IP/global antes
       de gravar qualquer coisa, e tamanho máximo por campo (antes qualquer texto, de
       qualquer tamanho, virava um lead). O IP aqui é o do servidor do WordPress, por
       isso o teto por IP é folgado. Falha ao consultar o limite = deixa passar (lead
       perdido é pior que lead extra) — diferente do send-email, que bloqueia. */
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/api_rate_check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ p_bucket: "capturar-lead", p_ip: ip, p_max_ip: 30, p_max_global: 60, p_janela_s: 600 }),
      });
      const resultado = r.ok ? await r.json() : "ok";
      if (resultado !== "ok") return json({ error: "Muitas solicitações. Tente novamente em alguns minutos." }, 429);
    } catch (e) {
      console.warn("[capturar-lead] limite de taxa indisponível, seguindo sem ele:", e);
    }

    const payload = await req.json().catch(() => ({}));
    const form = payload.form_fields || payload.fields || payload;

    const corta = (s: string, n: number) => s.slice(0, n);
    const nome = corta(campo(form, "name", "nome", "your-name"), 120);
    const emailBruto = corta(campo(form, "email", "your-email"), 160);
    const email = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(emailBruto) ? emailBruto : "";
    const telefone = corta(campo(form, "phone", "telefone", "your-phone"), 40);
    const empresa = corta(campo(form, "company", "empresa", "predio", "building"), 160);
    const mensagem = corta(campo(form, "message", "mensagem", "your-message"), 1000);

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
