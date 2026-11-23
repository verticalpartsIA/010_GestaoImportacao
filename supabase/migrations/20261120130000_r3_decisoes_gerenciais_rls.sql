-- R3 (Segurança real #571) · Tabela 4/4 do PR-A: decisoes_gerenciais
-- Fecha escrita/leitura anônima e adiciona trigger SECURITY INVOKER (BEFORE INSERT OR UPDATE)
-- atendendo C1-C5 e C7-C11 (whitelist, INVOKER, aprovador por lista ou vp_tem_capacidade('decisoes', papel),
-- reabertura segura sem injetar aprovadores, decidido_por = vp_email(), sem estado "meio decidido" e contexto travado).
-- Rollback:
--   drop trigger if exists trg_decisoes_guarda on public.decisoes_gerenciais;
--   drop function if exists public.fn_decisoes_guarda();
--   select public.vp_reabrir_tabela('decisoes_gerenciais');
--   grant truncate, references, trigger on public.decisoes_gerenciais to anon, authenticated;

select public.vp_fechar_tabela('decisoes_gerenciais', 'interno', 'R3');

revoke truncate, references, trigger on public.decisoes_gerenciais from authenticated;

-- SECURITY INVOKER de propósito: current_user = 'authenticated' só vale para chamadas diretas via PostgREST.
create or replace function public.fn_decisoes_guarda() returns trigger
language plpgsql set search_path = public as $$
declare
  v_email text := public.vp_email();
  v_eh_admin boolean := public.vp_eh_admin();
  v_eh_aprovador boolean;
  v_permitidos text[];
  v_item text;
begin
  if current_user <> 'authenticated' then return new; end if;

  -- C3: INSERT nunca nasce decidido nem com campos de decisão preenchidos
  if tg_op = 'INSERT' then
    if new.status not in ('pendente', 'bloqueada_por_dependencia') then
      raise exception 'Nova decisão deve nascer pendente ou bloqueada.' using errcode = '42501';
    end if;
    if new.decidido_por is not null or new.decidido_em is not null or new.motivo is not null then
      raise exception 'Nova decisão não pode nascer com decidido_por, decidido_em ou motivo.' using errcode = '42501';
    end if;
    if coalesce(cardinality(new.aprovadores_esperados), 0) = 0 then
      raise exception 'Nova decisão exige ao menos um aprovador esperado.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- C2: Colunas estruturais imutáveis para não-administrador
  if not v_eh_admin then
    if new.id is distinct from old.id
       or new.tipo is distinct from old.tipo
       or new.numero_cotacao is distinct from old.numero_cotacao
       or new.dossier_id is distinct from old.dossier_id
       or new.referencia_tabela is distinct from old.referencia_tabela
       or new.referencia_id is distinct from old.referencia_id
       or new.papel_requerido is distinct from old.papel_requerido
       or new.depende_de is distinct from old.depende_de
       or new.solicitado_por is distinct from old.solicitado_por
       or new.criado_em is distinct from old.criado_em then
      raise exception 'Campos estruturais da decisão não podem ser alterados.' using errcode = '42501';
    end if;

    -- Fora da reabertura (reprovada/cancelada -> pendente/bloqueada), aprovadores são imutáveis para não-admin
    if not (old.status in ('reprovada', 'cancelada') and new.status in ('pendente', 'bloqueada_por_dependencia')) then
      if new.aprovadores_esperados is distinct from old.aprovadores_esperados
         or new.aprovador_esperado_email is distinct from old.aprovador_esperado_email then
        raise exception 'Lista de aprovadores não pode ser alterada diretamente.' using errcode = '42501';
      end if;
    end if;
  end if;

  -- D1 + C7: Aprovador pela lista gravada OU pela alçada explícita do módulo 'decisoes' (SEM bypass de Administrador)
  v_eh_aprovador := exists (
    select 1 from unnest(coalesce(old.aprovadores_esperados, '{}'::text[])) e where lower(e) = v_email
  ) or lower(coalesce(old.aprovador_esperado_email, '')) = v_email
    or (old.papel_requerido is not null and exists (
      select 1
        from public.alcadas_capacidade a
        join public.perfis p on p.id = a.perfil_id
       where lower(p.email) = v_email
         and p.ativo
         and a.modulo = 'decisoes'
         and a.capacidade = old.papel_requerido
    ));

  -- C4 + C11: Decisão já aprovada é imutável (incluindo contexto)
  if old.status = 'aprovada' then
    if new.status is distinct from old.status
       or new.decidido_por is distinct from old.decidido_por
       or new.decidido_em is distinct from old.decidido_em
       or new.motivo is distinct from old.motivo
       or new.contexto is distinct from old.contexto then
      raise exception 'Decisão já aprovada é imutável.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- C4 + C8 + C9 + C11: Decisão reprovada ou cancelada
  if old.status in ('reprovada', 'cancelada') then
    if new.status in ('pendente', 'bloqueada_por_dependencia') then
      -- C9: Qualquer usuário ativo pode reabrir (como o botão da tela e garantirAtiva permitem), limpando decisão
      if new.decidido_por is not null or new.decidido_em is not null or new.motivo is not null then
        raise exception 'Ao reabrir decisão, decidido_por, decidido_em e motivo devem ser limpos.' using errcode = '42501';
      end if;
      -- C8: Para não-admin, nova lista de aprovadores só pode ser subconjunto de (lista antiga U perfis com alçada do papel)
      if not v_eh_admin and (new.aprovadores_esperados is distinct from old.aprovadores_esperados
                             or new.aprovador_esperado_email is distinct from old.aprovador_esperado_email) then
        select coalesce(array_agg(distinct lower(x)), '{}'::text[]) into v_permitidos
        from (
          select unnest(coalesce(old.aprovadores_esperados, '{}'::text[])) as x
          union
          select p.email as x
            from public.alcadas_capacidade a
            join public.perfis p on p.id = a.perfil_id
           where p.ativo and a.modulo = 'decisoes' and a.capacidade = old.papel_requerido
        ) s where x is not null;

        foreach v_item in array coalesce(new.aprovadores_esperados, '{}'::text[]) loop
          if not (lower(v_item) = any(v_permitidos)) then
            raise exception 'Não é permitido incluir aprovador sem alçada ao reabrir decisão.' using errcode = '42501';
          end if;
        end loop;
        if new.aprovador_esperado_email is not null and not (lower(new.aprovador_esperado_email) = any(v_permitidos)) then
          raise exception 'Não é permitido definir aprovador esperado sem alçada ao reabrir decisão.' using errcode = '42501';
        end if;
      end if;
      return new;
    end if;

    -- Sem reabertura: estado encerrado não muda status/decisão/contexto (C11)
    if new.status is distinct from old.status
       or new.decidido_por is distinct from old.decidido_por
       or new.decidido_em is distinct from old.decidido_em
       or new.motivo is distinct from old.motivo
       or new.contexto is distinct from old.contexto then
      raise exception 'Decisão encerrada não pode ser alterada.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Aprovar ou reprovar decisão pendente (Admin não aprova sem ser aprovador; C10 exige decidido_por = v_email; D2 sobrescreve decidido_em no servidor)
  if new.status in ('aprovada', 'reprovada') then
    if old.status <> 'pendente' or not v_eh_aprovador then
      raise exception 'Apenas um aprovador esperado de decisão pendente pode aprovar ou reprovar.' using errcode = '42501';
    end if;
    if lower(coalesce(new.decidido_por, '')) <> v_email then
      raise exception 'decidido_por deve corresponder ao usuário autenticado.' using errcode = '42501';
    end if;
    new.decidido_em := now();
    new.atualizado_em := now();
    return new;
  end if;

  -- C5 + C10: Cancelar (Admin, solicitante de pendente, almoxarifado.excluir em compra_varejo_logistica, ou cascata verificável com pai reprovado)
  if new.status = 'cancelada' then
    if v_eh_admin
       or (old.status = 'pendente' and lower(coalesce(old.solicitado_por, '')) = v_email)
       or (old.status = 'pendente' and old.tipo = 'compra_varejo_logistica' and public.vp_tem_capacidade('almoxarifado', 'excluir')) then
      if new.decidido_por is not null and lower(new.decidido_por) <> v_email then
        raise exception 'decidido_por deve corresponder ao usuário autenticado.' using errcode = '42501';
      end if;
      if new.decidido_por is null then new.decidido_por := v_email; end if;
      new.decidido_em := now();
      new.atualizado_em := now();
      return new;
    elsif old.status = 'bloqueada_por_dependencia' and exists (
      select 1 from public.decisoes_gerenciais p
       where p.id = any(coalesce(old.depende_de, '{}'::uuid[])) and p.status = 'reprovada'
    ) then
      if coalesce(new.decidido_por, 'sistema') <> 'sistema' then
        raise exception 'Cancelamento em cascata exige decidido_por = sistema.' using errcode = '42501';
      end if;
      new.decidido_em := coalesce(new.decidido_em, now());
      new.atualizado_em := now();
      return new;
    else
      raise exception 'Sem permissão para cancelar esta decisão.' using errcode = '42501';
    end if;
  end if;

  -- C11: Enquanto pendente ou bloqueada, decidido_por, decidido_em e motivo devem ficar nulos
  if new.status in ('pendente', 'bloqueada_por_dependencia') then
    if new.decidido_por is not null or new.decidido_em is not null or new.motivo is not null then
      raise exception 'Decisão aberta não pode ter decidido_por, decidido_em ou motivo.' using errcode = '42501';
    end if;
    if old.status = 'bloqueada_por_dependencia' and new.status = 'pendente' then
      if exists (
        select 1 from public.decisoes_gerenciais p
         where p.id = any(coalesce(old.depende_de, '{}'::uuid[])) and p.status <> 'aprovada'
      ) then
        raise exception 'Dependência ainda não aprovada.' using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end $$;

create or replace trigger trg_decisoes_guarda
  before insert or update on public.decisoes_gerenciais
  for each row execute function public.fn_decisoes_guarda();
