# Revisão da Sidebar com base no GOV.UK Design System

**Projeto:** `verticalpartsIA/010_GestaoImportacao`  
**Data:** 03/09/2026  
**Base adicional:** princípios e padrões do [GOV.UK Design System](https://design-system.service.gov.uk/)  
**Escopo:** arquitetura de informação, navegação, agrupamento de módulos e redução de vai e volta.  
**Restrição:** nenhuma alteração foi feita no repositório, no Supabase ou na aplicação.

## 1. Resposta direta: eu mudaria o ponto de vista?

**Sim. A recomendação anterior estava correta ao identificar itens deslocados, mas ainda dava importância demais a uma nova árvore global.** Depois de confrontar a proposta com o GOV.UK Design System, eu mudaria a solução de “organizar melhor todos os módulos na Sidebar” para:

> **Manter uma navegação global curta e usar páginas de contexto com listas de tarefas para conduzir cada cotação, projeto, importação e obra.**

Essa mudança é essencial. O próprio padrão de navegação do GOV.UK diferencia dois cenários:

- Quando o serviço é usado repetidamente, envolve várias tarefas e **não possui uma ordem única**, uma navegação global pode ajudar.
- Quando existe uma jornada com início, sequência e término, deve-se evitar depender de links de navegação e usar uma **Task list**, que mostra as tarefas, a ordem e o status de conclusão.[1]

O VP Gestão possui os dois cenários ao mesmo tempo. Portanto, ele não deve tentar resolver tudo com uma única Sidebar.

## 2. Nova tese de arquitetura

A aplicação deve ter duas camadas de navegação.

### Camada A — Navegação global

A Sidebar deve conter somente os destinos que o usuário acessa transversalmente, independentemente de uma cotação ou obra específica. Ela deve ser curta, estável e baseada em grandes áreas. Ela não deve listar cada etapa, cada documento ou cada subrota.

### Camada B — Navegação contextual

Dentro do registro principal — idealmente o **Dossiê da Cotação/Obra** — o usuário deve encontrar as tarefas relacionadas àquele caso específico. Cada tarefa deve mostrar se está pendente, em andamento, bloqueada, concluída ou não aplicável. A pessoa deve conseguir retomar o trabalho sem lembrar em qual departamento uma função foi arquivada.

Essa separação segue a recomendação do GOV.UK de que a navegação **não é um mapa do site** e não precisa listar todas as partes do serviço.[1]

## 3. O que permanece da análise anterior e o que muda

| Tema | Recomendação anterior | Recomendação revisada |
|---|---|---|
| Estrutura geral | Criar muitos grupos funcionais: Comercial, Suprimentos, Importação, Engenharia, Obras, Documentos | Manter poucos grupos globais e deslocar a maior parte da sequência para o Dossiê contextual |
| Sidebar | Exibir grande parte dos módulos existentes em grupos reorganizados | Exibir somente destinos principais, frequentes e independentes de contexto |
| Fluxo Cotação/Obra | Representar o fluxo por ordem dos itens da Sidebar | Representar o fluxo por uma Task list no Dossiê, com status e próximos passos |
| Ficha Técnica | Cadastro canônico com atalho em Engenharia | Cadastro canônico em **Catálogo Técnico**, com atalho contextual em Comercial, Projeto e Dossiê |
| Tabs | Usar abas dentro do Dossiê para áreas relacionadas | Usar abas apenas para conteúdo relacionado que não precise ser comparado ou percorrido como sequência; usar Task list para etapas |
| Breadcrumbs | Reforçar hierarquia de grupos e páginas | Mostrar contexto estrutural, sem usar breadcrumbs como indicador de progresso |
| Gatilhos & Prazo | Mover para Governança/Meu Trabalho | Manter em **Meu Trabalho** se for uma caixa operacional pessoal; aprofundar detalhes dentro do Dossiê |
| Siglas | Expandir na Sidebar | Expandir na Sidebar e nas tarefas; usar nomes orientados a ação |
| Itens planejados | Isolar como “Em breve” | Remover da navegação principal até terem rota e objetivo claros |

## 4. O problema fundamental da Sidebar atual

A Sidebar atual tenta ser simultaneamente:

1. Um diretório de departamentos.
2. Um catálogo de entidades cadastráveis.
3. Um roteiro de etapas operacionais.
4. Um painel de documentos.
5. Um atalho para telas administrativas.

Isso gera uma lista longa e heterogênea. O usuário precisa responder mentalmente a uma pergunta antes de cada clique: **“Estou procurando uma entidade, uma tarefa, um processo ou um documento?”**

O GOV.UK recomenda simplificar a jornada antes de adicionar navegação.[1] A pergunta correta, portanto, não é apenas “em qual grupo colocar Ficha Técnica?”. É também “o usuário precisa abrir a Sidebar para encontrar Ficha Técnica, ou ela deve aparecer automaticamente no contexto da cotação/obra em que está trabalhando?”.

## 5. Árvore global revisada

Esta é a árvore que eu recomendaria para a Sidebar principal.

```text
VP GESTÃO
│
├── MEU TRABALHO
│   ├── Dashboard
│   ├── Notificações
│   ├── Central de Decisões
│   ├── Gatilhos e Prazos
│   └── Minhas Pendências
│
├── COTAÇÕES E OBRAS
│   ├── Cotações e Pipeline
│   ├── Dossiês de Obras
│   └── Busca de Cotações e Obras
│
├── CATÁLOGO E PARCEIROS
│   ├── Clientes
│   ├── Fornecedores
│   ├── Empresas Instaladoras
│   ├── Produtos e NCM
│   ├── Fichas Técnicas
│   └── Custos e Parâmetros
│
├── COMPRAS E IMPORTAÇÃO
│   ├── Suprimentos
│   ├── Importação
│   └── Almoxarifado
│
└── ADMINISTRAÇÃO
    ├── Contratos e Jurídico
    ├── Financeiro
    ├── Homologação de Instaladores
    ├── Logs de Atividade
    └── Configurações do Sistema
```

### Por que essa árvore é melhor

A Sidebar passa a responder às intenções mais comuns:

| Intenção do usuário | Entrada recomendada |
|---|---|
| Ver o que precisa da minha atenção | Meu Trabalho |
| Trabalhar em uma oportunidade, cotação ou obra | Cotações e Obras |
| Encontrar um cliente, fornecedor, produto ou ficha | Catálogo e Parceiros |
| Cuidar de compra, fornecedor ou processo aduaneiro | Compras e Importação |
| Administrar documentos, financeiro, permissões e auditoria | Administração |

A árvore não precisa expor `P.I.`, `RFQ`, `IMS`, `ART`, `Data Book`, `Vistorias` e `Cronograma` como itens globais. Esses recursos devem aparecer no fluxo em que são usados.

## 6. O Dossiê como centro da experiência

O repositório já possui a rota `dossier-obra`. Ela deve evoluir de uma tela de status para o **centro operacional da cotação/obra**. O usuário entra no dossiê e encontra o trabalho completo daquele caso.

### Estrutura recomendada do Dossiê

```text
Dossiê da Cotação/Obra
│
├── Visão geral
│   ├── Identificação do cliente e da obra
│   ├── Responsáveis
│   ├── Status atual
│   ├── Próxima ação recomendada
│   └── Alertas e bloqueios
│
├── Lista de tarefas
│   ├── Dados comerciais
│   ├── Dados técnicos
│   ├── Precificação
│   ├── Proposta
│   ├── Aprovações
│   ├── Contratos
│   ├── Compras ou importação
│   ├── Obra e instalação
│   └── Documentação e entrega
│
├── Atividade e linha do tempo
├── Documentos
└── Mais ações
```

A **Lista de tarefas** deve ser o principal mecanismo para eliminar o loop. Ela deve mostrar o que está concluído, o que exige ação, o que está bloqueado e o que não se aplica.

O padrão de múltiplas tarefas do GOV.UK orienta que a página seja exibida no início da transação e em cada retorno do usuário. Ele também recomenda agrupar ações relacionadas e mostrar o status de cada tarefa.[2]

## 7. Task list proposta para uma cotação/obra

A lista não deve ser uma lista técnica de telas. Cada linha deve descrever uma tarefa em linguagem que o usuário entenda.

```text
Dossiê: Elevador Residencial — Cliente Exemplo

COMERCIAL
✓ Confirmar dados do cliente e da obra
✓ Preencher formulário de requisitos
✓ Registrar a cotação
→ Definir preço e condições comerciais
○ Enviar proposta para aprovação
○ Formalizar proposta aprovada

ENGENHARIA E PRODUTO
✓ Configurar o equipamento
→ Completar a ficha técnica
○ Validar desenho técnico

COMPRAS E IMPORTAÇÃO
○ Decidir entre compra nacional e importação
○ Solicitar cotações a fornecedores
○ Criar P.I. e RFQ internacional, se aplicável
○ Acompanhar IMS e embarque, se aplicável

OBRA E INSTALAÇÃO
○ Preparar cronograma
○ Realizar vistoria
○ Liberar instalação em campo
○ Registrar resultado da instalação

DOCUMENTOS E ENCERRAMENTO
○ Emitir ART
○ Consolidar Data Book e termo
○ Concluir entrega final e handover
○ Liberar pagamentos ao instalador
```

### Regras de comportamento

| Regra | Aplicação no VP Gestão |
|---|---|
| A tarefa deve descrever uma ação ou objetivo | Usar “Completar a ficha técnica”, não somente “Ficha Técnica”. |
| O status deve ser textual e visível | Usar “Concluído”, “Pendente”, “Em andamento”, “Bloqueado” e “Não se aplica”. |
| O usuário deve poder retomar a operação | O clique deve abrir a rota já associada ao dossiê. |
| Dependências devem ser explicadas | Se a proposta depende de precificação, mostrar o motivo do bloqueio. |
| O grupo deve ser curto e compreensível | Não criar uma lista com todas as subrotas técnicas. |
| A conclusão deve ser verificável | O status muda após o salvamento ou evento real, não apenas após visitar a tela. |

As tarefas não precisam obrigatoriamente ser concluídas em ordem se a operação permitir paralelismo. O GOV.UK recomenda que usuários possam realizar tarefas na ordem que fizer sentido para eles, enquanto os status informam o que já foi concluído e o que ainda precisa de atenção.[3]

## 8. Onde cada item deve ficar agora

### 8.1 Itens que devem permanecer na Sidebar global

| Item atual | Novo local | Decisão |
|---|---|---|
| Dashboard | Meu Trabalho | Manter |
| Notificações | Meu Trabalho | Manter |
| Central de Decisões | Meu Trabalho | Manter |
| Gatilhos & Prazo | Meu Trabalho | Manter, com nome “Gatilhos e Prazos” |
| Controle de Cotações | Cotações e Obras | Manter como “Cotações e Pipeline” |
| Dossiê/Status de Obras | Cotações e Obras | Promover como “Dossiês de Obras” |
| Clientes | Catálogo e Parceiros | Manter |
| Fornecedores | Catálogo e Parceiros | Manter |
| Empresas Instaladoras | Catálogo e Parceiros | Manter |
| Produtos/NCM | Catálogo e Parceiros | Renomear para “Produtos e NCM” |
| Fichas Técnicas | Catálogo e Parceiros | Manter como destino canônico |
| Custos | Catálogo e Parceiros | Renomear para “Custos e Parâmetros” |
| Suprimentos | Compras e Importação | Criar grupo/entrada agregadora |
| Importação | Compras e Importação | Criar grupo/entrada agregadora |
| Almoxarifado | Compras e Importação ou Logística | Manter, conforme o modelo operacional final |
| Contratos/Jurídico | Administração | Consolidar em uma entrada |
| Financeiro | Administração | Consolidar em uma entrada |
| Homologação | Administração ou Catálogo e Parceiros | Preferência: Catálogo e Parceiros se for cadastro/compliance de terceiro |
| Logs | Administração | Manter |
| Configurações | Administração | Manter |

### 8.2 Itens que devem virar tarefas contextuais

| Item atual | Novo tratamento | Motivo |
|---|---|---|
| Formulários | Tarefa de uma cotação/obra; manter atalho global se for entrada frequente | É uma etapa de coleta, não necessariamente um departamento |
| Precificação | Tarefa “Definir preço e condições comerciais”; atalho administrativo opcional | O usuário pensa no objetivo, não na tela interna |
| Propostas | Tarefa “Preparar/enviar proposta”; lista global opcional | A proposta nasce dentro do dossiê |
| Contrato de Venda | Tarefa de formalização no dossiê | Vem após proposta e aprovação |
| Contrato de Instalador | Tarefa dentro de Obra/Instalação | Depende do parceiro e da execução |
| Projeto de Elevadores | Tarefa em Engenharia e Produto | Depende da cotação/obra |
| Projeto de Equipamento | Tarefa em Engenharia e Produto | Depende do equipamento do caso |
| Projetos ER/Es | Tarefa em Engenharia e Produto | Deve ser contextualizada e explicada |
| Vistorias de Obras | Tarefa em Obra e Instalação | É execução de campo |
| Resultado Vistorias | Mesmo fluxo da vistoria, como resultado | Evita separar início e resultado |
| Instalação em Campo | Tarefa em Obra e Instalação | É execução, não cadastro |
| Linha do Tempo da Cotação | Aba/área Atividade e Linha do Tempo | Não deve competir como módulo global |
| Central de Documentos | Aba/área Documentos do dossiê; atalho global apenas se necessário | Documentos precisam de contexto |
| ART | Tarefa em Documentos e Encerramento | É um entregável da obra |
| Cronograma | Tarefa em Obra e Instalação | É planejamento da execução |
| Data Book & Termo | Tarefa em Documentos e Encerramento | É documentação de encerramento |
| Entrega Final | Tarefa final | É o término da jornada |
| P.I. | Tarefa condicional de Importação | Só aparece quando importação for aplicável |
| RFQ | Tarefa condicional de Importação | Deve explicar “Cotação Internacional” |
| IMS | Tarefa condicional de Importação | Deve expandir a sigla e explicar seu papel |
| Embarques | Tarefa condicional de Importação | Deve ser vinculada à P.I. e ao dossiê |
| Análise de Preços | Tarefa de Importação ou Compras | Deve aparecer no caminho que a utiliza |
| Compras Nacional | Tarefa condicional de Suprimentos | É alternativa à importação |
| Pedidos | Tarefa de Suprimentos | Nasce da compra, não de Importação por padrão |
| Expedição/Logística planejados | Remover até existir | Não deve haver navegação para funcionalidade inexistente |

## 9. Ficha Técnica: decisão revisada

A pergunta “Ficha Técnica deve ficar em Engenharia?” não tem uma resposta única porque o objeto possui duas naturezas.

### Natureza 1 — dado mestre

A ficha descreve produto/equipamento e pode alimentar catálogo, NCM, configuração, precificação, proposta, compras e importação. Nesse sentido, sua localização canônica deve ser **Catálogo e Parceiros > Fichas Técnicas**.

### Natureza 2 — tarefa de um caso

Durante uma cotação ou obra, o usuário precisa completar a ficha daquele equipamento. Nesse contexto, ela deve aparecer como a tarefa **“Completar a ficha técnica do equipamento”** dentro do Dossiê.

### Decisão final

Não duplicar a função. Usar:

```text
Localização canônica: Catálogo e Parceiros > Fichas Técnicas
Atalho contextual: Dossiê > Lista de tarefas > Engenharia e Produto
```

O atalho deve abrir a mesma rota `ficha-tecnica` com o identificador da cotação, produto ou equipamento. Assim, não há conflito entre encontrar a ficha pelo catálogo e trabalhar nela dentro de uma obra.

## 10. Tabs, breadcrumbs e navegação: como aplicar corretamente

### 10.1 Tabs não devem substituir a Sidebar nem a Task list

O GOV.UK alerta que tabs escondem conteúdo e não devem ser usadas como forma de navegação de páginas. Elas são adequadas quando o conteúdo é claramente separável, a primeira seção é mais relevante e o usuário não precisa ver todas as seções ao mesmo tempo.[4]

Aplicação recomendada:

```text
Dossiê da Obra
├── Visão geral
├── Atividade
├── Documentos
└── Dados técnicos
```

Não usar tabs para esconder uma sequência que o usuário precisa completar, como “Proposta → Contrato → Compra → Instalação”. Essa sequência deve ser uma Task list com status.

### 10.2 Breadcrumbs devem mostrar localização, não progresso

Breadcrumbs ajudam a entender a posição na estrutura e voltar entre níveis. Eles não devem representar progresso linear de uma transação.[5]

Exemplo recomendado:

```text
Cotações e Obras > Dossiê da Obra > Elevador Residencial > Documentos
```

Exemplo a evitar:

```text
Lead > Cotação > Engenharia > Importação > Obra
```

O segundo exemplo mistura progresso, departamentos e páginas. Para progresso, usar status e tarefas.

### 10.3 Navegação principal deve ser curta

A Service navigation do GOV.UK é destinada aos links de nível superior mais importantes e úteis ao usuário. Ela não precisa listar cada parte do serviço.[1] Aplicando esse princípio ao VP Gestão, itens como `ART`, `Data Book`, `RFQ`, `IMS` e `Linha do Tempo` não precisam ocupar espaço permanente na Sidebar.

## 11. A Sidebar atual: avaliação item a item

### Geral

`Dashboard`, `Notificações` e `Central de Decisões` pertencem à camada global. `Gatilhos & Prazo` deve permanecer próximo desses itens se representar pendências e controles que o usuário precisa consultar no dia a dia. O nome deve ser padronizado para **Gatilhos e Prazos**.

### Cadastros

O grupo deve se chamar **Catálogo e Parceiros**, porque contém mais que cadastros genéricos. `Produtos` deve ser renomeado para **Produtos e NCM**. `Atualização de Custos` pode permanecer como **Custos e Parâmetros**, mas deve ser acessível também a partir da tarefa de precificação.

### Comercial

O grupo deve ser reduzido a **Cotações e Obras**, com `Cotações e Pipeline` e `Dossiês de Obras`. Leads podem permanecer nesse grupo ou dentro de Cotações, conforme a frequência real. A sequência detalhada de formulário, cotação, preço e proposta deve aparecer no dossiê, não necessariamente como quatro destinos globais.

### ADM/Financeiro

`Cotações a Fornecedor` deve sair desse grupo e entrar no fluxo de **Suprimentos**. `Precificação` não deve ser apresentada como uma área exclusivamente financeira; ela é tarefa comercial com regras e permissões financeiras. `Avaliação Financeira`, `Comissões` e `Pagamentos` podem ficar em Administração > Financeiro ou aparecer como tarefas quando vinculadas ao dossiê.

### Jurídico

Consolidar como **Administração > Contratos e Jurídico**. Os contratos específicos devem aparecer como tarefas no dossiê depois da aprovação da proposta.

### Importação/Suprimentos

Separar conceitualmente os dois domínios, mas não necessariamente criar uma lista enorme na Sidebar. Na entrada **Compras e Importação**, o usuário deve escolher o contexto ou abrir diretamente as pendências relevantes. Dentro do dossiê, a escolha entre compra nacional e importação deve ser condicional.

### Engenharia

Não manter quinze destinos permanentes. Criar a entrada global **Projetos e Engenharia** somente se houver uso recorrente independente de uma obra; caso contrário, abrir Engenharia dentro do dossiê. Ficha Técnica permanece no catálogo com atalho contextual.

### RH Operacional

A homologação de instaladores é compliance de parceiros. Deve ficar em **Catálogo e Parceiros** ou **Administração**, não em uma área que pareça voltada a funcionários internos.

### Logística

`Almoxarifado` pode ficar em Compras e Importação ou em uma entrada Logística curta. `Expedição` e `Logística`, enquanto planejados, não devem aparecer como opções clicáveis ou promessas de produto acabado.

### Portal Admin

Renomear para **Administração** e manter no final. O grupo deve concentrar configurações, logs, permissões, financeiro administrativo, jurídico e compliance conforme o modelo de acesso adotado.

## 12. Nomenclatura: de nomes de tela para objetivos do usuário

O GOV.UK recomenda rótulos claros, curtos e compreensíveis. A revisão deve preferir linguagem de objetivo em tarefas e linguagem de domínio em entradas globais.

| Atual | Global | Tarefa contextual |
|---|---|---|
| Formulários | Cotações e Obras | Preencher requisitos da obra |
| Controle de Cotações | Cotações e Pipeline | Revisar andamento da cotação |
| Precificação | Administração ou atalho contextual | Definir preço e condições comerciais |
| Propostas | Cotações e Obras ou atalho contextual | Preparar e enviar proposta |
| P.I. | Compras e Importação | Criar pedido de importação |
| RFQ | Compras e Importação | Solicitar cotação internacional |
| IMS | Compras e Importação | Atualizar acompanhamento de importação |
| ART | Não listar globalmente | Emitir ART da instalação |
| Data Book & Termo | Não listar globalmente | Consolidar Data Book e termo |
| Handover | Não listar globalmente | Concluir entrega e handover |

As siglas devem ser explicadas na primeira ocorrência. O nome exato de `IMS` e `ER/Es` precisa ser confirmado com a operação antes de publicar a redação final, porque uma expansão incorreta é pior que uma sigla conhecida internamente.

## 13. Acessibilidade e robustez da navegação

Adotar componentes acessíveis não torna automaticamente o serviço acessível. O GOV.UK ressalta que são necessários pesquisa, desenvolvimento e testes adicionais.[6]

Para a Sidebar e o Dossiê, os critérios mínimos são:

| Critério | Recomendação |
|---|---|
| Teclado | Todos os grupos, links, tarefas e controles de expansão devem ser operáveis por teclado. |
| Foco | O foco deve permanecer visível após abrir uma tarefa, aba ou grupo. |
| Leitores de tela | O item ativo deve usar `aria-current`; grupos recolhíveis devem anunciar estado expandido/recolhido. |
| Status | Status não podem depender apenas de cor; usar texto explícito. |
| Responsividade | Em telas estreitas, a navegação global deve colapsar em “Menu”; a lista de tarefas deve continuar legível. |
| Tamanho dos rótulos | Evitar siglas sem explicação e rótulos que quebrem em várias linhas. |
| Recuperação | Ao retornar ao dossiê, o usuário deve encontrar a mesma tarefa e status. |
| Pesquisa | Testar com usuários que usam zoom, leitor de tela, contraste aumentado e navegação por teclado. |

Os princípios de acessibilidade aplicáveis são que a interface deve ser perceptível, operável, compreensível e robusta. Também devem ser considerados uso simples e intuitivo, tolerância ao erro, baixo esforço cognitivo e flexibilidade de uso.[6]

## 14. O que eu implementaria primeiro

### Fase 1 — reduzir a Sidebar sem mudar o motor de rotas

Manter os IDs existentes e alterar apenas agrupamento, rótulos e visibilidade. Criar as cinco entradas globais: Meu Trabalho, Cotações e Obras, Catálogo e Parceiros, Compras e Importação e Administração.

### Fase 2 — promover o Dossiê

Transformar `dossier-obra` no ponto de entrada de uma cotação/obra. Exibir a Task list e associar cada tarefa às rotas já existentes.

### Fase 3 — mover subrotas para o contexto

Retirar da Sidebar principal `ART`, `Cronograma`, `Data Book`, `Handover`, `Vistorias`, `Linha do Tempo`, `RFQ`, `IMS` e detalhes de importação. Disponibilizá-las como tarefas, abas ou ações internas, conforme o tipo de conteúdo.

### Fase 4 — atualizar permissão e breadcrumbs

A implementação atual replica a taxonomia da Sidebar no catálogo de permissões. Portanto, atualizar juntos `NAV_GROUPS`, `CATALOGO_MODULOS` e `BREADCRUMB_MAP`. Manter os identificadores técnicos para reduzir risco de regressão.

### Fase 5 — testar com tarefas reais

Observar usuários executando pelo menos quatro cenários:

1. Criar uma cotação e emitir proposta.
2. Completar uma ficha técnica a partir de uma cotação.
3. Escolher compra nacional ou importação.
4. Concluir vistoria, instalação, documentação e entrega.

Medir quantos cliques fora do dossiê, quantos retornos à Sidebar, quantos erros de interpretação e quanto tempo cada cenário exige.

## 15. Critérios de sucesso

A reorganização deve ser considerada bem-sucedida se:

- O usuário encontrar o dossiê sem conhecer a estrutura interna da empresa.
- O usuário retomar o trabalho e identificar imediatamente a próxima pendência.
- A Ficha Técnica for encontrada tanto pelo catálogo quanto pelo caso em andamento.
- A decisão entre compra nacional e importação aparecer no momento adequado.
- O usuário não precise procurar ART, Data Book, Cronograma ou Handover em Engenharia.
- Itens concluídos, bloqueados e pendentes sejam compreensíveis sem depender de cor.
- A Sidebar não pareça um mapa completo do banco de dados.
- O caminho de volta preserve contexto e não cause perda de dados.
- Usuários de teclado e tecnologias assistivas consigam navegar e compreender os estados.

## 16. Decisão final

Eu **não recomendo simplesmente substituir a Sidebar atual por uma nova Sidebar igualmente longa**, ainda que os grupos sejam melhores. Isso apenas trocaria um inventário departamental por um inventário funcional.

A solução mais forte é:

```text
Sidebar global curta
        +
Dossiê da Cotação/Obra
        +
Task list contextual com status
        +
Atalhos contextuais para as rotas existentes
        +
Breadcrumbs para localização
        +
Tabs somente para conteúdos relacionados, não para progresso
```

Quanto à pergunta original: **Ficha Técnica em Engenharia faz sentido para quem está projetando, mas não deve depender dessa localização para ser encontrada.** Ela deve possuir uma localização canônica em Catálogo e Parceiros e aparecer como tarefa dentro do Dossiê quando fizer parte do trabalho em andamento.

A mudança traz três benefícios principais:

1. **Menos busca por departamento:** o usuário trabalha pelo caso, não pela memória da organização interna.
2. **Menos vai e volta:** o dossiê concentra o contexto e mostra o próximo trabalho pendente.
3. **Menor carga cognitiva:** a Sidebar deixa de tentar explicar todo o sistema e passa a oferecer somente os caminhos globais essenciais.

## Referências

[1]: https://design-system.service.gov.uk/patterns/navigate-a-service/ "Help users to Navigate a service — GOV.UK Design System"

[2]: https://design-system.service.gov.uk/patterns/complete-multiple-tasks/ "Help users to Complete multiple tasks — GOV.UK Design System"

[3]: https://design-system.service.gov.uk/components/task-list/ "Task list — GOV.UK Design System"

[4]: https://design-system.service.gov.uk/components/tabs/ "Tabs — GOV.UK Design System"

[5]: https://design-system.service.gov.uk/components/breadcrumbs/ "Breadcrumbs — GOV.UK Design System"

[6]: https://design-system.service.gov.uk/accessibility/accessibility-strategy/ "Accessibility strategy — GOV.UK Design System"

[7]: https://design-system.service.gov.uk/components/service-navigation/ "Service navigation — GOV.UK Design System"

[8]: https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/shell.jsx "Implementação atual da Sidebar"

[9]: https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/router.js "Rotas conhecidas do projeto"

[10]: https://github.com/verticalpartsIA/010_GestaoImportacao/blob/main/src/dossier-obra.jsx "Tela de Dossiê/Status de Obras"

**Autor:** Manus AI
