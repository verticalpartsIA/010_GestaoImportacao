-- Carga Máquina · cadastro de recursos produtivos (máquinas e mão de obra).
-- Capacidade guardada em horas; capacidade em unidades é opcional (unidades_por_hora).
-- Sem DELETE: recurso é desativado (ativo=false), pra não perder histórico.
create table if not exists public.pcp_recursos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tipo text not null check (tipo in ('maquina', 'mao_de_obra')),
  nome text not null,
  quantidade numeric not null default 1 check (quantidade > 0),   -- nº de funcionários (mão de obra) ou de máquinas iguais
  horas_dia numeric not null default 8 check (horas_dia >= 0 and horas_dia <= 24),
  dias_mes numeric not null default 22 check (dias_mes >= 0 and dias_mes <= 31),
  eficiencia_pct numeric not null default 100 check (eficiencia_pct >= 0 and eficiencia_pct <= 100),
  unidades_por_hora numeric check (unidades_por_hora is null or unidades_por_hora >= 0),
  observacao text,
  ativo boolean not null default true,
  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pcp_recursos enable row level security;
create policy "pcp_recursos_leitura" on public.pcp_recursos for select using (true);
create policy "pcp_recursos_insert" on public.pcp_recursos for insert with check (true);
create policy "pcp_recursos_update" on public.pcp_recursos for update using (true) with check (true);
