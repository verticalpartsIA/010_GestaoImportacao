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
   wizard público — guardada em `leads.especificacao_tecnica` (jsonb) e
   em `quadros_comando.respostas_publico` (tela "Cotação Quadro de Comando").

   REGRA (11/10/2026): CNPJ já cadastrado no Omie = CLIENTE, não lead — nesse
   caso nenhum lead é criado, só a cotação ligada ao cliente. CNPJ fora do Omie
   (ou sem CNPJ, ou consulta falhou) = lead, que vira cliente ao comprar.
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

async function restGet(caminho: string) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const data = await resp.json().catch(() => []);
  if (!resp.ok) throw new Error(`REST GET ${caminho} ${resp.status}: ${JSON.stringify(data)}`);
  return data as Record<string, unknown>[];
}

async function restPatch(caminho: string, body: unknown) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`REST PATCH ${caminho} ${resp.status}: ${await resp.text()}`);
}

/* REGRA DE NEGÓCIO (decisão do usuário, 11/10/2026): CNPJ já cadastrado no Omie
   = CLIENTE, não é lead. CNPJ fora do Omie = lead (vira cliente quando comprar).
   Mesma consulta de `omie-buscar-cliente` (só LEITURA no Omie; ver comentário
   dela sobre o comportamento real do ListarClientes). encontrado: true | false |
   null — null = falha de consulta e NUNCA é tratado como "não está no Omie". */
type OmieCliente = {
  encontrado: boolean | null; razao_social?: string | null; data_cadastro?: string | null;
  codigo_cliente_omie?: number | null; erro?: string;
};
async function consultarOmie(doc: string): Promise<OmieCliente> {
  const key = Deno.env.get("OMIE_API_KEY") || "";
  const secret = Deno.env.get("OMIE_API_SECRET") || "";
  if (!key || !secret) return { encontrado: null, erro: "credenciais do Omie ausentes" };
  try {
    const res = await fetch("https://app.omie.com.br/api/v1/geral/clientes/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call: "ListarClientes", app_key: key, app_secret: secret,
        param: [{ pagina: 1, registros_por_pagina: 5, apenas_importado_api: "N", clientesFiltro: { cnpj_cpf: doc } }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    const fault = String(data?.faultstring || "");
    if (fault) {
      if (/n[aã]o existem registros|nenhum registro|n[aã]o encontrad/i.test(fault)) return { encontrado: false };
      return { encontrado: null, erro: fault };
    }
    if (!res.ok) return { encontrado: null, erro: `Omie HTTP ${res.status}` };
    const lista = (data?.clientes_cadastro || []) as Record<string, any>[];
    const c = lista.find((x) => String(x.cnpj_cpf || "").replace(/\D/g, "") === doc);
    if (!c) return { encontrado: false };
    return {
      encontrado: true,
      razao_social: c.razao_social || c.nome_fantasia || null,
      data_cadastro: c.info?.dInc || null,
      codigo_cliente_omie: c.codigo_cliente_omie || null,
    };
  } catch (e) {
    return { encontrado: null, erro: (e as Error).message };
  }
}

/* Acha (por CNPJ) ou cria o cliente local e grava os dados do Omie nele. */
async function resolverCliente(doc: string, omie: OmieCliente, dados: { solicitante: string; telefone: string; email: string; empresa: string }) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(omie.data_cadastro || ""));
  const camposOmie = {
    codigo_cliente_omie: omie.codigo_cliente_omie || null,
    omie_cadastrado_desde: m ? `${m[3]}-${m[2]}-${m[1]}` : null,
    omie_verificado_em: new Date().toISOString(),
  };
  const existentes = await restGet(`clientes?cnpj=eq.${doc}&select=id,razao_social,codigo&limit=1`);
  if (existentes.length) {
    const cli = existentes[0];
    await restPatch(`clientes?id=eq.${cli.id}`, camposOmie).catch((e) => console.warn("[capturar-lead-quadro-comando] não atualizou dados do Omie no cliente:", e));
    return cli;
  }
  const rc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/gerar_codigo_cliente`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    body: "{}",
  });
  const codigo = rc.ok ? await rc.json().catch(() => null) : null;
  return await restInsert("clientes", {
    codigo,
    razao_social: omie.razao_social || dados.empresa || dados.solicitante,
    cnpj: doc,
    tipo_pessoa: "PJ",
    documento_pendente: false,
    contato: dados.solicitante,
    telefone: dados.telefone || null,
    email: dados.email || null,
    ...camposOmie,
  });
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

    // CNPJ já está no Omie → é CLIENTE, não lead (nenhum lead é criado). Fora do Omie
    // (ou sem CNPJ, ou consulta falhou) → lead, como sempre. Falha de consulta nunca
    // vira "é cliente": lead a mais é melhor do que um pedido sem dono.
    const omie: OmieCliente = cnpjDigits ? await consultarOmie(cnpjDigits) : { encontrado: null };
    let cliente: Record<string, unknown> | null = null;
    if (omie.encontrado === true) {
      try {
        cliente = await resolverCliente(cnpjDigits, omie, { solicitante, telefone, email, empresa });
      } catch (cliErr) {
        console.warn("[capturar-lead-quadro-comando] CNPJ está no Omie, mas não resolveu o cliente — segue como lead:", cliErr);
      }
    }

    const criarLead = () => restInsert("leads", {
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
      cliente_id: cliente ? cliente.id : null,
      especificacao_tecnica: { ...especificacao, cnpj: cnpjDigits || null },
    });
    let lead: Record<string, unknown> | null = cliente ? null : await criarLead();

    // Volta também para "Cotação Quadro de Comando" (quadros_comando): o registro
    // guarda as respostas como o cliente enviou (respostas_publico) e já preenche
    // o que dá para preencher nos campos estruturados (escopo, máquina, distâncias).
    // Para lead, falha aqui NUNCA derruba o envio (o lead é o registro). Para cliente
    // do Omie a cotação É o registro: se não gravar, cai para lead (nada se perde).
    let quadroId: string | null = null;
    let numeroPedido: number | null = null;
    try {
      const num = (v: unknown) => {
        const n = Number(String(v ?? "").replace(",", "."));
        return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
      };
      const chaves = Array.isArray(d.acessorios_chaves) ? (d.acessorios_chaves as unknown[]).map(String) : [];
      const escopoPorChave: Record<string, string> = {
        cop: "cop", lop: "lop", lip: "lip", resgate: "resgate_automatico", interfone: "interfone",
        insp_cabina: "botoeira_inspecao_cabina", insp_poco: "botoeira_inspecao_poco", stop_poco: "botao_stop_poco",
        gongo: "gongo", anuncio_voz: "anuncio_voz", sensor_foto: "sensor_fotoeletrico", barreira_luz: "barreira_luz",
        pesador: "pesador_carga", camera: "camera",
      };
      const escopo: Record<string, unknown> = {
        quadro_comando: { decisao: "fornecer", detalhe: variante || undefined },
      };
      for (const k of chaves) {
        const chaveEscopo = escopoPorChave[k];
        if (chaveEscopo) escopo[chaveEscopo] = { decisao: "fornecer" };
      }
      const indCor = str(d.ind_cor, 40);
      if (escopo.lip && indCor) (escopo.lip as Record<string, unknown>).detalhe = `cor: ${indCor}`;

      const casa = str(d.casa_maquinas, 20);
      const quadro = await restInsert("quadros_comando", {
        tipo_aplicacao: casa === "com_casa" ? "MR" : casa === "sem_casa" ? "MRL" : null,
        novo_ou_modernizacao: tipoServico === "modernizacao" ? "modernizacao" : tipoServico === "elevador_novo" ? "novo" : null,
        origem_fabricacao: "interno",
        status: "rascunho",
        escopo_fornecimento: escopo,
        criado_por: null,
        origem_envio: "formulario_publico",
        lead_id: lead ? lead.id : null,
        cliente_id: cliente ? cliente.id : null,
        respostas_publico: { ...especificacao, cnpj: cnpjDigits || null, omie: omie.encontrado },
      });
      quadroId = quadro.id;
      numeroPedido = quadro.numero_pedido ?? null;

      await restInsert("quadros_comando_maquina", {
        quadro_comando_id: quadro.id,
        potencia_kw: num(d.potencia_motor),
        tensao_v: num(d.tensao_motor),
        corrente_a: num(d.corrente_nominal),
        freio_tipo: str(d.tipo_freio, 40) || null,
        freio_tensao_acionamento: num(d.tensao_freio),
      });

      const dist = Array.isArray(d.dist) ? (d.dist as Array<Record<string, unknown>>) : [];
      const intervalos = dist
        .map((x) => ({ x: x || {}, m: num(x && x.m) }))
        .filter((o) => o.m != null && (o.m as number) > 0)
        .slice(0, 40)
        .map((o, ordem) => ({
          quadro_comando_id: quadro.id,
          ordem,
          de_parada: str(o.x.de, 20) || null,
          para_parada: str(o.x.ate, 20) || null,
          distancia_mm: Math.round((o.m as number) * 1000),
          origem: "medido",
        }));
      if (intervalos.length) await restInsert("quadros_comando_intervalos_piso", intervalos);
    } catch (qErr) {
      console.warn("[capturar-lead-quadro-comando] Aviso: não criou a cotação de quadro:", qErr);
      if (!lead) lead = await criarLead(); // cliente do Omie sem cotação gravada: garante o registro como lead
    }

    try {
      await restInsert("vp_logs", {
        ator_nome: "Formulário Público — Quadro de Comando",
        modulo: "Comercial",
        acao: lead ? "Lead recebido pelo formulário público de Quadro de Comando" : "Cliente do Omie solicitou orçamento pelo formulário público de Quadro de Comando",
        alvo: empresa || solicitante,
        alvo_id: lead ? lead.id : quadroId,
        detalhe: { telefone, email: email || null, cnpj: cnpjDigits || null, obra: obra || null, quadro_comando_id: quadroId, cliente_id: cliente ? cliente.id : null, no_omie: omie.encontrado },
      });
    } catch (logErr) {
      console.warn("[capturar-lead-quadro-comando] Aviso: não registrou atividade em vp_logs:", logErr);
    }

    const protocolo = lead ? String(lead.id) : `QC-${numeroPedido ?? quadroId}`;
    return json({ success: true, lead_id: protocolo, protocolo, tipo: lead ? "lead" : "cliente" });
  } catch (e) {
    console.error("[capturar-lead-quadro-comando] Erro:", e);
    return json({ error: (e as Error).message || "Erro ao enviar a solicitação" }, 500);
  }
});
