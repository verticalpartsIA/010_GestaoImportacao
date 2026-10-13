-- Importação Varejo · atualização diária do prazo real de reposição (antes do recálculo da sugestão às 03:30 UTC).
-- Ordem da madrugada (UTC): 03:10 vendas/entradas do Omie → 03:20 pedidos de compra recentes (só as últimas páginas) →
-- 03:25 prazo real (iv_calcular_prazo_real) → 03:30 sugestão de mínimo/máximo (iv_calcular_sugestao_estoque).
select cron.schedule(
  'sync-importacao-varejo-prazo-pedidos-diario',
  '20 3 * * *',
  $$ select net.http_post(
       url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-importacao-varejo-prazo',
       headers := jsonb_build_object('Content-Type', 'application/json',
         'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
         'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'),
       body := '{"recentes":true}'::jsonb,
       timeout_milliseconds := 120000
     ); $$
);
select cron.schedule(
  'importacao-varejo-prazo-real-diario',
  '25 3 * * *',
  $$ select public.iv_calcular_prazo_real(); $$
);
