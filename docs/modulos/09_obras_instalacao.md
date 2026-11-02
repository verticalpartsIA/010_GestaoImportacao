# 9 Obras & Instalação — documento do módulo (REAL, fonte da verdade — 01/11/2026)

> **Status: REAL (documento oficial do módulo 9), aprovado pelo Gelson em 01/11/2026**, no molde de `01_geral.md` a `08_engenharia_produto.md`. Histórico de entrega (PR, hash, `?v=`) não se repete aqui: o Git guarda.
>
> **Por que este módulo pede cuidado:** é onde a obra **acontece** depois do contrato — o Dossiê da Obra (o "prontuário" de cada obra), a vistoria no celular do técnico, a instalação pelo montador, o mapa e a ART. Quase todas as tabelas daqui estão abertas à chave pública (PC-6), a Evolução dos Equipamentos **cobra pessoas por WhatsApp** (PC-7) e o código da obra (`codigo_obra`) é o identificador que a ART e outros módulos citam.
>
> **Fonte da verdade:** o código e o banco, conferidos em 01/11/2026 (`origin/main` `fed8e4a`). **Conferido** = lido no código ou consultado no banco (só SELECT) nesta data; **Herdado** = veio do `CLAUDE.md`, de uma spec ou do documento de outro módulo e **não** foi reconferido; **Não verificado** = não consegui conferir (e o texto diz). Sem selo vale como Não verificado.
>
> **Escopo do módulo:** as **seis** telas do grupo "Obras & Instalação" do menu (`NAV_GROUPS` em `shell.jsx`): **Dossiês de Obras**, **Vistorias de Obras**, **Resultado Vistorias de Obras**, **Instalação em Campo**, **Mapa de Obras** (com a aba Evolução dos Equipamentos) e **ART**. Pertencem a elas, sem item de menu: o **Dossiê da Obra** (detalhe, `dossier-obra`) e as páginas públicas **Diário de Obra**, **Status da Obra** e **Execução da Vistoria** (PC-3). **Não são deste módulo:** Cronograma de Pagamento da Instalação, Pagamentos a Instaladores, Contrato Instalador, Empresas Instaladoras e Homologação (11); Central de Documentos, Data Book, Entrega Final e Repositório Documentos (10); a Linha do Tempo da Cotação (8.5, que **lê** o Dossiê); o Projeto de Instalação assinado (8.1); a Fabricação (13).
>
> **Onde moram arquivos que não têm nome óbvio (Conferido):** "Dossiês de Obras" é a lista `ObrasStatusPage` **dentro** de `dossier-obra.jsx` (não existe `status-obras.jsx`); "Instalação em Campo" é `InstalacaoPage` dentro de `operacoes.jsx` (que ainda guarda código do Hub Engenharia e do Jurídico antigo, 8 PC-3); o "Diário de Obra" é `diario-obra-app.jsx` + `acompanhamento-obra-store.js`; "Resultado Vistorias" é `vistorias-obras.jsx`; a vistoria no celular é `vistoria-execucao.jsx`.

## Como esta numeração funciona
- A regra de numeração (móvel, como cláusula de contrato) e os 11 temas de cada tela moram **uma vez só**, em `docs/modulos/01_geral.md`. Aqui vale a mesma: módulo = **9**; telas filhas = **9.1 a 9.6**, na ordem do menu; o conteúdo comum fica na **Parte comum** (PC-), sem número de tela.
- **Tudo o que é janela, aba, gaveta ou assistente de uma tela pertence a ela.** No 9.1 estão a lista, o Dossiê aberto com as nove abas e as janelas de endereço, pausa, análise técnica e avanço de status; no 9.2 as três abas (Questionários, Despacho, Calendário) e a página pública do celular; no 9.5 as abas Mapa e Evolução.
- Mudou algo? Escreva no tema certo da tela e **reescreva o Índice e o Glossário** na mesma sessão.

## Índice
9. **Obras & Instalação**
   9.1 Dossiês de Obras (lista; Dossiê da Obra com nove abas; Diário de Obra e Status da Obra públicos) · 9.2 Vistorias de Obras (Questionários, Despacho, Calendário; execução no celular) · 9.3 Resultado Vistorias de Obras · 9.4 Instalação em Campo · 9.5 Mapa de Obras (Mapa; Evolução dos Equipamentos) · 9.6 ART
   &nbsp;&nbsp;&nbsp;Cada tela tem os temas: x.1 O que é · x.2 Rota e arquivos · x.3 Perfil e acesso · x.4 O que a tela mostra · x.5 Botões e controles · x.6 Comportamento · x.7 Dados (lê/grava) · x.8 Regras e armadilhas · x.9 Testes · x.10 Pendências e decisões · x.11 Histórico
   Parte comum de Obras & Instalação (sem número de tela)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações · PC-2 O fluxo da obra de ponta a ponta · PC-3 Rotas, páginas públicas e código sem item de menu · PC-4 Código da obra e identificadores · PC-5 Cobrança, pausa e avisos automáticos · PC-6 Identidade, alçadas e segurança · PC-7 Gatilhos, eventos, crons e funções · PC-8 Tabelas · PC-9 Navegação, cache e testes · PC-10 Menu "?" e tutoriais · PC-11 Documentos soltos e destino do que foi concatenado · PC-12 Benefícios trocados com os outros módulos
10. Entrega & Documentação → `10_entrega_documentacao.md` (REAL)

## Glossário (módulo Obras & Instalação)
Termos gerais (alçada, soft-delete, alerta, Nº da cotação, evento de fluxo) estão em `01_geral.md`; **Aval Engenharia** em `05_financeiro_precos.md` e `08_engenharia_produto.md`; **Contrato Instalador** e assinatura em `06_contratos_juridico.md`. Não se repetem aqui.
- **Dossiê da Obra:** o registro central de uma obra (`dossier_obra`): cliente, prédio, endereço, status mestre (12 etapas), equipamentos, documentos, pendências, responsáveis e histórico. Id `DOS-…`.
- **Status mestre:** a posição do Dossiê no fluxo `Lead qualificado → … → Manutenção preventiva` (12 valores). **Não** é o avanço da instalação em campo (esse é o Acompanhamento de Obra).
- **Código da obra (`codigo_obra`):** o identificador gravado e imutável da obra: `VPNI-<cotação>` (obra nativa) ou `VPNI-OB<NNNN>` (obra legada). É o que a ART cita (PC-4).
- **Equipamento da obra:** uma linha de `equipamentos_obra` (nº de série, datas previstas × reais de chegada, início e término, instalador). Um Dossiê tem vários.
- **Elenco (roster) de instaladores:** os montadores vinculados à obra (`dossier_obra_instaladores`), além do instalador principal do Dossiê.
- **Acompanhamento de Obra (Diário de Obra):** o checklist de atividades que o **montador** flega num link público; é o que dá o % de avanço da instalação.
- **Cronograma de Instalação:** o checklist por template (`instalacao_checklist_*`), outra lista de itens por obra (hoje sem uso real).
- **Vistoria / atividade:** um questionário despachado a um técnico para uma obra e um equipamento, com link no celular (`vistorias_atividades`).
- **Pausa de obra:** prazo (até 60 dias) em que uma obra legitimamente parada deixa de ser cobrada na Evolução (PC-5).
- **Obra legada:** Dossiê `DOS-M0NN` vindo da planilha antiga, **sem** Nº de cotação.
- **ART:** Anotação de Responsabilidade Técnica da instalação; **uma por obra** (9.6).

---

## 9.1 Dossiês de Obras

### 9.1.1 O que é
A **lista de todos os Dossiês** e, ao clicar, o **Dossiê da Obra** (rota `dossier-obra`): o prontuário da obra, com nove abas. É onde se vê em que etapa a obra está, quem responde por ela, o que está pendente, os equipamentos com nº de série, os documentos e o histórico. **Conferido** em `dossier-obra.jsx` (2.235 linhas) e `dossier-store.js` (546), 01/11/2026.

**Fora do escopo:** a vistoria em si (9.2/9.3); a posição no mapa (9.5); a ART (9.6); a assinatura do Contrato Instalador e os pagamentos (11); Termo de Entrega e DataBook como documentos de entrega (10, aqui só aparecem como itens do checklist de documentos).

### 9.1.2 Rota e arquivos
- Lista: `status-obras`, URL `/engenharia/status-obras`; **filtro de status e busca vão na URL** (`?status=…&q=…`, `useQueryParam`). Dossiê: `dossier-obra`, URL `/engenharia/dossier-obra/<id>[/<aba>]` (a aba vai na URL com `replace`, sem encher o Voltar). **Conferido.**
- Arquivos: `src/dossier-obra.jsx` (`ObrasStatusPage`, `DossierObraPage` e as abas), `src/dossier-store.js` (`window.__DOSSIER`), `acompanhamento-obra-store.js`, `instalacao-checklist-store.js`, `instalacao-obra-store.js`. A rota `dossier-obra` não tem item de menu. O título da aba do navegador vira "<obra> · <aba>".

### 9.1.3 Perfil e acesso
A lista e o Dossiê **não chamam `temCapacidade`** para ver ou editar; a alçada `status-obras` existe no catálogo e não é lida. Só duas ações são conferidas na tela: **`mapa-obras.pausar`** (botão "Pausar obra") e **`instalacao.editar_status_obra`** (flegar/desflegar na aba Acompanhamento). **Conferido.**

### 9.1.4 O que a tela mostra
- **Lista:** "OBRAS & INSTALAÇÃO · DOSSIÊS DE OBRAS", busca ("cliente, instalador, obra, nº de série…"), filtro por status (Todos + os 12) e tabela Obra Nº · Prédio/Obra · Cliente · Equipamento · Local · Status (com bolinha colorida) · Criado em · Abrir. O clique na linha abre o Dossiê.
- **Dossiê, cabeçalho azul:** prédio, "Obra Nº" (só quando há Nº de cotação), cliente, endereço (ou "Endereço da obra não informado") e tipo de equipamento; botões **Informar/Editar endereço** e **Pausar obra** / **Ver/renovar pausa**; selo "⏸ Pausada até dd/mm" quando vigente; "Vinculado à Proposta X" ou "Sem Proposta correspondente (obra órfã)"; ID do Dossiê, data, **barra "Etapa do dossiê no fluxo"** (posição no `STATUS_FLOW`). Abaixo, o **Status Mestre**.
- **Nove abas:** Visão Geral · Documentos · Instalação · Equipamentos · Cronograma de Instalação · Acompanhamento de Obra · Pendências · Responsáveis · Histórico.

### 9.1.5 Botões e controles
- **Visão Geral:** cartão "Situação" (BLOQUEADO / N PENDÊNCIAS / SEM BLOQUEIOS), campo de **vínculo manual com o Cadastro de Clientes**, **Análise Técnica** (Iniciar / Continuar / Ver; abre o assistente) e **Próximo passo** → janela **Avançar status**.
- **Documentos:** checklist de 10 tipos (ART, Termo de Vistoria, DataBook, Termo de Entrega obrigatórios; Alvará, Contrato Instalador, NRs, ASO, PCMSO/PGR, Cronograma opcionais); enviar arquivo (na ART pergunta o **valor em R$**); painel do **Termo de Entrega** (self-service).
- **Instalação:** checklist "obra pronta" (recebimento do equipamento, quem recebeu, quantas pessoas, andaime/munck) e vínculo do montador.
- **Equipamentos:** cartões por equipamento (nº de série, datas previstas × reais, instalador), **+ Adicionar equipamento**, excluir, e a lista dos equipamentos **dos outros Dossiês do mesmo cliente**; elenco de instaladoras da obra (**+ Vincular empresa**).
- **Cronograma de Instalação:** **criar cronograma** por template, **✓ Concluir / Desmarcar / N/A / Reativar** por item, **+ Adicionar item ao template**, e dois links: **🔗 Link público (Cliente)** e **🔒 Link interno (VerticalParts)** (página Status da Obra).
- **Acompanhamento de Obra:** **gerar link do montador** (`/diario-obra/<token>`, copia para a área de transferência), lista de atividades flegadas e **Desflegar** (pede confirmação; o link do montador reflete na hora).
- **Pendências:** adicionar (tipo, descrição, etapa, bloqueante) e resolver. **Responsáveis:** atribuir responsável por etapa. **Histórico:** passagens de status.

### 9.1.6 Comportamento
- **Como nasce um Dossiê:** pelo **Lead** ("Qualificar → Dossier", `criarDeDossier`, id `DOS-` + 6 dígitos do relógio) ou pela **Proposta assinada** (`criarDeProposta`: grava `proposta_id`, `cliente_id`, `lead_id`, **adota** o Dossiê do Lead que ainda não tem cotação em vez de criar um segundo, e só completa vínculos que faltam, nunca sobrescreve). Evento `DOSSIE_CRIADO`. **Conferido.**
- **Avançar status** (`atualizarStatus`): só aceita valor do `STATUS_FLOW`; grava `dossier_history` e, ao entrar em **Instalação**, emite `INSTALACAO_INICIADA`; ao entrar em **DataBook**, `INSTALACAO_CONCLUIDA`. **O status é manual**: nada o avança sozinho.
- **Endereço** (`atualizarEndereco`): CEP preenche só campos vazios; o número é sempre digitado; ao mudar o endereço, um gatilho do banco **apaga a posição** (latitude/longitude) para o mapa localizar de novo (PC-7). **Pausa** (`pausarObra`): chama a função `evolucao_pausar_obra`; prazo de **hoje a 60 dias**, motivo ≥ 10 letras, só quem tem a alçada; renovável.
- **Elenco de instaladores:** o instalador principal (`parceiro_instalador_id`) e a lista do elenco são **duas fontes** que o Mapa e a Instalação em Campo unem (9.4, 9.5).
- A aba **Acompanhamento** lê `acompanhamento_obra_status` (323 linhas), `_lancamentos` (62) e `_links` (20); o **marco de 50%** da instalação emite `INSTALACAO_METADE_EXECUCAO`. **Conferido** (nome do evento no código; contagem no banco).

### 9.1.7 Dados
- **Lê/grava:** `dossier_obra` (**68 linhas**), `equipamentos_obra` (**65**), `dossier_documentos` (**76**), `dossier_pendencias` (**6**, 3 abertas), `dossier_responsaveis` (**33**), `dossier_history` (**144**), `analise_tecnica` (**3**), `dossier_obra_instaladores` (**2**), `dossier_obra_pausas` (**0**), `instalacao_checklist_itens` (**560**) e `_templates` (**28**), `instalacao_cronograma` (**0**), `acompanhamento_obra_*`. **Lê:** `propostas`, `parceiros_instaladores`.
- **Por status** (68 Dossiês): Homologação instalador **19**, Instalação **16**, Contrato assinado **9**, Análise técnica **7**, Manutenção preventiva **4**, DataBook **4**, Entregue **3**, Dossier criado **3**, Importação **3**. **Conferido** por SELECT, 01/11/2026.
- Dos 68: **1** tem `numero_cotacao` (a obra nativa 955); **41** códigos de obra distintos; **50** sem `cliente_id`; **29** sem endereço; **30** com posição no mapa; 2 equipamentos sem nº de série; 41 documentos do tipo ART. **Conferido.**

### 9.1.8 Regras e armadilhas
- **O status mestre é manual e independe da instalação:** a barra do cabeçalho mede a posição no fluxo, **não** o avanço em campo (o texto da dica diz isso). **Conferido.**
- **`client_name` é texto livre** (veio da planilha) e quase nunca bate com o Cadastro; o vínculo é manual (campo na Visão Geral). Hoje **50 de 68** não têm vínculo, e por isso a "Vida do Cliente" (3.1) só acha obra de quem tem. **Conferido.** O Dossiê **nunca é excluído** (não há política de DELETE na tabela); o equipamento e o item do elenco **são apagados de verdade** (`excluirEquipamento`, `removerInstaladorRoster`; Art. 27 e PC-6).
- **Achado, sem correção — texto enganoso:** o cartão "Situação" mostra "**BLOQUEADO** — Pendência bloqueante resolvida" quando há pendência bloqueante **aberta**; a frase fala em "resolvida" e o estado é o oposto. **Conferido** no código (`TabVisaoGeral`).
- **Achado, sem correção — nome do identificador:** o código chama a fórmula de "VPOB-<cotação>" em comentários e em `veVpobLabel`, mas devolve o `codigo_obra` gravado (`VPNI-…`) quando existe; a tela mostra, portanto, `VPNI-`, não `VPOB-`. **Conferido.** Qual nome vale é **decisão do Gelson**.
- **Achado — lista sem paginar:** `listar()` e a consulta de séries não usam `.range()`; com 68 linhas não pesa, mas o teto de 1.000 do PostgREST cortaria em silêncio (Art. 9). A tela só avisa erro geral.
- **Achado — aba da URL:** a aba inicial vem da URL (`parseLocation().tab`) e **não é validada** contra a lista; aba desconhecida deixa o conteúdo em branco. **Conferido** no código; não reproduzi.
- A aba **Cronograma de Instalação** tem **0 linhas** em `instalacao_cronograma` mas usa `instalacao_checklist_itens` (560); são duas estruturas com nomes parecidos. **Conferido** no banco.
- `listarEquipamentosDoCliente` casa por **nome do cliente** (texto), então grafia diferente separa obras do mesmo cliente. **Conferido.**

### 9.1.9 Testes
`dossier-store` não tem teste de unidade; há `instalacao-obra-store.test.js`, `instalacao-campo-calc.test.js`, `evolucao-conferir-calc.test.js` e `mapa-obras-calc.test.js` para peças vizinhas. e2e: **não rodei** (a rota entra no teste de fumaça do CI). `npm test`: **931 passaram, 0 falharam** (01/11/2026). **Cenários de aceitação:** *Dado* um Dossiê em "Contrato assinado", *quando* avanço para "Instalação", *então* o histórico ganha a linha e o evento `INSTALACAO_INICIADA` é emitido — **sem teste**. *Dado* uma pausa de 90 dias, *quando* salvo, *então* a função recusa — **testado no banco** (transação desfeita, 25/10/2026, **Herdado**), sem teste automatizado.

### 9.1.10 Pendências e decisões
**Decisão do Gelson:** (1) o nome oficial do código da obra na tela (`VPNI-` ou `VPOB-`); (2) o status mestre continua manual ou passa a avançar com os eventos (contrato assinado, equipamento recebido); (3) vincular os 50 Dossiês sem `cliente_id` (é dado, não código); (4) corrigir o texto do cartão "Situação". Tutorial e "?" (PC-10).

### 9.1.11 Histórico
Dossiê criado no início do projeto (obras legadas `DOS-M0NN` vieram da planilha); equipamentos da obra em 19/08/2026; Acompanhamento de Obra e Diário de Obra públicos em outubro; endereço completo e posição em 19/10; `codigo_obra` gravado em 29/10; pausa de obra em 25/10/2026. **Herdado.**

---

## 9.2 Vistorias de Obras

### 9.2.1 O que é
O **motor de vistorias**: o Engenheiro monta **questionários** (categorias → perguntas, com ramos condicionais), **despacha** uma vistoria a um técnico para uma obra e um equipamento — gerando um **link para o celular** — e acompanha tudo num **calendário**. O técnico responde pelo celular na página pública (9.2.6) e o resultado cai no 9.3. **Conferido** em `vistorias-envio.jsx` (1.082 linhas), `vistorias-questionarios-store.js` (478) e `vistoria-execucao.jsx` (668), 01/11/2026.

**Fora do escopo:** o resultado e o PDF da vistoria (9.3); as três vistorias "inclusas" do progresso (9.3); o Termo de Vistoria como documento (9.1 e 10).

### 9.2.2 Rota e arquivos
Rota `vistorias-envio`; URL `/engenharia/vistorias-envio[/questionarios|/despacho|/calendario[/<id>]]` (**aba** na URL com `useRouteTab`, padrão `despacho`; questionário aberto e atividade aberta por `useRotaItem`). Página do técnico: `/vistoria/<token>` (`vistoria-execucao.html`, servida por `server.js`). Bucket de fotos e assinaturas: `vistorias-anexos`. **Conferido.**

### 9.2.3 Perfil e acesso
Sem `restrict` e **sem `temCapacidade`** nas três telas; a alçada `vistorias` existe no catálogo (sem ações próprias) e não é lida. A página `/vistoria/<token>` é pública: o token é a credencial. **Conferido.**

### 9.2.4 O que a tela mostra
- **Questionários:** lista dos questionários (14), **Novo questionário** (nome e tipo) e o **editor** (categorias, perguntas, ordem com ↑↓, editar, excluir, regra condicional por pergunta anterior).
- **Despacho:** formulário (obra, equipamento, questionário, técnico, data, paradas e **medidas do projeto**, nº de WhatsApp) e a **lista de despachos** com status Pendente / Em execução / Concluída / Cancelada, link, **Trocar vistoriador** e excluir. Opção de preencher pelo **Master ID** (digita o código da obra e a tela hidrata os dados).
- **Calendário:** mês a mês, com as atividades por dia (domingo a sábado) e janela de detalhe.
- **Página do técnico:** perguntas por categoria e por pavimento, foto com anotação, assinatura desenhada, "marcar tudo como Conforme / Não se aplica".

### 9.2.5 Botões e controles
Novo/editar/excluir questionário, categoria e pergunta; reordenar; **Despachar** (cria a atividade + link; envio por `wa.me`); **Trocar vistoriador e reenviar**; **Excluir atividade**; navegação do calendário; no celular, responder, fotografar, assinar e **concluir**.

### 9.2.6 Comportamento
- **Despachar** (`criarAtividade`): conta as atividades da obra, cria a linha em `vistorias_atividades` com token e (opcional) preenche respostas com as medidas do projeto (`preencherMedidasProjeto`/`…PorPavimento`). O link abre no celular **sem login**.
- A lista de despachos tem **Realtime** (canal `vistorias-atividades-despacho`): o status muda sozinho. **Herdado/Conferido** (o canal aparece no código).
- **Excluir atividade** apaga as respostas e a atividade **de verdade** (`DELETE`).
- A página do técnico lê pela RPC `public_vistoria_obter(token)` (queda para consulta direta), grava respostas com `upsert` por `(atividade, pergunta, pavimento)` e atualiza o status da atividade.

### 9.2.7 Dados
`vistorias_questionarios` (**14**), `vistorias_categorias` (**97**), `vistorias_perguntas` (**1.848**), `vistorias_atividades` (**10**: 3 pendentes, 4 em execução, 3 concluídas), `vistorias_respostas` (**543**), `vistorias_obras` (**0**, tabela do agendador antigo, hoje sem leitor). Lê `dossier_obra`, `equipamentos_obra`, `colaboradores_vpsistema` (técnicos ativos). **Conferido.**

### 9.2.8 Regras e armadilhas
- **Achado grave, sem correção — exclusão física e política aberta:** `vistorias_atividades`, `_respostas`, `_perguntas`, `_categorias` e `_questionarios` aceitam **DELETE da chave pública** (PC-6); excluir uma atividade apaga as respostas (fotos e assinatura ficam no Storage). **Conferido** em `pg_policies`.
- **Achado:** o `excluirQuestionario`, `excluirCategoria` e `excluirPergunta` apagam em cascata sem checar se há atividade com respostas já dadas; não conferi o que o banco faz com as respostas órfãs. **Não verificado.**
- **Achado — erros engolidos:** as listas de obras, equipamentos e técnicos do Despacho usam o resultado sem olhar o erro; falha vira lista vazia (Art. 9). **Conferido** no código (consultas em `Promise.all` com `.data`).
- A tabela `vistorias_obras` (agendador manual) saiu da tela em 12/10/2026 e fica **sem uso** (0 linhas, política `ALL` aberta): candidata a decisão (PC-11). **Herdado/Conferido.**
- O Master ID aceito no Despacho é o **código da obra**; obra sem cotação cai no id interno. **Conferido.**

### 9.2.9 Testes
Nenhum teste de unidade do store ou das telas; `f1-publico-obra.test.js` cobre a leitura pública da obra. e2e: **não rodei**; as páginas `/vistoria`, `/status-obra`, `/status-obra-interno` e `/diario-obra` estão na lista de páginas públicas do teste de fumaça (**Conferido** em `e2e/smoke.spec.js`). **Cenário (sem teste):** *Dado* um questionário e um técnico, *quando* despacho, *então* nasce a atividade pendente com link e ela aparece no Calendário.

### 9.2.10 Pendências e decisões
**Decisão do Gelson:** trocar a exclusão física por soft-delete e fechar a política de DELETE (exige "Confirmo"); alçada para quem monta questionário e despacha; apagar ou manter `vistorias_obras`. Tutorial (PC-10).

### 9.2.11 Histórico
Consolidação das três implementações de vistoria em 15/08/2026; questionários e despacho em 01/09; Realtime do despacho em 28/09; Status da Obra e Linha do Tempo passaram a ler `vistorias_atividades` em 11–12/10/2026. **Herdado.**

---

## 9.3 Resultado Vistorias de Obras

### 9.3.1 O que é
O **resultado** das vistorias de uma obra: o progresso das **três vistorias incluídas** no contrato e os checklists digitais despachados no 9.2, com cada resposta, foto e o PDF. **Conferido** em `vistorias-obras.jsx` (582 linhas), 01/11/2026.

**Fora do escopo:** montar questionário e despachar (9.2); o agendamento manual antigo (removido).

### 9.3.2 Rota e arquivos
Rota `vistorias`; URL `/engenharia/vistorias[/<obraId>]` (o id da obra na URL é só "passthrough" do `subsel`). O modo `embedded` é usado pela aba de instalação do Dossiê. Arquivo `vistorias-obras.jsx` (`VistoriasObras`, `ChecklistsDigitaisObra`, `ResultadoAtividadeModal`), `instalacao-obra-store.js` (progresso), `vistoria-reactpdf.bundle.js` (PDF). **Conferido.**

### 9.3.3 Perfil e acesso
Sem `temCapacidade`; alçada `vistorias` não lida. **Conferido.**

### 9.3.4 O que a tela mostra
Sem obra escolhida, um **seletor de obras agrupado por cliente** (busca por cliente, obra ou nº de série). Com a obra: cartões do progresso das 3 vistorias, a lista de checklists digitais (status) e a janela de **Resultado** (respostas por categoria, fotos, assinatura, edição de campo e PDF).

### 9.3.5 Botões e controles
Escolher a obra; abrir resultado; **editar campo** de uma resposta (`CampoEditavel`); baixar o PDF.

### 9.3.6 Comportamento
O progresso das vistorias conta as atividades **concluídas** da obra por data (a "Vistoria Nº N" é a N-ésima concluída) e a verificação de prazo (`verificarPrazoVistorias`) vem do `instalacao-obra-store.js`. A edição de um campo grava em `vistorias_respostas`. **Conferido** no código.

### 9.3.7 Dados
Lê `dossier_obra`, `equipamentos_obra`, `vistorias_atividades` (10), `vistorias_respostas` (543), questionários e perguntas. Grava `vistorias_respostas` (edição de campo).

### 9.3.8 Regras e armadilhas
- **A mesma tabela que o 9.2** (política aberta, DELETE aberto): ver 9.2.8.
- **Achado — edição sem trilha:** `CampoEditavel` altera uma resposta de vistoria já dada sem guardar o valor anterior nem registrar `VPLog`. **Não verificado** se há trigger de histórico (não achei nenhum em `vistorias_respostas`; **Conferido** a lista de gatilhos).
- Cada atividade concluída traz o PDF gerado por `vistoria-reactpdf.bundle.js`; mudar o layout exige `npm run build:pdf` do bundle. **Herdado.**
- Nenhuma das 10 atividades tem `dossier_id` nulo entre as concluídas. **Conferido.**

### 9.3.9 Testes
`instalacao-obra-store.test.js` (progresso de vistorias). Nenhum teste da tela. **Cenário (sem teste):** *Dado* uma obra com 3 atividades concluídas, *quando* abro o resultado, *então* o progresso mostra 3 de 3.

### 9.3.10 Pendências e decisões
Registrar `VPLog` e valor anterior na edição de resposta (Art. 9/27); decidir se "Resultado" e "Vistorias de Obras" continuam duas telas. Tutorial (PC-10).

### 9.3.11 Histórico
Era "Vistorias de Obras" e virou "Resultado Vistorias de Obras" em 01/09/2026 para liberar o nome ao novo despacho; o agendamento manual saiu em 12/10/2026. **Herdado.**

---

## 9.4 Instalação em Campo

### 9.4.1 O que é
A visão **por cliente** das obras que estão sendo montadas agora ou estão prestes a começar: um cartão por cliente com o **código pai**, os instaladores e cada equipamento com o nº de série. **Só leitura.** **Conferido** em `operacoes.jsx` (`InstalacaoPage`), `instalacao-campo-calc.js` (173 linhas) e `instalacao-campo-store.js`, 01/11/2026.

**Fora do escopo:** editar equipamento ou instalador (9.1); o mapa (9.5); o pagamento do instalador (11).

### 9.4.2 Rota e arquivos
Rota `instalacao`; URL `/engenharia/instalacao`; a **busca** vai na URL (`?q=`); os cartões abertos **não**. Arquivos: `operacoes.jsx` (a tela), `instalacao-campo-calc.js` (`window.InstalacaoCampoCalc`, regras puras), `instalacao-campo-store.js`. **Conferido.**

### 9.4.3 Perfil e acesso
Sem `temCapacidade`; a alçada `instalacao` existe com as ações padrão e `editar_status_obra` (essa é lida no 9.1). **Conferido.**

### 9.4.4 O que a tela mostra
"OBRAS & INSTALAÇÃO · INSTALAÇÃO"; quatro cartões (Clientes ativos, Montando, Prestes a iniciar, Equipamentos); busca; dois grupos de cartões retráteis por cliente (**Montando** e **Prestes a iniciar**) com código pai, cidades, instaladores e a lista de equipamentos (descrição, código, 🔧 nº de série, situação). Clique no equipamento abre o Dossiê da obra.

### 9.4.5 Botões e controles
Buscar; ▸/▾ por cliente; abrir equipamento/obra. Nada grava.

### 9.4.6 Comportamento
Carrega `dossier_obra`, `equipamentos_obra`, instaladores e elenco (`dossier_obra_instaladores`), **une** o instalador principal e o elenco e **agrupa por cliente** (`agruparPorCliente`). A classificação Montando/Prestes a iniciar **reaproveita** `MapaObrasCalc.classificar` (9.5). O **código pai** é o `codigo_obra` gravado (`VPNI-<cotação>` ou `VPNI-OB<NNNN>`); o cálculo ao vivo só serve de contingência. Falha de carga vira aviso vermelho na tela. **Conferido.**

### 9.4.7 Dados
Lê `dossier_obra` (68), `equipamentos_obra` (65), `dossier_obra_instaladores` (2), `parceiros_instaladores`. Não grava.

### 9.4.8 Regras e armadilhas
- **A tela antiga lia `equipes` e `projetos`, que nunca tiveram registro:** foi trocada em 29/10/2026; os modais de agendar equipe saíram como código morto. **Herdado.**
- **O agrupamento é por cliente** (`clienteId`); Dossiês do mesmo cliente com grafias diferentes saem em cartões separados. **Conferido** (mesmo risco do 9.1.8).
- Os 16 Dossiês em "Instalação" e os em "Contrato assinado/Importação/Homologação" só entram aqui conforme `MapaObrasCalc.classificar` (9.5.6): obra em "Homologação instalador" **sem** equipamento entregue entra em "Prestes a iniciar". **Conferido** na regra.

### 9.4.9 Testes
`instalacao-campo-calc.test.js` (10 testes, inclui o caso do elenco com 3 instaladores). Nenhum da tela. **Cenário:** *Dado* o Hospital Leonardo da Vinci com 9 Dossiês, *quando* a tela agrupa, *então* sai **um** cartão com um só código — **coberto** pelo teste de `codigo_obra` (**Herdado**).

### 9.4.10 Pendências e decisões
Tutorial e "?" (PC-10); decidir se a tela ganha ação (hoje só leitura).

### 9.4.11 Histórico
Populada com clientes reais em 29/10/2026 (PR #1138); `codigo_obra` gravado no mesmo dia (PR #1149). **Herdado.**

---

## 9.5 Mapa de Obras

### 9.5.1 O que é
Duas abas: **Mapa** (um ponto por obra, com a cor da situação) e **Evolução dos Equipamentos** (uma linha do tempo por equipamento, da obra aberta à entrega, com as ocorrências e o aviso de "dado a conferir"). **Só leitura**, exceto que o mapa grava a posição das obras que ainda não a têm. **Conferido** em `mapa-obras.jsx` (378), `mapa-obras-calc.js` (89), `evolucao-equipamentos.jsx` (390), `evolucao-equipamentos-calc.js` (239) e `evolucao-conferir-calc.js` (202), 01/11/2026.

**Fora do escopo:** editar endereço ou equipamento (9.1); a cobrança diária ao Felipe é **deste módulo** e está na PC-5.

### 9.5.2 Rota e arquivos
Rota `mapa-obras`; URL `/engenharia/mapa-obras[/evolucao]` (aba com `useRouteTab`). Leaflet com trocador de estilo (Claro, Escuro, Ruas, Satélite). Nominatim para localizar endereço. Arquivos acima mais `evolucao-conferir-paridade.test.js`. **Conferido.**

### 9.5.3 Perfil e acesso
Alçada `mapa-obras` com as ações padrão e **`pausar`** (lida no Dossiê, 9.1). A tela em si não chama `temCapacidade`. **Conferido.**

### 9.5.4 O que a tela mostra
- **Mapa:** quatro cartões que ligam/desligam cada grupo (**Em andamento** amarelo, **Concluída** verde, **Aguardando equipamentos** azul); pontos com balão (cliente, obra, cidade, dossiê/cotação, situação; em andamento também status, **quem instala**, equipamentos com etapa e %, vistorias concluídas); contorno **vermelho** quando há previsão vencida ou ocorrência grave.
- **Evolução:** três grupos (Em instalação, A caminho da obra, Já entregues) com um cartão por equipamento: etapas **Obra aberta → Saiu da fábrica → Chegou ao Brasil → Chegou na obra → Instalação iniciada → 50% → 75% → Instalação concluída → Entregue**, cada uma feita / prevista / pendente / "sem data"; a **espinha de ocorrências** (5 categorias) e o quadro **"Dado a conferir"**; filtros "Só com ocorrência" e "Só dado a conferir"; **Ver no mapa**.

### 9.5.5 Botões e controles
Cartões-filtro do mapa; troca de estilo do mapa; abas; busca; "Ver no mapa"; "Ocorrências e atrasos" (recolhível); filtros da Evolução; clique no ponto abre o Dossiê.

### 9.5.6 Comportamento
- **Classificação** (`MapaObrasCalc.classificar`): **concluída** = DataBook/Entregue/Manutenção preventiva; **em andamento** = Instalação, ou Contrato assinado/Importação/Homologação **com** equipamento entregue; **aguardando** = esses três status sem equipamento entregue. Antes do contrato não entra. **Conferido.**
- **Posição:** a gravada no Dossiê; sem ela, o mapa pergunta ao Nominatim (rua + número, depois CEP; recusa resultado a mais de 60 km do centro da cidade), **grava no Dossiê** e usa o centro da cidade como último recurso (cache `vp_mapa_obras_geo_v1`); fila de 1 consulta por segundo; obras no mesmo ponto são espalhadas num círculo. **Conferido.**
- **Evolução:** nada é inventado: data "real" no futuro vira previsão; previsão vencida na etapa atual = "Previsão vencida". O embarque liga ao equipamento pelo **Nº da cotação** (que sempre vence) e, para obra antiga, **temporariamente** pelo nº de série da P.I. A chegada ao Brasil usa a **presença de carga** (real) e, sem ela, o ETA marcado "estimado". **Herdado/Conferido** no código.
- **Ocorrências** (5 espinhas: Projeto e contrato, Navio e frete, Aduana, Logística até a obra, Obra e instalação): rolagem, ETD adiado sem rolagem, mudança de ETA, canal Amarelo/Vermelho/Cinza, mais de 10 dias em Santos sem entrega, previsão vencida.
- **Dado a conferir** (`evolucao-conferir-calc.js`): aponta data no futuro, ordem inválida, fase que não avançou, previsão vencida ou desatualizada, obra em Instalação sem Diário, sem nº de série, irmão já iniciado, chegada que destoa dos irmãos. **Só aponta, nunca corrige.** Cada achado diz **quem** corrige (`felipe` = cadastro, `montador` = Diário). Uma pausa vigente cala só os achados de previsão e de "sem Diário" (PC-5).

### 9.5.7 Dados
Lê `dossier_obra`, `equipamentos_obra`, `dossier_obra_instaladores`, `parceiros_instaladores`, `vistorias_atividades`, `embarques_importacao`, `pi_importacao`, `acompanhamento_obra_*`. **Grava** só `dossier_obra.latitude/longitude/geo_precisao`. Hoje **30 de 68** Dossiês têm posição gravada. **Conferido.**

### 9.5.8 Regras e armadilhas
- **A regra de "dado a conferir" existe em duas cópias** (JS e SQL, função `evolucao_conferir_achados`); `evolucao-conferir-paridade.test.js` falha se uma mudar sem a outra. Mexeu numa regra: mude as duas e crie migration nova. **Conferido** (teste existe e passa).
- O mapa e a Evolução **dependem de o Nominatim responder** e do limite de 1 consulta/s; sem endereço, a obra cai no centro da cidade (precisão menor). **Conferido.**
- **Achado — caminho temporário:** a ligação embarque↔equipamento por **nº de série da P.I.** foi feita "só até todas as obras terem cotação"; hoje só **1** Dossiê tem cotação, então o caminho temporário é o **principal** das obras antigas. **Conferido.**
- **Achado:** as ocorrências de Obra e os atrasos de projeto/contrato ainda **não existem no banco** (as espinhas vazias estão desenhadas; o formulário de Ocorrências de Obra não foi construído). **Herdado.**
- A consulta ao Nominatim envia o **endereço da obra** a um serviço externo; o e-mail de contato fixo está no código. **Conferido** (nenhum dado pessoal, só endereço da obra).

### 9.5.9 Testes
`mapa-obras-calc.test.js`, `evolucao-equipamentos-calc.test.js`, `evolucao-conferir-calc.test.js` (18) e o de paridade. Nenhum da tela nem do mapa. **Cenário coberto pelo teste:** *Dado* uma obra com término real e fase ainda "Instalação", *quando* confiro, *então* aparece "fase que não avançou". **Sem teste:** o balão do mapa.

### 9.5.10 Pendências e decisões
Decidir quando tirar o caminho temporário por nº de série; construir o formulário de Ocorrências de Obra (**Decisão do Gelson**); "sem Diário" por dias sem lançar (hoje só detecta quem nunca lançou); atualizar o tutorial (existe, mas a Evolução e a pausa vieram depois — PC-10).

### 9.5.11 Histórico
Mapa em 19/10/2026; Evolução, ocorrências e embarque por série em 19/10; "dado a conferir" e cobrança diária ao Felipe em 24/10; pausa de obra em 25/10/2026. **Herdado.**

---

## 9.6 ART

### 9.6.1 O que é
O controle da **ART de instalação por obra**: uma linha por `codigo_obra`, que nasce sozinha quando o **primeiro Contrato do Instalador da obra é assinado** e conduz o fluxo **Gustavo (Escamax) → Juliana → Felipe**. **Conferido** em `obra-art.jsx` (99 linhas) e `obra-art-store.js` (84), 01/11/2026.

**Fora do escopo:** o contrato do instalador (6/11); o documento "ART (CREA)" do checklist do Dossiê (9.1, são coisas separadas, ver 9.6.8); o Termo de Entrega (10).

### 9.6.2 Rota e arquivos
Rota `art`; URL `/engenharia/art`; a **busca** vai na URL (`?q=`). Arquivos `obra-art.jsx` (`window.ObraArtPage`), `obra-art-store.js` (`window.ObraArtStore`). Arquivos no bucket `engenharia`, pasta `art/<obra>/<modelo|boleto|definitiva>/` (≤ 25 MB, URL pública). **Conferido.** Spec de origem: `docs/superpowers/specs/2026-10-30-art-por-obra.md`.

### 9.6.3 Perfil e acesso
Alçada `art` com as ações padrão e **`confirmar_pagamento`**. A tela lê `editar` (anexar, marcar enviada) e `confirmar_pagamento` (marcar paga) e o **banco confere de novo** o pagamento (gatilho). Concedido na criação: Gustavo e Felipe `ver`+`editar`, Juliana também `confirmar_pagamento`. **Conferido/Herdado.**

### 9.6.4 O que a tela mostra
"OBRAS & INSTALAÇÃO · ART" / **ART de Instalação**; busca; tabela Obra · Cliente · Etapa (5 selos) · Modelo da ART · Boleto · Pagamento · ART definitiva · Envio à obra. Sem linhas: "Nenhuma obra com ART ainda. Ela aparece aqui quando um Contrato do Instalador é assinado."

### 9.6.5 Botões e controles
**Anexar / Trocar** modelo, boleto e definitiva; **Marcar como paga** (com `confirm`); **Marcar enviada à obra**. Cada botão só aparece na etapa certa e para quem tem a alçada.

### 9.6.6 Comportamento
Etapas: `aguardando_modelo → modelo_anexado` (modelo **e** boleto anexados) `→ paga → definitiva_anexada → enviada`. A definitiva só entra depois de "paga". Cada passo avisa a próxima pessoa por **WhatsApp** (linha em `alertas`, entregue pelo gi-avisos: boleto → Juliana, paga → Gustavo, definitiva → Felipe; o primeiro aviso, ao Gustavo, sai do gatilho). A tela recarrega a cada 60 s. Se o registro falha após o upload, o arquivo é removido. **Conferido.**

### 9.6.7 Dados
`obra_art` (**0 linhas** em 01/11/2026), `alertas` (`art-…`), `contratos_instalador` (gatilho de origem). Leitura/atualização por `authenticated` ativo **com a alçada**; sem insert/delete para o usuário (só o gatilho cria). **Conferido.**

### 9.6.8 Regras e armadilhas
- **A ART é por obra, não por equipamento:** o `codigo_obra` é a chave; vários montadores na mesma obra geram **uma** ART. **Herdado/Conferido.**
- **Contratos já assinados antes de 30/10/2026 não geram linha** (4 em produção então); por isso a tabela está vazia. **Herdado.** A ART dessas obras continua só como arquivo no checklist de documentos do Dossiê (41 documentos do tipo ART), **fora** deste fluxo.
- **Achado:** o checklist "ART (CREA)" do Dossiê (9.1) e esta tela **não se falam**: anexar a ART num lugar não marca no outro. **Conferido.**
- **Achado — aviso engolido:** `avisar()` só dá `console.warn` se o alerta não grava; a etapa avança mesmo assim e a próxima pessoa não é avisada (Art. 9). **Conferido.** Os destinatários estão **fixos no código** (e-mails de pessoas; não são segredo, mas mudar de pessoa exige código).
- O Gustavo é externo (Escamax) e precisa de **login no site**; não há número da ART em campo próprio (só o anexo). **Herdado.**

### 9.6.9 Testes
Nenhum teste de unidade nem de tela; o gatilho foi testado no banco em bloco desfeito (**Herdado**, 30/10/2026). e2e: **não rodei**. **Cenário (sem teste):** *Dado* um Contrato do Instalador assinado, *quando* o gatilho roda, *então* nasce a ART da obra e o Gustavo recebe o WhatsApp.

### 9.6.10 Pendências e decisões
Ligar a ART ao checklist do Dossiê; campo para o número da ART; tratar o aviso que falha; ART das obras com contrato assinado antes da regra (carga inicial?) — **decisão do Gelson**. Tutorial (PC-10).

### 9.6.11 Histórico
Antes era um redirecionamento ao Dossiê; a tela por obra e o fluxo de três pessoas nasceram em 30/10/2026 (PR #1188). **Herdado.**

---

## Parte comum de Obras & Instalação

### PC-1 Mapa de ligações
- **Entra:** Proposta assinada (4.5) ou Lead (2.1) → nasce o Dossiê (9.1); Contrato de Venda e Aval Engenharia (6.1, 5.3, 8.1) → a obra passa a "Contrato assinado"; Embarque e P.I. (7.5, 7.2) → datas de navio na Evolução (9.5); Contrato Instalador (11/6) → a ART (9.6), o elenco de instaladores e o Diário de Obra.
- **Sai:** Dossiê → Linha do Tempo da Cotação (8.5), Status da Obra pública, Central de Documentos e Data Book (10); equipamento recebido e instalação → Pagamentos a Instaladores e marcos de parcela (11); eventos → motor de Gatilhos (1.4).

### PC-2 O fluxo da obra de ponta a ponta
Proposta assinada → **Dossiê nasce** (ou adota o do Lead) → Contrato de Venda, avais e compra → **Importação** → **Homologação do instalador** → contrato do instalador assinado (nasce a **ART**) → equipamento chega (**EQUIPAMENTO_RECEBIDO**) e o status vai para **Instalação** (manual) → o montador flega o **Diário de Obra** no celular → vistorias despachadas e respondidas → **DataBook** e **Entregue**. Em paralelo, a **Evolução** e o **mapa** acompanham, e o sistema **cobra** o Felipe e os montadores (PC-5). **Herdado** (CLAUDE.md), lido no código acima.

### PC-3 Rotas, páginas públicas e código sem item de menu
- **Dossiê da Obra** (`dossier-obra`): detalhe do 9.1. **Conferido.**
- **Execução da Vistoria** (`/vistoria/<token>`, `vistoria-execucao.html`), **Diário de Obra** (`/diario-obra/<token>`, `diario-obra.html`, `diario-obra-app.jsx`) e **Status da Obra** (`/status-obra/<token>` para o cliente, só leitura, e `/status-obra-interno/<token>` para a equipe, com anotações; `status-obra.html`). O token é a credencial; leitura pública das obras vem de RPC `public_status_obra_sessao` (**Herdado**). Entram no teste de fumaça como páginas públicas. **Conferido** (rotas em `server.js`).
- **`vistorias_obras`** (0 linhas) e a aba "Gatilhos Importação" do Hub Engenharia são resquícios (PC-11).

### PC-4 Código da obra e identificadores
- `dossier_obra.codigo_obra` (coluna gerada por `dossier_obra_calcular_codigo()` e **fixada** por gatilho: nasce uma vez e não muda): nativa = `VPNI-<cotação, 4 dígitos>`; legada = `VPNI-OB<NNNN>` (sequência própria, **reaproveita** o código de outra obra do mesmo cliente e cidade/UF). **Exceção:** ganhar um Nº de cotação depois promove o código para o nativo. Hoje há **41** códigos para **68** Dossiês (várias obras do mesmo cliente dividem um). O Dossiê usa o id `DOS-…` (interno). A ART cita o `codigo_obra`. **Conferido** (coluna, gatilho e contagem); a regra detalhada é **Herdada** do CLAUDE.md de 29/10/2026.

### PC-5 Cobrança, pausa e avisos automáticos
- **Cobrança do Felipe (Evolução):** a função `evolucao_alertar_felipe` roda **seg–sex às 09:30 de Brasília** (cron `evolucao-alerta-felipe-diario`, 12:30 UTC) e grava **1 alerta por pessoa por dia** para Felipe Barros e, em cópia, Gelson, com link para `/engenharia/mapa-obras/evolucao`; o gi-avisos manda por WhatsApp. Sem pendência não cria nada. O texto leva o dia da semana por extenso (senão o gi-avisos agrupa 24 h). **Herdado**; o cron e a função existem. **Conferido.**
- **Obra sem envio do checklist:** `obras_alertar_sem_envio` (cron `obras-alerta-sem-envio-diario`, seg–sex 07:25 de Brasília) avisa quando uma obra com **Contrato Instalador assinado** fica **2+ dias úteis** sem o montador flegar o Diário (link `/engenharia/dossier-obra/<id>/acompanhamento-obra`); só avisa, não bloqueia pagamento. **Conferido.**
- **Pausa:** quem tem `mapa-obras.pausar` pausa uma obra por até 60 dias (motivo ≥ 10 letras); a pausa cala só previsões e "sem Diário"; erro de dado continua cobrando; pausa vencida há até 3 dias gera o achado `pausa_vencida`. O histórico é imutável (`dossier_obra_pausas`, 0 linhas). **Conferido/Herdado.**

### PC-6 Identidade, alçadas e segurança
- **Estado real das políticas (Conferido em `pg_policies`, 01/11/2026):** `dossier_obra`, `dossier_documentos`, `dossier_pendencias`, `dossier_responsaveis`, `analise_tecnica`, `instalacao_checklist_*`, `acompanhamento_obra_*`, `status_obra_anotacoes` — **ler, inserir e atualizar abertos ao público**, sem DELETE (exceto `instalacao_cronograma` e `dossier_obra_instaladores`, com DELETE aberto). `equipamentos_obra` — **tudo (inclusive DELETE)** para `anon` e `authenticated`. `vistorias_atividades`, `_respostas`, `_perguntas`, `_categorias`, `_questionarios` — **tudo, inclusive DELETE, ao público**. `vistorias_obras` — aberta. `dossier_obra_pausas` — só leitura por usuário ativo (grava só a função). `obra_art` — fechada por alçada.
- **Alçadas:** só `mapa-obras.pausar`, `instalacao.editar_status_obra` e `art.editar`/`confirmar_pagamento` são conferidas no código; o resto do catálogo (`status-obras`, `vistorias`, `instalacao`, `mapa-obras` ver/editar) **não é lido**. O e-mail do usuário vem do navegador (Art. 25): trava na tela é organização, não segurança.
- As páginas `/diario-obra`, `/status-obra` e `/vistoria` são públicas por token; a segurança delas é o token. **Herdado.**

### PC-7 Gatilhos, eventos, crons e funções
- **Banco (Conferido em `pg_trigger`):** em `dossier_obra`: `trg_dossier_obra_fixa_codigo` (código imutável), `trg_dossier_obra_limpa_geo` (apaga a posição ao mudar o endereço), `trg_dossier_obra_protege_pausa` (só a função grava a pausa); em `contratos_instalador`: `trg_obra_art_nasce` (cria a ART); em `obra_art`: `trg_obra_art_guarda` (pagamento só com a alçada). Nenhum gatilho em `vistorias_*`, `equipamentos_obra` ou `acompanhamento_*`.
- **Crons:** `evolucao-alerta-felipe-diario` (09:30 BRT), `obras-alerta-sem-envio-diario` (07:25 BRT) — ambos seg–sex. Outros crons que tocam obra são do 11 (`omie-sync-pagamentos-instaladores-diario`).
- **Eventos** (emitidos pelo código): `DOSSIE_CRIADO`, `INSTALACAO_INICIADA`, `INSTALACAO_CONCLUIDA`, `EQUIPAMENTO_RECEBIDO`, `INSTALADOR_VINCULADO`, `INSTALACAO_METADE_EXECUCAO`. **57** eventos de obra/dossiê/instalação/vistoria em `eventos_fluxo`. **Conferido.**
- **Funções:** `evolucao_pausar_obra`, `evolucao_conferir_achados`, `evolucao_alertar_felipe`, `obras_alertar_sem_envio`, `dossier_obra_calcular_codigo`, `public_status_obra_sessao`, `public_vistoria_obter`. Nenhuma Edge Function é deste módulo.

### PC-8 Tabelas
`dossier_obra` (68), `dossier_documentos` (76), `dossier_pendencias` (6), `dossier_responsaveis` (33), `dossier_history` (144), `analise_tecnica` (3), `equipamentos_obra` (65), `dossier_obra_instaladores` (2), `dossier_obra_pausas` (0), `instalacao_checklist_itens` (560), `instalacao_checklist_templates` (28), `instalacao_cronograma` (0), `acompanhamento_obra_itens` (17), `_lancamentos` (62), `_links` (20), `_status` (323), `status_obra_anotacoes` (1), `vistorias_questionarios` (14), `_categorias` (97), `_perguntas` (1.848), `_atividades` (10), `_respostas` (543), `vistorias_obras` (0), `obra_art` (0). Contagens **Conferidas** por `count(*)` em 01/11/2026. **Realtime:** só `vistorias_atividades` (lista de despachos).

### PC-9 Navegação, cache e testes
Regras de URL, `?v=` e testes: `01_geral.md` PC-9. Específico: abas por `useRouteTab` (9.2, 9.5), item aberto por `useRotaItem`, filtro e busca por `useQueryParam` (9.1, 9.4, 9.6), aba do Dossiê no 3º segmento; **os cartões abertos da Instalação em Campo e as janelas de endereço, pausa e avanço não ficam na URL**. `node scripts/check-cache-bust.js origin/main`: **ok** em 01/11/2026. `npm test`: **931 passaram, 0 falharam**. e2e: **não rodei**. **Não testei nada com clique real no navegador.**

### PC-10 Menu "?" e tutoriais
Só o **Mapa de Obras** tem texto de ajuda no "?" (`HELP_TOPICS`) e a rota de tutorial `obras-instalacao/mapa-de-obras`; existe a pasta `TreinamentoVP/obras-instalacao/mapa-de-obras/` **ainda não commitada** (de outra sessão). **Nenhuma** das outras cinco telas tem "?" nem tutorial. O tutorial do Mapa foi escrito antes da Evolução e da pausa. **Conferido.** Tutorial não se edita à mão: pedir à sessão de tutoriais.

### PC-11 Documentos soltos e destino do que foi concatenado
| Arquivo / seção | O que é | Destino |
|---|---|---|
| `CLAUDE.md` — "Instalação em Campo — populada com clientes reais" | 9.4 | **Concatenado em 9.4** |
| `CLAUDE.md` — "`dossier_obra.codigo_obra`…" | Código da obra | **Concatenado em PC-4 e 9.1** |
| `CLAUDE.md` — "ART por obra — fluxo Gustavo → Juliana → Felipe" | 9.6 | **Concatenado em 9.6** |
| `CLAUDE.md` — "Mapa de Obras" (inclui Evolução, ocorrências, embarque por série, rolagens, ETA) | 9.5 | **Concatenado em 9.5.** Os trechos de rolagem/ETA do Embarque são **mistos** com o 7.5 |
| `CLAUDE.md` — "Evolução dos Equipamentos — dado a conferir…" e "Pausa de obra" | 9.5, PC-5 | **Concatenado em 9.5 e PC-5** |
| `CLAUDE.md` — "Auditoria de amarrações" (itens de vistoria, dossiê pela Proposta) | Mista (1, 4, 9) | Trecho do 9 concatenado em 9.1.6, 9.2.11 e 9.3.11; o resto fica |
| `CLAUDE.md` — "Realtime (Postgres Changes)" | Mista | Trecho de Vistoria em 9.2.6 |
| `CLAUDE.md` — "Cronograma de Pagamento da Instalação — reposicionado" | Menu do 11 | **Apontado** ao 11 (não é deste módulo) |
| `CLAUDE.md` — "Varredura de URLs" | Mista | Já em `01_geral.md` PC-9; trecho de Vistorias/Mapa em 9.2/9.5 |
| `docs/superpowers/specs/2026-10-24-evolucao-qualidade-dados.md` | Spec da cobrança | **Histórico dentro do módulo** (PC-5); fica |
| `docs/superpowers/specs/2026-10-30-art-por-obra.md` | Spec da ART | **Histórico** (9.6); fica |
| `docs/superpowers/specs/2026-10-19-evolucao-fabricacao-quadro-design.md` | É a Evolução da **Fabricação** do quadro | **Do módulo 13**; não é a Evolução dos Equipamentos |
| `docs/VISTORIAS_DEPLOYMENT.md`, `docs/VISTORIAS_DEPLOYMENT_REPORT.md` | Guia de implantação da **primeira** versão de Vistorias (agendador manual, 982 linhas, "Instalação & Entrega") | **Obsoleto**: descreve o agendador removido em 12/10/2026; fica no Git, **não apagado** — decisão do Gelson |
| `docs/MAPA_DE_ROTAS.md` | Gerado | Fonte das URLs (Conferido) |
| `docs/seguranca/matriz-acesso-rls.md` | Matriz de RLS | Do módulo 14; PC-6 traz o estado destas tabelas |
Nenhum arquivo foi apagado. **Parece obsoleto (decisão do Gelson):** `vistorias_obras` (tabela) e os dois guias de Vistorias; a aba "Gatilhos Importação" do Hub Engenharia (8 PC-3).

### PC-12 Benefícios trocados com os outros módulos
- **Recebido:** o selo de verificação e "achado, sem correção" (de todos); a conferência de **política de DELETE aberta** e de **alçada declarada e nunca lida** (de 8); "rótulo do menu ≠ nome do arquivo" (de 7 e 8: aqui a lista é de `dossier-obra.jsx` e a Instalação de `operacoes.jsx`).
- **Doado** (texto completo aqui; os outros apontam): (1) **regra copiada em JS e em SQL exige teste de paridade** (9.5.8): o teste que falha se um lado muda sozinho evita o desvio silencioso; (2) **identificador gravado e imutável por gatilho** (PC-4): código que outros módulos citam (ART, mapa) nasce uma vez e não depende de cálculo ao vivo; (3) **cobrança automática precisa de pausa legítima com prazo e motivo** (PC-5), senão a pessoa cobrada ignora o aviso; (4) **tela que lê duas fontes do mesmo fato** (instalador principal × elenco, 9.1.6): unir as duas, nunca escolher uma; (5) **mensagem de estado que diz o contrário do estado** (9.1.8, "BLOQUEADO — … resolvida"): ler o texto do estado com o dado ao lado; (6) **o caminho "temporário" vira o principal** (9.5.8): registrar quando sair. Registrado nos documentos 1 a 8.
- **Recebido de Entrega & Documentação (01/11/2026, texto em `10_entrega_documentacao.md` PC-12):** os nós `EQUIPAMENTO_RECEBIDO`, `PENDENCIA_INSTALACAO` e `TESTES_REALIZADOS` (deste módulo) caem no ramo padrão **"Comercial"** de `_evt_modulo_etapa`; conferir se é a intenção (**fato Conferido**, intenção **Não verificada**). O **painel do Termo de Entrega** (aba Documentos do Dossiê) e o **cartão do Handover** são regras do 10 (10.2 e 10.3); o 9 só hospeda os componentes.
- **Recebido de Parceiros & Instaladores (01/11/2026, texto em `11_parceiros_instaladores.md` PC-12):** o vínculo empresa↔obra e a decisão "montador entra na obra" são do 9 e **consumidos** no 11.1; o Diário de Obra dispara os eventos `INSTALACAO_*` que **liberam as parcelas** (11.4.6); a primeira assinatura do Contrato cria a ART (9.6); o selo "Obra Concluída" (11.1.4) usa as parcelas do Contrato, das quais **nenhuma** está paga em produção. **Conferido**, 01/11/2026.
- **Recebido de Logística Interna (01/11/2026, texto em `12_logistica_interna.md` PC-12):** nada específico de Obras & Instalação; vale o bloco do `01_geral.md`.
- **Recebido de Fabricação (01/11/2026, texto em `13_fabricacao.md` PC-12):** nada específico de Obras & Instalação; vale o bloco do `01_geral.md`.
- **Recebido de Administração (01/11/2026, texto em `14_administracao.md` PC-12):** o bucket `vistorias-anexos` (fotos de vistoria) é **público**, contra a decisão D4; fica fora da lista que a tela de Buckets mostra. **Conferido.**
- **Recebido de Serviços (01/11/2026, texto em `15_servicos.md` PC-2):** todo alerta com destinatário também vira WhatsApp pelo gi-avisos; para chegar certo, título curto com o essencial na frente, sem "teste", sem R$ no título e com o dia da semana por extenso, a obra ou o código do contrato quando houver vários no mesmo dia (o agrupamento de 24 h apaga números). **Conferido** no código do gi-avisos.
