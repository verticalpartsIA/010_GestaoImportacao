/* ============================================================
   omie-buscar-cliente — Edge Function (vpprd)
   Consulta se um CNPJ/CPF já está cadastrado como cliente no Omie
   (geral/clientes → ListarClientes com clientesFiltro.cnpj_cpf).
   Usada pelo botão "Buscar CNPJ" do modal Novo/Editar Lead
   (src/comercial.jsx) — frontend nunca fala com o Omie direto
   (mesmo padrão de omie_sync_pagamentos_instaladores e
   quadro-comando-cruzamento-erp).

   Só CONSULTA — nunca escreve no Omie.

   Resposta:
     { encontrado: true, razao_social, nome_fantasia, data_cadastro
       (dd/mm/aaaa, de info.dInc), telefone, email, inativo }
     { encontrado: false }
     { encontrado: null, erro }   ← falha real de consulta (rate-limit,
                                    credencial...) — NÃO é "não existe".

   Comportamento real do Omie confirmado em 26/09/2026: o filtro aceita
   só dígitos ("46533808000135" acha "46.533.808/0001-35"); documento
   sem cadastro volta como fault "Não existem registros para a página
   [1]!" (HTTP 500), não como lista vazia.

   Acesso: exige um token de USUÁRIO logado (validado em /auth/v1/user)
   — verify_jwt sozinho aceita a anon key pública, e esta função devolve
   dados de contato de clientes do ERP.
   Acesso ao Supabase via fetch cru (sem supabase-js pelo esm.sh — ver
   BOOT_ERROR documentado em quadro-comando-cruzamento-erp).
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

const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

async function usuarioLogado(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/i.test(auth)) return false;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, Authorization: auth },
  });
  if (!res.ok) return false;
  const u = await res.json().catch(() => null);
  return !!(u && u.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  if (!(await usuarioLogado(req))) return json({ error: "Não autorizado" }, 401);
  if (!omieKey || !omieSecret) {
    return json({ encontrado: null, erro: "OMIE_API_KEY / OMIE_API_SECRET não configuradas no Supabase" });
  }

  const body = await req.json().catch(() => ({}));
  const doc = String(body.cnpj_cpf || "").replace(/\D/g, "");
  if (doc.length !== 14 && doc.length !== 11) {
    return json({ error: "Informe um CNPJ (14 dígitos) ou CPF (11 dígitos)" }, 400);
  }

  try {
    const res = await fetch("https://app.omie.com.br/api/v1/geral/clientes/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call: "ListarClientes",
        app_key: omieKey,
        app_secret: omieSecret,
        param: [{ pagina: 1, registros_por_pagina: 5, apenas_importado_api: "N", clientesFiltro: { cnpj_cpf: doc } }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    const fault = String(data?.faultstring || "");
    if (fault) {
      if (/n[aã]o existem registros|nenhum registro|n[aã]o encontrad/i.test(fault)) {
        return json({ encontrado: false });
      }
      return json({ encontrado: null, erro: fault });
    }
    if (!res.ok) return json({ encontrado: null, erro: `Omie HTTP ${res.status}` });

    // Filtro do Omie já é por documento, mas confere de novo pelos
    // dígitos pra nunca devolver um cadastro de outro CNPJ.
    const lista = (data?.clientes_cadastro || []) as Record<string, any>[];
    const c = lista.find((x) => String(x.cnpj_cpf || "").replace(/\D/g, "") === doc);
    if (!c) return json({ encontrado: false });

    const tel = c.telefone1_numero
      ? (c.telefone1_ddd ? `(${c.telefone1_ddd}) ${c.telefone1_numero}` : String(c.telefone1_numero))
      : null;
    return json({
      encontrado: true,
      razao_social: c.razao_social || c.nome_fantasia || null,
      nome_fantasia: c.nome_fantasia || null,
      data_cadastro: c.info?.dInc || null,
      telefone: tel,
      email: c.email || null,
      inativo: c.inativo === "S",
    });
  } catch (e) {
    return json({ encontrado: null, erro: (e as Error).message || "Falha ao consultar o Omie" });
  }
});
