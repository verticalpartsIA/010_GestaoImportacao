/* ============================================================
   omie_sync_pagamentos_instaladores — sincroniza Contas a Pagar do
   Omie pras Empresas Instaladoras, gravando cache em
   omie_pagamentos_cache.

   Matching pra achar a obra (dossier_obra) de cada título, em ordem
   de confiança:
   1) numero_documento no Omie às vezes traz "Elevador N° Série:
      500.0389" — bate direto com equipamentos_obra.numero_serie.
   2) Sem isso, resolve o nome do Projeto (codigo_projeto) via
      ConsultarProjeto e tenta achar client_name de dossier_obra
      contido nesse nome (só quando é candidato único — ambíguo não
      vincula).

   Valor pago/a pagar (10/09): o Omie permite baixa PARCIAL de um
   título (status_titulo = "PAGTO_PARCIAL", diferente de "PAGO") — o
   campo valor_pag da própria listagem já traz o saldo em aberto
   ("Valor a Pagar" na tela do Omie), então valor_pago é sempre
   derivado como valor_documento - valor_a_pagar, nunca um booleano
   tudo-ou-nada. Título CANCELADO não é mais sincronizado (não é uma
   obrigação real).

   MODO DEBUG: ver ramos abaixo (debug_cpf_cnpj, debug_consultar,
   debug_projeto, debug_buscar_projeto, debug_cliente_codigo) — exigem
   header x-debug-key igual ao secret OMIE_SYNC_DEBUG_KEY (função roda
   com verify_jwt:false de propósito, pro botão do frontend, então sem
   esse gate qualquer chamador com a ANON_SB conseguia puxar Contas a
   Pagar/Projetos/Clientes crus de qualquer CPF/CNPJ — achado do review
   bot, PR #349). Sem a secret configurada, debug fica sempre desligado.
   SYNC COMPLETO: POST {} (ou { empresa_id: "..." } pra só uma).
   ============================================================ */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";
// Gate pros ramos debug_* — sem isso, qualquer chamador com a ANON_SB
// (a função roda com verify_jwt:false, de propósito, pro botão
// "Atualizar pagamentos" do frontend) conseguia arrancar Contas a
// Pagar/Projetos/Clientes crus do Omie de qualquer CPF/CNPJ, sem
// precisar nem ser desta empresa (achado do review bot, PR #349).
// Sem OMIE_SYNC_DEBUG_KEY configurada, os ramos de debug ficam sempre
// desligados (não tem fallback aberto).
const debugKey = Deno.env.get("OMIE_SYNC_DEBUG_KEY") || "";

const sb = createClient(supabaseUrl, supabaseServiceKey);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function soDigitos(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

function normalizeSerie(s: string | null | undefined): string {
  return (s || "").replace(/\s+/g, "").toUpperCase();
}

function extraiNumeroSerie(numeroDocumento: string | null | undefined): string | null {
  if (!numeroDocumento) return null;
  const m = /s[ée]rie:?\s*([\d.\-\/]+)/i.exec(numeroDocumento);
  return m ? m[1].trim() : null;
}

function converteData(br: string | null | undefined): string | null {
  if (!br) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function isPago(statusTitulo: string): boolean {
  return normalize(statusTitulo) === "PAGO";
}

function isCancelado(statusTitulo: string): boolean {
  return normalize(statusTitulo) === "CANCELADO";
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

async function listarContasPagarPorDoc(doc: string, maxPaginas = 20) {
  const titulos: Record<string, unknown>[] = [];
  let pagina = 1;
  let totalPaginas = 1;
  while (pagina <= totalPaginas && pagina <= maxPaginas) {
    const resp = await omieCall("financas/contapagar", "ListarContasPagar", {
      pagina,
      registros_por_pagina: 50,
      filtrar_por_cpf_cnpj: doc,
      exibir_obs: "N",
    });
    if (!resp.ok) {
      const fault = resp.data?.faultstring || "";
      if (/redundante|REDUNDANT/i.test(fault)) {
        const seg = fault.match(/(\d+)\s*segundos?/)?.[1] || "60";
        throw new Error(`REDUNDANT:${seg}`);
      }
      if (/nenhum registro|n[aã]o encontrad/i.test(fault)) break;
      throw new Error(fault || "erro desconhecido no Omie");
    }
    totalPaginas = resp.data.total_de_paginas || 1;
    const registros = resp.data.conta_pagar_cadastro || [];
    titulos.push(...registros);
    pagina++;
  }
  return titulos;
}

async function consultarNomeProjeto(codigo: number): Promise<string | null> {
  const resp = await omieCall("geral/projetos", "ConsultarProjeto", { codigo });
  if (!resp.ok) return null;
  return resp.data?.nome || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    if (!omieKey || !omieSecret) {
      return json({ error: "OMIE_API_KEY / OMIE_API_SECRET não configuradas no Supabase" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const { debug_cpf_cnpj, debug_consultar, empresa_id } = body;
    const debug_projeto = body.debug_projeto;
    const debug_buscar_projeto = body.debug_buscar_projeto;
    const debug_cliente_codigo = body.debug_cliente_codigo;
    const pediuDebug = debug_cpf_cnpj || debug_consultar || debug_projeto || debug_buscar_projeto || debug_cliente_codigo;

    if (pediuDebug) {
      if (!debugKey || req.headers.get("x-debug-key") !== debugKey) {
        return json({ error: "Não autorizado" }, 403);
      }

      if (debug_cpf_cnpj) {
        const doc = soDigitos(debug_cpf_cnpj);
        const titulos = await listarContasPagarPorDoc(doc);
        return json({ doc, total: titulos.length, titulos });
      }

      if (debug_consultar) {
        const resp = await omieCall("financas/contapagar", "ConsultarContaPagar", { codigo_lancamento_omie: debug_consultar });
        return json(resp.data);
      }

      if (debug_projeto) {
        const resp = await omieCall("financas/contapagar", "ListarContasPagar", {
          pagina: 1, registros_por_pagina: 50, filtrar_por_projeto: debug_projeto,
        });
        return json(resp.data);
      }

      if (debug_buscar_projeto) {
        const resp = await omieCall("geral/projetos", "ListarProjetos", {
          pagina: 1, registros_por_pagina: 20, nome_projeto: debug_buscar_projeto,
        });
        return json(resp.data);
      }

      if (debug_cliente_codigo) {
        const resp = await omieCall("geral/clientes", "ConsultarCliente", { codigo_cliente_omie: debug_cliente_codigo });
        return json(resp.data);
      }
    }

    // ---- Sync completo ----
    const { data: logRow } = await sb
      .from("omie_pagamentos_sync_log")
      .insert({ iniciado_em: new Date().toISOString() })
      .select("id")
      .single();
    const logId = logRow?.id;

    let empresasQuery = sb.from("parceiros_instaladores").select("id, nome, cnpj");
    if (empresa_id) empresasQuery = empresasQuery.eq("id", empresa_id);
    const { data: empresas } = await empresasQuery;

    const empresaIds = (empresas || []).map((e) => e.id);
    const { data: colaboradores } = empresaIds.length
      ? await sb.from("parceiros_colaboradores").select("id, empresa_id, cpf, nome_completo").in("empresa_id", empresaIds)
      : { data: [] as Record<string, unknown>[] };

    const { data: dossiers } = await sb.from("dossier_obra").select("id, building_name, client_name");
    const { data: equipamentos } = await sb.from("equipamentos_obra").select("numero_serie, dossier_id");

    const equipPorSerie = new Map<string, string>();
    for (const eq of equipamentos || []) {
      const serie = normalizeSerie(eq.numero_serie as string);
      if (serie && !equipPorSerie.has(serie)) equipPorSerie.set(serie, eq.dossier_id as string);
    }

    function matchPorNomeCliente(nomeProjeto: string | null): string | null {
      const alvo = normalize(nomeProjeto);
      if (!alvo) return null;
      const candidatos = (dossiers || []).filter((d: Record<string, unknown>) => {
        const cn = normalize(d.client_name as string);
        return cn && cn.length >= 4 && alvo.includes(cn);
      });
      return candidatos.length === 1 ? (candidatos[0].id as string) : null;
    }

    type TituloBruto = { t: Record<string, unknown>; doc: string; empresaId: string; colaboradorId: string | null; fonte: string };
    type Pendencia = { doc: string; empresaId: string; colaboradorId: string | null; fonte: string; label: string; erro: string };
    const brutos: TituloBruto[] = [];
    const pendencias: Pendencia[] = [];
    let erroGeral: string | null = null;

    async function buscarComRetry(doc: string, empresaId: string, colaboradorId: string | null, fonte: string, label: string): Promise<boolean> {
      try {
        const titulos = await listarContasPagarPorDoc(doc);
        for (const t of titulos) brutos.push({ t, doc, empresaId, colaboradorId, fonte });
        return true;
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.startsWith("REDUNDANT")) { erroGeral = msg; return false; }
        pendencias.push({ doc, empresaId, colaboradorId, fonte, label, erro: msg });
        return true;
      }
    }

    for (const emp of empresas || []) {
      const cnpj = soDigitos(emp.cnpj as string);
      if (!cnpj) continue;
      const ok = await buscarComRetry(cnpj, emp.id as string, null, "empresa", (emp.nome as string) || emp.id as string);
      if (!ok) break;
      await sleep(350);
    }

    if (!erroGeral) {
      for (const col of colaboradores || []) {
        const cpf = soDigitos(col.cpf as string);
        if (!cpf) continue;
        const ok = await buscarComRetry(cpf, col.empresa_id as string, col.id as string, "colaborador", (col.nome_completo as string) || col.id as string);
        if (!ok) break;
        await sleep(350);
      }
    }

    const falhasFinais: { label: string; erro: string }[] = [];
    if (!erroGeral && pendencias.length) {
      await sleep(1500);
      for (const p of pendencias) {
        try {
          const titulos = await listarContasPagarPorDoc(p.doc);
          for (const t of titulos) brutos.push({ t, doc: p.doc, empresaId: p.empresaId, colaboradorId: p.colaboradorId, fonte: p.fonte });
        } catch (e) {
          falhasFinais.push({ label: p.label, erro: (e as Error).message });
        }
        await sleep(500);
      }
    }

    const projetoNomeCache = new Map<number, string | null>();
    for (const b of brutos) {
      const serie = extraiNumeroSerie(b.t.numero_documento as string);
      if (serie) continue;
      const cod = b.t.codigo_projeto as number;
      if (!cod || projetoNomeCache.has(cod)) continue;
      try {
        const nome = await consultarNomeProjeto(cod);
        projetoNomeCache.set(cod, nome);
      } catch (e) {
        console.warn("erro ConsultarProjeto", cod, (e as Error).message);
        projetoNomeCache.set(cod, null);
      }
      await sleep(350);
    }

    // Títulos que o Omie já marcou CANCELADO nesta rodada não entram no
    // upsert (não são mais uma obrigação real) — mas se um título que já
    // estava no cache como aberto/pago virar CANCELADO depois, o upsert
    // sozinho nunca ia tocar essa linha (ela só recebe update quando volta
    // nos resultados do ListarContasPagar, e um cancelado é filtrado antes
    // de chegar lá). Sem apagar explicitamente, a linha antiga ficava pra
    // sempre inflando total/pago (achado do review bot, PR #349).
    const canceladosKeys = Array.from(
      new Map(
        brutos
          .filter(({ t }) => isCancelado((t.status_titulo || "") as string))
          .map(({ t, doc }) => [`${t.codigo_lancamento_omie}|${doc}`, { codigo: t.codigo_lancamento_omie, doc }]),
      ).values(),
    );

    const rows = brutos
      .filter(({ t }) => !isCancelado((t.status_titulo || "") as string))
      .map(({ t, doc, empresaId, colaboradorId, fonte }) => {
        const serie = extraiNumeroSerie(t.numero_documento as string);
        let dossierId: string | null = null;
        let projetoTexto: string | null = null;
        if (serie) {
          dossierId = equipPorSerie.get(normalizeSerie(serie)) || null;
          projetoTexto = t.numero_documento as string;
        } else {
          const nome = projetoNomeCache.get(t.codigo_projeto as number) || null;
          projetoTexto = nome;
          dossierId = matchPorNomeCliente(nome);
        }
        const valorDocumento = Number(t.valor_documento) || 0;
        // valor_pag = "Valor a Pagar" nativo do Omie (saldo em aberto do
        // título, já considerando baixas parciais). Quando por algum
        // motivo o Omie não devolve o campo, cai pro booleano de status
        // como fallback (mesmo comportamento de antes) em vez de quebrar.
        const valorAPagarBruto = t.valor_pag;
        const statusPagoLegado = isPago((t.status_titulo || "") as string);
        const valorAPagar = valorAPagarBruto != null
          ? Number(valorAPagarBruto) || 0
          : (statusPagoLegado ? 0 : valorDocumento);
        const valorPago = Math.max(0, valorDocumento - valorAPagar);
        const pago = valorAPagar <= 0.005;
        const info = t.info as Record<string, unknown> | undefined;
        return {
          codigo_lancamento_omie: t.codigo_lancamento_omie,
          cpf_cnpj_consultado: doc,
          empresa_id: empresaId,
          colaborador_id: colaboradorId,
          fonte,
          projeto_texto: projetoTexto,
          dossier_id: dossierId,
          valor_documento: valorDocumento,
          valor_pago: valorPago,
          valor_a_pagar: valorAPagar,
          status_titulo: t.status_titulo,
          pago,
          data_vencimento: converteData(t.data_vencimento as string),
          data_previsao: converteData(t.data_previsao as string),
          data_registro: converteData(t.data_entrada as string),
          data_pagamento: pago ? converteData(info?.dAlt as string) : null,
          numero_documento_fiscal: t.numero_documento_fiscal,
          numero_pedido: t.numero_parcela,
          atualizado_em: new Date().toISOString(),
        };
      });

    const rowsDedup = Array.from(
      new Map(rows.map((r) => [`${r.codigo_lancamento_omie}|${r.cpf_cnpj_consultado}`, r])).values(),
    );

    let gravados = 0;
    const errosGravacao: string[] = [];
    if (rowsDedup.length) {
      for (let i = 0; i < rowsDedup.length; i += 200) {
        const lote = rowsDedup.slice(i, i + 200);
        const { error } = await sb
          .from("omie_pagamentos_cache")
          .upsert(lote, { onConflict: "codigo_lancamento_omie,cpf_cnpj_consultado" });
        if (error) { console.warn("upsert falhou", error.message); errosGravacao.push(error.message); }
        else gravados += lote.length;
      }
    }
    let removidos = 0;
    for (const k of canceladosKeys) {
      const { error } = await sb
        .from("omie_pagamentos_cache")
        .delete()
        .eq("codigo_lancamento_omie", k.codigo)
        .eq("cpf_cnpj_consultado", k.doc);
      if (error) { console.warn("delete de cancelado falhou", error.message); errosGravacao.push(error.message); }
      else removidos++;
    }

    const partesErro = [
      erroGeral,
      errosGravacao.length ? errosGravacao.join(" | ") : null,
      falhasFinais.length ? `Falhou pra: ${falhasFinais.map((f) => f.label).join(", ")}` : null,
    ].filter(Boolean);
    const erroFinal = partesErro.length ? partesErro.join(" | ") : null;

    if (logId) {
      await sb.from("omie_pagamentos_sync_log").update({
        concluido_em: new Date().toISOString(),
        empresas_consultadas: (empresas || []).length,
        titulos_gravados: gravados,
        erro: erroFinal,
      }).eq("id", logId);
    }

    return json({
      sucesso: !erroGeral && !errosGravacao.length,
      empresas_consultadas: (empresas || []).length,
      colaboradores_consultados: (colaboradores || []).length,
      titulos_gravados: gravados,
      titulos_cancelados_removidos: removidos,
      falhas: falhasFinais,
      erro: erroFinal,
    });
  } catch (error) {
    console.error("Erro geral:", error);
    return json({ error: `Erro: ${(error as Error).message}` }, 500);
  }
});
