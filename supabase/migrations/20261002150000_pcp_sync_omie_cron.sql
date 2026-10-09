-- PCP · sincronização Omie → PCP 4x/dia (mesmo padrão do cron de estoque de Importação Varejo).
-- 7h20, 11h20, 15h20 e 19h20 BRT (= 10:20, 14:20, 18:20, 22:20 UTC). Os 20 minutos de
-- folga evitam colidir com `sync-importacao-varejo-estoque-4x-dia` (:00 dessas mesmas horas):
-- duas chamadas simultâneas ao Omie dão "Consumo redundante" e uma das duas falha.
-- timeout 120 s: ~100 ConsultarProduto + ~20 páginas de ListarPosEstoque + 4 estruturas.
select cron.schedule(
  'sync-pcp-omie-4x-dia',
  '20 10,14,18,22 * * *',
  $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-pcp-omie',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{"escopo":"tudo"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
