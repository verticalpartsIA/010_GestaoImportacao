-- vpsistema → HUB: cria o perfil quando o e-mail ainda não existe (13/10/2026).
-- Chamada pela edge function vpsistema-sync (v6) antes de vpsistema_set_alcadas /
-- vpsistema_set_valores, quando o corpo traz p_perfil. id = id do profiles do
-- vpsistema; nivel é SEMPRE 'Colaborador' (o poder no HUB vem das alçadas).
-- Já aplicada em produção (projeto jxtqwzmpgofwctqajewt) em 13/10/2026.

create or replace function public.vpsistema_ensure_perfil(p jsonb)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if p is null or coalesce(p->>'email', '') = '' or coalesce(p->>'id', '') = '' then
    return null;
  end if;
  select id into pid from public.perfis where lower(email) = lower(p->>'email') limit 1;
  if pid is not null then return pid; end if;

  -- nivel é sempre Colaborador: o poder no HUB vem das alçadas, não do nível.
  insert into public.perfis (id, email, nome, nivel, departamento, ativo, whatsapp_number)
  values ((p->>'id')::uuid, lower(p->>'email'), p->>'nome', 'Colaborador',
          p->>'departamento', coalesce((p->>'ativo')::boolean, true), p->>'whatsapp')
  on conflict do nothing;

  select id into pid from public.perfis where lower(email) = lower(p->>'email') limit 1;
  return pid;
end;
$$;
revoke all on function public.vpsistema_ensure_perfil(jsonb) from public, anon, authenticated;
