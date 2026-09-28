-- Habilita Postgres Changes (Realtime) nas 4 tabelas usadas pra tirar o
-- app de "só atualiza se recarregar a tela": embarques (posição/status do
-- AIS), propostas (visualizada/assinada/recusada via /assinar/<token>),
-- vistorias_atividades (montador respondeu via vistoria-execucao.html) e
-- emails_projeto (resposta de fornecedor pega pelo cron read-inbox-poll).
--
-- A publication supabase_realtime já existe no projeto (padrão do Supabase)
-- mas estava vazia — nenhuma tabela tinha Realtime habilitado antes desta
-- migration. RLS de cada tabela já permite SELECT pra anon (conferido em
-- pg_policies antes de aplicar), que é o papel usado pelo app o tempo todo
-- (não há sessão de Auth real aqui) — sem isso o Realtime autorizaria e não
-- entregaria nenhum evento.
alter publication supabase_realtime add table public.embarques;
alter publication supabase_realtime add table public.propostas;
alter publication supabase_realtime add table public.vistorias_atividades;
alter publication supabase_realtime add table public.emails_projeto;
