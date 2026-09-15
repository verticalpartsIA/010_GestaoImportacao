# Plano de Arquitetura de Banco de Dados e Mapeamento de Ativos RAG
## GOV.UK Design System Knowledge Base (100 Fontes)

Este relatório técnico apresenta uma especificação de arquitetura de banco de dados e estratégias de processamento de linguagem natural (NLP) para a 
implementação de um sistema de **Retrieval-Augmented Generation (RAG)** de nível empresarial baseado nas **100 fontes** do GOV.UK Design System fornecidas.

---

## 1. Visão Geral da Arquitetura do RAG

Implementar RAG em documentação de engenharia e UX (User Experience) apresenta desafios únicos: os desenvolvedores buscam códigos exatos (HTML/Nunjucks), 
designers buscam regras visuais específicas, e analistas de negócios buscam fluxos funcionais. Um sistema RAG genérico (ingestão e chunking simples por caracteres)
falha ao misturar regras de usabilidade com implementações de código.

Esta arquitetura propõe um **RAG Híbrido baseado em Metadados e Chunking Semântico/Sintático**:

```
[ Pergunta do Usuário ]
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│     Pipeline de Recuperação Híbrida (Hybrid Retrieval)   │
│  ┌───────────────────────┐   ┌───────────────────────┐  │
│  │   Dense Retrieval     │   │   Sparse Retrieval    │  │
│  │ (Embeddings Vetoriais)│   │ (BM25 - Palavras-Chave)  │  │
│  └───────────┬───────────┘   └───────────┬───────────┘  │
└──────────────┼───────────────────────────┼──────────────┘
               │                           │
               └─────────────┬─────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│              Reranking (Cross-Encoder / Cohere)         │
├─────────────────────────────────────────────────────────┤
│    Filtragem de Metadados Baseado na Intenção da Query   │
│    (ex: filter Component vs Pattern vs Style)           │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
     [ Contexto Enriquecido + Prompt Grounded ] -> [ LLM ]
```

---

## 2. Mapeamento e Categorização das 100 Fontes

Para garantir alta precisão, cada fonte deve ser indexada com metadados estritos no banco de dados. Abaixo, as 100 fontes são categorizadas 
em **quatro domínios principais** do sistema de design:

### 2.1. Componentes (UI Components) — [87]
Elementos de interface reutilizáveis com código específico, regras de acessibilidade e opções de macros em Nunjucks.

| ID | Nome do Ativo no GOV.UK Design System | URLs de Referência / Tipo | Metadados de Mapeamento RAG |
|---|---|---|---|
| CC-01 | Accordion | `https://design-system.service.gov.uk/components/accordion/` | Componente Colapsável, Nunjucks, HTML [2] |
| CC-02 | Back link | `https://design-system.service.gov.uk/components/back-link/` | Navegação, Acessibilidade [2] |
| CC-03 | Breadcrumbs | `https://design-system.service.gov.uk/components/breadcrumbs/` | Navegação de Caminho [2] |
| CC-04 | Button | `https://design-system.service.gov.uk/components/button/` | Ação, Formulário, Submissão [2] |
| CC-05 | Character count | `https://design-system.service.gov.uk/components/character-count/` | Validação de Entrada, Textarea [2] |
| CC-06 | Checkboxes | `https://design-system.service.gov.uk/components/checkboxes/` | Seleção Múltipla [2] |
| CC-07 | Cookie banner | `https://design-system.service.gov.uk/components/cookie-banner/` | Notificação Legal, Banner [2] |
| CC-08 | Date input | `https://design-system.service.gov.uk/components/date-input/` | Entrada de Data, Formuário, Fieldset [2] |
| CC-09 | Details | `https://design-system.service.gov.uk/components/details/` | Revelação Progressiva, Acordo de Conteúdo [2] |
| CC-10 | Error message | `https://design-system.service.gov.uk/components/error-message/` | Validação, Mensagem de Erro [2] |
| CC-11 | Error summary | `https://design-system.service.gov.uk/components/error-summary/` | Sumário de Erros no Topo, Acessibilidade [2] |
| CC-12 | Exit this page | `https://design-system.service.gov.uk/components/exit-this-page/` | Segurança do Usuário, Saída Rápida [2] |
| CC-13 | Feedback | `https://design-system.service.gov.uk/components/feedback/` | Coleta de Opinião, Formulário de Feedback [2] |
| CC-14 | Fieldset | `https://design-system.service.gov.uk/components/fieldset/` | Agrupamento de Entradas, Lendas [2] |
| CC-15 | File upload | `https://design-system.service.gov.uk/components/file-upload/` | Envio de Arquivos [2] |
| CC-16 | Generic header | `https://design-system.service.gov.uk/components/generic-header/` | Estrutura de Cabeçalho Geral [2] |
| CC-17 | GOV.UK footer | `https://design-system.service.gov.uk/components/footer/` | Estrutura de Rodapé Padrão [2] |
| CC-18 | GOV.UK header | `https://design-system.service.gov.uk/components/header/` | Estrutura de Cabeçalho com Logo da Coroa [2] |
| CC-19 | Inset text | `https://design-system.service.gov.uk/components/inset-text/` | Destaque Visual, Texto Recuado [2] |
| CC-20 | Language navigation | `https://design-system.service.gov.uk/components/language-navigation/` | Troca de Idioma (ex: Welsh) [2] |
| CC-21 | Notification banner | `https://design-system.service.gov.uk/components/notification-banner/` | Avisos Importantes, Alertas [2] |
| CC-22 | Pagination | `https://design-system.service.gov.uk/components/pagination/` | Divisão de Listas Longas [2] |
| CC-23 | Panel | `https://design-system.service.gov.uk/components/panel/` | Confirmação Visual de Sucesso [2] |
| CC-24 | Password input | `https://design-system.service.gov.uk/components/password-input/` | Entrada de Senha com Opção Revelar [2] |
| CC-25 | Phase banner | `https://design-system.service.gov.uk/components/phase-banner/` | Status do Serviço (Beta/Alpha) [2] |
| CC-26 | Radios | `https://design-system.service.gov.uk/components/radios/` | Seleção Única [2] |
| CC-27 | Select | `https://design-system.service.gov.uk/components/select/` | Menu Suspenso [2] |
| CC-28 | Service navigation | `https://design-system.service.gov.uk/components/service-navigation/` | Navegação Interna do Serviço [2] |
| CC-29 | Skip link | `https://design-system.service.gov.uk/components/skip-link/` | Atalho de Acessibilidade Teclado [2] |
| CC-30 | Summary list | `https://design-system.service.gov.uk/components/summary-list/` | Pares de Chave-Valor, Revisão de Respostas [2] |
| CC-31 | Table | `https://design-system.service.gov.uk/components/table/` | Dados Tabulares, Comparação [2] |
| CC-32 | Tabs | `https://design-system.service.gov.uk/components/tabs/` | Abas de Conteúdo Alternável [2] |
| CC-33 | Tag | `https://design-system.service.gov.uk/components/tag/` | Badges de Status [2] |
| CC-34 | Task list | `https://design-system.service.gov.uk/components/task-list/` | Lista de Tarefas, Progresso de Jornada [2] |
| CC-35 | Text input | `https://design-system.service.gov.uk/components/text-input/` | Entrada de Linha Única [2] |
| CC-36 | Textarea | `https://design-system.service.gov.uk/components/textarea/` | Entrada de Múltiplas Linhas [2] |
| CC-37 | Warning text | `https://design-system.service.gov.uk/components/warning-text/` | Alertas Importantes com Ícone [2] |
| CC-38 | Components (Overview) | `https://design-system.service.gov.uk/components/` | Índice Geral de Componentes [87] |

### 2.2. Estilos (Styles) — [453]
Fundamentos visuais, tipográficos e estruturais das páginas governamentais.

| ID | Nome do Ativo no GOV.UK Design System | URLs de Referência / Tipo | Metadados de Mapeamento RAG |
|---|---|---|---|
| ST-01 | Colour | `https://design-system.service.gov.uk/styles/colour/` | Paleta de Cores, Contraste AA [59] |
| ST-02 | Font override classes | `https://design-system.service.gov.uk/styles/font-override-classes/` | Classes Utilitárias de Tipografia [59] |
| ST-03 | Headings | `https://design-system.service.gov.uk/styles/headings/` | Títulos, H1, H2, H3, Hierarchy [59] |
| ST-04 | Images | `https://design-system.service.gov.uk/styles/images/` | Imagens Acessíveis, Alt Text, SVG, Gráficos [59] |
| ST-05 | Layout | `https://design-system.service.gov.uk/styles/layout/` | Sistema de Grid, Colunas, Responsividade [59] |
| ST-06 | Links | `https://design-system.service.gov.uk/styles/links/` | Estilos de Links, Estados [59] |
| ST-07 | Lists | `https://design-system.service.gov.uk/styles/lists/` | Listas Ordenadas, Não Ordenadas, Espaçamento [59] |
| ST-08 | Paragraphs | `https://design-system.service.gov.uk/styles/paragraphs/` | Tamanho Padrão (19px), Classes de Parágrafo [59] |
| ST-09 | Section break | `https://design-system.service.gov.uk/styles/section-break/` | Divisores Horizontais (`<hr>`) [59] |
| ST-10 | Spacing | `https://design-system.service.gov.uk/styles/spacing/` | Escala de Espaçamento Responsiva e Estática [59] |
| ST-11 | Type scale | `https://design-system.service.gov.uk/styles/type-scale/` | Escala Tipográfica (16px a 80px) [59] |
| ST-12 | Typeface | `https://design-system.service.gov.uk/styles/typeface/` | Fontes Oficiais (GDS Transport) [59] |
| ST-13 | Styles (Overview) | `https://design-system.service.gov.uk/styles/` | Visão Geral dos Padrões Estéticos [1, 2] |

### 2.3. Padrões de UX (UX Patterns) — [63]
Guias para ajudar usuários a realizar tarefas específicas. Essas páginas focam fortemente no fluxo de interação e comportamento do usuário.

| ID | Nome do Ativo no GOV.UK Design System | URLs de Referência / Tipo | Metadados de Mapeamento RAG |
|---|---|---|---|
| PT-01 | Addresses | `https://design-system.service.gov.uk/patterns/addresses/` | Coleta de Endereço, Autocomplete [12] |
| PT-02 | Bank details | `https://design-system.service.gov.uk/patterns/bank-details/` | Coleta de Dados Bancários [20] |
| PT-03 | Check a service is suitable | `https://design-system.service.gov.uk/patterns/check-a-service-is-suitable/` | Validação de Pré-requisitos [45] |
| PT-04 | Check answers | `https://design-system.service.gov.uk/patterns/check-answers/` | Tela de Revisão Antes de Enviar [49] |
| PT-05 | Complete multiple tasks | `https://design-system.service.gov.uk/patterns/complete-multiple-tasks/` | Fluxos de Múltiplos Passos [83] |
| PT-06 | Confirm a phone number | `https://design-system.service.gov.uk/patterns/confirm-a-phone-number/` | Verificação de Telefone, SMS |
| PT-07 | Confirm an email address | `https://design-system.service.gov.uk/patterns/confirm-an-email-address/` | Verificação de E-mail |
| PT-08 | Confirmation pages | `https://design-system.service.gov.uk/patterns/confirmation-pages/` | Tela Final de Sucesso, Recibo [99] |
| PT-09 | Contact a department or service team | `https://design-system.service.gov.uk/patterns/contact-a-department-or-service-team/` | 
Informações de Suporte e Atendimento [104] |
| PT-10 | Cookies page | `https://design-system.service.gov.uk/patterns/cookies-page/` | Configurações de Consentimento |
| PT-11 | Create a username | `https://design-system.service.gov.uk/patterns/create-a-username/` | Nome de Usuário vs E-mail, Regras de Registro [116] |
| PT-12 | Create accounts | `https://design-system.service.gov.uk/patterns/create-accounts/` | Autenticação, Registro, Contas |
| PT-13 | Dates | `https://design-system.service.gov.uk/patterns/dates/` | Coleta de Datas, Meses por Extenso [127] |
| PT-14 | Email addresses | `https://design-system.service.gov.uk/patterns/email-addresses/` | Coleta de E-mails, Autocomplete [146] |
| PT-15 | Equality information | `https://design-system.service.gov.uk/patterns/equality-information/` | Coleta de Dados Protegidos (Equality Act) [150] |
| PT-16 | Exit a page quickly | `https://design-system.service.gov.uk/patterns/exit-a-page-quickly/` | Atalhos de Fuga para Usuários em Perigo [161] |
| PT-17 | Interruption pages | `https://design-system.service.gov.uk/patterns/interruption-pages/` | Páginas de Interrupção para Consentimento Crítico |
| PT-18 | Names | `https://design-system.service.gov.uk/patterns/names/` | Coleta de Nomes Completos, Evitar Títulos [291] |
| PT-19 | National Insurance numbers | `https://design-system.service.gov.uk/patterns/national-insurance-numbers/` | Coleta de NINO (Documento Britânico) |
| PT-20 | Navigate a service | `https://design-system.service.gov.uk/patterns/navigate-a-service/` | Estratégia de Navegação de Serviços [298] |
| PT-21 | Page not found pages | `https://design-system.service.gov.uk/patterns/page-not-found-pages/` | Erro 404, Alternativas de Recuperação [306] |
| PT-22 | Passwords | `https://design-system.service.gov.uk/patterns/passwords/` | Requisitos de Senha, Segurança [337] |
| PT-23 | Payment card details | `https://design-system.service.gov.uk/patterns/payment-card-details/` | Coleta de Dados de Cartão [344] |
| PT-24 | Phone numbers | `https://design-system.service.gov.uk/patterns/phone-numbers/` | Coleta de Telefones, Internacionais [352] |
| PT-25 | Recover from validation errors | `https://design-system.service.gov.uk/patterns/validation/` | Guias de Recuperação de Validação de Formulário [396] |
| PT-26 | Service unavailable pages | `https://design-system.service.gov.uk/patterns/service-unavailable-pages/` | Erro 503, Mensagens de Manutenção [427] |
| PT-27 | Start using a service | `https://design-system.service.gov.uk/patterns/start-using-a-service/` | Página de Entrada do Serviço, Botão Iniciar [446] |
| PT-28 | Step by step navigation | `https://design-system.service.gov.uk/patterns/step-by-step-navigation/` | Navegação de Passos Sequenciais [449] |
| PT-29 | There is a problem with the service pages | `https://design-system.service.gov.uk/patterns/problem-with-the-service-pages/` | Erros Inesperados, 
Manutenção Excedida [527] |
| PT-30 | Patterns (Overview) | `https://design-system.service.gov.uk/patterns/` | Índice de Melhores Práticas UX [2, 63] |

### 2.4. Guias de Configuração, Comunidade e Meta (Setup & Meta)
Documentos focados no ecossistema, contribuição para o repositório, setup inicial de projetos e ciclos de desenvolvimento.

| ID | Nome do Ativo no GOV.UK Design System | URLs de Referência / Tipo | Metadados de Mapeamento RAG |
|---|---|---|---|
| MT-01 | Get started (Overview) | `https://design-system.service.gov.uk/get-started/` | Entrada Geral, Primeiros Passos [222] |
| MT-02 | Prototyping | `https://design-system.service.gov.uk/get-started/prototyping/` | Uso do GOV.UK Prototype Kit [374] |
| MT-03 | Production | `https://design-system.service.gov.uk/get-started/production/` | GOV.UK Frontend em Produção, Naming BEM [356] |
| MT-04 | Making labels and legends headings | `https://design-system.service.gov.uk/get-started/labels-legends-headings/` | Como agrupar labels em H1 [276] |
| MT-05 | Extending and modifying components in production | `https://design-system.service.gov.uk/get-started/extending-and-modifying-components/` | 
BEM modifiers, Custom prefixes [169] |
| MT-06 | Understanding focus state styles | `https://design-system.service.gov.uk/get-started/focus-states/` | Estados de foco, Acessibilidade [546] |
| MT-07 | Using the updated type scale | `https://design-system.service.gov.uk/get-started/new-type-scale/` | Migração para a Escala de Tipografia v6.0.0 [559] |
| MT-08 | Community (Overview) | `https://design-system.service.gov.uk/community/` | Visão Geral da Comunidade [71] |
| MT-09 | Community principles | `https://design-system.service.gov.uk/community/community-principles/` | Compartilhamento, Princípios de Colaboração [64] |
| MT-10 | Develop a component or pattern | `https://design-system.service.gov.uk/community/develop-a-component-or-pattern/` | Processo de desenvolvimento e aprovação [135] |
| MT-11 | Propose a component or pattern | `https://design-system.service.gov.uk/community/propose-a-component-or-pattern/` | Backlog do GitHub, Critérios de Contribuição 
[362] |
| MT-12 | Propose a content change using GitHub | `https://design-system.service.gov.uk/community/propose-a-content-change-using-github/` | Pull Requests, Issues [369] |
| MT-13 | Roadmap | `https://design-system.service.gov.uk/community/roadmap/` | Planos Futuros, Dark Mode, AI [400] |
| MT-14 | Share findings about your users | `https://design-system.service.gov.uk/community/share-research-findings/` | Pesquisa Continuada, Templates de Teste [431] |
| MT-15 | Take part in our research | `https://design-system.service.gov.uk/community/continuous-research/` | Programa de Pesquisa de Usabilidade do GDS [496] |
| MT-16 | Upcoming components and patterns | `https://design-system.service.gov.uk/community/upcoming-components-patterns/` | Prioridades do Backlog [551] |
| MT-17 | What's new | `https://design-system.service.gov.uk/community/whats-new/` | Notas de Lançamento, Atualização para v6.0.0 [567] |

---

## 3. Especificação do Banco de Dados Relacional e Vetorial

Para garantir que o agente RAG forneça respostas altamente fundamentadas e links exatos de código, o banco de dados deve manter uma 
sincronia rígida entre os metadados relacionais e os vetores densos.

### 3.1. Esquema Relacional (PostgreSQL / pgvector)

```sql
-- Habilitar a extensão pgvector para armazenar os vetores de embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela principal de documentos (Metadados do Ativo)
CREATE TABLE design_system_documents (
    document_id VARCHAR(10) PRIMARY KEY,     -- ex: 'CC-01', 'PT-14'
    title VARCHAR(255) NOT NULL,             -- ex: 'Accordion – GOV.UK Design System'
    slug VARCHAR(100) UNIQUE NOT NULL,       -- ex: 'accordion'
    category VARCHAR(50) NOT NULL,           -- ex: 'Component', 'Style', 'Pattern', 'Meta'
    url VARCHAR(255) NOT NULL,               -- ex: 'https://design-system.service.gov.uk/components/accordion/'
    status VARCHAR(20) DEFAULT 'stable',     -- ex: 'stable', 'trial', 'proposed'
    wcag_relevance VARCHAR(100),             -- ex: 'WCAG 2.2 1.4.3 AA'
    last_updated DATE
);

-- Tabela de Chunks Semânticos (Segmentação de Texto para Busca Vetorial)
CREATE TABLE document_chunks (
    chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR(10) REFERENCES design_system_documents(document_id) ON DELETE CASCADE,
    parent_chunk_id UUID,                     -- Suporte a chunking de dois níveis (Parent-Child)
    content TEXT NOT NULL,                    -- O texto limpo do chunk
    has_code_block BOOLEAN DEFAULT FALSE,     -- Flag para acelerar queries de desenvolvimento
    embedding VECTOR(1536),                  -- Vetor de embeddings (ex: OpenAI text-embedding-3-small ou Gemini Embeddings)
    metadata JSONB                            -- Metadados altamente específicos do chunk (níveis de headers, etc.)
);

-- Criar índice HNSW para busca vetorial de alta performance
CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

### 3.2. Esquema de Chaves e Metadados para Bancos NoSQL No-Code (ex: Pinecone / Chroma)

Se você preferir um pipeline serverless como Pinecone ou Chroma, cada objeto vetorizado deve carregar os seguintes metadados em seu JSON Payload:

```json
{
  "id": "CC-01_chunk_42",
  "values": [0.0123, -0.0456, ..., 0.789], 
  "metadata": {
    "document_id": "CC-01",
    "title": "Accordion",
    "category": "Component",
    "url": "https://design-system.service.gov.uk/components/accordion/",
    "has_code": true,
    "wcag_criterion": "1.3.1 Info and Relationships",
    "chunk_type": "nunjucks_example",
    "parent_heading": "Nunjucks macro options"
  }
}
```

---

## 4. Estratégia Avançada de Chunking e Vetorização

Documentação técnica é notoriamente mal processada por métodos de chunking comuns (como dividir o texto a cada 500 caracteres, 
pois isso quebra blocos de código e separa o contexto semântico). Propõe-se a seguinte estratégia:

### 4.1. Parent-Child Chunking (Hierárquico)
1. **Chunks Pais (Semânticos Longos — ~2000 tokens)**: Abrangem uma seção inteira de um componente (ex: toda a seção "Como funciona" 
ou "Pesquisa sobre este componente"). São usados para fornecer contexto completo ao LLM.
2. **Chunks Filhos (Altamente Focados — ~250 tokens)**: Fragmentos específicos (ex: uma opção macro de Nunjucks ou uma única regra de contraste). 
O algoritmo de busca vetorial busca os vetores dos chunks filhos para maior precisão matemática, mas o pipeline do RAG entrega o chunk pai associado para o LLM. 
Isso evita que o modelo receba instruções truncadas.

### 4.2. Estratégia Sintática de Extração de Códigos
Os blocos de código HTML e Nunjucks (como as macros `govukCharacterCount` ou `govukRadios`) devem ser parseados sintaticamente:
- **Preservação de Escopo**: O arquivo markdown de origem deve passar por um parser que identifica os marcadores de código ` ```html ` ou ` ```nunjucks `.
- **Tags de Ancoragem**: Adicione metadados textuais acima do código para que o Embedding capture a relação de busca, por exemplo:
  ```html
  <!-- RAG_METADATA: Component=Accordion, Type=HTML_Implementation -->
  <div class="govuk-accordion" data-module="govuk-accordion" ...>
  ```

### 4.3. Serialização de Tabelas de Opções (Macros)
As especificações do GOV.UK Design System contêm muitas tabelas relacionais que definem os parâmetros das macros em Nunjucks. Se as tabelas 
forem convertidas diretamente para texto plano, a relação de linhas e colunas se perde.
* **Solução**: O pipeline de processamento deve converter as tabelas HTML para representações semânticas estruturadas (YAML ou JSON) antes de gerar o embedding.
* **Exemplo de Conversão**:
  * *Original (Markdown Table)*:
    ```markdown
    | Name | Type | Description |
    | text | string | Required. The heading text. |
    ```
  * *Convertido para o Chunk RAG*:
    > "O parâmetro de macro 'text' do tipo 'string' é Obrigatório (Required) e tem a seguinte descrição: The heading text of each section."

---

## 5. Implementação de Retrieval Híbrido (Hybrid Retrieval)

Para maximizar a precisão, a query do desenvolvedor deve passar por dois pipelines de recuperação complementares antes de chegar ao LLM:

### 5.1. Pesquisa Vetorial Semântica (Dense Retrieval)
Focada em conceitos abstratos, intenções e sinônimos.
* *Query*: "Como fazer para dar destaque em uma frase informativa secundária?"
* *Recuperação Semântica*: Retorna o componente **Inset text (CC-19)** ("Destaque Visual, Texto Recuado" [2]) mesmo que a query não use o termo exato "inset text".

### 5.2. Pesquisa por Palavras-Chave (Sparse Retrieval - BM25)
Focada em termos de código, nomes exatos de classes CSS e macros.
* *Query*: "`govuk-accordion__section-header`"
* *Recuperação de Palavras-Chave*: Recupera o chunk exato do Accordion contendo a implementação do HTML com a classe estrutural CSS [6].

### 5.3. Algoritmo de Fusão de Scores (RRF - Reciprocal Rank Fusion)
A fusão dos resultados garante que ambos os canais de busca contribuam para a classificação final:

$$RRF\_Score(d) = \frac{1}{60 + Rank_{Dense}(d)} + \frac{1}{60 + Rank_{Sparse}(d)}$$

---

## 6. Template de Prompt Customizado e Grounded (Sufixo de Segurança)

Para evitar alucinações de componentes que não pertencem ao sistema oficial, o prompt final enviado ao LLM de geração deve ser configurado como abaixo:

```
Você é o assistente oficial de engenharia do GOV.UK Design System. Seu trabalho é responder à pergunta do usuário utilizando APENAS os trechos de 
documentação fornecidos no contexto.

REGRAS RÍGIDAS DE GERAÇÃO:
1. Se o contexto não contiver uma resposta direta ou se houver insuficiência de dados, diga honestamente: "Não consegui encontrar essa especificação 
na documentação fornecida." Nunca tente criar código que não esteja estruturado no contexto.
2. Sempre utilize as classes CSS oficiais do GOV.UK (prefixo "govuk-") de acordo com as regras BEM.
3. Se fornecer código Nunjucks, inclua a importação correta da macro (ex: "{% from 'govuk/components/.../macro.njk' import govuk... %}").
4. Faça citações utilizando colchetes, como [1], [2], baseando-se nos índices fornecidos no contexto.

---
CONTEXTO DE DOCUMENTAÇÃO RECUPERADO:
{contexto_recuperado}
---

PERGUNTA: {pergunta_usuario}
RESPOSTA GROUNDED (EM PORTUGUÊS):
```

---

## 7. Próximos Passos Recomendados para Implementação

1. **Pipeline de Ingestão (Python + BeautifulSoup/MarkItDown)**: Desenvolver um script Python para baixar o HTML das URLs oficiais ou 
ler o repositório oficial do GitHub do `govuk-design-system` e converter para Markdown estruturado.
2. **Camada de Embeddings**: Recomenda-se o modelo `text-embedding-3-small` da OpenAI ou o `Gecko` do Google 
( Gemini Embeddings) configurados para tamanho padrão de 1536 dimensões.
3. **Engine de Banco de Dados**: Se a equipe já trabalha com infraestrutura PostgreSQL tradicional, utilize o `pgvector` por sua facilidade de manutenção e 
suporte nativo a Joins relacionais. Para arquiteturas serverless distribuídas, opte por Chroma ou Pinecone.

---

## 8. Apêndice: Dicionário de Mapeamento Direto de URLs Absolutas para Agentes LLM

Para permitir que agentes inteligentes e sistemas RAG com capacidade de navegação em tempo real consultem a documentação oficial diretamente na web, 
abaixo está estruturado o dicionário completo de mapeamento de IDs do banco de dados para suas respectivas URLs absolutas oficiais.

### 8.1. Mapeamento de Componentes (CC)
* **CC-01 (Accordion)**: https://design-system.service.gov.uk/components/accordion/
* **CC-02 (Back link)**: https://design-system.service.gov.uk/components/back-link/
* **CC-03 (Breadcrumbs)**: https://design-system.service.gov.uk/components/breadcrumbs/
* **CC-04 (Button)**: https://design-system.service.gov.uk/components/button/
* **CC-05 (Character count)**: https://design-system.service.gov.uk/components/character-count/
* **CC-06 (Checkboxes)**: https://design-system.service.gov.uk/components/checkboxes/
* **CC-07 (Cookie banner)**: https://design-system.service.gov.uk/components/cookie-banner/
* **CC-08 (Date input)**: https://design-system.service.gov.uk/components/date-input/
* **CC-09 (Details)**: https://design-system.service.gov.uk/components/details/
* **CC-10 (Error message)**: https://design-system.service.gov.uk/components/error-message/
* **CC-11 (Error summary)**: https://design-system.service.gov.uk/components/error-summary/
* **CC-12 (Exit this page)**: https://design-system.service.gov.uk/components/exit-this-page/
* **CC-13 (Feedback)**: https://design-system.service.gov.uk/components/feedback/
* **CC-14 (Fieldset)**: https://design-system.service.gov.uk/components/fieldset/
* **CC-15 (File upload)**: https://design-system.service.gov.uk/components/file-upload/
* **CC-16 (Generic header)**: https://design-system.service.gov.uk/components/generic-header/
* **CC-17 (GOV.UK footer)**: https://design-system.service.gov.uk/components/footer/
* **CC-18 (GOV.UK header)**: https://design-system.service.gov.uk/components/header/
* **CC-19 (Inset text)**: https://design-system.service.gov.uk/components/inset-text/
* **CC-20 (Language navigation)**: https://design-system.service.gov.uk/components/language-navigation/
* **CC-21 (Notification banner)**: https://design-system.service.gov.uk/components/notification-banner/
* **CC-22 (Pagination)**: https://design-system.service.gov.uk/components/pagination/
* **CC-23 (Panel)**: https://design-system.service.gov.uk/components/panel/
* **CC-24 (Password input)**: https://design-system.service.gov.uk/components/password-input/
* **CC-25 (Phase banner)**: https://design-system.service.gov.uk/components/phase-banner/
* **CC-26 (Radios)**: https://design-system.service.gov.uk/components/radios/
* **CC-27 (Select)**: https://design-system.service.gov.uk/components/select/
* **CC-28 (Service navigation)**: https://design-system.service.gov.uk/components/service-navigation/
* **CC-29 (Skip link)**: https://design-system.service.gov.uk/components/skip-link/
* **CC-30 (Summary list)**: https://design-system.service.gov.uk/components/summary-list/
* **CC-31 (Table)**: https://design-system.service.gov.uk/components/table/
* **CC-32 (Tabs)**: https://design-system.service.gov.uk/components/tabs/
* **CC-33 (Tag)**: https://design-system.service.gov.uk/components/tag/
* **CC-34 (Task list)**: https://design-system.service.gov.uk/components/task-list/
* **CC-35 (Text input)**: https://design-system.service.gov.uk/components/text-input/
* **CC-36 (Textarea)**: https://design-system.service.gov.uk/components/textarea/
* **CC-37 (Warning text)**: https://design-system.service.gov.uk/components/warning-text/
* **CC-38 (Components Overview)**: https://design-system.service.gov.uk/components/

### 8.2. Mapeamento de Estilos (ST)
* **ST-01 (Colour)**: https://design-system.service.gov.uk/styles/colour/
* **ST-02 (Font override classes)**: https://design-system.service.gov.uk/styles/font-override-classes/
* **ST-03 (Headings)**: https://design-system.service.gov.uk/styles/headings/
* **ST-04 (Images)**: https://design-system.service.gov.uk/styles/images/
* **ST-05 (Layout)**: https://design-system.service.gov.uk/styles/layout/
* **ST-06 (Links)**: https://design-system.service.gov.uk/styles/links/
* **ST-07 (Lists)**: https://design-system.service.gov.uk/styles/lists/
* **ST-08 (Paragraphs)**: https://design-system.service.gov.uk/styles/paragraphs/
* **ST-09 (Section break)**: https://design-system.service.gov.uk/styles/section-break/
* **ST-10 (Spacing)**: https://design-system.service.gov.uk/styles/spacing/
* **ST-11 (Type scale)**: https://design-system.service.gov.uk/styles/type-scale/
* **ST-12 (Typeface)**: https://design-system.service.gov.uk/styles/typeface/
* **ST-13 (Styles Overview)**: https://design-system.service.gov.uk/styles/

### 8.3. Mapeamento de Padrões de UX (PT)
* **PT-01 (Addresses)**: https://design-system.service.gov.uk/patterns/addresses/
* **PT-02 (Bank details)**: https://design-system.service.gov.uk/patterns/bank-details/
* **PT-03 (Check a service is suitable)**: https://design-system.service.gov.uk/patterns/check-a-service-is-suitable/
* **PT-04 (Check answers)**: https://design-system.service.gov.uk/patterns/check-answers/
* **PT-05 (Complete multiple tasks)**: https://design-system.service.gov.uk/patterns/complete-multiple-tasks/
* **PT-06 (Confirm a phone number)**: https://design-system.service.gov.uk/patterns/confirm-a-phone-number/
* **PT-07 (Confirm an email address)**: https://design-system.service.gov.uk/patterns/confirm-an-email-address/
* **PT-08 (Confirmation pages)**: https://design-system.service.gov.uk/patterns/confirmation-pages/
* **PT-09 (Contact a department or service team)**: https://design-system.service.gov.uk/patterns/contact-a-department-or-service-team/
* **PT-10 (Cookies page)**: https://design-system.service.gov.uk/patterns/cookies-page/
* **PT-11 (Create a username)**: https://design-system.service.gov.uk/patterns/create-a-username/
* **PT-12 (Create accounts)**: https://design-system.service.gov.uk/patterns/create-accounts/
* **PT-13 (Dates)**: https://design-system.service.gov.uk/patterns/dates/
* **PT-14 (Email addresses)**: https://design-system.service.gov.uk/patterns/email-addresses/
* **PT-15 (Equality information)**: https://design-system.service.gov.uk/patterns/equality-information/
* **PT-16 (Exit a page quickly)**: https://design-system.service.gov.uk/patterns/exit-a-page-quickly/
* **PT-17 (Interruption pages)**: https://design-system.service.gov.uk/patterns/interruption-pages/
* **PT-18 (Names)**: https://design-system.service.gov.uk/patterns/names/
* **PT-19 (National Insurance numbers)**: https://design-system.service.gov.uk/patterns/national-insurance-numbers/
* **PT-20 (Navigate a service)**: https://design-system.service.gov.uk/patterns/navigate-a-service/
* **PT-21 (Page not found pages)**: https://design-system.service.gov.uk/patterns/page-not-found-pages/
* **PT-22 (Passwords)**: https://design-system.service.gov.uk/patterns/passwords/
* **PT-23 (Payment card details)**: https://design-system.service.gov.uk/patterns/payment-card-details/
* **PT-24 (Phone numbers)**: https://design-system.service.gov.uk/patterns/phone-numbers/
* **PT-25 (Recover from validation errors)**: https://design-system.service.gov.uk/patterns/validation/
* **PT-26 (Service unavailable pages)**: https://design-system.service.gov.uk/patterns/service-unavailable-pages/
* **PT-27 (Start using a service)**: https://design-system.service.gov.uk/patterns/start-using-a-service/
* **PT-28 (Step by step navigation)**: https://design-system.service.gov.uk/patterns/step-by-step-navigation/
* **PT-29 (There is a problem with the service pages)**: https://design-system.service.gov.uk/patterns/problem-with-the-service-pages/
* **PT-30 (Patterns Overview)**: https://design-system.service.gov.uk/patterns/

### 8.4. Mapeamento de Meta-Documentos e Setup (MT)
* **MT-01 (Get started Overview)**: https://design-system.service.gov.uk/get-started/
* **MT-02 (Prototyping)**: https://design-system.service.gov.uk/get-started/prototyping/
* **MT-03 (Production)**: https://design-system.service.gov.uk/get-started/production/
* **MT-04 (Making labels and legends headings)**: https://design-system.service.gov.uk/get-started/labels-legends-headings/
* **MT-05 (Extending and modifying components in production)**: https://design-system.service.gov.uk/get-started/extending-and-modifying-components/
* **MT-06 (Understanding focus state styles)**: https://design-system.service.gov.uk/get-started/focus-states/
* **MT-07 (Using the updated type scale)**: https://design-system.service.gov.uk/get-started/new-type-scale/
* **MT-08 (Community Overview)**: https://design-system.service.gov.uk/community/
* **MT-09 (Community principles)**: https://design-system.service.gov.uk/community/community-principles/
* **MT-10 (Develop a component or pattern)**: https://design-system.service.gov.uk/community/develop-a-component-or-pattern/
* **MT-11 (Propose a component or pattern)**: https://design-system.service.gov.uk/community/propose-a-component-or-pattern/
* **MT-12 (Propose a content change using GitHub)**: https://design-system.service.gov.uk/community/propose-a-content-change-using-github/
* **MT-13 (Roadmap)**: https://design-system.service.gov.uk/community/roadmap/
* **MT-14 (Share findings about your users)**: https://design-system.service.gov.uk/community/share-research-findings/
* **MT-15 (Take part in our research)**: https://design-system.service.gov.uk/community/continuous-research/
* **MT-16 (Upcoming components and patterns)**: https://design-system.service.gov.uk/community/upcoming-components-patterns/
* **MT-17 (What's new)**: https://design-system.service.gov.uk/community/whats-new/

## Repositórios GitHub
https://github.com/alphagov/govuk-frontend
https://github.com/alphagov/accessible-autocomplete
https://github.com/alphagov/govuk-design-system
https://github.com/alphagov/govuk_frontend_toolkit
https://github.com/alphagov/govuk_elements
https://github.com/alphagov/govuk_template
https://github.com/alphagov/govuk-design-system-backlog
https://github.com/alphagov/govuk-country-and-territory-autocomplete
https://github.com/alphagov/govuk-frontend-docs
https://github.com/alphagov/govuk-design-system-architecture
https://github.com/alphagov/govuk_frontend_toolkit_npm
https://github.com/alphagov/stylelint-config-gds
https://github.com/alphagov/design-system-team-docs
https://github.com/alphagov/govuk_template_mustache
https://github.com/alphagov/govuk_elements_rails
https://github.com/alphagov/prototype-kit-training
https://github.com/alphagov/govuk_template_play
https://github.com/alphagov/design-system-support
https://github.com/alphagov/govuk_template_jinja
https://github.com/alphagov/govuk_template_ejs