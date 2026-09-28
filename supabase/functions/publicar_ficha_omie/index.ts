/* ============================================================
   publicar_ficha_omie — publica a ficha técnica no Omie.

   Regra (definida com o usuário em 20/09/2026):
   - Código do Produto (Omie) já preenchido na ficha → SKU já existe:
     só sobe a ficha (anexa o PDF ao produto existente, como sempre).
   - Código vazio → SKU novo: gera o próximo código livre (via a function
     proximo-codigo-produto, no projeto bd_Omie) a partir da categoria_sku
     da Solicitação de Produto que originou esta ficha, cadastra o produto
     de verdade no Omie (IncluirProduto) e SÓ DEPOIS anexa o PDF.

   Mapeamento célula-a-célula Ficha Técnica → Omie (definido com o
   usuário em 28/09/2026):
   - marca/modelo/unidade/FCI: campos novos em identificacao (jsonb).
     FCI: SEM campo confirmado na estrutura produto_servico_cadastro
     (nem em ConsultarProduto de produto real, nem na doc) — fica só
     guardado na Ficha por ora, não é enviado ao Omie.
   - peso líquido/bruto: direto da categoria "Peso e Massa", mesma unidade (kg).
   - altura/largura/profundidade: categoria "Dimensões Físicas" está em
     mm na Ficha — Omie pede CENTÍMETROS, então SEMPRE ÷10 na publicação
     (nunca alterar a Ficha pra guardar em cm — o erro é feio: um produto
     de 800mm vira "8 metros" se mandar cru).
   - NCM: SEMPRE ncm_recomendado (nunca o campo solto dentro de "Códigos
     e Classificações" — evita duas fontes divergentes).
   - CEST: campo solto de "Códigos e Classificações", vai pra
     recomendacoes_fiscais.id_cest (nome real confirmado ao vivo via
     ConsultarProduto num produto de verdade — não é campo solto no nível
     raiz do payload).
   - EAN/GTIN e Part Number soltos em "Códigos e Classificações": NUNCA
     vão pro Omie (sem fonte confiável / duplicam identificacao.partNumber).
   - Observação Interna: Descrição DUIMP + Descrição Técnica concatenadas.
   - Demais campos ativos das categorias (Elétricas, Velocidade, Fluidos,
     Acústica, Tração, Componentes, Comprimento/Diâmetro/etc. de
     Dimensões) → Omie em 2 chamadas por campo (achado de 28/09/2026,
     via omie_documentacao_diff + busca na lista de serviços — o endpoint
     certo não é geral/caracteristicas sozinho):
       1. geral/caracteristicas · IncluirCaracteristica — garante que o
          NOME da característica existe no catálogo geral da conta
          (cCodIntCaract = slug estável do nome, ex. "tensao_de_alimentacao").
          Best-effort: se já existir (republicação ou campo repetido em
          outra ficha), a chamada falha e a gente ignora — não é erro.
       2. geral/prodcaract · IncluirCaractProduto (ou AlterarCaractProduto
          se já existia) — aí sim atribui o VALOR ao PRODUTO específico
          (nCodProd = nIdProduto — o nº interno do Omie via ConsultarProduto,
          cCodIntCaract = mesmo slug, cConteudo = valor + unidade). É esse
          endpoint que faltava — o geral/caracteristicas sozinho só tem
          nome, sem produto nem valor.
     Uma sessão anterior (20/09/2026) já tinha testado "caracteristicas"/
     "caracteristicasArray" dentro do IncluirProduto e nenhum dos dois
     funciona — não repita essa tentativa, o caminho certo é o de cima.
     Best-effort por característica: uma falha isolada não derruba a
     publicação nem as outras características. Não remove característica
     que saiu da Ficha desde a última publicação (fica órfã no Omie).
     ⚠️ NUNCA use cCodIntProd (Código de Integração) aqui — achado real na
     validação em produção de 28/09/2026 (ficha VPFT20260917_30/VPER-681,
     produto cadastrado em 2016, muito antes desta feature existir):
     cCodIntProd só existe pra produtos criados PELO NOSSO IncluirProduto
     (que grava codigo_produto_integracao = nosso código) — todo o resto
     do catálogo antigo tem esse campo vazio no Omie, e a chamada falhava
     com "Produto não cadastrado para o Código de Integração [...]" pra
     100% das características, silenciosamente (o resto da publicação —
     AlterarProduto, anexo do PDF — funcionava normal, escondendo o bug).
     nCodProd não depende desse campo — sempre existe, pra qualquer produto.
   - Tipo do Produto (Bloco K) e Origem da Mercadoria: fixos "00" e "1"
     SÓ na criação (IncluirProduto). NUNCA reenviados no Alterar/republicar
     — um produto real (VPEL-700) já está classificado diferente ("01")
     por decisão humana, e republicar não pode sobrescrever isso.

   API Omie é JSON-RPC:
   - IncluirProduto    → cadastra o produto novo (só quando código vazio)
   - AlterarProduto    → sincroniza os campos mapeados acima a CADA
                          publicação (novo ou republicação) — sem isso,
                          editar a Ficha depois de já ter criado o produto
                          nunca chegava no Omie.
   - ConsultarProduto  → valida que o código existe e obtém o nId
   - ExcluirAnexo      → remove anexo anterior desta ficha (se houver),
                          permitindo republicar substituindo o PDF antigo
   - IncluirAnexo      → sobe o PDF na tabela "produtos"
   Erros do Omie voltam como { faultstring, faultcode }.

   Requisitos do Omie para IncluirAnexo:
   - cArquivo: arquivo comprimido em ZIP e convertido para base64
   - cMd5: hash MD5 do arquivo original (hex)
   - cCodIntAnexo: máx 20 caracteres
   ============================================================ */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { zipSync } from "https://esm.sh/fflate@0.8.2";
import { createHash } from "node:crypto";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];
const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";

// Function proximo-codigo-produto vive no projeto bd_Omie (kgecbycsyrtdhmdziuul)
// — cache local dos produtos VerticalParts + confirmação ao vivo no Omie.
// Chave publicável (publicável por design, protegida por RLS do lado de lá).
const PROXIMO_CODIGO_URL = "https://kgecbycsyrtdhmdziuul.supabase.co/functions/v1/proximo-codigo-produto";
const PROXIMO_CODIGO_ANON_KEY = "sb_publishable_Qb6sMn7yCuTaeL1lDl5WWQ_9RUIKYVI";

const sb = createClient(supabaseUrl, supabaseServiceKey);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
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

/* ---------- Helpers do mapeamento célula-a-célula ---------- */

function toNum(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/* mm (Ficha Técnica) → cm (Omie). NUNCA remover este ÷10. */
function mmParaCm(v: unknown): number {
  return Math.round((toNum(v) / 10) * 100) / 100;
}

/* Valor de um campo ATIVO de uma categoria específica, por nome exato
   (case-insensitive). Usado pra puxar Peso/Dimensões/CEST sem misturar
   com o restante dos campos dinâmicos da ficha. */
function campoAtivo(cats: any[], catId: string, nomeRegex: RegExp): string | null {
  const cat = (cats || []).find((c: any) => c && c.id === catId);
  if (!cat) return null;
  const fld = (cat.campos || []).find(
    (f: any) => f && f.ativo && nomeRegex.test(f.nome || "") && String(f.valor ?? "").trim() !== ""
  );
  return fld ? String(fld.valor).trim() : null;
}

/* Todo campo ativo e preenchido, de QUALQUER categoria exceto "Códigos e
   Classificações" (NCM/CEST/EAN já têm destino próprio acima — nunca
   duplicar aqui). */
function buildCaracteristicas(cats: any[]): { nome: string; conteudo: string }[] {
  const linhas: { nome: string; conteudo: string }[] = [];
  (cats || []).forEach((cat: any) => {
    if (!cat || cat.id === "codigos") return;
    (cat.campos || []).forEach((fld: any) => {
      if (!fld || !fld.ativo) return;
      const valor = String(fld.valor ?? "").trim();
      if (!valor) return;
      const conteudo = fld.unidade ? `${valor} ${fld.unidade}` : valor;
      linhas.push({ nome: String(fld.nome || "").trim(), conteudo });
    });
  });
  return linhas;
}

/* cCodIntCaract estável — mesmo nome de característica (ex. "Peso Bruto"
   dentro de uma categoria custom, "Tensão de Alimentação"...) sempre gera
   o mesmo código, então o catálogo geral não duplica entrada por ficha. */
function slugCaract(nome: string): string {
  return String(nome)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
    .slice(0, 60) || "caract";
}

/* Sincroniza as características dinâmicas com o produto no Omie —
   2 chamadas por campo (ver comentário no topo do arquivo). Best-effort:
   cada característica é isolada, uma falha não derruba as outras nem a
   publicação. Retorna contagem pra log de auditoria.
   nIdProduto = nCodProd (nº interno do Omie via ConsultarProduto) —
   NUNCA cCodIntProd, ver comentário no topo do arquivo.

   Segundo achado real da mesma validação (28/09/2026, mesma ficha
   VPER-681, campo "Largura"): o NOME da característica pode já existir
   no catálogo geral da conta sob um cCodIntCaract DIFERENTE do nosso
   slug (ex.: cadastro antigo/manual, sem nosso padrão de slug) — nesse
   caso IncluirCaracteristica falha (esperado, nome duplicado), mas o
   nosso cCodIntCaract nunca chega a existir de verdade, então os passos
   seguintes (IncluirCaractProduto/AlterarCaractProduto com esse
   cCodIntCaract) falham também com "Característica não cadastrada".
   O faultstring do Omie inclui o código real já cadastrado (ex.:
   "já cadastrada para a descrição [Largura] código [859989228]") —
   extrai esse nCodCaract e usa ele (confirmado que prodcaract aceita
   nCodCaract do mesmo jeito que aceita nCodProd) em vez de insistir
   no nosso cCodIntCaract inexistente. */
function extrairCodigoExistente(fault: string): number | null {
  const m = /c[oó]digo\s*\[(\d+)\]/i.exec(fault || "");
  return m ? Number(m[1]) : null;
}

async function sincronizarCaracteristicas(nIdProduto: number, itens: { nome: string; conteudo: string }[]) {
  let ok = 0, falhas = 0;
  for (const it of itens) {
    if (!it.nome) continue;
    const cCodIntCaract = slugCaract(it.nome);
    const cNomeCaract = it.nome.slice(0, 30);
    const cConteudo = it.conteudo.slice(0, 60);

    // 1) garante o nome no catálogo geral — se já existir (nome duplicado),
    // a chamada falha; se o nosso próprio cCodIntCaract é quem já existe
    // (republicação), segue normal. Se é OUTRO código com o mesmo nome,
    // usa esse código real daqui pra frente nesta característica.
    const criacao = await omieCall("geral/caracteristicas", "IncluirCaracteristica", { cCodIntCaract, cNomeCaract });
    const nCodCaractExistente = criacao.ok ? null : extrairCodigoExistente(criacao.data?.faultstring);
    const identCaract = nCodCaractExistente
      ? { nCodCaract: nCodCaractExistente }
      : { cCodIntCaract };

    // 2) atribui o valor a ESTE produto — tenta incluir; se já existia
    // (republicação), cai pra alterar.
    const inc = await omieCall("geral/prodcaract", "IncluirCaractProduto", {
      nCodProd: nIdProduto, ...identCaract, cConteudo,
    });
    if (inc.ok) { ok++; continue; }
    const alt = await omieCall("geral/prodcaract", "AlterarCaractProduto", {
      nCodProd: nIdProduto, ...identCaract, cConteudo,
    });
    if (alt.ok) ok++; else {
      falhas++;
      console.warn(`[publicar_ficha_omie] característica "${it.nome}" falhou:`, inc.data?.faultstring || alt.data?.faultstring);
    }
  }
  return { ok, falhas };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    if (!omieKey || !omieSecret) {
      return json({ error: "OMIE_API_KEY / OMIE_API_SECRET não configuradas no Supabase" }, 500);
    }

    const { ficha_id, pdf_base64, ator_nome, ator_setor } = await req.json();
    if (!ficha_id || !pdf_base64) {
      return json({ error: "ficha_id e pdf_base64 são obrigatórios" }, 400);
    }

    // 1) Ficha (+ campos usados pro mapeamento célula-a-célula e, se
    // preciso cadastrar produto novo, categoria da Solicitação de Produto)
    const { data: ficha, error: fichaError } = await sb
      .from("fichas_tecnicas")
      .select("id, nome_produto, codigo_produto, numero_documento, ncm_recomendado, descricao_comercial, descricao_tecnica, descricao_duimp, identificacao, cats")
      .eq("id", ficha_id)
      .single();
    if (fichaError || !ficha) return json({ error: "Ficha não encontrada" }, 404);

    const { nome_produto, numero_documento } = ficha;
    let codigo_produto = ficha.codigo_produto as string | null;
    let produtoRecemCriado = false;

    // Campos mapeados da Ficha Técnica — usados tanto na criação
    // (IncluirProduto) quanto em toda republicação (AlterarProduto).
    const ident = (ficha.identificacao || {}) as Record<string, unknown>;
    const cats = (ficha.cats || []) as any[];
    const cest = campoAtivo(cats, "codigos", /^CEST$/i);
    const pesoLiquido = campoAtivo(cats, "peso", /^Peso L[ií]quido$/i);
    const pesoBruto = campoAtivo(cats, "peso", /^Peso Bruto$/i);
    const altura = campoAtivo(cats, "dimensoes", /^Altura$/i);
    const largura = campoAtivo(cats, "dimensoes", /^Largura$/i);
    const profundidade = campoAtivo(cats, "dimensoes", /^Profundidade$/i);
    const caracteristicas = buildCaracteristicas(cats);

    const obsParts: string[] = [];
    if (ficha.descricao_duimp) obsParts.push(`DUIMP: ${ficha.descricao_duimp}`);
    if (ficha.descricao_tecnica) obsParts.push(`Descrição Técnica: ${ficha.descricao_tecnica}`);
    const obsInternas = obsParts.length ? obsParts.join("\n\n") : null;

    // Campos "vivos" — sempre sincronizados do jeito que a Ficha estiver
    // agora, tanto na criação quanto em toda republicação.
    const camposMapeados: Record<string, unknown> = {
      descricao: String(nome_produto || "Produto sem nome").slice(0, 120),
      unidade: String((ident.unidade as string) || "UN").toUpperCase().slice(0, 6) || "UN",
      marca: ident.marca ? String(ident.marca).slice(0, 60) : null,
      modelo: ident.modelo ? String(ident.modelo).slice(0, 60) : null,
      peso_liq: toNum(pesoLiquido),
      peso_bruto: toNum(pesoBruto),
      altura: mmParaCm(altura),
      largura: mmParaCm(largura),
      profundidade: mmParaCm(profundidade),
      descr_detalhada: ficha.descricao_comercial || null,
      obs_internas: obsInternas,
    };
    if (cest) camposMapeados.recomendacoes_fiscais = { id_cest: cest };

    // 1.1) Código vazio → SKU novo. Gera o próximo código livre (categoria da
    // Solicitação de Produto que originou esta ficha) e cadastra o produto de
    // verdade no Omie antes de seguir pro anexo do PDF.
    if (!codigo_produto) {
      const { data: solicitacao } = await sb
        .from("solicitacoes_produto")
        .select("categoria_sku")
        .eq("ficha_tecnica_id", ficha_id)
        .maybeSingle();

      const categoria = solicitacao?.categoria_sku;
      if (!categoria) {
        return json({
          error: 'Preencha o "Código do Produto (Omie)" na ficha antes de publicar (não foi possível determinar a categoria automaticamente — esta ficha não veio de uma Solicitação de Produto com categoria definida).',
        }, 400);
      }

      if (!ficha.ncm_recomendado) {
        return json({
          error: "Preencha o NCM recomendado na ficha antes de publicar um produto novo no Omie (obrigatório para o cadastro fiscal).",
        }, 400);
      }

      const codigoResp = await fetch(PROXIMO_CODIGO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PROXIMO_CODIGO_ANON_KEY}`,
          "apikey": PROXIMO_CODIGO_ANON_KEY,
        },
        body: JSON.stringify({ prefixo: categoria }),
      });
      const codigoData = await codigoResp.json().catch(() => ({}));
      if (!codigoData.ok || !codigoData.codigo_sugerido) {
        return json({ error: `Falha ao gerar código sequencial: ${codigoData.error || "erro desconhecido"}` }, 500);
      }
      const codigoNovo = codigoData.codigo_sugerido as string;

      // Cadastra o produto de verdade no Omie. Tipo do Produto (Bloco K) e
      // Origem da Mercadoria só entram AQUI, na criação — nunca no Alterar,
      // pra não sobrescrever uma classificação fiscal já corrigida à mão
      // depois (achado real: um produto VerticalParts já cadastrado está
      // como "01 - Matéria Prima", não "00").
      const inclusao = await omieCall("geral/produtos", "IncluirProduto", {
        codigo: codigoNovo,
        codigo_produto_integracao: codigoNovo,
        ncm: ficha.ncm_recomendado,
        valor_unitario: 0,
        tipoItem: "00",
        ...camposMapeados,
        recomendacoes_fiscais: { ...(camposMapeados.recomendacoes_fiscais as object || {}), origem_mercadoria: "1" },
      });
      if (!inclusao.ok) {
        const fault = inclusao.data?.faultstring || "erro desconhecido";
        if (/redundante|REDUNDANT/i.test(fault)) {
          const seg = fault.match(/(\d+)\s*segundos?/)?.[1] || "60";
          return json({ error: `⏳ O Omie bloqueou chamadas repetidas — aguarde ${seg}s e clique de novo.` }, 429);
        }
        return json({ error: `Falha ao cadastrar produto novo no Omie: ${fault}` }, 400);
      }

      codigo_produto = codigoNovo;
      produtoRecemCriado = true;

      // Grava o código gerado na ficha já aqui — mesmo que o anexo falhe
      // logo depois, o produto criado no Omie não deve ficar orfão/perdido.
      const { error: codigoSaveError } = await sb
        .from("fichas_tecnicas")
        .update({ codigo_produto: codigoNovo })
        .eq("id", ficha_id);
      if (codigoSaveError) console.warn("salvar codigo_produto na ficha falhou:", codigoSaveError.message);
    }

    // 2) Produto existe no Omie? (ConsultarProduto pelo código)
    const consulta = await omieCall("geral/produtos", "ConsultarProduto", { codigo: codigo_produto });
    if (!consulta.ok || !consulta.data.codigo_produto) {
      const fault = consulta.data?.faultstring || "";
      if (/redundante|REDUNDANT/i.test(fault)) {
        const seg = fault.match(/(\d+)\s*segundos?/)?.[1] || "60";
        return json({ error: `⏳ O Omie bloqueou chamadas repetidas — aguarde ${seg}s e clique de novo.` }, 429);
      }
      if (!fault || /n[aã]o\s+(cadastrado|encontrado|existe)/i.test(fault)) {
        return json({
          error: `❌ Código ${codigo_produto} não existe no Omie — verifique o "Código do Produto (Omie)" da ficha.`,
        }, 404);
      }
      return json({ error: `Omie: ${fault}` }, 400);
    }
    const nIdProduto = consulta.data.codigo_produto;

    // 2.1) Sincroniza os campos mapeados a CADA publicação (não só na
    // criação) — sem isso, editar a Ficha depois de o produto já existir
    // no Omie nunca chegava lá. Best-effort: falha aqui não derruba a
    // publicação (o anexo do PDF, mais abaixo, é a ação principal).
    const alteracao = await omieCall("geral/produtos", "AlterarProduto", {
      codigo: codigo_produto,
      ncm: ficha.ncm_recomendado || undefined,
      ...camposMapeados,
    });
    if (!alteracao.ok) {
      console.warn("[publicar_ficha_omie] AlterarProduto (sync de campos) falhou:", alteracao.data?.faultstring || alteracao.data);
    }

    // 2.2) Sincroniza as características dinâmicas (Elétricas, Velocidade,
    // Tração etc.) — best-effort, mesma lógica de "não derruba o resto".
    const caracteristicasResultado = caracteristicas.length
      ? await sincronizarCaracteristicas(nIdProduto, caracteristicas)
      : { ok: 0, falhas: 0 };

    // 3) Remover anexo anterior desta ficha, se existir — permite republicar
    // substituindo o PDF em vez de duplicar (mesma cCodIntAnexo de sempre).
    const nomeArquivo = `FICHA-TECNICA-${String(codigo_produto).replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
    const cCodIntAnexo = `ft-${String(ficha_id).replace(/-/g, "").slice(0, 17)}`;
    let foiSubstituido = false;
    const remocao = await omieCall("geral/anexo", "ExcluirAnexo", {
      cTabela: "produto",
      nId: nIdProduto,
      cCodIntAnexo,
      cNomeArquivo: nomeArquivo,
    });
    if (remocao.ok) {
      foiSubstituido = true;
    } else {
      const faultRemocao = remocao.data?.faultstring || "";
      if (/redundante|REDUNDANT/i.test(faultRemocao)) {
        const seg = faultRemocao.match(/(\d+)\s*segundos?/)?.[1] || "60";
        return json({ error: `⏳ O Omie bloqueou chamadas repetidas — aguarde ${seg}s e clique de novo.` }, 429);
      }
      // qualquer outro motivo (ex.: ainda não existe anexo — primeira publicação)
      // não bloqueia o fluxo: segue para incluir o anexo normalmente.
    }

    // 4) Preparar arquivo: PDF → ZIP → base64 + MD5
    const pdfBytes = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0));

    // Omie exige o arquivo comprimido em ZIP
    const files: Record<string, Uint8Array> = {};
    files[nomeArquivo] = pdfBytes;
    const zipped = zipSync(files);
    const zippedBase64 = toBase64(zipped);

    // Omie valida cMd5 contra a string base64 de cArquivo (não os bytes binários)
    const md5Hash = createHash("md5").update(zippedBase64).digest("hex");

    // 5) Anexar o PDF ao produto
    // cCodIntAnexo: limite 20 chars → ft- (3) + 17 chars do UUID sem hífens
    const anexo = await omieCall("geral/anexo", "IncluirAnexo", {
      cTabela: "produto",
      nId: nIdProduto,
      cCodIntAnexo,
      cNomeArquivo: nomeArquivo,
      cTipoArquivo: "pdf",
      cArquivo: zippedBase64,
      cMd5: md5Hash,
    });
    if (!anexo.ok) {
      const fault = anexo.data?.faultstring || "erro desconhecido";
      if (/redundante|REDUNDANT/i.test(fault)) {
        const seg = fault.match(/(\d+)\s*segundos?/)?.[1] || "60";
        return json({ error: `⏳ O Omie bloqueou chamadas repetidas — aguarde ${seg}s e clique de novo.` }, 429);
      }
      if (/j[aá]\s+(cadastrado|existe)|duplicado/i.test(fault)) {
        return json({ error: `📎 Esta ficha já está anexada ao produto ${codigo_produto} no Omie.` }, 409);
      }
      return json({ error: `Falha ao anexar no Omie: ${fault}` }, 400);
    }
    const nIdAnexo = anexo.data?.nIdAnexo ?? null;

    // 6) Grava status de publicação na própria ficha (best-effort)
    const { error: statusError } = await sb.from("fichas_tecnicas").update({
      omie_anexo_id: nIdAnexo,
      omie_publicado_em: new Date().toISOString(),
    }).eq("id", ficha_id);
    if (statusError) console.warn("status omie na ficha falhou:", statusError.message);

    // 7) Auditoria (best-effort)
    const { error: logError } = await sb.from("vp_logs").insert({
      ator_nome: ator_nome || "Sistema",
      ator_setor: ator_setor || "engenharia",
      modulo: "Ficha Técnica",
      acao: produtoRecemCriado
        ? "cadastrou produto novo e publicou ficha no Omie"
        : (foiSubstituido ? "republicou ficha no Omie" : "publicou ficha no Omie"),
      alvo: nome_produto || numero_documento || codigo_produto,
      alvo_id: String(ficha_id),
      detalhe: {
        codigo_produto, arquivo: nomeArquivo, omie_nid: nIdProduto, omie_anexo_id: nIdAnexo,
        substituido: foiSubstituido, produto_recem_criado: produtoRecemCriado,
        sync_campos_ok: alteracao.ok, caracteristicas: caracteristicasResultado,
      },
    });
    if (logError) console.warn("vp_logs falhou:", logError.message);

    const caractSufixo = caracteristicas.length
      ? ` · ${caracteristicasResultado.ok}/${caracteristicas.length} características sincronizadas`
      : "";

    return json({
      sucesso: true,
      mensagem: (produtoRecemCriado
        ? `🆕 Produto ${codigo_produto} cadastrado no Omie e ficha anexada (${nomeArquivo})`
        : (foiSubstituido
          ? `🔄 Ficha republicada — PDF substituído no produto ${codigo_produto} no Omie (${nomeArquivo})`
          : `✅ Ficha anexada ao produto ${codigo_produto} no Omie (${nomeArquivo})`)) + caractSufixo,
      codigo_produto,
      substituido: foiSubstituido,
      produto_recem_criado: produtoRecemCriado,
      caracteristicas: caracteristicasResultado,
    });
  } catch (error) {
    console.error("Erro geral:", error);
    return json({ error: `Erro ao publicar: ${(error as Error).message}` }, 500);
  }
});
