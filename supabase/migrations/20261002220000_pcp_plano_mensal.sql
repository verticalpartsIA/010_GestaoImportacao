-- PCP · Planejamento mensal: quantidade planejada por produto, ano e mês.
-- Alimenta (no futuro) a Carga Máquina; compara-se com as OPs abertas no mês.
create table if not exists public.pcp_plano (
  id uuid primary key default gen_random_uuid(),
  produto text not null,                          -- código em pcp_produtos
  ano int not null check (ano between 2020 and 2100),
  mes int not null check (mes between 1 and 12),
  quantidade numeric not null default 0 check (quantidade >= 0),
  atualizado_por text,
  updated_at timestamptz not null default now(),
  unique (produto, ano, mes)
);
alter table public.pcp_plano enable row level security;
create policy "pcp_plano_leitura" on public.pcp_plano for select using (true);
create policy "pcp_plano_insert" on public.pcp_plano for insert with check (true);
create policy "pcp_plano_update" on public.pcp_plano for update using (true) with check (true);
create policy "pcp_plano_delete" on public.pcp_plano for delete using (true);
