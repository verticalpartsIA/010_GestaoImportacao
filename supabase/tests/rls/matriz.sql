-- Verificação por tabela depois de fechar (Fase 1 / Task 4 da #571). Trocar a tabela em t(tabela) pela da onda em teste.
-- Esperado numa tabela JÁ FECHADA: as 3 linhas com ok = true. Numa tabela ainda ABERTA, 'anon sem acesso' dá ok = false (a sonda detecta a brecha).
with t(tabela) as (values ('importacao_varejo_produtos'))
select 'anon sem acesso' as caso,
       (coalesce((r->>'linhas')::int, 0) = 0 or r->>'erro' is not null) as ok, r
  from t, lateral (select public.vp_rls_probe(t.tabela, 'anon', null) as r) a
union all
select 'ativo enxerga', (r->>'erro' is null), r
  from t, lateral (select public.vp_rls_probe(t.tabela, 'authenticated', (select email from public.perfis where ativo and nivel = 'Colaborador' limit 1)) as r) b
union all
select 'fora de perfis não enxerga', (coalesce((r->>'linhas')::int, 0) = 0), r
  from t, lateral (select public.vp_rls_probe(t.tabela, 'authenticated', 'fantasma@vpsistema.com') as r) c;
