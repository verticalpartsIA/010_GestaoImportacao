-- Markup padrão por card (Financeiro, 01/10/2026): novas precificações nascem com 40,5% (120 dias)
-- e 38,1% (90 dias). Precificações existentes guardam o próprio markup e não mudam.
alter table public.parametros_fiscais_elevador add column if not exists mark_up_padrao_expresso_pct numeric not null default 0.381;
comment on column public.parametros_fiscais_elevador.mark_up_padrao_expresso_pct is 'Markup padrão do card 90 dias (Exclusivo) nas novas precificações (Financeiro, 01/10/2026).';
update public.parametros_fiscais_elevador set mark_up_padrao_pct = 0.405, mark_up_padrao_expresso_pct = 0.381 where id = 'default';
notify pgrst, 'reload schema';
