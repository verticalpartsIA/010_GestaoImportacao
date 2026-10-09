-- PCP · Ordens de Produção com etapas.
-- Interno por ora: omie_op_id fica reservado para a futura ligação com produtos/op do Omie.
-- Sem DELETE: a OP é cancelada (status 'cancelada'), nunca apagada.
create sequence if not exists public.pcp_ordem_seq start 1;

create table if not exists public.pcp_ordens (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default ('OP-' || lpad(nextval('public.pcp_ordem_seq')::text, 4, '0')),
  produto text not null,                      -- código em pcp_produtos
  quantidade numeric not null check (quantidade > 0),
  cliente text,
  numero_cotacao integer,                     -- liga a OP à cotação/proposta vendida (opcional)
  previsao_inicio date,
  prazo_entrega date,
  data_abertura date not null default current_date,
  data_finalizacao date,
  status text not null default 'aguardando' check (status in ('aguardando', 'em_producao', 'concluida', 'cancelada')),
  qtd_produzida numeric,
  qtd_perdida numeric,
  causa_perda text,
  observacao text,
  omie_op_id text,
  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pcp_ordem_etapas (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id) on delete cascade,
  posicao int not null,
  nome text not null,
  setor text,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida')),
  responsavel text,
  data_prevista date,
  data_conclusao date,
  observacao text
);
create index if not exists pcp_ordem_etapas_ordem_idx on public.pcp_ordem_etapas (ordem_id, posicao);

create table if not exists public.pcp_ordem_materiais (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id) on delete cascade,
  codigo text not null,
  quantidade_unit numeric not null,           -- por 1 unidade (já com perda da estrutura)
  necessario numeric not null,                -- quantidade_unit × quantidade da OP (snapshot na abertura)
  separado numeric not null default 0,        -- quanto o Almoxarifado já separou
  observacao text
);
create index if not exists pcp_ordem_materiais_ordem_idx on public.pcp_ordem_materiais (ordem_id);

-- Modelo padrão de etapas (copiado para cada OP nova; a OP pode editar as suas).
create table if not exists public.pcp_etapas_modelo (
  id uuid primary key default gen_random_uuid(),
  posicao int not null,
  nome text not null,
  setor text,
  ativo boolean not null default true
);
insert into public.pcp_etapas_modelo (posicao, nome, setor)
select * from (values
  (1, 'Separar materiais', 'Almoxarifado'),
  (2, 'Corte', 'Produção'),
  (3, 'Furação', 'Produção'),
  (4, 'Montagem / fiação', 'Produção'),
  (5, 'Qualidade / aprovação', 'Qualidade')
) v(posicao, nome, setor)
where not exists (select 1 from public.pcp_etapas_modelo);

alter table public.pcp_ordens enable row level security;
alter table public.pcp_ordem_etapas enable row level security;
alter table public.pcp_ordem_materiais enable row level security;
alter table public.pcp_etapas_modelo enable row level security;

create policy "pcp_ordens_leitura" on public.pcp_ordens for select using (true);
create policy "pcp_ordens_insert" on public.pcp_ordens for insert with check (true);
create policy "pcp_ordens_update" on public.pcp_ordens for update using (true) with check (true);
create policy "pcp_ordem_etapas_leitura" on public.pcp_ordem_etapas for select using (true);
create policy "pcp_ordem_etapas_insert" on public.pcp_ordem_etapas for insert with check (true);
create policy "pcp_ordem_etapas_update" on public.pcp_ordem_etapas for update using (true) with check (true);
create policy "pcp_ordem_etapas_delete" on public.pcp_ordem_etapas for delete using (true);
create policy "pcp_ordem_materiais_leitura" on public.pcp_ordem_materiais for select using (true);
create policy "pcp_ordem_materiais_insert" on public.pcp_ordem_materiais for insert with check (true);
create policy "pcp_ordem_materiais_update" on public.pcp_ordem_materiais for update using (true) with check (true);
create policy "pcp_etapas_modelo_leitura" on public.pcp_etapas_modelo for select using (true);

grant usage, select on sequence public.pcp_ordem_seq to anon, authenticated;
