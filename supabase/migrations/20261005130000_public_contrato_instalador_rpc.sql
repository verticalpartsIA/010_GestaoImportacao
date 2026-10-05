-- Segurança real (#571) · Fase 3 / Task 11c — Contrato do Instalador (/assinar/:token) por RPC (05/10/2026).
-- ADITIVA: só cria funções (+1 índice). Mesmo molde da Proposta (Task 9/10) e do Contrato de Venda (11a/b): o servidor decide
-- as transições de status, carimba hora e IP, grava aviso (alertas) e auditoria (vp_logs); o evento CONTRATO_INSTALADOR_ASSINADO
-- vai pela fila fluxo_pendentes (src/fluxo-pendentes.js). Inclui a expiração "preguiçosa" que o navegador fazia ao abrir o link.

create unique index if not exists fluxo_pendentes_ci_assinado_uq on public.fluxo_pendentes ((payload->>'contrato_id')) where tipo = 'contrato_instalador_assinado';

create or replace function public._ci_efeitos(c contratos_instalador, ev text, meta jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare contra text; num text; ip text; quando text; lvl text; titulo text; sub text; acao text; ator text; setor text := 'externo'; tipo text;
begin
  contra := coalesce(nullif(c.recipient->>'name', ''), nullif(c.responsavel_nome, ''), nullif(c.contratada_nome, ''), 'Contraparte');
  num := coalesce(c.numero_documento, '');
  ip := nullif(meta->>'ip', '');
  quando := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
  if ev = 'visualizado' then
    lvl := 'warning'; titulo := 'Contrato instalador ' || num || ' foi VISUALIZADO';
    sub := 'Aberto por ' || coalesce(c.recipient->>'name', '') || ' · ' || case when ip is not null then 'IP ' || ip || ' · ' else '' end || quando;
    acao := 'contraparte visualizou'; ator := contra;
  elsif ev = 'assinado' then
    lvl := 'info'; titulo := 'Contrato instalador ' || num || ' ASSINADO';
    sub := 'Por ' || coalesce(nullif(meta->>'signerName', ''), c.responsavel_nome, '') || ' · ' || case when ip is not null then 'IP ' || ip else '' end;
    acao := 'contrato assinado'; ator := coalesce(nullif(meta->>'signerName', ''), contra);
    tipo := 'contrato_instalador_assinado';
  elsif ev = 'recusado' then
    lvl := 'danger'; titulo := 'Contrato instalador ' || num || ' foi RECUSADO';
    sub := 'Recusado por ' || coalesce(nullif(meta->>'nome', ''), nullif(c.recipient->>'name', ''), 'destinatário') || ' em ' || quando || case when coalesce(meta->>'motivo', '') <> '' then ' — Motivo: ' || (meta->>'motivo') else '' end;
    acao := 'assinatura recusada' || case when coalesce(meta->>'motivo', '') <> '' then ' — Motivo: ' || (meta->>'motivo') else '' end;
    ator := coalesce(nullif(meta->>'nome', ''), contra);
  elsif ev = 'expirado' then
    lvl := 'warning'; titulo := 'Contrato instalador ' || num || ' EXPIROU'; sub := 'Link aguardando assinatura por 7 dias sem retorno';
    acao := 'link de assinatura expirou'; ator := 'Sistema'; setor := 'sistema';
  else
    return;
  end if;
  begin
    insert into alertas (id, level, title, sub, module, resolved) values ('ci-' || gen_random_uuid()::text, lvl, titulo, sub, 'Jurídico', false);
    insert into vp_logs (ator_nome, ator_setor, modulo, acao, alvo, alvo_id) values (ator, setor, 'Contrato Instalador', acao, c.numero_documento, c.id::text);
  exception when others then raise warning '[_ci_efeitos] alerta/log falhou: %', sqlerrm;
  end;
  if tipo is not null then
    begin
      insert into fluxo_pendentes (tipo, payload) values (tipo, jsonb_build_object('contrato_id', c.id::text, 'label', c.numero_documento,
        'numero_cotacao', c.form_state->>'numeroCotacao', 'signerName', meta->>'signerName'));
    exception when unique_violation then null;
    when others then raise warning '[_ci_efeitos] fila falhou: %', sqlerrm;
    end;
  end if;
end $$;
revoke execute on function public._ci_efeitos(contratos_instalador, text, jsonb) from public, anon, authenticated;

-- expiração "preguiçosa": link vencido vira 'expirado' ao ser aberto (espelho de CIStore.getByToken)
create or replace function public._ci_expirar_se_vencido(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype;
begin
  select * into c from contratos_instalador where id = p_id for update;
  if not found then return; end if;
  if c.status in ('enviado', 'visualizado') and c.expires_at is not null and c.expires_at < now() then
    update contratos_instalador set status = 'expirado', atualizado_em = now(),
           log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'expirado', 'at', now(), 'meta', null))
     where id = p_id returning * into c;
    perform public._ci_efeitos(c, 'expirado', '{}'::jsonb);
  end if;
end $$;
revoke execute on function public._ci_expirar_se_vencido(uuid) from public, anon, authenticated;

create or replace function public.public_ci_obter(p_token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into c from contratos_instalador where token = p_token;
  if not found then return null; end if;
  perform public._ci_expirar_se_vencido(c.id);
  select * into c from contratos_instalador where id = c.id;
  return to_jsonb(c);
end $$;

create or replace function public.public_ci_visualizado(p_token text, p_audit jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype; ip text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into c from contratos_instalador where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if c.status not in ('enviado', 'rascunho') then return jsonb_build_object('ok', true, 'rec', to_jsonb(c), 'mudou', false); end if;
  ip := public._pp_ip(p_audit->>'viewIp');
  update contratos_instalador set status = 'visualizado', viewed_at = now(), atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('viewedAt', now(), 'viewIp', ip),
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'visualizado', 'at', now(), 'meta', jsonb_build_object('ip', ip, 'ua', p_audit->>'viewUa')))
   where id = c.id returning * into c;
  perform public._ci_efeitos(c, 'visualizado', jsonb_build_object('ip', ip));
  return jsonb_build_object('ok', true, 'rec', to_jsonb(c), 'mudou', true);
end $$;

create or replace function public.public_ci_assinar(p_token text, p_audit jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype; ip text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into c from contratos_instalador where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  perform public._ci_expirar_se_vencido(c.id);
  select * into c from contratos_instalador where id = c.id for update;
  if c.status = 'assinado' then return jsonb_build_object('ok', true, 'rec', to_jsonb(c), 'jaAssinado', true); end if;   -- idempotente, como antes
  if c.status not in ('enviado', 'visualizado', 'rascunho') then return jsonb_build_object('ok', false, 'erro', 'status_' || c.status); end if;
  if coalesce(trim(p_audit->>'signerName'), '') = '' then return jsonb_build_object('ok', false, 'erro', 'nome_obrigatorio'); end if;
  ip := public._pp_ip(p_audit->>'signIp');
  update contratos_instalador set status = 'assinado', signed_at = now(), atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('signedAt', now(), 'signIp', ip, 'consent', true),
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'assinado', 'at', now(), 'meta', jsonb_build_object('ip', ip, 'ua', p_audit->>'signUa', 'hash', p_audit->>'hash')))
   where id = c.id returning * into c;
  perform public._ci_efeitos(c, 'assinado', jsonb_build_object('ip', ip, 'signerName', p_audit->>'signerName'));
  return jsonb_build_object('ok', true, 'rec', to_jsonb(c));
end $$;

create or replace function public.public_ci_recusar(p_token text, p_nome text, p_motivo text, p_audit jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype; ip text; n text; m text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into c from contratos_instalador where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  perform public._ci_expirar_se_vencido(c.id);
  select * into c from contratos_instalador where id = c.id for update;
  if c.status not in ('enviado', 'visualizado', 'rascunho') then return jsonb_build_object('ok', false, 'erro', 'status_' || c.status); end if;
  n := nullif(left(trim(coalesce(p_nome, '')), 200), '');
  m := nullif(left(trim(coalesce(p_motivo, '')), 2000), '');
  ip := public._pp_ip(p_audit->>'refuseIp');
  update contratos_instalador set status = 'recusado', atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('refusedAt', now(), 'refusedBy', n, 'refusedReason', m, 'refuseIp', ip),
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'recusado', 'at', now(), 'meta', jsonb_build_object('nome', n, 'motivo', m, 'ip', ip)))
   where id = c.id returning * into c;
  perform public._ci_efeitos(c, 'recusado', jsonb_build_object('ip', ip, 'nome', n, 'motivo', m));
  return jsonb_build_object('ok', true, 'rec', to_jsonb(c));
end $$;

revoke execute on function public.public_ci_obter(text), public.public_ci_visualizado(text, jsonb), public.public_ci_assinar(text, jsonb),
  public.public_ci_recusar(text, text, text, jsonb) from public;
grant execute on function public.public_ci_obter(text), public.public_ci_visualizado(text, jsonb), public.public_ci_assinar(text, jsonb),
  public.public_ci_recusar(text, text, text, jsonb) to anon, authenticated;
