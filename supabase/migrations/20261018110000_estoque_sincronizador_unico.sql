-- Estoque · fase 2 — UM sincronizador de estoque com o Omie (Edge Function sync-estoque-omie).
-- Antes, três rotinas liam o MESMO endpoint do Omie (estoque/consulta · ListarPosEstoque) em horários diferentes:
--   sync-importacao-varejo-estoque-4x-dia (:00)  → importacao_varejo_estoque
--   sync-pcp-omie-4x-dia (:20, escopo 'tudo')     → cadastro + estoque (pcp_estoque) + estrutura
--   sync-pcp-consumo-posicao (04:50, diário)      → pcp_posicao_compra
-- Agora: sync-estoque-omie (:00, 4x/dia) lê o Omie UMA vez e grava nos três destinos. O sync-pcp-omie continua, mas só com
-- cadastro (:20) e estrutura (:40) — sem repetir a leitura de estoque. As funções antigas seguem existindo (botões manuais).
-- Só aplicar DEPOIS de sync-estoque-omie estar no ar e conferido (simulação + uma rodada real); aplicada por MCP.

select cron.unschedule('sync-importacao-varejo-estoque-4x-dia');
select cron.unschedule('sync-pcp-consumo-posicao');

-- Mesmo job (mesmo id e histórico), agora só o cadastro.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'sync-pcp-omie-4x-dia'),
  command := $cmd$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-pcp-omie',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{"escopo":"cadastro"}'::jsonb,
    timeout_milliseconds := 120000
  );
$cmd$);

select cron.schedule('sync-pcp-omie-estrutura-4x-dia', '40 10,14,18,22 * * *', $cmd$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-pcp-omie',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{"escopo":"estrutura"}'::jsonb,
    timeout_milliseconds := 120000
  );
$cmd$);

select cron.schedule('sync-estoque-omie-4x-dia', '0 10,14,18,22 * * *', $cmd$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-estoque-omie',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$cmd$);
