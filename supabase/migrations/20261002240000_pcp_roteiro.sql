-- Carga Máquina · Roteiro: horas necessárias para produzir 1 unidade de um produto, em cada recurso
-- (mão de obra = horas-homem; máquina = horas-máquina). Base do cálculo de carga por recurso.
create table if not exists public.pcp_roteiro (
  id uuid primary key default gen_random_uuid(),
  produto text not null,
  recurso_id uuid not null references public.pcp_recursos(id) on delete cascade,
  horas_por_unidade numeric not null check (horas_por_unidade >= 0),
  updated_at timestamptz not null default now(),
  unique (produto, recurso_id)
);
alter table public.pcp_roteiro enable row level security;
create policy "pcp_roteiro_leitura" on public.pcp_roteiro for select using (true);
create policy "pcp_roteiro_insert" on public.pcp_roteiro for insert with check (true);
create policy "pcp_roteiro_update" on public.pcp_roteiro for update using (true) with check (true);
create policy "pcp_roteiro_delete" on public.pcp_roteiro for delete using (true);
