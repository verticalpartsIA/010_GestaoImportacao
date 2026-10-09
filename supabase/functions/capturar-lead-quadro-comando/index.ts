/* ============================================================
   capturar-lead-quadro-comando — Edge Function (vpprd)
   Recebe o envio do formulário público de levantamento técnico de
   Quadro de Comando (página standalone, sem login) e cria o Lead em
   `leads` (mesma tabela que o Comercial já usa, ver comercial.jsx) +
   registra a atividade em `vp_logs`.

   Mesmo padrão de segurança de `capturar-lead-verticalparts` (irmã desta
   function, não mexida): sem imports externos (nada de supabase-js via
   esm.sh/deno.land — ver BOOT_ERROR documentado em
   quadro-comando-cruzamento-erp/omie-buscar-cliente), Deno.serve() nativo
   + fetch cru contra a REST API do Supabase com a service role, e limite
   de taxa via `api_rate_check` ANTES de gravar qualquer coisa.

   Diferença de propósito: a irmã recebe o webhook do site institucional
   (sem técnica nenhuma, só nome/e-mail/telefone/mensagem). Esta recebe
   a especificação técnica inteira preenchida pelo cliente/instalador no
   wizard público — guardada em `leads.especificacao_tecnica` (jsonb),
   só informativa: não cria/vincula `clientes` sozinha (isso continua
   manual, pelo vendedor, no fluxo de Leads já existente).
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

function str(v: unknown, max: number) {
  return v == null ? "" : String(v).trim().slice(0, max);
}

function soDigitos(v: unknown) {
  return String(v || "").replace(/\D/g, "");
}

/* Mesmo algoritmo de dígito verificador usado no front (enderecos-api.js) —
   checagem redundante aqui porque o navegador não é confiável. */
function cnpjValido(cnpj: string) {
  if (!/^\d{14}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((acc, p, i) => acc + p * Number(base[i]), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calc(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
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
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/api_rate_check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ p_bucket: "capturar-lead-quadro-comando", p_ip: ip, p_max_ip: 20, p_max_global: 60, p_janela_s: 600 }),
      });
      const resultado = r.ok ? await r.json() : "ok";
      if (resultado !== "ok") return json({ error: "Muitas solicitações. Tente novamente em alguns minutos." }, 429);
    } catch (e) {
      console.warn("[capturar-lead-quadro-comando] limite de taxa indisponível, seguindo sem ele:", e);
    }

    const payload = await req.json().catch(() => ({}));
    const d = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;

    const solicitante = str(d.solicitante, 120);
    const empresa = str(d.empresa, 160);
    const telefone = str(d.telefone, 40);
    const emailBruto = str(d.email, 160);
    const email = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(emailBruto) ? emailBruto : "";
    const cnpjDigits = soDigitos(d.cnpj);
    const obra = str(d.identificacao, 200);
    const tipoServico = str(d.tipo_servico, 40); // 'modernizacao' | 'elevador_novo'
    const variante = str(d.variante_quadro, 40); // ex.: '15_380'

    if (!solicitante) return json({ error: "Campo 'Nome do Solicitante' é obrigatório" }, 400);
    if (!telefone) return json({ error: "Campo 'Telefone' é obrigatório" }, 400);
    if (cnpjDigits && !cnpjValido(cnpjDigits)) return json({ error: "CNPJ inválido — confira os 14 dígitos." }, 400);

    // Payload técnico completo, guardado como veio — tamanho máximo defensivo (evita abuso).
    const especificacaoRaw = JSON.stringify(d).slice(0, 20000);
    let especificacao: unknown;
    try { especificacao = JSON.parse(especificacaoRaw); } catch { especificacao = { bruto: especificacaoRaw }; }

    const id = "LD-" + Date.now().toString().slice(-6);
    const hoje = new Date().toISOString().slice(0, 10);
    const variantesLabel: Record<string, string> = {
      "7.5_220": "7,5 kW/220 V", "7.5_380": "7,5 kW/380 V",
      "15_220": "15 kW/220 V", "15_380": "15 kW/380 V", "30_380": "30 kW/380 V",
    };
    const equipLabel = "Quadro de Comando" + (variantesLabel[variante] ? ` — ${variantesLabel[variante]}` : "");

    const lead = await restInsert("leads", {
      id,
      date: hoje,
      building: empresa || obra || "(não informado)",
      contact: solicitante,
      phone: telefone,
      email: email || null,
      origin: "Formulário Público — Quadro de Comando",
      status: "Em qualificação",
      priority: "media",
      equip: equipLabel,
      next_action: tipoServico === "modernizacao"
        ? "Analisar especificação técnica (modernização) e retornar orçamento"
        : "Analisar especificação técnica e retornar orçamento",
      documento_pendente: !cnpjDigits,
      especificacao_tecnica: { ...especificacao, cnpj: cnpjDigits || null },
    });

    try {
      await restInsert("vp_logs", {
        ator_nome: "Formulário Público — Quadro de Comando",
        modulo: "Comercial",
        acao: "Lead recebido pelo formulário público de Quadro de Comando",
        alvo: empresa || solicitante,
        alvo_id: lead.id,
        detalhe: { telefone, email: email || null, cnpj: cnpjDigits || null, obra: obra || null },
      });
    } catch (logErr) {
      console.warn("[capturar-lead-quadro-comando] Aviso: não registrou atividade em vp_logs:", logErr);
    }

    return json({ success: true, lead_id: lead.id });
  } catch (e) {
    console.error("[capturar-lead-quadro-comando] Erro:", e);
    return json({ error: (e as Error).message || "Erro ao enviar a solicitação" }, 500);
  }
});
