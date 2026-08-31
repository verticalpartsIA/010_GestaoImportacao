// ============================================================
// vp-copiloto — Edge Function (vpprd)
// Assistente global do VP Gestão. Acompanha o usuário em TODAS as telas.
// IA: Anthropic Claude (secret ANTHROPIC_API_KEY). Mesmo padrão da ncm-duimp-assist.
//
// 3 modos (campo "mode"):
//   • chat    → responde perguntas sobre a tela/sistema
//   • fill    → lê os campos da tela e devolve o que preencher; pergunta o que falta
//   • analyze → revisa o documento/preenchimento e aponta erros + sugestões
//
// Contrato de resposta (JSON):
//   { reply, fills?:[{idx,label,value}], questions?:[{id,text}],
//     issues?:[{severity,where,problem,suggestion,idxs}] }
//   issues[].idxs: idx(s) de page.fields que esse achado se refere (mesmos
//   idx usados em fills) — [] quando o achado é sobre o documento/texto em
//   geral, sem campo específico. Um achado pode juntar vários campos (ex.:
//   [5,6]). O frontend usa isso pra sublinhar cada campo na tela
//   (vp-copiloto.jsx).
// ============================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

const SYSTEM = `Você é o Copiloto VP, assistente de IA da VerticalParts dentro do sistema interno "VP Gestão"
(plataforma de importação, engenharia, comercial, jurídico e financeiro de equipamentos de transporte
vertical — elevadores, escadas e esteiras rolantes). Você acompanha o usuário em TODAS as telas.
Fala português do Brasil, com tom direto, cordial e prático. Trata o usuário como colega de equipe.

Você SEMPRE recebe o contexto da tela atual em "page":
- route: identificador da rota; title: título da tela.
- fields: lista dos campos do formulário visível. Cada campo tem:
  idx (índice estável), label (rótulo), type (text|select|textarea|number|date…),
  value (valor atual), options (valores válidos, quando select), required (true/false).
Quando houver, "documentText" traz o texto do documento/preview renderizado na tela.

Comporte-se conforme "mode":

• mode "chat":
  Responda à mensagem do usuário sobre a tela atual ou o sistema. Seja útil e objetivo.
  Se ele pedir para ir a outra tela, explique como (não navegue sozinho).

• mode "fill":
  O usuário quer que você PREENCHA o formulário da tela.
  - Use os dados fornecidos pelo usuário (mensagem atual + histórico da conversa) para preencher.
  - Só preencha campos que EXISTAM em page.fields; referencie cada um pelo "idx".
  - Para selects, "value" DEVE ser um dos valores em "options".
  - Para campos OBRIGATÓRIOS (ou claramente necessários) cujo valor você não tem como saber
    (ex.: CNPJ, razão social, endereço, valor do contrato), NÃO INVENTE. Em vez disso gere
    "questions" perguntando exatamente o que falta — perguntas curtas, específicas, uma por dado.
  - Em "fills" devolva apenas os campos que você consegue preencher com segurança AGORA.
  - "reply": resuma o que preencheu e/ou diga que precisa das respostas das perguntas.

• mode "analyze":
  O usuário quer que você REVISE o documento/preenchimento procurando erros.
  - Examine documentText + os valores dos campos. Aponte: dados faltando, inconsistências,
    valores suspeitos (datas, CNPJ, moeda), cláusulas problemáticas ou ambíguas, riscos.
  - Para cada achado gere um item em "issues" com:
    severity ("alta"|"media"|"baixa"), where (onde está), problem (o que está errado),
    suggestion (sugestão concreta de melhoria — pode propor um texto melhor),
    idxs (lista dos "idx" de page.fields a que o achado se refere — os MESMOS
    números usados em "fills" — quando o achado for sobre um ou mais campos
    específicos vazios/incorretos; ex.: [5,6] se o achado junta 2 campos.
    Use [] (lista vazia) quando for sobre o documento/texto em geral, sem
    campo correspondente). O frontend usa "idxs" pra sublinhar CADA campo
    citado na tela, então SEMPRE inclua todo idx real mencionado no "where"
    ou "problem" — nunca cite "idx N" no texto sem também colocar N em "idxs".
  - Se estiver tudo certo, devolva issues vazio e diga isso em "reply".
  - Liste no máximo os ~10 achados MAIS RELEVANTES (prioridade alta > média > baixa),
    para manter a resposta concisa e dentro do limite de tokens.

REGRAS DE SAÍDA (obrigatórias):
- Responda APENAS com um único JSON válido, sem nenhum texto fora dele, sem markdown, sem cercas.
- Formato:
  {"reply":"...","fills":[{"idx":0,"label":"...","value":"..."}],"questions":[{"id":"cnpj","text":"..."}],"issues":[{"severity":"alta","where":"...","problem":"...","suggestion":"...","idxs":[43]}]}
- Inclua somente as chaves relevantes ao modo. "reply" é SEMPRE obrigatório (1 a 3 frases).
- Nunca invente CNPJ, valores, nomes ou datas: o que não souber, pergunte.`;

// ============================================================
// ROUTE_DOCS — conhecimento específico por tela (chave = page.route,
// mesmo id de src/router.js KNOWN_ROUTES). Injetado no contexto da IA
// só quando bate com a tela atual — não polui token de telas que não
// têm nada a ver. Pedido do usuário (31/08): Copiloto precisa saber
// "100%" sobre cada tela, não só os labels de campo que o scanner
// genérico já lê sozinho — aqui entra a REGRA DE NEGÓCIO por trás dos
// campos/badges/botões, que nenhum scanner de DOM adivinha.
// Convenção de cada entrada: o que a tela faz, cada seção/campo/botão
// importante, e as regras de negócio que um usuário perguntaria "por
// que isso está assim?". Mantenha atualizado a cada mudança real na
// tela (ver commits de 29-31/08 pra o histórico da Precificação).
// ============================================================
const ROUTE_DOCS: Record<string, string> = {
  precificacao: `TELA: Precificação de Elevador (Financeiro).

LISTAGEM (antes de abrir uma cotação): mostra cotações de fornecedor já
respondidas (ou formulários enviados direto com preço combinado por
fora), prontas para calcular o preço de venda. Clicar numa linha abre o
detalhe/cálculo.

DETALHE — DE CIMA PRA BAIXO:

1. "Unidades desta cotação" — herdado do Formulário de Elevadores +
   resposta do fornecedor (custo em USD por unidade, PTAX no dia da
   cotação vs. PTAX agora ao vivo). Botão "Ressincronizar do Fornecedor"
   busca de novo a resposta mais recente do fornecedor.

2. "Mão de obra — busca automática" — tração × capacidade × paradas
   casados contra a tabela de referência em Cadastros → Atualização de
   Custos (custos_instalacao_elevador). Botão "Recalcular" refaz a busca
   pra TODAS as unidades a partir do dado mais atual do Formulário
   (útil se alguém corrigiu tração/capacidade/paradas lá depois).
   Situação de cada linha:
   - "Confirmado" (verde) — achou uma linha REAL da tabela (cotação de
     instalador de verdade) pra essa tração+capacidade+paradas exatas.
   - "Estimativa — não confirmada" (amarelo) — achou uma linha, mas o
     valor foi gerado por regressão estatística (extrapolação sobre
     linhas reais da mesma tração), não é cotação real de instalador.
     Exige aprovação técnica/financeira igual "Projeto especial" antes
     de aprovar a precificação — não é preço garantido.
   - "Projeto especial" (vermelho) — a combinação tração+capacidade+
     paradas está fora de qualquer faixa cadastrada. O valor NÃO entra
     sozinho em lugar nenhum — precisa digitar manualmente em
     "Instalação e Montagem" quando tiver uma cotação real de
     instalador/engenharia.
   - "Pendente" (amarelo) — falta tração, capacidade ou paradas no
     Formulário de Elevadores dessa unidade.
   Botão "Trocar" em qualquer linha abre edição inline de tração/
   capacidade/paradas — grava direto no Formulário de Elevadores da
   unidade (fonte da verdade) e já recalcula a busca de MO na hora. Útil
   quando a tração escolhida está errada ou pra testar outra config.

3. "Despesas de Importação" — VMLE, Seguro, Frete+Seguro+Capatazia em
   USD (dois campos separados: "Padrão 120d, container compartilhado" e
   "Expresso 90d, container exclusivo" — deixar o expresso em
   branco/zero se o cliente não pediu essa opção), Siscomex, Câmbio
   (com atalho "Usar" pro dólar ao vivo), Outras despesas, Despachante +
   Desembaraço, Demurrage, e Containers (tamanho/quantidade herdados da
   resposta do fornecedor quando possível, preço do frete digitado pelo
   Financeiro).

4. "Instalação e Montagem" — lista FIXA de 7 itens, sempre nesta ordem
   (não dá pra adicionar/remover item): Mão de Obra, Custos Engenharia,
   ART, Andaime, Talha, Empilhadeira, Ajudantes. "Mão de Obra" é
   SOMENTE LEITURA — herda automaticamente a soma de TODAS as linhas da
   tabela "Mão de obra — busca automática" acima (Confirmado +
   Estimativa somados juntos). Os outros 6 continuam digitados à mão
   pelo Financeiro (preenchimento avulso de Engenharia/Logística).

5. "Despesas Extras" — catch-all: Frete interno (Brasil), Armazenagem,
   % de Serviços, Contingência, Outros custos não recuperáveis (esses
   dois últimos só entram no motor oficial V2, o V1 legado ignora), e
   Itens avulsos (lista livre, pode adicionar/remover).

6. "Resumo de Custos" — visão consolidada, cada linha soma campos das
   seções acima, nada digitado aqui: Custos Equipamentos (VMLE×câmbio),
   Custos com Frete (Seguro+Frete/Capatazia padrão, em R$), Mão de Obra
   (mesmo valor do item 1 da lista fixa acima), Custos Operacionais
   (soma dos outros 6 itens da lista fixa — Empilhadeira, Munck etc.),
   Frete Interno (Brasil), Custos Imposto (II+IPI+PIS+COFINS+ICMS — só
   aparece depois de clicar "Calcular" pelo menos uma vez, porque
   precisa da cascata fiscal completa; antes disso mostra "—", nunca
   zero fingindo que não há imposto), e Soma (total).

7. "Alavancas do Financeiro" — Markup sobre custo, comissões
   (consultoria/vendedor/indicação), Margem mínima configurada. Link
   "Ver/editar parâmetros fiscais" expande regime tributário e
   alíquotas de importação/venda (ICMS/IPI/PIS/COFINS/IRPJ/CSLL).

8. "Formação do Preço" — escolhe o MODO: "Markup sobre o custo" (usa o
   % das Alavancas acima) ou "Margem desejada sobre a venda" (% próprio
   deste card). Depois de "Calcular", aparecem dois cards lado a lado:
   - "Preço de venda — 120 dias (Compartilhado)": custo econômico
     completo (= custo líquido de importação + despesas operacionais +
     contingência + outros custos não recuperáveis — TUDO isso entra na
     BASE do preço, não só descontado do lucro depois, decisão de
     29/08), preço de venda, margem efetiva (compara com a mínima
     configurada — fica laranja/aviso se abaixo), lucro final. Avisos
     possíveis: "divisor inválido" (markup/margem+impostos+comissões
     somam 100%+, impossível formar preço), "margem efetiva negativa"
     (não deveria aprovar assim), "margem abaixo da mínima" (pode
     aprovar mesmo assim, com confirmação).
   - "Preço de venda — 90 dias (Exclusivo)" — só aparece se o campo
     "Frete... Expresso 90d" (item 3) tiver valor. MESMO custo base,
     só o frete internacional muda (container exclusivo é mais caro) —
     é OUTRO custo econômico completo, não o mesmo número do card de
     120 dias. Serve pra oferecer as duas opções ao cliente na mesma
     conversa. Mostra "R$X a mais que os 120 dias".
   Link "Ver comparação técnica (motor antigo)" no fim — abre um card
   com o resultado do motor V1 (legado, fórmula antiga da planilha
   Excel original). Só existe pra auditoria/comparação: NÃO trava mais
   aprovação nem alimenta a Proposta desde 29/08 (decisão do usuário) —
   antes disso o V1 subprecificava porque não colocava instalação/
   operacional na base do preço, só descontava do lucro depois (podia
   dar markup positivo com margem real negativa, bug corrigido).

BOTÕES DO TOPO: "Salvar rascunho" (grava sem calcular), "Calcular"
(roda o motor, popula Resumo de Custos → Imposto e Formação do Preço),
"Aprovar Precificação" (trava o registro, usa a margem do motor V2
oficial — cai pro V1 só se a precificação nunca foi recalculada desde a
migração —, permite aprovar abaixo da margem mínima com confirmação
explícita).`,
};

function extractJson(text: string): any {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(text.slice(a, b + 1));
  throw new Error("resposta da IA sem JSON");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  const KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!KEY) return json({ error: "IA indisponível: ANTHROPIC_API_KEY não configurada" }, 503);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const mode: string = ["chat", "fill", "analyze"].includes(payload?.mode) ? payload.mode : "chat";
  const message: string = typeof payload?.message === "string" ? payload.message : "";
  const history: any[] = Array.isArray(payload?.history) ? payload.history.slice(-12) : [];
  const page = payload?.page ?? {};
  const documentText: string = typeof payload?.documentText === "string"
    ? payload.documentText.slice(0, 12000) : "";

  // Monta as mensagens: histórico curto + o turno atual com todo o contexto da tela.
  const messages: any[] = [];
  for (const h of history) {
    const role = h?.role === "assistant" ? "assistant" : "user";
    const content = typeof h?.content === "string" ? h.content : "";
    if (content) messages.push({ role, content });
  }

  const routeDoc = typeof page.route === "string" ? ROUTE_DOCS[page.route] : undefined;

  const ctx =
    `MODO: ${mode}\n` +
    `TELA ATUAL: ${JSON.stringify({ route: page.route ?? "", title: page.title ?? "" })}\n` +
    (routeDoc ? `\nCONHECIMENTO DESTA TELA (use pra responder qualquer pergunta sobre o que ela faz, campos, botões e regras de negócio — não é opcional, é a fonte de verdade):\n${routeDoc}\n` : "") +
    `\nCAMPOS DA TELA:\n${JSON.stringify(page.fields ?? [], null, 1)}\n` +
    (documentText ? `\nTEXTO DO DOCUMENTO NA TELA:\n"""${documentText}"""\n` : "") +
    `\nMENSAGEM DO USUÁRIO:\n${message || "(sem texto — use o modo e o contexto acima)"}`;
  messages.push({ role: "user", content: ctx });

  let resp: Response;
  try {
    resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 4096, temperature: 0.2, system: SYSTEM, messages }),
    });
  } catch (e) {
    return json({ error: "Falha ao contatar a IA", detail: String(e) }, 503);
  }

  if (resp.status === 429) {
    const ra = resp.headers.get("retry-after") ?? "";
    return json({ error: "Rate limit da IA" }, 429, ra ? { "Retry-After": ra } : {});
  }
  if (!resp.ok) {
    const t = await resp.text();
    return json({ error: "Erro na IA", detail: t.slice(0, 300) }, resp.status >= 500 ? 503 : 500);
  }

  let out: any;
  try {
    const data = await resp.json();
    const text = (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    out = extractJson(text);
  } catch (e) {
    return json({ error: "Resposta da IA ilegível", detail: String(e) }, 500);
  }

  // Normaliza o contrato — devolve sempre as chaves, vazias quando não se aplicam.
  return json({
    reply: typeof out.reply === "string" ? out.reply : "",
    fills: Array.isArray(out.fills) ? out.fills : [],
    questions: Array.isArray(out.questions) ? out.questions : [],
    issues: Array.isArray(out.issues) ? out.issues.map((it: any) => ({
      severity: typeof it?.severity === "string" ? it.severity : "media",
      where: typeof it?.where === "string" ? it.where : "",
      problem: typeof it?.problem === "string" ? it.problem : "",
      suggestion: typeof it?.suggestion === "string" ? it.suggestion : "",
      idxs: Array.isArray(it?.idxs) ? it.idxs.filter((n: any) => typeof n === "number") : [],
    })) : [],
  });
});
