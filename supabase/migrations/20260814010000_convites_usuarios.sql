-- #56: convites de usuário rastreáveis (Admin · Configurações · Usuários).
-- Substitui o antigo "Convidar usuário" que só abria um mailto por um registro
-- de convite pendente, acompanhável na própria tela.

create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome text,
  role text,
  status text not null default 'pendente',   -- pendente | aceito | revogado
  convidado_por text,
  created_at timestamptz not null default now()
);

create index if not exists idx_convites_status on public.convites(status, created_at desc);

alter table public.convites enable row level security;

-- Padrão do projeto: acesso via anon key do browser (SSO na camada da aplicação).
create policy "convites_anon_all" on public.convites
  for all to anon using (true) with check (true);

create policy "convites_auth_all" on public.convites
  for all to authenticated using (true) with check (true);
