# -*- coding: utf-8 -*-
"""
VP Click - Chunker Semântico de Tarefas (Produção)
--------------------------------------------------
Este script implementa a lógica real e determinística de fatiamento semântico 
e estruturação de documentos para a plataforma de RAG do VP Click.

Implementa as seguintes boas práticas de RAG Avançado:
1. Padrão Parent-Child Retrieval (Combate ao Efeito Chunk com Viseiras - BCE).
2. Geração de UUIDs estáveis e determinísticos por Hashing (Idempotência).
3. Transformação estruturada de registros relacionais em texto natural para embeddings.
4. Metadados estritos para Row Level Security (RLS) no PostgreSQL/Supabase.

Autor: Equipe de T.I. VerticalParts (Gelson Simões)
Ano: 2026
"""

import json
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple

class VPClickTaskChunker:
    def __init__(self, embedding_model: str = "text-embedding-3-small", embedding_dimensions: int = 1536):
        self.embedding_model = embedding_model
        self.embedding_dimensions = embedding_dimensions

    def _generate_deterministic_uuid(self, namespace_key: str, unique_str: str) -> str:
        """
        Gera um UUID v5 estável baseado em um namespace estável e uma string única.
        Garante idempotência absoluta no Supabase/pgvector.
        """
        # Namespace base do VPClick para UUID v5
        vp_namespace = uuid.uuid5(uuid.NAMESPACE_DNS, "vpclick.verticalparts.ia")
        composite_key = f"{namespace_key}:{unique_str}"
        return str(uuid.uuid5(vp_namespace, composite_key))

    def _calculate_checksum(self, text: str) -> str:
        """Calcula hash SHA-256 do conteúdo para detectar alterações e evitar reindexação desnecessária."""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def transform_to_natural_text(self, task: Dict[str, Any]) -> str:
        """
        Converte uma tarefa estruturada do PostgreSQL em texto em linguagem natural altamente descritivo.
        Isso melhora drasticamente o alinhamento semântico na fase de Recuperação (Retrieval).
        """
        title = task.get("title", "Sem Título").strip()
        description = task.get("description", "Sem descrição detalhada.").strip()
        status = task.get("status", "Sem Status").strip()
        priority = task.get("priority", "Sem prioridade definida").strip()
        
        # Localização hierárquica (Breadcrumb)
        workspace = task.get("workspace_name", "Workspace Geral").strip()
        space = task.get("space_name", "Espaço Principal").strip()
        folder = task.get("folder_name", "").strip()
        list_name = task.get("list_name", "Lista Geral").strip()
        
        location_path = f"{workspace} > {space}"
        if folder:
            location_path += f" > {folder}"
        location_path += f" > {list_name}"

        # Tratamento de responsáveis e datas
        assignees = ", ".join(task.get("assignees", ["Não atribuído"]))
        tags = ", ".join(task.get("tags", [])) if task.get("tags") else "Nenhuma"
        due_date = task.get("due_date", "Sem prazo definido")
        
        # Dependências de Gantt
        dependencies = task.get("dependencies", [])
        dep_str = "Nenhuma dependência activa."
        if dependencies:
            dep_titles = [d.get("title", "Tarefa Relacionada") for d in dependencies]
            dep_str = f"Depende de: {', '.join(dep_titles)}."

        # Construção da string naturalizada (universo permitido de conhecimento)
        natural_text = (
            f"Tarefa: {title}\n"
            f"Localização no VPClick: {location_path}\n"
            f"Descrição e Critérios de Aceite: {description}\n"
            f"Status Atual: {status}\n"
            f"Prioridade: {priority}\n"
            f"Membros Responsáveis: {assignees}\n"
            f"Prazo de Entrega: {due_date}\n"
            f"Tags associadas: {tags}\n"
            f"Relacionamento e Gantt: {dep_str}"
        )
        return natural_text

    def process_task_for_rag(self, task: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """
        Processa uma tarefa completa gerando o documento pai e seus chunks filhos semânticos.
        Implementa o padrão Parent-Child de modo a isolar comentários sem perder o contexto da tarefa.
        """
        workspace_id = task["workspace_id"]
        task_id = task["id"]
        version = task.get("version", "1")
        
        # 1. Preparar Texto do Documento Pai
        parent_text = self.transform_to_natural_text(task)
        parent_checksum = self._calculate_checksum(parent_text)
        
        # UUID determinístico para o Documento Pai (RAG Document)
        parent_doc_uuid = self._generate_deterministic_uuid("document", f"{workspace_id}:task:{task_id}:{version}")
        
        # Metadados de controle de acesso (ACL) para Row Level Security (RLS)
        acl_policy = {
            "workspace_id": workspace_id,
            "space_id": task.get("space_id"),
            "authorized_roles": ["ADMIN", "GESTOR", "COLABORADOR"]
        }

        parent_document = {
            "id": parent_doc_uuid,
            "workspace_id": workspace_id,
            "source_type": "task",
            "source_id": task_id,
            "source_version": version,
            "title": task.get("title", ""),
            "canonical_url": f"/workspace/{workspace_id}/tasks/{task_id}",
            "content_checksum": parent_checksum,
            "acl": acl_policy,
            "source_updated_at": task.get("updated_at", datetime.now(timezone.utc).isoformat())
        }

        # 2. Criar os Chunks Filhos (Padrão Parent-Child para evitar Blinkered Chunk Effect)
        chunks = []
        
        # Chunk 0: O contexto mestre da tarefa
        chunk_0_uuid = self._generate_deterministic_uuid("chunk", f"{parent_doc_uuid}:chunk:0")
        chunks.append({
            "id": chunk_0_uuid,
            "document_id": parent_doc_uuid,
            "chunk_index": 0,
            "heading_path": [task.get("space_name", "Geral"), "Tarefa", task.get("title", "")],
            "content": parent_text,
            "token_count": len(parent_text.split()),  # Estimativa rápida
            "metadata": {
                "type": "task_overview",
                "space_id": task.get("space_id"),
                "priority": task.get("priority")
            }
        })

        # Processar Comentários como Chunks Filhos (preservando breadcrumbs para evitar "viseiras")
        comments = task.get("comments", [])
        for idx, comment in enumerate(comments, start=1):
            comment_id = comment.get("id", f"idx_{idx}")
            comment_text = comment.get("content", "").strip()
            comment_author = comment.get("author_name", "Usuário VPClick")
            commented_at = comment.get("created_at", "")
            
            # Texto enriquecido do comentário filho (injetando herança contextualmente)
            enriched_comment_text = (
                f"Comentário de {comment_author} na Tarefa '{task.get('title')}' "
                f"({location_path_summary(task)}):\n"
                f"\"{comment_text}\" (Postado em: {commented_at})"
            )
            
            chunk_uuid = self._generate_deterministic_uuid("chunk", f"{parent_doc_uuid}:comment:{comment_id}")
            chunks.append({
                "id": chunk_uuid,
                "document_id": parent_doc_uuid,
                "chunk_index": idx,
                "heading_path": [task.get("space_name", "Geral"), "Tarefa", task.get("title", ""), "Discussão"],
                "content": enriched_comment_text,
                "token_count": len(enriched_comment_text.split()),
                "metadata": {
                    "type": "comment",
                    "comment_id": comment_id,
                    "author": comment_author,
                    "space_id": task.get("space_id")
                }
            })

        return parent_document, chunks

def location_path_summary(task: Dict[str, Any]) -> str:
    path = f"{task.get('workspace_name', 'WS')} > {task.get('space_name', 'Space')}"
    if task.get("folder_name"):
        path += f" > {task['folder_name']}"
    path += f" > {task.get('list_name', 'List')}"
    return path

# Exemplo de Teste de Produção (Fixture Reproduzível)
if __name__ == "__main__":
    test_task = {
        "id": "t_10029",
        "workspace_id": "ws_financeiro_99",
        "workspace_name": "VerticalParts Financeiro",
        "space_id": "sp_auditoria_04",
        "space_name": "Auditoria de Fluxo",
        "folder_name": "Contas de Borda",
        "list_name": "Faturas de Operação",
        "title": "Migrar pgvector do Supabase para VPS",
        "description": "Configurar pgvector nativo e migrar chunks da base semantica garantindo que as tabelas herdem politicas de RLS (Row Level Security).",
        "status": "Em Progresso",
        "priority": "Alta",
        "assignees": ["Gelson Simoes", "Lucas Tech"],
        "tags": ["postgres", "infra", "rag"],
        "due_date": "2026-09-10T18:00:00Z",
        "updated_at": "2026-08-29T04:45:00Z",
        "dependencies": [
            {"id": "t_10028", "title": "Subir VPS Ubuntu 24.04"}
        ],
        "comments": [
            {"id": "c_201", "author_name": "Lucas Tech", "content": "Gelson, o script de outbox já está pronto. Só falta mapear as tabelas vetoriais no ORM.", "created_at": "2026-08-29T04:40:00Z"}
        ],
        "version": "1"
    }

    chunker = VPClickTaskChunker()
    parent, chunks = chunker.process_task_for_rag(test_task)
    
    print("\n--- [OK] DOCUMENTO PAI DO RAG (ID Determinístico / RLS Habilitado) ---")
    print(json.dumps(parent, indent=2, ensure_ascii=False))
    
    print("\n--- [OK] CHUNKS FILHOS GERADOS (Combate Ativo ao BCE) ---")
    print(json.dumps(chunks, indent=2, ensure_ascii=False))
