-- R3 (Segurança real #571) · Tabela 3/4 do PR-A: avais_financeiros
-- Fecha escrita/leitura anônima (preservando vp_valores_leitura e trigger vp_valores_guarda),
-- corrige vp_int_del ('aval-financeiro') e adiciona trigger SECURITY INVOKER (BEFORE INSERT OR UPDATE)
-- com whitelist de colunas e permissão de CEO sem e-mail fixo (decisoes.ceo ou decisão aprovada).
-- Rollback:
--   drop trigger if exists trg_avais_financeiros_guarda on public.avais_financeiros;
--   drop function if exists public.fn_avais_financeiros_guarda();
--   select public.vp_reabrir_tabela('avais_financeiros');
--   grant truncate, references, trigger on public.avais_financeiros to anon, authenticated;

select public.vp_fechar_tabela('avais_financeiros', 'interno', 'R3');

revoke truncate, references, trigger on public.avais_financeiros from authenticated;

drop policy if exists vp_int_del on public.avais_financeiros;
create policy vp_int_del on public.avais_financeiros
  for delete to authenticated
  using ((select public.vp_tem_capacidade('aval-financeiro', 'excluir')));

-- SECURITY INVOKER de propósito: current_user = 'authenticated' só vale para chamadas diretas via PostgREST.
create or replace function public.fn_avais_financeiros_guarda() returns trigger
language plpgsql set search_path = public as $$
declare
  v_ceo_mudou boolean;
  v_ceo_permitido boolean;
begin
  if current_user <> 'authenticated' then return new; end if;
  if public.vp_tem_capacidade('aval-financeiro', 'editar') then return new; end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pendente_consulta'
       or coalesce(new.sinal_pago, false)
       or coalesce(new.aval_pagamento_confirmado, false)
       or new.aval is not null
       or new.consulta is not null
       or new.sinal is not null
       or new.aval_pagamento is not null
       or new.aprovacao_ceo_em is not null
       or new.aprovacao_ceo_por is not null
       or new.aprovacao_owner_em is not null
       or new.aprovacao_owner_por is not null
       or new.custo_teto is not null
       or new.margem_aceita is not null
       or new.herdado_de_proposta_id is not null
       or new.motivo_reabertura is not null then
      raise exception 'Sem alçada para criar Aval Financeiro já decidido (aval-financeiro.editar).'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Campos imutáveis para não-editor (D3: contrato_venda_id é livre pois vincularContrato pode substituir vínculo de contrato anulado)
  if new.id is distinct from old.id
     or new.proposta_id is distinct from old.proposta_id
     or new.numero_cotacao is distinct from old.numero_cotacao
     or new.numero_documento is distinct from old.numero_documento
     or new.cliente_nome is distinct from old.cliente_nome
     or new.valor_total is distinct from old.valor_total
     or new.status is distinct from old.status
     or new.aval is distinct from old.aval
     or new.consulta is distinct from old.consulta
     or new.sinal_pago is distinct from old.sinal_pago
     or new.sinal is distinct from old.sinal
     or new.aval_pagamento_confirmado is distinct from old.aval_pagamento_confirmado
     or new.aval_pagamento is distinct from old.aval_pagamento
     or new.aprovacao_owner_em is distinct from old.aprovacao_owner_em
     or new.aprovacao_owner_por is distinct from old.aprovacao_owner_por
     or new.criado_em is distinct from old.criado_em
     or new.herdado_de_proposta_id is distinct from old.herdado_de_proposta_id
     or new.motivo_reabertura is distinct from old.motivo_reabertura then
    raise exception 'Sem alçada para alterar Aval Financeiro (aval-financeiro.editar).'
      using errcode = '42501';
  end if;

  -- Aprovação do CEO (registrarAprovacaoCeo): exige decisoes.ceo ou decisão compra_equipamento_ceo já aprovada.
  -- (O bypass de Admin em vp_tem_capacidade é inofensivo aqui pois Admin já passa em aval-financeiro.editar no topo.)
  v_ceo_mudou := (new.aprovacao_ceo_em is distinct from old.aprovacao_ceo_em
                  or new.aprovacao_ceo_por is distinct from old.aprovacao_ceo_por
                  or new.custo_teto is distinct from old.custo_teto
                  or new.margem_aceita is distinct from old.margem_aceita);
  if v_ceo_mudou then
    v_ceo_permitido := public.vp_tem_capacidade('decisoes', 'ceo')
      or exists (
        select 1 from public.decisoes_gerenciais d
         where d.tipo = 'compra_equipamento_ceo'
           and d.numero_cotacao = old.numero_cotacao
           and d.status = 'aprovada'
      );
    if not v_ceo_permitido then
      raise exception 'Sem alçada para registrar aprovação do CEO no Aval Financeiro.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end $$;

create or replace trigger trg_avais_financeiros_guarda
  before insert or update on public.avais_financeiros
  for each row execute function public.fn_avais_financeiros_guarda();
