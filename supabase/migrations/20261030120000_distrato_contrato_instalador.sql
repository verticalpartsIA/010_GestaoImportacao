-- Distrato do Contrato do Instalador (30/10/2026)
-- Rescisão motivada e bilateral de um contrato JÁ ASSINADO. Reaproveita o MESMO desenho
-- de assinatura em sequência do contrato original (Contratada -> Diego/CEO ->
-- Testemunha 1 (Juliana) -> Testemunha 2 (Maurício)) via a mesma tabela genérica
-- documento_signatarios, só com o tipo novo 'distrato_instalador'. A Contratada tem
-- token PRÓPRIO nesta tabela nova (não reaproveita o token do contrato original, que já
-- representa o estado "assinado" dele).
--
-- Regra de negócio confirmada com o usuário: diferente da anulação
-- (anular_contrato_instalador), o Distrato PODE ser gerado com parcela já paga — só
-- cancela as parcelas AINDA NÃO PAGAS quando o distrato se completa (quitação parcial).
-- Transferência de valor pra outro contrato (troca de obra do montador) é só registrada
-- (motivo + valor + contrato de destino) — não move parcela nem mexe em financeiro.

create table public.contratos_instalador_distratos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos_instalador(id),
  numero_documento text not null,
  token text not null unique,
  motivo text not null,
  transferencia jsonb,
  doc jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho'
    check (status = any (array['rascunho','enviado','visualizado','assinado','recusado','expirado'])),
  audit jsonb not null default '{}'::jsonb,
  log jsonb not null default '[]'::jsonb,
  criado_por text,
  criado_em timestamptz not null default now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  expires_at timestamptz,
  signed_at timestamptz,
  assinaturas_completas_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create index idx_contratos_instalador_distratos_contrato on public.contratos_instalador_distratos(contrato_id);

-- Nasce FECHADA (regra do projeto para tabela nova): só authenticated ativo com a
-- alçada do módulo. A página pública fala só pelas RPCs abaixo (SECURITY DEFINER,
-- token-gated), nunca pela tabela direto.
alter table public.contratos_instalador_distratos enable row level security;

create policy cid_select on public.contratos_instalador_distratos for select to authenticated
  using (public.vp_usuario_ativo() and public.vp_tem_capacidade('contrato-instalador', 'ver'));
create policy cid_insert on public.contratos_instalador_distratos for insert to authenticated
  with check (public.vp_usuario_ativo() and public.vp_tem_capacidade('contrato-instalador', 'editar'));
create policy cid_update on public.contratos_instalador_distratos for update to authenticated
  using (public.vp_usuario_ativo() and public.vp_tem_capacidade('contrato-instalador', 'editar'))
  with check (public.vp_usuario_ativo() and public.vp_tem_capacidade('contrato-instalador', 'editar'));

alter table public.contratos_instalador drop constraint contratos_instalador_status_check;
alter table public.contratos_instalador add constraint contratos_instalador_status_check
  check (status = any (array['rascunho','enviado','visualizado','assinado','recusado','expirado','distratado']));

alter table public.documento_signatarios drop constraint documento_signatarios_documento_tipo_check;
alter table public.documento_signatarios add constraint documento_signatarios_documento_tipo_check
  check (documento_tipo = any (array['proposta','contrato_venda','contrato_instalador','projeto_instalacao','distrato_instalador']));

-- ========== Geração/envio (interno, autenticado) ==========

create or replace function public.gerar_distrato_instalador(p_contrato_id uuid, p_motivo text, p_transferencia jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype; n int; v_now timestamptz := now(); v_num text; v_id uuid;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'sem_sessao'); end if;
  if not public.vp_tem_capacidade('contrato-instalador', 'editar') then return jsonb_build_object('ok', false, 'erro', 'sem_permissao'); end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then return jsonb_build_object('ok', false, 'erro', 'motivo_curto'); end if;
  select * into c from contratos_instalador where id = p_contrato_id;
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_encontrado'); end if;
  if c.status <> 'assinado' then return jsonb_build_object('ok', false, 'erro', 'nao_assinado'); end if;
  select count(*) into n from contratos_instalador_distratos where contrato_id = p_contrato_id and status not in ('recusado', 'expirado');
  if n > 0 then return jsonb_build_object('ok', false, 'erro', 'ja_existe'); end if;
  if p_transferencia is not null and nullif(p_transferencia->>'contrato_destino_id', '') is not null then
    if not exists (select 1 from contratos_instalador where id = (p_transferencia->>'contrato_destino_id')::uuid) then
      return jsonb_build_object('ok', false, 'erro', 'contrato_destino_invalido');
    end if;
  end if;
  v_num := c.numero_documento || '-DISTRATO';
  v_id := gen_random_uuid();
  insert into contratos_instalador_distratos (id, contrato_id, numero_documento, token, motivo, transferencia, criado_por, log)
  values (v_id, p_contrato_id, v_num, replace(gen_random_uuid()::text, '-', ''), trim(p_motivo), p_transferencia, public.vp_email(),
          jsonb_build_array(jsonb_build_object('status', 'rascunho', 'at', v_now, 'meta', jsonb_build_object('nome', public.vp_email()))));
  begin
    insert into vp_logs (modulo, acao, alvo, alvo_id, detalhe)
      values ('Contrato Instalador', 'Gerou o Distrato — ' || trim(p_motivo), v_num, p_contrato_id::text, jsonb_build_object('distrato_id', v_id));
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'id', v_id, 'numero_documento', v_num);
end $$;
revoke execute on function public.gerar_distrato_instalador(uuid, text, jsonb) from public, anon;
grant execute on function public.gerar_distrato_instalador(uuid, text, jsonb) to authenticated, service_role;

create or replace function public.ci_distrato_enviar(p_id uuid, p_doc jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d contratos_instalador_distratos%rowtype; c contratos_instalador%rowtype; v_now timestamptz := now();
        v_tel text; v_nome text;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'sem_sessao'); end if;
  if not public.vp_tem_capacidade('contrato-instalador', 'editar') then return jsonb_build_object('ok', false, 'erro', 'sem_permissao'); end if;
  select * into d from contratos_instalador_distratos where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_encontrado'); end if;
  if d.status <> 'rascunho' then return jsonb_build_object('ok', false, 'erro', 'status_' || d.status); end if;
  select * into c from contratos_instalador where id = d.contrato_id;
  update contratos_instalador_distratos set doc = p_doc, status = 'enviado', sent_at = v_now, expires_at = v_now + interval '7 days',
         atualizado_em = v_now,
         log = log || jsonb_build_array(jsonb_build_object('status', 'enviado', 'at', v_now, 'meta', jsonb_build_object('nome', public.vp_email())))
   where id = p_id returning * into d;
  v_tel := regexp_replace(coalesce(c.recipient->>'contact', ''), '\D', '', 'g');
  if length(v_tel) in (10, 11) then v_tel := '55' || v_tel; end if;
  v_nome := coalesce(nullif(trim(c.recipient->>'name'), ''), nullif(trim(c.responsavel_nome), ''), c.contratada_nome, 'Montador');
  if length(v_tel) >= 12 then
    begin
      perform evento_enfileirar('hub.aviso_fluxo', 'hub.aviso:distrato:' || d.id || ':' || d.token,
        'contrato_instalador_distrato', d.id::text, d.numero_documento,
        jsonb_strip_nulls(jsonb_build_object('origem_aviso', 'distrato', 'momento', 'pendente', 'papel', 'Contratado',
          'titulo', 'Distrato para assinatura — ' || d.numero_documento, 'contrato', c.numero_documento,
          'obra', nullif(trim(public._ci_obra(c)), ''), 'instalador', c.contratada_nome, 'motivo', d.motivo,
          'link_assinatura', 'https://hub.vpsistema.com/assinar/' || d.token,
          'destinatarios', jsonb_build_array(jsonb_build_object('nome', v_nome, 'telefone', v_tel, 'externo', true)))),
        jsonb_build_object('nome', v_nome));
    exception when others then null; end;
  end if;
  begin
    insert into vp_logs (modulo, acao, alvo, alvo_id)
      values ('Contrato Instalador', 'Enviou o Distrato para assinatura', d.numero_documento, d.contrato_id::text);
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'rec', to_jsonb(d));
end $$;
revoke execute on function public.ci_distrato_enviar(uuid, jsonb) from public, anon;
grant execute on function public.ci_distrato_enviar(uuid, jsonb) to authenticated, service_role;

create or replace function public.ci_distrato_reenviar_aviso_vez(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d contratos_instalador_distratos%rowtype; s documento_signatarios%rowtype;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'sem_sessao'); end if;
  if not public.vp_tem_capacidade('contrato-instalador', 'editar') then return jsonb_build_object('ok', false, 'erro', 'sem_permissao'); end if;
  select * into d from contratos_instalador_distratos where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_encontrado'); end if;
  select * into s from documento_signatarios where documento_tipo = 'distrato_instalador' and documento_id = p_id::text
     and liberada_em is not null and status in ('enviado', 'visualizado') order by ordem limit 1;
  if not found then return jsonb_build_object('ok', false, 'erro', 'ninguem_na_vez'); end if;
  perform public._di_aviso('pendente', d, s, coalesce(nullif(d.audit->>'signerName', ''), ''),
    'hub.aviso:distrato:' || s.id || ':pendente:r' || floor(extract(epoch from clock_timestamp()))::bigint);
  return jsonb_build_object('ok', true, 'para', s.nome);
end $$;
revoke execute on function public.ci_distrato_reenviar_aviso_vez(uuid) from public, anon;
grant execute on function public.ci_distrato_reenviar_aviso_vez(uuid) to authenticated, service_role;

create or replace function public.listar_distratos_do_contrato(p_contrato_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(d) order by d.criado_em desc), '[]'::jsonb)
    from contratos_instalador_distratos d where d.contrato_id = p_contrato_id;
$$;
revoke execute on function public.listar_distratos_do_contrato(uuid) from public, anon;
grant execute on function public.listar_distratos_do_contrato(uuid) to authenticated, service_role;

-- ========== Avisos (WhatsApp/alerta), sequência da fila e finalização ==========

create or replace function public._di_aviso(p_momento text, d contratos_instalador_distratos, s documento_signatarios, p_antes text, p_chave text, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype; dest jsonb; link text; pl jsonb;
begin
  select * into c from contratos_instalador where id = d.contrato_id;
  if p_momento = 'pendente' then
    dest := jsonb_build_array(jsonb_build_object('nome', s.nome, 'email', s.email));
    link := 'https://hub.vpsistema.com/assinar/' || s.token;
  else
    dest := coalesce((select jsonb_agg(jsonb_build_object('nome', v.nome, 'email', v.email))
                        from (values ('Cleiton Domingos', 'cleiton.domingos@verticalparts.com.br'),
                                     ('Maurício Araujo', 'mauricio.araujo@verticalparts.com.br'),
                                     ('Felipe Barros', 'felipe.barros@verticalparts.com.br')) v(nome, email)), '[]'::jsonb);
  end if;
  pl := jsonb_strip_nulls(jsonb_build_object(
    'origem_aviso', 'distrato', 'momento', p_momento,
    'titulo', case p_momento when 'pendente' then 'Assinatura do Distrato pendente — ' when 'recusada' then 'Assinatura do Distrato recusada — ' else 'Distrato concluído — ' end || d.numero_documento,
    'contrato', c.numero_documento, 'distrato', d.numero_documento, 'instalador', c.contratada_nome,
    'obra', public._ci_obra(c), 'motivo_distrato', d.motivo,
    'papel', s.papel, 'ordem', s.ordem + 1, 'total', 4,
    'assinou_antes', jsonb_build_object('nome', p_antes),
    'destinatarios', dest, 'link_assinatura', link, 'motivo', p_motivo));
  perform evento_enfileirar('hub.aviso_fluxo', p_chave, 'contrato_instalador_distrato', d.id::text, d.numero_documento, pl, jsonb_build_object('nome', p_antes));
end $$;

create or replace function public._di_fila_criar(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d contratos_instalador_distratos%rowtype;
begin
  select * into d from contratos_instalador_distratos where id = p_id;
  if not found or d.status <> 'assinado' then return; end if;
  if exists (select 1 from documento_signatarios where documento_tipo = 'distrato_instalador' and documento_id = p_id::text and status <> 'expirado') then return; end if;
  insert into documento_signatarios (documento_tipo, documento_id, papel, nome, email, ordem, token, status)
  values ('distrato_instalador', p_id::text, 'Contratante — CEO', 'Diego Maeno', 'diego@verticalparts.com.br', 1, replace(gen_random_uuid()::text, '-', ''), 'pendente'),
         ('distrato_instalador', p_id::text, 'Testemunha 1', 'Juliana', 'juliana@verticalparts.com.br', 2, replace(gen_random_uuid()::text, '-', ''), 'pendente'),
         ('distrato_instalador', p_id::text, 'Testemunha 2', 'Maurício', 'mauricio.araujo@verticalparts.com.br', 3, replace(gen_random_uuid()::text, '-', ''), 'pendente');
  perform public._di_liberar_proxima(p_id, coalesce(nullif(d.audit->>'signerName', ''), ''));
end $$;

create or replace function public._di_liberar_proxima(p_id uuid, p_antes text)
returns boolean language plpgsql security definer set search_path = public as $$
declare d contratos_instalador_distratos%rowtype; s documento_signatarios%rowtype;
begin
  select * into d from contratos_instalador_distratos where id = p_id;
  if not found then return false; end if;
  select * into s from documento_signatarios
   where documento_tipo = 'distrato_instalador' and documento_id = p_id::text and status = 'pendente' and liberada_em is null
   order by ordem limit 1;
  if not found then return false; end if;
  if exists (select 1 from documento_signatarios where documento_tipo = 'distrato_instalador' and documento_id = p_id::text
               and ordem < s.ordem and status not in ('assinado', 'expirado')) then return false; end if;
  update documento_signatarios set liberada_em = now(), status = 'enviado', sent_at = now(), atualizado_em = now() where id = s.id returning * into s;
  perform public._di_aviso('pendente', d, s, p_antes, 'hub.aviso:distrato:' || s.id || ':pendente');
  return true;
end $$;

create or replace function public._di_finalizar(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d contratos_instalador_distratos%rowtype; c contratos_instalador%rowtype; v_now timestamptz := now();
        v_parc int := 0; v_destino contratos_instalador%rowtype;
begin
  select * into d from contratos_instalador_distratos where id = p_id;
  if not found then return; end if;
  select * into c from contratos_instalador where id = d.contrato_id for update;
  if not found or c.status = 'distratado' then return; end if;
  update contratos_instalador set status = 'distratado', atualizado_em = v_now,
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'distratado', 'at', v_now,
               'meta', jsonb_build_object('distrato_id', d.id, 'motivo', d.motivo)))
   where id = c.id;
  delete from contrato_instalador_parcelas where contrato_id = c.id and status = 'pendente';
  get diagnostics v_parc = row_count;
  update instalador_acordos set status = 'combinado', contrato_id = null, atualizado_em = v_now where contrato_id = c.id and status = 'contratado';
  if d.transferencia is not null and nullif(d.transferencia->>'contrato_destino_id', '') is not null then
    select * into v_destino from contratos_instalador where id = (d.transferencia->>'contrato_destino_id')::uuid;
    if found then
      begin
        insert into vp_logs (modulo, acao, alvo, alvo_id, detalhe)
          values ('Contrato Instalador', 'Recebeu valor transferido do distrato de ' || c.numero_documento, v_destino.numero_documento, v_destino.id::text,
                  jsonb_build_object('valor', d.transferencia->>'valor', 'origem_distrato', d.numero_documento, 'origem_contrato', c.numero_documento));
      exception when others then null; end;
      update contratos_instalador_distratos set transferencia = transferencia || jsonb_build_object('contrato_destino_numero', v_destino.numero_documento) where id = p_id;
    end if;
  end if;
  begin
    insert into vp_logs (modulo, acao, alvo, alvo_id, detalhe)
      values ('Contrato Instalador', 'Distrato concluído — contrato DISTRATADO', c.numero_documento, c.id::text, jsonb_build_object('parcelas_removidas', v_parc));
  exception when others then null; end;
end $$;

create or replace function public._di_verificar_completo(p_id uuid, p_ultimo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare d contratos_instalador_distratos%rowtype; ultima documento_signatarios%rowtype;
begin
  select * into d from contratos_instalador_distratos where id = p_id for update;
  if not found or d.status <> 'assinado' or d.assinaturas_completas_em is not null then return; end if;
  if not exists (select 1 from documento_signatarios where documento_tipo = 'distrato_instalador' and documento_id = p_id::text) then return; end if;
  if exists (select 1 from documento_signatarios where documento_tipo = 'distrato_instalador' and documento_id = p_id::text and status not in ('assinado', 'expirado')) then return; end if;
  update contratos_instalador_distratos set assinaturas_completas_em = now() where id = p_id;
  select * into ultima from documento_signatarios where documento_tipo = 'distrato_instalador' and documento_id = p_id::text order by signed_at desc nulls last limit 1;
  perform public._di_aviso('concluida', d, ultima, coalesce(p_ultimo, ultima.nome), 'hub.aviso:distrato:' || p_id || ':concluida');
  perform public._di_finalizar(p_id);
end $$;

create or replace function public._di_apos_assinatura(s documento_signatarios)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public._di_liberar_proxima(s.documento_id::uuid, s.nome) then return; end if;
  perform public._di_verificar_completo(s.documento_id::uuid, s.nome);
end $$;

create or replace function public._di_apos_recusa(s documento_signatarios, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare d contratos_instalador_distratos%rowtype;
begin
  select * into d from contratos_instalador_distratos where id = s.documento_id::uuid;
  if not found then return; end if;
  perform public._di_aviso('recusada', d, s, s.nome, 'hub.aviso:distrato:' || s.id || ':recusada', p_motivo);
end $$;

-- ========== Página pública (token da Contratada no distrato) ==========

create or replace function public.public_di_obter(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d contratos_instalador_distratos%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into d from contratos_instalador_distratos where token = p_token;
  if not found then return null; end if;
  if d.status in ('enviado', 'visualizado') and d.expires_at is not null and d.expires_at < now() then
    update contratos_instalador_distratos set status = 'expirado', atualizado_em = now() where id = d.id returning * into d;
  end if;
  return to_jsonb(d);
end $$;

create or replace function public.public_di_visualizado(p_token text, p_audit jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d contratos_instalador_distratos%rowtype; ip text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into d from contratos_instalador_distratos where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if d.status <> 'enviado' then return jsonb_build_object('ok', true, 'rec', to_jsonb(d), 'mudou', false); end if;
  ip := public._pp_ip(p_audit->>'viewIp');
  update contratos_instalador_distratos set status = 'visualizado', viewed_at = now(), atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('viewedAt', now(), 'viewIp', ip),
         log = log || jsonb_build_array(jsonb_build_object('status', 'visualizado', 'at', now(), 'meta', jsonb_build_object('ip', ip)))
   where id = d.id returning * into d;
  return jsonb_build_object('ok', true, 'rec', to_jsonb(d), 'mudou', true);
end $$;

create or replace function public.public_di_assinar(p_token text, p_audit jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d contratos_instalador_distratos%rowtype; ip text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into d from contratos_instalador_distratos where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if d.status = 'assinado' then return jsonb_build_object('ok', true, 'rec', to_jsonb(d), 'jaAssinado', true); end if;
  if d.status not in ('enviado', 'visualizado') then return jsonb_build_object('ok', false, 'erro', 'status_' || d.status); end if;
  if coalesce(trim(p_audit->>'signerName'), '') = '' then return jsonb_build_object('ok', false, 'erro', 'nome_obrigatorio'); end if;
  ip := public._pp_ip(p_audit->>'signIp');
  update contratos_instalador_distratos set status = 'assinado', signed_at = now(), atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('signedAt', now(), 'signIp', ip, 'consent', true),
         log = log || jsonb_build_array(jsonb_build_object('status', 'assinado', 'at', now(), 'meta', jsonb_build_object('ip', ip, 'signerName', p_audit->>'signerName')))
   where id = d.id returning * into d;
  perform public._di_fila_criar(d.id);
  begin
    insert into vp_logs (ator_nome, ator_setor, modulo, acao, alvo, alvo_id)
      values (p_audit->>'signerName', 'externo', 'Contrato Instalador', 'Assinou o Distrato', d.numero_documento, d.contrato_id::text);
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'rec', to_jsonb(d));
end $$;

create or replace function public.public_di_recusar(p_token text, p_nome text, p_motivo text, p_audit jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d contratos_instalador_distratos%rowtype; ip text; n text; m text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into d from contratos_instalador_distratos where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if d.status not in ('enviado', 'visualizado') then return jsonb_build_object('ok', false, 'erro', 'status_' || d.status); end if;
  n := nullif(left(trim(coalesce(p_nome, '')), 200), '');
  m := nullif(left(trim(coalesce(p_motivo, '')), 2000), '');
  ip := public._pp_ip(p_audit->>'refuseIp');
  update contratos_instalador_distratos set status = 'recusado', atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('refusedAt', now(), 'refusedBy', n, 'refusedReason', m, 'refuseIp', ip),
         log = log || jsonb_build_array(jsonb_build_object('status', 'recusado', 'at', now(), 'meta', jsonb_build_object('nome', n, 'motivo', m, 'ip', ip)))
   where id = d.id returning * into d;
  begin
    insert into vp_logs (ator_nome, ator_setor, modulo, acao, alvo, alvo_id)
      values (n, 'externo', 'Contrato Instalador', 'Recusou assinar o Distrato' || case when m is not null then ' — Motivo: ' || m else '' end, d.numero_documento, d.contrato_id::text);
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'rec', to_jsonb(d));
end $$;

revoke execute on function public.public_di_obter(text) from public, anon;
grant execute on function public.public_di_obter(text) to anon, authenticated, service_role;
revoke execute on function public.public_di_visualizado(text, jsonb) from public, anon;
grant execute on function public.public_di_visualizado(text, jsonb) to anon, authenticated, service_role;
revoke execute on function public.public_di_assinar(text, jsonb) from public, anon;
grant execute on function public.public_di_assinar(text, jsonb) to anon, authenticated, service_role;
revoke execute on function public.public_di_recusar(text, text, text, jsonb) from public, anon;
grant execute on function public.public_di_recusar(text, text, text, jsonb) to anon, authenticated, service_role;

create or replace function public.public_di_fila(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare did text;
begin
  if coalesce(length(p_token), 0) < 8 then return '[]'::jsonb; end if;
  select id::text into did from contratos_instalador_distratos where token = p_token;
  if did is null then select documento_id into did from documento_signatarios where token = p_token and documento_tipo = 'distrato_instalador'; end if;
  if did is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('ordem', ordem, 'papel', papel, 'nome', nome, 'status', status, 'liberada', liberada_em is not null, 'signed_at', signed_at,
            'token', token,
            'audit', jsonb_strip_nulls(jsonb_build_object('signerName', audit->>'signerName', 'signedAt', audit->>'signedAt', 'signDevice', audit->>'signDevice',
              'signIp', audit->>'signIp', 'hash', audit->>'hash', 'signatureType', audit->>'signatureType',
              'signatureData', case when (audit->>'signatureData') like 'data:image/%' then audit->>'signatureData' else null end))) order by ordem)
     from documento_signatarios where documento_tipo = 'distrato_instalador' and documento_id = did and status <> 'expirado'), '[]'::jsonb);
end $$;
revoke execute on function public.public_di_fila(text) from public, anon;
grant execute on function public.public_di_fila(text) to anon, authenticated, service_role;

-- ========== Reaproveita a fila genérica (documento_signatarios) do contrato original ==========
-- Extensão aditiva: as mesmas 4 funções já usadas pela fila do Contrato Instalador
-- (Diego/Juliana/Maurício) passam a reconhecer também documento_tipo='distrato_instalador'.
-- Nada do comportamento existente para 'contrato_venda'/'contrato_instalador' muda.

create or replace function public.public_cvs_visualizado(p_token text, p_audit jsonb default '{}'::jsonb)
 returns jsonb language plpgsql security definer set search_path = 'public' as $function$
declare s1 contrato_venda_signatarios%rowtype; s2 documento_signatarios%rowtype; ip text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into s1 from contrato_venda_signatarios where token = p_token for update;
  if found then
    if s1.status in ('enviado', 'pendente') then
      update contrato_venda_signatarios set status = 'visualizado', viewed_at = now(), atualizado_em = now() where id = s1.id returning * into s1;
    end if;
    return jsonb_build_object('ok', true, 'rec', to_jsonb(s1));
  end if;
  select * into s2 from documento_signatarios where token = p_token for update;
  if found then
    if s2.documento_tipo in ('contrato_instalador', 'distrato_instalador') and s2.liberada_em is null and s2.status = 'pendente' then
      return jsonb_build_object('ok', false, 'erro', 'ainda_nao_e_sua_vez');
    end if;
    if s2.status in ('enviado', 'pendente') then
      ip := public._pp_ip(p_audit->>'viewIp');
      update documento_signatarios set status = 'visualizado', viewed_at = now(), atualizado_em = now(),
             audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('viewedAt', now(), 'viewIp', ip)
       where id = s2.id returning * into s2;
    end if;
    return jsonb_build_object('ok', true, 'rec', to_jsonb(s2));
  end if;
  return jsonb_build_object('ok', false, 'erro', 'link_invalido');
end $function$;

create or replace function public.public_cvs_assinar(p_token text, p_audit jsonb)
 returns jsonb language plpgsql security definer set search_path = 'public' as $function$
declare s1 contrato_venda_signatarios%rowtype; s2 documento_signatarios%rowtype; c contratos_venda_equipamentos%rowtype; ip text; ag jsonb; lg jsonb;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  ip := public._pp_ip(p_audit->>'signIp');
  ag := public._pp_audit_permitido(p_audit) || jsonb_build_object('signedAt', now(), 'signIp', ip, 'consent', true);
  select * into s1 from contrato_venda_signatarios where token = p_token for update;
  if found then
    if s1.status not in ('pendente', 'enviado', 'visualizado') then return jsonb_build_object('ok', false, 'erro', 'status_' || s1.status); end if;
    lg := jsonb_build_array(jsonb_build_object('status', 'assinado', 'at', now(), 'meta', jsonb_build_object('ip', ip, 'ua', p_audit->>'signUa', 'hash', p_audit->>'hash')));
    update contrato_venda_signatarios set status = 'assinado', signed_at = now(), atualizado_em = now(),
           audit = coalesce(audit, '{}'::jsonb) || ag, log = coalesce(log, '[]'::jsonb) || lg where id = s1.id returning * into s1;
    select * into c from contratos_venda_equipamentos where id = s1.contrato_venda_id;
    begin
      insert into vp_logs (ator_nome, ator_setor, modulo, acao, alvo_id)
        values (coalesce(nullif(s1.nome, ''), s1.papel), 'externo', 'Contrato Venda', s1.papel || ' (' || coalesce(s1.nome, 'signatário adicional') || ') assinou o contrato', s1.contrato_venda_id);
      if c.id is not null then
        insert into fluxo_pendentes (tipo, payload) values ('contrato_venda_signatario', jsonb_build_object('contrato_id', c.id, 'proposta_id', c.proposta_id,
          'resposta', 'assinou', 'label', s1.papel || ' — ' || coalesce(s1.nome, ''), 'nome', s1.nome));
      end if;
    exception when others then raise warning '[public_cvs_assinar] log/fila falhou: %', sqlerrm; end;
    perform public._cv_finalizar(s1.contrato_venda_id);
    return jsonb_build_object('ok', true, 'rec', to_jsonb(s1));
  end if;
  select * into s2 from documento_signatarios where token = p_token for update;
  if found then
    if s2.documento_tipo in ('contrato_instalador', 'distrato_instalador') and s2.liberada_em is null and s2.status = 'pendente' then
      return jsonb_build_object('ok', false, 'erro', 'ainda_nao_e_sua_vez');
    end if;
    if s2.status not in ('pendente', 'enviado', 'visualizado') then return jsonb_build_object('ok', false, 'erro', 'status_' || s2.status); end if;
    lg := jsonb_build_array(jsonb_build_object('status', 'assinado', 'at', now(), 'meta', jsonb_build_object('ip', ip, 'ua', p_audit->>'signUa', 'hash', p_audit->>'hash')));
    update documento_signatarios set status = 'assinado', signed_at = now(), atualizado_em = now(),
           audit = coalesce(audit, '{}'::jsonb) || ag, log = coalesce(log, '[]'::jsonb) || lg where id = s2.id returning * into s2;
    begin
      insert into vp_logs (ator_nome, ator_setor, modulo, acao, alvo_id)
        values (s2.nome, 'externo', 'Assinatura de Documento', case when s2.papel is not null then s2.papel || ' — ' else '' end || s2.nome || ' assinou (' || s2.documento_tipo || ')', s2.documento_id);
    exception when others then raise warning '[public_cvs_assinar] log falhou: %', sqlerrm; end;
    if s2.documento_tipo = 'contrato_venda' then perform public._cv_finalizar(s2.documento_id); end if;
    if s2.documento_tipo = 'contrato_instalador' then
      begin perform public._ci_apos_assinatura(s2);
      exception when others then raise warning '[public_cvs_assinar] sequencia falhou: %', sqlerrm; end;
    end if;
    if s2.documento_tipo = 'distrato_instalador' then
      begin perform public._di_apos_assinatura(s2);
      exception when others then raise warning '[public_cvs_assinar] sequencia distrato falhou: %', sqlerrm; end;
    end if;
    return jsonb_build_object('ok', true, 'rec', to_jsonb(s2));
  end if;
  return jsonb_build_object('ok', false, 'erro', 'link_invalido');
end $function$;

create or replace function public.public_cvs_recusar(p_token text, p_nome text, p_motivo text, p_audit jsonb default '{}'::jsonb)
 returns jsonb language plpgsql security definer set search_path = 'public' as $function$
declare s1 contrato_venda_signatarios%rowtype; s2 documento_signatarios%rowtype; c contratos_venda_equipamentos%rowtype; ip text; n text; m text; lg jsonb;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  n := nullif(left(trim(coalesce(p_nome, '')), 200), '');
  m := nullif(left(trim(coalesce(p_motivo, '')), 2000), '');
  ip := public._pp_ip(p_audit->>'refuseIp');
  select * into s1 from contrato_venda_signatarios where token = p_token for update;
  if found then
    if s1.status not in ('pendente', 'enviado', 'visualizado') then return jsonb_build_object('ok', false, 'erro', 'status_' || s1.status); end if;
    lg := jsonb_build_array(jsonb_build_object('status', 'recusado', 'at', now(), 'meta', jsonb_build_object('motivo', m)));
    update contrato_venda_signatarios set status = 'recusado', atualizado_em = now(),
           audit = coalesce(audit, '{}'::jsonb) || jsonb_build_object('refusedAt', now(), 'refusedReason', m), log = coalesce(log, '[]'::jsonb) || lg
     where id = s1.id returning * into s1;
    select * into c from contratos_venda_equipamentos where id = s1.contrato_venda_id;
    begin
      insert into vp_logs (ator_nome, ator_setor, modulo, acao, alvo_id)
        values (coalesce(nullif(s1.nome, ''), s1.papel), 'externo', 'Contrato Venda',
                s1.papel || ' (' || coalesce(s1.nome, 'signatário adicional') || ') recusou assinar o contrato' || case when m is not null then ' — Motivo: ' || m else '' end, s1.contrato_venda_id);
      if c.id is not null then
        insert into fluxo_pendentes (tipo, payload) values ('contrato_venda_signatario', jsonb_build_object('contrato_id', c.id, 'proposta_id', c.proposta_id,
          'resposta', 'recusou', 'label', s1.papel || ' — ' || coalesce(s1.nome, ''), 'nome', s1.nome));
      end if;
    exception when others then raise warning '[public_cvs_recusar] log/fila falhou: %', sqlerrm; end;
    return jsonb_build_object('ok', true, 'rec', to_jsonb(s1));
  end if;
  select * into s2 from documento_signatarios where token = p_token for update;
  if found then
    if s2.documento_tipo in ('contrato_instalador', 'distrato_instalador') and s2.liberada_em is null and s2.status = 'pendente' then
      return jsonb_build_object('ok', false, 'erro', 'ainda_nao_e_sua_vez');
    end if;
    if s2.status not in ('pendente', 'enviado', 'visualizado') then return jsonb_build_object('ok', false, 'erro', 'status_' || s2.status); end if;
    lg := jsonb_build_array(jsonb_build_object('status', 'recusado', 'at', now(), 'meta', jsonb_build_object('nome', coalesce(n, s2.nome), 'motivo', m, 'ip', ip)));
    update documento_signatarios set status = 'recusado', atualizado_em = now(),
           audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('refusedAt', now(), 'refusedBy', coalesce(n, s2.nome), 'refusedReason', m, 'refuseIp', ip),
           log = coalesce(log, '[]'::jsonb) || lg where id = s2.id returning * into s2;
    begin
      insert into vp_logs (ator_nome, ator_setor, modulo, acao, alvo_id)
        values (s2.nome, 'externo', 'Assinatura de Documento',
                case when s2.papel is not null then s2.papel || ' — ' else '' end || s2.nome || ' recusou assinar (' || s2.documento_tipo || ')' || case when m is not null then ' — Motivo: ' || m else '' end, s2.documento_id);
    exception when others then raise warning '[public_cvs_recusar] log falhou: %', sqlerrm; end;
    if s2.documento_tipo = 'contrato_instalador' then
      begin perform public._ci_apos_recusa(s2, m);
      exception when others then raise warning '[public_cvs_recusar] aviso falhou: %', sqlerrm; end;
    end if;
    if s2.documento_tipo = 'distrato_instalador' then
      begin perform public._di_apos_recusa(s2, m);
      exception when others then raise warning '[public_cvs_recusar] aviso distrato falhou: %', sqlerrm; end;
    end if;
    return jsonb_build_object('ok', true, 'rec', to_jsonb(s2));
  end if;
  return jsonb_build_object('ok', false, 'erro', 'link_invalido');
end $function$;

-- ========== Token sempre visível (requisito confirmado) — também no Contrato original ==========
-- Aditivo: só acrescenta a chave 'token' no jsonb já devolvido pra fila do contrato.
-- Nenhum dado novo é exposto (é o mesmo token que o próprio signatário já usa no link dele).

create or replace function public.public_ci_fila(p_token text)
 returns jsonb language plpgsql stable security definer set search_path = 'public' as $function$
declare cid text;
begin
  if coalesce(length(p_token), 0) < 8 then return '[]'::jsonb; end if;
  select id::text into cid from contratos_instalador where token = p_token;
  if cid is null then select documento_id into cid from documento_signatarios where token = p_token and documento_tipo = 'contrato_instalador'; end if;
  if cid is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('ordem', ordem, 'papel', papel, 'nome', nome, 'status', status, 'liberada', liberada_em is not null, 'signed_at', signed_at,
            'token', token,
            'audit', jsonb_strip_nulls(jsonb_build_object('signerName', audit->>'signerName', 'signedAt', audit->>'signedAt', 'signDevice', audit->>'signDevice',
              'signIp', audit->>'signIp', 'hash', audit->>'hash', 'signatureType', audit->>'signatureType',
              'signatureData', case when (audit->>'signatureData') like 'data:image/%' then audit->>'signatureData' else null end))) order by ordem)
     from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = cid and status <> 'expirado'), '[]'::jsonb);
end $function$;

notify pgrst, 'reload schema';
