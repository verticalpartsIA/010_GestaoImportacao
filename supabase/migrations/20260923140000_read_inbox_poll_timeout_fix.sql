-- 23/09 — bug real achado ao investigar "testei enviando e não chegou
-- no inbox": o job read-inbox-poll (criado ontem) estava falhando por
-- timeout EM TODAS as execuções desde que foi criado (~21h seguidas,
-- confirmado em net._http_response: status_code null, timed_out=true,
-- "Timeout of 5000 ms reached" toda vez). O pg_net usa timeout padrão
-- de 5000ms, mas o read-inbox de verdade leva ~5.6s pra rodar com
-- limit:25 (confirmado via curl direto, cronometrado) — sempre estourava
-- por pouco. Corrigido com timeout_milliseconds := 20000 (margem
-- confortável acima do tempo real observado).
select cron.schedule(
  'read-inbox-poll',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/read-inbox',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4dHF3em1wZ29md2N0cWFqZXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODk3NzcsImV4cCI6MjA5NTA2NTc3N30.hoNuKfSaSLFDKqJ2F331QSDQkzsiphWhLk3xtZh6Bpc'
    ),
    body := '{"limit": 25}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
