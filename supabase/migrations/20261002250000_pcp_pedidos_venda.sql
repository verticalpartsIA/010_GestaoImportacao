-- PCP · Relatórios Pedidos e Clientes: pedidos de venda do Omie, só itens do PCP
-- (quadros de comando, corrimãos, cabos de aço/manobra). Gravados SÓ pela Edge Function
-- sync-pcp-pedidos (chave de serviço); o navegador apenas lê.
create table if not exists public.pcp_pedidos (
  codigo_pedido bigint primary key,            -- código interno do Omie (um número de pedido pode ter mais de um)
  numero_pedido text not null,
  etapa text,
  codigo_cliente bigint,
  cliente_nome text,
  cliente_fantasia text,
  cliente_documento text,
  cliente_endereco text,
  cliente_telefone text,
  cliente_email text,
  data_pedido date,
  data_previsao date,
  valor_total numeric,
  observacao text,
  atualizado_em timestamptz not null default now()
);
create index if not exists pcp_pedidos_numero_idx on public.pcp_pedidos (numero_pedido);
create index if not exists pcp_pedidos_cliente_idx on public.pcp_pedidos (codigo_cliente);

create table if not exists public.pcp_pedido_itens (
  id uuid primary key default gen_random_uuid(),
  codigo_pedido bigint not null references public.pcp_pedidos(codigo_pedido) on delete cascade,
  seq int not null,
  codigo text not null,
  descricao text,
  unidade text,
  quantidade numeric not null default 0,
  valor_unitario numeric not null default 0,
  desconto numeric not null default 0,
  valor_total numeric not null default 0,
  unique (codigo_pedido, seq)
);
create index if not exists pcp_pedido_itens_codigo_idx on public.pcp_pedido_itens (codigo);

alter table public.pcp_pedidos enable row level security;
alter table public.pcp_pedido_itens enable row level security;
create policy "pcp_pedidos_leitura" on public.pcp_pedidos for select using (true);
create policy "pcp_pedido_itens_leitura" on public.pcp_pedido_itens for select using (true);
