create table if not exists public.fabricacao_quadro_itens (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  ordem int not null,
  peso numeric not null
);
insert into public.fabricacao_quadro_itens (texto, ordem, peso) values
  ('Furação do gabinete', 1, 17),
  ('Fixação de calhas e trilhos DIN', 2, 17),
  ('Acoplagem de disjuntores e contatores; fixação de botoeira de inspeção, inversor, resgate, base de terminais e barramento de fio-terra', 3, 17),
  ('Fiação de ligação entre terminais, placas e outros componentes (origem e destino)', 4, 17),
  ('Fixação do resistor de frenagem', 5, 16),
  ('Teste do quadro', 6, 16);

create table if not exists public.fabricacao_quadro_links (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id) on delete cascade,
  token text not null unique,
  criado_por text,
  criado_em timestamptz not null default now()
);

create table if not exists public.fabricacao_quadro_status (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id) on delete cascade,
  item_id uuid not null references public.fabricacao_quadro_itens(id),
  flegado boolean not null default false,
  flegado_em timestamptz,
  flegado_por text,
  unique (ordem_id, item_id)
);

create table if not exists public.fabricacao_quadro_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id) on delete cascade,
  codigo_produto text not null,
  descricao_produto text,
  tem_frente_trabalho boolean not null,
  status text not null default 'aberta' check (status in ('aberta', 'resolvida')),
  aberta_em timestamptz not null default now(),
  resolvida_em timestamptz
);
create index if not exists idx_fab_quadro_status_ordem on public.fabricacao_quadro_status (ordem_id);
create index if not exists idx_fab_quadro_ocorrencias_ordem on public.fabricacao_quadro_ocorrencias (ordem_id);

alter table public.fabricacao_quadro_itens enable row level security;
alter table public.fabricacao_quadro_links enable row level security;
alter table public.fabricacao_quadro_status enable row level security;
alter table public.fabricacao_quadro_ocorrencias enable row level security;
create policy allow_all_fab_quadro_itens on public.fabricacao_quadro_itens for all using (true) with check (true);
create policy allow_all_fab_quadro_links on public.fabricacao_quadro_links for all using (true) with check (true);
create policy allow_all_fab_quadro_status on public.fabricacao_quadro_status for all using (true) with check (true);
create policy allow_all_fab_quadro_ocorrencias on public.fabricacao_quadro_ocorrencias for all using (true) with check (true);
