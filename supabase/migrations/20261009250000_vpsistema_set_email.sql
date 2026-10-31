-- Troca de e-mail vinda do vpsistema (o login é a chave que liga a pessoa ao HUB).
-- Já aplicada no banco em 09/10/2026. Só service_role (chamada via edge function vpsistema-sync).
create or replace function public.vpsistema_set_email(p_old text, p_new text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  n_perfis int := 0;
  n_espelho int := 0;
begin
  if p_old is null or p_new is null or lower(p_old) = lower(p_new) then
    return jsonb_build_object('ok', true, 'sem_mudanca', true);
  end if;
  update public.perfis set email = lower(p_new) where lower(email) = lower(p_old);
  get diagnostics n_perfis = row_count;
  if to_regclass('public.colaboradores_vpsistema') is not null then
    execute 'update public.colaboradores_vpsistema set email = lower($1) where lower(email) = lower($2)' using p_new, p_old;
    get diagnostics n_espelho = row_count;
  end if;
  return jsonb_build_object('ok', true, 'perfis', n_perfis, 'espelho', n_espelho);
end;
$$;
revoke all on function public.vpsistema_set_email(text, text) from public, anon, authenticated;
grant execute on function public.vpsistema_set_email(text, text) to service_role;
