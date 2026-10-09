-- Segurança real (#571) · Task 1 passo 3 — diagnóstico: "quem o banco acha que sou?" (04/10/2026). Aditiva; só mostra o próprio JWT.
create or replace function public.vp_whoami() returns jsonb language sql stable as $$
  select jsonb_build_object('role', auth.role(), 'email', auth.jwt()->>'email', 'sub', auth.jwt()->>'sub', 'iss', auth.jwt()->>'iss');
$$;
revoke execute on function public.vp_whoami() from public, anon;
grant  execute on function public.vp_whoami() to authenticated, service_role;
