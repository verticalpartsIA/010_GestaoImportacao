-- PCP · alerta automático de compra (Reposição + Necessidade) na Central de Notificações.
-- 1) `alertas.rota`: caminho relativo opcional (ex.: /logistica/almoxarifado/reposicao) para o clique na notificação abrir a aba certa.
--    Coluna nula = comportamento de sempre (a notificação abre o módulo). Aditiva: nada existente muda.
-- 2) Cron diário às 07:00 de Brasília (10:00 UTC), DEPOIS dos syncs de consumo (04:30 UTC) e da posição de compra (04:50 UTC).
--    A função NÃO chama o Omie; só lê pcp_* e grava em alertas.
alter table public.alertas add column if not exists rota text;

do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'pcp-alerta-compras-diario';
end $$;

select cron.schedule('pcp-alerta-compras-diario', '0 10 * * *', $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/alerta-pcp-compras',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
