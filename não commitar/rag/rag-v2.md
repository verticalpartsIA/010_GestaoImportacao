# Arquitetura de Geração Aumentada por Recuperação (RAG) - VPClick v2.0
========================================================================

Este documento especifica os conceitos, padrões científicos, contratos de API e a infraestrutura necessária para implementar um **RAG Verdadeiro (True RAG)** de nível corporativo e agêntico no VPClick.

Ele serve como um guia definitivo de engenharia para que desenvolvedores humanos e agentes de I.A. (como o OpenAI Codex, Copilot, Cursor ou assistentes agênticos) compreendam e estendam o sistema sem alucinações e com máxima segurança.

---

## 1. Objetivo e Escopo

O propósito central do RAG no VPClick é estender a memória paramétrica do LLM com uma **memória externa não paramétrica** [14]. O sistema deve:
* **Garantir Isolamento Estrito de Dados**: Nenhum chunk semântico pode ser exposto a usuários não autorizados. A segurança é garantida no nível físico e lógico no banco de dados (Row Level Security - RLS) [5].
* **Minimizar Alucinações**: O modelo deve gerar respostas fundamentadas estritamente nas evidências injetadas (Prompts com Universo Permitido) [8].
* **Garantir Rastreabilidade**: Cada afirmação deve ser rastreável até sua tarefa, documento ou anotação de origem no VPClick, gerando citações em formato clicável no frontend [8, 14].

---

## 2. Padrões de RAG Avançado e Evoluções Incorporadas

Para superar as limitações do RAG clássico (Naive RAG) [15], a arquitetura do VPClick implementa as seguintes variantes científicas:

### 2.1 Padrão Parent-Child Retrieval (Combate ao Blinkered Chunk Effect - BCE)
O fatiamento ingênuo de strings quebra o contexto de discussões de projetos [2]. Por exemplo, um comentário isolado de um desenvolvedor ("OK, alterado") indexado como um chunk individual não possui relevância semântica se recuperado sozinho [2].
* **Implementação**: A busca semântica é realizada em chunks altamente granulares (Chunks Filhos) para maior precisão de busca [2]. No entanto, a etapa de **Augmentation** reconstrói o contexto recuperando o documento pai estruturado (Tarefa completa com metadados de localização e status) [2].

### 2.2 Model Context Protocol (MCP) da Anthropic
Como o VPClick se integra a ambientes modernos de desenvolvimento aumentados por IA, ele expõe uma interface aberta compatível com o **Model Context Protocol (MCP)**.
* **Resources**: URIs estáveis (`vpclick://workspaces/{id}/tasks/{id}`) que permitem a leitura direta de contexto por agentes IDE como Cursor ou Copilot.
* **Tools**: Ferramentas acionáveis expostas ao modelo (ex: `query_rag_workspace`, `create_task_from_context`).

### 2.3 GraphRAG (Microsoft Research)
Para consultas que envolvem o cronograma ou dependências do Gantt, a busca vetorial tradicional por distância de cosseno falha [87].
* **Implementação**: Mapeamos workspaces, tarefas, predecessoras, sucessoras e responsáveis como nós e arestas de um grafo semântico [87]. Consultas sobre o impacto de atrasos usam busca híbrida vetorial enriquecida com algoritmos de travessia de grafos [87].

### 2.4 RAPTOR (Recursive Abstractive Processing for Tree-Organized Retrieval)
Para responder a perguntas macro sobre o status do projeto no Dashboard ("Quais foram os principais gargalos desta semana?"), chunks granulares não são eficazes [86].
* **Implementação**: O sistema agrupa recursivamente tarefas e documentos relacionados, gerando sumarizações em múltiplos níveis de abstração em árvore (Árvore Semântica RAPTOR).

### 2.5 RAFT (Retrieval-Augmented Fine-Tuning)
Os LLMs genéricos de mercado gastam muitos tokens interpretando a sintaxe proprietária do VPClick.
* **Implementação**: Pipeline offline que gera conjuntos sintéticos de dados para realizar fine-tuning em modelos menores locais. O modelo de inferência é treinado especificamente para ignorar chunks ruidosos e extrair informações exatas das estruturas relacionais do Supabase.

---

## 3. Schema de Banco de Dados de Produção (PostgreSQL + pgvector)

Abaixo está o DDL físico de produção a ser executado no Supabase para suportar o pipeline RAG idempotente e seguro com RLS [6, 12].

```sql
-- Ativação da extensão vetorial no PostgreSQL
create extension if not exists vector;

-- Tabela de Documentos Lógicos (Metadados macros e governança)
create table if not exists public.rag_documents (
    id uuid primary key,
    workspace_id text not null,
    source_type text not null, -- 'task', 'comment', 'wiki_doc', 'meeting'
    source_id text not null,
    source_version text not null default '1',
    title text,
    canonical_url text,
    content_checksum text not null, -- SHA-256 do conteúdo lógico para controle de alteração
    acl jsonb not null, -- {workspace_id: string, space_id: string, authorized_roles: string[]}
    source_updated_at timestamptz not null default now(),
    indexed_at timestamptz not null default now(),
    deleted_at timestamptz,
    unique (workspace_id, source_type, source_id, source_version)
);

-- Tabela de Chunks (Pedaços granulares indexados com embeddings)
create table if not exists public.rag_chunks (
    id uuid primary key,
    document_id uuid not null references public.rag_documents(id) on delete cascade,
    chunk_index integer not null,
    heading_path text[] not null, -- ex: ['TI', 'Automações', 'Configuração']
    content text not null,
    token_count integer,
    metadata jsonb not null default '{}'::jsonb,
    embedding_model text not null, -- ex: 'text-embedding-3-small'
    embedding_dimensions integer not null,
    embedding vector(1536), -- Compatível com OpenAI text-embedding-3-small
    created_at timestamptz not null default now(),
    unique (document_id, chunk_index, embedding_model)
);

-- Criação do índice HNSW de alta performance para busca por similaridade de cosseno
create index if not exists rag_chunks_hnsw_cosine_idx 
on public.rag_chunks using hnsw (embedding vector_cosine_ops);

---------------------------------------------------------
-- POLÍTICAS DE ROW LEVEL SECURITY (RLS) - SEGURANÇA MÁXIMA
---------------------------------------------------------

alter table public.rag_documents enable row level security;
alter table public.rag_chunks enable row level security;

-- Política RLS: Usuário só lê documentos pertencentes ao workspace ao qual ele está associado
create policy select_rag_documents_policy on public.rag_documents
    for select
    using (
        (acl->>'workspace_id') in (
            select workspace_id::text 
            from public.workspace_members 
            where user_id = auth.uid()
        )
    );

-- Política RLS: Chunks herdam o controle de acesso do documento pai correspondente
create policy select_rag_chunks_policy on public.rag_chunks
    for select
    using (
        document_id in (
            select id from public.rag_documents
        )
    );
```

---

## 4. Pipeline de Ingestão de Tarefas (Exemplo de Conversão Naturalizada)

Para indexar uma tarefa do VPClick de forma que o LLM possa lê-la e interpretá-la corretamente [14], os dados relacionais são mapeados em um formato descritivo naturalizado [8]:

```
Tarefa: Migrar pgvector do Supabase para VPS
Localização no VPClick: VerticalParts Financeiro > Auditoria de Fluxo > Contas de Borda > Faturas de Operação
Descrição e Critérios de Aceite: Configurar pgvector nativo e migrar chunks da base semântica garantindo as políticas de RLS.
Status Atual: Em Progresso
Prioridade: Alta
Membros Responsáveis: Gelson Simões, Lucas Tech
Prazo de Entrega: 2026-09-10T18:00:00Z
Tags associadas: postgres, infra, rag
Relacionamento e Gantt: Depende de: Subir VPS Ubuntu 24.04.
```

Os comentários são fatiados como chunks filhos independentes, contudo **injetando o contexto e título da tarefa-mãe** no próprio chunk [2]:

```
Comentário de Lucas Tech na Tarefa 'Migrar pgvector do Supabase para VPS' (VerticalParts Financeiro > Auditoria de Fluxo > Contas de Borda):
"Gelson, o script de outbox já está pronto. Só falta mapear as tabelas vetoriais no ORM." (Postado em: 2026-08-29)
```

Isso garante que uma busca por "script de outbox" encontre o comentário do Lucas, e a LLM compreenda imediatamente que a mensagem se refere à tarefa de migração de pgvector no espaço financeiro [2].

---

## 5. APIs de Referência do Sistema RAG

Endpoints desacoplados expostos para consumo técnico e agêntico [9, 11].

### 5.1 POST `/api/rag/query`
Executa uma busca híbrida semântica e gera uma resposta baseada estritamente em evidências autorizadas [8, 9].

* **Headers**: `Authorization: Bearer <JWT_USER>` (garante injeção do id do usuário para validação das regras de RLS)
* **Payload de Entrada**:
```json
{
  "query": "Qual o status da migração do pgvector?",
  "top_k": 5,
  "confidence_threshold": 0.72
}
```
* **Payload de Saída**:
```json
{
  "answer": "O status atual da tarefa 'Migrar pgvector do Supabase para VPS' é **Em Progresso** [1]. Lucas Tech informou que o script de outbox já está pronto, restando apenas o mapeamento das tabelas vetoriais no ORM [2].",
  "citations": [
    {
      "id": 1,
      "source_type": "task",
      "source_id": "t_10029",
      "title": "Migrar pgvector do Supabase para VPS",
      "url": "/workspace/ws_financeiro_99/tasks/t_10029"
    },
    {
      "id": 2,
      "source_type": "comment",
      "source_id": "c_201",
      "title": "Comentário de Lucas Tech",
      "url": "/workspace/ws_financeiro_99/tasks/t_10029#c_201"
    }
  ]
}
```

### 5.2 POST `/internal/rag/events`
Informa o pipeline RAG sobre mutações transacionais em tempo real no banco transacional [6, 9].
* **Headers**: `X-Service-Auth: <INTERNAL_APP_KEY>`
* **Payload**:
```json
{
  "event_id": "evt_99829",
  "event_type": "TASK_UPDATE",
  "workspace_id": "ws_financeiro_99",
  "source_type": "task",
  "source_id": "t_10029",
  "payload": { ... }
}
```

---

## 6. Framework de Avaliação e Auto-Reflexão (Self-RAG)

Para rodar com confiabilidade crítica de negócio, o pipeline de geração implementa um fluxo de **Auto-Reflexão** antes de retornar a resposta ao usuário:

1. **Avaliação de Relevância**: O sistema de reranqueamento descarta chunks cujo score de similaridade semântica seja inferior ao threshold estipulado (ex: 0.70). Se nenhum chunk sobrar, o pipeline retorna imediatamente a mensagem padrão de não encontrado, bloqueando alucinações.
2. **Grau de Fundamentação (Faithfulness)**: O gerador executa uma chamada em lote verificando se cada sentença da resposta pode ser deduzida logicamente a partir das passagens associadas. Sentenças não fundamentadas são limpas ou reescritas pelo orquestrador.
