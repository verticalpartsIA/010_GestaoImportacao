-- Sync diário dos pagamentos de instaladores (Omie Contas a Pagar -> omie_pagamentos_cache).
-- 09:00 UTC = 06:00 Brasília, fora das janelas dos demais crons. Só LÊ do Omie.
select cron.schedule('omie-sync-pagamentos-instaladores-diario', '0 9 * * *', $cmd$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/omie_sync_pagamentos_instaladores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$cmd$);
