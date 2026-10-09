-- PCP · fila "Pedidos para produzir" (etapa 20 do Omie), acompanhamento da NF e Expedição.
-- Pedido de venda do Omie → OPs (pcp_ordens.pedido_codigo) → NF emitida (faturado no Omie, só leitura) → Expedição.
alter table public.pcp_pedidos add column if not exists faturado boolean not null default false;
alter table public.pcp_pedidos add column if not exists data_faturamento date;
alter table public.pcp_pedidos add column if not exists nf_autorizada boolean not null default false;
alter table public.pcp_pedidos add column if not exists cancelado boolean not null default false;
alter table public.pcp_pedidos add column if not exists volumes int;
alter table public.pcp_pedidos add column if not exists peso_bruto numeric;
alter table public.pcp_pedidos add column if not exists modalidade_frete text;
alter table public.pcp_pedidos add column if not exists transportadora_codigo bigint;
-- Agora guarda TODOS os itens do pedido (a Expedição envia o pedido inteiro); item_pcp marca os do PCP.
alter table public.pcp_pedido_itens add column if not exists item_pcp boolean not null default true;
alter table public.pcp_ordens add column if not exists pedido_codigo bigint;     -- codigo_pedido do Omie que originou a OP-mãe
create index if not exists pcp_ordens_pedido_idx on public.pcp_ordens (pedido_codigo);

create table if not exists public.pcp_expedicoes (
  id uuid primary key default gen_random_uuid(),
  pedido_codigo bigint not null unique references public.pcp_pedidos(codigo_pedido) on delete cascade,
  status text not null default 'aguardando' check (status in ('aguardando', 'despachado', 'entregue')),
  volumes int,
  transportadora text,
  retirada boolean not null default false,
  data_saida date,
  rastreio text,
  data_entrega date,
  comprovante text,
  observacao text,
  criado_por text,
  atualizado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pcp_expedicoes enable row level security;
create policy "pcp_expedicoes_leitura" on public.pcp_expedicoes for select using (true);
create policy "pcp_expedicoes_insert" on public.pcp_expedicoes for insert with check (true);
create policy "pcp_expedicoes_update" on public.pcp_expedicoes for update using (true) with check (true);

-- Trava no banco: só despacha/entrega pedido com NF emitida (faturado no Omie), mesmo chamando a API direto.
create or replace function public.fn_pcp_expedicao_exige_nf() returns trigger language plpgsql as $$
begin
  if new.status in ('despachado', 'entregue') then
    if not exists (select 1 from public.pcp_pedidos p where p.codigo_pedido = new.pedido_codigo and p.faturado and not p.cancelado) then
      raise exception 'Expedição bloqueada: o pedido ainda não tem NF emitida (faturado no Omie).' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_pcp_expedicao_exige_nf on public.pcp_expedicoes;
create trigger trg_pcp_expedicao_exige_nf before insert or update on public.pcp_expedicoes for each row execute function public.fn_pcp_expedicao_exige_nf();
