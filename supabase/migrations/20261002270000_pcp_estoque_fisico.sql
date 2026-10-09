-- Almoxarifado · Estoque Físico (contagem real) ao lado do Estoque Omie.
-- O Omie continua sendo a fonte do saldo sistêmico; aqui se registra o que existe de fato na prateleira
-- e a tela mostra a diferença. Cada contagem fica no histórico (pcp_estoque_contagens, sem update/delete).
create table if not exists public.pcp_estoque_fisico (
  codigo text primary key references public.pcp_produtos(codigo) on delete cascade,
  quantidade numeric not null check (quantidade >= 0),
  contado_em timestamptz not null default now(),
  contado_por text,
  observacao text
);
create table if not exists public.pcp_estoque_contagens (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  quantidade_fisica numeric not null,
  quantidade_omie numeric,                     -- saldo do Omie no momento da contagem
  diferenca numeric,                           -- físico − Omie
  contado_por text,
  observacao text,
  contado_em timestamptz not null default now()
);
create index if not exists pcp_estoque_contagens_codigo_idx on public.pcp_estoque_contagens (codigo, contado_em desc);
alter table public.pcp_estoque_fisico enable row level security;
alter table public.pcp_estoque_contagens enable row level security;
create policy "pcp_estoque_fisico_leitura" on public.pcp_estoque_fisico for select using (true);
create policy "pcp_estoque_fisico_insert" on public.pcp_estoque_fisico for insert with check (true);
create policy "pcp_estoque_fisico_update" on public.pcp_estoque_fisico for update using (true) with check (true);
create policy "pcp_estoque_contagens_leitura" on public.pcp_estoque_contagens for select using (true);
create policy "pcp_estoque_contagens_insert" on public.pcp_estoque_contagens for insert with check (true);
