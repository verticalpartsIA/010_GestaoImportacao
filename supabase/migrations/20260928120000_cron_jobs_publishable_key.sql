-- Troca a chave anon legada pela publishable nova nos 2 cron jobs
-- (ais-sync-daily, read-inbox-poll) — parte da migração de chaves legadas
-- (auditoria de boas práticas Supabase, continuação de #397 em diante).
--
-- Acrescenta também o header "apikey" (recomendação oficial: chave nova
-- deve ir em apikey, não só em Authorization) — testado ao vivo antes desta
-- migration com curl direto nos 2 endpoints, os dois aceitaram a chave nova
-- (com e sem apikey), então este ajuste é preventivo/best-practice, não
-- corrigindo um erro observado.
--
-- Usa cron.alter_job() (API oficial do pg_cron) em vez de UPDATE direto em
-- cron.job (schema gerenciado pela extensão).

select cron.alter_job(
  job_id := 1,
  command := $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/ais-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.alter_job(
  job_id := 2,
  command := $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/read-inbox',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{"limit": 25}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
