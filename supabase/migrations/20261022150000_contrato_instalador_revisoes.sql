-- Contrato Instalador — edição de contrato com NOVA REVISÃO (pedido do Jurídico, Task 11, 22/10/2026).
-- Regra: documento enviado/assinado NUNCA é sobrescrito. Editar um contrato fora do rascunho guarda a revisão anterior
-- (documento, dados, assinatura/hash, link) em `revisoes`, volta o contrato a rascunho com link novo, cancela a fila de
-- assinaturas e as parcelas pendentes, e reabre o aval do Diego (novo SIM). Rascunho continua editável no próprio lugar.

alter table public.contratos_instalador add column if not exists revisao integer not null default 1;
alter table public.contratos_instalador add column if not exists revisoes jsonb not null default '[]'::jsonb;

create or replace function public.ci_salvar_edicao(p_id uuid, p_form_state jsonb, p_doc jsonb, p_cols jsonb,
                                                   p_motivo text default null, p_esperado timestamptz default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  c contratos_instalador%rowtype; n int; v_now timestamptz := now(); v_nome text := coalesce(nullif(trim(p_cols->>'nome'), ''), public.vp_email());
  v_dos text[]; v_rev int; v_snap jsonb; v_parc int := 0; v_aval jsonb := '[]'::jsonb; d record;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'sem_sessao'); end if;
  if not public.vp_tem_capacidade('contrato-instalador', 'editar') then return jsonb_build_object('ok', false, 'erro', 'sem_permissao'); end if;
  select * into c from contratos_instalador where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_encontrado'); end if;
  -- controle de concorrência: alguém alterou o contrato depois que esta pessoa abriu a edição
  if p_esperado is not null and c.atualizado_em is distinct from p_esperado then return jsonb_build_object('ok', false, 'erro', 'conflito'); end if;
  v_dos := coalesce(array(select jsonb_array_elements_text(coalesce(p_cols->'dossier_ids', '[]'::jsonb))), '{}'::text[]);

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
    return jsonb_build_object('ok', true, 'nova_revisao', false, 'revisao', c.revisao);
  end if;

  -- a partir daqui o documento já saiu: NOVA REVISÃO (nada é sobrescrito)
  if length(trim(coalesce(p_motivo, ''))) < 10 then return jsonb_build_object('ok', false, 'erro', 'motivo_curto'); end if;
  select count(*) into n from contrato_instalador_parcelas where contrato_id = p_id and status <> 'pendente';
  if n > 0 then return jsonb_build_object('ok', false, 'erro', 'parcela_paga'); end if;
  select count(*) into n from instalador_recibos where contrato_id = p_id and status <> 'cancelado';
  if n > 0 then return jsonb_build_object('ok', false, 'erro', 'recibo_ativo'); end if;

  v_rev := c.revisao + 1;
  v_snap := jsonb_build_object('revisao', c.revisao, 'status', c.status, 'doc', c.doc, 'form_state', c.form_state, 'audit', c.audit,
    'hash', c.audit->>'hash', 'token', c.token, 'sent_at', c.sent_at, 'signed_at', c.signed_at, 'criada_em', c.criado_em,
    'substituida_em', v_now, 'substituida_por', v_nome, 'motivo', trim(p_motivo), 'log', c.log);

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

  -- fila de assinaturas (Diego/Juliana/Maurício) da revisão antiga: cancelada; as assinaturas dadas ficam no audit de cada linha
  update documento_signatarios set status = 'expirado', atualizado_em = v_now,
         audit = coalesce(audit, '{}'::jsonb) || jsonb_build_object('cancelada_por_nova_revisao_em', v_now, 'revisao', c.revisao)
   where documento_tipo = 'contrato_instalador' and documento_id = p_id::text and status <> 'expirado';
  delete from contrato_instalador_parcelas where contrato_id = p_id and status = 'pendente';
  get diagnostics v_parc = row_count;
  update instalador_acordos set status = 'combinado', contrato_id = null, atualizado_em = v_now where contrato_id = p_id and status = 'contratado';
  update eventos_outbox set status = 'falha', ultimo_erro = 'contrato com nova revisao' where status = 'pendente' and entidade->>'id' = p_id::text;

  -- NOVO aval do Diego: toda decisão que deixaria esta revisão sair sozinha volta a pendente (o pedido ao Diego sai quando
  -- alguém clicar em "Pedir aval e enviar" — `reenvioPendente` avisa a tela para reenviar a pergunta).
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

  return jsonb_build_object('ok', true, 'nova_revisao', true, 'revisao', v_rev, 'parcelas_removidas', v_parc, 'decisoes_reabertas', v_aval);
end $function$;
revoke all on function public.ci_salvar_edicao(uuid, jsonb, jsonb, jsonb, text, timestamptz) from public, anon;
grant execute on function public.ci_salvar_edicao(uuid, jsonb, jsonb, jsonb, text, timestamptz) to authenticated;

-- o reenvio do aval passa a limpar o aviso `reenvioPendente` (decisão pendente de uma nova revisão também pode ser reenviada)
create or replace function public.decisao_aval_reenviar(p_decisao_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare d decisoes_gerenciais%rowtype; agora timestamptz := now(); reab jsonb;
begin
  if not vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'sem_sessao'); end if;
  select * into d from decisoes_gerenciais where id = p_decisao_id and tipo = 'contratacao_mao_obra_ceo';
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_encontrada'); end if;
  if d.status = 'aprovada' then return jsonb_build_object('ok', false, 'erro', 'ja_aprovada'); end if;
  if d.status in ('reprovada', 'cancelada') then
    reab := coalesce(d.contexto->'reaberturas', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'em', agora, 'por', vp_email(), 'statusAnterior', d.status, 'decididoPor', d.decidido_por, 'motivoAnterior', d.motivo, 'via', 'reenvio_whatsapp'));
    update decisoes_gerenciais set status = 'pendente', decidido_por = null, decidido_em = null, motivo = null, atualizado_em = agora,
           contexto = (coalesce(contexto, '{}'::jsonb) - 'reenvioPendente') || jsonb_build_object('reaberturas', reab)
     where id = d.id returning * into d;
  elsif d.status <> 'pendente' then
    return jsonb_build_object('ok', false, 'erro', 'status_' || d.status);
  else
    update decisoes_gerenciais set contexto = coalesce(contexto, '{}'::jsonb) - 'reenvioPendente', atualizado_em = agora where id = d.id returning * into d;
  end if;
  perform _aval_enfileirar_pendente(d, 'instalador.aval_pendente:' || d.id || ':reenvio:' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
  begin
    insert into vp_logs (modulo, acao, alvo, alvo_id, detalhe)
    values ('Central de Decisões', 'Reenviou o pedido de aval do CEO por WhatsApp', coalesce(_aval_info(d)->>'contrato', d.id::text), d.id::text, jsonb_build_object('reaberta', d.status = 'pendente'));
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'status', d.status);
end $function$;
