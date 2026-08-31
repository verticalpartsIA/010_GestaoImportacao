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

  compras: `TELA: Fretes Nacionais (módulo Compras).

Reaproveita a MESMA tabela 'embarques' da Importação legada, só
remapeando os status pro vocabulário de frete nacional (não é uma tabela
separada).

ACHADO REAL: os campos "Valor" e "Motorista" mostrados na tela não existem
de fato na tabela — aparecem sempre em branco/"—", não é bug, é campo que
nunca foi implementado. "Ocorrências" mostra '1' só quando o status é
"Atraso" — não é um registro de ocorrência de verdade, é um contador
derivado do status. O botão "Novo frete" redireciona pra tela 'importacao'
em vez de criar o frete direto aqui.`,

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
checa se o projeto já cumpriu os pré-requisitos técnicos pra seguir pro
fluxo de importação.

REGRA NOTÁVEL: as abas Vistoria/Documentos/NCM dentro desta tela são
placeholders que só REDIRECIONAM pras telas reais correspondentes (evita
duplicar o mesmo registro em dois lugares — "agora fica num lugar só").`,

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

  almoxarifado: `TELA: Almoxarifado.

Pedidos de compra de VAREJO (insumos/reposição) — distinto de compra de
equipamento pra revenda.

REGRA NOTÁVEL: a aprovação não acontece dentro desta tela — é feita pelo
Chefe de Logística de dentro da Central de Decisões
('criarDecisaoCompraVarejo'). A frase que resume a regra no código é "o
pedido É o gatilho": criar o pedido aqui já gera automaticamente a decisão
pendente lá.`,

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
