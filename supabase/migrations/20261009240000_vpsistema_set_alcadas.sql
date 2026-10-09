-- O vpsistema.com é a fonte central das alçadas (decisão do Gelson, 09/10/2026).
-- Esta função é a ÚNICA porta por onde o vpsistema grava as alçadas do HUB:
-- recebe o e-mail da pessoa + a lista COMPLETA do que ela pode (modulo.capacidade)
-- + os módulos que o vpsistema governa, e acerta `alcadas_capacidade`:
--   • remove, nesses módulos, o que não está mais na lista;
--   • inclui o que falta.
-- Módulos fora da lista p_modulos ficam intocados. Só service_role executa.
-- Detalhes: README do repo vpsistema → "Lógica de permissões — árvore de alçadas".

create or replace function public.vpsistema_set_alcadas(p_email text, p_caps text[], p_modulos text[])
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  pid   uuid;
  n_del int;
  n_ins int;
begin
  select id into pid from public.perfis where lower(email) = lower(p_email) limit 1;
  if pid is null then
    return jsonb_build_object('ok', false, 'email', p_email, 'motivo', 'sem_perfil_no_hub');
  end if;

  delete from public.alcadas_capacidade
  where perfil_id = pid
    and modulo = any (p_modulos)
    and not ((modulo || '.' || capacidade) = any (coalesce(p_caps, '{}')));
  get diagnostics n_del = row_count;

  insert into public.alcadas_capacidade (perfil_id, modulo, capacidade, concedido_por, concedido_em)
  select pid, split_part(c, '.', 1), split_part(c, '.', 2), 'vpsistema', now()
  from unnest(coalesce(p_caps, '{}')) as c
  on conflict (perfil_id, modulo, capacidade) do nothing;
  get diagnostics n_ins = row_count;

  return jsonb_build_object('ok', true, 'email', p_email, 'removidas', n_del, 'incluidas', n_ins);
end;
$$;

revoke all on function public.vpsistema_set_alcadas(text, text[], text[]) from public, anon, authenticated;
grant execute on function public.vpsistema_set_alcadas(text, text[], text[]) to service_role;
