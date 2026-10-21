-- Itens extras de fiação que acompanham a OP do Quadro de Comando quando o
-- pedido é de um elevador completo (OP vinculada a um Pedido de Venda do
-- Omie, direto ou via ordem_mae_id) — pedido do usuário, 20/10/2026.
-- Mesmo padrão de fabricacao_quadro_itens/_status (migration
-- 20261019200000_fabricacao_quadro_schema.sql): catálogo fixo + status por
-- OP, flegável independente pelo mesmo link/tela da Evolução da Fabricação.
-- Tabela SEPARADA de propósito — não mexe nos pesos/cálculo já testados do
-- Quadro (fabricacao-quadro-calc.js não foi alterado).
create table if not exists public.fabricacao_quadro_fiacao_itens (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  texto text not null,
  descricao text,
  ordem int not null
);
insert into public.fabricacao_quadro_fiacao_itens (codigo, texto, descricao, ordem) values
  ('cabo_manobra', 'Cabo de Manobra — Corte e Pinagem', null, 1),
  ('fiacao_passadico', 'Fiação Passadiço — Corte e Pinagem', null, 2),
  ('fiacao_topo_carro', 'Fiação Topo do Carro — Corte e Pinagem', 'Sai da caixa de passagem e liga aos componentes do topo da cabina.', 3),
  ('fiacao_poco', 'Fiação de Poço — Corte e Pinagem', 'Sai da caixa de passagem do poço e liga aos componentes do poço.', 4)
on conflict (codigo) do nothing;

create table if not exists public.fabricacao_quadro_fiacao_status (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id) on delete cascade,
  item_id uuid not null references public.fabricacao_quadro_fiacao_itens(id),
  flegado boolean not null default false,
  flegado_em timestamptz,
  flegado_por text,
  unique (ordem_id, item_id)
);
create index if not exists idx_fab_quadro_fiacao_status_ordem on public.fabricacao_quadro_fiacao_status (ordem_id);

alter table public.fabricacao_quadro_fiacao_itens enable row level security;
alter table public.fabricacao_quadro_fiacao_status enable row level security;
create policy allow_all_fab_quadro_fiacao_itens on public.fabricacao_quadro_fiacao_itens for all using (true) with check (true);
create policy allow_all_fab_quadro_fiacao_status on public.fabricacao_quadro_fiacao_status for all using (true) with check (true);
