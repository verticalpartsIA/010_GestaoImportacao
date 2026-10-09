-- Candidato 3 da revisão de arquitetura da Central de Decisões (ver
-- architecture-review-20260817-194500.html). `decisoes_gerenciais` foi
-- criada fora do fluxo de migração (ressincronizada manualmente via MCP,
-- por isso não tinha registro aqui) — este arquivo é puramente
-- documentação retroativa do schema já em produção, sem alterar nenhum
-- dado. `if not exists` em tudo: rodar isso num banco onde a tabela já
-- existe não faz nada.
--
-- Nota sobre RLS: diferente do padrão do projeto (RLS habilitado + 2
-- políticas abertas anon/authenticated), esta tabela está em produção
-- SEM RLS habilitado. Mantido como está — mudar isso é uma decisão de
-- segurança separada, fora do escopo desta documentação.
create table if not exists public.decisoes_gerenciais (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  numero_cotacao integer,
  dossier_id text,
  referencia_tabela text,
  referencia_id text,
  papel_requerido text not null,
  -- Escrito na criação (aprovadores_esperados[0]) mas nunca lido pelo
  -- código do app hoje — souAprovador() só olha o array abaixo. Mantido
  -- (não é escrita morta a remover): existe um índice dedicado nele
  -- (idx_decisoes_aprovador), sinal de que serve pra consulta SQL direta
  -- fora do app (ex.: "quantas decisões esperam por este e-mail",
  -- sem precisar unnest no array). Se um dia nenhuma consulta usar o
  -- índice, aí sim vale reconsiderar.
  aprovador_esperado_email text,
  depende_de uuid[] not null default '{}',
  status text not null default 'pendente',
  decidido_por text,
  decidido_em timestamptz,
  motivo text,
  contexto jsonb not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  aprovadores_esperados text[] not null default '{}'
);

create index if not exists idx_decisoes_numero_cotacao on public.decisoes_gerenciais(numero_cotacao);
create index if not exists idx_decisoes_aprovador on public.decisoes_gerenciais(aprovador_esperado_email);
create index if not exists idx_decisoes_status on public.decisoes_gerenciais(status);
