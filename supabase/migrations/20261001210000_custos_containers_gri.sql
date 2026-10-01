-- GRI (General Rate Increase) no cadastro de Containers (Financeiro, 01/10/2026): coluna ao lado da Capatazia,
-- herdada pela Precificação como Despesa Operacional (mesma mecânica do preço e da capatazia).
alter table public.custos_containers add column if not exists gri_usd numeric, add column if not exists gri_rs numeric;
comment on column public.custos_containers.gri_usd is 'GRI (General Rate Increase) por container (USD). Herdada pela Precificação como Despesa Operacional.';
comment on column public.custos_containers.gri_rs is 'GRI por container (R$ = USD x câmbio do dia, editável).';
notify pgrst, 'reload schema';
