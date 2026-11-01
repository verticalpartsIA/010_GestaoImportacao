/* conferir-clientes-omie — TEMPORÁRIA, SÓ LEITURA (31/10/2026, Gelson).
   Cruza uma lista de CNPJs (corpo da chamada) com a listagem do Omie
   (geral/clientes ListarClientesResumido, 100 por página). Não escreve no Omie
   nem no banco. Para ao primeiro sinal de bloqueio/consumo do Omie.
   Corpo: { cnpjs: ["14 dígitos", ...], pagina_ini: 1, pagina_fim: 40 } */
const H = { "Content-Type": "application/json" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
const key = Deno.env.get("OMIE_API_KEY") || "";
const secret = Deno.env.get("OMIE_API_SECRET") || "";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST" }, 405);
  if (!key || !secret) return json({ erro: "credenciais do Omie ausentes" });
  const b = await req.json().catch(() => ({}));
  const alvo = new Set((Array.isArray(b.cnpjs) ? b.cnpjs : []).map((x: unknown) => String(x).replace(/\D/g, "")).filter((x: string) => x.length === 14 || x.length === 11));
  const ini = Math.max(1, Number(b.pagina_ini) || 1);
  const fim = Math.max(ini, Number(b.pagina_fim) || ini);
  const achados: unknown[] = [];
  let pagina = ini, total = 0, parou: string | null = null;
  const t0 = Date.now();
  for (; pagina <= fim; pagina++) {
    if (Date.now() - t0 > 110000) { parou = "tempo"; break; }
    let res: Response, data: any;
    try {
      res = await fetch("https://app.omie.com.br/api/v1/geral/clientes/", {
        method: "POST", headers: H,
        body: JSON.stringify({ call: "ListarClientesResumido", app_key: key, app_secret: secret, param: [{ pagina, registros_por_pagina: 100, apenas_importado_api: "N" }] }),
      });
      data = await res.json().catch(() => ({}));
    } catch (e) { parou = "rede: " + String(e); break; }
    if (!res.ok || data.faultstring) {
      parou = "omie: " + (data.faultstring || res.status);
      break;
    }
    total = data.total_de_paginas || total;
    for (const c of data.clientes_cadastro_resumido || []) {
      const d = String(c.cnpj_cpf || "").replace(/\D/g, "");
      if (d && alvo.has(d)) achados.push({ cnpj: d, codigo_omie: c.codigo_cliente, razao_social: c.razao_social, nome_fantasia: c.nome_fantasia });
    }
    if (total && pagina >= total) { pagina++; break; }
    await sleep(500);
  }
  return json({ achados, ultima_pagina_lida: pagina - 1, proxima_pagina: parou ? pagina : (total && pagina > total ? null : pagina), total_de_paginas: total, parou });
});
