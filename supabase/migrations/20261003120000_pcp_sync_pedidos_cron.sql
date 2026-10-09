-- PCP · leitura automática dos pedidos de venda do Omie (fila de produção, NF e SLA).
-- Dois jobs ESCALONADOS (nunca juntos: a função apaga e regrava os itens do pedido; duas execuções ao mesmo tempo duplicariam itens).
--   :00 e :30  → descobre pedidos novos na etapa 20 ("Separar Estoque / Produção")
--   :10 e :40  → relê os pedidos já conhecidos e não entregues (NF emitida, mudança de etapa)
-- Seg–sex, 7h–19h (Brasília) = 10–22 UTC. Só LÊ do Omie. Limite de taxa da função: 20/IP e 40 global por 10 min.
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('sync-pcp-pedidos-etapa20', 'sync-pcp-pedidos-abertos');
end $$;

select cron.schedule('sync-pcp-pedidos-etapa20', '0,30 10-22 * * 1-5', $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-pcp-pedidos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{"etapa":"20"}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);

select cron.schedule('sync-pcp-pedidos-abertos', '10,40 10-22 * * 1-5', $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-pcp-pedidos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{"atualizar_abertos":true}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
