// @ts-nocheck
/* ============================================================
   alerta-pcp-compras — Edge Function (vpprd) · PCP, alerta automático de compra.

   NÃO chama o Omie: só LÊ as tabelas pcp_* (já abastecidas pelos syncs) e GRAVA em `alertas` (Central de Notificações).
   Roda 1x por dia, depois dos syncs (cron em migration). Dois avisos, com a MESMA regra das telas:
     1) REPOSIÇÃO  — itens comprados (sem estrutura) em situação crítica ou no ponto de pedido
                     (consumo médio real × prazo de chegada; ver src/reposicao-calc.js).
     2) NECESSIDADE — materiais que não chegam a tempo para os pedidos já vendidos, ou que precisam ser comprados em até
                     7 dias (carteira × estrutura × estoque; ver src/necessidade-calc.js).

   Regras que existem por motivo real:
   - A lógica de cálculo é CÓPIA dos dois módulos do navegador (blocos BEGIN/END CALC, texto idêntico). O teste
     src/alerta-pcp-paridade.test.js falha se um dos lados mudar sem o outro — o alerta nunca diverge da tela.
   - Sem spam: o id do alerta é determinístico = semana + assinatura da lista (código:situação). Lista igual na mesma semana
     = mesmo id = nada novo (insert ignora duplicata). Lista mudou, ou virou a semana (lembrete semanal) = alerta novo, e os
     anteriores do mesmo tipo são marcados como resolvidos. Se a situação normalizou, eles também são resolvidos.
   - Destinatários: líderes ATIVOS do departamento de Logística/Almoxarifado/Produção (colaboradores_vpsistema.is_department_lead),
     decisão do usuário em 03/10; sem líder cadastrado cai no alerta global (destinatario_email nulo). Um alerta por pessoa
     (id com sufixo do e-mail). Módulo "Almoxarifado". `rota` leva direto à aba (a Central de Notificações abre
     por URL). Body: { simular: true } devolve o que seria criado sem gravar; { email } cria só para essa pessoa (id com
     prefixo pcp-teste-, para testar de ponta a ponta sem avisar a empresa).
   Sem supabase-js (import remoto já derrubou produção em redeploy): PostgREST via fetch.
   ============================================================ */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"] as string; } catch { return ""; }
})() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const pgH = (extra: Record<string, string> = {}) => ({
  apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra,
});
async function pgSelectAll<T>(tabela: string, qs: string): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${qs}`, { headers: pgH({ Range: `${de}-${de + 999}`, "Range-Unit": "items" }) });
    if (!r.ok) throw new Error(`select ${tabela}: ${r.status} ${await r.text()}`);
    const rows = (await r.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
async function pgRpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: pgH(), body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status}`);
  return await r.json();
}

/* ---------- cálculo da Reposição (cópia de src/reposicao-calc.js) ---------- */
const Repo = (() => {
  // BEGIN CALC — copiado para supabase/functions/alerta-pcp-compras/index.ts; src/alerta-pcp-paridade.test.js confere que seguem idênticos
  const MESES_HISTORICO_CURTO = 3;
  const JANELA_MEDIA_MESES = 12;
  const SEM_GIRO_RECENTE_MESES = 6;
  const ehNacional = (codigo) => /n$/.test(String(codigo || ''));        // só "n" minúsculo

  const ym = (iso) => String(iso).slice(0, 7);
  const idx = (k) => { const [y, m] = k.split('-').map(Number); return y * 12 + (m - 1); };
  const keyDe = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

  function origensDe(texto) {
    return new Set(String(texto || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean));
  }
  function contaComoConsumo(mov, excluidas) {
    const o = String(mov.cod_origem || '').toUpperCase();
    if (excluidas.has(o)) return false;
    if (o === 'AJU' && Number(mov.qtde) > 0) return false;
    return true;
  }

  // movs: [{ dt_mov:'YYYY-MM-DD', qtde, cod_origem }] de UM item.
  function calcularItem({ codigo, movs, hoje, cfg, disponivel, pendente }) {
    const excl = origensDe(cfg.origens_excluidas);
    const prazo = ehNacional(codigo) ? cfg.prazo_nacional_dias : cfg.prazo_importado_dias;
    const base = { codigo, nacional: ehNacional(codigo), prazo, disponivel: Number(disponivel || 0), aCaminho: Number(pendente || 0) };
    base.posicao = base.disponivel + base.aCaminho;

    const porMes = {};
    let primeiro = null;
    (movs || []).forEach(m => {
      const k = ym(m.dt_mov);
      if (primeiro === null || k < primeiro) primeiro = k;            // 1º movimento de QUALQUER tipo
      if (contaComoConsumo(m, excl)) porMes[k] = (porMes[k] || 0) - Number(m.qtde || 0);
    });

    const mesAtual = idx(ym(hoje));
    const inicio = Math.max(idx(ym(cfg.janela_desde)), primeiro === null ? Infinity : idx(primeiro));
    const n = mesAtual - inicio;                                       // meses completos (exclui o mês em curso)
    if (!(n > 0)) return { ...base, status: 'sem_historico', meses: 0, mediaMensal: 0, consumoDia: 0, sugestao: 0, serie: [], serieInicio: null, ultimoConsumo: null, mesesSemSaida: null };

    const serie = [];
    for (let i = inicio; i < mesAtual; i++) serie.push(Math.max(0, porMes[keyDe(i)] || 0));
    // A média é dos ÚLTIMOS 12 meses completos (ou do que existir): consumo de 2 anos atrás não decide a compra de hoje.
    const janela = serie.slice(-Math.min(JANELA_MEDIA_MESES, n));
    const media = janela.reduce((a, b) => a + b, 0) / janela.length;
    const ult = serie.slice(-Math.min(6, n));
    const media6 = ult.reduce((a, b) => a + b, 0) / ult.length;
    let tendencia = 'estavel';
    if (n >= 6 && media > 0) { const r = media6 / media; if (r > 1.25) tendencia = 'alta'; else if (r < 0.75) tendencia = 'baixa'; }
    let ultimoI = -1;
    serie.forEach((v, i) => { if (v > 0) ultimoI = i; });
    const mesesSemSaida = ultimoI < 0 ? null : n - 1 - ultimoI;      // 0 = houve saída no último mês completo

    const consumoDia = media / 30;
    const r = {
      ...base, meses: n, mediaMensal: media, media6, tendencia, consumoDia, historicoCurto: n < MESES_HISTORICO_CURTO,
      ultimoMes: serie[serie.length - 1], serie, serieInicio: keyDe(inicio), mesesSemSaida,
      ultimoConsumo: ultimoI < 0 ? null : keyDe(inicio + ultimoI),
    };
    if (!(consumoDia > 0)) return { ...r, status: 'sem_giro', sugestao: 0 };
    // Sem saída há 6 meses ou mais: o item parou de girar; não sugere compra mesmo que a média de 12 meses ainda seja > 0.
    if (mesesSemSaida >= SEM_GIRO_RECENTE_MESES) return { ...r, status: 'sem_giro', semGiroRecente: true, sugestao: 0 };

    const critico = consumoDia * prazo;
    const pedido = consumoDia * (prazo + cfg.folga_dias);
    const maximo = consumoDia * (prazo + cfg.folga_dias + cfg.ciclo_dias);
    const coberturaAtual = base.disponivel / consumoDia;
    const coberturaProj = base.posicao / consumoDia;
    let status = 'ok';
    if (base.posicao <= critico) status = 'critico';
    else if (base.posicao <= pedido) status = 'comprar';
    else if (base.posicao > maximo) status = 'excesso';
    const sugestao = (status === 'critico' || status === 'comprar') ? Math.max(0, Math.ceil(maximo - base.posicao)) : 0;
    const excesso = status === 'excesso' ? Math.floor(base.posicao - maximo) : 0;
    return { ...r, status, critico, pedido, maximo, coberturaAtual, coberturaProj, sugestao, excesso, faltaAntesDeChegar: coberturaAtual < prazo };
  }

  // END CALC
  return { calcularItem };
})();

/* ---------- cálculo da Necessidade (cópia de src/necessidade-calc.js) ---------- */
const Nec = (() => {
  // BEGIN CALC — copiado para supabase/functions/alerta-pcp-compras/index.ts; src/alerta-pcp-paridade.test.js confere que seguem idênticos
  const DIA = 86400000;
  const nacional = (codigo) => /n$/.test(String(codigo || ''));
  const t = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const menorData = (a, b) => (!a ? b : !b ? a : (a <= b ? a : b));

  // demanda: [{ codigo, qtd, ref, previsao }]   filhos: { pai: [{ codigo_filho, quantidade, perda_pct }] }
  // estoque: { codigo: { fisico, aCaminho } }   cfg: { prazo_importado_dias, prazo_nacional_dias }
  function calcular({ demanda, filhos, estoque, hoje, cfg }) {
    const need = new Map();   // codigo -> { qtd, refs:Set, previsao }
    const juntar = (cod, qtd, refs, previsao) => {
      const n = need.get(cod) || { qtd: 0, refs: new Set(), previsao: null };
      n.qtd += qtd; refs.forEach(r => n.refs.add(r)); n.previsao = menorData(n.previsao, previsao);
      need.set(cod, n);
    };
    (demanda || []).forEach(d => { if (d.qtd > 0 && d.codigo) juntar(d.codigo, Number(d.qtd), new Set([d.ref]), d.previsao || null); });

    // subgrafo alcançável + ordem por nível (Kahn); aresta que fecha ciclo é ignorada
    const alcance = new Set();
    const visitar = (c) => { if (alcance.has(c)) return; alcance.add(c); (filhos[c] || []).forEach(f => visitar(f.codigo_filho)); };
    Array.from(need.keys()).forEach(visitar);
    const grau = new Map(Array.from(alcance).map(c => [c, 0]));
    alcance.forEach(c => (filhos[c] || []).forEach(f => grau.set(f.codigo_filho, grau.get(f.codigo_filho) + 1)));
    const ordem = []; const fila = Array.from(alcance).filter(c => grau.get(c) === 0);
    while (fila.length) {
      const c = fila.shift(); ordem.push(c);
      (filhos[c] || []).forEach(f => { grau.set(f.codigo_filho, grau.get(f.codigo_filho) - 1); if (grau.get(f.codigo_filho) === 0) fila.push(f.codigo_filho); });
    }
    const ciclos = Array.from(alcance).filter(c => !ordem.includes(c));
    ciclos.forEach(c => ordem.push(c));
    const feitos = new Set();

    const fabricados = [], comprados = [];
    ordem.forEach(cod => {
      feitos.add(cod);
      const n = need.get(cod);
      if (!n || !(n.qtd > 0)) return;
      const e = (estoque && estoque[cod]) || { fisico: 0, aCaminho: 0 };
      const fisico = Number(e.fisico || 0), aCaminho = Number(e.aCaminho || 0);
      const refs = Array.from(n.refs).filter(Boolean);
      const sub = filhos[cod] || [];
      if (sub.length) {
        const produzir = Math.max(0, n.qtd - fisico);
        fabricados.push({ codigo: cod, necessario: n.qtd, fisico, produzir, refs, previsao: n.previsao });
        if (produzir > 0) sub.forEach(f => { if (!feitos.has(f.codigo_filho)) juntar(f.codigo_filho, produzir * Number(f.quantidade || 0) * (1 + Number(f.perda_pct || 0) / 100), n.refs, n.previsao); });
      } else {
        const falta = Math.max(0, n.qtd - (fisico + aCaminho));
        const prazo = nacional(cod) ? cfg.prazo_nacional_dias : cfg.prazo_importado_dias;
        let status = 'coberto', comprarAte = null, diasAtePrevisao = null;
        if (falta > 1e-9) {
          if (!n.previsao) status = 'sem_data';
          else {
            diasAtePrevisao = Math.round((t(n.previsao) - t(hoje)) / DIA);
            comprarAte = iso(t(n.previsao) - prazo * DIA);
            status = diasAtePrevisao - prazo < 0 ? 'atrasado' : 'comprar';
          }
        }
        comprados.push({ codigo: cod, necessario: n.qtd, fisico, aCaminho, falta, prazo, nacional: nacional(cod), previsao: n.previsao, diasAtePrevisao, comprarAte, status, refs });
      }
    });
    const ordemStatus = { atrasado: 0, comprar: 1, sem_data: 2, coberto: 3 };
    comprados.sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status] || String(a.comprarAte || '9').localeCompare(String(b.comprarAte || '9')) || a.codigo.localeCompare(b.codigo));
    fabricados.sort((a, b) => b.produzir - a.produzir || a.codigo.localeCompare(b.codigo));
    return { comprados, fabricados, ciclos };
  }

  // END CALC
  return { calcular };
})();

/* ---------- utilidades ---------- */
const hojeBrasilia = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const somarDias = (isoData: string, n: number) => new Date(Date.parse(isoData + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const brData = (iso: string | null) => iso ? iso.split("-").reverse().slice(0, 2).join("/") : "—";
// Semana ISO simples (ano + número da semana) para o lembrete semanal.
function semanaDe(isoData: string) {
  const d = new Date(Date.parse(isoData + "T00:00:00Z"));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const ano = d.getUTCFullYear();
  const inicio = Date.UTC(ano, 0, 1);
  return `${ano}W${String(Math.ceil(((d.getTime() - inicio) / 86400000 + 1) / 7)).padStart(2, "0")}`;
}
function assinatura(partes: string[]) {
  let h = 5381;
  const s = partes.slice().sort().join("|");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const lista = (itens: string[], max: number) => itens.length > max ? `${itens.slice(0, max).join(", ")} e mais ${itens.length - max}` : itens.join(", ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!SERVICE_KEY) return json({ error: "Credenciais não configuradas" }, 500);

  let simular = false, email: string | null = null;
  try {
    const b = await req.json();
    simular = b?.simular === true;
    if (typeof b?.email === "string" && /^[^@\s]+@[^@\s]+$/.test(b.email)) email = b.email.trim().toLowerCase();
  } catch { /* sem body */ }

  try {
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const taxa = await pgRpc("api_rate_check", { p_bucket: "alerta-pcp-compras", p_ip: ip, p_max_ip: 10, p_max_global: 20, p_janela_s: 600 });
    if (taxa !== "ok") return json({ error: "Muitas chamadas em pouco tempo. Aguarde alguns minutos." }, 429);
  } catch (e) {
    console.warn("[alerta-pcp-compras] limite de taxa indisponível", e);
    return json({ error: "Indisponível (verificação de segurança)." }, 503);
  }

  try {
    const hoje = hojeBrasilia();
    const semana = semanaDe(hoje);
    const prefixoId = email ? "pcp-teste" : "pcp";
    const [cfgRows, prods, estr, movs, estoqueRows, posRows, pedidos, acomp, itens, ordens] = await Promise.all([
      pgSelectAll<any>("pcp_reposicao_config", "select=*&id=eq.true"),
      pgSelectAll<any>("pcp_produtos", "select=codigo,descricao,unidade&ativo=eq.true&nao_repor=eq.false&order=codigo"),
      pgSelectAll<any>("pcp_estrutura", "select=codigo_pai,codigo_filho,quantidade,perda_pct&order=id"),
      pgSelectAll<any>("pcp_consumo_mov", "select=codigo,dt_mov,qtde,cod_origem&order=id_mov"),
      pgSelectAll<any>("pcp_estoque", "select=codigo,quantidade&order=codigo"),
      pgSelectAll<any>("pcp_posicao_compra", "select=codigo,fisico,disponivel,pendente&order=codigo"),
      pgSelectAll<any>("pcp_pedidos", "select=codigo_pedido,numero_pedido,etapa,data_previsao&faturado=eq.false&cancelado=eq.false&order=codigo_pedido"),
      pgSelectAll<any>("pcp_pedido_acompanhamento", "select=numero_pedido,historico&order=numero_pedido"),
      pgSelectAll<any>("pcp_pedido_itens", "select=codigo_pedido,codigo,quantidade&item_pcp=eq.true&order=id"),
      pgSelectAll<any>("pcp_ordens", "select=id,numero,produto,quantidade,qtd_produzida,prazo_entrega,pedido_codigo,ordem_mae_id,observacao&status=not.in.(concluida,cancelada)&order=created_at"),
    ]);
    // Quem recebe: líderes ativos do departamento de Almoxarifado (teste com {email}: só essa pessoa).
    let destinos: (string | null)[] = [email];
    if (!email) {
      const lideres = await pgSelectAll<any>("colaboradores_vpsistema", "select=email&is_department_lead=eq.true&is_active=eq.true&departamento=ilike.*Almoxarifado*&order=email");
      const mails = Array.from(new Set(lideres.map((l) => String(l.email || "").trim().toLowerCase()).filter((m) => /^[^@\s]+@[^@\s]+$/.test(m))));
      destinos = mails.length ? mails : [null];
    }
    const cfg = cfgRows[0];
    if (!cfg) return json({ error: "Parâmetros da reposição não encontrados." }, 500);

    const fabricados = new Set(estr.map((l) => l.codigo_pai));
    const movsPor: Record<string, any[]> = {}; movs.forEach((m) => { (movsPor[m.codigo] = movsPor[m.codigo] || []).push(m); });
    const fisEst: Record<string, number> = {}; estoqueRows.forEach((e) => { fisEst[e.codigo] = (fisEst[e.codigo] || 0) + Number(e.quantidade || 0); });
    const posic: Record<string, any> = {}; posRows.forEach((p) => { posic[p.codigo] = p; });

    /* ---- 1) Reposição ---- */
    const linhas = prods.filter((p) => !fabricados.has(p.codigo)).map((p) => {
      const ps = posic[p.codigo];
      return Repo.calcularItem({ codigo: p.codigo, movs: movsPor[p.codigo], hoje, cfg, disponivel: ps ? ps.disponivel : (fisEst[p.codigo] || 0), pendente: ps ? ps.pendente : 0 });
    });
    const crit = linhas.filter((l) => l.status === "critico").sort((a, b) => (a.coberturaProj ?? 1e9) - (b.coberturaProj ?? 1e9));
    const comp = linhas.filter((l) => l.status === "comprar").sort((a, b) => (a.coberturaProj ?? 1e9) - (b.coberturaProj ?? 1e9));

    /* ---- 2) Necessidade (mesma montagem da demanda da tela) ---- */
    const historico = new Set(acomp.filter((a) => a.historico).map((a) => a.numero_pedido));
    const abertos = pedidos.filter((p) => !historico.has(p.numero_pedido) && p.etapa !== "00");
    const porCodigo = new Map(abertos.map((p) => [p.codigo_pedido, p]));
    const demanda: any[] = [];
    itens.forEach((i) => {
      const p = porCodigo.get(i.codigo_pedido);
      if (p && Number(i.quantidade) > 0) demanda.push({ codigo: i.codigo, qtd: Number(i.quantidade), ref: `Pedido ${p.numero_pedido}`, previsao: p.data_previsao || null });
    });
    const porId = new Map(ordens.map((o) => [o.id, o]));
    const raizDePedido = (o: any) => { let x = o, n = 0; while (x && n++ < 5) { if (x.pedido_codigo) return true; x = x.ordem_mae_id ? porId.get(x.ordem_mae_id) : null; } return false; };
    ordens.forEach((o) => {
      if (!o.produto || raizDePedido(o) || String(o.observacao || "").startsWith("[Necessidade]")) return;   // OP gerada pela Necessidade não é demanda nova
      const q = Math.max(0, Number(o.quantidade || 0) - Number(o.qtd_produzida || 0));
      if (q > 0) demanda.push({ codigo: o.produto, qtd: q, ref: `OP ${o.numero}`, previsao: o.prazo_entrega || null });
    });
    const filhos: Record<string, any[]> = {}; estr.forEach((l) => { (filhos[l.codigo_pai] = filhos[l.codigo_pai] || []).push(l); });
    const estoque: Record<string, any> = {};
    prods.forEach((p) => { estoque[p.codigo] = { fisico: fisEst[p.codigo] || 0, aCaminho: 0 }; });
    posRows.forEach((p) => { estoque[p.codigo] = { fisico: Number(p.fisico || 0), aCaminho: Number(p.pendente || 0) }; });
    const nec = Nec.calcular({ demanda, filhos, estoque, hoje, cfg });
    const limite = somarDias(hoje, 7);
    const atrasados = nec.comprados.filter((l) => l.status === "atrasado");
    const urgentes = nec.comprados.filter((l) => l.status === "comprar" && l.comprarAte && l.comprarAte <= limite);

    /* ---- montagem dos alertas ---- */
    const candidatos: any[] = [];
    if (crit.length + comp.length > 0) {
      const sig = assinatura([...crit.map((l) => `${l.codigo}:c`), ...comp.map((l) => `${l.codigo}:p`)]);
      const txtCrit = crit.slice(0, 5).map((l) => `${l.codigo} (${l.coberturaProj != null ? Math.round(l.coberturaProj) : 0}d)`);
      candidatos.push({
        tipo: "reposicao", id: `${prefixoId}-reposicao-${semana}-${sig}`, level: crit.length ? "danger" : "warning",
        title: `Reposição: ${crit.length} crítico(s)${comp.length ? `, ${comp.length} para comprar` : ""}`,
        sub: `${crit.length ? `Críticos (cobertura): ${txtCrit.join(", ")}${crit.length > 5 ? ` e mais ${crit.length - 5}` : ""}. ` : ""}${comp.length ? `No ponto de pedido: ${lista(comp.slice(0, 4).map((l) => l.codigo), 4)}. ` : ""}Abra Almoxarifado › Reposição.`.slice(0, 480),
        rota: "/logistica/almoxarifado/reposicao",
      });
    }
    if (atrasados.length + urgentes.length > 0) {
      const sig = assinatura([...atrasados.map((l) => `${l.codigo}:a`), ...urgentes.map((l) => `${l.codigo}:u`)]);
      const peds = Array.from(new Set([...atrasados, ...urgentes].flatMap((l) => l.refs))).slice(0, 4);
      candidatos.push({
        tipo: "necessidade", id: `${prefixoId}-necessidade-${semana}-${sig}`, level: atrasados.length ? "danger" : "warning",
        title: `Necessidade: ${atrasados.length} material(is) não chegam a tempo${urgentes.length ? `, ${urgentes.length} para comprar em até 7 dias` : ""}`,
        sub: `${atrasados.length ? `Não chegam a tempo: ${lista(atrasados.slice(0, 4).map((l) => l.codigo), 4)}. ` : ""}${urgentes.length ? `Comprar até: ${lista(urgentes.slice(0, 3).map((l) => `${l.codigo} (${brData(l.comprarAte)})`), 3)}. ` : ""}${peds.length ? `Pedidos: ${peds.join(", ")}. ` : ""}Abra Almoxarifado › Necessidade.`.slice(0, 480),
        rota: "/logistica/almoxarifado/necessidade",
      });
    }

    const resumo = {
      hoje, semana, reposicao: { criticos: crit.length, comprar: comp.length }, necessidade: { atrasados: atrasados.length, urgentes7d: urgentes.length },
    };
    if (simular) return json({ ok: true, simulado: true, resumo, destinatarios: destinos, alertas: candidatos });

    /* ---- grava: insere o novo (ignora duplicata) e resolve os antigos do mesmo tipo ---- */
    const criados: any[] = [];
    for (const dest of destinos) {
      const sufixo = dest ? "-" + dest.replace(/[^a-z0-9]/g, "") : "";
      for (const tipo of ["reposicao", "necessidade"]) {
        const novoBase = candidatos.find((c) => c.tipo === tipo);
        const novo = novoBase ? { ...novoBase, id: novoBase.id + sufixo } : null;
        const filtroEmail = dest ? `&destinatario_email=eq.${encodeURIComponent(dest)}` : "&destinatario_email=is.null";
        if (novo) {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/alertas?on_conflict=id`, {
            method: "POST", headers: pgH({ Prefer: "resolution=ignore-duplicates,return=representation" }),
            body: JSON.stringify([{ id: novo.id, level: novo.level, title: novo.title, sub: novo.sub, module: "Almoxarifado", rota: novo.rota, resolved: false, destinatario_email: dest }]),
          });
          if (!r.ok) throw new Error(`insert alertas: ${r.status} ${await r.text()}`);
          const inseridos = await r.json();
          criados.push({ ...novo, destinatario: dest, novo: inseridos.length > 0 });
        }
        // Resolve os anteriores do mesmo tipo e destinatário (e todos, se a situação normalizou).
        const padrao = encodeURIComponent(`${prefixoId}-${tipo}-*`);
        const nao = novo ? `&id=neq.${encodeURIComponent(novo.id)}` : "";
        const p = await fetch(`${SUPABASE_URL}/rest/v1/alertas?id=like.${padrao}&resolved=eq.false${nao}${filtroEmail}`, {
          method: "PATCH", headers: pgH({ Prefer: "return=minimal" }), body: JSON.stringify({ resolved: true }),
        });
        if (!p.ok) throw new Error(`resolver alertas: ${p.status} ${await p.text()}`);
      }
    }
    return json({ ok: true, simulado: false, resumo, criados });
  } catch (e) {
    console.error("[alerta-pcp-compras]", (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
