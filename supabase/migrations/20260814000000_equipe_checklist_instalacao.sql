-- #48: checklist real e persistido por equipe de instalação (operacoes.jsx).
-- Uma linha por tarefa do checklist, correlacionada à equipe.

create table if not exists public.equipe_checklist (
  id uuid primary key default gen_random_uuid(),
  equipe_id uuid not null references public.equipes(id) on delete cascade,
  descricao text not null,
  feito boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipe_checklist_equipe on public.equipe_checklist(equipe_id, ordem);

alter table public.equipe_checklist enable row level security;

-- Padrão do projeto: acesso via anon key do browser (SSO na camada da aplicação).
create policy "equipe_checklist_anon_all" on public.equipe_checklist
  for all to anon using (true) with check (true);

create policy "equipe_checklist_auth_all" on public.equipe_checklist
  for all to authenticated using (true) with check (true);
