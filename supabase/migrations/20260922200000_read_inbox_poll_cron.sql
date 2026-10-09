-- 22/09 — pedido do usuário: "garanta que quando kimmy responder a
-- resposta volta para dentro do site". Antes, read-inbox só rodava
-- quando alguém abria a tela Inbox (sem cron) — uma resposta do
-- fornecedor só aparecia no site se um vendedor abrisse/atualizasse a
-- tela depois. Agora um job pg_cron chama read-inbox a cada 10 minutos
-- (mesmo padrão já usado por ais-sync-daily), então a resposta é lida
-- e vinculada ao numero_cotacao (via Message-ID/In-Reply-To) mesmo sem
-- ninguém com a tela aberta.
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
    body := '{"limit": 25}'::jsonb
  );
  $$
);
