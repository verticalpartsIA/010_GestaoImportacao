-- Acesso MANUAL por pessoa (14/10/2026, pedido do Gelson).
-- Regra geral continua: alçadas e menu vêm do vpsistema.com/administracao pelo vpsistema-sync.
-- Exceção por pessoa: com perfis.acesso_manual = true o vpsistema-sync NÃO mexe nas alçadas
-- nem nos grupos do menu dela; um Administrador marca/desmarca direto na tela
-- Configurações › Administração (RPCs abaixo, só Administrador).

alter table public.perfis
  add column if not exists acesso_manual boolean not null default false,
  add column if not exists acesso_manual_em timestamptz,
  add column if not exists acesso_manual_por text;

-- Liga/desliga o modo manual de uma pessoa.
create or replace function public.hub_set_acesso_manual(p_perfil uuid, p_manual boolean)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.vp_eh_admin() then
    return jsonb_build_object('ok', false, 'motivo', 'so_administrador');
  end if;
  update public.perfis
     set acesso_manual = coalesce(p_manual, false),
         acesso_manual_em = case when coalesce(p_manual, false) then now() else null end,
         acesso_manual_por = case when coalesce(p_manual, false) then public.vp_email() else null end
   where id = p_perfil;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'perfil_inexistente'); end if;
  return jsonb_build_object('ok', true, 'acesso_manual', coalesce(p_manual, false));
end;
$$;

-- Marca/desmarca UMA capacidade (ex.: 'propostas' + 'ver') de uma pessoa em modo manual.
create or replace function public.hub_set_alcada_manual(p_perfil uuid, p_modulo text, p_capacidade text, p_concedida boolean)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.vp_eh_admin() then
    return jsonb_build_object('ok', false, 'motivo', 'so_administrador');
  end if;
  if not exists (select 1 from public.perfis where id = p_perfil and acesso_manual) then
    return jsonb_build_object('ok', false, 'motivo', 'perfil_nao_esta_em_modo_manual');
  end if;
  if coalesce(p_modulo, '') = '' or coalesce(p_capacidade, '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'parametros_invalidos');
  end if;
  if p_concedida then
    insert into public.alcadas_capacidade (perfil_id, modulo, capacidade, concedido_por, concedido_em)
    values (p_perfil, p_modulo, p_capacidade, public.vp_email(), now())
    on conflict (perfil_id, modulo, capacidade) do nothing;
  else
    delete from public.alcadas_capacidade
     where perfil_id = p_perfil and modulo = p_modulo and capacidade = p_capacidade;
  end if;
  return jsonb_build_object('ok', true, 'modulo', p_modulo, 'capacidade', p_capacidade, 'concedida', p_concedida);
end;
$$;

revoke all on function public.hub_set_acesso_manual(uuid, boolean) from public, anon;
revoke all on function public.hub_set_alcada_manual(uuid, text, text, boolean) from public, anon;
grant execute on function public.hub_set_acesso_manual(uuid, boolean) to authenticated, service_role;
grant execute on function public.hub_set_alcada_manual(uuid, text, text, boolean) to authenticated, service_role;

-- O sync do vpsistema passa por cima de quem está em modo manual (não apaga, não inclui, não mexe no menu).
-- vpsistema_completar_alocacoes: igual à versão de 20261013200000 + a guarda do modo manual.
create or replace function public.vpsistema_completar_alocacoes(p_perfil uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  n int := 0;
  v_n int;
  grupos text[];
  tinha boolean;
begin
  if exists (select 1 from public.perfis where id = p_perfil and acesso_manual) then return 0; end if;
  if not exists (select 1 from public.colaboradores_vpsistema where id = p_perfil) then return 0; end if;
  if not exists (select 1 from public.perfis where id = p_perfil and ativo) then return 0; end if;
  if exists (select 1 from public.perfis where id = p_perfil and nivel = 'Administrador') then return 0; end if;

  grupos := public.vpsistema_grupos_das_alcadas(p_perfil);
  tinha := exists (select 1 from public.colaborador_alocacoes where colaborador_id = p_perfil);

  if cardinality(grupos) > 0 then
    insert into public.colaborador_alocacoes (colaborador_id, grupo_modulo, alocado_por)
    select p_perfil, g, 'vpsistema (alçadas)' from unnest(grupos) g
    on conflict (colaborador_id, grupo_modulo) do nothing;
    get diagnostics n = row_count;
    delete from public.colaborador_alocacoes where colaborador_id = p_perfil and grupo_modulo = '__acesso_restrito__';
  elsif not tinha then
    insert into public.colaborador_alocacoes (colaborador_id, grupo_modulo, alocado_por)
    values (p_perfil, '__acesso_restrito__', 'vpsistema (alçadas)')
    on conflict (colaborador_id, grupo_modulo) do nothing;
    get diagnostics v_n = row_count;
    n := v_n;
  end if;
  return n;
end;
$$;
revoke all on function public.vpsistema_completar_alocacoes(uuid) from public, anon, authenticated;

-- vpsistema_set_alcadas: igual à versão de 20261013180000 + devolve "pulado" quando a pessoa está em modo manual.
create or replace function public.vpsistema_set_alcadas(p_email text, p_caps text[], p_modulos text[])
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  pid   uuid;
  n_del int;
  n_ins int;
  n_aloc int := 0;
begin
  select id into pid from public.perfis where lower(email) = lower(p_email) limit 1;
  if pid is null then
    return jsonb_build_object('ok', false, 'email', p_email, 'motivo', 'sem_perfil_no_hub');
  end if;
  if exists (select 1 from public.perfis where id = pid and acesso_manual) then
    return jsonb_build_object('ok', true, 'email', p_email, 'pulado', 'acesso_manual');
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

  begin
    n_aloc := public.vpsistema_completar_alocacoes(pid);
  exception when others then
    raise warning 'vpsistema_completar_alocacoes falhou para %: %', p_email, sqlerrm;
  end;

  return jsonb_build_object('ok', true, 'email', p_email, 'removidas', n_del, 'incluidas', n_ins, 'grupos_menu_incluidos', n_aloc);
end;
$$;

-- Caroline Moura (id d63b8946-741c-495b-8e37-7a65d07551af): liberada para preenchimento manual a pedido do Gelson.
update public.perfis
   set acesso_manual = true, acesso_manual_em = now(), acesso_manual_por = 'gelson.simoes@verticalparts.com.br'
 where id = 'd63b8946-741c-495b-8e37-7a65d07551af';
