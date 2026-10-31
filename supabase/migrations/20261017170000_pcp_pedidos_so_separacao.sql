-- VP Estoque · fila de separação com TODOS os pedidos da etapa 20 do Omie (decisão do Gelson, 17/10/2026).
-- Antes, sync-pcp-pedidos descartava o pedido sem nenhum item "do PCP" (quadro de comando, corrimão, cabo): em 17/10 só 4 de 10
-- pedidos da etapa 20 chegavam ao celular do almoxarife. Agora a função grava também esses pedidos, marcados `so_separacao = true`.
-- Essa marca existe para as telas e alertas do PCP (Emissão de NF, Expedição, SLA, relatórios, necessidade, painéis) ignorarem
-- esses pedidos: sem ela eles apareceriam como "sem OP no PCP" e disparariam alerta de prazo. Quem lê para separar (a função
-- estoque_separacao_chamar / estoque_separacao_chegadas) NÃO filtra por essa coluna.
-- Aditiva: todas as linhas atuais viram `false` (todas têm item do PCP).
alter table public.pcp_pedidos add column if not exists so_separacao boolean not null default false;
comment on column public.pcp_pedidos.so_separacao is 'true = pedido sem item do PCP, gravado só para a fila de separação do almoxarifado (VP Estoque); telas do PCP ignoram';
