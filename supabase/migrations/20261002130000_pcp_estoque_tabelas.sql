-- PCP · estoque (Almoxarifado = estoque do PCP). Estrutura espelha a planilha
-- de importação do Omie (Omie_Produtos v1.9.6), só com as colunas que usamos.
-- Fora de propósito: marketplace, PDV, FCI, crossdocking, medicamento,
-- combustível, armamento, flags de custo de estoque do fornecedor.

-- Aba Omie_Produtos
create table if not exists public.pcp_produtos (
  codigo text primary key,
  codigo_integracao text,
  codigo_produto_omie bigint,
  descricao text not null,
  ncm text,
  cest text,
  ean text,
  unidade text,
  familia text,
  tipo_sped text,              -- '00' Revenda, '01' Matéria-prima, '03' Em processo, '04' Acabado…
  origem_mercadoria text,
  estoque_minimo numeric(18,6),
  preco_custo numeric(17,6),
  preco_venda numeric(17,6),
  peso_liquido_kg numeric(18,3),
  peso_bruto_kg numeric(18,3),
  altura_cm numeric(18,3),
  largura_cm numeric(18,3),
  profundidade_cm numeric(18,3),
  marca text,
  modelo text,
  leadtime_dias integer,
  descricao_detalhada text,
  observacao_interna text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Aba Omie_Produtos_Estoque (saldo atual por produto + local)
create table if not exists public.pcp_estoque (
  id uuid primary key default gen_random_uuid(),
  codigo text not null references public.pcp_produtos(codigo) on update cascade on delete cascade,
  local_estoque text not null,
  quantidade numeric(18,6) not null default 0,
  custo_unitario numeric(17,6),
  data_ajuste date,
  estoque_inicial boolean not null default false,
  atualizado_em timestamptz not null default now(),
  unique (codigo, local_estoque)
);

-- Aba Omie_Produtos_Estrutura (lista de materiais: pai = fabricado, filho = componente)
create table if not exists public.pcp_estrutura (
  id uuid primary key default gen_random_uuid(),
  codigo_pai text not null references public.pcp_produtos(codigo) on update cascade on delete cascade,
  codigo_filho text not null references public.pcp_produtos(codigo) on update cascade on delete restrict,
  quantidade numeric(18,6) not null,
  local_estoque text,
  perda_pct numeric(14,4),
  observacoes text,
  unique (codigo_pai, codigo_filho)
);

-- Aba Omie_Produtos_Fornecedor
create table if not exists public.pcp_produto_fornecedor (
  id uuid primary key default gen_random_uuid(),
  codigo text not null references public.pcp_produtos(codigo) on update cascade on delete cascade,
  codigo_no_fornecedor text,
  fornecedor text not null,
  categoria_compra text,
  cfop_entrada text,
  unique (codigo, fornecedor)
);

create index if not exists pcp_estoque_codigo_idx on public.pcp_estoque (codigo);
create index if not exists pcp_estrutura_filho_idx on public.pcp_estrutura (codigo_filho);
create index if not exists pcp_produto_fornecedor_codigo_idx on public.pcp_produto_fornecedor (codigo);

-- App roda com a chave anon (sem sessão Auth real, ver src/supabase.js).
alter table public.pcp_produtos enable row level security;
alter table public.pcp_estoque enable row level security;
alter table public.pcp_estrutura enable row level security;
alter table public.pcp_produto_fornecedor enable row level security;

create policy "pcp_produtos_leitura" on public.pcp_produtos for select using (true);
create policy "pcp_produtos_insert" on public.pcp_produtos for insert with check (true);
create policy "pcp_produtos_update" on public.pcp_produtos for update using (true) with check (true);
create policy "pcp_estoque_leitura" on public.pcp_estoque for select using (true);
create policy "pcp_estoque_insert" on public.pcp_estoque for insert with check (true);
create policy "pcp_estoque_update" on public.pcp_estoque for update using (true) with check (true);
create policy "pcp_estrutura_leitura" on public.pcp_estrutura for select using (true);
create policy "pcp_estrutura_insert" on public.pcp_estrutura for insert with check (true);
create policy "pcp_estrutura_update" on public.pcp_estrutura for update using (true) with check (true);
create policy "pcp_pf_leitura" on public.pcp_produto_fornecedor for select using (true);
create policy "pcp_pf_insert" on public.pcp_produto_fornecedor for insert with check (true);
create policy "pcp_pf_update" on public.pcp_produto_fornecedor for update using (true) with check (true);
