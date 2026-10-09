-- Aba "Pedidos de compra" do Almoxarifado: visão dos pedidos de compra do Omie + pedidos internos de varejo melhorados.

-- 1) Pedidos de compra do Omie (lidos por sync-pcp-compras): previsão de chegada e nome do fornecedor.
alter table public.pcp_compras_itens add column if not exists data_previsao date;

create table if not exists public.pcp_fornecedores_omie (
  codigo bigint primary key,
  nome text,
  atualizado_em timestamptz not null default now()
);
alter table public.pcp_fornecedores_omie enable row level security;

-- Leitura pela tela (mesmo modelo das demais tabelas pcp_*; o controle fino de custo é feito na tela).
drop policy if exists pcp_compras_itens_leitura on public.pcp_compras_itens;
create policy pcp_compras_itens_leitura on public.pcp_compras_itens for select to anon, authenticated using (true);
drop policy if exists pcp_fornecedores_omie_leitura on public.pcp_fornecedores_omie;
create policy pcp_fornecedores_omie_leitura on public.pcp_fornecedores_omie for select to anon, authenticated using (true);

-- 2) Pedidos internos de varejo: item do cadastro, dados da compra e cancelamento; número sem duplicar.
alter table public.pedidos_compra_varejo
  add column if not exists codigo_produto text,
  add column if not exists comprado_em timestamptz,
  add column if not exists comprado_por text,
  add column if not exists comprado_omie_pedido text,
  add column if not exists comprado_fornecedor text,
  add column if not exists comprado_valor numeric,
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_por text,
  add column if not exists cancelado_motivo text;

create unique index if not exists pedidos_compra_varejo_numero_uq on public.pedidos_compra_varejo (numero_documento);
