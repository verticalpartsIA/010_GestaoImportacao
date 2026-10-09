# Segurança real (#571) — decisões do usuário

Respondidas em **04/10/2026** com a frase **"segue com as recomendadas"** (as recomendações do plano `docs/superpowers/plans/2026-10-02-autenticacao-e-rls-571.md`).

| # | Decisão | Valor adotado |
|---|---|---|
| D1 | Fonte de identidade | **A) aceitar o JWT do vpsistema** (Third-Party Auth por JWKS). Se a Task 1 mostrar que não é viável, cai para **B) troca de token** (`sso-exchange`). |
| D2 | Modelo de permissão | Reaproveitar `perfis.nivel` (Administrador/Gestor/Colaborador) + `alcadas_capacidade`. Classes de tabela: `interno`, `leitura_interna`, `sensivel`. |
| D3 | Quem exclui nas tabelas `interno` | **Só Administrador** (ou quem tiver a capacidade `excluir` do módulo). |
| D4 | Buckets públicos | Só `ImagensTutoriais` continua público; `engenharia`, `vistorias-anexos` e `tratativas` passam a URL assinada. |
| D5 | Desenvolvimento local | Usuário de desenvolvimento **no vpsistema**, ligado a um `perfis` Administrador; senha digitada em runtime, só em `localhost`. |
| D6 | Ensaio | **Branch do Supabase** para a Fase 3 (custo a confirmar com `get_cost` antes); produção por **ondas pequenas** na Fase 4. |
| D7 | Páginas públicas | Ficam públicas só as que realmente precisam de token (`assinar`, `cotacao-elevador-fornecedor`, `formulario-cliente`); `status-obra`, `termo-entrega`, `vistoria-execucao` e `diario-obra` são **candidatas a internas** — confirmar uma a uma na Task 0/D7 antes de mudar. |

## O que depende de ação do usuário (a IA não faz)
- Registrar o JWKS do vpsistema em **Authentication → Third-Party Auth** do projeto `jxtqwzmpgofwctqajewt` (Task 1, passo 2). A API de gerenciamento está bloqueada de propósito (`SUPABASE_ALLOW_BREAK_GLASS=false`).
- Rodar no console, logado no vpsistema.com, os trechos da Task 1 (passos 1 e 4) e devolver **só o resultado** (nunca o token).
- Criar o usuário de desenvolvimento e a linha em `perfis` (Task 6).

## Andamento
- **Fase 0 / Task 0** (matriz): feita — 163 tabelas abertas (`matriz-acesso-rls.md`).
- **Fase 1 / Tasks 3 e 4** (funções de autorização, gerador reversível de políticas, sonda): ver `CLAUDE.md` › "Segurança real (#571) — andamento".
