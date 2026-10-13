-- Importação Varejo · atualização diária da sugestão de estoque mínimo/máximo.
-- 03:10 UTC lê as vendas dos últimos 60 dias no Omie (só leitura); 03:30 UTC recalcula a sugestão.
-- Horários longe dos outros jobs do projeto (fornecedor 02:00, PCP consumo 04:30/04:50, estoque 10/14/18/22).
select cron.schedule(
  'sync-importacao-varejo-vendas-diario',
  '10 3 * * *',
  $$ select net.http_post(
       url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-importacao-varejo-vendas',
       headers := jsonb_build_object('Content-Type', 'application/json',
         'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
         'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'),
       body := '{}'::jsonb,
       timeout_milliseconds := 120000
     ); $$
);
select cron.schedule(
  'importacao-varejo-sugestao-estoque-diario',
  '30 3 * * *',
  $$ select public.iv_calcular_sugestao_estoque(); $$
);
