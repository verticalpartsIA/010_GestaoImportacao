-- Suplência (24/10/2026): vpsistema_completar_alocacoes só INSERIA grupos de menu. Quando a pessoa perde TODAS as alçadas
-- (ex.: fim de uma substituição temporária), os grupos que o próprio vpsistema deu ficavam órfãos.
-- Agora: sem nenhum grupo justificado pelas alçadas, apaga só as alocações feitas por 'vpsistema (alçadas)' e volta ao marcador
-- '__acesso_restrito__'. Alocações manuais (outro alocado_por) nunca são tocadas; acesso_manual continua pulado.
create or replace function public.vpsistema_completar_alocacoes(p_perfil uuid) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; v_n int; grupos text[]; tinha boolean;
begin
  if exists (select 1 from public.perfis where id = p_perfil and acesso_manual) then return 0; end if;
  if not exists (select 1 from public.colaboradores_vpsistema where id = p_perfil) then return 0; end if;
  if not exists (select 1 from public.perfis where id = p_perfil and ativo) then return 0; end if;
  if exists (select 1 from public.perfis where id = p_perfil and nivel = 'Administrador') then return 0; end if;
  grupos := public.vpsistema_grupos_das_alcadas(p_perfil);
  if cardinality(grupos) = 0 then
    delete from public.colaborador_alocacoes
     where colaborador_id = p_perfil and alocado_por = 'vpsistema (alçadas)' and grupo_modulo <> '__acesso_restrito__';
  end if;
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
