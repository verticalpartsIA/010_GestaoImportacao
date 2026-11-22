-- R3 (Segurança real #571) · Tabela 2/4 do PR-A: avais_juridicos
-- Fecha escrita/leitura anônima, corrige vp_int_del ('aval-juridico') e adiciona trigger
-- SECURITY INVOKER (BEFORE INSERT OR UPDATE) para exigir alçada aval-juridico.editar ao dar/alterar aval,
-- mantendo vincularContrato (contrato_venda_id NULL -> valor) e triggers SECURITY DEFINER funcionando.
-- Rollback:
--   drop trigger if exists trg_avais_juridicos_guarda on public.avais_juridicos;
--   drop function if exists public.fn_avais_juridicos_guarda();
--   select public.vp_reabrir_tabela('avais_juridicos');
--   grant truncate, references, trigger on public.avais_juridicos to anon, authenticated;

select public.vp_fechar_tabela('avais_juridicos', 'interno', 'R3');

revoke truncate, references, trigger on public.avais_juridicos from authenticated;

drop policy if exists vp_int_del on public.avais_juridicos;
create policy vp_int_del on public.avais_juridicos
  for delete to authenticated
  using ((select public.vp_tem_capacidade('aval-juridico', 'excluir')));

-- SECURITY INVOKER de propósito: current_user = 'authenticated' só vale para chamadas diretas via PostgREST.
create or replace function public.fn_avais_juridicos_guarda() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if public.vp_tem_capacidade('aval-juridico', 'editar') then return new; end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pendente'
       or new.aval is not null
       or new.herdado_de_proposta_id is not null
       or new.motivo_reabertura is not null then
      raise exception 'Sem alçada para criar Aval Jurídico já decidido (aval-juridico.editar).'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE por não-editor: apenas vincular contrato_venda_id (NULL -> valor) e atualizado_em
  if new.id is distinct from old.id
     or new.proposta_id is distinct from old.proposta_id
     or new.numero_cotacao is distinct from old.numero_cotacao
     or new.numero_documento is distinct from old.numero_documento
     or new.cliente_nome is distinct from old.cliente_nome
     or new.status is distinct from old.status
     or new.aval is distinct from old.aval
     or new.criado_em is distinct from old.criado_em
     or new.herdado_de_proposta_id is distinct from old.herdado_de_proposta_id
     or new.motivo_reabertura is distinct from old.motivo_reabertura
     or (new.contrato_venda_id is distinct from old.contrato_venda_id and old.contrato_venda_id is not null) then
    raise exception 'Sem alçada para alterar Aval Jurídico (aval-juridico.editar).'
      using errcode = '42501';
  end if;
  return new;
end $$;

create or replace trigger trg_avais_juridicos_guarda
  before insert or update on public.avais_juridicos
  for each row execute function public.fn_avais_juridicos_guarda();
