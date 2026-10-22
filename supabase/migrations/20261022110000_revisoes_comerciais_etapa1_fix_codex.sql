-- Correções dos 3 achados do Codex no PR #1054 (Revisões comerciais, Etapa 1, VP-SPEC-990-REV-001).
-- A migration 20261022100000 já foi aplicada em produção; este patch sobrescreve só as funções/trigger
-- afetadas (CREATE OR REPLACE), sem tocar em tabelas, colunas, índices nem dados existentes.
--
-- 1 (P1) — Autorização nula não rejeitava: `b.vendedor_id = (vp_perfil()).id` com vendedor_id NULL
--   avaliava NULL, e `IF NOT (false OR false OR NULL)` não é verdadeiro -> plpgsql trata como falso e
--   NÃO entra no ramo de rejeição, liberando a ação sem a alçada exigida. Corrigido com
--   coalesce(..., false) nas 4 ocorrências (proposta_criar_revisao, proposta_registrar_solicitacao,
--   proposta_decidir_solicitacao, proposta_alinhar).
-- 2 (P2) — Assinar o contrato da PRÓPRIA revisão nunca recalculava a vigência: o trigger só observava
--   mudanças em `propostas` (status/reativada_em), nunca em `contratos_venda_equipamentos`. Nova função/
--   trigger `trg_contratos_venda_vigencia` chama `proposta_aplicar_vigencia` quando `signed_at`/`status`
--   do contrato mudam.
-- 3 (P2) — A precedência de reativação escolhia a proposta só pelo `reativada_em` mais recente, sem
--   checar se o status dela ainda é elegível: uma proposta reativada e depois RECUSADA de novo
--   continuava "vigente". Corrigido excluindo status terminais (recusada/cancelada/expirada) da query.

create or replace function public.proposta_aplicar_vigencia(p_numero int, p_tipo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tipo     text := public.proposta_tipo_norm(p_tipo);
  v_alvo     uuid;
  v_contrato uuid;
  v_antigo   uuid;
  v_alvo_apr timestamptz;
  v_alvo_st  text;
  v_alvo_idx int;
begin
  if p_numero is null then return; end if;
  perform pg_advisory_xact_lock(hashtext('proposta_familia:' || p_numero || ':' || v_tipo));

  select id into v_antigo from public.propostas
   where numero_cotacao = p_numero and public.proposta_tipo_norm(proposal_type) = v_tipo and vigencia = 'vigente' limit 1;

  -- 1) revisão que originou Contrato de Venda assinado
  select p.id into v_contrato
    from public.propostas p join public.contratos_venda_equipamentos c on c.proposta_id = p.id
   where p.numero_cotacao = p_numero and public.proposta_tipo_norm(p.proposal_type) = v_tipo
     and c.signed_at is not null and coalesce(c.status, '') <> 'em_preenchimento'
   order by c.signed_at desc limit 1;
  v_alvo := v_contrato;

  -- 2) reativação mais recente que qualquer outro evento comercial (nunca uma revisão já terminal)
  if v_alvo is null then
    select r.id into v_alvo from public.propostas r
     where r.numero_cotacao = p_numero and public.proposta_tipo_norm(r.proposal_type) = v_tipo
       and r.reativada_em is not null
       and r.status not in ('recusada', 'cancelada', 'expirada')
       and r.reativada_em >= coalesce((
             select max(greatest(coalesce(o.aprovada_em, '-infinity'), coalesce(o.sent_at, '-infinity')))
               from public.propostas o
              where o.numero_cotacao = p_numero and public.proposta_tipo_norm(o.proposal_type) = v_tipo and o.id <> r.id
           ), '-infinity')
     order by r.reativada_em desc limit 1;
  end if;

  -- 3) última aprovada pelo cliente
  if v_alvo is null then
    select id into v_alvo from public.propostas
     where numero_cotacao = p_numero and public.proposta_tipo_norm(proposal_type) = v_tipo and status = 'aprovada'
     order by aprovada_em desc nulls last, revisao_indice desc limit 1;
  end if;

  -- 4) última enviada (ainda em decisão do cliente)
  if v_alvo is null then
    select id into v_alvo from public.propostas
     where numero_cotacao = p_numero and public.proposta_tipo_norm(proposal_type) = v_tipo
       and sent_at is not null and status in ('enviada', 'visualizada', 'revisao_solicitada')
     order by revisao_indice desc limit 1;
  end if;

  -- 5) a original
  if v_alvo is null then
    select id into v_alvo from public.propostas
     where numero_cotacao = p_numero and public.proposta_tipo_norm(proposal_type) = v_tipo
     order by revisao_indice limit 1;
  end if;
  if v_alvo is null then return; end if;

  select aprovada_em, status, revisao_indice into v_alvo_apr, v_alvo_st, v_alvo_idx from public.propostas where id = v_alvo;

  -- fase 1: tira a vigência dos demais (antes de dar ao alvo — índice único parcial)
  update public.propostas p set
    vigencia = case
      when p.status = 'rascunho' then 'em_negociacao'
      when p.status = 'aprovada' and v_contrato is not null
           and coalesce(p.aprovada_em, '-infinity') > coalesce(v_alvo_apr, '-infinity') then 'pendente_aditivo'
      when p.status in ('enviada', 'visualizada', 'revisao_solicitada')
           and v_alvo_st = 'aprovada' and p.revisao_indice > v_alvo_idx then 'em_negociacao'
      else 'historica' end,
    substituida_em     = case when p.vigencia = 'vigente' then now() else p.substituida_em end,
    substituida_por_id = case when p.vigencia = 'vigente' then v_alvo else p.substituida_por_id end
  where p.numero_cotacao = p_numero and public.proposta_tipo_norm(p.proposal_type) = v_tipo and p.id <> v_alvo;

  -- fase 2: o alvo
  update public.propostas set vigencia = 'vigente', substituida_em = null, substituida_por_id = null
   where id = v_alvo and vigencia <> 'vigente';

  if v_antigo is distinct from v_alvo then
    perform public._prev_evento(p_numero, v_alvo, 'PROPOSTA_VIGENCIA_ALTERADA',
      jsonb_build_object('anterior', v_antigo, 'nova', v_alvo, 'tipo', v_tipo));
  end if;
end $$;

-- Assinatura do Contrato de Venda também recalcula vigência: uma revisão `pendente_aditivo` (a original já tem
-- contrato assinado) só vira vigente quando o contrato DELA é assinado — e isso só muda `contratos_venda_equipamentos`,
-- nunca `propostas`, então o trigger de vigência nunca via essa mudança (achado real do Codex, PR #1054).
create or replace function public.trg_contratos_venda_vigencia() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.propostas;
begin
  if new.proposta_id is null then return null; end if;
  if tg_op = 'UPDATE' and old.signed_at is not distinct from new.signed_at and old.status is not distinct from new.status then
    return null;
  end if;
  select * into p from public.propostas where id = new.proposta_id;
  if found and p.numero_cotacao is not null then
    perform public.proposta_aplicar_vigencia(p.numero_cotacao, p.proposal_type);
  end if;
  return null;
end $$;
drop trigger if exists trg_contratos_venda_vigencia on public.contratos_venda_equipamentos;
create trigger trg_contratos_venda_vigencia after insert or update of signed_at, status on public.contratos_venda_equipamentos
  for each row execute function public.trg_contratos_venda_vigencia();

revoke execute on function public.trg_contratos_venda_vigencia() from public, anon, authenticated;

-- Criar revisão (novo documento, nunca sobrescreve) — coalesce(..., false) na checagem de dono (achado P1)
create or replace function public.proposta_criar_revisao(
  p_base_id uuid, p_motivo text, p_solicitacoes uuid[] default null, p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b public.propostas; raiz public.propostas; v_tipo text; v_idx int; v_cod text; v_doc text;
  v_novo uuid := gen_random_uuid(); v_token text; v_dj jsonb; v_existe public.propostas;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); end if;
  if coalesce(length(trim(p_motivo)), 0) < 10 then return jsonb_build_object('ok', false, 'erro', 'motivo_curto'); end if;

  if p_idempotency_key is not null then
    select * into v_existe from public.propostas where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('ok', true, 'repetido', true, 'id', v_existe.id,
                                'numero_documento', v_existe.numero_documento, 'revisao_codigo', v_existe.revisao_codigo);
    end if;
  end if;

  select * into b from public.propostas where id = p_base_id;
  if not found then return jsonb_build_object('ok', false, 'erro', 'base_inexistente'); end if;
  if b.numero_cotacao is null then return jsonb_build_object('ok', false, 'erro', 'sem_numero_cotacao'); end if;
  if b.status = 'rascunho' then return jsonb_build_object('ok', false, 'erro', 'base_em_rascunho'); end if;
  if not (public.vp_eh_admin() or public.vp_tem_capacidade('propostas', 'criar_revisao')
          or coalesce(b.vendedor_id = (public.vp_perfil()).id, false)) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;

  v_tipo := public.proposta_tipo_norm(b.proposal_type);
  perform pg_advisory_xact_lock(hashtext('proposta_familia:' || b.numero_cotacao || ':' || v_tipo));

  -- retry que esperou o lock: a chave pode ter sido usada enquanto aguardava
  if p_idempotency_key is not null then
    select * into v_existe from public.propostas where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('ok', true, 'repetido', true, 'id', v_existe.id,
                                'numero_documento', v_existe.numero_documento, 'revisao_codigo', v_existe.revisao_codigo);
    end if;
  end if;

  select * into raiz from public.propostas where id = coalesce(b.proposta_raiz_id, b.id);
  select coalesce(max(revisao_indice), 0) + 1 into v_idx from public.propostas
   where numero_cotacao = b.numero_cotacao and public.proposta_tipo_norm(proposal_type) = v_tipo;
  select public.proposta_proxima_letra((
    select revisao_codigo from public.propostas
     where numero_cotacao = b.numero_cotacao and public.proposta_tipo_norm(proposal_type) = v_tipo
     order by revisao_indice desc limit 1)) into v_cod;
  v_doc := raiz.numero_documento || '-' || v_cod;
  v_token := left(replace(gen_random_uuid()::text, '-', ''), 16);

  v_dj := coalesce(b.versao_publicada, b.data_json, '{}'::jsonb);
  if v_dj ? 'numero' then v_dj := jsonb_set(v_dj, '{numero}', to_jsonb(v_doc)); end if;

  insert into public.propostas (
    id, numero_documento, cliente_id, vendedor_id, titulo, status, validade_dias, condicao_pagamento, prazo_entrega,
    observacoes, desconto_geral, valor_total, proposal_type, data_json, version, master_id, precificacao_id, token,
    recipient, audit, log, numero_cotacao, revisao_indice, revisao_codigo, proposta_raiz_id, proposta_base_id,
    revisao_motivo, vigencia, criada_por, idempotency_key, snapshot_origens, criado_em, atualizado_em
  ) values (
    v_novo, v_doc, b.cliente_id, b.vendedor_id, b.titulo, 'rascunho', b.validade_dias, b.condicao_pagamento, b.prazo_entrega,
    b.observacoes, b.desconto_geral, b.valor_total, b.proposal_type, v_dj, 1, b.master_id, b.precificacao_id, v_token,
    b.recipient, '{}'::jsonb,
    jsonb_build_array(jsonb_build_object('status', 'revisao_criada', 'at', now(),
      'meta', jsonb_build_object('base', b.numero_documento, 'motivo', trim(p_motivo)))),
    b.numero_cotacao, v_idx, v_cod, raiz.id, b.id, trim(p_motivo), 'em_negociacao',
    nullif(public.vp_email(), ''), p_idempotency_key,
    jsonb_build_object('base_id', b.id, 'base_numero_documento', b.numero_documento, 'base_version', b.version,
                       'precificacao_id', b.precificacao_id, 'hash_base', md5(coalesce(v_dj::text, ''))),
    now(), now()
  );

  if p_solicitacoes is not null and array_length(p_solicitacoes, 1) > 0 then
    update public.proposta_solicitacoes_revisao s set proposta_resultante_id = v_novo
     where s.id = any(p_solicitacoes) and s.numero_cotacao = b.numero_cotacao;
  end if;

  perform public._prev_evento(b.numero_cotacao, v_novo, 'PROPOSTA_REVISAO_CRIADA',
    jsonb_build_object('base', b.id, 'codigo', v_cod, 'motivo', trim(p_motivo), 'solicitacoes', coalesce(to_jsonb(p_solicitacoes), '[]'::jsonb)),
    p_idempotency_key);

  return jsonb_build_object('ok', true, 'id', v_novo, 'numero_documento', v_doc, 'revisao_codigo', v_cod,
                            'revisao_indice', v_idx, 'token', v_token);
end $$;

-- Pedido de revisão registrado à mão (e-mail, WhatsApp, reunião). Nunca simula visualização do cliente.
create or replace function public.proposta_registrar_solicitacao(
  p_proposta_id uuid, p_trilha text, p_origem text, p_nome text, p_papel text, p_contato text, p_texto text,
  p_anexos jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.propostas; v_id uuid;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); end if;
  if p_origem not in ('email', 'whatsapp', 'reuniao', 'manual') then return jsonb_build_object('ok', false, 'erro', 'origem_invalida'); end if;
  if p_trilha not in ('comercial', 'financeira', 'tecnica', 'juridica', 'outra') then return jsonb_build_object('ok', false, 'erro', 'trilha_invalida'); end if;
  if coalesce(length(trim(p_texto)), 0) < 5 then return jsonb_build_object('ok', false, 'erro', 'texto_curto'); end if;
  select * into p from public.propostas where id = p_proposta_id;
  if not found then return jsonb_build_object('ok', false, 'erro', 'inexistente'); end if;
  if not (public.vp_eh_admin() or public.vp_tem_capacidade('propostas', 'criar_revisao') or coalesce(p.vendedor_id = (public.vp_perfil()).id, false)) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  insert into public.proposta_solicitacoes_revisao
    (proposta_id, numero_cotacao, trilha, origem, solicitante_nome, solicitante_papel, solicitante_contato, texto, anexos, versao_vista, registrada_por)
  values (p.id, p.numero_cotacao, p_trilha, p_origem, nullif(trim(p_nome), ''), nullif(trim(p_papel), ''), nullif(trim(p_contato), ''),
          trim(p_texto), coalesce(p_anexos, '[]'::jsonb), p.version, nullif(public.vp_email(), ''))
  returning id into v_id;
  if p_trilha <> 'outra' then
    insert into public.proposta_alinhamentos (proposta_id, trilha, estado, por_nome, por_papel, por_contato, origem, solicitacao_id)
    values (p.id, p_trilha, 'pediu_revisao', nullif(trim(p_nome), ''), nullif(trim(p_papel), ''), nullif(trim(p_contato), ''), p_origem, v_id)
    on conflict (proposta_id, trilha) do update set estado = 'pediu_revisao', solicitacao_id = excluded.solicitacao_id, em = now(),
      por_nome = excluded.por_nome, por_papel = excluded.por_papel, por_contato = excluded.por_contato, origem = excluded.origem;
  end if;
  perform public._prev_evento(p.numero_cotacao, p.id, 'PROPOSTA_REVISAO_SOLICITADA',
    jsonb_build_object('solicitacao', v_id, 'trilha', p_trilha, 'origem', p_origem));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.proposta_decidir_solicitacao(p_id uuid, p_decisao text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.proposta_solicitacoes_revisao; p public.propostas;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); end if;
  if p_decisao not in ('em_analise', 'precisa_informacao', 'aceita', 'recusada') then return jsonb_build_object('ok', false, 'erro', 'decisao_invalida'); end if;
  if p_decisao in ('recusada', 'precisa_informacao') and coalesce(length(trim(p_motivo)), 0) < 5 then
    return jsonb_build_object('ok', false, 'erro', 'motivo_obrigatorio');
  end if;
  select * into s from public.proposta_solicitacoes_revisao where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'inexistente'); end if;
  select * into p from public.propostas where id = s.proposta_id;
  if not (public.vp_eh_admin() or public.vp_tem_capacidade('propostas', 'criar_revisao') or coalesce(p.vendedor_id = (public.vp_perfil()).id, false)) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  update public.proposta_solicitacoes_revisao set status = p_decisao, decidida_em = now(),
         decidida_por = nullif(public.vp_email(), ''), motivo_decisao = nullif(trim(p_motivo), '') where id = p_id;
  perform public._prev_evento(s.numero_cotacao, s.proposta_id, 'PROPOSTA_REVISAO_DECIDIDA',
    jsonb_build_object('solicitacao', p_id, 'decisao', p_decisao));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.proposta_alinhar(
  p_proposta_id uuid, p_trilha text, p_estado text, p_nome text, p_papel text, p_contato text, p_origem text, p_prova jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.propostas;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); end if;
  if p_trilha not in ('comercial', 'financeira', 'tecnica', 'juridica') then return jsonb_build_object('ok', false, 'erro', 'trilha_invalida'); end if;
  if p_estado not in ('pendente', 'de_acordo', 'sem_resposta') then return jsonb_build_object('ok', false, 'erro', 'estado_invalido'); end if;
  if p_origem not in ('email', 'whatsapp', 'reuniao', 'manual') then return jsonb_build_object('ok', false, 'erro', 'origem_invalida'); end if;
  select * into p from public.propostas where id = p_proposta_id;
  if not found then return jsonb_build_object('ok', false, 'erro', 'inexistente'); end if;
  if not (public.vp_eh_admin() or public.vp_tem_capacidade('propostas', 'criar_revisao') or coalesce(p.vendedor_id = (public.vp_perfil()).id, false)) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  insert into public.proposta_alinhamentos (proposta_id, trilha, estado, por_nome, por_papel, por_contato, origem, prova)
  values (p.id, p_trilha, p_estado, nullif(trim(p_nome), ''), nullif(trim(p_papel), ''), nullif(trim(p_contato), ''), p_origem, p_prova)
  on conflict (proposta_id, trilha) do update set estado = excluded.estado, por_nome = excluded.por_nome, por_papel = excluded.por_papel,
    por_contato = excluded.por_contato, origem = excluded.origem, prova = excluded.prova, em = now(), solicitacao_id = null;
  perform public._prev_evento(p.numero_cotacao, p.id, 'PROPOSTA_ALINHAMENTO', jsonb_build_object('trilha', p_trilha, 'estado', p_estado));
  return jsonb_build_object('ok', true);
end $$;

notify pgrst, 'reload schema';
