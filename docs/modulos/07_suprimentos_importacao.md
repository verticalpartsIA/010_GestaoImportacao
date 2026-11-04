# 7 Suprimentos & Importação — documento do módulo (REAL, fonte da verdade — 31/10/2026)

> **Status: REAL (documento oficial do módulo 7), aprovado pelo Gelson em 31/10/2026**, no molde de `01_geral.md` a `06_contratos_juridico.md`. Histórico de entrega (PR, hash, `?v=`) não se repete aqui: o Git guarda.
>
> **Por que este módulo pede cuidado:** é onde a empresa **compra do exterior** (P.I., RFQ, embarque, desembaraço) e **repõe o estoque de revenda importada** (Importação Varejo e Cotações de Varejo). Mexe com dinheiro em moeda estrangeira, com o Omie (requisição de compra) e com prazos de ~180 dias. Várias telas gravam em tabelas abertas à chave pública (PC-6).
>
> **Fonte da verdade:** o código e o banco, conferidos em 31/10/2026 (`origin/main` `fe50b5b`). **Conferido** = lido no código ou consultado no banco (só SELECT) nesta data; **Herdado** = veio do `CLAUDE.md`, de uma spec ou do documento de outro módulo e **não** foi reconferido; **Não verificado** = não consegui conferir (e o texto diz). Sem selo vale como Não verificado.
>
> **Escopo do módulo:** as **onze** telas do grupo "Suprimentos & Importação" do menu (`NAV_GROUPS` em `shell.jsx`, subtítulo "Siscomex & Compras"): sob o subtítulo **Gestão Importação** — Painel, P.I., RFQ, IMS, Embarques, Rastreio Marítimo, Análise de Preços, Catálogo Siscomex — e, fora do subtítulo, **Importação Varejo**, **Cotações de Varejo** e **Pedidos**. O Detalhe de Embarque (`importacao-detail`) e o Mapa de navios (`importacao-rastreamento`) não têm item de menu: pertencem ao 7.6. **Não são deste módulo:** o Almoxarifado e as "compras internas" (`pedidos-varejo-store.js`, tabela `pedidos_compra_varejo`, módulo 12); o Kanban "Solicitações NCM" (`ncm-kanban`, `ncm-detail`, rotas `/engenharia/…`, módulo 8); o Inbox e o envio de e-mail (módulo 1, área blindada); a Tratativa com o fornecedor de equipamento (4.3); a Precificação (5.2).
>
> **Onde moram arquivos do módulo que não têm nome óbvio (Conferido):** o Rastreio Marítimo, o Detalhe de Embarque e o Mapa de navios estão **dentro de `logistica.jsx`** (`ImportacaoPage`, `ImportacaoDetail`, `ImportacaoRastreamento`); o Painel e a Análise de Preços dividem `gestao-importacao-painel.jsx`; o Catálogo Siscomex e o Kanban NCM dividem `ncm-catalogo.jsx`; a lista de lotes de varejo da RFQ vive em `rfq-varejo.jsx`, e o mapa comparativo em `cotacoes-varejo.jsx`.

## Como esta numeração funciona
- A regra de numeração (móvel, como cláusula de contrato) e os 11 temas de cada tela moram **uma vez só**, em `docs/modulos/01_geral.md`. Aqui vale a mesma: módulo = **7**; telas filhas = **7.1 a 7.11**, na ordem do menu; o conteúdo comum fica na **Parte comum** (PC-), sem número de tela.
- **Tudo o que é janela, aba, gaveta ou assistente de uma tela pertence a ela.** Na 7.2 estão as quatro abas do formulário e a janela de vínculo com o embarque; na 7.5 as sete abas do formulário e o bloco de cotações de frete; na 7.6 o Detalhe do embarque e o Mapa de navios; na 7.10 o mapa comparativo e a aprovação.
- Mudou algo? Escreva no tema certo da tela e **reescreva o Índice e o Glossário** na mesma sessão.

## Índice
7. **Suprimentos & Importação**
   7.1 Painel · 7.2 P.I. · 7.3 RFQ · 7.4 IMS · 7.5 Embarques · 7.6 Rastreio Marítimo (Detalhe e Mapa de navios) · 7.7 Análise de Preços · 7.8 Catálogo Siscomex · 7.9 Importação Varejo · 7.10 Cotações de Varejo · 7.11 Pedidos
   &nbsp;&nbsp;&nbsp;Cada tela tem os temas: x.1 O que é · x.2 Rota e arquivos · x.3 Perfil e acesso · x.4 O que a tela mostra · x.5 Botões e controles · x.6 Comportamento · x.7 Dados (lê/grava) · x.8 Regras e armadilhas · x.9 Testes · x.10 Pendências e decisões · x.11 Histórico
   Parte comum de Suprimentos & Importação (sem número de tela)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações · PC-2 Do pedido de cotação ao embarque (o fluxo de ponta a ponta) · PC-3 O Nº da cotação: equipamento × varejo · PC-4 Estoque, sugestão de compra e Dia D · PC-5 Moeda, câmbio e totais · PC-6 Identidade, alçadas e segurança · PC-7 Gatilhos e rotinas · PC-8 Tabelas · PC-9 Navegação, cache e testes · PC-10 Menu "?" e tutoriais · PC-11 Documentos soltos e destino do que foi concatenado · PC-12 Benefícios trocados com os outros módulos
8. Engenharia & Produto → `08_engenharia_produto.md` (REAL)

## Glossário (módulo Suprimentos & Importação)
Termos gerais (alçada, soft-delete, alerta, Nº da cotação, evento de fluxo) estão em `01_geral.md`; **Aval de Pagamento**, **Aval Jurídico** e **Aval Engenharia** em `05_financeiro_precos.md` e `06_contratos_juridico.md`. Não se repetem aqui.
- **P.I. (Proforma Invoice):** a fatura proforma do fornecedor estrangeiro; é o documento de compra. Tabela `pi_importacao`. **Rascunho automático:** P.I. criada pelo sistema com número provisório `RASCUNHO-…` quando uma compra é liberada ou um lote de varejo é aprovado; a pessoa informa o número real depois.
- **RFQ (Request for Quotation):** cotação comparativa com fornecedores. Há **dois mundos** sob o mesmo item de menu: a RFQ antiga (`rfq_importacao`, vazia hoje) e os **lotes de varejo** (`COTV-xxxx`, `iv_cotacao_*`).
- **IMS:** solicitação de recursos operacionais por projeto (transporte, munck, empilhadeira, andaime, mão de obra). Tabela `ims_importacao`.
- **Embarque:** o carregamento físico (navio, contêineres, BL). Duas tabelas: `embarques_importacao` (a **fonte da verdade**, formulário de sete abas) e `embarques` (o **espelho** que o Rastreio Marítimo lê).
- **ETD / ETA / rolagem:** data de saída / de chegada previstas; "rolagem" é o armador empurrar o ETD.
- **Presença de carga:** a chegada **real** da carga ao porto; fecha a etapa "Chegou ao Brasil" da Evolução dos Equipamentos.
- **DUIMP / DI / canal:** declaração de importação e a cor da parametrização aduaneira (Verde, Amarelo, Vermelho, Cinza).
- **Catálogo Siscomex / operador estrangeiro:** produtos (NCM) e fabricantes/exportadores cadastrados no Portal Único para uso na DUIMP.
- **Importação Varejo:** a tela de reposição de estoque de **revenda importada** (produtos com origem fiscal "1 — Estrangeira, importação direta" no Omie).
- **Curva A/B/C/D:** classificação por volume faturado desde 01/01/2024; **D = sem venda no período**.
- **Posição (do estoque):** disponível + pendente + comprado + a caminho; é o que a regra de compra compara com o mínimo.
- **Dia D:** data-limite para decidir o pedido (hoje + cobertura em dias − prazo total).
- **Lote de cotação (COTV):** conjunto de produtos que o comprador pede para cotar; **convite** = o fornecedor chamado; **resposta** = o que ele devolveu pelo portal; **rodada** = cada negociação.
- **Mapa comparativo:** produto × fornecedor, onde o comprador digita a quantidade a comprar de cada um.

---

## 7.1 Painel

### 7.1.1 O que é
Tela de leitura que resume a Gestão Importação: **quatro cartões** (P.I. abertas, RFQ abertas, IMS pendentes, Embarques ativos) e um quadro "Embarques por etapa". Não tem tabela própria. **Conferido** em `gestao-importacao-painel.jsx`, 31/10/2026.

**Fora do escopo:** qualquer ação de gravação; o resumo de estoque e de cotações de varejo (ver achado em 7.1.10).

### 7.1.2 Rota e arquivos
- Rota `gi-painel`; URL `/gestao-importacao/gi-painel`. Item "Painel" (ícone casa), primeiro do subtítulo Gestão Importação. **Conferido** (`docs/MAPA_DE_ROTAS.md`).
- Arquivo: `src/gestao-importacao-painel.jsx` (`window.GIPainelPage`).

### 7.1.3 Perfil e acesso
- Sem `restrict`, rota fora de `RESTRICTED`, e a tela **não chama `temCapacidade`**. A alçada `gi-painel` existe no catálogo (grupo "Importação | Suprimentos"). **Conferido.**

### 7.1.4 O que a tela mostra
Cabeçalho "IMPORTAÇÃO · GESTÃO IMPORTAÇÃO" / **Painel** / "Visão geral de P.I., RFQ, IMS e Embarques." Cartões:
- **P.I. abertas** — P.I. cujo status não é "Concluída" nem "Cancelada"; o rodapé soma o valor por moeda (ex.: "USD … + EUR …").
- **RFQ abertas** — RFQ antigas com status "Aberta" ou "Em análise" ("aguardando/analisando").
- **IMS pendentes** — IMS com `aprovado === false` e não arquivada; rodapé "N atrasada(s)" ou "nenhuma atrasada".
- **Embarques ativos** — embarques cuja etapa não é "Concluído" e que não estão arquivados.
- Quadro **Embarques por etapa**: um bloco por etapa com a contagem; vazio: "Nenhum embarque ativo."

### 7.1.5 Botões e controles
Nenhum. Os cartões **não** são clicáveis (diferente de 7.9, onde os cartões filtram).

### 7.1.6 Comportamento
Carrega as quatro listas de uma vez; se alguma falhar, mostra tudo zerado (sem aviso). Sem Realtime, sem atualização automática: só ao abrir a tela.

### 7.1.7 Dados
- **Lê:** `PIStore.listarTodas`, `RFQStore.listarTodas`, `IMSStore.listarTodas`, `EmbarquesImportacaoStore.listarTodas` (tabelas `pi_importacao`, `rfq_importacao`, `ims_importacao`, `embarques_importacao`). **Não grava nada.**

### 7.1.8 Regras e armadilhas
- **Falha de leitura vira "zero" em silêncio** (`catch → listas vazias`): um erro de rede mostra "0 P.I. abertas" como se não houvesse nenhuma (Art. 9). **Achado.**
- As quatro leituras são `select *` sem `.range()`: o banco corta em 1.000 linhas (hoje 31, 0, 1 e 11 linhas, longe do corte). **Achado.**

### 7.1.9 Testes
Nenhum teste de unidade nem e2e específico; a rota entra no teste de fumaça (`e2e/smoke.spec.js`, que abre toda rota de `KNOWN_ROUTES`) — **não rodei o e2e** (roda no CI). **Cenário de aceitação:** *Dado* 31 P.I. e 11 embarques no banco, *quando* abro o Painel, *então* os cartões mostram só os não concluídos. Sem teste automatizado que o prove.

### 7.1.10 Pendências e decisões
- **Achado, sem correção:** o cartão **"RFQ abertas" só conta a RFQ antiga** (`rfq_importacao`, **0 linhas**). Os **20 lotes de cotação de varejo** (`iv_cotacao_lotes`) não entram: o Painel mostra "0" mesmo com cotação de varejo em andamento. **Conferido.** Decisão do Gelson: incluir os lotes?
- O Painel não mostra nada de **Importação Varejo** (sugestões, Dia D, ruptura).

### 7.1.11 Histórico
Criado na consolidação da solução de importação da equipe, junto com P.I., RFQ, IMS e Embarques (agosto/2026, **Herdado**).

---

## 7.2 P.I.

### 7.2.1 O que é
A tela das **Proforma Invoices**: lista todas, cria e edita (formulário de quatro abas), calcula total, taxas, % paga e transferências entre P.I., registra a produção e **vincula a P.I. a um embarque**. Também recebe as **P.I. em rascunho** criadas automaticamente. **Conferido** em `pi.jsx` e `pi-store.js`, 31/10/2026.

**Fora do escopo:** o pagamento real (Financeiro/Omie); a decisão de comprar (Central de Decisões e gate de avais, 5.3 e 6.2); o embarque em si (7.5).

### 7.2.2 Rota e arquivos
- Rota `pi-importacao`; URL `/gestao-importacao/pi-importacao[/novo | /<id> | /<id>/vincular]`: **Nova**, **Editar** e a **janela de vínculo** refletem a URL (F5 e link direto funcionam). **Conferido.**
- Arquivos: `src/pi.jsx` (`window.PIPage`, 859 linhas), `src/pi-store.js` (`window.PIStore`, 346 linhas).

### 7.2.3 Perfil e acesso
- Sem `restrict`, fora de `RESTRICTED`, **sem `temCapacidade`**: quem vê o menu cria, edita e **exclui**. Alçada `pi-importacao` no catálogo. Tabela `pi_importacao` **aberta ao público** (PC-6). **Conferido.**

### 7.2.4 O que a tela mostra
Cabeçalho "IMPORTAÇÃO · GESTÃO IMPORTAÇÃO" / **Proforma Invoices (P.I.)** / "Gerencie todas as P.I. e vincule-as aos embarques." Barra "Buscar por nº PI, nº/Master ID da cotação, fornecedor ou embarque…" e filtro de status ("Todos os status", Em andamento, Concluída, Aguardando documentos, Cancelada).

**Tabela** (colunas ordenáveis; cabeçalho fixo): Nº P.I. (com o selo **"Rascunho automático"**), Nº Cotação (Master ID, ou "—"), Fornecedor, Abertura, **Status** (semáforo: verde Concluída, amarelo Em andamento, vermelho Aguardando documentos, cinza Cancelada), Produção, Valor total, Itens, % paga, Embarque ("Não vinculada" se nenhum) e três ícones por linha.

**Formulário (Nova/Editar) — 4 abas:**
- **Identificação:** Número da P.I.*, "Nº Cotação — só para equipamento (vazio = varejo/estoque)", Data de abertura*, Status, Data de prontidão do pedido, Moeda (USD, EUR, BRL, CNY, GBP), "Vincular ao embarque"; bloco Fornecedor (lista do cadastro), Incoterms (EXW, FCA, FAS, FOB, CFR, CIF, CPT, CIP, DAP, DPU, DDP), Data da solicitação de pagamento, Nº da requisição, Nºs de série, Categorias. Um aviso mostra se a cotação digitada existe (com o Master ID) ou não.
- **Produtos:** "Itens da P.I." (Descrição do produto*, Código, Quantidade*, Unidade, NCM, Valor unitário*, "Total do item", "Adicionar item", "Valor total da P.I."); o **Código** puxa descrição, unidade e NCM do cadastro (mensagens "✓ Campos vazios preenchidos pelo cadastro" / "Código não encontrado — preencha à mão"); bloco **Taxas adicionais** ("Adicionar Taxas": Tipo de taxa* — %, R$ ou US$ —, "Qual taxa?*", valor; editar e remover por linha).
- **Pagamento:** **1º Pagamento** e **2º Pagamento** (Data, Valor, Cotação USD (R$)), **Pagamentos adicionais** ("Além do 1º e 2º pagamento"), **Transferência de pagamento entre P.I.s** (Sentido: "Recebida (outra P.I. pagou esta)" ou "Enviada (paguei aqui algo de outra P.I.)"; Nº da outra P.I.; Valor; Data do pagamento original; Observação) e o resumo "Total dos itens / Taxas / Total da P.I. / Total pago / Transferências".
- **Produção:** Status da produção, Data de início, Previsão de conclusão, Data de conclusão, "Cargo Ready (mercadoria pronta)", "Observações da produção", "Anexos (fotos, relatórios, certificados)" (envio ao Storage).
- Rodapé: "Observações gerais", **Cancelar** e salvar.

### 7.2.5 Botões e controles
**Nova P.I.** (abre o formulário na URL `/novo`); por linha: **Editar** (ícone lápis), **Vincular embarque** (ícone elo, abre a janela "Vincular P.I. {nº} a Embarque" com "Nenhum (desvincular)" e **Cancelar**) e **Excluir** (ícone lixeira, `confirm`: "Excluir a P.I. …? Esta ação não pode ser desfeita."). No formulário: abas, "Adicionar item", "Adicionar Taxas", "Adicionar pagamento", "Adicionar transferência", "+ Adicionar anexos", **Cancelar**, salvar. Passar o mouse no semáforo mostra uma **instrução** montada com os dados reais (o que falta em cada status).

### 7.2.6 Comportamento
- **Nº da cotação é conferido** ao digitar: existe? mostra o Master ID e o cliente; na criação, **herda os produtos** da Precificação (modelos, quantidade, valor unitário em USD). Na **edição** os itens nunca são sobrescritos.
- **Gate de compra:** em P.I. **nova** com Nº de cotação, o salvar roda `DecisoesStore.verificarGateCompra` (avais e, se a margem pede, o CEO); bloqueado, mostra o motivo. A prévia roda parada ~0,5 s depois da digitação e **não cria decisão** (só o salvar cria).
- **Nº da cotação trava depois de gravado**; P.I. salva sem Nº pode recebê-lo na edição (e o Nº segue para o embarque vinculado).
- **Rascunho automático:** ao abrir a tela, `sincronizarRascunhosAutomaticos` cria P.I. para compra já liberada (etapa `COMPRA_LIBERADA` pendente) e ainda sem P.I.; avisa "N P.I. automática(s) criada(s)…". Confirmar o número real tira o selo.
- **Total gravado** = itens + taxas aplicáveis. Taxa em moeda **diferente** da P.I. fica visível mas **não** soma (sem câmbio confiável). A **% paga** = pagamentos próprios + transferências recebidas − enviadas (`PIStore.calcValorQuitado`; lista e formulário usam a mesma função).

### 7.2.7 Dados
- **Lê/grava:** `pi_importacao` (colunas jsonb `itens`, `taxas`, `pagamentos_adicionais`, `transferencias_pagamento`, `producao`, `numeros_serie`, `categorias`); lê `embarques_importacao` (lista do seletor), `importacao_varejo_produtos`, `pcp_produtos` e `fichas_tecnicas` (cadastro do item), `gatilhos` (compra liberada), `precificacoes_elevador`/`PropostaHeranca` (herança). Anexos: bucket `engenharia`.
- **Eventos** (`EventosFluxo`): criação com Nº de cotação (`PI_CRIADA`, **Herdado** o nome), confirmação do rascunho e ganho do Nº. **Log:** `VPLog` só no rascunho automático e no rascunho de lote ("Criou P.I. …"); salvar/excluir pelo formulário **não** loga (**achado**).
- **Doa para:** Embarques (`numero_cotacao`, pagamentos agregados), Importação Varejo (fornecedor/preço e "a caminho", PC-4), Dashboard/Prazos (eventos).

### 7.2.8 Regras e armadilhas
- **`remover` é `DELETE` físico** (policy `pi_importacao_delete` aberta). Exclusão não é "soft" (Art. 27, Meta). **Achado.**
- `listarTodas` sem `.range()` (31 linhas hoje). **Achado.**
- O `console.log` da página ainda diz "PI PAGE LOADED - v13" (texto velho, inofensivo).
- Códigos de item com espaço no fim (`"VPER-675 "`) existem nos dados reais; o cruzamento com o catálogo usa `trim()` (**Herdado** de 01/10).
- A P.I. **sem Nº de cotação é legítima** (varejo/estoque); só equipamento entra pela cotação (PC-3).
- `sync-pi-omie-pagamentos` (leitura de pagamentos no Omie) **está ACTIVE (v7) no banco e tem pasta no repositório**, mas o `CLAUDE.md` diz que foi **apagada em 01/10/2026**. Divergência, **sem correção**: qual vale? (Art. 12.) **Conferido** (`list_edge_functions` e `ls supabase/functions`).

### 7.2.9 Testes
Nenhum teste de unidade da P.I. (`pi-store.js` não tem `*.test.js`); a rota entra no teste de fumaça (não rodei o e2e). **Cenários de aceitação (sem teste automatizado):** (1) *Dado* itens US$ 2×100 e taxa de 5%, *quando* salvo, *então* o total é US$ 210,00 (**Herdado**, testado ao vivo em 29/09). (2) *Dado* uma transferência "Enviada" de US$ 10.630,75, *então* a % paga da P.I. de origem sobe e a da destino também (**Herdado**).

### 7.2.10 Pendências e decisões
- Hard delete e ausência de alçada (7.2.8, PC-6). Sem log no salvar/excluir.
- **Ideia em aberto (Herdada):** coluna na lista que consulta o Contas a Pagar do Omie pelo nº da P.I. e mostra se foi paga.
- Transferência entre P.I. é **lançada à mão nas duas pontas** (sem espelho automático).

### 7.2.11 Histórico
Taxas ("Adicionar Taxas", 29/09) e transferências entre P.I. (30/09) nasceram de casos reais (fatura da ELESpares; SCVP260522). A P.I. em rascunho a partir de lote de varejo vem de 25/10/2026 (7.10). **Herdado.**

---

## 7.3 RFQ

### 7.3.1 O que é
O item do menu "RFQ" reúne **dois mundos**: (a) a **RFQ antiga** — cotação comparativa com fornecedores, itens e preços, com "vencedor" (tabela `rfq_importacao`, **0 linhas**); (b) a **lista dos lotes de varejo** (`COTV-xxxx`, vindos de 7.10) e o **lote aberto**, com abas de **tratativas por fornecedor**, **comparar e escolher vencedor** e **P.I. deste lote**. **Conferido** em `rfq.jsx`, `rfq-varejo.jsx`, `rfq-store.js`, `rfq-varejo-store.js`.

**Fora do escopo:** o portal público do fornecedor (7.10); o Inbox (módulo 1); a Tratativa do RFQ de **equipamento** (4.3).

### 7.3.2 Rota e arquivos
- Rota `rfq-importacao`; URL `/gestao-importacao/rfq-importacao[/<lote>[/<aba>]]`, onde `<aba>` é `comparar`, `pi` ou o **id de um fornecedor** (tratativa). O link antigo `/logistica/cotacoes-varejo/<lote>` redireciona para `…/rfq-importacao/<lote>/comparar`. **Conferido.**
- Arquivos: `src/rfq.jsx` (`window.RFQPage`), `src/rfq-store.js`, `src/rfq-varejo.jsx` (`RFQVarejoLinha`, `RFQVarejoDetalhe`, `RFQVarejoPIs`), `src/rfq-varejo-store.js`.

### 7.3.3 Perfil e acesso
Sem `restrict`, sem `temCapacidade`. Alçada `rfq-importacao` no catálogo. **Conferido.**

### 7.3.4 O que a tela mostra
**Lista:** cabeçalho "IMPORTAÇÃO · GESTÃO IMPORTAÇÃO" / **RFQ** / "Request for Quotation — cotação comparativa de produtos com fornecedores."; busca "Buscar por número ou produto…" e filtro de status (Aberta, Em análise, Fechada, Cancelada). Acima, "N cotação(ões) de varejo — tratativas com os exportadores (vêm de Cotações de Varejo)" (escolhendo qualquer status que não seja "Todos os status", **os lotes somem da lista**: o filtro só vale para a RFQ antiga; a busca por número vale para os dois); abaixo, "N RFQ(s) encontrada(s)" com um cartão por RFQ antiga (número, status, datas, itens, fornecedores e "Valor vencedor").
**Formulário da RFQ antiga:** Nº RFQ, "Nº Cotação — só se for de equipamento (vazio = varejo/estoque)", Data*, Validade, Status; **Fornecedores participantes** (nome do cadastro e moeda); **Itens** (nome, Código/ref., Qtd*, Unidade, Observação); **Comparativo de preços** (preço unitário por item e fornecedor, caixa "Vencedor único para todos os itens", "Totais por fornecedor", "Vencedor global"); Observações.
**Lote aberto (eyebrow "Importação · Gestão Importação · RFQ · Varejo"):** botões **← Lotes**, **Pedir cotação ao fornecedor**, **Aprovar vencedor e pedir P.I.**, **Cancelar lote**; abas **Fornecedores e tratativas**, **Comparar e escolher vencedor** (o mapa de 7.10) e **P.I. deste lote**. Na tratativa: tabela das respostas (Código, Descrição, Qtd. pedida, Prazo (dias), MOQ, Obs. do fornecedor), a conversa (e-mails do Inbox e mensagens), **Anexar arquivo**, **Abrir no Inbox**, **Abrir tratativas**; na aba P.I.: **Abrir P.I.**.

### 7.3.5 Botões e controles
**Nova RFQ**; por cartão **Editar** e **Excluir** (`confirm`). Os do lote estão acima; os cartões de fornecedor têm os botões descritos em 7.10.5.

### 7.3.6 Comportamento
A lista de lotes é lida de `CotacoesVarejoStore.listarLotes` e recarrega ao entrar/sair de um lote. A RFQ antiga numera por `RFQStore.gerarNumero`. Ao **ganhar o Nº de cotação na edição**, a RFQ emite `RFQ_FRETE_ENVIADO` (**Herdado**; a leitura do `rfq-store.js` mostra o evento nas duas pontas do salvar).

### 7.3.7 Dados
`rfq_importacao` (antiga); `iv_cotacao_lotes/_itens/_convites/_respostas/_tratativas` (varejo); `emails_projeto` (leitura, para a conversa); `tratativas`. Detalhes em 7.10 e PC-8.

### 7.3.8 Regras e armadilhas
- **A RFQ antiga está vazia (0 linhas) e a Análise de Preços (7.7) e o Painel (7.1) só leem dela.** O trabalho real hoje é o lote de varejo. **Achado** (7.7.10).
- `remover` da RFQ antiga é `DELETE` físico; policies abertas ao público. **Achado.**
- Fornecedor removido ou substituído do lote continua visível em modo leitura (histórico não morre) — **Herdado**, ver 7.10.8.

### 7.3.9 Testes
Sem teste da RFQ antiga. Regras puras do lote em `cotacoes-varejo-calc.test.js` (7.10.9). Não rodei o e2e.

### 7.3.10 Pendências e decisões
- Decidir o destino da **RFQ antiga** (manter, migrar para o mesmo fluxo do lote, ou retirar), já que o fluxo novo a substituiu na prática. **Pergunta ao Gelson.**
- Resposta de fornecedor **por e-mail** ainda não preenche o mapa; só o portal (**Herdado**).

### 7.3.11 Histórico
O lote de varejo passou a morar aqui em 25/10/2026 (spec `docs/superpowers/specs/2026-10-25-rfq-importacao-vencedor-pi/`, PC-11).

---

## 7.4 IMS

### 7.4.1 O que é
Controle de **recursos operacionais e transportes por projeto**: cada solicitação lista recursos (Transporte, Munck, Empilhadeira, Andaime, Mão de obra, Outros Equipamentos), fornecedores cotados, aprovação e execução (check-in/out, avaliação). **Conferido** em `ims.jsx` e `ims-store.js`. Tabela `ims_importacao`: **1 linha**.

**Fora do escopo:** contratação de instalador (módulo 11); o pagamento do serviço.

### 7.4.2 Rota e arquivos
Rota `ims-importacao`; URL `/gestao-importacao/ims-importacao` (sem aba nem item na URL). Arquivos `src/ims.jsx` (`window.IMSPage`), `src/ims-store.js`. **Conferido.**

### 7.4.3 Perfil e acesso
Sem `restrict`, sem `temCapacidade`; alçada `ims-importacao` no catálogo. Tabela aberta ao público (PC-6). **Conferido.**

### 7.4.4 O que a tela mostra
Cabeçalho **IMS** / "Controle de recursos operacionais e transportes por projeto."; busca "Buscar por nº, projeto ou solicitante…", filtros "Todos os status" (Solicitado, Em análise, Aprovado, Agendado, Em execução, Finalizado, Atrasado, Cancelado) e "Todos os tipos"; cartão por solicitação com selos "✓ Aprovado" e "Arquivado" e "Observações finais".
**Formulário:** Nº embarque (opcional); "Nº Cotação — só se for de equipamento (vazio = varejo/estoque)"; Status; Solicitante*; Projeto*; Responsável interno; Data início*; Data fim*; Local da execução; Cidade; Observações operacionais; **Recursos operacionais** ("Adicionar recurso": Tipo de recurso* e **Especificações** que mudam por tipo — Munck: peso da carga, altura de içamento, raio de operação; Empilhadeira: capacidade, altura de elevação, tipo de piso; Andaime: altura total, tipo, "Necessita ART?"; Transporte: tipo de carga, peso aproximado, "Necessita escolta?"); **Fornecedores cotados** ("Adicionar fornecedor": Nome, Status — Cotado, Aprovado, Em execução, Finalizado —, Valor (R$), Observações) e "Valor total previsto"; "Nº pedido de compra"; **Aprovação** (Aprovador, Data da aprovação, "Aprovado?", Observação); execução (Check-in, Check-out, "Serviço concluído?", "Avaliação do serviço (1 a 5)", "Observações finais").

### 7.4.5 Botões e controles
**Nova solicitação**; por cartão **Editar** e **Excluir**; no formulário **Adicionar recurso**, **Adicionar fornecedor**, **Cancelar** e salvar.

### 7.4.6 Comportamento
"Atrasado" é **calculado** (`IMSStore.estaAtrasado`: `data_fim` passou e o serviço não foi concluído), não gravado. Ao gravar uma IMS com Nº de cotação (criação ou ganho do Nº na edição) emite `IMS_CONTRATADO`.

### 7.4.7 Dados
Lê/grava `ims_importacao`. Alimenta o cartão "IMS pendentes" (7.1) e o evento `IMS_CONTRATADO` (Prazos & Pendências).

### 7.4.8 Regras e armadilhas
`remover` é `DELETE` físico; sem log. Sem alçada. IMS sem Nº de cotação é legítima (importação de varejo). **Achados.**

### 7.4.9 Testes
Nenhum teste da IMS. Não rodei o e2e.

### 7.4.10 Pendências e decisões
O fluxo "contratação de recurso" pode se sobrepor ao Contrato do Instalador/Pagamentos (módulo 11): **Não verificado**, fica para o 11.

### 7.4.11 Histórico
Uma das quatro telas trazidas da solução de importação da equipe (agosto/2026, **Herdado**). 1 solicitação em produção.

---

## 7.5 Embarques

### 7.5.1 O que é
O cadastro e o acompanhamento de cada **embarque de importação**, em um formulário de **sete abas**: Identificação, Pagamentos, Frete, Embarque, Aduaneiro, Faturamento, Entrega. É a **fonte da verdade** (`embarques_importacao`); um espelho em `embarques` alimenta o Rastreio Marítimo (7.6). **Conferido** em `embarques-importacao.jsx` (810 linhas), `embarques-frete-cotacoes.jsx`, `embarques-importacao-store.js`, `embarques-frete-calc.js`, `embarques-sugestoes-calc.js`, `rolagens-calc.js`.

**Fora do escopo:** a posição do navio (7.6); o pagamento da P.I. (7.2); a Evolução dos Equipamentos e a Linha do Tempo (módulos 9 e 8), que **leem** estes dados.

### 7.5.2 Rota e arquivos
- Rota `embarques-importacao`; URL `/gestao-importacao/embarques-importacao[/<aba>]`; a aba ativa vai na URL (`identificacao` é a padrão e deixa a URL limpa). **Limite:** o formulário abre por clique (`showForm`/`editing`), não pela URL: F5 em `…/frete` mostra a **lista**. **Conferido.**
- Arquivos: `src/embarques-importacao.jsx` (`window.EmbarquesImportacaoPage`), `src/embarques-frete-cotacoes.jsx` (`window.EIFreteCotacoes`), `src/embarques-importacao-store.js`, `src/embarques-frete-calc.js` (`EmbFreteCalc`), `src/embarques-sugestoes-calc.js` (`EmbSugestoesCalc`), `src/rolagens-calc.js` (`RolagensCalc`).

### 7.5.3 Perfil e acesso
Sem `restrict`, sem `temCapacidade`; alçada `embarques-importacao`. A tabela `embarques_importacao` e o espelho `embarques` estão **abertos ao público** (PC-6). Alçadas de e-mail valem para o envio do pedido de frete (módulo 1). **Conferido.**

### 7.5.4 O que a tela mostra
Cabeçalho **Embarques**; busca "Buscar por PI, fornecedor, referência ou nome…", filtro de etapa (Pagamento, Produção, Embarque, Desembaraço, Entrega, Concluído) e botão **Mostrar/Ocultar arquivados**; "N embarque(s) encontrado(s)". Cada **cartão** mostra nome, etapa, P.I. vinculadas e resumo (fornecedores, incoterms, contêineres), com **Editar**, **Arquivar/Desarquivar** (só com a etapa "Concluído") e **Excluir**; o cartão em edição fica destacado ("✎ Em edição no formulário acima") e a tela rola até o formulário.

**As sete abas (campos principais, rótulos reais):**
- **Identificação:** "Nome do embarque (destaque)", "Status da etapa"; lista das **P.I. vinculadas** (Nº P.I., Status, Valor; resumo de fornecedores, incoterms, categorias, séries, requisição, data); a vinculação é feita **na tela de P.I.** ("Salve o embarque para poder vincular P.I. a ele").
- **Pagamentos:** total do embarque, pago, "Falta pagar" por P.I. (usa `calcValorQuitado`).
- **Frete:** "Tipo de frete" (Marítimo, Aéreo, Rodoviário), "Modalidade" (FOB, FCA, EXW), "Cotação frete", "Moeda frete", "Transit time (dias)", "Free time (dias)", "Pedido de booking", "Aprovação do frete", "Agente de carga / freight forwarder" e o bloco de **até 4 cotações de frete** (7.5.6).
- **Embarque:** Ref. embarque, Porto de origem, Porto de destino, Navio, AWB/BL, "Armador (SCAC) — p/ rastreio automático", Redestinação, "Data pedido redestinação", "Data carregamento (prontidão da carga)"; **ETD** (original, atual, "Registrar rolagem pelo armador" com Nova data, Data comunicação, Motivo; tabela com **Corrigir**); **Containers** ("Adicionar container": Número, Tipo/tamanho, Lacre, Peso (kg), Data embarque, Data chegada) e o bloco "Containers informados na cotação" com **Atualizar**.
- **Aduaneiro:** Ref. despachante, "Custos/estimativa (R$)", "Docs Marimex", "TT total (dias)", DUIMP, "Data registro DUIMP", "Canal parametrização" (Verde, Amarelo, Vermelho, Cinza), "Última data free time", **PRESENÇA DE CARGA**, "Status da conferência" (Não se aplica … "Concluída — com exigência"), "Data da conferência", "Motivo / exigência"; **ETA** (original, atual, "Registrar alteração": Nova data ETA, Data comunicação, Motivo; tabela com ETA anterior, Novo ETA, Dias, Motivo, Comunicação, Registrado por).
- **Faturamento:** "Empresa de desembaraço", "Valor do faturamento (R$)", "Valor do numerário (R$)", reembolso (Valor, Status — Não solicitado … Cancelado —, datas), **Notas fiscais** ("Adicionar NF-e": Número, Chave de acesso, Data emissão, Cliente/destinatário, Valor, Status — Autorizada, Cancelada, Denegada) e "Observações financeiras"; mostra o **frete vencedor** (só leitura).
- **Entrega:** "Data limite entrega", "Local de entrega", "Data entrega", "Devolução container", com o texto "As datas de entrega alimentam a etapa 'Chegou na obra' da Evolução dos Equipamentos."; "Observações gerais".

### 7.5.5 Botões e controles
**Novo embarque**; por cartão Editar / Arquivar / Excluir; no formulário **Cancelar**, salvar, "Adicionar container", "Adicionar NF-e", "Registrar rolagem", "Registrar alteração", **Aplicar** (sugestões), **Atualizar** (containers da cotação); na aba Frete os botões das cotações (7.5.6).

### 7.5.6 Comportamento
- **Cotações de frete marítimo:** até **4 cotações** de agentes (fornecedor do Cadastro, taxas em USD/BRL, prazos, anexos, "vencedora"). Uma única vencedora (clicar de novo desmarca); com vencedora, **agente, cotação (total em USD; só BRL se não há USD), transit time e free time ficam travados** e preenchem os campos únicos no salvar (espelho, Precificação e Evolução seguem lendo esses campos). **Pedido por e-mail** pelo helper de e-mail existente (`referenciaTipo = 'cotacao_frete'`), mensagem **só em PT-BR**, anexos ≤ 2,5 MB no e-mail (o resto vai como link); **"✉ Pedir a vários agentes"** envia 1 e-mail por agente, em sequência, sem `mailto:` de reserva. Anexo e envio exigem o **embarque já salvo**. **Herdado** (CLAUDE.md); o código da aba foi lido, o **envio real não foi testado**.
- **Sugestões com botão "Aplicar"** (nunca gravam sozinhas; `EmbSugestoesCalc`): modalidade pelo incoterm da P.I., tipo "Marítimo" quando há cotação de frete, última data de free time = presença de carga + dias, status da etapa pelos campos preenchidos (só avança), TT total (ETD atual → presença de carga), ETA +N dias ao registrar rolagem (com `confirm`), numerário e faturamento a partir do frete vencedor (só em BRL).
- **Rolagens e ETA:** `RolagensCalc` **só avisa** (nova data anterior à prevista, comunicação anterior à da rolagem anterior), com **Corrigir** por linha; mudar o ETA de um embarque salvo grava a mudança em `historico_eta`.
- **Containers da cotação:** `EIContainersMudou` compara com a Precificação ("mudou: 2×40'HC → 1×40'HC — Atualizar"), preserva número/lacre/peso dos que continuam e confirma antes de retirar um preenchido.
- **Ao salvar:** grava `embarques_importacao` e atualiza o espelho `embarques` (inclusive `containers_lista`); emite `EMBARQUE_CRIADO`/`EMBARQUE_ATUALIZADO` e eventos de campo (agente de carga, cargo ready, canal, entrega); com **Nº de cotação ganho depois**, repete os eventos já cabíveis (`aoGanharCotacao`).
- **ETA do AIS:** `_sincronizarRastreio` **não sobrescreve `embarques.eta`** se o AIS atualizou depois do último ETA do histórico.

### 7.5.7 Dados
- **Lê/grava:** `embarques_importacao` (jsonb `containers`, `historico_rolagens`, `historico_eta`, `cotacoes_frete`, NF-e), `embarques` (espelho, com `containers_lista`), `pi_importacao` (vínculo); lê `precificacoes_elevador`, `formularios_elevador`, `cotacoes_elevador_fornecedor` (containers e Nº), `emails_projeto` (resposta do frete); Storage `engenharia` (anexos de frete). **Doa para:** Rastreio (7.6), Evolução dos Equipamentos, Linha do Tempo da Cotação, Prazos & Pendências (eventos), Importação Varejo (a caminho).

### 7.5.8 Regras e armadilhas
- **`remover` é `DELETE` físico** (policy aberta); há `arquivar` (só concluído). Sem alçada. **Achado.**
- O **espelho `embarques` tem 8 linhas e `embarques_importacao` 11**: a diferença não foi investigada (o espelho só nasce em certas condições). **Não verificado.**
- A etapa de cada aba não impede avançar: nada obriga preencher Pagamentos antes de Frete.
- Aba nova precisa entrar na lista de abas válidas de `useRouteTab`, senão o link cai na padrão.
- `valor_total` de várias P.I. em moedas diferentes: o embarque soma só as da moeda da primeira e **avisa** (aviso amarelo em Identificação e Pagamentos); guarda **um** Nº de cotação (o da primeira P.I. que tem).
- **Presença de carga = chegada real** (decisão do Gelson); o ETA vencido sem presença **não** vale como chegada (a Evolução mostra "estimado").

### 7.5.9 Testes
Unitários (linhas `test(`/`it(`, **Conferido**): `embarques-frete-calc.test.js` (6), `embarques-importacao-resumo.test.js` (5), `embarques-sugestoes-calc.test.js` (8), `rolagens-calc.test.js` (3). `npm test` em 31/10/2026: **931 passaram, 0 falharam**. e2e: `e2e/embarques-frete.spec.js` (nova cotação, totais, limite de 4, vencedora, trava, aba na URL) — **não rodei** (roda no CI). **Cenários de aceitação:** *Dado* 2 cotações de frete, *quando* marco uma vencedora e clico em outra, *então* só a última fica vencedora; *Dado* vencedora, *então* agente e frete ficam travados (testes do `embarques-frete-calc` e e2e).

### 7.5.10 Pendências e decisões
- **Não testado com dado real (Herdado):** upload de anexo de frete, envio real do pedido, resposta no Inbox e gravação das cotações com embarque salvo. As 4 decisões adotadas sem resposta do Gelson (total em USD; aprovação do frete manual; gravar no "Salvar"; agente da vencedora dispara `AGENTE_CARGA_DEFINIDO`) seguem pendentes de confirmação.
- Extrair os valores da resposta do e-mail para as taxas (hoje a pessoa digita).
- Formulário não abre por URL (F5 volta à lista).
- Tutoriais de Embarques/Mapa de Obras podem estar desatualizados (**Herdado**).

### 7.5.11 Histórico
Conectividade entre as abas em três ondas (30–31/10/2026, spec `2026-10-30-embarques-conectividade-abas.md`); formulário sempre visível (spec `2026-10-31-embarques-edicao-visivel.md`); frete em 29/10. Ver PC-11.

---

## 7.6 Rastreio Marítimo

### 7.6.1 O que é
A visão **logística** dos embarques em trânsito: lista com ETA e progresso, abas de documentos e aduana, o **Detalhe do embarque** (linha do tempo, posição do navio, aduana, datas) e o **Mapa de navios**. Lê o espelho `embarques`, atualizado pelo robô `ais-sync` (rastreio Sinay/Safecube). **Conferido** em `logistica.jsx` (`ImportacaoPage` linha 323, `ImportacaoDetail` 591, `ImportacaoRastreamento` 970).

**Fora do escopo:** o cadastro do embarque (7.5); o Inbox.

### 7.6.2 Rota e arquivos
Rotas `importacao` (`/gestao-importacao/importacao[/embarques|documentos|aduana]`), `importacao-detail` (`/gestao-importacao/importacao-detail/<id>`, **busca no banco pelo id**) e `importacao-rastreamento` (`/gestao-importacao/importacao-rastreamento`). Item de menu "Rastreio Marítimo". Arquivos: `src/logistica.jsx` (e `ais-sync` em `supabase/functions/ais-sync`). **Conferido** (`MAPA_DE_ROTAS.md`).

### 7.6.3 Perfil e acesso
Sem `restrict`/`RESTRICTED`/`temCapacidade`; alçada `importacao`. `embarques` é **aberta ao público** (PC-6). **Conferido.**

### 7.6.4 O que a tela mostra
**Lista** ("LOGÍSTICA · RASTREIO MARÍTIMO" / "Embarques em trânsito + rastreamento marítimo por AIS"): botões **Inbox**, **Mapa de navios**, **Novo embarque**; quadro **"Compras aguardando embarque (N)"** (compra confirmada sem embarque, com **Criar embarque**); cartões **Em trânsito**, **Aguard. liberação**, **Alertas ETA**, **Valor em trânsito**; abas **Embarques**, **Documentos & BL** (Embarque, Nº Invoice, BL, documentos anexados) e **Aduana** (Embarque, Canal, Status Siscomex, DI). Aba Embarques: filtros de status (Todos, Em trânsito, Aguardando liberação, Entregue), Porto, Linha, busca "Buscar embarque, cliente, navio, BL ou linha…"; tabela Embarque, Navio / BL, Rota, ETA ("antes: …" se mudou), Progresso, Aduana, Status. Clicar na linha abre o Detalhe.
**Detalhe:** botões **Voltar para Importação**, **Ver mapa**, **Email fornecedor** (desabilitado: "Em desenvolvimento"), **Reportar chegada**; cartões "Linha do tempo de eventos" (rastreio, com "Mostrar mais"), "Posição atual do navio" (mapa, **Atualizar**, aviso "Rastreio parado"), Documentos (`DocsCard`), "Navio & Container", "Invoice & Fornecedor", "Aduana" (alerta por canal), "Datas" (alerta "Atraso detectado") e "Trigger Financeiro" (texto: não existe gatilho financeiro; botão **Ver no Financeiro**).
**Mapa de navios:** **Voltar para Importação**, **Atualizar**, **Exportar relatório** (CSV), filtros de ETA (Todos, Próximos 7 dias, Próximos 30 dias, Atrasados (N)), cartões por grupo, painel "Detalhe" (Navio, Armador, BL / Container, ETA, "Situação do ETA", "Última leitura real", "Última tentativa do robô" com ⚠ depois de 26 h), **Mapa grande** e **Abrir embarque**.

### 7.6.5 Botões e controles
Listados em 7.6.4. **Reportar chegada** pede confirmação e faz três gravações: `embarques.chegada_confirmada_em` e **duas tarefas** (`tarefas`, módulos "Engenharia" e "Instalação", prioridade alta, `role: admin`).

### 7.6.6 Comportamento
**Realtime** na lista e no detalhe (assinatura em `embarques`, que está na publicação `supabase_realtime`); só rechama a leitura. "Atualizar" chama `ais-sync` na hora. O robô roda **1×/dia** (`ais-sync-daily`, 06:00 UTC) e **nunca simula posição** (06/10/2026): sem leitura real mantém a última e grava o motivo (`tracking_erro`). A lista **exclui embarques de teste** (`teste = false`).

### 7.6.7 Dados
Lê `embarques`, `dossier_obra` (cliente/obra), `cotacoes_elevador_fornecedor` (compras aguardando embarque); grava `embarques` (`docs`, `chegada_confirmada_em`) e `tarefas`; chama `ais-sync`. Cron `embarques-alerta-chegada` (10:50 UTC seg–sex) e `embarques-alerta-rastreio-diario` (10:40 UTC) geram avisos (**Conferido** o agendamento; o texto dos avisos **não** foi lido).

### 7.6.8 Regras e armadilhas
- **Duas tabelas de embarque** (`embarques` e `embarques_importacao`): a dos dados é a segunda; esta tela lê a primeira (espelho).
- O **botão "Email fornecedor" é um esboço desabilitado** e o cartão "Trigger Financeiro" diz que o gatilho não existe. **Achados.**
- Datas "verde/amarelo/vermelho" do canal são rótulos do embarque, não cálculo.
- ETA vencida **e** ETA adiada contam como "atraso" no filtro "Atrasados".

### 7.6.9 Testes
Sem teste de unidade da tela. As funções `rt*` (ETA, atraso) estão no próprio `logistica.jsx`, sem teste. Não rodei o e2e. **Cenário (sem teste):** *Dado* ETA anterior à data de hoje e embarque não entregue, *então* aparece "ETA vencida há N dia(s)".

### 7.6.10 Pendências e decisões
Atualizar a sobreposição entre esta tela, o Detalhe e o formulário de Embarques (7.5): a "Fase 2 da reorganização" citada no menu **não foi resolvida** (**Herdado**, comentário em `shell.jsx`). Habilitar ou retirar o botão "Email fornecedor".

### 7.6.11 Histórico
Pente fino do rastreio em 06/10/2026 (mapa real com Leaflet, nunca simula, exporta CSV); Realtime em 28/09 (**Herdado**).

---

## 7.7 Análise de Preços

### 7.7.1 O que é
Comparativo de preço **por item**, montado com o histórico das **RFQ antigas**: agrupa pelo nome do item e lista fornecedor, valor unitário, RFQ e data, marcando o **menor preço**. **Conferido** em `gestao-importacao-painel.jsx`.

**Fora do escopo:** análise de lotes de varejo; custo e margem (módulo 5).

### 7.7.2 Rota e arquivos
Rota `gi-analise-precos`; URL `/gestao-importacao/gi-analise-precos`; arquivo `gestao-importacao-painel.jsx` (`window.GIAnalisePrecosPage`). **Conferido.**

### 7.7.3 Perfil e acesso
Sem `restrict`, sem `temCapacidade`; alçada `gi-analise-precos`. **Conferido.**

### 7.7.4 O que a tela mostra
Cabeçalho **Análise de Preços** / "Comparativo de preços por item, a partir do histórico de todas as RFQs."; busca "Buscar por nome do item…"; um cartão por item ("N cotação(ões) de preço registrada(s)") com tabela Fornecedor, Valor unitário ("· menor preço" em verde), RFQ, Data (colunas ordenáveis). Vazio: "Nenhuma RFQ cadastrada ainda — a análise usa o histórico de preços cotados nas RFQs."

### 7.7.5 Botões e controles
Só a busca e a ordenação por coluna.

### 7.7.6 Comportamento
Agrupa por nome (sem acento/maiúscula não tratados além de `toLowerCase`); considera só preços numéricos; o "menor preço" é o mínimo real, mesmo ordenando por outra coluna.

### 7.7.7 Dados
Lê `RFQStore.listarTodas` (`rfq_importacao`). Não grava.

### 7.7.8 Regras e armadilhas
Item com nome escrito de duas formas (acento, plural) vira dois grupos.

### 7.7.9 Testes
Nenhum. **Cenário (sem teste):** *Dado* duas RFQ com o mesmo item "Rolete", *então* aparece um cartão com as duas cotações e a menor marcada.

### 7.7.10 Pendências e decisões
**Achado, sem correção:** a tela **fica vazia hoje** (`rfq_importacao` tem **0 linhas**) e **não usa as 41 respostas** dos lotes de varejo (`iv_cotacao_respostas`), que são o histórico real de preço de importação. Decisão do Gelson: alimentar a análise com `iv_cotacao_respostas`?

### 7.7.11 Histórico
Criada junto com o Painel (agosto/2026, **Herdado**); ordenação por coluna em 23/10/2026.

---

## 7.8 Catálogo Siscomex

### 7.8.1 O que é
O catálogo de **produtos (NCM)** e **operadores estrangeiros** do Portal Único Siscomex, usado na DUIMP, mais a geração de **pedidos a fornecedor**. Os produtos **vêm da Ficha Técnica** (a tela não cria produto). **Conferido** em `ncm-catalogo.jsx` (891 linhas).

**Fora do escopo:** o Kanban "Solicitações NCM" (mesmo arquivo, rotas `/engenharia/ncm-kanban` e `ncm-detail`, módulo 8); a Ficha Técnica (8); a função `ncm-duimp-assist` (assistente de DUIMP, módulo 8, **Não verificado** o uso).

### 7.8.2 Rota e arquivos
Rota `ncm-catalogo`; URL `/gestao-importacao/ncm-catalogo[/produtos|operadores|pedidos]` (a rota **não mudou** ao mudar de grupo: `/cadastros/ncm-catalogo` ainda abre). Arquivo `src/ncm-catalogo.jsx` (`NcmCatalogoPage`), `src/ncm-data.js`. **Conferido.**

### 7.8.3 Perfil e acesso
Sem `temCapacidade`. A alçada `ncm-catalogo` está mapeada em **dois grupos da sidebar** (`Suprimentos & Importação` e `Engenharia & Produto`, em `MODULOS_POR_GRUPO_SIDEBAR`). Tabelas `catalogo_produtos` e `operadores_estrangeiros` **abertas ao público**; `catalogo_produtos` também permite DELETE. **Conferido.**

### 7.8.4 O que a tela mostra
Cabeçalho **Catálogo Siscomex** / "Catálogo do Portal Único Siscomex — produtos e operadores estrangeiros usados na DUIMP. Cadastro obrigatório antes do registro da declaração." Abas **Produtos** (contagem), **Operadores estrangeiros**, **Pedidos a fornecedor**. Cartões de **Produtos**: Produtos ativos, Rascunhos, Desativados, NCMs distintas; de **Operadores**: Operadores ativos, Países, Desativados, Total. Busca "Buscar produto, NCM, código…" / "Buscar operador, país…", chips Todos/Ativados/Rascunhos/Desativados e a caixa "Mostrar arquivados (N)". Tabela de produtos (Produto, Código, Cód. interno, Versão, Situação) e painel de detalhe à direita (NCM, Descrição da NCM, Modalidade, CNPJ raiz, Unidade estatística, Código interno, "Detalhamento complementar", "Atributos da NCM", "Fabricantes / produtores"); tabela de operadores (Operador estrangeiro, País, Cidade, Código, TIN) e detalhe (País, Cidade, Logradouro, Subdivisão, Código postal, TIN, E-mail, CNPJ raiz, Código interno).

### 7.8.5 Botões e controles
Na aba Produtos o cabeçalho diz "📋 Produtos vêm da Ficha Técnica" (sem botão de novo). **Novo operador** (janela "Novo Operador Estrangeiro"); no detalhe do produto **Ativar**, **Gerar nova versão**, **Desativar**, **Reativar (nova versão)**, o lápis que abre a Ficha Técnica vinculada e a lixeira (**Excluir produto do catálogo**, janela com motivo); no detalhe do operador **Gerar nova versão**, **Desativar**, **Reativar (nova versão)**. Seleção múltipla de produtos → barra "N produtos selecionados" com **Limpar** e **Gerar pedido a fornecedor** (abre `PedidoBuilderModal` e `PedidoPreviewOverlay`).

### 7.8.6 Comportamento
Mudança de situação grava `VPLog` (módulo "Catálogo"). A exclusão de produto **apaga também as fichas técnicas vinculadas** (a janela lista as fichas; exige motivo).

### 7.8.7 Dados
Lê `catalogo_produtos` (**400 linhas**), `operadores_estrangeiros` (**3**), `fichas_tecnicas` (vínculo); grava as mesmas e os pedidos a fornecedor. O catálogo é **sincronizado da Ficha Técnica** (395 de 400 em 30/10, **Herdado**).

### 7.8.8 Regras e armadilhas
- **Achado grave, sem correção:** excluir um produto do catálogo faz `DELETE` em `catalogo_produtos` **e em `fichas_tecnicas`** (`delete().eq('produto_id', …)`). Fichas técnicas são **dados reais protegidos** (memória do projeto) e a policy de DELETE é aberta ao público. Há confirmação com motivo, mas nenhuma trava de alçada. **Conferido** no código.
- A leitura `select("*")` do catálogo não usa `.range()` (400 linhas hoje; corte em 1.000). **Achado.**
- **Não existe caminho de digitar produto direto** aqui (só pela Ficha Técnica); religar um botão "Novo produto" exige pedido.

### 7.8.9 Testes
Nenhum teste de unidade da tela. Não rodei o e2e. **Cenário (sem teste):** *Dado* um produto com ficha vinculada, *quando* confirmo a exclusão, *então* a janela lista a ficha e ambas são removidas.

### 7.8.10 Pendências e decisões
Travar a exclusão (alçada ou soft-delete) por causa das fichas técnicas — **decisão do Gelson**. O nome "Siscomex" no menu e "Catálogo" nos logs ("Catálogo") divergem (só texto).

### 7.8.11 Histórico
Renomeado e movido para Gestão Importação em 30/10/2026 (**Herdado**).

---

## 7.9 Importação Varejo

### 7.9.1 O que é
A tela de **reposição de estoque de revenda importada**: lista os ~1.800 produtos de importação do Omie com estoque, curva, mínimo/máximo sugeridos, tendência, Dia D, último fornecedor e preço, e deixa o comprador **pedir cotação** ou **comprar direto no Omie**. **Conferido** em `importacao-varejo.jsx` (1.044 linhas) e `importacao-varejo-store.js`.

**Fora do escopo:** o app de contagem física (`013_Estoque`); o Almoxarifado (módulo 12); a aprovação da compra (7.10); a P.I. (7.2).

### 7.9.2 Rota e arquivos
Rota `compras`; URL **`/logistica/compras`** (o menu mostra "Importação Varejo" mas o id e a URL são `compras`: "rótulo diferente do nome na URL"). Os modais "Lote de compra" e "Comprado" refletem a URL (`<ação>:<id>` no 2º segmento). Arquivos: `src/importacao-varejo.jsx`, `src/importacao-varejo-store.js`; Edge Functions em PC-7. **Conferido.**

### 7.9.3 Perfil e acesso
Sem `restrict`. **Esta é uma das duas telas do módulo que confere alçada:** `PropostaStore.temCapacidade('compras','criar')` libera os botões de gravação (selecionar, pedir cotação, comprar direto, sincronizar, editar endereço/contagem). Quem não tem só consulta. **Conferido** (`importacao-varejo.jsx:501`).

### 7.9.4 O que a tela mostra
Cabeçalho "LOGÍSTICA · IMPORTAÇÃO VAREJO" / **Importação Varejo** / "Estoque (sincronizado 4x/dia), vendas reais do Omie (atualizadas todo dia) e Sugestão de Compra dos produtos importados vendidos avulsos…". Alertas: "Erro ao consultar", "Catálogo vazio", "Contagens físicas indisponíveis", "N produto(s) com mercadoria por chegar" (**Ver quais**), "N produto(s) de venda esporádica aguardam revisão" (**Ver a fila**). **Cinco cartões:** Precisa comprar (clicável, filtra), Alerta (no mínimo) (clicável), Sugestão total, Curva D com estoque parado, **Valores a pagar (estimado)** (soma só os selecionados quando há seleção). Busca "Buscar por código, descrição ou fornecedor…", e chips: **Todas / Precisa comprar / Alerta / Ok**, **Curva A–D**, **⚑ Para revisar**, **⏰ Dia D**, **▲ Em alta**, **▼ Em baixa**, **📦 Comprado**, **🚢 A caminho**, **⚑ Chegou, falta a nota**, **Divergentes**, **Saldo não conferido**.
**Tabela "Produtos importados"** (cabeçalho fixo): caixa de seleção (marca todos os filtrados), Código, Descrição, Endereço, Curva, Físico, Reservado, Disponível, Contado, Acuracidade, **Mín. Omie, Mín. sug., Máx. sug.**, Pendente, Comprado, A caminho, Sugestão, Dia D, Tendência (12 meses) com gráfico, Último Fornecedor (selo "exterior"; selo "P.I." quando vem de P.I.), Último Preço Unit.; no rodapé do cartão "Estoque sincronizado em …, Giro/Curva calculados em …, Acuracidade da contagem …".

### 7.9.5 Botões e controles
No cabeçalho: **Sincronizar estoque agora**, **Forçar sincronização de catálogo/giro** (ambos só com alçada), **Atualizar**. Com itens marcados: **Pedir cotação (N)** (cria um **lote**, nada vai ao Omie) e **Comprar direto no Omie (N)** (janela "Enviar requisição de compra em massa", com fornecedor e preço editáveis por item e o valor total estimado). Por linha: editar **Endereço** (placeholder "ex.: R2I8 / R2H8 / H23", validado pela regra do galpão), digitar **Contado** ("contar"), editar mínimo/máximo e revisar ("Revisar lote de compra", com aprovar, ajustar ou "não repor" e motivo), lançar **Comprado**, configurar lote/múltiplo ("ex.: 700 (bobina)"), selo "em cotação" (clicável, abre o lote).

### 7.9.6 Comportamento
- **Carga em uma chamada** (`iv_compras_carga()` no banco: itens + contagens + sugestões + revisões + "a caminho" + mínimo do Omie); se falhar, cai sozinho no caminho antigo (Edge Function `list-importacao-varejo` + 5 consultas). **Não apague** a Edge Function antiga nem o caminho de reserva.
- **Regra de compra:** compra-se quando a **posição** (disponível + pendente + comprado + a caminho) ≤ **mínimo sugerido**; quantidade = **máximo − posição**, ajustada por lote/múltiplo. Produto de **confiança baixa** (vende em ≤ 2 dos 6 meses) **não gera compra** até ser revisado. Item sem giro mostra "sob demanda". Detalhes de cálculo em PC-4.
- **Contagem física** vale 30 dias: dentro do prazo o disponível = contado − reservado do Omie; vencida ou ausente, usa o Omie e marca "saldo não conferido".
- **Estoque** sincroniza 4×/dia (07h, 11h, 15h, 19h de Brasília); o botão "Sincronizar estoque agora" pede uma rodada extra.

### 7.9.7 Dados
Lê `importacao_varejo_produtos` (**1.883**), `_giro`, `_estoque`, `_fornecedor`, `_comprado` (**3**), `_lote_config`, `_revisao`, `_contagem` (**952**), `_sugestao_estoque` (**1.877**), `_mov` (12.130 estimadas; **sem política: só o servidor lê**), `iv_cotacao_lotes` (selo "em cotação"), `pi_importacao` (a caminho). Grava `_comprado`, `_lote_config`, `_revisao`, `_contagem` e `_contagem_hist`, `iv_cotacao_lotes/_itens` (ao pedir cotação). Escrita **no Omie** só na compra direta (`criar-requisicao-compra-importacao-varejo`, categoria `2.01.95`). **Doa para:** Requisição de Compra no Omie, alerta Dia D (Central de Notificações), app de contagem, 7.10.

### 7.9.8 Regras e armadilhas
- **Contrato com o app de contagem:** `importacao_varejo_contagem` e `_contagem_hist` são a ponte com o app externo; **não renomeie colunas**, código em MAIÚSCULAS (**Herdado**).
- **Nunca faça `select` sem paginação** nas tabelas `importacao_varejo_produtos/_giro/_estoque`: o banco corta em 1.000 linhas e produtos somem em silêncio (já aconteceu). Use `buscarTodasAsLinhas`/`.range()` (**Herdado**).
- Três sinais de preço diferentes: preço de **venda** (`estoque.preco_unitario`), **CMC** e **último preço pago** (`_fornecedor.preco_unitario`); só o último tem fornecedor junto. Pedido de Compra do Omie não carrega moeda: todo valor já vem em R$.
- A cobertura de fornecedor/preço é **parcial** (~275 de ~1.800 itens com fornecedor conhecido, **Herdado** de 12/10); o comprador preenche à mão o resto.
- A compra **não vira P.I. nem embarque** automaticamente quando é "direta"; só o fluxo de cotação gera P.I. (PC-2). "Comprado" só baixa pela previsão (+90 d, editável).
- Edição de **endereço** usa `validarEnderecoNovo`: endereço antigo gravado (ex.: "G13") passa; trocar por outro inexistente é recusado.

### 7.9.9 Testes
Unitários (**Conferido**): `importacao-varejo-contagem.test.js` (18 linhas `test`/`it`), `importacao-varejo-requisicao.test.js` (5). `npm test`: 931/931 passaram. Não rodei o e2e. **Cenários de aceitação:** *Dado* contagem com mais de 30 dias, *então* o saldo usa o Omie e o item aparece em "Saldo não conferido" (contagem); *Dado* envio ao Omie com erro em um fornecedor, *então* itens com erro **não** são registrados como comprados (requisição).

### 7.9.10 Pendências e decisões
- **Os 45 dias** de "criar o pedido" no Dia D são uma média informada, não medida (trocar por regra de calendário quando o Gelson definir). **Herdado.**
- Lacunas conhecidas (**Herdado**): a compra não vira P.I./embarque; o "comprado" não baixa quando a carga chega; nada com Prazos & Pendências/Decisões; `list-importacao-varejo` ainda calcula a sugestão antiga (o front a recalcula); `criar-requisicao-compra-importacao-varejo` pode ficar sem uso.
- **Migrations de `iv_alertar_dia_d` e dos crons de ruptura/alerta foram aplicadas só no banco, sem arquivo em `supabase/migrations/`** (**Herdado**, 13/10) — salvar se recriar o ambiente.
- Conferir a **1ª execução automática** dos crons de sugestão/ruptura/Dia D: o agendamento existe (PC-7); o resultado **não** foi lido.

### 7.9.11 Histórico
Nasceu em 30/09/2026 da limpeza de "Compras Nacional" (a casca vazia); depois ganhou cache de estoque, fornecedor/preço, contagem física, sugestão por consumo, ruptura, Dia D e cotação (12–16/10). Ver PC-11.

---

## 7.10 Cotações de Varejo

### 7.10.1 O que é
A lista dos **lotes de cotação** que o comprador pediu na Importação Varejo e o **mapa comparativo** (produto × fornecedor) onde ele escolhe vencedores e quantidades. Aprovar o vencedor **cria uma P.I. em rascunho por fornecedor** (nada vai ao Omie). O lote em si abre dentro de 7.3 (RFQ). **Conferido** em `cotacoes-varejo.jsx` (798 linhas), `cotacoes-varejo-store.js`, `cotacoes-varejo-calc.js` e `cotacao-varejo.html` (portal).

**Fora do escopo:** a Requisição de Compra no Omie (só na compra direta de 7.9); o Cadastro de Fornecedores (3.2).

### 7.10.2 Rota e arquivos
Rota `cotacoes-varejo`; URL `/logistica/cotacoes-varejo[/<lote>]` (com lote, **redireciona** para `/gestao-importacao/rfq-importacao/<lote>/comparar`). Portal público: `cotacao-varejo.html` + `src/cotacao-varejo-portal.jsx` (`/cotacao-varejo/<token>`). Arquivos: `src/cotacoes-varejo.jsx`, `-store.js`, `-calc.js`. **Conferido.**

### 7.10.3 Perfil e acesso
`PropostaStore.temCapacidade('cotacoes-varejo','criar')` libera as ações de gravação; **sem `criar` a página só lê**. Alçada `cotacoes-varejo`. Tabelas `iv_cotacao_*`, `fornecedor_avaliacoes`, `produto_fotos`, `produto_descricoes_exportacao`, `cambio_diario` **nascem fechadas** (só usuário ativo logado). O fornecedor fala só por funções com token. **Conferido.**

### 7.10.4 O que a tela mostra
**Lista:** "SUPRIMENTOS · COTAÇÕES DE VAREJO" / **Cotações de Varejo**, botão **Ir para Importação Varejo**, **Atualizar**, busca "Buscar por nº do lote, descrição ou quem criou…"; vazio: "Nenhum lote ainda. Na Importação Varejo, marque os produtos e clique em 'Pedir cotação'."
**Detalhe do lote (mapa):** cartão **Fornecedores convidados** (Dólar da cotação; por fornecedor E-mail / WhatsApp / Link, **Nova rodada**, **Substituir**, **Remover fornecedor**, NPS ★, "Convidar fornecedor cadastrado…" + **Convidar**; histórico de removidos), **Mapa comparativo** (busca "Buscar produto por código ou descrição…"; colunas Foto, Código, Descrição, Qtd. pedida, uma por fornecedor e **Comprar**; preço por faixa, prazo, MOQ, "Obs. do fornecedor", fotos; campo "Obs. VerticalParts (o fornecedor lê no portal)"; botão de descrição técnica EN/中文/PT com IA; "Total por fornecedor"). Janelas: **Pedir cotação ao fornecedor** (E-mail, WhatsApp, Copiar link), **NPS** (6 notas 0–5 + comentário + histórico), **Descrição técnica com IA** ("Ficha técnica / texto do fabricante (cole aqui — é a melhor fonte para a IA)", "O que a IA respondeu"), **Aprovar vencedor e pedir P.I.** ("Será criada … Nada vai ao Omie.").

### 7.10.5 Botões e controles
Em 7.10.4. Na aprovação: **Voltar** e o botão que confirma; **Cancelar lote** pede confirmação.

### 7.10.6 Comportamento
- **Fluxo (Herdado, spec de 25/10):** rascunho → em cotação (1º envio) → aprovado ou cancelado. Cada fornecedor **só do Cadastro** recebe link próprio e nunca vê os outros; responde com **preço por faixa** (até 3 na tela, 6 no banco), prazo, MOQ, observação e link de foto. **Nova rodada** reabre o convite e guarda o valor anterior em `historico`.
- **Decisão:** em cada célula o comprador digita a quantidade a comprar **daquele** fornecedor (divisão permitida; ★ = pedida); o preço aplicado é o da faixa da quantidade (`precoNaQuantidade`). Abaixo da 1ª faixa ou do MOQ, só avisa.
- **Aprovar:** cria **1 P.I. rascunho por vencedor** (`RASCUNHO-COTV-xxxx-n`, **sem Nº de cotação**), lança "Comprado" (+90 d, editável), pede a **Proforma** na tratativa em PT/EN/中文 (chinês de IA, revisar) e guarda em `lote.requisicoes`; **idempotente** por convite.
- **Quantidade "a definir"** (0, campo amarelo) **bloqueia o envio** ao fornecedor. **Dólar duplo:** PTAX do dia (`cambio_diario`) e dólar fixado no 1º envio; a resposta herda o dólar do dia por gatilho.
- Faixa de preço que **sobe** com a quantidade gera aviso (não bloqueia).

### 7.10.7 Dados
`iv_cotacao_lotes` (**20**), `_itens` (**38**), `_convites` (**22**), `_respostas` (**41**), `_decisoes`, `_tratativas`; `produto_fotos` (766), `produto_descricoes_exportacao`, `fornecedor_avaliacoes`, `cambio_diario`; grava `pi_importacao` (rascunho) e `importacao_varejo_comprado`. Portal: RPCs `public_ivc_obter/_visualizado/_responder`. Envio de e-mail pelo helper existente (área blindada). IA: `https://copiloto.vpsistema.com/perguntar` (Copiloto da VPS; `mode: 'chat'` + `novaConversa: true` **reinicia a conversa da bolinha** de quem pediu).

### 7.10.8 Regras e armadilhas
- Convite ou item removido é **soft-delete** (`removido_em`); o token do convite é trocado por gatilho (o link morre) mas o histórico fica visível em modo leitura.
- O comentário de cabeçalho de `cotacoes-varejo.jsx` ainda diz que aprovar manda a Requisição ao Omie; **o comportamento atual é a P.I. em rascunho** (a tela diz "Nada vai ao Omie."). Texto velho, **achado**.
- Existem **duas avaliações de fornecedor**: `fornecedor_avaliacoes` (NPS 0–5, novo) e `fornecedores_avaliacoes` (nota única, tela Avaliações do cadastro). Não unificadas.
- Texto de IA **nunca** é confiado sem revisão do comprador; a ficha colada **não é guardada**.

### 7.10.9 Testes
`cotacoes-varejo-calc.test.js` (8 linhas `test`/`it`; faixas, preço na quantidade, ordem das faixas). `npm test` 931/931. Não rodei o e2e. **Cenário:** *Dado* faixas 1–99 a US$ 10 e 100+ a US$ 8, *quando* compro 100, *então* o preço é US$ 8 (teste de `precoNaQuantidade`).

### 7.10.10 Pendências e decisões
Não testados com clique real (Herdado): criar lote → convidar → responder pelo portal → aprovar → P.I./Proforma; IA com ficha colada; NPS gravando; importar CSV. Em aberto: unificar NPS com `fornecedores_avaliacoes`; modo da IA sem memória; guardar a ficha por produto; Excel de verdade (hoje CSV); resposta por e-mail preencher o mapa; alerta de lote parado; foto do Omie.

### 7.10.11 Histórico
Criada em 16/10/2026 como "cotação antes da compra" e reformulada em 25/10/2026 (aprovar gera P.I.). Spec completa em `docs/superpowers/specs/2026-10-25-rfq-importacao-vencedor-pi/`.

---

## 7.11 Pedidos

### 7.11.1 O que é
Cadastro **manual** de acompanhamento de pedidos de compra, separado em **Nacional** e **Importação**: número, fornecedor, descrição, status, datas e valor. **Conferido** em `pedidos-acompanhamento.jsx` (157 linhas) e `pedidos-acompanhamento-store.js`. Tabela `pedidos_acompanhamento`: **1 linha**.

**Fora do escopo:** o Pedido de Compra do Omie (lido por 7.9); as compras internas do Almoxarifado (`pedidos_compra_varejo`, módulo 12); o "Pedido a Fornecedor" do Catálogo (7.8) e o RFQ de equipamento (4.3).

### 7.11.2 Rota e arquivos
Rota `pedidos-acompanhamento`; URL `/logistica/pedidos-acompanhamento[/Nacional|Importação]` (a aba vai na URL). Arquivos `pedidos-acompanhamento.jsx`, `-store.js`. **Conferido.**

### 7.11.3 Perfil e acesso
Sem `temCapacidade`; alçada `pedidos-acompanhamento`; tabela aberta ao público (com DELETE). **Conferido.**

### 7.11.4 O que a tela mostra
Cabeçalho "IMPORTAÇÃO · SUPRIMENTOS" / **Pedidos** / "Acompanhamento de status de pedidos de compra — Nacional e Importação."; abas **Nacional** e **Importação** (com contagem); busca "Buscar por nº, fornecedor ou descrição…" e filtro de status (Aberto, Em andamento, Recebido, Cancelado); tabela Nº pedido, Fornecedor, Descrição, Status, Data pedido, Previsão, Valor. Formulário "Novo pedido": Nº do pedido, Setor, Status, Fornecedor, Valor total, Moeda (BRL, USD, EUR, CNY, GBP), Data do pedido, Data prevista, Data de recebimento, Descrição, Observações.

### 7.11.5 Botões e controles
**Novo pedido** (já com o setor da aba); por linha **Editar** e **Excluir** (`confirm`); **Cancelar**, **Criar pedido** / **Salvar alterações**.

### 7.11.6 Comportamento
Nada é calculado nem emite evento; é uma planilha dentro do sistema. O formulário e o editar **não** ficam na URL.

### 7.11.7 Dados
Lê/grava `pedidos_acompanhamento`; sem integração com Omie, P.I. ou Embarques.

### 7.11.8 Regras e armadilhas
`remover` é `DELETE` físico, sem log. Três coisas se chamam "pedido" no sistema (esta tela, `pedidos_compra_varejo` e os pedidos de venda do PCP): confunde. **Achados.**

### 7.11.9 Testes
Nenhum. Não rodei o e2e.

### 7.11.10 Pendências e decisões
Decidir se a tela continua manual ou passa a ler os Pedidos de Compra do Omie (que já são lidos em 7.9).

### 7.11.11 Histórico
Citada no menu desde a primeira organização de Suprimentos (**Herdado**). 1 pedido em produção.

---

## Parte comum de Suprimentos & Importação

### PC-1 Mapa de ligações
- **Entra:** Cotação/Precificação/Proposta (4 e 5) → compra liberada (avais, 5.3/6.2) → **P.I.** (7.2). Estoque, vendas e NF do Omie → **Importação Varejo** (7.9). Cadastro de Fornecedores (3.2) → convites (7.10), P.I., Embarques, frete.
- **Sai:** Embarques → Rastreio (7.6), Evolução dos Equipamentos e Linha do Tempo (8 e 9), Prazos & Pendências (1.4). Importação Varejo → Requisição de Compra no Omie, alerta Dia D (Notificações), app de contagem. Cotações de Varejo → P.I. rascunho e "Comprado".

### PC-2 Do pedido de cotação ao embarque (ponta a ponta)
1. 7.9: o comprador marca produtos → **Pedir cotação** (lote `COTV`). 2. 7.3/7.10: convida fornecedores do Cadastro; eles respondem pelo portal; o comprador compara e **aprova**. 3. 7.2: nasce uma **P.I. em rascunho** por vencedor; o comprador informa o número real e os dados. 4. 7.5: a P.I. é **vinculada a um embarque**, com frete, rolagens, aduana e entrega. 5. 7.6: o navio é rastreado até a chegada. 6. O Omie recebe a **nota de importação** (o estoque só entra com a nota) e a 7.9 passa a ver o estoque. **Herdado** (spec de 25/10/2026 e `CLAUDE.md`); cada passo foi lido no código acima.

### PC-3 O Nº da cotação: equipamento × varejo
**Regra do Gelson (12/10/2026, Herdada):** P.I., RFQ e IMS **sem Nº de cotação são legítimos** (importação de varejo para suprir estoque não é equipamento). **Só equipamento entra pela cotação** (Nº informado → gate de compra, eventos e Prazos & Pendências). Não obrigue o Nº. O Nº, depois de gravado, **trava** na P.I.; ao ganhá-lo na edição, ele segue para o embarque vinculado e os eventos já cabíveis são emitidos.

### PC-4 Estoque, sugestão de compra e Dia D (regras de 7.9)
**Herdado** de `CLAUDE.md` (12–13/10/2026); a função `iv_calcular_sugestao_estoque()` e as colunas existem no banco (**Conferido** a tabela `importacao_varejo_sugestao_estoque`, 1.877 linhas), mas **não reconferi a fórmula**.
- **Demanda:** venda líquida (VEN+CVP+DVP+CDV), 6 meses completos, pico de mês limitado a 3× a mediana, média ponderada (últimos 3 meses peso 2); meses com ≥ 30% dos dias **sem estoque** têm a venda corrigida (ruptura).
- **Prazo:** o **p80 do histórico real** (produto ≥ 2 amostras; categoria ≥ 3; senão 90 d importado / 15 d nacional; "n" minúsculo no fim do código = nacional). **Atraso de decisão** de 50 d (45 + 5), só importados.
- **Segurança** z×σ×√(prazo/30) por curva (A 1,65 · B 1,28 · C 1,04 · D 0), zerada se vendeu em < 3 dos 6 meses. **Mínimo** = demanda diária × prazo + segurança; **máximo** = mínimo + demanda diária × 60 d.
- **Venda rara** só mantém estoque se o custo de manter 1 unidade até vender couber na margem (premissas 2% + 1% ao mês, margem padrão 30%, em `importacao_varejo_sugestao_config`).
- **Dia D** = hoje + (cobertura da posição em dias − prazo total); alerta diário seg–sex para curva A/B de confiança alta/média.
- **Premissas escolhidas por sessão do Claude** (2%+1%, 30%, 0,5, 60 d de ciclo) **não foram confirmadas pelo Gelson**; estão no banco e são editáveis.

### PC-5 Moeda, câmbio e totais
- P.I.: total gravado = itens + taxas aplicáveis na moeda da P.I.; transferências entre P.I. entram na % paga. Embarque: soma só as P.I. na moeda da primeira (avisa). Frete: total em **USD** (BRL só se não há USD).
- Cotações de Varejo: PTAX do dia e dólar fixado no 1º envio; Pedido de Compra do Omie vem em R$. **Não existe câmbio central** do módulo: cada tela usa o seu (`CambioAPI` e `cambio_diario`).

### PC-6 Identidade, alçadas e segurança
- **Estado real das políticas (Conferido, 31/10/2026, `pg_policies`):** `pi_importacao`, `rfq_importacao`, `ims_importacao`, `embarques_importacao`, `pedidos_acompanhamento` — leitura, inserção, atualização **e exclusão** abertas ao público. `embarques` — leitura, inserção e atualização abertas (sem DELETE). `catalogo_produtos` — as quatro abertas, **inclusive DELETE**. `operadores_estrangeiros`, `importacao_varejo_produtos` — leitura/inserção/atualização abertas. `importacao_varejo_comprado` — as quatro abertas. `importacao_varejo_sugestao_estoque` — só leitura. `importacao_varejo_mov` — RLS ligada **sem política** (só servidor). `iv_cotacao_*`, `fornecedor_avaliacoes`, `produto_fotos`, `produto_descricoes_exportacao`, `cambio_diario` — **só usuário logado**.
- **Alçadas:** só 7.9 e 7.10 conferem (`criar`). As demais telas dependem do menu. O e-mail do usuário vem do navegador (Art. 25): a trava na tela é organização, não segurança.
- Escrita real no Omie (Art. 30): somente a compra direta de 7.9, mediante clique e confirmação do comprador.

### PC-7 Gatilhos e rotinas
- **Crons (Conferido o agendamento em `cron.job`, 31/10/2026, UTC):** `ais-sync-daily` 06:00; `sync-estoque-omie-4x-dia` 10/14/18/22h; `sync-importacao-varejo-daily` 12:00 (catálogo/giro); `-fornecedor-diario` 02:00; `-vendas-diario` 03:10; `-prazo-pedidos-diario` 03:20; `importacao-varejo-prazo-real-diario` 03:25; `-ruptura-diario` 03:27; `-sugestao-estoque-diario` 03:30; `-alerta-dia-d` 03:40 (seg–sex); `sync-importacao-varejo-nf-importacao-diario` 04:00; `embarques-alerta-rastreio-diario` 10:40; `embarques-alerta-chegada` 10:50 (seg–sex). Se o resultado de cada um é correto: **Não verificado** (só o agendamento).
- **Gatilhos de banco:** `trg_embarques_status_chegada` (em `embarques`), `trg_iv_convite_removido` e `trg_iv_resposta_cambio` (cotação de varejo), `trg_estoque_mov_de_contagem` (livro-razão, módulo 12), `vp_valores_guarda` (em P.I., IMS e embarques_importacao: guarda de acesso a valores, **Herdado** — não li a função).
- **Edge Functions do módulo (Conferido ACTIVE):** `ais-sync` (v25), `sync-importacao-varejo` (v9), `-fornecedor` (v13), `-vendas` (v4), `-prazo` (v5), `-nf-importacao` (v1), `sync-estoque-omie` (v1), `list-importacao-varejo` (v10), `criar-requisicao-compra-importacao-varejo` (v6), `sync-pi-omie-pagamentos` (v7), `ncm-duimp-assist` (v27). Função **nova** fala com o banco por `fetch` + PostgREST (Art. 23); **não redeploye** as antigas sem comparar e testar numa cópia.

### PC-8 Tabelas
`pi_importacao` (31), `rfq_importacao` (0), `ims_importacao` (1), `embarques_importacao` (11), `embarques` (8), `pedidos_acompanhamento` (1), `catalogo_produtos` (400), `operadores_estrangeiros` (3), `importacao_varejo_produtos` (1.883), `_giro`, `_estoque`, `_fornecedor`, `_comprado` (3), `_lote_config`, `_revisao`, `_contagem` (952) e `_contagem_hist`, `_sugestao_estoque` (1.877), `_mov`, `iv_cotacao_lotes` (20), `_itens` (38), `_convites` (22), `_respostas` (41), `_decisoes`, `_tratativas`, `produto_fotos`, `produto_descricoes_exportacao`, `fornecedor_avaliacoes`, `cambio_diario`; `pedidos_compra_varejo` (0, módulo 12). Contagens **Conferidas** por `count(*)` em 31/10/2026. **Realtime:** só `embarques`.

### PC-9 Navegação, cache e testes
Regras de URL, `?v=` e testes: `01_geral.md` PC-9. Específico: aba por `useRouteTab` (P.I. e Embarques: aba/registro na URL; Embarques não abre o formulário pela URL); `compras` divide o 2º segmento em `<ação>:<id>`. `node scripts/check-cache-bust.js origin/main`: **ok** em 31/10/2026. `npm test`: **931 passaram, 0 falharam**. e2e: **não rodei**.

### PC-10 Menu "?" e tutoriais
Texto do "?" (`HELP_TOPICS` em `shell.jsx`) existe **só para** `cotacoes-varejo`, `ncm-catalogo` e `importacao`. **Não há texto de ajuda** para Painel, P.I., RFQ, IMS, Embarques, Análise de Preços, Importação Varejo nem Pedidos, e **não há tutorial** do módulo em `TreinamentoVP/` nem entrada de `TUTORIAIS` para estas rotas. **Conferido.** Tutorial não se edita à mão: pedir à sessão de tutoriais. Os textos de ajuda existentes (`ncm-catalogo` fala em "Solicitações NCM"; `importacao` fala em "Inbox") merecem revisão.

### PC-11 Documentos soltos e destino do que foi concatenado
| Arquivo / seção | O que é | Destino |
|---|---|---|
| `CLAUDE.md` — "Embarques de Importação — aba do formulário na URL" (29/10), "Embarques — aba Frete" (29/10, com o envio múltiplo), "Embarques — conectividade, Ondas 1 a 3" (30–31/10), "formulário de edição sempre visível" (31/10) | Embarques | **Concatenado em 7.5** (regras e pendências); a seção fica até o Gelson aprovar e decidir retirá-las |
| `CLAUDE.md` — "P.I. — Adicionar Taxas", "P.I. — transferência de pagamento", "P.I. — código do item puxa descrição" | P.I. | Concatenado em 7.2 |
| `CLAUDE.md` — "Importação Varejo": Curva ABC-D, estoque cacheado, cartões KPI, selecionar todos, fornecedor/preço, cruzamento com P.I., contagem física, mín./máx., ruptura e Dia D, ligações | Importação Varejo | Concatenado em 7.9 e PC-4 |
| `CLAUDE.md` — "Cotações de Varejo → RFQ → P.I." e "Cotações de Varejo — cotação antes da compra" | Cotações | Concatenado em 7.3, 7.10 e PC-2 |
| `CLAUDE.md` — "Catálogo Siscomex — renomeado e movido", "Compras Nacional — tela limpa" | Catálogo / histórico | Concatenado em 7.8 e 7.9.11 |
| `CLAUDE.md` — "Edge Functions: órfãs apagadas… como redeployar" | **Mista** (módulos 7 e 14) | **Fica**; nota de ponteiro quando o Gelson autorizar. Divergência de `sync-pi-omie-pagamentos` em 7.2.8 |
| `CLAUDE.md` — "Estoque — organização, menu Fabricação, carga única…" e "Auditoria de amarrações" (itens 4 e 12) | **Mista** (7 e 12; 7 e 4/5) | Ficam; o que é de 7 está em 7.9 e PC-3 |
| `CLAUDE.md` — "Realtime (28/09)" | Mista (1, 4, 7, 9) | Fica; a parte de Embarques está em 7.6 |
| `docs/superpowers/specs/2026-10-25-rfq-importacao-vencedor-pi/` (6 arquivos) | Spec completa do fluxo cotação → P.I. | **Histórico dentro do módulo** (7.10.11); fica onde está |
| `docs/superpowers/specs/2026-10-30-embarques-conectividade-abas.md`, `…-31-embarques-edicao-visivel.md` | Specs de Embarques | Histórico (7.5.11); ficam |
| `docs/superpowers/specs/2026-10-31-mapa-de-destino-docs-soltos.md` | Mapa de destino geral | Já aponta estes três para o módulo 7 |
| `docs/MAPA_DE_ROTAS.md` | Gerado | Fonte das URLs (Conferido) |
| `docs/seguranca/matriz-acesso-rls.md` | Matriz de RLS | Do módulo 15; PC-6 traz o estado destas tabelas |
| `docs/superpowers/specs/2026-10-17-modulo-etiquetas-design.md` | Etiquetas (recebimento por P.I.) | Módulo 12; **não copiado** |
| `docs/PROJETO_INCRIVEL.md`, `.claude/2026_08_20_relatorio.md`, `docs/relatorios/2026_05_29_relatorio.md` | Citam importação/embarque | **Não li por inteiro**; histórico, ficam. **Não verificado** se trazem algo vivo |
| `supabase/functions-removidas/` | Backups de funções apagadas | Histórico; não redeployar |
Nenhum arquivo foi apagado. **Parece obsoleto (decisão do Gelson):** o comentário de cabeçalho de `cotacoes-varejo.jsx` (aprovar = Requisição ao Omie) e o `console.log` "PI PAGE LOADED - v13".

### PC-12 Benefícios trocados com os outros módulos

- **Recebido de Quadros de Comando (04/11/2026, texto em `14_quadros_comando.md` PC-12, Art. 49):** (a) o Omie repete a linha do item com **quantidade 0** — somar por código e ignorar o zero antes de contar linhas ou unidades; (b) **metro e peça nunca se somam** — total por unidade de medida; (c) a caixa de uma tabela longa deve ter a **altura da janela**, para a barra de rolagem lateral ficar à vista; (d) função de banco nova se testa **numa transação que se desfaz**, incluindo um usuário ativo **sem** a alçada (a recusa por "sem sessão" não prova a trava de alçada); (e) a **observação do item** do pedido do Omie (`pcp_pedido_itens.obs_item`) guarda o que a proposta mostra dentro do item. **Conferido** (04/11/2026).
- **Recebido:** o método de achados "linha zerada ≠ defeito" e a conferência de **nome de alçada** × política do banco (de 6); o cuidado de **paginar** leituras acima de 1.000 linhas (do Geral/CRM); o selo de verificação em tudo; "rótulo do menu ≠ nome na URL" (`compras`, `importacao`).
- **Doado** (texto completo aqui; os outros apontam): (1) **leitura que falha vira zero em silêncio** (`catch → []`), como no Painel (7.1.8): vale conferir nas telas de leitura dos outros módulos; (2) **exclusão em cascata de dado protegido** (excluir produto do catálogo apaga a ficha técnica, 7.8.8): procurar `delete()` em cadeia; (3) **duas fontes da mesma coisa** (`embarques`/`embarques_importacao`; RFQ antiga × lote; duas avaliações de fornecedor): registrar qual manda; (4) **comentário de código que contradiz o comportamento** (7.10.8): procurar nos módulos; (5) **telas que leem só a tabela antiga e ficam vazias** (7.1.10, 7.7.10). Registrado nos documentos 1 a 6.
- **Recebido de Engenharia & Produto (01/11/2026, texto em `08_engenharia_produto.md` PC-12):** a exclusão da Ficha Técnica apaga também a linha do catálogo (mesma tabela de 7.8) com `DELETE` físico aberto ao público; o selo "avais OK" depende do Projeto de Instalação assinado (8.1); a foto das Cotações de Varejo (7.10) vem da Ficha. Mesmos padrões de achado: coluna inexistente no payload, alçada declarada e não lida, filtro com valor antigo.
- **Recebido de Obras & Instalação (01/11/2026, texto em `09_obras_instalacao.md` PC-12):** a Evolução dos Equipamentos (9.5) liga cada equipamento ao embarque pelo **Nº da cotação** e, nas obras antigas, **temporariamente** pelo nº de série da P.I.; usa a **presença de carga** como chegada real, as rolagens de ETD e o histórico de ETA do embarque (7.5). Mudar esses campos muda a Evolução. **Conferido** no código.
- **Recebido de Entrega & Documentação (01/11/2026, texto em `10_entrega_documentacao.md` PC-12):** os nós `PAGAMENTO_1_SOLICITADO` e `PAGAMENTO_1_CONFIRMADO` (pagamento da P.I.) caem no ramo padrão **"Comercial"** em `_evt_modulo_etapa`; conferir se é a intenção. O **fato** foi **Conferido** (função no banco comparada com os nós do motor, 01/11/2026); a **intenção**, **Não verificada**.
- **Recebido de Parceiros & Instaladores (01/11/2026, texto em `11_parceiros_instaladores.md` PC-12):** nada específico de Suprimentos & Importação; vale o bloco do `01_geral.md`.
- **Recebido de Logística Interna (01/11/2026, texto em `12_logistica_interna.md` PC-12):** a **Compras** (7.9) e o Almoxarifado leem o **mesmo** sincronizador de estoque e gravam a contagem na **mesma** tabela; "a caminho" é o que falta chegar nos pedidos de compra (não o `nPendente` do Omie); a Reposição do Almoxarifado (consumo × prazo) e a sugestão da Compras (venda) são contas diferentes — decidir qual manda é pendência do Gelson (12.1.10). **Conferido** no código, 01/11/2026.
- **Recebido de Fabricação (01/11/2026, texto em `13_fabricacao.md` PC-12):** a Necessidade e a Reposição (12.1) leem a estrutura e a carteira que o PCP (13.1) mantém; a regra de matéria-prima `VPMP%` é única. **Herdado.**
- **Recebido de Administração (01/11/2026, texto em `15_administracao.md` PC-12):** o bucket `engenharia` (que guarda anexos de embarque e P.I.) segue **público**, contra a decisão D4 do plano de segurança. **Conferido** em `storage.buckets`.
- **Recebido de Serviços (01/11/2026, texto em `16_servicos.md` PC-2):** todo alerta com destinatário também vira WhatsApp pelo gi-avisos; para chegar certo, título curto com o essencial na frente, sem "teste", sem R$ no título e com o dia da semana por extenso, a obra ou o código do contrato quando houver vários no mesmo dia (o agrupamento de 24 h apaga números). **Conferido** no código do gi-avisos.
