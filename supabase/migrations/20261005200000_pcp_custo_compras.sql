-- PCP · custo do componente a partir das COMPRAS (pedidos de compra do Omie), 05/10/2026.
--
-- Por quê: o "Custo Omie" do PCP vem do custo médio do ESTOQUE (nCMC), que o Omie só informa enquanto há saldo
-- (conferido: 94 de 94 componentes com saldo têm custo; 34 de 34 com saldo zero ficam "sem custo", mesmo já comprados).
-- Regra aprovada pelo usuário: custo médio do Omie (com saldo) → MÉDIA PONDERADA por quantidade das compras recebidas
-- nos últimos 12 meses → preço do pedido pendente → custo manual.
-- Validação (12 meses, 61 componentes comparáveis): a média ponderada fica dentro de ±30% do custo do Omie em 57 de 57.
--
-- A tabela guarda as linhas de compra lidas do Omie (preço de compra: sensível). Fica SEM política de acesso de propósito:
-- só a Edge Function sync-pcp-compras (chave de serviço) lê e escreve. O navegador lê apenas o custo já calculado,
-- nas colunas novas de pcp_produtos.

create table if not exists public.pcp_compras_itens (
  pedido_id      bigint      not null,           -- nCodPed do Omie
  item_id        bigint      not null,           -- nCodItem do Omie
  numero_pedido  text,
  data_pedido    date,
  etapa          text,
  situacao       text        not null check (situacao in ('recebido', 'pendente')),
  fornecedor_cod bigint,
  codigo         text        not null,           -- = pcp_produtos.codigo
  unidade        text,
  quantidade     numeric,
  qtde_recebida  numeric,
  valor_unitario numeric,
  valor_total    numeric,
  atualizado_em  timestamptz not null default now(),
  primary key (pedido_id, item_id)
);
create index if not exists pcp_compras_itens_codigo_data on public.pcp_compras_itens (codigo, data_pedido desc);
alter table public.pcp_compras_itens enable row level security;

alter table public.pcp_produtos
  add column if not exists custo_compra               numeric,
  add column if not exists custo_compra_fonte         text,          -- 'media_12m' | 'pedido_pendente'
  add column if not exists custo_compra_em            date,          -- data da compra mais recente usada
  add column if not exists custo_compra_n             integer,       -- quantas linhas de compra entraram na conta
  add column if not exists custo_compra_atualizado_em timestamptz;

comment on column public.pcp_produtos.custo_compra is 'Custo por compras (média ponderada 12m ou preço do pedido pendente). Só vale quando preco_custo (Omie) é 0; vem antes do custo_manual.';
