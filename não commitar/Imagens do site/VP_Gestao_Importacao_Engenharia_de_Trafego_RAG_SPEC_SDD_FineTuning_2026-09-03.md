# VP Gestão de Importação
## Engenharia de Tráfego Digital — Arquitetura de Informação, Navegação e Continuidade Operacional
### Modelo RAG + SPEC + SDD + Fine-Tuning

Versão: 1.0  
Data-base: 03/09/2026  
Projeto: `verticalpartsIA/010_GestaoImportacao`  
Escopo: arquitetura de informação, navegação, descoberta de tarefas, continuidade entre setores, Dossiê operacional, Sidebar, landings, Task Lists, 
breadcrumbs, busca e regras de UX.  
Natureza: documento de conhecimento e especificação. Não altera código, banco, permissões ou regras de negócio por si só.

---

## 0. Propósito

O problema do VP Gestão não deve ser tratado como “onde colocar cada link na Sidebar”. O sistema é um serviço transacional longo, 
multissetorial e orientado a casos. Uma oportunidade atravessa 
Comercial, Financeiro, Jurídico, Suprimentos, Importação, Engenharia, Obras, Instaladores, Logística, Documentação e Entrega.

A arquitetura deve responder, em qualquer momento:

1. Onde estou?
2. Em qual cotação, projeto, importação ou obra estou trabalhando?
3. O que já aconteceu?
4. O que precisa acontecer agora?
5. Para onde devo ir para concluir a próxima ação sem procurar em departamentos?

Tese central:

> A Sidebar leva ao domínio.  
> O Dossiê leva ao caso.  
> A Task List leva à próxima ação.  
> A rota funcional executa o trabalho.  
> A linha do tempo registra o que aconteceu.

---

# PARTE I — RAG
## Base de conhecimento canônica

## 1. Contexto operacional

O VP Gestão representa uma cadeia de ponta a ponta:

```text
Lead
  ↓
Coleta de requisitos
  ↓
Cotação / Fornecedor
  ↓
Precificação
  ↓
Proposta
  ↓
Avaliações / Aprovações
  ↓
Contrato / Sinal
  ↓
Compra Nacional ou Importação
  ↓
Engenharia / Ficha / Projeto
  ↓
Preparação da Obra
  ↓
Vistoria / Instalador / ART / Cronograma
  ↓
Instalação
  ↓
Documentação
  ↓
Entrega / Handover
```

Essa linha não é rigidamente sequencial. Há paralelismo real: 
durante produção ou trânsito marítimo podem ocorrer vistoria, homologação, contrato de instalador, ART, planejamento, cronograma e preparação logística.

Conclusão: não modelar o serviço como wizard linear obrigatório.

## 2. Evidências estruturais observadas

- a Sidebar é organizada por grupos funcionais;
- existem rotas profundas que não precisam ser itens permanentes de navegação;
- existe uma rota de Dossiê da Obra;
- existe Central de Documentos;
- existem telas próprias para vistoria, instalação, status, ART, cronograma e entrega;
- a Ficha Técnica atravessa múltiplos setores;
- há P.I., RFQ, IMS e Embarques;
- existem permissões por perfil;
- existem itens planejados ainda sem valor operacional completo;
- há sobreposição semântica entre telas de acompanhamento de Importação/Embarque;
- o processo é orientado por cotação, equipamento, importação e obra, não somente por departamento.

Regra RAG:

> Nunca inferir que uma rota deve aparecer na Sidebar apenas porque existe no router.

## 3. Modelo mental correto

O usuário trabalha com objetos:

1. Lead / Oportunidade
2. Cotação
3. Cliente
4. Equipamento
5. Produto / Ficha Técnica
6. Proposta
7. Contrato
8. Pedido / Compra
9. Processo de Importação
10. Projeto
11. Obra
12. Instalador
13. Vistoria
14. Embarque
15. Documento
16. Entrega

Departamentos são responsáveis por partes desses objetos, mas não são o objeto de trabalho.

> O objeto atravessa os departamentos. O usuário não deve ser obrigado a atravessar a Sidebar na mesma proporção.

## 4. Cinco tipos de navegação

### 4.1 Navegação global

Destinos frequentes e independentes de um caso específico.

### 4.2 Landing de domínio

Fila de trabalho, filtros, busca, indicadores e objetos daquele domínio.

### 4.3 Navegação contextual por objeto

Navegação principal durante a execução do caso.

### 4.4 Deep link funcional

Abre a função concreta já com o contexto conhecido.

### 4.5 Busca global

Via expressa por NC, proposta, cliente, obra, pedido, P.I., container, fornecedor, produto, instalador ou processo.

## 5. Princípios canônicos

### P-01 — Navegação não é sitemap
A existência de uma tela não implica exposição permanente na Sidebar.

### P-02 — Um destino canônico, múltiplas entradas contextuais
Uma função pode ser acessada de vários contextos sem duplicar implementação ou dado.

### P-03 — Dono do dado não é local exclusivo de acesso
Engenharia pode ser dona da Ficha Técnica e outros setores podem acessá-la contextualmente.

### P-04 — Permissão não define taxonomia
RBAC/ABAC deve ser separado da localização visual.

### P-05 — O Dossiê é o nó central de tráfego
O Dossiê concentra contexto e distribui o usuário às funções certas.

### P-06 — Tarefas usam verbo + objetivo
Preferir `Completar ficha técnica` a `Ficha Técnica`.

### P-07 — Status nunca depende só de cor
Sempre usar texto.

### P-08 — Bloqueio precisa explicar causa
Ex.: `Bloqueado — aguardando contrato assinado e sinal confirmado.`

### P-09 — Não duplicar etapa e resultado na navegação
Resultado de Vistoria pertence à Vistoria.

### P-10 — Fluxos condicionais aparecem quando aplicáveis
Compra nacional e importação são ramificações.

### P-11 — Processo pode ser paralelo
A Task List deve permitir paralelismo conforme dependências reais.

### P-12 — Tabs não representam workflow
Tabs servem para visões relacionadas.

### P-13 — Breadcrumb mostra hierarquia, não progresso
Correto: `Obras > NC-902 > Vistorias > Vistoria 02`.

### P-14 — Funcionalidade futura não ocupa navegação produtiva
Placeholder não é item de produção.

---

## 6. Decisões consolidadas sobre itens críticos

### 6.1 Ficha Técnica

Casa canônica:

```text
Engenharia & Produto
  → Fichas Técnicas
```

Acessos contextuais:

- Cotação;
- Proposta;
- Importação;
- Projeto;
- Dossiê da Obra;
- Produto.

Benefícios:

- preserva responsabilidade técnica;
- elimina caça à tela;
- evita cópias paralelas;
- mantém Single Source of Truth.

### 6.2 Cotações a Fornecedor

Casa canônica:

```text
Suprimentos & Importação
```

Financeiro entra em custo, margem, câmbio, aval, risco e pagamento — não como casa da solicitação de cotação.

### 6.3 Atualização de Custos

Casa canônica recomendada:

```text
Financeiro
  → Custos & Precificação
```

Pode ser consumida por Suprimentos e Produto.

### 6.4 Vistorias

Não manter `Vistorias` e `Resultado das Vistorias` como destinos globais separados.

```text
Vistorias
  → Vistoria 02
      ├── Checklist
      ├── Evidências
      ├── Pendências / NC
      ├── Resultado
      └── Histórico
```

### 6.5 Central de Documentos

Não é exclusiva de Engenharia. O acesso principal deve ser pelo Dossiê. Pode existir biblioteca transversal em `Contratos & Documentos` 
quando houver necessidade de pesquisa sem conhecer o caso.

### 6.6 Linha do Tempo

Pertence ao objeto:

```text
Cotação NC-902 → Atividade
Obra NC-902 → Atividade
Importação IMP-027 → Atividade
```

### 6.7 Homologação de Instaladores

Não manter um grupo `RH Operacional` com uma única função.

Casa canônica:

```text
Cadastros & Parceiros
  → Instaladores
```

No parceiro:

```text
Empresa Instaladora XYZ
├── Cadastro
├── Documentos
├── Homologação
├── Obras vinculadas
├── Contratos
└── Histórico
```

O Dossiê deve mostrar `Homologar instalador` quando necessário.

### 6.8 Contrato de Instalador

Dono normativo: Contratos/Jurídico.  
Acesso operacional: Dossiê da Obra e parceiro.

### 6.9 Pagamento a Instalador

Dono financeiro permanece Financeiro. Obras recebe status e deep link quando autorizado.

### 6.10 ART

Entregável técnico/regulatório da obra. Pode ter dono técnico em Engenharia, mas deve aparecer no contexto da Obra.

### 6.11 Embarques versus Importação

Não obrigar o usuário a escolher entre telas semanticamente sobrepostas na Sidebar.

Entrada global:

```text
Suprimentos & Importação
  → Importações
```

Objeto:

```text
IMP-027
├── Visão geral
├── P.I.
├── RFQ
├── Produção
├── Embarque
├── Aduaneiro
├── Custos
├── Documentos
└── Histórico
```

---

# PARTE II — SPEC
## Especificação de produto e experiência

## 7. Objetivo

Reduzir custo cognitivo e mudanças de contexto necessárias para concluir uma operação do início ao fim.

O VP Gestão deve operar como sistema de casos, tarefas e estados, não como coleção de páginas departamentais.

## 8. Arquitetura global recomendada

```text
VP GESTÃO

MEU TRABALHO
  Dashboard
  Minhas Pendências
  Central de Decisões
  Notificações
  Prazos & Alertas

COMERCIAL
  Oportunidades
  Cotações
  Propostas

SUPRIMENTOS & IMPORTAÇÃO
  Compras
  Importações

ENGENHARIA & PRODUTO
  Produtos
  Fichas Técnicas
  Projetos

OBRAS & OPERAÇÕES
  Obras
  Vistorias
  Instalações

LOGÍSTICA
  Almoxarifado
  Expedição

FINANCEIRO
  Custos & Precificação
  Aval Financeiro
  Comissões
  Pagamentos

CONTRATOS & DOCUMENTOS
  Contratos
  Minutas
  Biblioteca de Documentos

CADASTROS & PARCEIROS
  Clientes
  Fornecedores
  Instaladores

ADMINISTRAÇÃO
  Configurações
  Logs
```

A visibilidade pode ser reduzida por perfil, mas o modelo conceitual deve ser único.

## 9. O que sai da Sidebar global

Prioritariamente contextual:

- formulários de um caso específico;
- P.I.;
- RFQ;
- IMS;
- embarque individual;
- resultado de vistoria;
- linha do tempo de uma cotação;
- ART de uma obra;
- cronograma de uma obra;
- Data Book;
- Termo;
- Entrega Final;
- contrato de uma venda específica;
- contrato de instalador específico;
- projeto específico;
- pagamento específico.

Eles continuam existindo. Muda o tráfego, não a funcionalidade.

## 10. Dossiê Universal

### 10.1 Conceito

Cada cotação relevante deve evoluir para um Dossiê persistente que funcione como capa operacional do caso.

### 10.2 Header

```text
NC-902
Edifício Aurora

Cliente
Responsável
Equipamento
Status geral
Etapa atual
Próxima ação
Risco / bloqueio
```

### 10.3 Navegação interna

```text
Visão Geral
Tarefas
Atividade
Documentos
Dados
```

São visões relacionadas do mesmo objeto, não fases do processo.

## 11. Task List do Dossiê

### 11.1 Estrutura padrão

```text
COMERCIAL
[Concluído] Confirmar cliente e oportunidade
[Concluído] Preencher requisitos
[Concluído] Registrar cotação
[Em andamento] Definir preço e condições
[Pendente] Preparar proposta
[Bloqueado] Formalizar contrato

ENGENHARIA & PRODUTO
[Em andamento] Completar ficha técnica
[Pendente] Validar projeto

FINANCEIRO
[Concluído] Validar condições financeiras
[Pendente] Confirmar sinal

SUPRIMENTOS
[Pendente] Definir estratégia de compra
[Pendente] Solicitar cotação a fornecedor

IMPORTAÇÃO
[Não se aplica] Criar P.I.
[Não se aplica] Acompanhar embarque

OBRA & INSTALAÇÃO
[Pendente] Designar instalador
[Pendente] Homologar instalador
[Pendente] Realizar vistoria
[Pendente] Emitir ART
[Pendente] Planejar cronograma
[Pendente] Executar instalação

ENTREGA
[Pendente] Consolidar documentos
[Pendente] Emitir Data Book
[Pendente] Formalizar termo
[Pendente] Concluir handover
```

### 11.2 Status canônicos

```text
PENDENTE
EM_ANDAMENTO
BLOQUEADO
AGUARDANDO_TERCEIRO
CONCLUIDO
NAO_SE_APLICA
CANCELADO
```

Status de negócio podem existir internamente, mas devem mapear para vocabulário de UX consistente.

### 11.3 Regra de conclusão

Visitar uma página não conclui tarefa.

Exemplos:

```text
Completar ficha técnica
→ concluído quando campos obrigatórios e validações forem satisfeitos.

Contrato assinado
→ concluído com evento/registro válido de assinatura.

Pagamento de sinal
→ concluído com confirmação financeira válida.

Vistoria
→ concluído com checklist obrigatório e resultado persistidos.
```

## 12. Dependências e gates

### 12.1 Dependência rígida

```text
Criar P.I.
BLOQUEADO
Motivo: contrato não assinado.
```

### 12.2 Dependência recomendada

```text
Preparar ART
AÇÃO DISPONÍVEL
Aviso: projeto ainda não aprovado pelo cliente.
```

### 12.3 Paralelismo

Durante trânsito marítimo, permitir conforme regra real:

- vistoria;
- homologação;
- contrato instalador;
- ART;
- planejamento;
- cronograma;
- recebimento/logística.

## 13. Próxima Ação

```text
PRÓXIMA AÇÃO
Confirmar sinal do cliente

Responsável: Financeiro
Prazo: 05/09/2026
Bloqueia: P.I. e liberação de compra

[Abrir tarefa]
```

Quando houver paralelismo:

```text
AÇÕES DISPONÍVEIS
1. Confirmar sinal
2. Completar ficha técnica
3. Preparar vistoria inicial
```

## 14. Meu Trabalho

Não deve ser somente painel de KPI.

Conteúdo recomendado:

```text
Minhas Pendências
Aguardando minha decisão
Aguardando terceiros
Vencidas
Vencem hoje
Próximos 7 dias
Recentemente alteradas
```

Exemplo:

```text
NC-902 | Confirmar sinal | Hoje | Financeiro
NC-917 | Completar ficha técnica | Atrasada | Engenharia
NC-921 | Aprovar contrato | Hoje | Jurídico
IMP-027 | Verificar free time | Amanhã | Importação
OBR-031 | Registrar resultado da vistoria | Amanhã | Obras
```

## 15. Landings de domínio

### Comercial

```text
Pipeline
Minhas oportunidades
Cotações em risco
Propostas aguardando cliente
Ações pendentes
```

### Suprimentos & Importação

```text
Compras pendentes
Cotações de fornecedor aguardando resposta
Importações em andamento
Embarques próximos
Alertas aduaneiros / free time
```

### Engenharia & Produto

```text
Fichas aguardando Engenharia
Projetos aguardando revisão
Projetos aguardando cliente
Produtos sem documentação
Pendências técnicas
```

### Obras & Operações

```text
Obras em preparação
Vistorias programadas
NCs / pendências
Instalações em andamento
Entregas próximas
```

### Financeiro

```text
Precificações pendentes
Avaliações pendentes
Sinais aguardando confirmação
Comissões
Pagamentos a instaladores
```

## 16. Busca global

Requisitos:

- texto parcial;
- identificação de tipo de objeto;
- prioridade para código exato;
- histórico recente;
- respeito a permissões;
- nenhum dado não autorizado.

Exemplo:

```text
NC-902
Cotação
Edifício Aurora
Cliente XPTO
Status: Contrato

IMP-027
Importação
Fornecedor ABC
Status: Embarcado

OBR-031
Obra
Shopping XYZ
Status: Instalação
```

## 17. Breadcrumbs

```text
Obras > NC-902 > Vistorias > Vistoria 02
```

ou:

```text
Suprimentos & Importação > IMP-027 > Embarque
```

Nunca usar como barra de progresso.

## 18. Deep links contextuais

Regra:

> Se o sistema já conhece o objeto, o usuário não deve selecioná-lo novamente.

Exemplo conceitual:

```text
/dossier-obra?cotacaoId=...
/ficha-tecnica?cotacaoId=...&equipamentoId=...
/vistoria?id=...&obraId=...
/contrato-instalador?obraId=...&instaladorId=...
```

A forma exata depende da arquitetura vigente.

## 19. Labels

Global = substantivo de domínio.  
Tarefa = verbo + objetivo.

Preferir:

- Completar ficha técnica
- Solicitar cotação
- Validar preço
- Emitir ART
- Homologar instalador
- Confirmar sinal
- Registrar vistoria
- Consolidar Data Book

Evitar siglas sem contexto, nomes duplicados e CAPS como hierarquia.

## 20. Siglas

Expandir apenas quando a nomenclatura oficial estiver confirmada.

Não adivinhar `IMS`, `ER/Es` ou qualquer sigla interna.

## 21. Acessibilidade

Requisitos mínimos:

- navegação por teclado;
- foco visível;
- `aria-current`;
- `aria-expanded`;
- status textual;
- cor não exclusiva;
- zoom 200%;
- menu responsivo;
- leitura coerente por tecnologia assistiva;
- headings corretos;
- links autoexplicativos;
- mensagens de bloqueio associadas à tarefa.

## 22. Responsividade

Desktop:

```text
Sidebar + conteúdo
```

Tablet:

```text
Sidebar recolhível + contexto persistente
```

Mobile:

```text
Menu global recolhido
Header do Dossiê
Próxima Ação
Task List
```

O técnico de campo deve chegar diretamente à tarefa da obra.

## 23. Perfis

A arquitetura conceitual é única; a visibilidade pode variar.

Exemplo Engenharia:

```text
Meu Trabalho
Engenharia & Produto
Obras & Operações
Contratos & Documentos
```

Financeiro:

```text
Meu Trabalho
Comercial (consulta autorizada)
Financeiro
Contratos & Documentos
```

Importação:

```text
Meu Trabalho
Suprimentos & Importação
Engenharia & Produto (consulta)
Logística
Contratos & Documentos
```

Nunca criar taxonomias contraditórias por departamento.

## 24. Métricas de sucesso

Medir:

1. tempo até encontrar tarefa;
2. cliques fora do Dossiê;
3. retornos à Sidebar;
4. buscas repetidas do mesmo objeto;
5. bloqueios sem compreensão;
6. tempo de onboarding;
7. abandono de formulário;
8. incidentes de “cadê o documento?”;
9. erros por objeto errado;
10. uso de Próxima Ação.

Metas iniciais a validar com baseline real:

```text
- ≥ 40% menos mudanças de seção em jornadas críticas;
- ≥ 50% menos retornos à Sidebar após abrir o Dossiê;
- ≥ 90% de conclusão sem pesquisa manual de outra tela;
- ≥ 95% de compreensão do estado atual em teste moderado.
```

## 25. Jornadas de teste

### J-01 — Lead até proposta

Criar oportunidade → requisitos → cotação → ficha → precificação → proposta → resposta.

### J-02 — Proposta aprovada até compra

Aceite → contrato → aval → sinal → nacional/importação → compra.

### J-03 — Importação

P.I. → RFQ → fornecedor → produção → embarque → aduaneiro → entrega logística.

### J-04 — Engenharia

Dossiê → ficha → projeto → aprovação → documentos downstream.

### J-05 — Obra

Dossiê → pendências → instalador → vistoria → NC → ART → cronograma → instalação → documentos → entrega.

### J-06 — Retorno após vários dias

O sistema deve dizer onde parou, o que mudou, o que bloqueia e o que fazer agora.

---

# PARTE III — SDD
## Software Design Document

## 26. Arquitetura lógica

```text
┌──────────────────────────────────────┐
│ CAMADA 1 — NAVEGAÇÃO GLOBAL          │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ CAMADA 2 — LANDING DE DOMÍNIO        │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ CAMADA 3 — DOSSIÊ / OBJETO           │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ CAMADA 4 — ROTA FUNCIONAL            │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ EVENTOS / AUDITORIA / TIMELINE       │
└──────────────────────────────────────┘
```

## 27. Componentes conceituais

### 27.1 `GlobalNavigation`
- domínios autorizados;
- item ativo;
- estado de grupos;
- nenhuma lógica de workflow.

### 27.2 `DomainLanding`
- filas;
- filtros;
- indicadores;
- busca;
- objetos.

### 27.3 `DossierHeader`
- identidade;
- status;
- responsáveis;
- próxima ação;
- alertas.

### 27.4 `TaskList`
- grupos de tarefas;
- estados;
- bloqueios;
- deep links;
- condição real de conclusão.

### 27.5 `ContextRouter`
- preservar IDs;
- construir deep links;
- impedir troca silenciosa de objeto.

### 27.6 `ActivityTimeline`
- evento de negócio;
- ator;
- horário;
- consequência;
- artefato relacionado.

### 27.7 `DocumentHub`
- documento associado ao objeto;
- categoria;
- versão quando aplicável;
- autorização;
- evitar arquivo órfão.

### 27.8 `GlobalSearch`
- localizar objeto;
- respeitar permissão;
- classificar tipo;
- abrir contexto.

## 28. Modelo conceitual de Task

```json
{
  "id": "completar_ficha_tecnica",
  "domain": "engenharia_produto",
  "label": "Completar ficha técnica",
  "contextType": "cotacao",
  "contextId": "NC-902",
  "status": "EM_ANDAMENTO",
  "ownerRole": "engenharia",
  "assignedTo": "user-id",
  "route": "ficha-tecnica",
  "required": true,
  "blocking": false,
  "blockedBy": [],
  "blocks": ["validar_projeto"],
  "dueAt": null,
  "completionRule": "ficha_tecnica_validada"
}
```

Modelo conceitual, não imposição de schema.

## 29. Motor de status

```text
for each task in dossier:
    if task.not_applicable(context):
        status = NAO_SE_APLICA
    else if completion_rule(context) == true:
        status = CONCLUIDO
    else if hard_dependencies_missing(context):
        status = BLOQUEADO
    else if external_wait_condition(context):
        status = AGUARDANDO_TERCEIRO
    else if work_started(context):
        status = EM_ANDAMENTO
    else:
        status = PENDENTE
```

## 30. Dependências

Cada dependência deve conter:

```text
id
origem
destino
tipo = HARD | SOFT | INFO
motivo
mensagem_usuario
```

Exemplo:

```text
contrato_assinado ─HARD→ liberar_PI
sinal_confirmado ─HARD→ liberar_PI
projeto_em_revisao ─SOFT→ preparar_ART
```

## 31. Eventos e Timeline

Evento mínimo:

```json
{
  "eventType": "CONTRATO_ASSINADO",
  "entityType": "cotacao",
  "entityId": "NC-902",
  "actorId": "user-id",
  "occurredAt": "2026-09-03T10:00:00-03:00",
  "summary": "Contrato de venda assinado",
  "source": "contrato-venda"
}
```

Timeline representa evento real, não histórico de cliques.

## 32. Permissões

```text
NAVIGATION_VISIBILITY ≠ ROUTE_AUTHORIZATION ≠ ACTION_AUTHORIZATION ≠ DATA_SCOPE
```

Exemplo: usuário pode ver Obra e contrato, mas não editar contrato nem liberar pagamento.

A segurança deve permanecer nas camadas adequadas do backend/policies, não apenas na UI.

## 33. Migração sem ruptura

### Fase 0 — Baseline

- instrumentar cliques;
- medir navegação;
- listar rotas;
- mapear permissões;
- registrar jornadas;
- congelar IDs técnicos.

### Fase 1 — IA visual

Alterar apenas:

- grupos;
- nomes;
- ordem;
- visibilidade de placeholders;
- entradas agregadoras.

Não alterar regras de negócio, banco, IDs ou permissões.

### Fase 2 — Dossiê

Adicionar:

- Header;
- Task List;
- Próxima Ação;
- Atividade;
- Documentos;
- deep links.

### Fase 3 — Reduzir Sidebar

Depois de o Dossiê estar funcional, retirar rotas de detalhe da navegação global.

### Fase 4 — Landings de domínio

Transformar áreas em filas de trabalho.

### Fase 5 — Busca global

Adicionar via expressa por objeto.

### Fase 6 — Otimização

- telemetria;
- testes;
- labels;
- mobile;
- atalhos;
- regras de dependência.

## 34. Compatibilidade com rotas legadas

Não quebrar URL apenas por mudança de IA.

Preferir:

```text
URL técnica preservada
+
novo ponto de entrada
+
breadcrumb novo
+
deep link novo
```

## 35. Antipadrões proibidos

- adicionar rota à Sidebar só porque existe;
- grupo de primeiro nível com um item sem justificativa;
- duplicar tela em dois módulos;
- mover função para o setor dono e retirar acesso contextual;
- usar tabs como workflow;
- usar breadcrumb como progresso;
- accordion aninhado para esconder excesso;
- concluir tarefa ao abrir página;
- desabilitar sem motivo;
- expor funcionalidade futura como pronta;
- usar cor como único estado;
- pedir novamente a cotação já conhecida.

## 36. Critérios de aceite técnicos

Uma mudança só está pronta quando:

- item ativo correto;
- back/forward funciona;
- deep link funciona;
- refresh preserva contexto;
- permissões são respeitadas;
- breadcrumbs coerentes;
- mobile funciona;
- teclado funciona;
- status tem texto;
- bloqueio tem motivo;
- tarefa aponta para o mesmo objeto;
- sem duplicação de dado;
- telemetria registra transição;
- rota antiga funciona ou redireciona.

## 37. Observabilidade

Eventos sugeridos:

```text
nav_global_click
domain_landing_open
dossier_open
task_open
task_complete
task_blocked_view
next_action_click
global_search
breadcrumb_click
context_lost_error
permission_denied
```

Propriedades:

```text
user_role
domain
entity_type
entity_id
route
source
target
task_id
status
```

Evitar dados pessoais desnecessários.

---

# PARTE IV — FINE-TUNING
## Padrões para agentes de IA

## 38. Prompt conceitual

```text
Você é o Arquiteto de Informação do VP Gestão de Importação.

Antes de sugerir uma nova entrada de navegação:
1. identifique o objeto;
2. classifique como domínio, tarefa, detalhe ou documento;
3. determine se precisa de acesso global;
4. determine sua casa canônica;
5. determine os acessos contextuais;
6. preserve permissões separadas da localização;
7. prefira Dossiê e Task List para tarefas de um caso;
8. não transforme a Sidebar em sitemap;
9. não duplique dados;
10. use verbo + objetivo para tarefas.

A arquitetura-alvo possui:
- navegação global curta;
- landings por domínio;
- Dossiê por caso;
- Task List com status;
- deep links contextuais;
- breadcrumbs para localização;
- Timeline para eventos;
- busca global.

Não invente significado para siglas internas.
Não altere regra de negócio apenas para simplificar UI.
```

## 39. Exemplos de treinamento

### Exemplo 01 — Checklist de Embarque

Entrada:
`Criamos /checklist-embarque. Coloque na Sidebar.`

Resposta-alvo:
`Não adicionar automaticamente. Checklist de Embarque é tarefa de um processo de importação. Casa contextual: Importação > IMP-XXX > Embarque > Checklist. A landing pode listar embarques com checklist pendente.`

### Exemplo 02 — Ficha Técnica

Entrada:
`Comercial usa Ficha Técnica. Vamos mover de Engenharia para Comercial?`

Resposta-alvo:
`Não mover a fonte técnica apenas por frequência. Manter casa canônica em Engenharia & Produto e criar deep link contextual no Dossiê, Cotação e Proposta.`

### Exemplo 03 — Resultado de Vistoria

Entrada:
`Quero Resultado de Vistoria no menu.`

Resposta-alvo:
`Resultado é saída de uma Vistoria. Não criar item global. Abrir em Obras > Vistorias > Vistoria específica > Resultado.`

### Exemplo 04 — Cotação a Fornecedor

Entrada:
`Cotação a Fornecedor fica em Financeiro porque possui preço?`

Resposta-alvo:
`Não. Solicitação e comparação pertencem a Suprimentos. Financeiro trata custo, margem, aval, risco e pagamento.`

### Exemplo 05 — ART

Entrada:
`ART é da Engenharia. Deve ficar somente lá.`

Resposta-alvo:
`Engenharia pode ser dona técnica, mas ART é tarefa da Obra. Exibir na Task List da obra preservando autorização de emissão/edição.`

### Exemplo 06 — Funcionalidade futura

Entrada:
`Expedição ainda não está pronta; deixe desabilitada na Sidebar.`

Resposta-alvo:
`Manter fora da navegação produtiva até possuir rota, propósito e fluxo utilizável.`

### Exemplo 07 — Contrato de Venda

Entrada:
`Contrato de Venda está no Jurídico e o vendedor reclama.`

Resposta-alvo:
`Não duplicar. Manter fonte normativa em Contratos & Documentos e apresentar a tarefa Formalizar contrato no Dossiê.`

### Exemplo 08 — Galeria de Fotos

Entrada:
`Criamos Galeria de Fotos. Em qual grupo da Sidebar?`

Resposta-alvo:
`Se as fotos pertencem a uma obra/vistoria, não criar grupo global. Exibir no Dossiê > Documentos/Evidências ou na Vistoria correspondente.`

### Exemplo 09 — Pagamento do Instalador

Entrada:
`Obras usa pagamento do instalador. Mover para Obras?`

Resposta-alvo:
`Não mover a operação financeira. Financeiro continua canônico. Obras recebe status e deep link quando autorizado.`

### Exemplo 10 — Linha do Tempo

Entrada:
`Linha do Tempo fica em Comercial ou Engenharia?`

Resposta-alvo:
`Nenhum dos dois como casa exclusiva. Pertence ao objeto e deve aparecer em Dossiê > Atividade.`

### Exemplo 11 — Bloqueio

Entrada:
`Botão Criar P.I. fica desabilitado antes do sinal.`

Resposta-alvo:
`Mostrar o motivo: Bloqueado — aguardando confirmação do sinal. Se possível, linkar a tarefa que desbloqueia.`

### Exemplo 12 — Sigla

Entrada:
`Expanda IMS automaticamente.`

Resposta-alvo:
`Somente com nomenclatura oficial confirmada. Não inventar expansão.`

### Exemplo 13 — Garantia

Entrada:
`Criamos Garantia. Onde fica?`

Resposta-alvo:
`Classificar antes. Se é gestão transversal pós-entrega, pode justificar landing; se é ação de entrega específica, começa no Dossiê; só ganha entrada global se houver fila e uso recorrente próprios.`

### Exemplo 14 — Dashboard

Entrada:
`Dashboard deve mostrar mais 20 KPIs.`

Resposta-alvo:
`Priorizar capacidade de agir. Meu Trabalho deve destacar pendências, decisões, riscos e prazos; KPIs secundários ficam em análises específicas.`

### Exemplo 15 — Conclusão de tarefa

Entrada:
`Ao abrir a tela de contrato, marque a tarefa como concluída.`

Resposta-alvo:
`Não. A tarefa conclui por condição de negócio verificável, como contrato assinado/validado.`

## 40. Classificação de novas funcionalidades

Classes:

```text
GLOBAL_DOMAIN
DOMAIN_LANDING
OBJECT_TASK
OBJECT_VIEW
OBJECT_DOCUMENT
ADMIN_TOOL
MASTER_DATA
REPORT_ANALYTICS
```

Heurística:

```text
É usada sem um caso específico?
  sim → global/landing/admin/master/report
  não → objeto/tarefa/view/document

É uma ação?
  sim → task

É resultado de outra ação?
  sim → view dentro do objeto

É entidade reutilizada?
  sim → master data

É detalhe técnico?
  sim → deep link, não Sidebar
```

## 41. Template para PR de navegação

```text
1. Qual problema de usuário esta mudança resolve?
2. Qual é o objeto principal?
3. É navegação global, landing, tarefa ou detalhe?
4. Qual é a casa canônica?
5. De quais contextos precisa de deep link?
6. Quais perfis visualizam?
7. Quais perfis editam?
8. Qual condição conclui a tarefa?
9. Há dependências?
10. Há impacto em breadcrumb?
11. Há impacto em busca?
12. Há rota legada?
13. Há telemetria?
14. Há teste de teclado/mobile?
15. A mudança adiciona item à Sidebar? Por que isso é indispensável?
```

---

# PARTE V — ENGENHARIA DE TRÁFEGO FINAL

## 42. Mapa macro

```text
                              ┌────────────────────┐
                              │    MEU TRABALHO    │
                              └─────────┬──────────┘
                                        │
                                        ▼
┌────────────┐     ┌─────────────────────────────────────────┐
│  BUSCA     │────▶│       COTAÇÃO / DOSSIÊ / OBRA          │
│  GLOBAL    │     │  contexto + tarefas + eventos + docs    │
└────────────┘     └───────────────┬─────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────────┐
          │                        │                            │
          ▼                        ▼                            ▼
     COMERCIAL          SUPRIMENTOS/IMPORTAÇÃO          ENGENHARIA
          │                        │                            │
          ├──────────────┐         ├──────────────┐             │
          ▼              ▼         ▼              ▼             ▼
     PROPOSTA        CONTRATO    COMPRA        EMBARQUE       PROJETO
          │              │         │              │             │
          └──────────────┴─────────┴───────┬──────┴─────────────┘
                                           │
                                           ▼
                                    OBRAS & OPERAÇÕES
                                           │
                          ┌────────────────┼────────────────┐
                          ▼                ▼                ▼
                      VISTORIA         INSTALAÇÃO      DOCUMENTAÇÃO
                          │                │                │
                          └────────────────┴────────┬───────┘
                                                   ▼
                                               ENTREGA
```

## 43. Regra de ouro

A arquitetura está correta quando um usuário consegue trabalhar em uma cotação/obra por horas sem precisar memorizar em qual departamento cada tela foi cadastrada.

Está errada quando precisa:

- sair do caso;
- abrir Sidebar;
- procurar outro departamento;
- reencontrar a mesma cotação;
- executar uma ação;
- voltar à Sidebar;
- procurar outro departamento;
- selecionar novamente a mesma obra.

Esse é o loop de tráfego a eliminar.

---

# PARTE VI — BENEFÍCIOS

## 44. Usuário

- menos caça a telas;
- menos troca de contexto;
- retomada rápida;
- clareza da próxima ação;
- bloqueios compreensíveis;
- menos seleção repetida;
- menos dependência de treinamento informal;
- coerência entre desktop e campo.

## 45. Gestão

- gargalos visíveis;
- responsabilidades mais claras;
- melhor controle de prazo;
- rastreabilidade;
- onboarding melhor;
- possibilidade de SLA por etapa.

## 46. Desenvolvimento

- Sidebar deixa de crescer junto com router;
- novas funções entram no contexto correto;
- menor duplicação;
- deep links reutilizam rotas existentes;
- permissões desacopladas da taxonomia;
- regras de status testáveis;
- telemetria valida UX.

## 47. IA e agentes

Este documento permite que uma IA:

- classifique nova função;
- preserve Single Source of Truth;
- diferencie contexto de permissão;
- entenda a jornada;
- revise PRs de navegação;
- gere testes de jornada;
- detecte regressões de IA;
- mantenha consistência entre telas.

---

# PARTE VII — DEFINITION OF DONE

## 48. Critério de pronto

```text
[ ] Sidebar global reduzida aos domínios essenciais.
[ ] Dossiê é ponto de retomada do caso.
[ ] Task List reflete condições reais.
[ ] Próxima Ação está disponível.
[ ] Vistorias não estão fragmentadas entre entrada e resultado.
[ ] Importação está organizada por processo/objeto.
[ ] Documentos estão ligados ao contexto.
[ ] Linha do Tempo está ligada ao objeto.
[ ] Ficha Técnica tem fonte única + acessos contextuais.
[ ] Instaladores têm cadastro/homologação coerentes.
[ ] Permissões são independentes da posição visual.
[ ] Busca global localiza objetos principais.
[ ] Breadcrumbs representam hierarquia.
[ ] Rotas legadas continuam válidas.
[ ] Mobile e teclado funcionam.
[ ] Telemetria mede redução de loops.
[ ] Testes com usuários mostram melhora mensurável.
```

---

# PARTE VIII — FONTES E RASTREABILIDADE

## 49. Fontes internas consolidadas

Foram considerados:

- estrutura atual da Sidebar fornecida para auditoria;
- rotas e estrutura observadas no repositório `verticalpartsIA/010_GestaoImportacao`;
- workflow da Ficha Técnica;
- Dossiê da Obra;
- Central de Documentos;
- fluxo operacional do projeto;
- estudos independentes anexados pelo usuário;
- auditoria anterior realizada neste trabalho.

Convergências de maior valor:

1. Engenharia está sobrecarregada com responsabilidades de naturezas diferentes.
2. Cotação a fornecedor não deve ter casa operacional no Financeiro.
3. Obra, instalador e documentação estão fragmentados.
4. Reorganizar a Sidebar sozinho não resolve o tráfego; o centro deve ser o objeto/Dossiê.

## 50. Referências de design

GOV.UK Design System:

- Navigate a service  
  https://design-system.service.gov.uk/patterns/navigate-a-service/

- Complete multiple tasks  
  https://design-system.service.gov.uk/patterns/complete-multiple-tasks/

- Task list  
  https://design-system.service.gov.uk/components/task-list/

- Service navigation  
  https://design-system.service.gov.uk/components/service-navigation/

- Breadcrumbs  
  https://design-system.service.gov.uk/components/breadcrumbs/

- Tabs  
  https://design-system.service.gov.uk/components/tabs/

- Accessibility strategy  
  https://design-system.service.gov.uk/accessibility/accessibility-strategy/

Princípio adotado:

> Absorver regras de arquitetura e comportamento, não copiar a estética do GOV.UK.

---

# PARTE IX — DECISÃO EXECUTIVA

## 51. Arquitetura recomendada

```text
1. SIDEBAR GLOBAL CURTA
          ↓
2. LANDING DO DOMÍNIO
          ↓
3. DOSSIÊ DO CASO + TASK LIST
          ↓
4. ROTA FUNCIONAL CONTEXTUAL
```

Sistemas transversais:

```text
BUSCA GLOBAL
ATIVIDADE / LINHA DO TEMPO
DOCUMENTOS
```

Regra estrutural:

```text
PERMISSÃO ≠ LOCALIZAÇÃO ≠ DONO DO DADO
```

## 52. North Star

> O VP Gestão deve dizer ao usuário o que precisa ser feito no caso em que ele está trabalhando e levá-lo diretamente ao ponto de execução, 
preservando contexto, responsabilidade, dependências, documentos e histórico.

Esse princípio deve governar toda nova tela, rota, card, Sidebar, breadcrumb, Task List, documento, alerta e automação do sistema.
