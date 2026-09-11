/* ============================================================
   omie_sync_pagamentos_instaladores — sincroniza pagamentos do Omie
   pras Empresas Instaladoras, gravando cache em omie_pagamentos_cache.

   Matching pra achar a obra (dossier_obra) de cada título, em ordem
   de confiança:
   1) numero_documento no Omie às vezes traz "Elevador N° Série:
      500.0389" — bate direto com equipamentos_obra.numero_serie.
   2) Sem isso, resolve o nome do Projeto (codigo_projeto) via
      ConsultarProjeto e tenta achar client_name de dossier_obra
      contido nesse nome (só quando é candidato único — ambíguo não
      vincula).

   Fonte dos dados (10-11/09): trocado de financas/contapagar
   (ListarContasPagar) pra financas/mf (ListarMovimentos). O primeiro
   NUNCA reflete pagamento parcial — um título com baixa parcial real
   (comparado com o relatório oficial do Omie, "Situação: Pago
   Parcialmente") volta lá com status_titulo "PAGO" e valor_pag=0,
   como se estivesse 100% pago. O segundo (financas/mf) devolve, pra
   cada lançamento, um objeto "detalhes" (mesmos campos de sempre,
   nomeados como no Omie: cNumTitulo = numero_documento, nCodTitulo =
   codigo_lancamento_omie, cStatus = status_titulo, cNumParcela,
   nValorTitulo, dDtVenc/dDtPrevisao/dDtRegistro/dDtPagamento) MAIS um
   "resumo" (nValPago/nValAberto/nValLiquido/cLiquidado) com o valor
   pago/a pagar de verdade, já resolvido pelo próprio Omie — confirmado
   testando o mesmo título parcial (R$1.650 pago / R$2.640 a pagar,
   batendo exatamente com o relatório). Não precisa mais cruzar
   manualmente com financas/contacorrentelancamentos (rota descartada
   por custo de rate-limit — ver PR #349 e issue de investigação).

   MODO DEBUG: debug_cpf_cnpj (financas/mf), debug_projeto (contas a
   pagar por projeto), debug_buscar_projeto, debug_cliente_codigo —
   exigem header x-debug-key igual ao secret OMIE_SYNC_DEBUG_KEY
   (função roda com verify_jwt:false de propósito, pro botão do
   frontend, então sem esse gate qualquer chamador com a ANON_SB
   conseguia puxar dados financeiros crus de qualquer CPF/CNPJ —
   achado do review bot, PR #349). Sem a secret configurada, debug
   fica sempre desligado.
   SYNC COMPLETO: POST {} (ou { empresa_id: "..." } pra só uma).
   ============================================================ */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";
// Gate pros ramos debug_* — sem isso, qualquer chamador com a ANON_SB
// (a função roda com verify_jwt:false, de propósito, pro botão
// "Atualizar pagamentos" do frontend) conseguia arrancar dados
// financeiros crus do Omie de qualquer CPF/CNPJ, sem precisar nem ser
// desta empresa (achado do review bot, PR #349). Sem
// OMIE_SYNC_DEBUG_KEY configurada, os ramos de debug ficam sempre
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

type Movimento = { detalhes: Record<string, unknown>; resumo: Record<string, unknown> };

// financas/mf ListarMovimentos — cada item já vem com "detalhes" (o
// título em si) e "resumo" (valor pago/a pagar reais, resolvidos pelo
// Omie a partir das baixas, mesmo quando parciais). Ver comentário no
// topo do arquivo.
async function listarMovimentosPorDoc(doc: string, maxPaginas = 20): Promise<Movimento[]> {
  const movimentos: Movimento[] = [];
  let pagina = 1;
  let totalPaginas = 1;
  while (pagina <= totalPaginas && pagina <= maxPaginas) {
    const resp = await omieCall("financas/mf", "ListarMovimentos", {
      nPagina: pagina,
      nRegPorPagina: 100,
      cCPFCNPJCliente: doc,
    });
    if (!resp.ok) {
      const fault = resp.data?.faultstring || "";
      if (/redundante|REDUNDANT/i.test(fault)) {
        const seg = fault.match(/(\d+)\s*segundos?/)?.[1] || "60";
        throw new Error(`REDUNDANT:${seg}`);
      }
      // financas/mf só acha um documento se ele também estiver cadastrado
      // como "Cliente" no Omie (nem todo Fornecedor tem isso, achado
      // rodando a sincronização real 11/09) — pra esses, o Omie nunca vai
      // achar nada por esse filtro; tratar como "sem resultados" em vez
      // de erro retentável (senão fica gastando rate-limit à toa numa
      // consulta que nunca vai funcionar).
      if (/nenhum registro|n[aã]o encontrad|nenhum cliente cadastrado/i.test(fault)) break;
      throw new Error(fault || "erro desconhecido no Omie");
    }
    totalPaginas = resp.data.nTotPaginas || 1;
    const registros = (resp.data.movimentos || []) as Movimento[];
    movimentos.push(...registros);
    pagina++;
  }
  return movimentos;
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
    const { debug_cpf_cnpj, empresa_id } = body;
    const debug_projeto = body.debug_projeto;
    const debug_buscar_projeto = body.debug_buscar_projeto;
    const debug_cliente_codigo = body.debug_cliente_codigo;
    const pediuDebug = debug_cpf_cnpj || debug_projeto || debug_buscar_projeto || debug_cliente_codigo;

    if (pediuDebug) {
      if (!debugKey || req.headers.get("x-debug-key") !== debugKey) {
        return json({ error: "Não autorizado" }, 403);
      }

      if (debug_cpf_cnpj) {
        const doc = soDigitos(debug_cpf_cnpj);
        const movimentos = await listarMovimentosPorDoc(doc);
        return json({ doc, total: movimentos.length, movimentos });
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

    type MovimentoBruto = { m: Movimento; doc: string; empresaId: string; colaboradorId: string | null; fonte: string };
    type Pendencia = { doc: string; empresaId: string; colaboradorId: string | null; fonte: string; label: string; erro: string };
    const brutos: MovimentoBruto[] = [];
    const pendencias: Pendencia[] = [];
    let erroGeral: string | null = null;

    async function buscarComRetry(doc: string, empresaId: string, colaboradorId: string | null, fonte: string, label: string): Promise<boolean> {
      try {
        const movimentos = await listarMovimentosPorDoc(doc);
        for (const m of movimentos) brutos.push({ m, doc, empresaId, colaboradorId, fonte });
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
          const movimentos = await listarMovimentosPorDoc(p.doc);
          for (const m of movimentos) brutos.push({ m, doc: p.doc, empresaId: p.empresaId, colaboradorId: p.colaboradorId, fonte: p.fonte });
        } catch (e) {
          falhasFinais.push({ label: p.label, erro: (e as Error).message });
        }
        await sleep(500);
      }
    }

    // financas/mf mistura Contas a Pagar e a Receber pro mesmo CPF/CNPJ
    // (raro pra instalador, mas possível) — só nos interessa o que a
    // VerticalParts paga a ele, nunca o que ele nos deve.
    const brutosPagar = brutos.filter(({ m }) => {
      const grupo = normalize(m.detalhes?.cGrupo as string);
      const natureza = normalize(m.detalhes?.cNatureza as string);
      return grupo === "CONTA_A_PAGAR" || natureza === "P";
    });

    const projetoNomeCache = new Map<number, string | null>();
    for (const b of brutosPagar) {
      const serie = extraiNumeroSerie(b.m.detalhes.cNumTitulo as string);
      if (serie) continue;
      const cod = b.m.detalhes.cCodProjeto as number;
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
    // nos resultados da consulta, e um cancelado é filtrado antes de
    // chegar lá). Sem apagar explicitamente, a linha antiga ficava pra
    // sempre inflando total/pago (achado do review bot, PR #349).
    const canceladosKeys = Array.from(
      new Map(
        brutosPagar
          .filter(({ m }) => isCancelado(m.detalhes.cStatus as string))
          .map(({ m, doc }) => [`${m.detalhes.nCodTitulo}|${doc}`, { codigo: m.detalhes.nCodTitulo, doc }]),
      ).values(),
    );

    const rows = brutosPagar
      .filter(({ m }) => !isCancelado(m.detalhes.cStatus as string))
      .map(({ m, doc, empresaId, colaboradorId, fonte }) => {
        const det = m.detalhes;
        const res = m.resumo || {};
        const numeroDocumento = det.cNumTitulo as string;
        const serie = extraiNumeroSerie(numeroDocumento);
        let dossierId: string | null = null;
        let projetoTexto: string | null = null;
        if (serie) {
          dossierId = equipPorSerie.get(normalizeSerie(serie)) || null;
          projetoTexto = numeroDocumento;
        } else {
          const nome = projetoNomeCache.get(det.cCodProjeto as number) || null;
          projetoTexto = nome;
          dossierId = matchPorNomeCliente(nome);
        }
        const valorDocumento = Number(det.nValorTitulo) || 0;
        // resumo.nValPago/nValAberto = valor pago/a pagar reais,
        // considerando baixas parciais — é o mesmo cálculo que o Omie
        // usa no relatório "Situação: Pago Parcialmente" (confirmado
        // testando o título real, ver comentário no topo do arquivo).
        const valorPago = Number(res.nValPago) || 0;
        const valorAPagar = Number(res.nValAberto) || 0;
        const pago = valorAPagar <= 0.005;
        return {
          codigo_lancamento_omie: det.nCodTitulo,
          cpf_cnpj_consultado: doc,
          empresa_id: empresaId,
          colaborador_id: colaboradorId,
          fonte,
          projeto_texto: projetoTexto,
          dossier_id: dossierId,
          valor_documento: valorDocumento,
          valor_pago: valorPago,
          valor_a_pagar: valorAPagar,
          status_titulo: det.cStatus,
          pago,
          data_vencimento: converteData(det.dDtVenc as string),
          data_previsao: converteData(det.dDtPrevisao as string),
          data_registro: converteData(det.dDtRegistro as string),
          data_pagamento: converteData(det.dDtPagamento as string),
          numero_documento_fiscal: det.cNumDocFiscal,
          numero_pedido: det.cNumParcela,
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
