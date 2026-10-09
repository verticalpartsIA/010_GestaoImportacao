-- Markup por card (Financeiro, 01/10/2026): o card 90 dias (Exclusivo) passa a ter
-- markup próprio; o card 120 dias (Compartilhado) segue em mark_up_pct.
-- Null = retrocompatível (usa mark_up_pct, como antes).
alter table public.precificacoes_elevador add column if not exists mark_up_pct_expresso numeric;
comment on column public.precificacoes_elevador.mark_up_pct_expresso is 'Markup do card 90 dias (Exclusivo). Null = usa mark_up_pct (retrocompatível).';
notify pgrst, 'reload schema';
