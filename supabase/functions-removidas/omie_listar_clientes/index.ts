// BACKUP — função removida do Supabase em 01/10/2026 (ClaudeNotebook, issue #572).
// Sem código no repo e sem nenhum chamador no front/cron (a oficial hoje é omie-buscar-cliente).
// Lê todo o cadastro de clientes/fornecedores do Omie por nome e expunha CNPJ/e-mail/telefone/endereço.
// Se algum dia precisar de novo: versionar no repo, com autenticação, em supabase/functions/.
/* ============================================================
   omie_listar_clientes — busca no cadastro de Clientes/Fornecedores
   do Omie (ListarClientes) por nomes fornecidos, pra cruzar com
   montadores/instaladores registrados só numa planilha (sem cadastro
   formal ainda) e trazer dados completos (CNPJ/CPF, telefone, email,
   endereço) pra homologação no VP Gestão. Também suporta modo
   listar_exterior pra achar fornecedores estrangeiros (flag nativo
   'exterior' do Omie).

   POST body: { "nomes": string[], "max_paginas"?: number } OU
              { "listar_exterior": true, "max_paginas"?, "pagina_inicial"? }
   ============================================================ */
const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function normalize(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

// tokens relevantes de um nome de busca ("Luis / Edmilson" -> ["LUIS","EDMILSON"])
function tokensDe(nome: string): string[] {
  return normalize(nome)
    .split(/[\/,]| E /)
    .flatMap((parte) => parte.trim().split(/\s+/))
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

async function omieCall(endpoint: string, call: string, param: Record<string, unknown>) {
  const res = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ call, app_key: omieKey, app_secret: omieSecret, param: [param] }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && !data.faultstring, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    if (!omieKey || !omieSecret) {
      return json({ error: "OMIE_API_KEY / OMIE_API_SECRET não configuradas no Supabase" }, 500);
    }

    const { nomes, max_paginas, pagina_inicial, debug_raw, listar_exterior } = await req.json();

    if (debug_raw) {
      const resp = await omieCall("geral/clientes", "ListarClientes", {
        pagina: Number(pagina_inicial) || 1,
        registros_por_pagina: 3,
        apenas_importado_api: "N",
      });
      return json(resp.data);
    }

    // Modo fornecedores do exterior: usa o flag nativo do Omie (exterior: "S"),
    // não depende de nome — varre e devolve todos os clientes/fornecedores
    // marcados como exterior no intervalo de páginas pedido.
    if (listar_exterior) {
      const maxPag = Math.min(Number(max_paginas) || 60, 150);
      let pag = Number(pagina_inicial) || 1;
      const pagIni = pag;
      const pagLim = pagIni + maxPag - 1;
      let totalPag = pag;
      let totalReg = 0;
      const exterior: unknown[] = [];

      while (pag <= totalPag && pag <= pagLim) {
        const resp = await omieCall("geral/clientes", "ListarClientes", {
          pagina: pag,
          registros_por_pagina: 50,
          apenas_importado_api: "N",
        });
        if (!resp.ok) {
          const fault = resp.data?.faultstring || "erro desconhecido";
          if (/redundante|REDUNDANT/i.test(fault)) {
            const seg = fault.match(/(\d+)\s*segundos?/)?.[1] || "60";
            return json({ error: `⏳ Omie bloqueou chamadas repetidas — aguarde ${seg}s e tente de novo.`, paginas_lidas: pag - 1, exterior }, 429);
          }
          return json({ error: `Omie: ${fault}`, paginas_lidas: pag - 1, exterior }, 400);
        }

        totalPag = resp.data.total_de_paginas || 1;
        totalReg = resp.data.total_de_registros || totalReg;
        const clientes = resp.data.clientes_cadastro || [];

        for (const c of clientes) {
          if (c.exterior === "S" || (c.codigo_pais && String(c.codigo_pais) !== "1058")) {
            exterior.push({
              codigo_cliente_omie: c.codigo_cliente_omie,
              razao_social: c.razao_social,
              nome_fantasia: c.nome_fantasia,
              cnpj_cpf: c.cnpj_cpf,
              pessoa_fisica: c.pessoa_fisica,
              codigo_pais: c.codigo_pais,
              exterior: c.exterior,
              email: c.email,
              telefone1: [c.telefone1_ddd, c.telefone1_numero].filter(Boolean).join(" "),
              homepage: c.homepage,
              endereco: c.endereco,
              endereco_numero: c.endereco_numero,
              bairro: c.bairro,
              cidade: c.cidade,
              estado: c.estado,
              cep: c.cep,
              tags: c.tags,
              inativo: c.inativo,
            });
          }
        }

        pag++;
      }

      return json({
        total_de_paginas_omie: totalPag,
        pagina_inicial: pagIni,
        paginas_lidas: pag - 1,
        proxima_pagina: pag <= totalPag ? pag : null,
        total_registros_omie: totalReg,
        atingiu_limite: pag > pagLim && pag <= totalPag,
        exterior,
      });
    }

    if (!Array.isArray(nomes) || nomes.length === 0) {
      return json({ error: "Envie { nomes: string[] } ou { listar_exterior: true }" }, 400);
    }

    const buscaTokens: { original: string; tokens: string[] }[] = nomes.map((n: string) => ({
      original: n,
      tokens: tokensDe(n),
    }));

    const maxPaginasNesteCall = Math.min(Number(max_paginas) || 60, 150);
    let pagina = Number(pagina_inicial) || 1;
    const paginaInicial = pagina;
    const paginaLimite = paginaInicial + maxPaginasNesteCall - 1;
    let totalPaginas = pagina;
    let totalRegistros = 0;
    const matches: Record<string, unknown[]> = {};
    for (const b of buscaTokens) matches[b.original] = [];

    while (pagina <= totalPaginas && pagina <= paginaLimite) {
      const resp = await omieCall("geral/clientes", "ListarClientes", {
        pagina,
        registros_por_pagina: 50,
        apenas_importado_api: "N",
      });
      if (!resp.ok) {
        const fault = resp.data?.faultstring || "erro desconhecido";
        if (/redundante|REDUNDANT/i.test(fault)) {
          const seg = fault.match(/(\d+)\s*segundos?/)?.[1] || "60";
          return json({ error: `⏳ Omie bloqueou chamadas repetidas — aguarde ${seg}s e tente de novo.`, paginas_lidas: pagina - 1, matches }, 429);
        }
        return json({ error: `Omie: ${fault}`, paginas_lidas: pagina - 1, matches }, 400);
      }

      totalPaginas = resp.data.total_de_paginas || 1;
      totalRegistros = resp.data.total_de_registros || totalRegistros;
      const clientes = resp.data.clientes_cadastro || [];

      for (const c of clientes) {
        const razao = normalize(c.razao_social || "");
        const fantasia = normalize(c.nome_fantasia || "");
        const alvo = `${razao} ${fantasia}`;
        for (const b of buscaTokens) {
          const bate = b.tokens.length > 0 && b.tokens.every((tok) => {
            const re = new RegExp(`(^|\\s)${tok}(\\s|$)`);
            return re.test(alvo);
          });
          if (bate) {
            matches[b.original].push({
              codigo_cliente_omie: c.codigo_cliente_omie,
              razao_social: c.razao_social,
              nome_fantasia: c.nome_fantasia,
              cnpj_cpf: c.cnpj_cpf,
              telefone1: [c.telefone1_ddd, c.telefone1_numero].filter(Boolean).join(" "),
              email: c.email,
              endereco: c.endereco,
              endereco_numero: c.endereco_numero,
              bairro: c.bairro,
              cidade: c.cidade,
              estado: c.estado,
              cep: c.cep,
              tags: c.tags,
            });
          }
        }
      }

      pagina++;
    }

    return json({
      total_de_paginas_omie: totalPaginas,
      pagina_inicial: paginaInicial,
      paginas_lidas: pagina - 1,
      proxima_pagina: pagina <= totalPaginas ? pagina : null,
      total_registros_omie: totalRegistros,
      atingiu_limite: pagina > paginaLimite && pagina <= totalPaginas,
      matches,
    });
  } catch (error) {
    console.error("Erro geral:", error);
    return json({ error: `Erro: ${(error as Error).message}` }, 500);
  }
});
