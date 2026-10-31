-- Conhecimento do Copiloto VP em tabela (10/10/2026).
-- A Edge Function vp-copiloto lê estes documentos em tempo de execução (chave de serviço; RLS ligada SEM políticas,
-- então o navegador não lê). Ajustar o que o Copiloto sabe = UPDATE aqui, sem redeploy da função.
create table if not exists public.vp_copiloto_docs (
  id text primary key,                 -- 'regras', 'ecossistema', 'rota:<id da rota>'
  tipo text not null check (tipo in ('regras', 'ecossistema', 'rota')),
  titulo text not null,
  conteudo text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.vp_copiloto_docs enable row level security;

insert into public.vp_copiloto_docs (id, tipo, titulo, conteudo) values
('regras', 'regras', 'Regras de ouro do Copiloto', $doc$
REGRAS DE RESPOSTA (valem em TODA tela):

1) NOMES DOS CAMPOS — cite SEMPRE pelo RÓTULO EXATO que aparece na tela, entre aspas, do jeito que está escrito
   (ex.: "VMLE (USD)", "Comissão consultoria (%) — 0 a 5%", "VLR Sugerido CEO (líquido)"). NUNCA use nome técnico de código
   (variáveis, colunas, funções — como mark_up_pct, tx_cambial, vmle_usd, resultado_v2, mo_lookup). Se o usuário falar um nome técnico,
   traduza para o rótulo da tela e responda com o rótulo. O usuário só enxerga o que está escrito na tela.
2) SEGURANÇA NA RESPOSTA — responda sem hesitar quando o conhecimento da tela ou o "VISÃO DA TELA" trazer a informação. Cite números reais
   que estão na tela (valores, códigos de equipamento, status). Se algo NÃO consta no conhecimento nem na tela, diga claramente
   "isso não consta na tela/no sistema" — nunca invente fórmula, regra, número ou rota.
3) GPS — quando perguntarem "onde estou", "de onde vem", "para onde vai", "quem usa isso", responda em 4 partes curtas:
   (a) ONDE VOCÊ ESTÁ: nome da tela, caminho no menu (módulo › item), endereço (URL) e a etapa do fluxo de venda em que ela fica;
   (b) QUEM ALIMENTA (doadores) esta tela/campo; (c) QUEM HERDA (consumidores) o que sai dela; (d) o que vem antes e o que vem depois no fluxo.
   Use o MAPA DO ECOSSISTEMA e o conhecimento da tela. Diga também o que pode ser feito a seguir (botão/rota).
4) VISÃO DA TELA — "VISÃO DA TELA" é uma fotografia do que o usuário está vendo agora (abas ativas, títulos, tabelas, valores, botões, avisos,
   campos somente leitura). Use-a para responder sobre valores concretos ("quanto está o frete interno?", "qual o líquido do equipamento 1?").
   Prefira o valor da tela ao valor de exemplo do conhecimento. Se a tela mostra um aviso vermelho/amarelo, explique a causa.
5) PERGUNTAS DE DIRETORIA (CEO/Financeiro) — responda com a regra, a fórmula em linguagem simples e um exemplo com os números da tela, em poucas linhas.
   Se houver mais de um jeito de ver a mesma coisa, diga qual é o oficial.
6) Nunca altere nada sozinho: ações em campos só via "fills" que o usuário confirma. Checkbox/campo de decisão humana nunca marque sozinho.
$doc$),

('ecossistema', 'ecossistema', 'Mapa do ecossistema VP Gestão (GPS)', $doc$
MAPA DO ECOSSISTEMA — fluxo de venda de equipamentos (elevadores) e onde cada tela fica. Menu lateral › item (endereço):

ANTES DA PRECIFICAÇÃO
 1. CRM › Leads (/crm/leads) — nasce o lead.
 2. Comercial | Pré-venda › Formulário de Elevadores (/comercial/formulario-elevador[/<id>]) — o vendedor descreve cliente, obra e cada equipamento
    (tração, capacidade, paradas, quantidade, etc.). Obrigatórios para ENVIAR: Local da obra (cidade/UF), Instalação será, Responsável pela entrega,
    Finalidade da compra e Contribuinte de ICMS (definem o DIFAL), campos com * do equipamento. Gera o Nº da cotação (ex.: 963).
 3. Comercial | Pré-venda › Controle de Cotações (/comercial/controle-cotacoes) — acompanha cada cotação.
 4. Cotação a Fornecedor (RFQ — /adm-financeiro/cotacoes-fornecedor e detalhe /comercial/cotacao-fornecedor-detail/<id>; abas Detalhes e Tratativas) —
    o fornecedor (ex.: Glarie) responde o preço em US$ por equipamento, os containers (ex.: "11x40HC"), prazos, validade.

ESTA ETAPA
 5. Financeiro & Preços › Precificação (/comercial/precificacao e detalhe /comercial/precificacao/<id>) — o Financeiro forma o preço de venda.
    Recebe: Formulário (equipamentos, cidade/UF da obra, finalidade, contribuinte), resposta do fornecedor (US$, containers), Atualização de Custos
    (mão de obra, containers, frete, DIFAL), parâmetros fiscais e o câmbio (PTAX). Entrega: preço, rateio por equipamento, códigos dos equipamentos.

DEPOIS DA PRECIFICAÇÃO
 6. Aprovar precificação → nasce a Proposta (Comercial | Pré-venda › Propostas /comercial/propostas; editor /comercial/proposta-editor/<id>).
 7. Geral › Central de Decisões (/geral/decisoes) — envio da proposta: Gestor Comercial sempre; CEO só se a margem efetiva < margem mínima (15%) ou desconhecida.
 8. Cliente assina a proposta no link público (/assinar/<token>) → abrem os 3 avais da compra e o dossiê da obra.
 9. Contratos & Jurídico › Contrato de Venda de Equipamentos (/juridico/contrato-venda-equipamentos) e Contrato Instalador (/juridico/contrato-instalador).
10. Avais da compra: Aval de Pagamento (Financeiro & Preços › Aval Financeiro /adm-financeiro/aval-financeiro), Aval Jurídico (/juridico/aval-juridico) e
    Aval Engenharia = cliente assinou o Projeto de Instalação (Engenharia › Projeto de Elevadores /engenharia/eng-projeto-elevadores). Com os 3 (e o CEO, se a
    margem < 15%) o botão "Decidir comprar" libera na cotação a fornecedor.
11. Compra e importação: Gestão de Importação › P.I. (/gestao-importacao/pi-importacao) → Embarques (/gestao-importacao/embarques-importacao) → Importação → recebimento.
12. Instalação: Contrato Instalador, Projeto de Instalação e ID-TAG, Dossiê da Obra (/engenharia/dossier-obra/<id>).
Acompanhamento transversal: Geral › Prazos & Pendências (/adm-financeiro/financeiro), Dashboard (/geral/dashboard), Notificações, Inbox (/geral/inbox — e-mails
e Tratativas com fornecedor).

CADASTROS QUE ALIMENTAM O PREÇO (Financeiro & Preços › Atualização de Custos — /cadastros/cadastro-custos/<aba>; abas: Instalação — Elevadores,
Instalação — Escada/Esteira, Containers, Frete interno, DIFAL). Quem mantém atualiza pelo menos 1 vez por semana ou quando houver mudança.

REGRA DE NUMERAÇÃO DOS EQUIPAMENTOS: código = VPEL-EL<Nº da cotação>-<n>. Com 1 equipamento é sempre "-1". A partir de 2, cada equipamento físico recebe código próprio,
corrido de 1 a N, ordenado da MENOR para a MAIOR quantidade de paradas (empate: menor capacidade em kg; depois a ordem original). NÃO existe "-1-2" nem "-1-1".
A única letra permitida num código é a de REVISÃO (ex.: "-A"), quando a cotação é reenviada ao fornecedor por mudança de especificação.
$doc$),

('rota:precificacao', 'rota', 'Precificação (detalhe da cotação) — conhecimento completo', $doc$
TELA: Precificação — Equipamentos (Financeiro & Preços › Precificação). LISTA em /comercial/precificacao (abas "Elevadores" e "Outros projetos"; colunas Cotação Nº, Cliente,
Fornecedor, Respondido em, Decisão de compra, Precificação, botão "Abrir"). DETALHE em /comercial/precificacao/<id>: título "VPPC-<Nº>" (ex.: VPPC-0963), linha "Cotação Nº <Nº>".
Botões do topo: "Voltar", "Salvar rascunho" (grava sem calcular), "Calcular" (roda o motor e grava), "Aprovar precificação" (trava e gera a Proposta; só aparece depois de calcular).
Selo "✓ Aprovada em dd/mm/aaaa". Texto "Calculado — aprove antes de gerar a proposta".
Células obrigatórias (rótulo com *): "VMLE (USD) *", "CÂMBIO (R$/US$) *", "MARKUP SOBRE O CUSTO (%) *" (ou "MARK-UP (% do preço de venda)" no método da planilha),
"COMISSÃO CONSULTORIA (%) — 0 A 5% *", "COMISSÃO VENDEDOR (%) *". Se o Financeiro clicar em "Calcular" sem preencher, essas células PISCAM EM VERMELHO com "Campo obrigatório".

=== DE CIMA PARA BAIXO — CADA BLOCO, CAMPO, DOADOR E HERDEIRO ===

[1] CARD "Unidades desta cotação" (sub: "herdado do Formulário de Elevadores + resposta do fornecedor")
 Colunas: "UNIDADE" (código da Unidade do Formulário, ex. VPEL-EL0963-1; embaixo, em cinza, "equipamentos VPEL-EL0963-9 a -14 (6)" = a faixa de códigos corridos dos
 equipamentos físicos que essa unidade gerou); "Modelo (fornecedor)" (editável; vem da resposta do fornecedor); "Quantidade" (editável; vem do Formulário/fornecedor — uma unidade
 com quantidade 6 vira 6 equipamentos separados); "(USD) PTAX No dia da Cotação" (câmbio congelado no dia em que o fornecedor respondeu); "(USD) PTAX Agora" (dólar ao vivo, só referência);
 "Custo Fornecedor (USD)" (preço unitário em US$ informado pelo fornecedor; editável); "R$ no dia da cotação" e "R$ agora (ao vivo)" (= custo × PTAX, só referência: o cálculo oficial usa o campo "CÂMBIO (R$/US$)").
 Botão "Ressincronizar do fornecedor": busca de novo a resposta do fornecedor; mostra o que vai mudar e pede confirmação (sobrescreve correções manuais).
 DOADORES: Formulário de Elevadores (unidades, quantidade) + Cotação a Fornecedor (modelo e US$). HERDEIROS: tudo abaixo (VMLE, rateio do preço por modelo, P.I., Proposta).

[2] CARD "Mão de obra — busca automática" (sub: "tração × capacidade × paradas em Cadastros → Atualização de Custos")
 Colunas: "Unidade" (CÓDIGO DO EQUIPAMENTO físico — corrido 1..N, menor→maior paradas), "Tração", "Capacidade", "Paradas" (herdados do Formulário), "Situação", "Regra usada",
 "Valor (R$)". Situações: "Confirmado" (verde: achou linha real da tabela), "Estimativa — não confirmada" (amarelo: valor por regressão estatística, exige aprovação técnica/financeira),
 "Projeto especial" (vermelho: combinação fora da tabela — o valor não entra sozinho), "Pendente" (falta tração/capacidade/paradas no Formulário), "Fora do escopo VP" (instalação por terceiro).
 Botões: "Acrescentar equipamento", "Recalcular" (refaz a busca com o dado atual do Formulário), "Trocar" (edita tração/capacidade/paradas e GRAVA no Formulário), "Remover" (exclui SÓ a mão de obra daquele
 equipamento — ele continua na cotação), "Devolver ao cálculo".
 DOADOR: Cadastros › Atualização de Custos › aba "Instalação — Elevadores" (valor reajustado por tração × faixa de capacidade × paradas) + Formulário. HERDEIROS: "MÃO DE OBRA" de "Despesas Operacionais"
 (soma desta tabela), Contrato Instalador e Dashboard financeiro (custo de instalação por equipamento), Líquido por equipamento (cada equipamento paga a sua mão de obra).

[3] CARD "Despesas de importação"
 "VMLE (USD) *" — valor das mercadorias no local de embarque; soma dos custos do fornecedor × quantidade (editável). "SEGURO (USD)". "SISCOMEX (R$)" (taxa por DI; nas planilhas R$ 214,50).
 "CÂMBIO (R$/US$) *" — multiplicador de TODO o custo importado (faixa aceita 1 a 20); botão "Usar" copia o dólar ao vivo ("Dólar agora: R$ x"). "OUTRAS DESPESAS (R$)".
 "DESPACHANTE + DESEMBARAÇO (R$)" (planilha: R$ 450,45 + R$ 450,45 por DI). "DEMURRAGE (R$)".
 "CONTAINERS" — linhas "TIPO" (tamanho: 20'DV, 40'HC…), "QTD", "PREÇO DO CONTAINER (R$)", "CAPATAZIA (R$)", "GRI (R$)"; botão "+ Adicionar container"; "Subtotal Containers: … · Capatazia: … · GRI: …".
 Tipo e quantidade vêm da resposta do fornecedor (ex.: "11x40HC"); preço, capatazia e GRI são herdados de Atualização de Custos › aba "Containers" SÓ quando a linha está vazia (nunca sobrescreve o que foi digitado);
 aviso "⚠ Difere do cadastro de Containers" se o valor digitado for diferente do cadastro. GRI = General Rate Increase (sobretaxa do frete marítimo).
 TRATAMENTO: nos modos "Markup sobre o custo" e "Margem desejada sobre a venda" container+capatazia+GRI são DESPESA OPERACIONAL (fora da base de II/PIS/COFINS/ICMS; entram só no AFRMM de 8%). No "Método da planilha (Financeiro)" eles são
 convertidos para US$ e entram no valor CIF (pagam II, PIS, COFINS, ICMS e AFRMM), como na planilha do Financeiro.
 HERDEIROS: Gestão de Importação › Embarques (botão "Usar containers da cotação" usa tipo × quantidade) e o cálculo de impostos.

[4] CARD "Despesas Operacionais" — "INSTALAÇÃO E MONTAGEM" (lista fixa de 7, nesta ordem): "MÃO DE OBRA" (SOMENTE LEITURA = soma da tabela do bloco [2]), "CUSTOS ENGENHARIA", "ART", "ANDAIME", "TALHA",
 "EMPILHADEIRA", "AJUDANTES" (digitados pelo Financeiro/Engenharia/Logística, valor total da cotação).

[5] CARD "Despesas Extras" — "FRETE INTERNO (R$)" (Santos → obra), "ARMAZENAGEM (R$)" (planilha: nº de containers × R$ 1.988,85), "% DE SERVIÇOS", "CONTINGÊNCIA (R$)", "OUTROS CUSTOS NÃO RECUPERÁVEIS (R$)",
 "ITENS AVULSOS" (+ "+ Adicionar item").
 Faixa amarela "Sugestão automática do frete interno": calcula a partir de Atualização de Custos › aba "Frete interno" × cidade da obra (do Formulário: Local da obra) × quantidade de containers. Padrão = caminhão "LS (container fechado)" da
 transportadora mais barata; o usuário troca transportadora/modalidade na lista; o valor é POR CONTAINER (total = valor × nº de containers). Se a cidade não for capital, usa a capital do estado e avisa (a tabela vale até 20 km da capital).
 "FRETE INTERNO (R$)" só é preenchido sozinho se estiver vazio; botão "Usar sugestão" aplica; o que foi digitado nunca é sobrescrito. "Valor atual no campo: … — a sugestão difere em …" mostra a diferença.
 "CONTINGÊNCIA (R$)" e "OUTROS CUSTOS NÃO RECUPERÁVEIS (R$)" não existem na planilha original: abatem do lucro (modo planilha) ou entram na base do preço (modos V2).
 Todos esses valores somam em "despesas" (abatem do lucro no método da planilha).

[6] CARD "Resumo de Custos" (só leitura): "Custos Equipamentos" (VMLE × câmbio), "Custos com Frete", "Mão de Obra", "Custos Operacionais (Empilhadeira, Munck...)", "Frete Interno (no Brasil)",
 "Despesas de Importação (Siscomex, Despachante, Demurrage, Outras)", "Armazenagem", "Containers", "Capatazia", "GRI", "Despesas Extras (itens avulsos)", "Contingência e Outros custos não recuperáveis", "Custos Imposto"
 (só depois de "Calcular"), "Soma".

[7] CARD "Alavancas do Financeiro":
 "MARKUP SOBRE O CUSTO (%) *" (nos modos V2: % em cima do custo econômico completo) — no "Método da planilha" o rótulo vira "MARK-UP (% do preço de venda)" e é MARGEM SOBRE O PREÇO (ex.: 53% na cotação 963; não é o mesmo número do markup sobre o custo);
 "MARKUP SOBRE O CUSTO — 90 DIAS (%)" (só com 1 equipamento); "COMISSÃO CONSULTORIA (%) — 0 A 5% *" (OBRIGATÓRIA; nasce em branco; o Financeiro digita de 0 a 5; 0 vale; acima de 5 ou vazio bloqueia e pisca vermelho);
 "COMISSÃO VENDEDOR (%) *" (vem do parâmetro padrão; precisa ser > 0); "COMISSÃO INDICAÇÃO (%)"; "MARGEM MÍNIMA (%)" (padrão 15%; abaixo disso a margem fica laranja e a proposta exige aprovação do CEO).
 Botão "Ver/editar parâmetros fiscais (regime, impostos)": "Regime tributário" (Presumido), "ICMS importação (%)" (12%), "IPI importação (%)", "II importação (%)" (20%), "PIS importação (%)" (2,10%), "COFINS importação (%)" (10,25%),
 "ICMS venda (%)" (4%), "IPI venda", "PIS venda (%)" (0,65%), "COFINS venda (%)" (3%), "IRPJ venda (%)" (1,32%), "CSLL venda (%)" (1,188%), "Impostos a pagar — serviços (%)" (16%). Vêm do parâmetro fiscal padrão (snapshot gravado na precificação).

[8] CARD "DIFAL" (aparece se a obra é fora de SP): texto "DIFAL de R$ x é responsabilidade da VerticalParts (cliente não contribuinte)…" ou "responsabilidade do próprio cliente (Contribuinte de ICMS)". Regras: origem SP; destino = UF da obra (Local da obra) senão UF do cliente;
 mesma UF → sem DIFAL; Finalidade "Revenda" → sem DIFAL; Finalidade "Uso e Consumo / Ativo Imobilizado" → DIFAL devido: Base Única = valor da operação × (alíquota interna do estado − interestadual de 4% para importado); outras categorias (Base Dupla…)
 seguem a aba DIFAL. Quem recolhe: cliente Contribuinte de ICMS → o cliente; Não contribuinte → VerticalParts via guia GNRE (bloqueia faturamento até pagar) e o valor ABATE DO LUCRO.
 O "valor da operação" é o preço de venda do modo escolhido (corrigido em 10/10/2026: antes usava o preço do motor antigo e podia dar R$ 0,00). Só recalcula quando o Financeiro clica em "Calcular".
 DOADORES: Formulário ("Finalidade da compra *", "Contribuinte de ICMS? *" — obrigatórios para enviar a cotação —, Local da obra) e Atualização de Custos › aba "DIFAL" (categoria e alíquotas por estado).

[9] CARD "Formação do Preço" — "MODO DE FORMAÇÃO DO PREÇO":
 • "Markup sobre o custo": preço = custo econômico completo × (1 + markup) ÷ (1 − impostos − comissões).
 • "Margem desejada sobre a venda" (aparece "Margem desejada sobre a venda (%)"): preço = custo econômico completo ÷ (1 − margem − impostos − comissões).
 • "Método da planilha (Financeiro)": preço = custo da nota (já sem créditos) ÷ (1 − impostos da venda − MARK-UP). Despesas só abatem do lucro. Reproduz a planilha "JA - Cotação" ao centavo.
 "Custo econômico completo" = custo líquido de importação + despesas operacionais + contingência + outros custos não recuperáveis.

[10] CARD "Preço de venda" (com 1 equipamento aparecem 2 cards: "Preço de venda — 120 dias (Compartilhado)" e "Preço de venda — 90 dias (Exclusivo)"; com 2 ou mais, só um card)
 "CUSTO ECONÔMICO COMPLETO"; tabela "PREÇO DE VENDA POR EQUIPAMENTO" com 6 colunas (27 equipamentos na cotação 963 = 10 linhas do fornecedor explodidas):
   "Equipamento" (código corrido VPEL-EL<Nº>-<n>) · "VLR Proposta" (preço de venda do equipamento SEM desconto: o preço total é rateado entre os modelos pelo custo em US$ de cada um) ·
   "Líquido por Equip." (LUCRO LÍQUIDO real do equipamento = (lucro total + soma da mão de obra) × (VLR Proposta do equipamento ÷ preço total) − mão de obra do equipamento; ou seja, mercadoria, despesas gerais, impostos, comissões e DIFAL são rateados pela
   participação no preço e a MÃO DE OBRA é a específica de cada equipamento; a soma de todos fecha SEMPRE no "LUCRO FINAL") ·
   "VLR Sugerido CEO (líquido)" (campo laranja; o líquido por equipamento que o CEO quer receber; nasce VAZIO em toda precificação; botão "Preencher todos" aplica o mesmo valor a todos; "Limpar") ·
   "Desconto no preço" (nasce depois do CEO: quanto o preço cai) · "Preço p/ Venda" (nasce depois do CEO: VLR Proposta − desconto).
 Regra do CEO: desconto = (líquido calculado − líquido do CEO) ÷ (1 − % impostos da venda − % comissões). Dividir é necessário porque impostos e comissões incidem sobre o preço: para o líquido cair exatamente R$ 6.483,84 o preço cai R$ 7.449,09 (exemplo do
 equipamento 1 da cotação 963: líquido R$ 108.796 vs CEO R$ 100.000 → o número exato aparece na tela). Linha do CEO em branco = permanece o calculado. Rodapé: novo preço total, lucro total resultante, e botão "Levar ao cálculo", que ajusta
 "MARKUP SOBRE O CUSTO (%)"/"MARK-UP (% do preço de venda)"/"Margem desejada sobre a venda (%)" para o preço total fechar nesse valor — depois é preciso clicar em "Calcular". A coluna "Preço p/ Venda" AINDA NÃO alimenta a Proposta sozinha.
 Abaixo: "TOTAL DA COTAÇÃO — SOMA DOS EQUIPAMENTOS ACIMA", "MARGEM EFETIVA" (compara com "mínima 15,00%"), "LUCRO FINAL". Avisos: "divisor inválido", "margem efetiva negativa", "margem abaixo da mínima".
 O lucro final = preço − custo econômico − impostos da venda − comissões − DIFAL (modos V2); no método da planilha = preço − custo da nota + créditos − impostos − comissões − despesas − DIFAL.

[11] CARD "Memória de cálculo — método da planilha" (abas: "Resumo", "1 · Importação (CIF)", "2 · Impostos da importação", "3 · Instalação e despesas", "4 · Impostos e créditos da venda", "5 · Preço, comissões e lucro",
 "6 · Equipamentos", "7 · Containers e frete"). Recalcula AO VIVO o método da planilha com os campos da tela e compara com o preço oficial salvo. Tem campo próprio "MARK-UP desta memória (% do preço de venda)": automático = o
 mark-up da planilha que reproduz o preço oficial salvo (ex.: 52,52% na cotação 963); o usuário pode digitar outro (ex.: 53%). Só leitura.
 Link "Ver comparação técnica (motor antigo)" = V1 legado, só auditoria.

=== QUEM HERDA OS DADOS DESTA TELA (consumidores) ===
 • Proposta (gerada ao aprovar; /comercial/proposta-editor/<id>): preço de venda e valor de cada equipamento (rateio), códigos dos equipamentos e custo de mão de obra de cada um ("ativos"), opção 120 × 90 dias (1 equipamento), forma de pagamento (sinal 40% + parcelas), DIFAL como nota.
 • Contrato de Venda (via Proposta): valor, parcelas, equipamentos (códigos); Contrato Instalador (via Proposta): equipamentos e mão de obra por equipamento.
 • Central de Decisões: margem efetiva < margem mínima (15%) ou desconhecida → decisão do CEO para enviar proposta e para comprar.
 • Aval Financeiro: o "custo total de mercadorias" da precificação aprovada é o teto de custo conferido.
 • P.I. (Gestão de Importação): itens/modelos e quantidades; Embarques: containers (tipo × quantidade); Projeto de Elevadores: códigos dos equipamentos nos desenhos (Projeto de Instalação e ID-TAG).
 • Dashboard financeiro e Prazos & Pendências (etapa "Precificação", prazo de 2 horas úteis).
=== QUEM DOA OS DADOS (fornecedores de informação) ===
 • Formulário de Elevadores (equipamentos, tração/capacidade/paradas, cidade/UF da obra, finalidade, contribuinte); Cotação a Fornecedor (US$, modelo, containers); Atualização de Custos (mão de obra, containers/capatazia/GRI, frete interno, DIFAL);
 parâmetros fiscais padrão; câmbio PTAX ao vivo; digitação do Financeiro (despesas, comissões, mark-up).

=== PERGUNTAS QUE O CEO/FINANCEIRO FAZEM ===
 "Quanto cada equipamento deixa de lucro?" → coluna "Líquido por Equip." (fórmula acima; pode diferir entre equipamentos porque a mão de obra muda com tração × capacidade × paradas).
 "Por que o desconto é maior que a queda do líquido?" → porque ~13% de cada R$ do preço vão para impostos e comissões (o número exato aparece na nota sob a tabela).
 "Por que o código mudou?" → numeração corrida 1..N por paradas (regra do ecossistema).
 "Por que o DIFAL está zero?" → mesma UF da VerticalParts (SP), finalidade Revenda, ou ainda não clicou em "Calcular" depois de corrigir Finalidade/Contribuinte.
$doc$),

('rota:cadastro-custos', 'rota', 'Atualização de Custos — conhecimento completo', $doc$
TELA: Atualização de Custos (Financeiro & Preços › Atualização de Custos, /cadastros/cadastro-custos/<aba>). Tabelas de referência que a Precificação HERDA automaticamente. Quem mantém atualiza pelo menos 1 vez por semana ou quando houver mudança.
Abas (botões no topo): "Instalação — Elevadores" (/instalacao-elevadores), "Instalação — Escada/Esteira" (/instalacao-escada-esteira), "Containers" (/containers), "Frete interno" (/frete), "DIFAL" (/difal).
Legenda: laranja = campo editável; cinza = calculado. Cada célula salva ao sair do campo (aparece toast de erro se falhar).

ABA "Instalação — Elevadores": tabela tração × capacidade (mín./máx. kg) × paradas → "Dias p/ montagem", "Qtd. montadores", "Valor reajustado (R$)" (cotações reais de instaladores; linhas estimadas por regressão são marcadas). HERDEIROS: Precificação › "Mão de obra — busca automática" (uma linha por equipamento físico),
 Contrato Instalador e Dashboard financeiro. Atenção: faixas sobrepostas confundem a busca — vale a mais específica; limpe as duplicadas.
ABA "Instalação — Escada/Esteira": valor fixo por tipo (Escada Rolante, Esteira Rolante), um para São Paulo e outro para outros estados.
ABA "Containers": tipo (20GP, 40GP, 40HC…), comprimento, altura, capacidade, "Preço (USD)" e "Preço (R$)" (R$ = USD × câmbio de hoje; botão "Recalcular"), "Capatazia (USD/R$)", "GRI (USD/R$)", data da cotação, fornecedor, observações.
 HERDEIROS: Precificação › "CONTAINERS" (preço, capatazia, GRI — só preenche linha vazia) e Embarques.
ABA "Frete interno": tabela Santos → 27 capitais das 2 transportadoras: "Frete L (carga solta)" e "Frete LS (container)" de cada uma, "Valor da carga (R$)"; valor POR CONTAINER; "caso a caso" = sem preço (não vira opção). Observações gerais e de cada transportadora (editáveis):
 L = caminhão menor (carga solta), LS = caminhão maior compatível com container fechado; se a carga passar de R$ 250.000 ou o local for a mais de 20 km da capital, refazer a cotação; Transportadora 1: ad valorem 1/1000, pedágios inclusos, adicional LS acima de 25 t = +20%, etc.
 A planilha original (aba FRETE) NÃO tem fórmulas — são valores digitados. HERDEIRO: Precificação › "Sugestão automática do frete interno" (cidade da obra × containers; padrão LS mais barata).
ABA "DIFAL": "Simulador de DIFAL" (Destino UF, Valor da operação, Origem da mercadoria; usa o MESMO motor da Precificação; origem fixa SP) e "Tabela de DIFAL por estado" (27 UFs: "Categoria" — Base Única, Base Única com FCP, Base Dupla Simples, Base Dupla Composta, Base Dupla com FCP —,
 "Alíq. interna", "Interestadual nacional", "Interestadual estrangeira", "Fundo de combate"; digite em % — 20 = 20%). Espelha a aba BASE do DIFAL.xlsx. HERDEIRO: Precificação › card "DIFAL".
$doc$)
on conflict (id) do update set tipo = excluded.tipo, titulo = excluded.titulo, conteudo = excluded.conteudo, atualizado_em = now();
