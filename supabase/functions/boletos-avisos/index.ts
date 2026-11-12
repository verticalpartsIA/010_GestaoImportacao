// @ts-nocheck
// ============================================================
// boletos-avisos — Edge Function (vpprd). Financeiro & Preços › Boletos Avisos (11/11/2026).
//
// Ações (corpo JSON {"acao": ...}):
//   sincronizar  (cron) lê do Omie os boletos em aberto + o e-mail de cada cliente (SÓ LEITURA no Omie)
//   automatico   (cron) manda os avisos D-5 / D-1 / D0 / D+1 pela caixa hub@ e avisa a Juliana dos atrasos
//                       (só age se boletos_avisos_config.envio_automatico = true)
//   enviar       (tela) aviso manual de um cliente {codigo_cliente_omie}
//   sincronizar também pode ser pedido pela tela. Os três e-mails da lista (ver migration) são os únicos
//   que passam; qualquer outro recebe 403. A lista mora no banco (boletos_avisos_email_permitido).
//
// Por que NÃO usa a função send-email: ela só envia para e-mail já cadastrado no hub (trava anti-relay da
// área blindada) e a maioria dos e-mails de cliente do Omie não está lá. Esta função tem a própria trava:
// o destinatário só pode vir de boletos_avisos_clientes (gravado do Omie), nunca do corpo da requisição.
// O envio é o mesmo da send-email (Microsoft Graph, rascunho -> internetMessageId -> enviar) e grava em
// emails_projeto com referencia_tipo 'boleto_aviso' para o read-inbox ligar a resposta do cliente ao envio.
//
// Regras do Omie (CLAUDE.md Art. 30): só leitura; nunca sondar item a item onde dê "não encontrado" — para
// de consultar clientes depois de 3 erros seguidos; pausa entre chamadas.
// Sem supabase-js (Art. 23): fetch + PostgREST.
// ============================================================

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS"))["default"];
const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";
const SENDER = (Deno.env.get("SENDER_EMAIL") ?? "").trim().toLowerCase();
const FROM_NAME = Deno.env.get("SMTP_FROM_NAME") || "VerticalParts";
const JULIANA = "juliana@verticalparts.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
/* Data de hoje em Brasília (AAAA-MM-DD), igual a BoletosAvisosCalc.hojeBrasil */
function hojeBrasil(agora) { return new Date((agora || Date.now()) - 3 * 3600e3).toISOString().slice(0, 10); }

/* ---------- regra pura (igual a src/boletos-avisos-calc.js; conferida por teste) ---------- */
// BEGIN CALC
  const ETAPAS = [
    { cod: 'D-5', dias: -5 },
    { cod: 'D-1', dias: -1 },
    { cod: 'D0', dias: 0 },
    { cod: 'D+1', dias: 1 },
  ];
  function diasDesdeVencimento(vencISO, hojeISO) {
    const a = Date.UTC(+vencISO.slice(0, 4), +vencISO.slice(5, 7) - 1, +vencISO.slice(8, 10));
    const b = Date.UTC(+hojeISO.slice(0, 4), +hojeISO.slice(5, 7) - 1, +hojeISO.slice(8, 10));
    return Math.round((b - a) / 86400000);
  }
  function situacaoDoBoleto(vencISO, hojeISO) {
    const d = diasDesdeVencimento(vencISO, hojeISO);
    return d > 0 ? 'atrasado' : d === 0 ? 'vence_hoje' : 'em_dia';
  }
  function etapaDevida(vencISO, hojeISO, jaEnviadas) {
    const d = diasDesdeVencimento(vencISO, hojeISO);
    const segunda = new Date(hojeISO + 'T12:00:00Z').getUTCDay() === 1;
    let achada = null;
    for (const e of ETAPAS) {
      const atraso = d - e.dias;
      if (atraso === 0 || (segunda && (atraso === 1 || atraso === 2))) achada = e;
    }
    if (!achada || (jaEnviadas || []).includes(achada.cod)) return null;
    return achada.cod;
  }
  function dataBR(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
  function moedaBR(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function montarAviso(razao, boletos, etapa) {
    const plural = boletos.length > 1;
    const algumSem = boletos.some((b) => b.tem_boleto === false);
    const intro = (algumSem ? {
      'D-5': 'Este é um lembrete: ' + (plural ? 'os pagamentos abaixo estão para vencer.' : 'o pagamento abaixo está para vencer.'),
      'D-1': (plural ? 'Os pagamentos abaixo vencem' : 'O pagamento abaixo vence') + ' amanhã.',
      'D0': (plural ? 'Os pagamentos abaixo vencem' : 'O pagamento abaixo vence') + ' hoje.',
      'D+1': 'Identificamos que ' + (plural ? 'os pagamentos abaixo venceram e ainda não constam como recebidos.' : 'o pagamento abaixo venceu e ainda não consta como recebido.'),
      'manual': (plural ? 'Seguem os pagamentos' : 'Segue o pagamento') + ' em aberto da sua empresa.',
    } : {
      'D-5': 'Este é um lembrete: ' + (plural ? 'os boletos abaixo estão para vencer.' : 'o boleto abaixo está para vencer.'),
      'D-1': (plural ? 'Os boletos abaixo vencem' : 'O boleto abaixo vence') + ' amanhã.',
      'D0': (plural ? 'Os boletos abaixo vencem' : 'O boleto abaixo vence') + ' hoje.',
      'D+1': 'Identificamos que ' + (plural ? 'os boletos abaixo venceram e ainda não constam como pagos.' : 'o boleto abaixo venceu e ainda não consta como pago.'),
      'manual': (plural ? 'Seguem os boletos' : 'Segue o boleto') + ' em aberto da sua empresa.',
    })[etapa] || (algumSem ? 'Seguem os pagamentos em aberto da sua empresa.' : 'Seguem os boletos em aberto da sua empresa.');
    const assunto = (algumSem ? {
      'D-5': 'Lembrete: pagamento próximo do vencimento',
      'D-1': 'Seu pagamento vence amanhã',
      'D0': 'Seu pagamento vence hoje',
      'D+1': 'Pagamento vencido — regularize',
      'manual': 'Pagamentos em aberto',
    } : {
      'D-5': 'Lembrete: boleto próximo do vencimento',
      'D-1': 'Seu boleto vence amanhã',
      'D0': 'Seu boleto vence hoje',
      'D+1': 'Boleto vencido — regularize o pagamento',
      'manual': 'Boletos em aberto',
    })[etapa] + ' — ' + razao;
    const linhas = boletos.map((b) => {
      let l = '• ' + [b.numero_documento ? 'NF ' + b.numero_documento : null, b.numero_parcela ? 'parcela ' + b.numero_parcela : null].filter(Boolean).join(' · ')
        + ' — vencimento ' + dataBR(b.data_vencimento) + ' — ' + moedaBR(b.valor);
      if (b.tem_boleto === false) l += '\n  Sem boleto — pague pela forma combinada.';
      else if (b.linha_digitavel) l += '\n  Linha digitável: ' + b.linha_digitavel;
      return l;
    });
    const texto = 'Olá,\n\n' + intro + '\n\n' + linhas.join('\n') + '\n\n'
      + 'Se o pagamento já foi feito, responda este e-mail com o comprovante. Em caso de dúvida, é só responder.\n\n'
      + 'Financeiro — VerticalParts';
    return { assunto, texto };
  }
// END CALC

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
async function pgInsert(tabela, linhas, prefer = "return=representation") {
  const res = await fetch(`${supabaseUrl}/rest/v1/${tabela}`, { method: "POST", headers: pgHeaders({ Prefer: prefer }), body: JSON.stringify(linhas) });
  if (!res.ok) throw new Error(`insert ${tabela}: HTTP ${res.status} ${await res.text()}`);
  return prefer.includes("minimal") ? [] : await res.json();
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
    if (/redundante|redundant|too many requests|j[aá] existe uma requisi/i.test(data.faultstring) && tentativa < 5) {
      await esperar(tentativa * 3000);
      return omiePost(endpoint, call, param, tentativa + 1);
    }
    throw new Error(`Omie: ${data.faultstring}`);
  }
  if (!res.ok) throw new Error(`Omie HTTP ${res.status}`);
  return data;
}
const isoDeBR = (s) => { const [d, m, y] = String(s || "").split("/"); return d && m && y ? `${y}-${m}-${d}` : null; };
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;
function listaEmails(s) {
  return [...new Set(String(s || "").split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => EMAIL_RE.test(x)))];
}
function decodificar(s) { return String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">"); }

/* Título SEM boleto (cliente que paga por depósito/transferência) também entra, marcado tem_boleto=false.
   Para não trazer dívida antiga e esquecida (o "A VENCER" do Omie vai pela data de previsão, não pelo vencimento),
   o sem-boleto só entra até este atraso em dias. Boleto gerado entra sempre, como antes. */
const LIMITE_SEM_BOLETO_DIAS = 180;

async function sincronizar() {
  const vistos = new Map();
  const hojeSync = hojeBrasil();
  for (const status of ["AVENCER", "VENCEHOJE", "ATRASADO"]) {
    let pagina = 1, total = 1;
    while (pagina <= total) {
      const r = await omiePost("financas/contareceber", "ListarContasReceber", { pagina, registros_por_pagina: 100, apenas_importado_api: "N", filtrar_por_status: status });
      total = r.total_de_paginas || 1;
      for (const t of r.conta_receber_cadastro || []) {
        const temBoleto = t.boleto?.cGerado === "S";
        if (/RECEBIDO|CANCELADO|LIQUIDADO/i.test(t.status_titulo || "")) continue;
        const venc = isoDeBR(t.data_vencimento);
        if (!venc) continue;
        if (!temBoleto && diasDesdeVencimento(venc, hojeSync) > LIMITE_SEM_BOLETO_DIAS) continue;
        vistos.set(t.codigo_lancamento_omie, {
          codigo_lancamento_omie: t.codigo_lancamento_omie,
          codigo_cliente_omie: t.codigo_cliente_fornecedor,
          numero_documento: t.numero_documento_fiscal || null,
          numero_parcela: t.numero_parcela || null,
          numero_boleto: temBoleto ? (t.boleto?.cNumBoleto || null) : null,
          linha_digitavel: temBoleto ? (t.codigo_barras_ficha_compensacao || null) : null,
          tem_boleto: temBoleto,
          data_vencimento: venc,
          valor: t.valor_documento ?? null,
          status_omie: t.status_titulo || null,
          aberto: true,
          atualizado_em: new Date().toISOString(),
        });
      }
      pagina++;
      await esperar(400);
    }
  }
  const linhas = [...vistos.values()];
  await pgUpsert("boletos_avisos_boletos", "codigo_lancamento_omie", linhas);

  // quem estava em aberto e não veio mais (pago, cancelado, boleto removido) deixa de estar em aberto
  const abertos = await pgSelectTudo("boletos_avisos_boletos", "select=codigo_lancamento_omie&aberto=eq.true");
  const sumiram = abertos.map((x) => x.codigo_lancamento_omie).filter((id) => !vistos.has(id));
  for (let i = 0; i < sumiram.length; i += 100) {
    await pgPatch("boletos_avisos_boletos", `codigo_lancamento_omie=in.(${sumiram.slice(i, i + 100).join(",")})`, { aberto: false, atualizado_em: new Date().toISOString() });
  }

  // garante a linha de cada cliente e resolve os e-mails dos que faltam (ou estão com mais de 7 dias)
  const codigos = [...new Set(linhas.map((l) => l.codigo_cliente_omie))];
  await pgUpsert("boletos_avisos_clientes", "codigo_cliente_omie", codigos.map((c) => ({ codigo_cliente_omie: c })), "resolution=ignore-duplicates,return=minimal");
  const limite = new Date(Date.now() - 7 * 86400e3).toISOString();
  const pendentes = (await pgSelect("boletos_avisos_clientes",
    `select=codigo_cliente_omie&codigo_cliente_omie=in.(${codigos.join(",")})&or=(emails_atualizado_em.is.null,emails_atualizado_em.lt.${limite})&order=emails_atualizado_em.asc.nullsfirst&limit=60`)) || [];
  let resolvidos = 0, errosSeguidos = 0;
  for (const p of pendentes) {
    try {
      const c = await omiePost("geral/clientes", "ConsultarCliente", { codigo_cliente_omie: p.codigo_cliente_omie });
      const fat = listaEmails(c.recomendacoes?.email_fatura), ger = listaEmails(c.email);
      await pgPatch("boletos_avisos_clientes", `codigo_cliente_omie=eq.${p.codigo_cliente_omie}`, {
        razao_social: decodificar(c.razao_social) || null,
        cnpj: c.cnpj_cpf || null,
        emails: fat.length ? fat : ger,
        email_origem: fat.length ? "faturamento" : ger.length ? "geral" : "nenhum",
        emails_atualizado_em: new Date().toISOString(),
      });
      resolvidos++; errosSeguidos = 0;
    } catch (e) {
      console.warn("[boletos-avisos] cliente", p.codigo_cliente_omie, String(e?.message || e));
      if (++errosSeguidos >= 3) break;   // o Omie bloqueia a API toda depois de ~10 erros seguidos
    }
    await esperar(300);
  }
  await pgPatch("boletos_avisos_config", "id=eq.true", { sincronizado_em: new Date().toISOString() });
  return { boletosAbertos: linhas.length, semBoleto: linhas.filter((l) => !l.tem_boleto).length, encerrados: sumiram.length, clientes: codigos.length, emailsResolvidos: resolvidos, clientesSemEmailResolvido: Math.max(0, pendentes.length - resolvidos) };
}

/* ---------- Microsoft Graph (igual ao send-email) ---------- */
let tokenCache = null;
async function tokenGraph() {
  if (tokenCache && tokenCache.expira > Date.now() + 60000) return tokenCache.token;
  const tenant = Deno.env.get("AZURE_TENANT_ID") ?? "";
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: Deno.env.get("AZURE_CLIENT_ID") ?? "", client_secret: Deno.env.get("AZURE_CLIENT_SECRET") ?? "", scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("login Microsoft recusado");
  tokenCache = { token: j.access_token, expira: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return j.access_token;
}
async function graph(method, caminho, token, corpo) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${caminho}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const j = r.status === 202 || r.status === 204 ? {} : await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
function escaparHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
async function enviarGraph(para, assunto, texto) {
  const token = await tokenGraph();
  const caixa = `/users/${encodeURIComponent(SENDER)}`;
  const criado = await graph("POST", `${caixa}/messages`, token, {
    subject: assunto,
    body: { contentType: "HTML", content: `<div style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;font-size:14px">${escaparHtml(texto)}</div>` },
    toRecipients: para.map((a) => ({ emailAddress: { address: a } })),
    from: { emailAddress: { address: SENDER, name: FROM_NAME } },
  });
  if (!criado.ok || !criado.j?.id) throw new Error("falha ao preparar o e-mail na Microsoft (" + (criado.j?.error?.code || criado.status) + ")");
  const id = criado.j.id;
  let messageId = criado.j.internetMessageId ?? null;
  if (!messageId) messageId = (await graph("GET", `${caixa}/messages/${encodeURIComponent(id)}?$select=internetMessageId`, token)).j?.internetMessageId ?? null;
  const env = await graph("POST", `${caixa}/messages/${encodeURIComponent(id)}/send`, token);
  if (!env.ok) {
    await graph("DELETE", `${caixa}/messages/${encodeURIComponent(id)}`, token).catch(() => {});
    throw new Error("falha ao enviar pela Microsoft (" + (env.j?.error?.code || env.status) + ")");
  }
  return messageId;
}

/* ---------- envio de um cliente (log + Inbox) ---------- */
async function enviarParaCliente({ cliente, boletos, etapaPorBoleto, etapaAssunto, origem, enviadoPor, config, simular }) {
  const modoTeste = !!config.destino_teste;
  const reais = (cliente.emails || []).filter((e) => EMAIL_RE.test(e)).slice(0, 10);
  const para = modoTeste ? [config.destino_teste] : reais;
  if (!para.length) return { ok: false, motivo: "sem_email" };
  const razao = cliente.razao_social || `Cliente ${cliente.codigo_cliente_omie}`;
  const msg = montarAviso(razao, boletos, etapaAssunto);
  const assunto = (modoTeste ? "[MODO TESTE] " : "") + msg.assunto;
  const texto = (modoTeste ? `[MODO TESTE — este aviso iria para: ${reais.join(", ") || "nenhum e-mail"}]\n\n` : "") + msg.texto;
  if (simular) return { ok: true, simulado: true, para, assunto, texto };

  let messageId = null, erro = null;
  try { messageId = await enviarGraph(para, assunto, texto); } catch (e) { erro = String(e?.message || e); }
  const [envio] = await pgInsert("boletos_avisos_envios", [{
    codigo_cliente_omie: cliente.codigo_cliente_omie, cliente_razao: razao,
    etapa: origem === "manual" ? "manual" : etapaAssunto, origem, para, assunto, corpo: texto,
    boleto_ids: boletos.map((b) => b.codigo_lancamento_omie), message_id: messageId,
    status: erro ? "erro" : "enviado", erro, modo_teste: modoTeste, enviado_por: enviadoPor || null,
  }]);
  if (erro) return { ok: false, motivo: erro, envioId: envio.id };
  if (!modoTeste) {
    await pgInsert("boletos_avisos_envio_itens", boletos.map((b) => ({ envio_id: envio.id, codigo_lancamento_omie: b.codigo_lancamento_omie, etapa: etapaPorBoleto[b.codigo_lancamento_omie] || "manual" })), "return=minimal").catch((e) => console.warn("[boletos-avisos] itens", e));
  }
  // registra em emails_projeto: o read-inbox liga a resposta do cliente a este envio pelo Message-ID
  try {
    await pgInsert("emails_projeto", [{
      numero_cotacao: null, referencia_tipo: "boleto_aviso", referencia_id: envio.id, direcao: "saida",
      de_email: SENDER, de_nome: FROM_NAME, para, cc: [], assunto, corpo_texto: texto, corpo_html: null,
      message_id: messageId, data_mensagem: new Date().toISOString(), anexos: [], enviado_por: enviadoPor || null,
    }], "return=minimal");
  } catch (e) { console.warn("[boletos-avisos] emails_projeto", String(e?.message || e)); }
  return { ok: true, envioId: envio.id, para };
}

async function carregarBase() {
  const [config] = await pgSelect("boletos_avisos_config", "select=*&id=eq.true");
  const boletos = await pgSelectTudo("boletos_avisos_boletos", "select=*&aberto=eq.true");
  const clientes = await pgSelectTudo("boletos_avisos_clientes", "select=*");
  const porCliente = new Map(clientes.map((c) => [c.codigo_cliente_omie, c]));
  return { config, boletos, porCliente };
}

async function automatico(simular) {
  const { config, boletos, porCliente } = await carregarBase();
  if (!config?.envio_automatico && !simular) return { pulado: "envio automático desligado" };
  const hoje = hojeBrasil();
  const ids = boletos.map((b) => b.codigo_lancamento_omie);
  const itens = ids.length ? await pgSelectTudo("boletos_avisos_envio_itens", "select=codigo_lancamento_omie,etapa&etapa=neq.manual") : [];
  const jaPorBoleto = new Map();
  for (const it of itens) { if (!jaPorBoleto.has(it.codigo_lancamento_omie)) jaPorBoleto.set(it.codigo_lancamento_omie, []); jaPorBoleto.get(it.codigo_lancamento_omie).push(it.etapa); }

  const grupos = new Map();
  for (const b of boletos) {
    const etapa = etapaDevida(b.data_vencimento, hoje, jaPorBoleto.get(b.codigo_lancamento_omie) || []);
    if (!etapa) continue;
    if (!grupos.has(b.codigo_cliente_omie)) grupos.set(b.codigo_cliente_omie, { boletos: [], etapaPorBoleto: {} });
    const g = grupos.get(b.codigo_cliente_omie);
    g.boletos.push(b); g.etapaPorBoleto[b.codigo_lancamento_omie] = etapa;
  }
  const modoTeste = !!config?.destino_teste;
  const limite = modoTeste ? 3 : 40;
  const resultado = { hoje, modoTeste, clientesComAviso: grupos.size, enviados: 0, erros: 0, semEmail: 0, simulados: [] };
  let n = 0;
  for (const [cod, g] of grupos) {
    if (n >= limite) break;
    const cliente = porCliente.get(cod) || { codigo_cliente_omie: cod, emails: [] };
    const ordem = ["D-5", "D-1", "D0", "D+1"];
    const etapaAssunto = Object.values(g.etapaPorBoleto).sort((a, b) => ordem.indexOf(b) - ordem.indexOf(a))[0];
    const r = await enviarParaCliente({ cliente, boletos: g.boletos, etapaPorBoleto: g.etapaPorBoleto, etapaAssunto, origem: "automatico", enviadoPor: null, config: config || {}, simular });
    if (r.motivo === "sem_email") { resultado.semEmail++; continue; }
    n++;
    if (simular) resultado.simulados.push({ cliente: cliente.razao_social || cod, etapa: etapaAssunto, para: r.para, assunto: r.assunto });
    else if (r.ok) resultado.enviados++; else resultado.erros++;
    await esperar(700);
  }
  if (!simular && !modoTeste) resultado.avisoJuliana = await avisarJuliana(boletos, porCliente, hoje);
  return resultado;
}

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
async function avisarJuliana(boletos, porCliente, hoje) {
  const atrasados = boletos.filter((b) => b.data_vencimento < hoje);
  if (!atrasados.length) return "nenhum atraso";
  const porCli = new Map();
  for (const b of atrasados) {
    const c = porCli.get(b.codigo_cliente_omie) || { dias: 0, valor: 0, qtd: 0 };
    c.dias = Math.max(c.dias, diasDesdeVencimento(b.data_vencimento, hoje)); c.valor += Number(b.valor || 0); c.qtd++;
    porCli.set(b.codigo_cliente_omie, c);
  }
  const maiores = [...porCli.entries()].sort((a, b) => b[1].dias - a[1].dias).slice(0, 3)
    .map(([cod, c]) => `${(porCliente.get(cod)?.razao_social || "Cliente " + cod).slice(0, 28)} (${c.dias}d)`).join("; ");
  const total = atrasados.reduce((s, b) => s + Number(b.valor || 0), 0);
  const dow = DIAS[new Date(hoje + "T12:00:00Z").getUTCDay()];
  const [, m, d] = hoje.split("-");
  await pgUpsert("alertas", "id", [{
    id: `boletos-atraso-${hoje}`, level: "warning", module: "Financeiro", rota: "/adm-financeiro/boletos-avisos", resolved: false, destinatario_email: JULIANA,
    title: `Títulos em atraso — ${dow}, ${d}/${m}: ${porCli.size} cliente(s)`,
    sub: `${atrasados.length} título(s) vencido(s), ${moedaBR(total)} no total. Mais antigos: ${maiores}. Veja em Boletos Avisos.`.slice(0, 330),
  }], "resolution=ignore-duplicates,return=minimal");
  return `alerta para a Juliana: ${porCli.size} cliente(s)`;
}

async function enviarManual(codigo, email, simular) {
  const { config, boletos, porCliente } = await carregarBase();
  const cliente = porCliente.get(Number(codigo));
  const doCliente = boletos.filter((b) => b.codigo_cliente_omie === Number(codigo));
  if (!cliente || !doCliente.length) return { status: 404, corpo: { error: "Cliente sem boleto em aberto." } };
  const r = await enviarParaCliente({ cliente, boletos: doCliente, etapaPorBoleto: {}, etapaAssunto: "manual", origem: "manual", enviadoPor: email, config: config || {}, simular });
  if (r.motivo === "sem_email") return { status: 400, corpo: { error: "Este cliente não tem e-mail válido no Omie (campo e-mail de faturamento ou e-mail)." } };
  if (!r.ok) return { status: 502, corpo: { error: "Não foi possível enviar: " + r.motivo, envioId: r.envioId } };
  return { status: 200, corpo: r };
}

/* ---------- autenticação ---------- */
async function autenticar(req) {
  const segredo = req.headers.get("x-cron-secret") || "";
  if (segredo) {
    try { if ((await rpc("segredo_valido", { p_nome: "cron_secret", p_valor: segredo })) === true) return { modo: "cron" }; } catch (_) { /* cai no 401 */ }
    return null;
  }
  const bearer = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/i.test(bearer)) return null;
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: bearer, apikey: serviceKey } });
    if (!r.ok) return null;
    const email = String((await r.json())?.email || "").toLowerCase();
    if (!email || (await rpc("boletos_avisos_email_permitido", { p_email: email })) !== true) return { modo: "negado", email };
    return { modo: "usuario", email };
  } catch (_) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);
  const auth = await autenticar(req);
  if (!auth) return json({ error: "Não autorizado" }, 401);
  if (auth.modo === "negado") return json({ error: "Esta tela é restrita." }, 403);
  let p = {};
  try { p = await req.json(); } catch (_) { /* corpo vazio */ }
  const acao = p?.acao;
  try {
    if (acao === "sincronizar") {
      if (!omieKey || !omieSecret) return json({ error: "OMIE_API_KEY / OMIE_API_SECRET não configuradas" }, 500);
      return json({ ok: true, ...(await sincronizar()) });
    }
    if (acao === "automatico") {
      if (auth.modo === "usuario" && !p.simular) return json({ error: "Pela tela só dá para simular; o envio automático roda pela rotina." }, 403);
      if (!SENDER || !Deno.env.get("AZURE_TENANT_ID")) return json({ error: "Microsoft Graph não configurada" }, 503);
      return json({ ok: true, ...(await automatico(!!p.simular)) });
    }
    if (acao === "enviar") {
      if (auth.modo !== "usuario") return json({ error: "Só pela tela." }, 403);
      if (!SENDER || !Deno.env.get("AZURE_TENANT_ID")) return json({ error: "Microsoft Graph não configurada" }, 503);
      const r = await enviarManual(p.codigo_cliente_omie, auth.email, !!p.simular);
      return json(r.corpo, r.status);
    }
    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[boletos-avisos]", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
