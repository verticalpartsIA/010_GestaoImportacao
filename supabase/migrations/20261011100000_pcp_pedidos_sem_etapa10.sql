-- PCP — etapa 10 do Omie nunca fica em pcp_pedidos (11/10/2026)
-- Regra (CLAUDE.md, 03/10): etapa 10 ("Pedido", antes de "Separar estoque/produção") é só PREVISÃO e vive em
-- pcp_previsao_pedidos/itens. Mas a carga de 90 dias (cron de domingo `pcp-carga-semanal-2-ler` e o botão "Carregar 90 dias"
-- dos Relatórios) chama sync-pcp-pedidos sem `etapa`, e esse modo grava TODAS as etapas em pcp_pedidos — em 11/10 entrou o
-- pedido 18716 (etapa 10, de 2024), que viraria "pedido sem OP" no alerta de prazos e venda firme no alerta de compras.
-- Correção no banco (sem reimplantar a função): limpeza das linhas etapa 10 que ainda não viraram trabalho (sem OP-mãe e
-- sem expedição). O pedido continua na previsão (o job da etapa 10 cuida) e volta a pcp_pedidos quando chegar à etapa 20.
-- Etapa 00 (proposta) continua em pcp_pedidos de propósito: os relatórios de vendas a usam; as telas de trabalho a ignoram.

create or replace function public.pcp_pedidos_tirar_etapa10() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.pcp_pedidos p
   where p.etapa = '10'
     and not exists (select 1 from public.pcp_ordens o where o.pedido_codigo = p.codigo_pedido)
     and not exists (select 1 from public.pcp_expedicoes e where e.pedido_codigo = p.codigo_pedido);
  get diagnostics n = row_count;          -- os itens saem junto (FK on delete cascade)
  return n;
end $$;
revoke all on function public.pcp_pedidos_tirar_etapa10() from public, anon, authenticated;

-- Roda logo depois da carga de domingo e, por segurança, a cada hora (pega também o botão "Carregar 90 dias").
select cron.schedule('pcp-pedidos-tirar-etapa10', '20 * * * *', $$ select public.pcp_pedidos_tirar_etapa10() $$);

select public.pcp_pedidos_tirar_etapa10();
