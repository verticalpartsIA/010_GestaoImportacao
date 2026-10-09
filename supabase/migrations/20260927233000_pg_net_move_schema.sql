-- Move a extensão pg_net do schema public pra extensions (achado WARN
-- extension_in_public do Security Advisor, auditoria de 27/09/2026).
--
-- pg_net NÃO é relocável (extrelocatable=false) — "alter extension ...
-- set schema" (remediação padrão do Advisor) não funciona nela. O único
-- caminho é dropar e recriar. Verificado antes desta migration:
-- - pg_depend: todo objeto que depende da extensão tem deptype='e' (é a
--   própria extensão) — nada externo (função, view, trigger nosso)
--   depende dela. CASCADE é seguro.
-- - net.http_post/http_get/http_delete continuam existindo no schema
--   "net" (que a própria extensão cria, independente do schema alvo do
--   CREATE EXTENSION) — os 2 cron jobs ativos (ais-sync-daily,
--   read-inbox-poll) chamam net.http_post(...) e não são afetados.
-- - Nenhuma função net.* tinha GRANT customizado (proacl nulo == default
--   privileges), então não há nada pra restaurar manualmente.
-- - net.http_request_queue estava vazia; net._http_response tinha 36
--   linhas de histórico de chamadas (log operacional, não dado de
--   negócio) — perdidas no drop, sem impacto funcional.

drop extension if exists pg_net cascade;
create extension if not exists pg_net schema extensions;
