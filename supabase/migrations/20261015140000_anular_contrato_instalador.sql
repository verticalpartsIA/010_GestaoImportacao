-- Anular assinatura do Contrato Instalador (15/10/2026): tudo no servidor, numa transação.
-- Antes o botão atualizava só o contrato pelo navegador; parcelas e aviso de WhatsApp (eventos_outbox, sem política
-- para usuários) não eram limpos para quem não é Administrador. Agora uma função SECURITY DEFINER faz o conjunto.
create or replace function public.anular_contrato_instalador(p_id uuid, p_motivo text, p_nome text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype; n int; v_nome text; v_now timestamptz := now(); v_parc int := 0;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'sem_sessao'); end if;
  if not public.vp_tem_capacidade('contrato-instalador', 'editar') then return jsonb_build_object('ok', false, 'erro', 'sem_permissao'); end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then return jsonb_build_object('ok', false, 'erro', 'motivo_curto'); end if;
  select * into c from contratos_instalador where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_encontrado'); end if;
  if c.status = 'rascunho' then return jsonb_build_object('ok', false, 'erro', 'rascunho'); end if;
  if c.status = 'expirado' and c.audit ? 'anulacao' then return jsonb_build_object('ok', false, 'erro', 'ja_anulado'); end if;
  select count(*) into n from contrato_instalador_parcelas where contrato_id = p_id and status <> 'pendente';
  if n > 0 then return jsonb_build_object('ok', false, 'erro', 'parcela_paga'); end if;
  select count(*) into n from instalador_recibos where contrato_id = p_id and status <> 'cancelado';
  if n > 0 then return jsonb_build_object('ok', false, 'erro', 'recibo_ativo'); end if;
  v_nome := coalesce(nullif(trim(p_nome), ''), public.vp_email());
  update contratos_instalador set status = 'expirado', signed_at = null, expires_at = v_now,
    audit = jsonb_build_object('anulacao', jsonb_build_object('em', v_now, 'por', v_nome, 'email', public.vp_email(), 'motivo', trim(p_motivo),
            'statusAnterior', c.status, 'assinaturaAnterior', coalesce(c.audit, '{}'::jsonb), 'assinadoEmAnterior', c.signed_at)),
    log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'expirado', 'at', v_now,
            'meta', jsonb_build_object('anulado', true, 'nome', v_nome, 'motivo', trim(p_motivo), 'de', c.status))),
    atualizado_em = v_now
  where id = p_id;
  delete from contrato_instalador_parcelas where contrato_id = p_id and status = 'pendente';
  get diagnostics v_parc = row_count;
  update instalador_acordos set status = 'combinado', contrato_id = null, atualizado_em = v_now where contrato_id = p_id and status = 'contratado';
  update eventos_outbox set status = 'falha', ultimo_erro = 'contrato anulado' where status = 'pendente' and entidade->>'id' = p_id::text;
  return jsonb_build_object('ok', true, 'parcelas_removidas', v_parc);
end $$;
revoke execute on function public.anular_contrato_instalador(uuid, text, text) from public, anon;
grant execute on function public.anular_contrato_instalador(uuid, text, text) to authenticated, service_role;
notify pgrst, 'reload schema';
