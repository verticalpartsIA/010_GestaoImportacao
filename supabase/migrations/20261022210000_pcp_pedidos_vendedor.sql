-- Vendedor do pedido de venda do Omie (informacoes_adicionais.codVend → geral/vendedores).
-- Gravado só pela Edge Function sync-pcp-pedidos; o navegador apenas lê (Evolução da Fabricação).
alter table public.pcp_pedidos add column if not exists vendedor_codigo bigint;
alter table public.pcp_pedidos add column if not exists vendedor_nome text;
