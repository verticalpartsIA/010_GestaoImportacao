-- Achado real (01/10/2026): o cron `sync-importacao-varejo-fornecedor-diario`,
-- agendado pra 30 12 * * * (9h30 BRT), colidia com `sync-importacao-varejo-daily`
-- (12:00 UTC = 9h BRT, catálogo/giro — escaneia ~7142 produtos do Omie + NF
-- desde 01/01/2024, ainda ativo via self-chaining 30 min depois). A colisão
-- fez o Omie recusar a 1ª chamada do dia com "Consumo redundante detectado",
-- a função esgotou as 6 tentativas de retry (até ~45s de backoff) e devolveu
-- HTTP 500 sem nunca gravar nem a 1ª página — o cursor ficou preso em
-- fase='pedidos'/next_pagina=1 (resetado, nunca avançado) até alguém invocar
-- manualmente de novo. Sem isso, o cache de fornecedor/preço nunca se atualiza
-- sozinho (fica parado pra sempre no estado do dia anterior).
-- Reagendado pra 0 2 * * * (23h BRT) — longe de TODOS os outros crons do
-- projeto: ais-sync-daily (06:00 UTC), sync-importacao-varejo-daily (12:00),
-- sync-importacao-varejo-estoque-4x-dia (10/14/18/22:00) — com folga de pelo
-- menos 4h de cada lado. Aplicado direto em produção via sb_execute_sql
-- (cron.alter_job) no mesmo dia; esta migration só sincroniza o repo com o
-- estado real do banco, pra uma reaplicação de migrations do zero não voltar
-- ao horário antigo que colide.
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'sync-importacao-varejo-fornecedor-diario'),
  schedule := '0 2 * * *'
);
