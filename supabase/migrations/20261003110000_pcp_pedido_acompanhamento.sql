-- PCP · acompanhamento do pedido de venda: SLA (marco de entrada) e conferência proposta × NF.
-- Chave = numero_pedido (um mesmo nº pode ter vários registros no Omie: parciais).
alter table public.pcp_pedidos add column if not exists entrada_em timestamptz;
update public.pcp_pedidos set entrada_em = coalesce(atualizado_em, now()) where entrada_em is null;
alter table public.pcp_pedidos alter column entrada_em set default now();

create table if not exists public.pcp_pedido_acompanhamento (
  numero_pedido text primary key,
  historico boolean not null default false,            -- já entregue antes do sistema: sem SLA
  conferencia text not null default 'pendente' check (conferencia in ('pendente', 'conferida', 'regularizar')),
  observacao text,
  atualizado_por text,
  updated_at timestamptz not null default now()
);
alter table public.pcp_pedido_acompanhamento enable row level security;
create policy "pcp_ped_acomp_leitura" on public.pcp_pedido_acompanhamento for select using (true);
create policy "pcp_ped_acomp_insert" on public.pcp_pedido_acompanhamento for insert with check (true);
create policy "pcp_ped_acomp_update" on public.pcp_pedido_acompanhamento for update using (true) with check (true);
