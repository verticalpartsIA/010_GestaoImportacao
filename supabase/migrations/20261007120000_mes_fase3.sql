-- MES · Fase 3: ligações elétricas, testes, não conformidade (NC) e campos de gate (furos, série, revisão).
-- NC/testes não têm delete: retrabalho nunca apaga o histórico original.
create sequence if not exists public.mes_nc_seq start 1;
alter table public.mes_ordens add column if not exists numero_serie text;
alter table public.mes_ordens add column if not exists revisao_projeto text;
alter table public.mes_ordens add column if not exists furos_previstos int not null default 48;
alter table public.mes_ordens add column if not exists furos_executados int;

create table if not exists public.mes_ligacoes (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id),
  codigo_fio text not null,
  origem text,
  destino text,
  bitola text,
  cor text,
  comprimento text,
  terminal text,
  status text not null default 'pendente' check (status in ('pendente','concluida')),
  feito_por text,
  feito_em timestamptz
);
create index if not exists mes_ligacoes_ordem_idx on public.mes_ligacoes (ordem_id);

create table if not exists public.mes_nc (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default ('NC-' || lpad(nextval('public.mes_nc_seq')::text, 4, '0')),
  ordem_id uuid not null references public.pcp_ordens(id),
  etapa_codigo text,
  descricao text not null,
  componente text,
  causa text,
  aberto_por text,
  aberto_em timestamptz not null default now(),
  acao_corretiva text,
  corrigido_por text,
  corrigido_em timestamptz,
  retest_result text,
  fechado_por text,
  fechado_em timestamptz,
  status text not null default 'aberta' check (status in ('aberta','corrigida','fechada'))
);
create index if not exists mes_nc_ordem_idx on public.mes_nc (ordem_id);

create table if not exists public.mes_testes (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id),
  tipo text not null check (tipo in ('sem_potencia','energizado','funcional')),
  nome text not null,
  resultado text not null check (resultado in ('aprovado','reprovado')),
  observacao text,
  testado_por text,
  testado_em timestamptz not null default now(),
  nc_id uuid references public.mes_nc(id)
);
create index if not exists mes_testes_ordem_idx on public.mes_testes (ordem_id, testado_em);

do $$ declare t text; begin
  foreach t in array array['mes_ligacoes','mes_nc','mes_testes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (true)', t||'_leitura', t);
    execute format('create policy %I on public.%I for insert with check (true)', t||'_insert', t);
  end loop;
  foreach t in array array['mes_ligacoes','mes_nc'] loop
    execute format('create policy %I on public.%I for update using (true) with check (true)', t||'_update', t);
  end loop;
  create policy mes_ligacoes_delete on public.mes_ligacoes for delete using (true);
end $$;
grant usage, select on sequence public.mes_nc_seq to anon, authenticated;
