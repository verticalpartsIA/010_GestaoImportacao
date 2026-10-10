// ============================================================
// vp-copiloto — Edge Function (vpprd)
// Assistente global do VP Gestão. Acompanha o usuário em TODAS as telas.
// IA: Anthropic Claude (secret ANTHROPIC_API_KEY). Mesmo padrão da ncm-duimp-assist.
//
// 4 modos (campo "mode"):
//   • chat        → responde perguntas sobre a tela/sistema
//   • fill        → lê os campos da tela e devolve o que preencher; pergunta o que falta
//   • analyze     → revisa o documento/preenchimento e aponta erros + sugestões
//   • questionario → monta/edita um Questionário de Vistoria (categorias/perguntas)
//                    a partir de um comando em texto (vistorias-envio.jsx). Nunca
//                    escreve direto no banco — devolve "opsQuestionario", que o
//                    frontend mostra em prévia e só aplica se o usuário confirmar
//                    (mesmo princípio do "fills").
//
// Contrato de resposta (JSON):
//   { reply, fills?:[{idx,label,value}], questions?:[{id,text}],
//     issues?:[{severity,where,problem,suggestion,idxs}],
//     opsQuestionario?:[{op,...}] }
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
const MODEL = "claude-sonnet-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// ---- Conhecimento em tabela (10/10/2026) ----------------------------------
// As regras de resposta, o MAPA DO ECOSSISTEMA (GPS) e o conhecimento de cada tela moram na tabela
// public.vp_copiloto_docs (id = 'regras' | 'ecossistema' | 'rota:<rota>'). A função lê com a chave de serviço
// (a tabela tem RLS sem políticas: o navegador não lê). Ajustar o que o Copiloto sabe = UPDATE na tabela, sem redeploy.
// Cache de 60 s por rota; se o banco não responder, cai no ROUTE_DOCS embutido abaixo (nunca derruba o Copiloto).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const docsCache = new Map<string, { at: number; rows: Record<string, string> }>();
async function carregarDocs(route: string): Promise<Record<string, string>> {
  const chave = route || "-";
  const hit = docsCache.get(chave);
  if (hit && Date.now() - hit.at < 60_000) return hit.rows;
  const rows: Record<string, string> = {};
  if (!SUPABASE_URL || !SERVICE_KEY) return rows;
  try {
    const ids = ["regras", "ecossistema", ...(route ? ["rota:" + route] : [])];
    const lista = ids.map((i) => '"' + i + '"').join(",");
    const url = SUPABASE_URL + "/rest/v1/vp_copiloto_docs?select=id,conteudo&id=in.(" + encodeURIComponent(lista) + ")";
    const r = await fetch(url, { headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY } });
    if (r.ok) for (const row of await r.json()) rows[row.id] = row.conteudo;
  } catch (_) { /* fallback: ROUTE_DOCS embutido */ }
  if (Object.keys(rows).length) docsCache.set(chave, { at: Date.now(), rows });
  return rows;
}

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
  idx (índice estável — USO INTERNO, ver regra abaixo), label (rótulo exibido na
  tela — pode vir vazio, ver regra abaixo), hint (título da seção/card onde o
  campo mora, ex. "Mão de obra (hora-homem)" — sempre tente usar isso pra
  contextualizar, principalmente se dois campos tiverem o mesmo label em
  seções diferentes, ex. duas "Observação"), type (text|select|textarea|
  number|date|checkbox…), value (valor atual — para type "checkbox" é sempre
  true ou false, nunca string), options (valores válidos, quando select),
  required (true/false).
Quando houver, "documentText" traz o texto do documento/preview renderizado na tela.
Além disso você recebe, quando existirem: "REGRAS DE OURO" (como nomear campos, GPS, segurança), "MAPA DO ECOSSISTEMA" (o fluxo inteiro e onde cada
tela fica), "POSIÇÃO ATUAL (GPS)" (endereço, caminho no menu, aba ativa), "CONHECIMENTO DESTA TELA" (cada campo, quem doa o dado e quem herda) e
"VISÃO DA TELA" (fotografia do que está visível agora: títulos, valores, tabelas, botões, campos somente leitura). Trate todos como fonte de verdade
e siga as REGRAS DE OURO à risca — principalmente: cite campos pelo RÓTULO EXATO da tela, nunca por nome técnico de código.

⚠️ REGRA CRÍTICA — NUNCA EXPONHA "idx"/ÍNDICE AO USUÁRIO: "idx" é um número de
posição interno, só serve pra você preencher "fills"/"issues[].idxs"
corretamente (o frontend usa isso pra aplicar o valor no campo CERTO da
tela) — o usuário NUNCA vê esse número nem sabe o que ele significa. Na sua
"reply" e em "questions[].text", refira-se a um campo SEMPRE pelo "label"
exatamente como aparece na tela (ex.: "Colaborador", "Categoria (SKU)").
NUNCA escreva "idx 0", "campo 0", "índice 3" ou qualquer variação disso em
texto dirigido ao usuário — isso é incompreensível pra quem não é
desenvolvedor e é exatamente o tipo de erro que você deve evitar.
- Se "label" vier PREENCHIDO: use-o literalmente.
- Se "label" vier VAZIO (campo sem rótulo capturável na tela — acontece em
  selects/inputs dentro de tabela sem <th> correspondente, por exemplo):
  descreva o campo pelo "hint" (seção onde ele está) + "type" + "options"
  (se for select, liste as opções pra dar contexto, ex.: "o campo de seleção
  na seção 'Mão de obra', com as opções X/Y/Z"). NUNCA diga "o campo sem
  nome" nem cite o idx — construa uma descrição útil a partir do que você
  tem (hint, type, options, value atual, e o que a conversa já deixou claro
  sobre o que o usuário está tentando fazer).

Comporte-se conforme "mode":

• mode "chat":
  Responda à mensagem do usuário sobre a tela atual ou o sistema. Seja útil e objetivo.
  Se ele pedir para ir a outra tela, explique como (não navegue sozinho).
  - EXCEÇÃO — pedido de preenchimento: se a mensagem do usuário pedir pra preencher o formulário desta
    tela (total ou parcialmente) — incluindo pedidos como "preenche com valores fictícios/de teste/de
    exemplo/aleatórios" — trate esse turno seguindo TODAS as regras de "mode fill" logo abaixo (inclusive
    a regra de DADOS FICTÍCIOS quando for o caso) e devolva "fills"/"questions" normalmente. O usuário
    não precisa clicar no botão "Preencher página" pra isso funcionar — o Chat tem o mesmo poder, só que
    acionado por texto em vez de botão.

• mode "fill":
  O usuário quer que você PREENCHA o formulário da tela.
  - Use os dados fornecidos pelo usuário (mensagem atual + histórico da conversa) para preencher.
  - **DOCUMENTO ANEXADO** 📄: se a mensagem contém "📄 DOCUMENTO ANEXADO", processa assim:
    · Parseia o conteúdo do documento (texto/Markdown/planilha convertida).
    · Para CADA campo em page.fields, busca NO DOCUMENTO dados que correspondam ao label:
      Estratégia: casamento semântico (não literal) — "Potência" no campo + "22 kW" no documento
      → matches. "Tensão" no campo + "380V" no documento → matches. "Número de paradas" + "15" → matches.
    · Extrai TODOS os matches e monta "fills" com { idx, value } para cada campo preenchível.
    · Ordena por confiança: dados que casam exatamente > dados que casam semanticamente.
    · Nunca invente dados ausentes no documento; campos obrigatórios vazios viram "questions".
    · "reply": resuma quais dados foram extraídos do documento e quais campos ficaram vazios.
  - Só preencha campos que EXISTAM em page.fields; referencie cada um pelo "idx".
  - Para selects, "value" DEVE ser um dos valores em "options".
  - Para campos type "checkbox", "value" DEVE ser o booleano true ou false (nunca "true"/"sim" em texto).
    Uma checkbox que representa uma DECISÃO HUMANA deliberada — confirmação de engenharia, "usar padrão
    comercial", aceite/concordância, ou qualquer rótulo que soe como "confirmado por..." — você NUNCA
    marca como true sozinho, mesmo que o usuário pareça favorável; sempre pergunte antes ou deixe para
    o usuário clicar. Checkboxes puramente estruturais (ex.: "esta parada tem abertura traseira?", a
    partir de uma configuração que o próprio usuário descreveu) podem ser preenchidas normalmente.
  - Você PODE e DEVE dar um palpite fundamentado em campos onde a informação já apareceu (mesmo que
    indiretamente) na conversa ou nos valores já preenchidos na tela — não se limite a copiar dados
    literais; infira o que for razoável (ex.: se o usuário descreveu "elevador de passageiros, 8
    paradas, todas só frente", preencha tipo, paradas e "abertura frontal" de cada uma). Só vire
    "questions" quando o dado for realmente desconhecido e não dedutível do contexto — não pergunte o
    que já dá pra inferir.
  - Para campos OBRIGATÓRIOS (ou claramente necessários) cujo valor você não tem como saber
    (ex.: CNPJ, razão social, endereço, valor do contrato, medidas físicas da obra), NÃO INVENTE. Em vez
    disso gere "questions" perguntando exatamente o que falta — perguntas curtas, específicas, uma por
    dado.
  - Em "fills" devolva apenas os campos que você consegue preencher com segurança AGORA.
  - "reply": resuma o que preencheu e/ou diga que precisa das respostas das perguntas.
  - **DADOS FICTÍCIOS/DE TESTE**: se o usuário pedir explicitamente pra preencher com dados fictícios,
    de teste, de exemplo, "qualquer coisa", aleatórios etc. (ou seja, não pediu dados REAIS específicos),
    a regra "NÃO INVENTE" acima NÃO se aplica a esse pedido — invente valores plausíveis e realistas
    (dentro do domínio de cada campo — um CNPJ com o formato certo, uma data razoável, um valor
    monetário coerente com o resto do formulário) para TODOS os campos, inclusive os obrigatórios, e
    NÃO gere "questions" para eles (não faz sentido perguntar o dado real se o pedido foi por dado
    fictício). Ainda assim, NUNCA marque como true uma checkbox de "decisão humana deliberada" (ver
    regra acima) só por o pedido ser fictício — essas continuam exigindo confirmação humana real, e
    viram "questions" mesmo em modo fictício.

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
    Isso vale igual pra campos type "checkbox" — se o problema é uma checkbox
    marcada/desmarcada de forma inconsistente com outro campo (ex.: uma opção
    "abertura traseira" marcada mas o campo de quantidade correspondente
    vazio ou zero), inclua o idx da checkbox em "idxs" pra ela ser sublinhada
    igual a qualquer outro campo.
  - Se estiver tudo certo, devolva issues vazio e diga isso em "reply".
  - Liste no máximo os ~10 achados MAIS RELEVANTES (prioridade alta > média > baixa),
    para manter a resposta concisa e dentro do limite de tokens.

• mode "questionario":
  O usuário quer ACRESCENTAR ou EDITAR perguntas/categorias de um Questionário de
  Vistoria (vistorias-envio.jsx). Você recebe em "QUESTIONÁRIO ABERTO" a estrutura
  completa atual: categorias (id, nome) e, dentro de cada uma, as perguntas
  (id, texto, tipo_campo, opcoes, obrigatoria, regra_pai_pergunta_id/regra_valor_gatilho).
  - REGRA DE OURO: "Mantenha o conteúdo" significa NÃO reescrever nem remover nada que
    já existe — só ACRESCENTE ou edite exatamente o que foi pedido. Nunca proponha
    excluir uma pergunta/categoria a menos que o usuário peça isso explicitamente.
  - tipo_campo válido: texto, numerico, data, sim_nao, selecao_unica, multipla_escolha,
    foto, assinatura, informativa. "opcoes" (array de strings) só faz sentido pra
    selecao_unica/multipla_escolha.
  - Perguntas condicionais (só aparecem se a resposta de outra pergunta bater um
    valor): use regraPaiTexto = o TEXTO EXATO de uma pergunta já existente na
    estrutura recebida (nunca invente um texto de pergunta-pai que não existe) e
    regraValorGatilho = o valor que dispara (ex.: "Sim"). Sem isso, a pergunta é
    incondicional.
  - Cada operação vira um item em "opsQuestionario":
    · {"op":"add_categoria","nome":"..."} — cria categoria nova.
    · {"op":"add_pergunta","categoriaNome":"...","texto":"...","tipoCampo":"...",
       "opcoes":["..."]?,"obrigatoria":true,"regraPaiTexto":"..."?,"regraValorGatilho":"..."?}
      — "categoriaNome" pode ser de uma categoria JÁ EXISTENTE (bata o nome exato) ou
      de uma categoria sendo criada NESTE MESMO "opsQuestionario" (nesse caso ela é
      aplicada primeiro, na ordem do array).
    · {"op":"editar_pergunta","perguntaId":"...","patch":{...campos a mudar...}}
    · {"op":"excluir_pergunta","perguntaId":"..."} — só quando pedido explicitamente.
    · {"op":"excluir_categoria","categoriaId":"..."} — só quando pedido explicitamente.
  - "reply": resuma em 1-3 frases o que você propõe adicionar/mudar — o frontend
    mostra a lista detalhada de "opsQuestionario" pro usuário confirmar, então não
    precisa listar cada campo na resposta em texto.
  - Sem "QUESTIONÁRIO ABERTO" no contexto, devolva opsQuestionario vazio e peça pro
    usuário abrir/criar um questionário primeiro.

REGRAS DE SAÍDA (obrigatórias):
- Responda APENAS com um único JSON válido, sem nenhum texto fora dele, sem markdown, sem cercas.
- Formato:
  {"reply":"...","fills":[{"idx":0,"label":"...","value":"..."}],"questions":[{"id":"cnpj","text":"..."}],"issues":[{"severity":"alta","where":"...","problem":"...","suggestion":"...","idxs":[43]}],"opsQuestionario":[{"op":"add_pergunta","categoriaNome":"...","texto":"...","tipoCampo":"sim_nao"}]}
- Inclua somente as chaves relevantes ao modo. "reply" é SEMPRE obrigatório (1 a 3 frases).
- Nunca invente CNPJ, valores, nomes ou datas: o que não souber, pergunte.
- Antes de responder, releia "reply" e cada "questions[].text": se algum tiver a palavra "idx",
  "índice" ou um número solto sem explicação referindo-se a um campo, REESCREVA usando o "label"
  (ou "hint" se label vazio) daquele campo. Isso é obrigatório em TODA resposta, não só quando
  "page.route" for de um módulo específico.`;

// ============================================================
// OMIE_KNOWLEDGE — conhecimento geral do ERP Omie, injetado só nas telas
// que de fato dependem dele (ver OMIE_ROUTES abaixo). O Copiloto NÃO tem
// acesso de API ao Omie (não chama nada em tempo real) — isso é
// conhecimento ESTÁTICO sobre como o VP Gestão se integra com ele, pra
// responder perguntas de usuário sem inventar. Pedido explícito do usuário
// (08/10/2026): "ser o maior expert... inclusive saber tudo sobre o
// omie" — decisão de arquitetura: dar PODER de chamar a API do Omie a um
// chatbot embutido no app, exposto com chave pública, é uma mudança de
// escopo/segurança grande (credenciais de escrita do ERP acessíveis pelo
// navegador de qualquer usuário logado) — não implementado sem decisão
// explícita adicional. O que resolve o problema real (usuário sem
// resposta) é este bloco: conhecimento forte, sem poder de ação.
// ============================================================
const OMIE_KNOWLEDGE = `CONHECIMENTO GERAL SOBRE O OMIE (ERP), pra responder dúvidas de usuário:

- O Omie é a FONTE DA VERDADE de cadastro de produto, estoque, estrutura
  (BOM), compras e vendas. O VP Gestão espelha e acrescenta o que o Omie
  não tem (ex.: checklist de produção, mão de obra, carga máquina) — nunca
  o contrário. Se um dado parecer errado, a causa raiz quase sempre está
  no cadastro do Omie, não no VP Gestão.
- "Produto de importação" é definido pelo campo fiscal "origem da
  mercadoria = Estrangeira" no cadastro do produto, NÃO pelo prefixo do
  código (existem VPEL/VPER/VPB/VPMP tanto nacionais quanto importados).
- Prefixos de código de produto usados pela VerticalParts: VPEL = peça de
  Elevador, VPER = peça de Escada/Esteira Rolante, VPB = peça fornecida
  pela BST, VPMP = Matéria-Prima.
- PEDIDO DE VENDA tem um fluxo de etapas (cada conta Omie pode
  customizar as próprias) — NESTA conta da VerticalParts, o fluxo real
  observado é: "Proposta Comercial" → "Pedido de Venda" (código customizado
  "80", NÃO o genérico "10" de outras contas — nunca assuma "10" sem
  confirmar) → "Separar Estoque / Produção" (código "20" — é a ÚNICA etapa
  que o PCP ("Pedidos para Produzir") vigia pra gerar Ordem de Produção
  automaticamente) → "Faturar" (50) → "Faturado" (60) → "Entrega" (70).
  Um pedido parado em "Pedido de Venda" (80) só vira trabalho pro PCP
  depois que alguém no Omie (Comercial/Financeiro) avança manualmente pra
  "Separar Estoque / Produção" (20) — o PCP NÃO lê/avança a etapa 80
  sozinho, isso é por design, não falta de recurso.
- REQUISIÇÃO DE COMPRA ≠ PEDIDO DE COMPRA: o VP Gestão (Reposição,
  Necessidade, Carga Máquina) só cria REQUISIÇÃO de compra no Omie — um
  pedido de intenção, sem fornecedor obrigatório. Alguém no Omie converte
  a requisição num Pedido de Compra de verdade, decidindo o fornecedor
  real ali. Nenhuma tela do VP Gestão fecha um Pedido de Compra sozinha.
- NOTA FISCAL é sempre emitida DENTRO do Omie, pelo setor Fiscal — nenhuma
  tela do VP Gestão emite NF; "Emissão de NF" só ACOMPANHA a situação.
- O "custo" mostrado nas telas do PCP normalmente é o CMC (Custo Médio
  Contábil) do Omie — uma média móvel de todo o histórico de compra,
  não o preço da última compra nem um preço "hoje". Produto nunca comprado
  não tem CMC nenhum (aparece "sem custo").
- "Baixa de produção" no PCP (concluir uma OP com produto acabado) lança
  um AJUSTE DE ESTOQUE no Omie (saída dos componentes + entrada do
  produto pronto) — sempre com confirmação explícita de um humano, nunca
  automático, e sempre comparando antes com o que já foi lançado no Omie
  pra não lançar em dobro.
- O Omie tem limites reais de API que o VP Gestão respeita (ex.: no
  máximo 100 registros por página em algumas consultas, e a API pode
  recusar temporariamente chamadas repetidas "redundantes" em sequência
  rápida) — se um usuário perguntar "por que demorou/deu erro ao
  sincronizar", a causa mais provável é esse tipo de limite, não uma
  falha do VP Gestão.
`;

// Rotas onde o Omie é central o bastante pra justificar o bloco acima no
// contexto da IA (evita gastar tokens com isso em toda tela do sistema).
const OMIE_ROUTES = new Set([
  "pcp", "mes", "almoxarifado", "carga-maquina", "montagem-produto",
  "simulacao-producao", "relatorios-pcp", "expedicao", "emissao-nf",
  "compras", "pi-importacao", "rfq-importacao", "ims-importacao",
  "embarques-importacao", "importacao", "ncm-catalogo",
  "cadastro-produtos", "cadastro-materias-primas", "solicitacoes-produto",
  "ficha-tecnica",
]);

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
  precificacao: `TELA: Precificação (Financeiro & Preços). O conhecimento completo e atualizado desta tela fica na tabela vp_copiloto_docs (id "rota:precificacao"); se esta
mensagem apareceu, o banco não respondeu agora. Responda com o que a VISÃO DA TELA mostra e avise que o detalhamento não pôde ser carregado.`,

  dashboard: `TELA: Dashboard (Geral, todos os perfis).

Visão do dia, conteúdo varia por role (Comercial/Engenharia/Financeiro/Admin).
Mostra KPIs do perfil, projetos em andamento (visão Gantt/Lista/Kanban),
tarefas de hoje, funil comercial e "Onde Parou" (cotações atrasadas).

REGRA NOTÁVEL: o Gantt de projetos é derivado da esteira REAL de gatilhos
(GatilhosEngine), não de uma tabela "projetos" legada (essa está zerada,
issue #274) — o que aparece no Gantt reflete o estado real de cada cotação
em andamento. A fase mostrada no Kanban é só TEXTO informativo: não existe
botão pra mover um card manualmente entre fases — a fase muda sozinha
quando a etapa real correspondente é concluída em outra tela (decisão
23/08, evita degradar em painel Post-it que ninguém atualiza).

AÇÕES: trocar período do resumo; "Relatório CSV"; "Ir para Leads"; "Nova
Tarefa"; clicar num item navega direto pra tela relevante daquele gatilho.`,

  notificacoes: `TELA: Central de Notificações/Alertas (todos os perfis).

Lista todos os "alertas" com resolved=false, agrupados por período/módulo.

REGRA NOTÁVEL: um alerta não tem destinatário específico — é visível a
TODO MUNDO que abre a tela, não só a quem deveria agir (limitação de
arquitetura conhecida, candidata a revisão futura — não confundir com bug,
é assim mesmo hoje).`,

  decisoes: `TELA: Central de Decisões (visível só pra quem é aprovador de algo).

Inbox pessoal de decisões gerenciais — cada linha é um gate do tipo
"alguém específico precisa aprovar isto pra destravar o próximo passo".
Só aparece pra quem está em "aprovadores_esperados" (papéis fixos: CEO,
Owner, Gestor Comercial, RH, Líder de Engenharia, Líder de Logística).

AÇÕES: Aprovar; Reprovar (exige motivo obrigatório).

REGRA NOTÁVEL: decisões podem nascer "bloqueada_por_dependencia" e se
destravam sozinhas quando a(s) decisão(ões)-pai são aprovadas — não
precisa mexer manualmente. Toda resolução (aprovar/reprovar) dispara uma
notificação pro solicitante. Gates codificados hoje: envio de proposta
(Gestor Comercial→CEO), contratação de mão de obra (CEO), montador entra
na obra (RH), compra de equipamento no fornecedor (CEO), compra de
varejo/Almoxarifado (Chefe de Logística). Esta tela é o motor por trás de
travas que aparecem em várias outras (ex.: "Decidir comprar" desabilitado
em Cotação a Fornecedor, "Enviar contrato" travado no Contrato de Venda).`,

  financeiro: `TELA: Gatilhos & Prazo (Financeiro/Admin).

NÃO confundir com Precificação nem com Aval Financeiro — são 3 telas
distintas, arquivos separados. Esta é o painel da cadeia AUTOMÁTICA de
gatilhos por cotação (GatilhosEngine — sem cron, reprocessa toda vez que a
tela é aberta), mais gatilhos manuais/avulsos criados à mão.

AÇÕES: Novo gatilho; Exportar CSV; Confirmar sinal / Aval de Pagamento por
nó da cadeia; Fechar gatilho com motivo.

REGRA NOTÁVEL: propositalmente sem SLA embutido nas etapas — decisão do
usuário (23/08): "só o fato consumado", ou seja, a tela mostra o que já
aconteceu e o que está pendente, sem alarme automático por atraso. A barra
de Gantt visual interpola de azul pra vermelho conforme o prazo se
aproxima, mas isso é só indicação visual, não gera alerta sozinho.`,

  leads: `TELA: Pipeline de Leads (Comercial).

Entrada do funil comercial — cadastro do cliente/contato/prédio. Desde
15/08 NÃO coleta mais equipamento junto (antes um Lead ficava preso a 1
único equipamento) — o equipamento é alocado depois, no Formulário.

REGRA NOTÁVEL: validação mínima pra salvar é só Prédio + Contato. CNPJ/CPF
é OPCIONAL — vira "documento pendente" (estado válido do cliente, não
impede seguir o funil). Ao editar um lead que já tem cliente vinculado, a
sincronização com o cadastro de cliente roda mesmo sem documento
preenchido — de propósito, pra não fazer o toast dizer "atualizado" quando
na verdade a sincronização falhou silenciosamente.`,

  'lead-detail': `TELA: Detalhe de Lead (Comercial).

Mostra o cliente vinculado ao lead, histórico real de eventos (vp_logs) e
uma comissão PREVISTA (4% fixo no código, só informativo — não é o cálculo
real de comissão, que acontece em Comissões).

REGRA NOTÁVEL: o botão "Qualificar → Dossiê" só fica disponível quando o
status do lead é "Em qualificação" ou "Aguardando cotação" — em outros
status fica escondido/desabilitado.`,

  formularios: `TELA: Formulários (hub, Comercial).

Grid estático de categorias de formulário técnico. Hoje só "Equipamento"
está implementada de verdade (Elevador/Escada/Esteira moram juntas no
mesmo formulário desde 15/08) — as outras 5 categorias mostradas no grid
são placeholders "Em breve", sem tela por trás ainda.`,

  'formulario-elevador': `TELA: Formulário — Equipamento (Elevador/Escada/Esteira).

Mesmo componente serve DOIS canais: uso interno assistido pelo vendedor
(rota "formulario-elevador", precisa de login) e o formulário público
standalone que o próprio cliente preenche (link com token, sem SSO,
"self_service" — página separada, não é uma rota do shell). Coleta um
Header (dados do cliente, fiscal, logística) + N "Unidades" (um bloco por
elevador/escada/esteira do mesmo pedido).

"CAMALEÃO" (15/08): o card de cada unidade muda os campos mostrados
conforme o tipo escolhido (Elevador / Escada Rolante / Esteira Rolante).
Elevador usa as colunas reais de sempre (intocadas — RFQ, Precificação
etc. dependem delas). Escada e Esteira usam um campo 'especificacoes'
(jsonb) com os ~55-60 campos técnicos das planilhas de spec do setor,
digitados como texto livre (com o valor típico como placeholder, não como
opção fechada — as planilhas do setor chamam isso de "opções típicas", não
uma lista rígida, então virar <select> obrigatório inventaria uma rigidez
que a spec real não tem).

CAMPOS-CHAVE DA UNIDADE ELEVADOR: Tipo (Passageiro/Carga/Hospitalar/
Panorâmico/Home Lift), Tração (2:1 ou 4:1 — pré-requisito pra Precificação
achar a linha certa na tabela de mão de obra em Cadastros → Atualização de
Custos; sem tração preenchida a busca automática de MO fica "Pendente"),
Capacidade (kg), Paradas, Norma (Glarie Standard/China Standard/EN81-…),
"Instalação Será" (VerticalParts ou Cliente — renomeado de "Tipo de mão de
obra" em 28/08, mesmo campo do banco por trás, mesmo nome de coluna
'tipo_mao_de_obra'), Responsável pela Entrega (campo distinto — quem
INSTALA vs. quem é responsável pela ENTREGA física, não confundir os
dois), Origem da Venda (Conquista Vendedor / Indicação VerticalParts /
Indicação Escamax+Vendedor / Indicação Terceiros / Site).

REGRA NOTÁVEL: pra salvar como RASCUNHO a exigência é mínima (nome,
contato, prédio — não exige CNPJ, porque 'clientes.razao_social' é
NOT NULL no banco e travava silenciosamente se exigisse documento cedo
demais). Para ENVIAR (gerar RFQ pro fornecedor) todos os campos técnicos
marcados com "*" de cada unidade são obrigatórios. O formulário inteiro
fica com 'fieldset disabled' durante o salvamento, pra evitar edição
concorrente enquanto grava.

ALIMENTA: Cotação a Fornecedores (gera o RFQ), Controle de Cotações,
Precificação (herda tração/capacidade/paradas pra achar a mão de obra
automática) e a Proposta.`,

  'controle-cotacoes': `TELA: Controle de Cotações (Comercial).

Une num só lugar o histórico legado (tabela 'cotacoes_elevador_historico')
com as cotações novas nascidas do Formulário.

REGRA NOTÁVEL: uma linha do histórico legado não tem cadeia real por trás
— clicar nela não abre nada de útil, porque esse dado é só um resquício da
época anterior ao Formulário atual. O botão "Abrir no Formulário" numa
linha legada faz a cotação "ressuscitar" na hora, criando um Formulário
real a partir dos dados antigos — é a forma de trazer uma cotação velha
pro fluxo atual.`,

  'cotacoes-fornecedor': `TELA: Cotações a Fornecedor (lista).

Lista todas as solicitações técnicas de RFQ enviadas a fornecedores (hoje
só Glarie/elevador está de fato implementado, mas a tela foi desenhada
para qualquer categoria futura). Substitui a antiga "Cotações China"
(mock) — cada linha aqui vem de um envio real originado do Formulário de
Elevadores.

CAMPOS: Nº Documento, Nº Cotação, Prédio/Cliente, Fornecedor, Categoria,
Enviado em, Status, Equipamentos (Master ID por unidade).

AÇÕES: abas de status (Todos/Aguardando/Recebida/Em análise/Aprovada);
filtros por Fornecedor e Categoria; seleção em lote + "Excluir
selecionadas" (exige motivo digitado); clicar numa linha abre o detalhe.

REGRA NOTÁVEL: excluir SEMPRE exige justificativa textual — não existe
exclusão silenciosa aqui.`,

  'cotacao-fornecedor-detail': `TELA: Detalhe de Cotação a Fornecedor.

O portal PÚBLICO que o fornecedor de fato preenche é outra página, sem
rota interna do shell (acessado via link com token). Esta tela é a visão
INTERNA: link público gerado, resposta recebida, linha do tempo
(enviado→visualizado→respondido→decidido→aprovado).

AÇÕES: "Copiar link público"; "Ver resposta do fornecedor" (mostra o que o
fornecedor de fato preencheu, inclusive o campo de container — hoje texto
livre, ex.: "1x40HC + 1x20GP"); "Decidir comprar"; "Aprovar compra"; aba
"Tratativas" (thread de mensagens + anexos com o fornecedor).

REGRA NOTÁVEL: "Decidir comprar" fica desabilitado (com tooltip
explicando o motivo) enquanto o gate financeiro ('podeIniciarCompra') não
estiver liberado — precisa de contrato assinado + sinal pago + aval
financeiro concedido. Antes disso o botão simplesmente não fazia nada e
mostrava um toast genérico, sem dizer o motivo real — corrigido.

ALIMENTA: aprovar a compra libera a cotação na fila de "respondidas" na
Precificação, e adiante a compra de fato junto ao fornecedor.`,

  propostas: `TELA: Propostas Comerciais (lista).

Visibilidade por vendedor: quem não tem a capacidade "ver_todas"
(configurável em Configurações → Permissões) só enxerga as próprias
propostas.

REGRA NOTÁVEL: a aba "Prontas para enviar" inclui propostas em status
'calculado' E 'finalizado' juntas (antes só incluía 'calculado' e a
proposta sumia da lista no momento errado assim que era finalizada — bug
corrigido). O KPI de valor total só soma propostas que já têm
'numero_documento' atribuído, justamente pra não inflar o número com
rascunhos/demos sem numeração oficial.`,

  'proposta-editor': `TELA: Editor de Proposta (Comercial).

Top tabs por tipo de equipamento (Elevador/Escada/Esteira), com preview de
PDF ao vivo enquanto edita.

REGRA NOTÁVEL: uma proposta já 'aprovada' mas sem 'destravada_em'
preenchido fica TRAVADA pra edição — só quem tem a capacidade
"destravar_aprovada" (concedida em Configurações → Permissões) consegue
reabrir. Herança de dados (do Formulário/Precificação) só preenche campo
que estiver VAZIO — nunca sobrescreve algo que o vendedor já digitou à
mão — e roda automaticamente 1x só, na primeira abertura. O tipo de
equipamento mostrado ('eq') é deduzido do CONTEÚDO da proposta, não de um
campo 'proposal_type' — porque esse campo ficou nulo em ~290 de 311
propostas migradas do sistema antigo (bug real, corrigido 21/08: sem essa
dedução, propostas antigas abririam com a aba errada). Geração de PDF
migrou de html2canvas (arquivo de 6-7MB, pesado) para react-pdf/impressão
nativa (vetorial, muito mais leve).

ALIMENTA: assinatura digital pública do cliente, depois Contrato de
Venda / Contrato Instalador.`,

  'aval-financeiro': `TELA: Aval Financeiro (Financeiro/Admin + CEO + Owner).

Gate em DUAS etapas, cada uma com aprovadores diferentes:
1) Proposta aprovada → Contrato: precisa de consulta de score de crédito
   do cliente + aval financeiro (aprovar/reprovar).
2) Contrato assinado → Compra no fornecedor: precisa de sinal pago
   confirmado + Aval de Pagamento + aprovação do CEO (Diego, hoje sem
   login próprio no sistema) + aprovação do Owner (trava por lista fixa de
   e-mails, 'OWNER_EMAILS').

STATUS POSSÍVEIS (badge): "Aguardando consulta" (cinza), "Aguardando
aval" (amarelo), "Aprovado" (verde), "Reprovado" (vermelho).

SEÇÕES/AÇÕES: "Consultar score" (modal — fonte Serasa/SPC/Boa Vista/
Outro, score/resultado, classificação, observações); "Dar aval" ou
"Reprovar" (com observações); "Confirmar sinal" (valor + data); Aprovação
CEO; "Minha aprovação" (Owner).

REGRA NOTÁVEL: o "teto de custo" do CEO é calculado como
'preço de venda (motor V2 oficial) × (1 − margem mínima configurada)'.
Um gasto real lançado depois ('registrarCustoReal') que estoura esse teto
NUNCA bloqueia sozinho — só gera um alerta. O gate final
'podeIniciarCompra' checa em ordem fixa: aprovação CEO → aprovação Owner →
sinal pago → Aval de Pagamento → contrato assinado → revisão técnica de
Engenharia liberada.

ALIMENTA: libera criar o rascunho do Contrato de Venda e o botão "Decidir
comprar" na Cotação a Fornecedor.`,

  'cadastro-clientes': `TELA: Cadastro de Clientes (Cadastros, transversal).

Cadastro central usado por Comercial, Importação e Engenharia — não é
duplicado em cada módulo, é sempre o mesmo registro. CNPJ/CPF pode ficar
como "documento pendente" (ver regra de Leads).`,

  'cadastro-fornecedores': `TELA: Cadastro de Fornecedores (Cadastros, transversal).

Cadastro único que serve pra Fornecedor, Agente de Carga, Transportador e
Prestador IMS ao mesmo tempo — cada registro marca sua(s) categoria(s) via
chips de multi-seleção (um fornecedor pode ser mais de uma coisa).

REGRA NOTÁVEL: a média de avaliação de um fornecedor arredonda pra BAIXO
de propósito ('Math.floor', não 'Math.round') — decisão deliberada pra
nunca superestimar a nota de um fornecedor por causa de arredondamento.`,

  'ncm-catalogo': `TELA: Catálogo de Produtos (NCM/DUIMP).

Modelo baseado em DUIMP: Produtos + Operadores Estrangeiros, mais um
kanban de Solicitações NCM (ver 'ncm-kanban').

REGRA NOTÁVEL: a maioria dos produtos chega aqui por HERANÇA da Ficha
Técnica, não por cadastro manual direto — a Ficha Técnica é a origem
normal de um produto novo no catálogo. Excluir um produto que tem ficha
técnica vinculada remove a ficha técnica junto (a tela pede confirmação
explícita antes, justamente porque é uma exclusão em cascata).`,

  'cadastro-instaladores': `TELA: Empresas Instaladoras (Cadastros).

Cadastro RASO — só empresa + colaborador básico. Certificações,
homologação e documentos de compliance (RG/CNH/ASO/NRs/vacinas) ficam em
outra tela (RH → Homologação de Instaladores), embora usem a mesma tabela
por trás ('parceiros_instaladores') — ou seja: o cadastro simples fica
aqui, o compliance documental fica lá, mas é o mesmo registro.`,

  'cadastro-custos': `TELA: Cadastros → Atualização de Custos.

3 abas: Instalação de Elevadores (por Tração × Capacidade × Paradas),
Instalação de Escada/Esteira (por estado — SP vs. Outros Estados) e
Containers (specs ISO por tipo). Tudo aqui é o que a Precificação herda
automaticamente pra montar o custo de mão de obra e frete de uma cotação
— editar um valor aqui não muda precificações JÁ calculadas, só afeta
buscas futuras.

Cada linha da tabela de Elevadores tem: Tração (2:1 ou 4:1 — 21 tipos de
container também cadastrados aqui pra casar com o campo de container do
fornecedor), Capacidade (faixa mín-máx em kg), Paradas, Dias de montagem,
Qtd. de montadores, Valor.

REGRA NOTÁVEL: quando uma linha ainda não tem valor digitado mas já tem
paradas/dias/montadores/capacidade suficientes, a tela sugere um valor por
REGRESSÃO ESTATÍSTICA sobre as linhas REAIS já cotadas da mesma tração —
mas essa sugestão nunca se auto-aplica, precisa clicar em "Usar", e o
valor resultante fica marcado como estimativa (mesmo badge amarelo
"Estimativa — não confirmada" que aparece depois na Precificação), nunca
como preço confirmado de instalador de verdade. Cada linha pode ser
adicionada/removida; a aba lembra a tração escolhida na própria URL
(deep-link).`,

  juridico: `TELA: Contratos & Minutas (tela-índice do Jurídico).

Lista 'contratos_venda_equipamentos' com KPIs e atalhos rápidos.

AÇÕES: "Importar minuta" (hoje só mostra um toast, não persiste nada de
verdade — ainda não implementado); "Novo contrato"; Acesso Rápido
(Contrato Cliente ativo, Contrato Montador ainda desabilitado/"Em breve").

REGRA NOTÁVEL: os KPIs desta tela usam rótulos de status LEGADOS,
diferentes dos status normalizados usados no dashboard de Contrato de
Venda ('CVDashboard') — são duas visões distintas da mesma tabela, não é
inconsistência de dado, é vocabulário diferente por tela.`,

  'contrato-venda-equipamentos': `TELA: Contrato Venda de Equipamentos.

Wizard + painel pra gerar/enviar/acompanhar o contrato de venda ao cliente
final, com assinatura digital pública auditável (registra IP, user-agent e
hash SHA-256 de cada assinatura).

CAMPOS-CHAVE: Comprador, valor, sinal (%), parcelas, Anexo I (a Proposta
já assinada, anexada automaticamente).

AÇÕES: Enviar/Reenviar link de assinatura pro cliente.

REGRA NOTÁVEL: criar o rascunho do contrato ('createDraft') exige que o
Financeiro já tenha dado aval ('podeEnviarContrato') — sem isso a ação
lança um erro explicando o motivo, não deixa criar contrato "solto" sem
aval.

ALIMENTA: contrato com 'status='assinado'' é uma das condições do gate
'podeIniciarCompra' (Aval Financeiro).`,

  'contrato-instalador': `TELA: Contrato Instalador.

Wizard/painel análogo ao Contrato de Venda, mas para prestação de serviço
com instaladores terceiros (abas Painel / Novo contrato).

REGRA NOTÁVEL: ainda marcado como "EM BREVE" no card de Acesso Rápido do
Jurídico — o fluxo recomendado hoje continua sendo o Contrato de Venda
para formalização.

ALIMENTA: o custo real de instalação lançado aqui pode ser registrado como
custo real ('registrarCustoReal') contra o teto do Aval Financeiro.`,

  'contrato-editor': `TELA: Editor de Contrato (Jurídico).

Editor full-page em 5 seções: Dados do Contrato, Comprador, Objeto, Preço
e Pagamento (parcelas), Assinatura. Herda dados a partir do número da
proposta vinculada.

AÇÕES: Salvar; Gerar PDF; Assinar; Adicionar parcela.

REGRA NOTÁVEL: existe uma barra de progresso por seção ('sectionFill')
mostrando o quanto cada bloco está preenchido. As parcelas recalculam
automaticamente sempre que o valor total do contrato muda. Igual à regra
da Proposta, a herança de dados nunca sobrescreve um campo que o usuário
já preencheu manualmente — só entra em campo vazio.`,

  importacao: `TELA: Gestão Importação — Importação (rastreio AIS/Sinay).

Usa a tabela 'embarques' (DIFERENTE de 'embarques_importacao', usada pela
tela rica "Embarques" dentro de Gestão Importação). ATUALIZADO 31/08:
a sobreposição entre as duas foi resolvida — "Embarques" (rota
'embarques-importacao') agora É a fonte da verdade: quando alguém
preenche AWB/BL + Armador (SCAC) lá, o sistema cria/atualiza
AUTOMATICAMENTE o registro correspondente aqui em 'embarques' (via coluna
'origem_embarque_importacao_id'), incluindo já disparar a 1ª sincronização
de rastreio. Não existe mais duplicação manual — só quando alguém usa o
botão "Novo embarque" direto nesta tela (fluxo legado, ainda funciona,
mas o normal agora é cadastrar em "Embarques"). Mostra embarques em
trânsito + rastreamento AIS.

ALIMENTA: 'importacao-detail', 'importacao-rastreamento',
'importacao-email'; é a ponte com Cotação a Fornecedor via a lista
"Compras aguardando embarque".`,

  'importacao-detail': `TELA: Gestão Importação — Detalhe de Embarque.

Painel de detalhe de um embarque específico da tabela 'embarques'.

BOTÃO "Ver mapa" (adicionado 29/08) abre um POPUP GRANDE com mapa real
(Leaflet, não mais SVG estático) — engenharia reversa do site Safecube/
Sinay (fornecedor da API de rastreio). Trocador de estilo no canto
superior direito: Claro / Escuro / Ruas / Satélite (tiles Esri Canvas +
OpenStreetMap + Esri World Imagery, todos gratuitos, sem chave). A rota
desenhada usa WAYPOINTS MARÍTIMOS REAIS (Estreito de Malaca → Índico →
Cabo da Boa Esperança → Atlântico Sul p/ Ásia↔Brasil) — nunca uma linha
reta (uma reta Xangai-Santos cruzaria o continente africano, bug real
corrigido no dia).

"Linha Do Tempo De Eventos" mostra o histórico real vindo da Sinay
(Container Arrival/Departure/Gate-In etc., coluna 'tracking_events',
populada pela edge function 'ais-sync') quando o embarque já sincronizou
pelo menos uma vez; antes disso cai numa timeline genérica de 9 fases
(sem dado real ainda).

Card "Trigger Financeiro" foi corrigido em 29/08 — antes mostrava um
valor 100% inventado (R$ 620.000 fixo no código, sem base real nenhuma).
Hoje mostra um estado honesto: avisa que não existe gatilho financeiro
automático ligado a embarques ainda, e só exibe o valor real da invoice
como referência quando cadastrado.

REGRA NOTÁVEL: o botão "Reportar chegada" só pode ser usado UMA vez por
embarque — ao clicar, cria automaticamente 2 tarefas (uma pra Engenharia,
uma pra Instalação), então clicar de novo não duplica nada porque a ação
já fica indisponível depois da primeira vez.`,

  'importacao-rastreamento': `TELA: Mapa Marítimo / Rastreamento de Navios.

Integração real via Edge Function 'ais-sync', ajustada nesta sessão pra
rodar a cada 24h (era 6h antes).

REGRA NOTÁVEL: existem 3 modos de rastreamento, escolhidos automaticamente
por prioridade (o modo usado é mostrado no toast, então dá pra saber qual
foi usado): (1) Sinay/Safecube REAL — se houver chave 'SINAY_API_KEY' e o
embarque tiver BL/número de container; (2) AIS genérico por número IMO do
navio — fallback legado; (3) simulação por interpolação de posição — usado
quando não há nenhuma chave/dado disponível, é uma posição estimada, não
real. Nunca finge ser dado real quando é simulado — o toast avisa.`,

  'importacao-email': `TELA: Inbox de Importação (e-mails).

ACHADO REAL: a integração IMAP não está configurada — a lista de e-mails é
um array vazio fixo no código, com aviso honesto na tela dizendo isso
("sem mock"). Existem corpos de e-mail de exemplo no código, mas nunca são
exibidos de fato — a tela hoje não tem conteúdo real pra mostrar.`,

  'gi-painel': `TELA: Gestão Importação — Painel.

Dashboard somente-leitura que agrega P.I. / RFQ / IMS / Embarques em
paralelo (um 'Promise.all' que busca as 4 fontes ao mesmo tempo). Não tem
tabela própria — é 100% agregação do que já existe nas outras telas.`,

  'pi-importacao': `TELA: Gestão Importação — Proforma Invoices (P.I.).

Fase 1 da consolidação do fluxo de importação. Gerencia P.I.s com
itens/pagamentos/produção, com vínculo opcional a um Embarque.

REGRA NOTÁVEL: ao preencher o Nº da Cotação numa P.I. nova, a tela checa o
gate de compra do CEO ('DecisoesStore.verificarGateCompra') — se a compra
daquela cotação ainda não foi liberada pelo CEO, a criação da P.I. é
bloqueada. Não dá pra criar P.I. de uma cotação cuja compra ainda não foi
aprovada.`,

  'rfq-importacao': `TELA: Gestão Importação — RFQ.

Fase 2 da consolidação. Cotação comparativa entre N fornecedores × N
itens, com vencedor definido por item individual ou de forma global (todo
o pedido pro mesmo fornecedor).

ALIMENTA: o histórico de preços das RFQs aqui alimenta a tela "Análise de
Preços" ('gi-analise-precos').`,

  'ims-importacao': `TELA: Gestão Importação — IMS (recursos operacionais).

Fase 3 da consolidação. Gerencia Transporte / Munck / Empilhadeira /
Andaime / Mão de obra por projeto — os campos técnicos variam conforme o
tipo de recurso escolhido, com cotação de fornecedor e execução real
(check-in/check-out, avaliação de 1 a 5 estrelas do prestador).`,

  'embarques-importacao': `TELA: Gestão Importação — Embarques (versão rica, FONTE DA VERDADE).

Fase 4 da consolidação. Usa a tabela 'embarques_importacao' (diferente de
'embarques', usada pelo rastreio AIS na rota 'importacao'). Embarque
completo vinculado à(s) P.I.(s), com dados de fornecedor/pagamentos
herdados SÓ-LEITURA (não dá pra editar aqui, só ver — a edição é lá na
P.I.). Traz canal aduaneiro (Verde/Amarelo/Vermelho/Cinza) por embarque.

ATUALIZADO 31/08 — ANTES: esta tela e a de rastreio AIS ('importacao')
não tinham relação nenhuma, precisava cadastrar o embarque duas vezes
(sobreposição não resolvida). AGORA: a aba "Embarque" tem um campo
"Armador (SCAC)" novo, ao lado do AWB/BL já existente. Quando os dois
estão preenchidos, salvar (criar OU editar) este embarque cria/atualiza
AUTOMATICAMENTE o registro espelho em 'embarques' (rastreio AIS/Sinay),
já disparando a 1ª sincronização de posição/timeline na criação. É
upsert por 'origem_embarque_importacao_id' — nunca duplica, mesmo salvando
várias vezes. Esta tela virou a fonte única pra cadastrar um embarque com
rastreio real; a tela de Importação (AIS) só passou a EXIBIR.

Suporta múltiplos containers estruturados por embarque (componente
'EIContainers') — hoje ainda não conectado automaticamente ao campo de
container que o fornecedor preenche na resposta da Cotação (esse campo
continua sendo texto livre único do lado do fornecedor; a estruturação diz
respeito só ao lado interno de Embarques).`,

  'gi-analise-precos': `TELA: Gestão Importação — Análise de Preços.

Somente leitura. Agrupa o histórico de RFQs por item (comparação
case-insensitive de nome de item), ordenado do menor pro maior preço —
serve pra ver rapidamente qual foi o menor preço já cotado pra um item
específico em RFQs anteriores.`,

  compras: `TELA: Importação Varejo ("Compras Nacional" no menu — nome
histórico, o conteúdo de hoje não tem nada a ver com frete nacional).

Lista TODOS os produtos de importação direta e ativos do Omie (identificado
pelo campo fiscal "origem da mercadoria" = Estrangeira, não por prefixo de
código) com estoque, Curva ABC-D de giro (A/B/C por volume faturado desde
01/01/2024; D = sem venda no período) e sugestão de compra calculada.

CAMPOS/CARDS DO TOPO: "Precisa comprar" e "Alerta (no mínimo)" são
clicáveis — funcionam como atalho pros mesmos botões de filtro de cor
(Todas/Precisa comprar/Alerta/OK) logo abaixo. "Valores a pagar
(estimado)": soma sugestão × último preço pago — se você MARCAR produtos
na lista (checkbox), o card passa a somar só os SELECIONADOS, em vez do
total da tela inteira.

COLUNAS DA TABELA: estoque sincronizado do Omie 4x/dia (não é "ao vivo" —
tem um botão "Sincronizar estoque agora" pra forçar), conselho de compra
(Curva D com estoque parado sugere "não comprar mais"), Último Fornecedor
(com selo "exterior" quando aplicável) e Último Preço Unitário (do
histórico real de Pedidos de Compra do Omie, ou de P.I. quando mais
recente — selo "P.I." nesse caso).

AÇÕES: checkbox por linha + "Selecionar todas" (respeita o filtro atual);
"Enviar requisição de compra em massa" abre um modal com Fornecedor/Preço
Unit. editáveis por item (pré-preenchidos do histórico, o comprador
confirma ou corrige) — cria uma Requisição de Compra REAL no Omie, nunca
automático, sempre com confirmação explícita.`,

  'compras-email': `TELA: Inbox de Compras (e-mails).

Mesma limitação da Inbox de Importação: integração IMAP não configurada,
lista de e-mails vazia com aviso honesto na UI.`,

  'pedidos-acompanhamento': `TELA: Pedidos (módulo Suprimentos).

Abas Nacional / Importação. Distinto do "Pedido a Fornecedor" que aparece
em Cotações a Fornecedor — aquele é o RFQ ainda em negociação, este é o
PEDIDO já confirmado e em acompanhamento de entrega.`,

  engenharia: `TELA: Projetos de Engenharia (lista).

Lista/detalha projetos de engenharia (visita técnica, laudo) e valida os
gates de importação ('ProjectGates.validarGatesImportacao') — ou seja,
checа se o projeto já cumpriu os pré-requisitos técnicos pra seguir pro
fluxo de importação.

REGRA NOTÁVEL: as abas Vistoria/Documentos/NCM dentro desta tela são
placeholders que só REDIRECIONAM pras telas reais correspondentes (evita
duplicar o mesmo registro em dois lugares — "agora fica num lugar só").`,

  'solicitacoes-produto': `TELA: Solicitação de Produto (Engenharia/Comercial).

Formulário pensado pra quem NÃO é técnico pedir a criação de um SKU/produto
novo — a Engenharia completa os detalhes técnicos depois. Fluxo: qualquer
setor preenche e clica "ENVIAR PARA ENGENHARIA" → a Engenharia (Arilene) é
avisada automaticamente e faz a análise/desenho → quando pronto, a
Importação (Bianca) é avisada pra avaliar → vira Ficha Técnica de produto.

IMPORTANTE — como se referir aos campos: cite SEMPRE o rótulo exatamente
como aparece na tela (ex.: "Foi um pedido de um cliente específico?",
"Categoria (SKU)") — nunca o nome interno da variável (ex.: nunca diga
"categoria_sku" ou "foiPedidoCliente"). O usuário não sabe e não precisa
saber que existe um nome de campo por trás do rótulo.

CAMPOS DO FORMULÁRIO DE NOVA SOLICITAÇÃO, na ordem em que aparecem:

- "Tipo de Equipamento" — select: Elevador, Escada Rolante ou Esteira. Já
  vem com "Elevador" selecionado.
- "Categoria (SKU)" — select, define o prefixo do código do produto no
  Omie. Opções: "VPEL — Peça de Elevador (VerticalParts)",
  "VPER — Peça de Escada/Esteira Rolante (VerticalParts)",
  "VPB — Peça fornecida por BST", "VPMP — Matéria-Prima (VerticalParts)".
  Qualquer setor pode escolher qualquer categoria, não tem trava por área.
- "O que você precisa?" — texto livre, em palavras simples, do que é o
  produto e pra que serve. Não precisa ser técnico — a Engenharia completa
  os detalhes depois.
- "Detalhes adicionais (opcional)" — qualquer informação extra que ajude.
- "Contato do fornecedor (opcional)" — nome/telefone/e-mail do fornecedor,
  se o usuário já tiver.
- "Link do produto (opcional)" — site do fabricante, catálogo ou
  marketplace onde o produto foi visto.
- "Imagem ou PDF do produto (opcional)" — anexo de verdade (sobe pro
  Storage), aceita imagem ou PDF, pode anexar mais de um arquivo.
- "Foi um pedido de um cliente específico?" — checkbox. É o GATILHO de um
  bloco condicional (ver abaixo).
- "Solicitante" e "E-mail" — já vêm preenchidos com o nome/e-mail de quem
  está logado; raramente precisam ser alterados.

NA VERDADE só DOIS campos bloqueiam o envio se vazios: "Categoria (SKU)" e
"O que você precisa?". Os demais campos marcados com "*" na tela (Tipo de
Equipamento, Solicitante, E-mail) já nascem preenchidos por padrão, então
na prática nunca impedem o envio.

CAMPO CONDICIONAL (só aparece depois de um clique) — regra de negócio
importante: marcar a checkbox "Foi um pedido de um cliente específico?"
revela 3 campos novos, que ficam escondidos até isso acontecer:
  - "Cliente (opcional)" — nome do cliente.
  - "Indústria (opcional)" — ramo/indústria do cliente.
  - "Contato do cliente (opcional)" — telefone, e-mail etc.
**Se a checkbox continuar DESMARCADA, qualquer coisa digitada nesses 3
campos é DESCARTADA ao enviar** (o sistema só grava esses dados quando a
checkbox está marcada — é assim mesmo mesmo que os campos já tenham sido
preenchidos antes de desmarcar). Se o usuário te der nome/indústria/
contato de um cliente pra você preencher, marque também a checkbox "Foi
um pedido de um cliente específico?" como marcada — senão os dados dele
somem silenciosamente e ele nunca vai saber por quê.

DEPOIS DE ENVIAR: a solicitação nasce com o status "NOVO", ganha um número
(formato SOL-AAAAMMDD-#####) e some pra fila da Engenharia. Ciclo de
status que aparece como selo na listagem (o solicitante só ACOMPANHA,
não controla essas mudanças): NOVO → EM ANALISE (Engenharia está
trabalhando nela) → AGUARDANDO DESENHO → PRONTO (Importação foi avisada
pra avaliar) → CONVERTIDO EM FICHA (virou uma Ficha Técnica de produto de
verdade).

Você pode conduzir a conversa perguntando os dados um de cada vez e
preencher a solicitação inteira (mesmas regras gerais de "mode fill" do
sistema): comece pelos dois campos obrigatórios se ainda não tiver essa
informação, e SEMPRE pergunte "foi um pedido de algum cliente específico"
antes de preencher os campos de cliente, justamente pra saber se marca a
checkbox — sem isso o preenchimento do cliente não serve pra nada.`,

  'eng-projeto-elevadores': `TELA: Projeto de Elevadores (Engenharia).

Traduz os desenhos técnicos enviados pelo fornecedor (poço/cabine/porta/
COP-LOP) por unidade, correlacionando pelo Nº da Cotação.`,

  'eng-configurador': `TELA: Projeto de Equipamento — Configurador (Escada/Esteira).

Configurador técnico ao vivo, inspirado em configuradores de mercado
(ex.: TK eSlider), seguindo normas EN/NBR do setor.

REGRA NOTÁVEL: a velocidade máxima permitida da escada é 0,75 m/s se o
ângulo de inclinação for ≤30°, e cai pra 0,50 m/s acima disso — regra de
norma técnica embutida no configurador, não é limite arbitrário do
sistema.`,

  'desenho-tecnico': `TELA: Desenho Técnico ER | ES (Engenharia).

100% cálculo local, SEM Supabase — funciona inteiramente no navegador
("Claude Designer" embarcado no projeto).

REGRA NOTÁVEL: o botão "Cotar" hoje só mostra um toast — não integra de
fato com o módulo de Cotações ainda, é um placeholder visual da intenção
futura.`,

  'ficha-tecnica': `TELA: Ficha Técnica (Engenharia).

Gerador de ficha técnica de produto — preview em tela + exportação em PDF
(html2canvas+jsPDF) + impressão nativa. Documento cresce em múltiplas
páginas A4 conforme o conteúdo (paginação trata cada grupo/descrição/
rodapé como bloco indivisível, nunca corta um bloco no meio entre
páginas).

CATEGORIAS E CAMPOS CUSTOMIZADOS: além das 9 categorias nativas do
sistema, qualquer usuário pode criar categoria/campo novo ("+ Nova
categoria" / "+ Adicionar campo") — isso alimenta uma BIBLIOTECA
COMPARTILHADA (tabelas 'fichas_lib_categorias'/'fichas_lib_campos') que
toda ficha NOVA passa a oferecer. Uma ficha já salva guarda um SNAPSHOT
independente das categorias no momento em que foi criada — ou seja, mudar
ou limpar a biblioteca compartilhada depois NUNCA afeta fichas já
existentes, só o que fichas futuras vão oferecer. Nome de categoria/campo
duplicado é bloqueado na criação (comparação sem acento/maiúsculas).

REGRA NOTÁVEL: o rodapé mostra "· Criado por {e-mail}" pequeno — dado real
de quem gerou a ficha, não decorativo.`,

  'ncm-kanban': `TELA: Solicitações de Classificação NCM (Kanban).

Funil fixo de 5 colunas: Em Preenchimento → Aguardando Jurídico →
Aprovado → Aprovado (Pronto) → Cadastrado.`,

  'ncm-detail': `TELA: Detalhe da Solicitação NCM.

Checklist de 6 itens obrigatórios que precisam estar marcados antes do
botão "Copiar dados formatados" (formato pronto pra colar no LogComex)
ficar habilitado.`,

  'status-obras': `TELA: Status de Obras (lista consolidada).

Lista todas as obras em andamento — é a porta de entrada pro Dossiê de
cada obra individual, não tem dado próprio além da agregação.`,

  'linha-do-tempo': `TELA: Linha do Tempo da Cotação.

Busca por Nº de Cotação e agrega eventos de TODAS as fontes/módulos do
sistema numa única timeline cronológica — rastreabilidade cross-módulo de
ponta a ponta. Somente leitura, não edita nada.`,

  'central-documentos': `TELA: Central de Documentos.

Fase 1 apenas: leitura agregada de documentos vindos de Vistoria +
Documentos + RH num só painel. "Sem pipeline de envio ainda" (comentário
real do código) — a única ação que a tela de fato persiste é "marcar como
enviado", não faz upload/envio de verdade.`,

  'dossier-obra': `TELA: Dossiê da Obra (hub central pós-venda).

Hub que TODAS as outras telas do pipeline pós-venda (ART, Data Book,
Handover, etc.) redirecionam pra dentro — a aba ativa fica espelhada no
3º segmento da URL. É o lugar único onde o histórico documental completo
de uma obra vive de verdade.`,

  vistorias: `TELA: Vistorias de Obras.

ACHADO REAL: esta era 1 de 3 implementações PARALELAS de vistoria que
existiam ao mesmo tempo, sem se comunicar entre si — consolidadas em
15/08 nesta única tela; as outras duas foram aposentadas.`,

  instalacao: `TELA: Instalação em Campo.

Progresso calculado por dias restantes até a previsão de entrega
(data-base + 45 dias) — a cor do indicador muda conforme o prazo se
aproxima.`,

  art: `TELA: ART de Instalação.

Tela de REDIRECT — não tem dado próprio. Só orienta o usuário e manda
direto pro Dossiê da Obra (aba Documentos), que é onde o dado de verdade
fica.`,

  cronograma: `TELA: Cronograma de Pagamento da Instalação.

4 fases de pagamento, cada uma atrelada a um marco físico da instalação do
equipamento.

REGRA NOTÁVEL: a soma das 4 fases precisa fechar EXATAMENTE com o valor
disponível (tolerância de R$0,01) — o sistema bloqueia salvar se as fases
não somarem certo, não deixa ficar "quase" batendo.`,

  databook: `TELA: Data Book & Termo.

Tela de REDIRECT — sem dado próprio, manda pro Dossiê da Obra (aba
Documentos). Antes lia a tabela legada 'projetos' (desconectada, issue
#274) — virou redirect justamente por causa disso, achado classificado
como "Importante" na auditoria.`,

  handover: `TELA: Entrega Final / Handover.

Checklist de entrega + transferência de responsabilidade pra Escamax
(sistema de manutenção preventiva pós-venda). A fonte de dados foi trocada
da tabela legada 'projetos' pra 'dossier_obra' — mesmo padrão de correção
aplicado ao Data Book.`,

  'rh-homologacao': `TELA: Homologação de Instaladores (RH Operacional).

Compliance documental em cadeia Empresa → Colaborador → Documentos
(RG/CNH/ASO/NRs e outros, cada um com data de vencimento). O cadastro RASO
(empresa+colaborador básico) fica em Cadastros → Empresas Instaladoras;
esta tela é só o compliance por cima do mesmo registro.

REGRA NOTÁVEL: a Carteira de Vacinação (documento DOC-080) vira um
checklist de vacinas reais dentro do formulário, gravando múltiplas linhas
(uma por vacina), não um único campo de "vacinado sim/não".

ALIMENTA: é pré-requisito do gate de RH em Central de Decisões (aprovação
"montador entra na obra") e também do Contrato Instalador.`,

  almoxarifado: `TELA: Almoxarifado (Logística Interna → PCP).

Estoque e cadastro de materiais do PCP (Planejamento e Controle da
Produção) — serve a Quadros de Comando, Corrimãos, Cabos de Aço e Cabos de
Manobra (itens cortados sob medida). O Omie é a FONTE dos dados de
cadastro/estoque/estrutura — esta tela espelha e acrescenta o que o Omie
não tem (reposição por consumo, necessidade por carteira, custo manual).

ABAS (sempre visíveis no topo, cada uma com URL própria):

1. "Estoque" — lista de produtos/matérias-primas do PCP com físico,
   reservado, disponível, mínimo (vem do Omie — a maioria dos itens NÃO
   tem mínimo cadastrado lá, aparece "Sem mínimo") e endereço de prateleira
   (campo livre, ex. "A-01-02"). Botão "Sincronizar com Omie" força uma
   releitura; também roda sozinho 4x/dia. Clicar numa linha abre o
   detalhe/histórico daquele item.

2. "Estrutura" — a árvore de componentes (BOM) de um produto: busca por
   "Código ou descrição…", lista "Componente" + "Quantidade por unidade do
   produto". 'origem' de cada linha é "omie" (vem do cadastro oficial,
   só leitura) ou "pcp" (acrescentada aqui — essas sim podem ser
   removidas). Serve pra saber de quanto de cada matéria-prima um produto
   acabado precisa.

3. "Custos" — preenchimento MANUAL de custo pra componente que nunca foi
   comprado no Omie (não tem CMC, ficaria "sem custo" pra sempre nos
   relatórios). Campo "Valor unitário (R$)" + checkbox de confirmação.
   REGRA: o custo do OMIE sempre vale quando existe; o manual só é usado
   enquanto o Omie não tiver custo nenhum — assim que o item for comprado
   de verdade, o CMC do Omie assume sozinho. Exige a alçada
   "almoxarifado.custo_manual" pra gravar (ver "ver_custo" abaixo, que é
   diferente: só pra ENXERGAR custo, sem poder editar).

4. "Reposição" — "o que comprar com base no CONSUMO HISTÓRICO", não no
   estoque mínimo (decisão do usuário: a maioria dos itens é importada,
   ~90 dias de prazo — esperar bater no mínimo já é tarde). Mostra consumo
   médio mensal, cobertura em dias, tendência (▲/▼) e 3 situações por cor:
   vermelho = crítico (acaba antes do prazo de reposição chegar), amarelo
   = "comprar" (ponto de pedido), verde = ok. Clicar nos cards "Precisa
   comprar"/"Alerta" no topo filtra a lista por aquela cor. Checkbox por
   linha + "Selecionar todas" + botão "Enviar compra ao Omie (N)" abre um
   modal que PRECISA simular antes de liberar o envio real (cria uma
   Requisição de Compra de verdade no Omie — nunca confunda simular com
   enviar). Itens FABRICADOS (que têm Estrutura) não entram aqui, aparecem
   como "Produzir" em vez de "Comprar".

5. "Necessidade de materiais" — pergunta diferente da Reposição: "o que já
   foi VENDIDO (pedidos abertos no Omie) e falta de material pra entregar
   no prazo". Mostra pedidos de origem, data de entrega mais cedo, "comprar
   até" (= entrega − prazo de importação) e o aviso "não chega a tempo"
   quando já é tarde pra encomendar. Mesmo botão de enviar compra ao Omie
   da aba Reposição — as duas abas NÃO são somadas automaticamente.

6. "Pedidos de compra" — histórico de requisições já enviadas ao Omie por
   estas telas (não editável, só consulta).

REGRA DE ACESSO NOTÁVEL: custo (de material e de mão de obra) só aparece
pra quem tem a alçada "almoxarifado.ver_custo" — sem ela, a coluna some ou
mostra valor borrado/falso, NUNCA o valor real escondido só visualmente.
Isso é proteção de dado sensível (salário/custo), não um bug de tela em
branco.`,

  'carga-maquina': `TELA: Carga Máquina (Logística Interna → PCP).

Mostra se a capacidade de produção (máquinas + mão de obra) aguenta o que
está planejado, por período.

ABAS: "Capacidade" (visão consolidada, alerta de sobrecarga acima de 85%
amarelo / 100% vermelho — limites fixos, não configuráveis pela tela),
"Máquinas" (cadastro: Código — ex. "MAQ-01" — e dados da máquina/posto de
trabalho), "Roteiro" (horas por unidade de produto em cada recurso/máquina
— é o que alimenta o cálculo de capacidade) e "Recursos" (cadastro de
recursos de mão de obra, ex. "MO-01", separado de máquina física).

REGRA NOTÁVEL: o campo "Horas" no Roteiro é por UNIDADE do produto, nunca
uma estimativa de lote — ele é multiplicado pela quantidade planejada pra
calcular a carga total daquele recurso no período.`,

  'montagem-produto': `TELA: Montagem do Produto — Estrutura e Custo
(Logística Interna → PCP).

Visualiza/edita a estrutura (BOM) e o custo de um produto específico,
buscado por "Código do item…" no topo. É uma visão focada em 1 produto de
cada vez (diferente da aba "Estrutura" do Almoxarifado, que é a lista
geral de todas as estruturas).

REGRA NOTÁVEL: componentes de origem "omie" vêm do cadastro oficial do
Omie (só leitura); só os de origem "pcp" (acrescentados aqui) podem ser
removidos/editados — nunca tente apagar um componente que veio do Omie por
esta tela.`,

  'simulacao-producao': `TELA: Simulação de Produção (Logística Interna →
PCP).

Simula "se eu produzir X unidades de um produto, o material e a capacidade
aguentam?" ANTES de abrir uma Ordem de Produção de verdade — não grava
nada no banco, é só cálculo hipotético. Campo "Produzir" recebe a
quantidade a simular; o resultado mostra se falta material (comparando com
o estoque/Estrutura) e se a Carga Máquina do período suporta.`,

  pcp: `TELA: PCP — Planejamento e Controle da Produção (Logística
Interna). O módulo inteiro gira em torno da ORDEM DE PRODUÇÃO (OP, tabela
'pcp_ordens') — a unidade de trabalho que a produção de fato executa.

ABAS (cada uma com URL própria — um link direto tipo ".../pcp/ordens/<id>"
abre aquela OP específica dentro da aba "Ordens de Produção"):

1. "Ordens de Produção" — lista + detalhe de toda OP já criada.
2. "Pedidos para Produzir" — pedidos de venda do Omie na etapa "Separar
   Estoque / Produção" que ainda não viraram OP. Botão "Gerar OPs" cria a
   OP-mãe do pedido (checklist de separação dos itens que NÃO são do PCP)
   + uma OP-filha por quadro de comando ("-Q") ou por corte de cabo ("-C")
   dentro dele.
3. "Pedidos de Quadro" — fluxo específico do Quadro de Comando: gera
   OP-mãe + uma OP por FRENTE (quadro/fiação/botoeiras/cabos de aço) a
   partir do "Escopo do pedido" preenchido no Formulário/Quadro de
   Comando.
4. "Planejamento" e "Controle" — visões agregadas de acompanhamento (não
   criam OP, só leitura/ajuste de datas).

DETALHE DE UMA OP (o que o usuário vê ao abrir uma linha — ex. o link
".../pcp/ordens/<id>"), de cima pra baixo:

- Cabeçalho: número da OP, "Produto" (código+descrição — numa OP de CORTE
  de cabo, que não grava produto de propósito porque corte nunca baixa
  estoque sozinho, o nome aparece como "Corte — <código>"), "Frente"
  (quadro/fiação/botoeiras/cabos_aco/corte/pedido), status (Aguardando/Em
  produção/Concluída/Cancelada), "Início previsto" (data), "Prazo de
  entrega".
- Botões de ação: "Iniciar produção" (só quando status = Aguardando),
  "Concluir OP" (só habilita quando TODAS as etapas/frentes já estão
  concluídas — o tooltip explica o motivo quando desabilitado), "Concluir
  pedido" (na OP-mãe, quando todas as frentes dela terminaram).
- Ao concluir, pede: "Produzidas" (quantidade boa), "Perdidas" (quantidade
  com perda), "Causa da perda (se houver)" e "Ação corretiva" — texto
  livre nos dois últimos, alimentam os relatórios de Perdas.
- Tabela de ETAPAS — colunas "#", "Etapa", "Setor", "Responsável",
  "Prevista", "Concluída em", "Status" (select: Pendente/Em
  andamento/Concluída, editável linha a linha).
- Seção "Mão de obra (hora-homem)" — tabela com colunas "Colaborador"
  (quem trabalhou — select de pessoas ATIVAS do cadastro geral de
  colaboradores, não só quem tem login no sistema), "Setor", "Horas",
  e (só pra quem tem a alçada "pcp.ver_hh") "Valor da hora"/"Custo". Botão
  "Apontar" grava a hora-homem; "Trocar"/"Remover" editam uma linha já
  apontada. Exige a alçada "pcp.apontar_hh" pra lançar.
- Se a OP já está "Concluída" e TEM produto (ou seja, não é corte): card
  "Baixa no estoque do Omie" — simula a saída dos componentes +
  entrada do produto acabado, deixa corrigir a quantidade antes de
  confirmar, e só então lança DE VERDADE no Omie (nunca automático).

REGRA NOTÁVEL — não confundir "Mão de obra (hora-homem)" com "Colaborador"
de outra tela: aqui o campo que pergunta "quem trabalhou" sempre se chama
"Colaborador" na coluna da tabela — se um campo parecido aparecer sem
rótulo capturável, é esse mesmo (contexto: seção "Mão de obra").

ALIMENTA: MES (só OP com frente='quadro' pode ser "liberada para o MES" —
ver tela 'mes'); Emissão de NF e Expedição dependem da OP-mãe do pedido
estar concluída.`,

  mes: `TELA: MES — Sistema de Execução da Manufatura (Logística Interna).
Acompanha a produção DETALHADA de um Quadro de Comando (OP com
frente='quadro') passo a passo, por 12 etapas reais de chão de fábrica —
diferente do PCP, que só controla a OP como um todo.

A OP só avança por "Concluir etapa" (nunca pulando) — cada etapa valida um
GATE antes de deixar concluir: ex. FURACAO exige os furos previstos todos
executados; TESTES exige pelo menos um teste sem potência E um energizado
aprovados; QUALIDADE exige número de série preenchido; EXPEDICAO exige
transportadora e data de saída.

ABAS: "Kanban" (colunas por etapa; cor do card: verde/amarelo/vermelho =
prazo, CINZA = bloqueada, ROXO = em retrabalho — filtros "Atrasadas /
Bloqueadas / Retrabalho"), "Painel" (indicadores agregados), "Ordens"
(lista), "Apontamentos" (tempo médio por etapa), "Painel TV" (só leitura,
tela cheia, recarrega sozinho a cada 30s — pra deixar numa TV do chão de
fábrica).

DENTRO DE UMA OP, abas internas: "Etapa" (botão "Iniciar etapa" → depois
"Concluir etapa", que só habilita quando o checklist da etapa está
completo — o texto do botão mostra "faltam N" enquanto não está),
"Ligações" (cadastro de ligações elétricas previstas × concluídas, usado
pelo gate da etapa ELETRIFICACAO), "Testes" (um teste REPROVADO exige
descrição do problema e ABRE UMA NC automaticamente), "NCs" (Não
Conformidade: aberta → corrigida → fechada; uma NC nascida de um teste só
fecha com um teste novo aprovado depois da correção), "Materiais"
(consumo real, com item CRÍTICO marcado faltante travando a OP sozinho),
"Bloqueios" (botão "Registrar problema / Bloquear OP" — 8 motivos; bloquear
PAUSA a execução em andamento automaticamente), "Histórico" (trilha
imutável, nunca editável/apagável).

REGRA NOTÁVEL: só OP com frente='quadro' aparece no MES — OP de corte de
cabo, fiação avulsa etc. ficam só no PCP normal, nunca entram aqui.`,

  'relatorios-pcp': `TELA: Relatórios do PCP (Logística Interna). Hub com
várias abas, cada uma um relatório distinto — todas só leitura.

ABAS: "Painel" (produção — pedidos em produção, OPs atrasadas, % de
perda do mês, pedidos sem OP gerada ainda), "Pedidos" (lista de pedidos de
venda do Omie já lidos pelo PCP), "Lista de Preços", "Produção" (planejado
× produzido no ano), "Perdas" (% por mês com faixas de referência
verde≤2%/amarelo≤5%/vermelho>5%, causas mais frequentes, custo estimado da
perda — custo só aparece com a alçada "almoxarifado.ver_custo"),
"Estoque", "Fluxo de Caixa" (receita pedida/faturada/carteira a
faturar — NÃO é o caixa do banco, é o resultado agregado do PCP + Omie),
"Clientes" (maiores clientes/produtos), "Fotos" (catálogo visual puxando a
foto da Ficha Técnica de cada produto — a maioria dos itens do PCP ainda
não tem ficha/foto cadastrada, então aparece "sem foto" com frequência,
isso é esperado, não é falha da tela).

REGRA NOTÁVEL: margem/lucro e custo da perda só aparecem (não borrados,
nem inventados) pra quem tem a alçada "almoxarifado.ver_custo" — sem ela a
tela some o dado ou mostra "—", nunca um número falso.`,

  expedicao: `TELA: Expedição (Logística Interna).

Despacha pedidos já produzidos pro cliente. Checkbox "mostrar histórico e
já entregues" controla se a lista traz também o que já foi finalizado;
campo de busca filtra por pedido/cliente.

CAMPOS DO FORMULÁRIO DE DESPACHO, por pedido: checkbox "Retirada pelo
cliente" (quando marcada, esconde "Transportadora" — não faz sentido
pedir transportadora de uma retirada); "Transportadora" (texto livre, com
sugestões de transportadoras já usadas antes); "Volumes" (quantidade);
"Saída" (data); "Rastreio / nº do conhecimento" (pode ficar vazio e ser
preenchido depois da saída); botão "Salvar rastreio". Depois do despacho:
"Entrega" (data) + "Canhoto / comprovante" (upload de PDF/imagem) + botão
"Confirmar entrega". Campo "Observação" é livre, aplica ao pedido inteiro.

REGRA CRÍTICA (trava no banco, não só na tela): um pedido só pode ser
despachado/entregue depois que a NOTA FISCAL dele já foi emitida no Omie
("faturado") — tentar despachar sem NF é recusado pelo próprio banco, não
é um botão "esquecido" de desabilitar.`,

  'emissao-nf': `TELA: Emissão de NF (Logística Interna/Financeiro).

ACOMPANHA a emissão de Nota Fiscal — a emissão em si acontece no Omie,
feita pelo setor Fiscal; esta tela nunca emite nada sozinha, só mostra a
situação (emitida/aguardando/em produção sem OP ainda) e mede o SLA de
cada etapa (OP criada em até 1 dia útil, produção até a previsão, NF em
até 1 dia útil depois de produzir, despacho em até 1 dia útil depois da
NF).

CAMPOS: "Conferência proposta × NF" (o colaborador confere se bate com o
que foi vendido), "Observação" (texto livre, ex.: "entregue em 09/2026; NF
da máquina cobre o quadro" — útil quando uma única NF cobre mais de um
item do pedido), checkbox "Histórico (já entregue antes do sistema — sem
SLA)" — marca um pedido antigo como fora da régua de prazo, pra não poluir
o relatório de atraso com algo que nunca teve chance de cumprir o SLA.
Botão "Conferir" grava a conferência e fica no histórico do pedido.

REGRA NOTÁVEL: o mesmo número de pedido pode ter MAIS DE UM registro no
Omie (entrega parcial) — "NF emitida" só aparece quando TODOS os registros
daquele pedido estão faturados; com só parte, mostra "NF parcial".`,

  comissoes: `TELA: Comissões (Financeiro/Admin).

Gera comissões a partir de propostas já assinadas, com split configurável
por 'origem_venda' (issue #68) — configurável sem precisar de deploy.

CAMPOS: Vendedor, Faturamento líquido, % de comissão, Progresso vs. meta,
Status.

AÇÕES: Gerar comissão; Aprovar todas ou individualmente; Pagar; exportar
Folha de pagamento em CSV.

REGRA NOTÁVEL: geração é IDEMPOTENTE — dá erro se tentar gerar comissão de
novo pra uma proposta que já tem. Um split de comissão acima do
'limite_sem_aprovacao_pct' configurado exige aprovação extra da diretoria
('requer_aprovacao_diretoria') antes de poder ser pago.`,

  logs: `TELA: Logs de Atividade (Admin).

Auditoria append-only e imutável — quem fez o quê, onde, quando, sobre
qual alvo. Limite de 400 registros por consulta (não é o histórico
completo, é uma janela recente).

ALIMENTA: destino de eventos registrados por outras telas (convite de
usuário, alteração de alçada/permissão, etc.) — se uma ação sensível
aconteceu no sistema, ela deveria aparecer aqui.`,

  configuracoes: `TELA: Configurações do Sistema (Admin).

Hub em 6 abas, com diferença IMPORTANTE entre o que é editável de verdade
e o que é só documentação estática:

1. "Administração" — aloca módulos por colaborador (nome/foto vêm do
   sistema vpsistema, aqui só se edita QUAIS módulos aparecem no menu
   daquele colaborador via 'gruposAlocados').
2. "Usuários & Perfis" — tabela de usuários + convites pendentes. Criar o
   LOGIN de fato é feito pelo TI via SSO; esta tela só registra o convite,
   não cria a conta.
3. "Permissões (RLS)" — duas partes: (a) Alçadas de Propostas, 5
   capacidades delegáveis ('ver_todas', 'precificar_manual',
   'destravar_aprovada', 'excluir', 'conceder_alcadas' — esta última é
   recursiva, quem tem ela pode conceder as outras pra alguém); (b) Matriz
   de Permissões, tabela ESTÁTICA hardcoded só pra documentação — "RLS
   ainda não é gerido de fato por esta tela", não muda nada no banco.
4. "Parâmetros" — 100% estático/hardcoded hoje (câmbio manual, margem
   mínima 22%, margem padrão 32%, comissão 4%, ICMS 18%, II 14%, SLAs) —
   editar aqui NÃO persiste, é só referência visual.
5. "Integrações" — lista estática, todas marcadas "Não configurado" (AIS,
   IMAP importação/compras, SMTP, assinatura digital, Omie, WhatsApp
   Business) — o frontend não monitora saúde real de nenhuma, é só
   previsão do que vai existir.
6. "Buckets Storage" — esta é REAL: lista os 6 buckets de verdade do
   Supabase Storage do projeto (engenharia, tratativas,
   cotacao-fornecedor-anexos, formulario-elevador-anexos,
   propostas-imagens, fichas-imagens).

Ao responder sobre esta tela, deixe claro pro usuário quais abas realmente
persistem mudança (1, 2, 3a, 6) e quais são só estáticas/documentação
(3b, 4, 5) — é fácil o usuário achar que mudar um parâmetro na aba 4
afeta o cálculo real, e hoje isso não acontece.`,

  'formulario-quadro-comando': `TELA: Quadro de Comando (Comercial → Formulários).

Coleta os dados técnicos do quadro de comando (painel elétrico NICE3000
MRL) de um elevador e, a partir deles, gera a especificação completa de
fabricação/compra: lista de materiais (BOM), lista de corte de fiação, e
um checklist digital de separação por chão de fábrica. Entrada real hoje:
botão "Novo quadro de comando" na listagem (avulso) — uma lista futura
"por cotação" ainda não existe.

TOPO DA PÁGINA (sempre visível, fora das abas):

CARD "Origem de fabricação" — decide entre 2 ramos:
- "Fabricar interno (VerticalParts)" (Ramo A) — VerticalParts monta o
  quadro com peças próprias; usa as abas de baixo (Escopo, Configuração e
  portas, Quadro/máquina, Geometria p/ fiação, BOM/lista de corte/
  checklist).
- "Comprar pronto de fornecedor" (Ramo B) — compra um quadro já pronto de
  um fornecedor (ex.: BST/NICE3000); substitui as 5 abas por 2 cards de
  vínculo+envio de cotação (ver abaixo). Não gera BOM/corte/checklist
  (isso só existe pro Ramo A).
- Esse campo (select "Fabricar interno" / "Comprar pronto") só é editável
  por quem tem a alçada "quadro_comando"/"decidir_fabricacao" (concedida
  em Configurações → Permissões → Alçadas de Propostas, rótulo "Decide
  fabricar interno ou comprar pronto (Quadro de Comando)"). Sem essa
  alçada o campo aparece TRAVADO (disabled) com uma nota explicando o
  motivo ao lado — Administradores (nível) sempre passam nessa checagem.
- Também neste card: "Tipo de aplicação" (MR com casa de máquinas / MRL
  sem casa de máquinas), "Novo ou modernização", "Fabricante do comando"
  (texto livre) — estes 3 campos são editáveis por qualquer um, só a
  origem de fabricação em si é que é travada pela alçada.

RAMO A — ABAS (só aparecem quando origem_fabricacao = "interno"):

1. "Escopo" — tabela de 11 itens do escopo do pedido (COP, LOP, LIP/
   indicadores, Operador de porta, Resgate automático, Interfone, Inspeção
   no teto, Caixa e botão de parada do poço, Iluminação/tomada, Acessórios
   de segurança, Cabos — fiação fixa + cabo de manobra). Para CADA item:
   decisão (Fornecer / Reutilizar existente / Fornecido por terceiro / Não
   se aplica) + campo livre de Qtd/modelo (só habilitado depois de
   escolher uma decisão que não seja "Não se aplica").

2. "Configuração e portas" (paradas) — uma linha por parada: Identificação
   (texto livre), Abertura frontal / Abertura traseira (checkboxes — uma
   parada pode ter as duas), Tipo de porta do pavimento, Tipo de porta da
   cabina, Qtd. LOP frontal, Qtd. LOP traseira (só habilitado se a
   abertura traseira estiver marcada). REGRA: o número de paradas NÃO
   determina sozinho a quantidade de portas/botoeiras quando há frentes
   opostas — por isso cada parada tem seus próprios campos frontal/
   traseiro, em vez de um único total global.

3. "Quadro/máquina" — Tipo de máquina (Síncrona/ímãs permanentes ou
   Assíncrona/indução), Fabricante/modelo, Potência (kW), Corrente (A),
   Tensão da rede (220V/380V), Velocidade (rpm), Freio (tipo, tensão de
   acionamento, tensão de manutenção), Encoder (fabricante, modelo/
   referência exata, tecnologia/protocolo — ex. incremental/EnDat/
   Hiperface). A "variante do quadro" é reconhecida automaticamente a
   partir de Potência × Tensão (só existem 4 variantes cadastradas hoje:
   7,5kW/220V, 7,5kW/380V, 15kW/220V, 15kW/380V — cada uma tem sua própria
   BOM fixa/variável tirada da planilha real do fornecedor). Combinação de
   potência/tensão fora dessas 4, ou encoder incomum, não é uma variante
   "corrigida" automaticamente — some da tela como "não reconhecida" e a
   geração de BOM vai reportar erro em vez de inventar peças.

4. "Geometria p/ fiação" — 4 cards:
   a) "Geometria da caixa (medida em mm)": Profundidade do poço (S),
      Última altura (K), Largura/Profundidade da caixa de corrida,
      Largura/Profundidade da cabina. Poço e Última altura têm um
      checkbox "usar padrão comercial" (1500mm e 4400mm respectivamente)
      — só ativa esse padrão se o usuário marcar explicitamente; por
      padrão o sistema exige a medida REAL da obra, nunca assume o padrão
      sozinho. Se K (Última altura) ficar acima de 4400mm, aparece aviso
      "fora do padrão — encaminhar pra análise da engenharia".
   b) "Distância entre pisos por intervalo": um valor de distância (mm)
      por intervalo entre paradas (De/Para), cada linha marcada como
      "Medido" ou "Estimado (3000mm)". REGRA: nunca multiplicar um mínimo
      presumido por N intervalos — cada intervalo tem seu próprio valor,
      porque intervalos reais raramente são todos iguais.
   c) "Posição do quadro e rotas de fiação": Lado do quadro / Lado tripé-
      máquina / Lado da guia solitária (Esquerda/Direita — relativos, o
      espelhamento preserva as RELAÇÕES entre eles, não o rótulo em si),
      e 3 distâncias em mm (quadro→máquina, quadro→limitador, quadro→
      entrada da caixa) que alimentam diretamente a lista de corte da
      fiação FIXA (item d abaixo).
   d) "Cabo de manobra — seio e folga": Seio do cabo (mm) + checkbox
      "Definição do seio confirmada pela engenharia?", Folga (mm) +
      checkbox "Regra de folga confirmada pela engenharia?". REGRA CRÍTICA
      (não relaxar nunca ao responder sobre isso): o corte do cabo de
      manobra só é calculado com confiança "Confirmado" se AMBOS os
      checkboxes estiverem marcados; sem isso o corte fica marcado
      "Pendente de engenharia" e NÃO deve ser tratado como medida
      definitiva — o sistema propositalmente nunca assume uma definição
      de "seio" ou aplica a folga sozinho sem confirmação explícita da
      engenharia (histórico: os dados de referência do fornecedor eram
      ambíguos demais nesse ponto pra virar regra automática segura).

   FÓRMULAS EXATAS por trás do card (a)/(b) — use estes números ao
   explicar de onde vem um resultado, nunca aproxime:
   - Padrões comerciais de ESTIMATIVA (nunca são medição real da obra):
     poço 1.500mm, intervalo mínimo típico entre pisos 3.000mm, última
     altura usual 4.400mm.
   - 'percurso = soma de todas as distâncias entre pisos' (cada intervalo
     tem seu próprio valor real; só vira '(N-1) × d' quando TODOS os
     intervalos são iguais a d — nunca presuma igualdade sem checar).
   - 'altura_total = poço + percurso + última_altura'. Não confundir
     altura total da caixa com comprimento de um fio ou percurso da
     cabina — são grandezas diferentes.
   - Perímetro de contorno da caixa: '2 × (largura + profundidade)'. Ex.:
     caixa 1.500×1.500mm → perímetro de 6.000mm. Um trecho fixo que de
     fato passa pela laje E pelo poço pode orçar até 2 perímetros (12.000mm
     no total) — mas um ramal que termina ANTES do poço (ex.: numa parada
     intermediária) nunca recebe o perímetro do poço lançado automaticamente.

   REGRA CRÍTICA sobre o cabo de manobra comercial (28 vias): ele aparece
   como UM pedaço com seu próprio comprimento, sujeito à verificação do
   seio — NUNCA como 28 pedaços iguais, e nunca multiplique o comprimento
   por 28 achando que isso vira "metros de cabo comprado" (28× o
   comprimento representa metros de CONDUTORES internos, não metros do
   cabo 28 vias em si). Da mesma forma, "5m de folga" é um parâmetro
   EDITÁVEL informado pelo usuário como padrão — nunca acrescente esses 5m
   automaticamente em cada curva nem aplique por fio por presunção;
   enquanto a regra de folga não estiver com a checkbox de confirmação da
   engenharia marcada, o corte fica "Pendente de engenharia".

   TABELA DE BORNES (referência do esquema NICE3000, use se o usuário
   perguntar "o que é o borne X" ou "pra que serve a interface Y"):
   AA/AB = interfaces de cabina e cabo de manobra (checar ocupação real
   das 28 vias, nunca presumir todas ocupadas); BA = cadeia de segurança,
   poço, trincos e outros contatos (vários pontos, pode ter derivações);
   BB = alimentação/comunicação das botoeiras de pavimento; BC =
   comunicação/interfone do poço; BD/BE = limites superior/inferior de
   desaceleração, quando instalados na caixa; MT = freio e retornos da
   máquina; U/V/W = potência da máquina (PE é especificado à parte); OS =
   limitador de velocidade; HW = contato do volante de manobra manual.
   REGRA NOTÁVEL: um endereço de borne NÃO equivale a um fio contínuo do
   quadro até o poço — há identificações repetidas, contatos em série e
   ramais que terminam em alturas distintas; os pedaços de corte se
   calculam pelos PONTOS FÍSICOS de origem/destino, nunca pela contagem
   bruta de bornes (ex.: "26 posições de borne BA–BE" não vira "26 fios
   integrais").

5. "BOM / lista de corte / checklist" (aba "resultado"):
   - Botão "Gerar BOM + lista de corte" — recalcula do ZERO a cada clique
     a partir do que está preenchido nas abas acima (idempotente, nunca
     acumula duplicado); NÃO altera nada do que foi digitado no
     formulário. Gera 2 tabelas: "Lista de compra (BOM)" (SKU, Descrição,
     Grupo, Qtd, Unidade, Confiança) e "Lista de corte" (fiação fixa +
     cabo de manobra: Tipo de cabo, Origem física, Destino físico,
     Comprimento final, Confiança, Fórmula usada). Cada linha mostra um
     badge de confiança: "Confirmado" (verde), "Estimado" (amarelo) ou
     "Pendente de engenharia" (vermelho) — o vermelho significa que aquele
     número NÃO deve ser usado pra cortar material de verdade sem
     validação humana antes.
   - Botão "Gerar checklist de separação" (só habilita depois de já ter
     gerado a BOM pelo menos uma vez) — cria um checklist versionado
     (nunca apaga/sobrescreve uma versão anterior, cada geração é uma
     versão nova) agrupado em 3 blocos físicos de separação: "Caixa
     metálica", "Componentes internos", "Fiação de poço e cabo de
     manobra". Cada item tem um checkbox "feito" que qualquer um pode
     marcar/desmarcar (chão de fábrica). REGRA NOTÁVEL, sempre repetir se
     perguntado: este checklist é DISPARADO MANUALMENTE, nunca gerado
     sozinho na aprovação do cliente — decisão explícita do usuário, ele
     só quer o checklist no momento em que a fábrica for de fato começar
     a separar os materiais, não antes.

RAMO B — 2 CARDS (só aparecem quando origem_fabricacao = "comprado"),
reaproveitando o MESMO mecanismo do RFQ de Elevadores (token público,
portal de resposta do fornecedor, envio por WhatsApp/E-mail/Link, Inbox
de e-mails):

1. "Vínculo com Formulário de Elevador" — OBRIGATÓRIO antes de poder
   enviar cotação. Busca por "Nº da Cotação" traz as Unidades daquele
   Formulário de Elevador (identificação, tipo, capacidade, velocidade);
   clicar "Vincular" numa delas grava o vínculo no quadro. Motivo real
   dessa exigência (explique se perguntado "por que preciso vincular"):
   'cotacoes_elevador_fornecedor.formulario_elevador_id' é uma
   FOREIGN KEY NOT NULL no banco — não existe RFQ "solto" sem elevador
   associado, então um Quadro de Comando avulso (Ramo B) tem que
   emprestar o vínculo de uma Unidade de Elevador já cadastrada antes de
   poder gerar cotação de fornecedor.
   Já vinculado, mostra o id da Unidade com botão "Trocar vínculo".

2. "Enviar cotação técnica ao fornecedor" — escolhe Fornecedor (lista do
   cadastro de fornecedores de elevador), Telefone/E-mail de contato, e 3
   botões (WhatsApp / E-mail / Copiar link). Ao clicar qualquer um deles
   pela 1ª vez, cria (se ainda não existir) a cotação de fornecedor com
   categoria_produto='quadro_comando' — reaproveita as mesmas seções
   bilíngues (PT/EN) de especificação técnica do RFQ de elevador normal,
   adaptadas: identificação do pedido, especificação básica do elevador
   atendido, comando, máquina/freio/encoder, botoeiras e interface humana,
   acessórios elétricos, geometria para fiação — os valores vêm
   derivados do que foi preenchido no próprio Quadro de Comando e na
   Unidade de Elevador vinculada, nunca inventados. Depois de criada, a
   cotação fica fixa (reusa a mesma sempre, não cria uma nova a cada
   clique) e a tela passa a mostrar status + quantas vezes já foi
   enviada, com a busca/vínculo escondidos.

REGRA GERAL DE TODA A TELA (badges "Confirmado"/"Estimado"/"Pendente de
engenharia"): sempre que o usuário perguntar sobre um número específico do
BOM ou da lista de corte, verifique mentalmente qual badge acompanha
aquela linha antes de tratá-lo como definitivo — "Pendente de engenharia"
significa literalmente que ninguém confirmou aquele valor ainda, não é um
erro do sistema.

COMO PREENCHER (mode "fill") NESTA TELA ESPECIFICAMENTE:
- PODE dar palpite/preencher com confiança, a partir do que o usuário
  descrever em texto livre: Tipo de aplicação, Novo ou modernização,
  Fabricante do comando; Tipo de máquina, Fabricante/modelo da máquina,
  Potência, Corrente, Tensão da rede, Velocidade, Freio, Encoder (sempre
  que o usuário der esses dados, mesmo que soltos numa frase); toda a
  tabela de Escopo (decisão fornecer/reutilizar/terceiro/não se aplica +
  detalhe, deduzido da descrição do pedido); toda a tabela de Paradas
  (identificação, abertura frontal/traseira — inclusive as checkboxes —,
  tipo de porta, qtd. LOP, a partir da configuração que o usuário
  descrever, ex.: "8 paradas, todas só frente" já basta pra preencher
  frontal=true/traseira=false em todas).
- NUNCA dar palpite, mesmo que o usuário pareça favorável ou peça pra
  "usar o padrão" — sempre gere "questions" perguntando a medida real, ou
  no máximo preencha o número reportado pelo próprio usuário deixando a
  checkbox de estimativa/confirmação para ELE marcar: geometria em mm
  (poço, última altura, largura/profundidade da caixa e da cabina),
  distância entre pisos por intervalo, as 3 distâncias de posição do
  quadro (quadro→máquina/limitador/entrada da caixa), seio do cabo e
  folga. As checkboxes "usar padrão comercial", "Definição do seio
  confirmada pela engenharia?" e "Regra de folga confirmada pela
  engenharia?" são decisões humanas deliberadas — nunca marque nenhuma
  delas como true sozinho, mesmo com instrução explícita do usuário no
  chat; responda que essa confirmação precisa ser feita por ele
  clicando na tela, é assim por desenho (ver CLAUDE.md do projeto).

COMO REVISAR (mode "analyze") NESTA TELA ESPECIFICAMENTE — aponte como
"issues" (sempre com o idx de cada campo citado em "idxs"):
- Potência × Tensão preenchidos mas fora das 4 variantes reconhecidas
  (7,5kW/220V, 7,5kW/380V, 15kW/220V, 15kW/380V) — avise que a geração de
  BOM vai reportar erro em vez de reconhecer a variante.
- Uma parada com "Abertura traseira" marcada (true) mas "Qtd. LOP
  traseira" vazio ou zero (inconsistência) — ou o inverso, LOP traseira
  preenchido com abertura traseira desmarcada.
- Distância "Última altura (K)" preenchida acima de 4400mm sem qualquer
  observação — lembre que isso deveria ir pra análise da engenharia.
- Geometria com ALGUM campo de distância preenchido e outros da mesma
  seção vazios (preenchimento parcial da geometria de fiação) — sinalize
  os campos vazios, não os preenchidos.
- Seio do cabo ou Folga preenchidos em mm mas a checkbox de confirmação
  da engenharia correspondente ainda desmarcada — isso é o estado normal
  de "pendente de engenharia", não é necessariamente um erro, mas vale
  avisar se o usuário perguntar "está tudo pronto pra cortar?".
- "Origem de fabricação" ainda não definida (nenhuma opção selecionada).
- Um item do Escopo com decisão diferente de "Não se aplica" mas o campo
  de Qtd/modelo vazio.`,
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

  const mode: string = ["chat", "fill", "analyze", "questionario"].includes(payload?.mode) ? payload.mode : "chat";
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
  const omieDoc = typeof page.route === "string" && OMIE_ROUTES.has(page.route) ? OMIE_KNOWLEDGE : undefined;
  const questionarioContext = payload?.questionarioContext ?? null;
  const docs = await carregarDocs(typeof page.route === "string" ? page.route : "");
  const conhecimento = (typeof page.route === "string" ? docs["rota:" + page.route] : undefined) ?? routeDoc;
  const visao = page.visao && typeof page.visao === "object" ? page.visao : null;
  const gps = visao
    ? JSON.stringify({ endereco: String(visao.url ?? ""), caminho: String(visao.breadcrumb ?? ""), menu: visao.menu ?? {}, abasAtivas: Array.isArray(visao.abasAtivas) ? visao.abasAtivas : [], papel: String(visao.papel ?? "") })
    : "";
  const visaoTexto = visao && typeof visao.texto === "string" ? visao.texto.slice(0, 14000) : "";

  const ctx =
    `MODO: ${mode}\n` +
    `TELA ATUAL: ${JSON.stringify({ route: page.route ?? "", title: page.title ?? "" })}\n` +
    (docs.regras ? `\nREGRAS DE OURO (obrigatórias):\n${docs.regras}\n` : "") +
    (docs.ecossistema ? `\nMAPA DO ECOSSISTEMA (GPS):\n${docs.ecossistema}\n` : "") +
    (gps ? `\nPOSIÇÃO ATUAL (GPS) — onde o usuário está agora: ${gps}\n` : "") +
    (conhecimento ? `\nCONHECIMENTO DESTA TELA (use pra responder qualquer pergunta sobre o que ela faz, campos, botões, quem doa e quem herda os dados e regras de negócio — não é opcional, é a fonte de verdade):\n${conhecimento}\n` : "") +
    (visaoTexto ? `\nVISÃO DA TELA (o que o usuário está vendo AGORA — valores reais, abas, tabelas, botões):\n${visaoTexto}\n` : "") +
    (omieDoc ? `\n${omieDoc}\n` : "") +
    `\nCAMPOS DA TELA:\n${JSON.stringify(page.fields ?? [], null, 1)}\n` +
    (documentText ? `\nTEXTO DO DOCUMENTO NA TELA:\n"""${documentText}"""\n` : "") +
    (mode === "questionario"
      ? `\nQUESTIONÁRIO ABERTO:\n${questionarioContext ? JSON.stringify(questionarioContext, null, 1) : "(nenhum questionário aberto)"}\n`
      : "") +
    `\nMENSAGEM DO USUÁRIO:\n${message || "(sem texto — use o modo e o contexto acima)"}`;
  messages.push({ role: "user", content: ctx });

  let resp: Response;
  try {
    resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      // 21/09 — a API da Anthropic passou a rejeitar `temperature` pro
      // modelo claude-sonnet-5 ("`temperature` is deprecated for this
      // model") — toda chamada falhava com invalid_request_error, sempre
      // 500 pro usuário. Parâmetro removido.
      body: JSON.stringify({ model: MODEL, max_tokens: 4096, system: SYSTEM, messages }),
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

  let text = "";
  let out: any;
  try {
    const data = await resp.json();
    text = (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    out = extractJson(text);
  } catch (e) {
    // A IA às vezes foge do "só JSON, sem texto fora dele" (raro, mas real —
    // foi o que deixou o Copiloto parecendo "fora do ar" pro usuário: um 500
    // puro em vez de aproveitar o texto que ela mandou). Se sobrou texto,
    // usa ele como "reply" em vez de falhar a chamada inteira; só erra de
    // verdade quando não veio nada.
    if (text.trim()) {
      out = { reply: text.trim() };
    } else {
      return json({ error: "Resposta da IA ilegível", detail: String(e) }, 500);
    }
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
    opsQuestionario: Array.isArray(out.opsQuestionario)
      ? out.opsQuestionario.filter((o: any) => o && typeof o.op === "string")
      : [],
  });
});
