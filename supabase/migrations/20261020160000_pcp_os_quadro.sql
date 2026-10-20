-- Regra do usuário (20/10/2026): Ordens de Serviço do Omie com quadro de
-- comando (clientes de licitação, Capex/Opex, compram serviço em vez de
-- produto) também precisam entrar na fila de produção do PCP, igual já
-- acontece hoje com Pedidos de Venda na etapa 20.

-- `origem` distingue, na mesma tabela que a tela "Pedidos para Produzir"
-- já lê, se a linha veio de um Pedido de Venda (produtos/pedido) ou de uma
-- Ordem de Serviço (servicos/os) — os dois Omie têm espaços de código
-- (nCodPed/nCodOS) distintos e nunca documentados como colidindo entre si,
-- então `codigo_pedido` continua servindo de chave única pras duas origens.
alter table public.pcp_pedidos
  add column if not exists origem text not null default 'pedido_venda'
  check (origem in ('pedido_venda', 'ordem_servico'));

-- Catálogo pequeno dos serviços do Omie que representam fabricação/
-- modernização de quadro de comando (achados em 20/10/2026 no cadastro de
-- serviços do Omie, por nCodServico — chave estável, ao contrário do texto
-- livre de cDescServ). Mesmo padrão de tabela pequena de referência já
-- usado em pcp_quadro_variante/pcp_codigo_alias.
create table if not exists public.pcp_servico_quadro (
  n_cod_servico bigint primary key,
  codigo text not null unique,
  descricao text not null
);
insert into public.pcp_servico_quadro (n_cod_servico, codigo, descricao) values
  (9003466946, 'VPSVC-032', 'Serviço de Substituição de Quadro de Comandos - Escada e Esteira Rolante'),
  (9003467049, 'VPSVC-033', 'Serviço de Modernização de Quadro de Comando'),
  (9003471082, 'VPSVC-059', 'Serviço de Substituição de Quadro de Comandos - Elevador')
on conflict (n_cod_servico) do nothing;

-- RLS fechada (regra do projeto desde a segurança real #571: toda tabela nova nasce fechada,
-- nunca "allow_all" como as tabelas pequenas antigas pcp_quadro_variante/pcp_codigo_alias) —
-- só a Edge Function sync-pcp-os (service_role) lê esta tabela; o navegador nunca precisa dela.
alter table public.pcp_servico_quadro enable row level security;
