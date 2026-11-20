// @ts-nocheck
// ============================================================
// boletos-score-sync — Edge Function (vpprd). Boletos Avisos › histórico de pagamento (17/11/2026).
//
// Lê do Omie (SÓ LEITURA) os títulos a receber com data de vencimento e de pagamento e grava em
// boletos_avisos_historico. É a base do "Índice de inadimplência" e da "Consulta de cliente (score)".
//
// Ações (corpo JSON {"acao": ...}); todas exigem o header x-cron-secret (segredo guardado no banco):
//   sondar       lê 1 página pequena (últimos 7 dias) e devolve o registro CRU e o mapeado, sem gravar nada.
//                Serve para conferir os nomes de campo do Omie antes de qualquer carga.
//   carga        desde 01/01/2024: janelas mensais por vencimento, até hoje + 730 dias.
//   incremental  diário: vencimento de hoje-120 a hoje+730 e pagamentos dos últimos 45 dias.
//
// Cada invocação trabalha até ~100 s, grava o cursor (boletos_avisos_score_cursor) e se encadeia
// (EdgeRuntime.waitUntil) até acabar: o gateway derruba a chamada em 150 s. Depois dos títulos, resolve a
// razão social/CNPJ dos clientes que ainda não têm, 40 por invocação.
//
// Regras do Omie (CLAUDE.md Art. 30): só leitura, pausa entre chamadas, NUNCA repetir chamada que deu erro
// (o Omie bloqueia a API toda por 30 min depois de ~10 erros seguidos) — o erro encerra a rodada e fica no cursor.
// Sem supabase-js (Art. 23): fetch + PostgREST.
// CONFERIDO em 17/11/2026 com a ação `sondar` (cópia de teste, dados reais): filtros cNatureza=R, dDtVencDe/Ate e dDtPagtoDe/Ate
// funcionam; títulos pagos trazem cStatus RECEBIDO, dDtPagamento e resumo.cLiquidado=S; o nº da NF vem em cNumDocFiscal (não cNumTitulo).
// Ainda não verificado: volume da carga inteira (≈265 títulos vencendo por semana → alguns milhares desde 01/01/2024).
// ============================================================

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS"))["default"];
const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";
// chave pública (a mesma de src/supabase.js e dos crons): só para o encadeamento passar pelo verify_jwt
const publishableKey = "sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP";

const INICIO_HISTORICO = "2024-01-01";
const ORCAMENTO_MS = 100_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function hojeBrasil() { return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); }
function somarDias(iso, n) {
  return new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400000).toISOString().slice(0, 10);
}
const brDeISO = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const isoDeBR = (s) => { const [d, m, y] = String(s || "").split("/"); return d && m && y && y.length === 4 ? `${y}-${m}-${d}` : null; };
function decodificar(s) { return String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">"); }

/* ---------- PostgREST ---------- */
function pgHeaders(extra) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...extra };
}
async function pgSelect(tabela, query, range) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${tabela}?${query}`, { headers: pgHeaders(range ? { Range: `${range[0]}-${range[1]}` } : undefined) });
  if (!res.ok) throw new Error(`select ${tabela}: HTTP ${res.status} ${await res.text()}`);
  return await res.json();
}
async function pgSelectTudo(tabela, query) {
  const PAG = 1000; const out = []; let off = 0;
  for (;;) {
    const d = await pgSelect(tabela, query, [off, off + PAG - 1]);
    out.push(...d);
    if (d.length < PAG) break;
    off += PAG;
  }
  return out;
}
async function pgUpsert(tabela, onConflict, linhas, prefer = "resolution=merge-duplicates,return=minimal") {
  for (let i = 0; i < linhas.length; i += 500) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${tabela}?on_conflict=${onConflict}`, { method: "POST", headers: pgHeaders({ Prefer: prefer }), body: JSON.stringify(linhas.slice(i, i + 500)) });
    if (!res.ok) throw new Error(`upsert ${tabela}: HTTP ${res.status} ${await res.text()}`);
  }
}
async function pgPatch(tabela, filtro, corpo) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${tabela}?${filtro}`, { method: "PATCH", headers: pgHeaders({ Prefer: "return=minimal" }), body: JSON.stringify(corpo) });
  if (!res.ok) throw new Error(`patch ${tabela}: HTTP ${res.status} ${await res.text()}`);
}
async function rpc(nome, args) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${nome}`, { method: "POST", headers: pgHeaders(), body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`rpc ${nome}: HTTP ${res.status}`);
  return await res.json();
}

/* ---------- Omie (só leitura) ---------- */
async function omiePost(endpoint, call, param, tentativa = 1) {
  const res = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ call, app_key: omieKey, app_secret: omieSecret, param: [param] }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.faultstring) {
    // só a recusa por requisição simultânea/redundante é repetida (com espera); qualquer outro erro encerra a rodada
    if (/redundante|redundant|too many requests|j[aá] existe uma requisi/i.test(data.faultstring) && tentativa < 4) {
      await esperar(tentativa * 3000);
      return omiePost(endpoint, call, param, tentativa + 1);
    }
    const e = new Error(`Omie: ${data.faultstring}`); e.fault = data.faultstring; throw e;
  }
  if (!res.ok) throw new Error(`Omie HTTP ${res.status}`);
  return data;
}
const SEM_REGISTROS = /n[aã]o existem? registros|nenhum registro|n[aã]o encontrad/i;

/* ---------- janelas e mapeamento ---------- */
function janelasDe(fase, hoje) {
  const fim = somarDias(hoje, 730);
  if (fase === "carga") {
    const out = [];
    let y = +INICIO_HISTORICO.slice(0, 4), m = +INICIO_HISTORICO.slice(5, 7);
    for (;;) {
      const de = `${y}-${String(m).padStart(2, "0")}-01`;
      if (de > fim) break;
      const ate = new Date(Date.UTC(y, m, 1) - 86400000).toISOString().slice(0, 10);
      out.push({ tipo: "venc", de, ate: ate > fim ? fim : ate });
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }
  return [{ tipo: "venc", de: somarDias(hoje, -120), ate: fim }, { tipo: "pagto", de: somarDias(hoje, -45), ate: hoje }];
}
function paramsDaJanela(j, pagina, porPagina) {
  const p = { nPagina: pagina, nRegPorPagina: porPagina, cNatureza: "R" };
  if (j.tipo === "pagto") { p.dDtPagtoDe = brDeISO(j.de); p.dDtPagtoAte = brDeISO(j.ate); }
  else { p.dDtVencDe = brDeISO(j.de); p.dDtVencAte = brDeISO(j.ate); }
  return p;
}
/* movimento do Omie -> linha de boletos_avisos_historico (null se não for título a receber) */
function mapear(m, agoraISO) {
  const d = m?.detalhes || {}, r = m?.resumo || {};
  if (d.cGrupo && !/RECEBER/i.test(String(d.cGrupo))) return null;
  const id = d.nCodTitulo, cli = d.nCodCliente, venc = isoDeBR(d.dDtVenc);
  if (!id || !cli || !venc) return null;
  const status = String(d.cStatus || "");
  const cancelado = /CANCELAD/i.test(status);
  const aberto = Number(r.nValAberto);
  const liquidado = String(r.cLiquidado || "").toUpperCase() === "S" || /LIQUIDAD|RECEBID/i.test(status);
  const pago = !cancelado && liquidado && !(aberto > 0);   // baixa parcial (ainda há saldo) continua em aberto
  return {
    codigo_lancamento_omie: id,
    codigo_cliente_omie: cli,
    numero_documento: d.cNumDocFiscal || d.cNumTitulo || null,   // o Omie traz o nº da NF em cNumDocFiscal (conferido com `sondar`, 17/11/2026)
    numero_parcela: d.cNumParcela || null,
    data_vencimento: venc,
    data_pagamento: pago ? isoDeBR(d.dDtPagamento) : null,
    valor: d.nValorTitulo ?? null,
    valor_pago: r.nValPago ?? null,
    status_omie: status || null,
    pago,
    cancelado,
    tem_boleto: null,
    atualizado_em: agoraISO,
  };
}

// BEGIN DEDUPE
/* O Omie pode devolver o MESMO título mais de uma vez na mesma página (o título e uma baixa dele, por exemplo). O banco recusa
   um lote com a mesma chave duas vezes ("ON CONFLICT DO UPDATE command cannot affect row a second time"): foi isso que parou a
   carga de 17/11/2026 na janela 29. Fica uma linha por título: a paga (com a pagamento mais recente) vence; entre abertas, a última. */
function unicosPorTitulo(linhas) {
  const porId = new Map();
  for (const l of linhas) {
    const a = porId.get(l.codigo_lancamento_omie);
    if (!a) { porId.set(l.codigo_lancamento_omie, l); continue; }
    let fica = l;
    if (a.pago && !l.pago) fica = a;
    else if (a.pago && l.pago) fica = String(l.data_pagamento || "") >= String(a.data_pagamento || "") ? l : a;
    porId.set(l.codigo_lancamento_omie, fica);
  }
  return [...porId.values()];
}
// END DEDUPE

/* ---------- clientes (razão social e CNPJ dos que ainda não têm) ---------- */
async function resolverClientes(limite, prazo) {
  const pendentes = await pgSelect("boletos_avisos_clientes", `select=codigo_cliente_omie&razao_social=is.null&order=codigo_cliente_omie&limit=${limite}`);
  let resolvidos = 0, errosSeguidos = 0;
  for (const p of pendentes) {
    if (Date.now() > prazo) break;
    try {
      const c = await omiePost("geral/clientes", "ConsultarCliente", { codigo_cliente_omie: p.codigo_cliente_omie });
      await pgPatch("boletos_avisos_clientes", `codigo_cliente_omie=eq.${p.codigo_cliente_omie}`, {
        razao_social: decodificar(c.razao_social) || "(sem razão social no Omie)",
        cnpj: c.cnpj_cpf || null,
      });
      resolvidos++; errosSeguidos = 0;
    } catch (e) {
      console.warn("[boletos-score-sync] cliente", p.codigo_cliente_omie, String(e?.message || e));
      if (++errosSeguidos >= 3) break;
    }
    await esperar(300);
  }
  const restam = await pgSelect("boletos_avisos_clientes", "select=codigo_cliente_omie&razao_social=is.null&limit=1");
  return { resolvidos, restam: restam.length > 0 };
}

async function cursor() { return (await pgSelect("boletos_avisos_score_cursor", "id=eq.true"))[0]; }
async function gravarCursor(c) { await pgPatch("boletos_avisos_score_cursor", "id=eq.true", { ...c, atualizado_em: new Date().toISOString() }); }

/* ---------- uma fatia de trabalho ---------- */
async function trabalhar(fase, inicio) {
  const t0 = Date.now(), prazo = t0 + ORCAMENTO_MS;
  const hoje = hojeBrasil();
  let c = await cursor();
  // outra rodada em andamento (parada há menos de 6 h) não é interrompida: quem chegou depois espera a vez
  if (c.fase !== "ocioso" && c.fase !== fase && Date.now() - new Date(c.atualizado_em).getTime() < 6 * 3600e3) {
    return { ok: true, concluido: true, ocupado: true, fase_em_andamento: c.fase };
  }
  if (c.fase !== fase) {   // começo de uma rodada
    c = { fase, etapa: "titulos", janela_idx: 0, proxima_pagina: 1, titulos_lidos: 0, iniciado_em: new Date().toISOString(), concluido_em: null, ultimo_resultado: null };
    await gravarCursor(c);
  }
  const janelas = janelasDe(fase, hoje);
  const agoraISO = new Date().toISOString();
  let paginas = 0;

  if (c.etapa === "titulos") {
    while (c.janela_idx < janelas.length) {
      if (Date.now() > prazo) break;
      const j = janelas[c.janela_idx];
      let resp;
      try {
        resp = await omiePost("financas/mf", "ListarMovimentos", paramsDaJanela(j, c.proxima_pagina, 100));
      } catch (e) {
        if (e.fault && SEM_REGISTROS.test(e.fault)) resp = { movimentos: [], nTotPaginas: c.proxima_pagina };
        else {
          // erro: encerra a rodada SEM repetir (Art. 30) e deixa o motivo no cursor
          await gravarCursor({ ...c, ultimo_resultado: { erro: String(e?.message || e), janela: j, pagina: c.proxima_pagina, quando: new Date().toISOString() } });
          return { ok: false, parou_por_erro: String(e?.message || e), janela: j, pagina: c.proxima_pagina };
        }
      }
      paginas++;
      const linhas = unicosPorTitulo((resp.movimentos || []).map((m) => mapear(m, agoraISO)).filter(Boolean));
      if (linhas.length) {
        try {
          await pgUpsert("boletos_avisos_historico", "codigo_lancamento_omie", linhas);
          const clientes = [...new Set(linhas.map((l) => l.codigo_cliente_omie))].map((x) => ({ codigo_cliente_omie: x }));
          await pgUpsert("boletos_avisos_clientes", "codigo_cliente_omie", clientes, "resolution=ignore-duplicates,return=minimal");
        } catch (e) {
          // falha ao gravar: a rodada para e o motivo fica no cursor (antes estourava como 500 e a carga morria sem aviso)
          await gravarCursor({ ...c, ultimo_resultado: { erro: String(e?.message || e), janela: j, pagina: c.proxima_pagina, quando: new Date().toISOString() } });
          return { ok: false, parou_por_erro: String(e?.message || e), janela: j, pagina: c.proxima_pagina };
        }
      }
      c.titulos_lidos += linhas.length;
      const total = resp.nTotPaginas || 1;
      if (c.proxima_pagina >= total) { c.janela_idx++; c.proxima_pagina = 1; } else c.proxima_pagina++;
      await gravarCursor({ janela_idx: c.janela_idx, proxima_pagina: c.proxima_pagina, titulos_lidos: c.titulos_lidos });
      await esperar(400);
    }
    if (c.janela_idx >= janelas.length) {
      // rodada incremental completa: título em aberto da janela de vencimento que o Omie não devolveu mais (excluído) sai das contas
      let sumiram = 0;
      if (fase === "incremental") {
        const j = janelas[0];
        const ids = await pgSelectTudo("boletos_avisos_historico",
          `select=codigo_lancamento_omie&data_vencimento=gte.${j.de}&data_vencimento=lte.${j.ate}&pago=eq.false&cancelado=eq.false&atualizado_em=lt.${c.iniciado_em}`);
        for (let i = 0; i < ids.length; i += 100) {
          await pgPatch("boletos_avisos_historico", `codigo_lancamento_omie=in.(${ids.slice(i, i + 100).map((x) => x.codigo_lancamento_omie).join(",")})`,
            { cancelado: true, status_omie: "NAO_ENCONTRADO", atualizado_em: new Date().toISOString() });
        }
        sumiram = ids.length;
      }
      c.etapa = "clientes";
      await gravarCursor({ etapa: "clientes", ultimo_resultado: { titulos: c.titulos_lidos, marcados_nao_encontrados: sumiram } });
    }
  }

  if (c.etapa === "clientes" && Date.now() < prazo) {
    const r = await resolverClientes(40, prazo);
    if (!r.restam || r.resolvidos === 0) {
      await gravarCursor({ fase: "ocioso", etapa: "titulos", janela_idx: 0, proxima_pagina: 1, concluido_em: new Date().toISOString(),
        ultimo_resultado: { ...(c.ultimo_resultado || {}), titulos: c.titulos_lidos, clientes_sem_nome: r.restam } });
      return { ok: true, concluido: true, fase, titulos: c.titulos_lidos, paginas, clientes_sem_nome: r.restam };
    }
  }
  return { ok: true, concluido: false, fase, etapa: c.etapa, janela_idx: c.janela_idx, janelas: janelas.length, titulos: c.titulos_lidos, paginas };
}

async function sondar() {
  const hoje = hojeBrasil();
  const j = { tipo: "venc", de: somarDias(hoje, -7), ate: hoje };
  const resp = await omiePost("financas/mf", "ListarMovimentos", paramsDaJanela(j, 1, 5));
  const movs = resp.movimentos || [];
  return {
    ok: true, janela: j, nTotPaginas: resp.nTotPaginas, nTotRegistros: resp.nTotRegistros, recebidos: movs.length,
    primeiro_cru: movs[0] || null,
    primeiro_mapeado: movs[0] ? mapear(movs[0], new Date().toISOString()) : null,
    mapeados_ou_descartados: movs.map((m) => (mapear(m, "") ? "ok" : "descartado")),
    chaves_detalhes: movs[0] ? Object.keys(movs[0].detalhes || {}) : [],
    chaves_resumo: movs[0] ? Object.keys(movs[0].resumo || {}) : [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);
  const segredo = req.headers.get("x-cron-secret") || "";
  try {
    if (!segredo || (await rpc("segredo_valido", { p_nome: "cron_secret", p_valor: segredo })) !== true) return json({ error: "Não autorizado" }, 401);
  } catch (_) { return json({ error: "Não autorizado" }, 401); }
  if (!omieKey || !omieSecret) return json({ error: "OMIE_API_KEY / OMIE_API_SECRET não configuradas" }, 500);

  let p = {};
  try { p = await req.json(); } catch (_) { /* corpo vazio */ }
  try {
    if (p?.acao === "sondar") return json(await sondar());
    if (p?.acao === "carga" || p?.acao === "incremental") {
      const r = await trabalhar(p.acao);
      if (r.ok && !r.concluido) {   // encadeia a próxima fatia (o gateway derruba a chamada em 150 s)
        const chain = fetch(`${supabaseUrl}/functions/v1/boletos-score-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, "x-cron-secret": segredo },
          body: JSON.stringify({ acao: p.acao }),
        }).catch((e) => console.error("[boletos-score-sync] encadeamento", e));
        const rt = globalThis;
        if (rt.EdgeRuntime?.waitUntil) rt.EdgeRuntime.waitUntil(chain); else await chain;
      }
      return json(r);
    }
    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[boletos-score-sync]", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
