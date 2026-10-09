-- Segurança real (#571) · Fase 1 / Task 4 — sonda de RLS: "o que cada papel enxerga nesta tabela?" (04/10/2026).
-- ADITIVA e só de diagnóstico: SECURITY INVOKER, chamada como postgres (MCP SQL); simula o papel com `set local role` e as claims do JWT.
-- Uso: select public.vp_rls_probe('propostas', 'anon', null);  →  {"tabela","papel","linhas","erro"}
create or replace function public.vp_rls_probe(p_tabela text, p_papel text, p_email text default null) returns jsonb
language plpgsql as $$
declare n bigint; err text;
begin
  if p_papel not in ('anon','authenticated') then raise exception 'papel inválido: %', p_papel; end if;
  perform set_config('request.jwt.claims', json_build_object('role', p_papel, 'email', p_email, 'sub', gen_random_uuid())::text, true);
  execute format('set local role %I', p_papel);
  begin execute format('select count(*) from public.%I', p_tabela) into n;
  exception when others then err := sqlerrm; n := null; end;
  reset role;
  return jsonb_build_object('tabela', p_tabela, 'papel', p_papel, 'linhas', n, 'erro', err);
end $$;
revoke execute on function public.vp_rls_probe(text,text,text) from public, anon, authenticated;
grant  execute on function public.vp_rls_probe(text,text,text) to service_role;
