-- Ajustes da revisão do Codex no PR #1042 (Task 11):
--  1) a revisão guardada passa a levar também a FILA de assinaturas (Diego/Juliana/Maurício) da época — a evidência das assinaturas
--     internas não se perde quando a fila é cancelada pela nova revisão;
--  2) editar um RASCUNHO também refaz as parcelas pendentes e solta o acordo de preço (o cliente recria/religa depois), para o
--     Financeiro não pagar os valores antigos; protegido por parcela paga/recibo ativo.
create or replace function public.ci_salvar_edicao(p_id uuid, p_form_state jsonb, p_doc jsonb, p_cols jsonb,
                                                   p_motivo text default null, p_esperado timestamptz default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  c contratos_instalador%rowtype; n int; v_now timestamptz := now(); v_nome text := coalesce(nullif(trim(p_cols->>'nome'), ''), public.vp_email());
  v_dos text[]; v_rev int; v_snap jsonb; v_parc int := 0; v_aval jsonb := '[]'::jsonb; v_fila jsonb; d record;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'sem_sessao'); end if;
  if not public.vp_tem_capacidade('contrato-instalador', 'editar') then return jsonb_build_object('ok', false, 'erro', 'sem_permissao'); end if;
  select * into c from contratos_instalador where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_encontrado'); end if;
  if p_esperado is not null and c.atualizado_em is distinct from p_esperado then return jsonb_build_object('ok', false, 'erro', 'conflito'); end if;
  v_dos := coalesce(array(select jsonb_array_elements_text(coalesce(p_cols->'dossier_ids', '[]'::jsonb))), '{}'::text[]);

  select count(*) into n from contrato_instalador_parcelas where contrato_id = p_id and status <> 'pendente';
  if n > 0 then return jsonb_build_object('ok', false, 'erro', 'parcela_paga'); end if;
  select count(*) into n from instalador_recibos where contrato_id = p_id and status <> 'cancelado';
  if n > 0 then return jsonb_build_object('ok', false, 'erro', 'recibo_ativo'); end if;

  if c.status = 'rascunho' then
    update contratos_instalador set
      form_state = p_form_state, doc = p_doc,
      titulo = coalesce(p_cols->>'titulo', titulo), contratada_nome = coalesce(p_cols->>'contratada_nome', contratada_nome),
      contratada_cnpj = coalesce(p_cols->>'contratada_cnpj', contratada_cnpj), responsavel_nome = coalesce(p_cols->>'responsavel_nome', responsavel_nome),
      responsavel_cpf = coalesce(p_cols->>'responsavel_cpf', responsavel_cpf),
      valor_total = coalesce(nullif(p_cols->>'valor_total', '')::numeric, valor_total), objeto_resumo = coalesce(p_cols->>'objeto_resumo', objeto_resumo),
      master_id = nullif(p_cols->>'master_id', ''), proposta_id = nullif(p_cols->>'proposta_id', '')::uuid,
      ativos_indices = coalesce(p_cols->'ativos_indices', '[]'::jsonb), dossier_ids = v_dos,
      log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'rascunho', 'at', v_now, 'meta', jsonb_build_object('editado', true, 'nome', v_nome))),
      atualizado_em = v_now
    where id = p_id;
    delete from contrato_instalador_parcelas where contrato_id = p_id and status = 'pendente';
    get diagnostics v_parc = row_count;
    update instalador_acordos set status = 'combinado', contrato_id = null, atualizado_em = v_now where contrato_id = p_id and status = 'contratado';
    return jsonb_build_object('ok', true, 'nova_revisao', false, 'revisao', c.revisao, 'refazer_parcelas', true, 'parcelas_removidas', v_parc);
  end if;

  if length(trim(coalesce(p_motivo, ''))) < 10 then return jsonb_build_object('ok', false, 'erro', 'motivo_curto'); end if;

  v_rev := c.revisao + 1;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.ordem), '[]'::jsonb) into v_fila
    from documento_signatarios s where s.documento_tipo = 'contrato_instalador' and s.documento_id = p_id::text and s.status <> 'expirado';
  v_snap := jsonb_build_object('revisao', c.revisao, 'status', c.status, 'doc', c.doc, 'form_state', c.form_state, 'audit', c.audit,
    'hash', c.audit->>'hash', 'token', c.token, 'sent_at', c.sent_at, 'signed_at', c.signed_at, 'criada_em', c.criado_em,
    'substituida_em', v_now, 'substituida_por', v_nome, 'motivo', trim(p_motivo), 'log', c.log, 'fila', v_fila);

  update contratos_instalador set
    revisao = v_rev, revisoes = coalesce(revisoes, '[]'::jsonb) || jsonb_build_array(v_snap),
    form_state = p_form_state, doc = p_doc,
    titulo = coalesce(p_cols->>'titulo', titulo), contratada_nome = coalesce(p_cols->>'contratada_nome', contratada_nome),
    contratada_cnpj = coalesce(p_cols->>'contratada_cnpj', contratada_cnpj), responsavel_nome = coalesce(p_cols->>'responsavel_nome', responsavel_nome),
    responsavel_cpf = coalesce(p_cols->>'responsavel_cpf', responsavel_cpf),
    valor_total = coalesce(nullif(p_cols->>'valor_total', '')::numeric, valor_total), objeto_resumo = coalesce(p_cols->>'objeto_resumo', objeto_resumo),
    master_id = nullif(p_cols->>'master_id', ''), proposta_id = nullif(p_cols->>'proposta_id', '')::uuid,
    ativos_indices = coalesce(p_cols->'ativos_indices', '[]'::jsonb), dossier_ids = v_dos,
    status = 'rascunho', token = replace(gen_random_uuid()::text, '-', ''), channel = null,
    sent_at = null, viewed_at = null, signed_at = null, expires_at = null, assinaturas_completas_em = null, audit = '{}'::jsonb,
    log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'rascunho', 'at', v_now,
          'meta', jsonb_build_object('nova_revisao', v_rev, 'nome', v_nome, 'motivo', trim(p_motivo), 'de', c.status))),
    atualizado_em = v_now
  where id = p_id;

  update documento_signatarios set status = 'expirado', atualizado_em = v_now,
         audit = coalesce(audit, '{}'::jsonb) || jsonb_build_object('cancelada_por_nova_revisao_em', v_now, 'revisao', c.revisao)
   where documento_tipo = 'contrato_instalador' and documento_id = p_id::text and status <> 'expirado';
  delete from contrato_instalador_parcelas where contrato_id = p_id and status = 'pendente';
  get diagnostics v_parc = row_count;
  update instalador_acordos set status = 'combinado', contrato_id = null, atualizado_em = v_now where contrato_id = p_id and status = 'contratado';
  update eventos_outbox set status = 'falha', ultimo_erro = 'contrato com nova revisao' where status = 'pendente' and entidade->>'id' = p_id::text;

  for d in select x.id, x.contexto from decisoes_gerenciais x
            where x.tipo = 'contratacao_mao_obra_ceo' and x.status = 'aprovada'
              and (coalesce(x.contexto->>'contratoInstaladorId', case when x.referencia_tabela = 'contratos_instalador' then x.referencia_id end) = p_id::text
                   or (x.numero_cotacao is not null and x.numero_cotacao::text = nullif(p_form_state->>'numeroCotacao', ''))) loop
    update decisoes_gerenciais set status = 'pendente', decidido_por = null, decidido_em = null, motivo = null, atualizado_em = v_now,
           contexto = coalesce(contexto, '{}'::jsonb) || jsonb_build_object('reenvioPendente', true,
             'reaberturas', coalesce(contexto->'reaberturas', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
               'em', v_now, 'por', public.vp_email(), 'statusAnterior', 'aprovada', 'via', 'nova_revisao_contrato', 'revisao', v_rev)))
     where id = d.id;
    v_aval := v_aval || to_jsonb(d.id::text);
  end loop;

  return jsonb_build_object('ok', true, 'nova_revisao', true, 'refazer_parcelas', true, 'revisao', v_rev, 'parcelas_removidas', v_parc, 'decisoes_reabertas', v_aval);
end $function$;
