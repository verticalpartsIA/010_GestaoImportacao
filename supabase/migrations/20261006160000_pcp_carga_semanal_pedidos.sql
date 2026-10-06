-- Relatórios do PCP — carga semanal automática dos últimos 90 dias de pedidos de venda (06/10/2026)
-- Os relatórios de vendas (Pedidos, Clientes, Fluxo de Caixa) só enxergam o que já foi lido do Omie; a leitura automática cobre só os
-- pedidos abertos. Aos domingos o sistema lê 90 dias. Pedido NOVO que já chega faturado/entregue (etapa 60+) entra como HISTÓRICO
-- (mesma regra do botão "Carregar 90 dias"), para não gerar prazo de NF nem expedição de trabalho que já foi feito.
-- Três passos no domingo (UTC): 07:00 tira a foto dos pedidos existentes, 07:05 lê o Omie, 07:40 marca como histórico os novos 60+.

create table if not exists public.pcp_carga_snapshot (numero_pedido text primary key);
alter table public.pcp_carga_snapshot enable row level security;     -- sem política: só o banco usa

create or replace function public.pcp_carga_snapshot_tirar() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  truncate public.pcp_carga_snapshot;
  insert into public.pcp_carga_snapshot select distinct numero_pedido from public.pcp_pedidos where numero_pedido is not null;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.pcp_carga_marcar_historico() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if not exists (select 1 from public.pcp_carga_snapshot) then return 0; end if;       -- sem foto = sem como saber o que é novo
  insert into public.pcp_pedido_acompanhamento (numero_pedido, historico, atualizado_por)
  select distinct p.numero_pedido, true, 'carga semanal automática'
    from public.pcp_pedidos p
   where p.etapa ~ '^[0-9]+$' and p.etapa::int >= 60
     and not exists (select 1 from public.pcp_carga_snapshot s where s.numero_pedido = p.numero_pedido)
  on conflict (numero_pedido) do nothing;
  get diagnostics n = row_count;
  truncate public.pcp_carga_snapshot;
  return n;
end $$;
revoke all on function public.pcp_carga_snapshot_tirar() from public, anon, authenticated;
revoke all on function public.pcp_carga_marcar_historico() from public, anon, authenticated;

select cron.schedule('pcp-carga-semanal-1-foto', '0 7 * * 0', $$ select public.pcp_carga_snapshot_tirar() $$);
select cron.schedule('pcp-carga-semanal-2-ler', '5 7 * * 0', $$
  select net.http_post(url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-pcp-pedidos',
    headers := jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP','Authorization','Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'),
    body := '{"dias":90}'::jsonb, timeout_milliseconds := 150000);
$$);
select cron.schedule('pcp-carga-semanal-3-historico', '40 7 * * 0', $$ select public.pcp_carga_marcar_historico() $$);
