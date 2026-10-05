-- Comissão do lead: manual; NULL = padrão de 2% (aplicado na tela, não gravado). Aditiva.
alter table public.leads add column if not exists comissao_pct numeric(5,2);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leads_comissao_pct_faixa') then
    alter table public.leads add constraint leads_comissao_pct_faixa check (comissao_pct is null or (comissao_pct >= 0 and comissao_pct <= 100));
  end if;
end $$;
notify pgrst, 'reload schema';
