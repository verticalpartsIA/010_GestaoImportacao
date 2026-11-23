-- R3 (PR-C): fecha escrita anônima e protege transições/campos de assinatura em `propostas`.
-- NÃO altera RPCs public_proposta_* (SECURITY DEFINER, current_user <> 'authenticated').
-- Preserva `vp_valores_dono` (SELECT) e `vp_valores_guarda` / `trg_propostas_guarda_exclusao`.
--
-- Rollback:
--   drop trigger if exists trg_propostas_guarda on public.propostas;
--   drop function if exists public.fn_propostas_guarda();
--   select public.vp_reabrir_tabela('propostas');
--   create policy propostas_all_authenticated on public.propostas for all to authenticated using (true) with check (true);
--   grant truncate, references, trigger on public.propostas to anon, authenticated;

drop policy if exists propostas_all_authenticated on public.propostas;
select public.vp_fechar_tabela('propostas', 'interno', 'R3');
revoke truncate, references, trigger on public.propostas from authenticated;
revoke all on public.propostas from anon;

drop policy if exists vp_int_del on public.propostas;
create policy vp_int_del on public.propostas
  for delete to authenticated
  using (public.vp_eh_admin() or public.vp_tem_capacidade('propostas', 'excluir'));

create or replace function public.fn_propostas_guarda()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- RPCs SECURITY DEFINER (public_proposta_*, proposta_aplicar_vigencia) e service_role não passam como 'authenticated'.
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'rascunho' then
      raise exception 'Proposta nova deve nascer em rascunho.' using errcode = '42501';
    end if;
    if coalesce(new.audit, '{}'::jsonb) <> '{}'::jsonb
       or new.signed_at is not null
       or new.aprovada_em is not null
       or (coalesce(new.data_json, '{}'::jsonb) ? 'escolhaEntrega')
       or (coalesce(new.data_json, '{}'::jsonb) #> '{elevador,valores,escolhaEntrega}') is not null then
      raise exception 'Campos de assinatura/auditoria só podem ser gravados pelas RPCs públicas.' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'aprovada' and new.status is distinct from old.status then
      raise exception 'Proposta já aprovada não pode ter o status alterado.' using errcode = '42501';
    end if;

    if new.status is distinct from old.status
       and new.status in ('visualizada', 'aprovada', 'recusada', 'revisao_solicitada', 'expirada') then
      raise exception 'Transição de status de resposta do cliente (%) só é permitida pelas RPCs públicas.', new.status using errcode = '42501';
    end if;

    if new.audit is distinct from old.audit
       or new.signed_at is distinct from old.signed_at
       or new.aprovada_em is distinct from old.aprovada_em then
      raise exception 'Campos de auditoria e assinatura (audit, signed_at, aprovada_em) são protegidos.' using errcode = '42501';
    end if;

    if old.token is not null and new.token is distinct from old.token then
      raise exception 'Token público já emitido não pode ser alterado.' using errcode = '42501';
    end if;

    if (new.data_json->'escolhaEntrega') is distinct from (old.data_json->'escolhaEntrega')
       or (new.data_json #> '{elevador,valores,escolhaEntrega}') is distinct from (old.data_json #> '{elevador,valores,escolhaEntrega}') then
      raise exception 'escolhaEntrega só pode ser gravado pela RPC de assinatura.' using errcode = '42501';
    end if;

    return new;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_propostas_guarda on public.propostas;
create trigger trg_propostas_guarda
  before insert or update on public.propostas
  for each row
  execute function public.fn_propostas_guarda();

comment on function public.fn_propostas_guarda() is
  'R3 (PR-C): impede que authenticated forje status/campos de assinatura/auditoria ou troque token já emitido; RPCs SECURITY DEFINER seguem livres.';
