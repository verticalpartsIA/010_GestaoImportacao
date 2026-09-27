-- Habilita RLS nas últimas 3 tabelas do achado ERROR do Security Advisor
-- (0013_rls_disabled_in_public, auditoria de 27/09/2026) que ainda faltavam
-- depois de 20260927220000/20260927221500 (família Parceiros Instaladores).

-- ---------------------------------------------------------------------
-- contrato_instalador_parcelas — acessada direto do navegador
-- (contrato-instalador-parcelas-store.js): select/insert/update, sem
-- nenhum delete em uso em lugar nenhum do código. Mesmo padrão de acesso
-- de antes (anon key, SSO na camada da aplicação) para select/insert/update;
-- delete NÃO é concedido (não é usado — reduz privilégio sem risco de
-- quebrar nada).
-- ---------------------------------------------------------------------
alter table public.contrato_instalador_parcelas enable row level security;

revoke all on table public.contrato_instalador_parcelas from anon, authenticated;
grant select, insert, update on table public.contrato_instalador_parcelas to anon, authenticated;
grant select, insert, update, delete on table public.contrato_instalador_parcelas to service_role;

create policy "contrato_instalador_parcelas_anon_all" on public.contrato_instalador_parcelas
  for all to anon using (true) with check (true);
create policy "contrato_instalador_parcelas_auth_all" on public.contrato_instalador_parcelas
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- quadros_comando_componentes — acessada direto do navegador
-- (quadro-comando-store.js: salvarComponentes/upsert). Mesmo raciocínio:
-- select/insert/update liberados, delete não concedido (não usado).
-- ---------------------------------------------------------------------
alter table public.quadros_comando_componentes enable row level security;

revoke all on table public.quadros_comando_componentes from anon, authenticated;
grant select, insert, update on table public.quadros_comando_componentes to anon, authenticated;
grant select, insert, update, delete on table public.quadros_comando_componentes to service_role;

create policy "quadros_comando_componentes_anon_all" on public.quadros_comando_componentes
  for all to anon using (true) with check (true);
create policy "quadros_comando_componentes_auth_all" on public.quadros_comando_componentes
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- omie_estoque_cache — cache de saldo de estoque lido/escrito só pela Edge
-- Function quadro-comando-cruzamento-erp, que usa SUPABASE_SERVICE_ROLE_KEY.
-- Não há nenhum acesso direto do navegador (grep confirmado em src/) —
-- diferente das duas tabelas acima, aqui dá pra fechar de verdade: zero
-- grant para anon/authenticated. RLS habilitado sem policy pra esses dois
-- roles é intencional (nada acessível via chave pública); service_role
-- ignora RLS (BYPASSRLS) e só precisa do grant.
-- ---------------------------------------------------------------------
alter table public.omie_estoque_cache enable row level security;

revoke all on table public.omie_estoque_cache from anon, authenticated;
grant select, insert, update, delete on table public.omie_estoque_cache to service_role;
