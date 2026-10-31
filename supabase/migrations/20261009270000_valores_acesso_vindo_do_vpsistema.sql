-- Quem vê valores R$ no HUB — vem do vpsistema (topo da árvore de alçadas).
-- modo 'nenhum' = R$ desfocado, exceto as etiquetas em `liberar`;
-- modo 'todos'  = vê tudo, exceto as etiquetas em `esconder`.
-- Etiquetas = vpsistema.catalog_value_tags (system 'cotacao-importacao'), formato 'modulo.etiqueta'.
create table if not exists public.valores_acesso (
  perfil_id     uuid primary key references public.perfis(id) on delete cascade,
  modo          text not null default 'nenhum' check (modo in ('nenhum', 'todos')),
  liberar       text[] not null default '{}',
  esconder      text[] not null default '{}',
  atualizado_em timestamptz not null default now()
);
alter table public.valores_acesso enable row level security;
drop policy if exists valores_acesso_leitura on public.valores_acesso;
create policy valores_acesso_leitura on public.valores_acesso for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.valores_acesso from anon, authenticated;

create or replace function public.vpsistema_set_valores(p_email text, p_modo text, p_liberar text[], p_esconder text[])
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  select id into pid from public.perfis where lower(email) = lower(p_email) limit 1;
  if pid is null then return jsonb_build_object('ok', false, 'motivo', 'sem_perfil_no_hub'); end if;
  insert into public.valores_acesso (perfil_id, modo, liberar, esconder, atualizado_em)
  values (pid, coalesce(p_modo, 'nenhum'), coalesce(p_liberar, '{}'), coalesce(p_esconder, '{}'), now())
  on conflict (perfil_id) do update
    set modo = excluded.modo, liberar = excluded.liberar, esconder = excluded.esconder, atualizado_em = now();
  return jsonb_build_object('ok', true, 'modo', coalesce(p_modo, 'nenhum'));
end;
$$;
revoke all on function public.vpsistema_set_valores(text, text, text[], text[]) from public, anon, authenticated;
grant execute on function public.vpsistema_set_valores(text, text, text[], text[]) to service_role;

-- Pergunta usada pelo HUB (tela e, na fase F1, as views mascaradas):
-- "este perfil pode ver o valor desta etiqueta?"
create or replace function public.vp_ve_valor(p_perfil uuid, p_tag text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when va.perfil_id is null then false
    when va.modo = 'todos' then not (p_tag = any (va.esconder))
    else p_tag = any (va.liberar)
  end
  from (select 1) x left join public.valores_acesso va on va.perfil_id = p_perfil
$$;
grant execute on function public.vp_ve_valor(uuid, text) to anon, authenticated;
