/* ============================================================
   publicar_ficha_omie — publica a ficha técnica no Omie.

   Regra (definida com o usuário em 20/09/2026):
   - Código do Produto (Omie) já preenchido na ficha → SKU já existe:
     só sobe a ficha (anexa o PDF ao produto existente, como sempre).
   - Código vazio → SKU novo: gera o próximo código livre (via a function
     proximo-codigo-produto, no projeto bd_Omie) a partir da categoria_sku
     da Solicitação de Produto que originou esta ficha, cadastra o produto
     de verdade no Omie (IncluirProduto) e SÓ DEPOIS anexa o PDF.

   API Omie é JSON-RPC:
   - IncluirProduto    → cadastra o produto novo (só quando código vazio)
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
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const omieKey = Deno.env.get("OMIE_API_KEY") || "";
const omieSecret = Deno.env.get("OMIE_API_SECRET") || "";

// Function proximo-codigo-produto vive no projeto bd_Omie (kgecbycsyrtdhmdziuul)
// — cache local dos produtos VerticalParts + confirmação ao vivo no Omie.
// Chave anon (publicável por design, protegida por RLS do lado de lá).
const PROXIMO_CODIGO_URL = "https://kgecbycsyrtdhmdziuul.supabase.co/functions/v1/proximo-codigo-produto";
const PROXIMO_CODIGO_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnZWNieWNzeXJ0ZGhtZHppdXVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjMxOTYsImV4cCI6MjA5MzQ5OTE5Nn0.JCgq_dD96sW-tpTrfzb08CMVhrT9uzKIjcitvb7nJws";

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

    // 1) Ficha (+ campos usados só se for preciso cadastrar produto novo)
    const { data: ficha, error: fichaError } = await sb
      .from("fichas_tecnicas")
      .select("id, nome_produto, codigo_produto, numero_documento, ncm_recomendado, descricao_comercial, descricao_duimp")
      .eq("id", ficha_id)
      .single();
    if (fichaError || !ficha) return json({ error: "Ficha não encontrada" }, 404);

    const { nome_produto, numero_documento } = ficha;
    let codigo_produto = ficha.codigo_produto as string | null;
    let produtoRecemCriado = false;

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

      // Cadastra o produto de verdade no Omie. Unidade sem campo próprio na
      // Ficha Técnica hoje — usa "UN" como padrão (limitação conhecida a
      // revisitar se surgir produto com outra unidade de medida).
      //
      // Mapeamento de descrições (definido com o usuário em 20/09/2026, na
      // aba "Observações" do cadastro Omie):
      // - descr_detalhada  ("Descrição Detalhada do Produto")   ← Descrição Comercial da ficha
      // - obs_internas     ("Observações Internas", nunca sai em NF-e/pedido) ← Descrição DUIMP da ficha
      //
      // NOTA: tentamos registrar "quem publicou" como característica
      // customizada do produto (rastreabilidade dentro do próprio Omie,
      // já que o histórico de alterações do Omie sempre mostra "Integração"
      // para chamadas via API — não identifica pessoa). Nem "caracteristicas"
      // nem "caracteristicasArray" foram aceitos pelo IncluirProduto (testado
      // ao vivo em 20/09/2026 — o segundo nome nem existe na estrutura
      // produto_servico_cadastro). Removido por ora; a rastreabilidade real
      // já existe do nosso lado, em vp_logs (ator_nome/ator_setor abaixo).
      const inclusao = await omieCall("geral/produtos", "IncluirProduto", {
        codigo: codigoNovo,
        codigo_produto_integracao: codigoNovo,
        descricao: String(nome_produto || "Produto sem nome").slice(0, 120),
        unidade: "UN",
        ncm: ficha.ncm_recomendado,
        valor_unitario: 0,
        descr_detalhada: ficha.descricao_comercial || null,
        obs_internas: ficha.descricao_duimp || null,
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
      detalhe: { codigo_produto, arquivo: nomeArquivo, omie_nid: nIdProduto, omie_anexo_id: nIdAnexo, substituido: foiSubstituido, produto_recem_criado: produtoRecemCriado },
    });
    if (logError) console.warn("vp_logs falhou:", logError.message);

    return json({
      sucesso: true,
      mensagem: produtoRecemCriado
        ? `🆕 Produto ${codigo_produto} cadastrado no Omie e ficha anexada (${nomeArquivo})`
        : (foiSubstituido
          ? `🔄 Ficha republicada — PDF substituído no produto ${codigo_produto} no Omie (${nomeArquivo})`
          : `✅ Ficha anexada ao produto ${codigo_produto} no Omie (${nomeArquivo})`),
      codigo_produto,
      substituido: foiSubstituido,
      produto_recem_criado: produtoRecemCriado,
    });
  } catch (error) {
    console.error("Erro geral:", error);
    return json({ error: `Erro ao publicar: ${(error as Error).message}` }, 500);
  }
});
