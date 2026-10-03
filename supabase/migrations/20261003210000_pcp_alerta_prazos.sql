-- PCP · alerta automático de PRAZO (SLA) dos pedidos de venda na Central de Notificações.
-- Seg–sex 07:05 de Brasília (10:05 UTC), logo depois dos alertas de compra (10:00 UTC). A função NÃO chama o Omie.
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'pcp-alerta-prazos-diario';
end $$;

select cron.schedule('pcp-alerta-prazos-diario', '5 10 * * 1-5', $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/alerta-pcp-prazos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
