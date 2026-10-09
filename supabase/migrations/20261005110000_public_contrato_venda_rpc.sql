-- Segurança real (#571) · Fase 3 / Task 11a+11b — Contrato de Venda e signatários adicionais por RPC (05/10/2026).
-- ADITIVA: só cria funções (+1 índice). O caminho antigo continua funcionando até a Fase 4.
-- Cobre os 3 tokens que a página /assinar aceita para Contrato de Venda: o do representante (contratos_venda_equipamentos),
-- o do signatário sócio/jurídico (contrato_venda_signatarios) e o da lista "Deve assinar" (documento_signatarios, tipo contrato_venda).
-- A regra "só vira ASSINADO quando o representante e TODOS os signatários assinaram" fica no servidor (_cv_pendentes/_cv_finalizar).
-- Aviso (alertas) e auditoria (vp_logs) no banco; eventos/D0 vão pela fila fluxo_pendentes (src/fluxo-pendentes.js) com o código de antes.

create unique index if not exists fluxo_pendentes_cv_assinado_uq on public.fluxo_pendentes ((payload->>'contrato_id')) where tipo = 'contrato_venda_assinado';

create or replace function public._cv_pendentes(p_contrato text) returns integer language sql stable security definer set search_path = public as $$
  select (select count(*) from contrato_venda_signatarios where contrato_venda_id = p_contrato and status <> 'assinado')::int
       + (select count(*) from documento_signatarios where documento_tipo = 'contrato_venda' and documento_id = p_contrato and status <> 'assinado')::int
$$;

create or replace function public._cv_efeitos(c contratos_venda_equipamentos, ev text, meta jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare titular text; num text; ip text; quando text; lvl text; titulo text; sub text; acao text; ator text; tipo text; pay jsonb;
begin
  titular := coalesce(nullif(c.recipient->>'name', ''), nullif(c.responsavel_nome, ''), nullif(c.comprador_razao_social, ''), '');
  num := coalesce(c.numero_documento, '');
  ip := nullif(meta->>'ip', '');
  quando := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
  pay := jsonb_build_object('contrato_id', c.id, 'proposta_id', c.proposta_id,
                            'label', coalesce(c.comprador_razao_social, '') || ' · ' || num, 'signerName', meta->>'signerName');
  if ev = 'visualizado' then
    lvl := 'warning'; titulo := 'Contrato venda ' || num || ' foi VISUALIZADO';
    sub := 'Aberto por ' || titular || ' · ' || case when ip is not null then 'IP ' || ip || ' · ' else '' end || quando;
    acao := 'contraparte visualizou'; ator := coalesce(nullif(titular, ''), 'Contraparte');
  elsif ev = 'assinado' then
    lvl := 'info'; titulo := 'Contrato venda ' || num || ' ASSINADO';
    sub := 'Por ' || coalesce(nullif(meta->>'signerName', ''), titular) || ' · ' || case when ip is not null then 'IP ' || ip else '' end;
    acao := 'contrato assinado'; ator := coalesce(nullif(meta->>'signerName', ''), nullif(titular, ''), 'Contraparte');
    tipo := 'contrato_venda_assinado';
  elsif ev = 'assinado_representante' then
    lvl := 'info'; titulo := 'Contrato venda ' || num || ' — representante assinou';
    sub := 'Aguardando outros signatários (sócios/jurídico) para concluir · ' || coalesce(nullif(meta->>'signerName', ''), titular);
    acao := 'representante assinou — aguardando outros signatários (sócios/jurídico)'; ator := coalesce(nullif(meta->>'signerName', ''), nullif(titular, ''), 'Contraparte');
    tipo := 'contrato_venda_representante';
  elsif ev = 'recusado' then
    lvl := 'danger'; titulo := 'Contrato venda ' || num || ' foi RECUSADO';
    sub := 'Recusado por ' || coalesce(nullif(meta->>'nome', ''), nullif(titular, ''), 'destinatário') || ' em ' || quando || case when coalesce(meta->>'motivo', '') <> '' then ' — Motivo: ' || (meta->>'motivo') else '' end;
    acao := 'assinatura recusada' || case when coalesce(meta->>'motivo', '') <> '' then ' — Motivo: ' || (meta->>'motivo') else '' end;
    ator := coalesce(nullif(meta->>'nome', ''), nullif(titular, ''), 'Contraparte');
  else
    return;
  end if;
  begin
    insert into alertas (id, level, title, sub, module, resolved) values ('cv-' || gen_random_uuid()::text, lvl, titulo, sub, 'Jurídico', false);
    insert into vp_logs (ator_nome, ator_setor, modulo, acao, alvo, alvo_id) values (ator, 'externo', 'Contrato Venda', acao, c.numero_documento, c.id);
  exception when others then raise warning '[_cv_efeitos] alerta/log falhou: %', sqlerrm;
  end;
  if tipo is not null then
    begin insert into fluxo_pendentes (tipo, proposta_id, payload) values (tipo, null, pay);
    exception when unique_violation then null;
    when others then raise warning '[_cv_efeitos] fila falhou: %', sqlerrm;
    end;
  end if;
end $$;

-- fecha o contrato quando o representante JÁ assinou e não resta nenhum signatário (espelho de tentarFinalizarAposSignatarioExtra)
create or replace function public._cv_finalizar(p_contrato text) returns void language plpgsql security definer set search_path = public as $$
declare c contratos_venda_equipamentos%rowtype;
begin
  select * into c from contratos_venda_equipamentos where id = p_contrato for update;
  if not found or c.status = 'assinado' then return; end if;
  if coalesce(c.audit->>'signedAt', '') = '' then return; end if;
  if public._cv_pendentes(p_contrato) > 0 then return; end if;
  update contratos_venda_equipamentos set status = 'assinado', signed_at = now(), atualizado_em = now(),
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'assinado', 'at', now(), 'meta', jsonb_build_object('ultimoSignatario', true)))
   where id = p_contrato returning * into c;
  perform public._cv_efeitos(c, 'assinado', '{}'::jsonb);
end $$;

revoke execute on function public._cv_pendentes(text), public._cv_efeitos(contratos_venda_equipamentos, text, jsonb), public._cv_finalizar(text)
  from public, anon, authenticated;

-- ---------- representante (token do contrato) ----------
create or replace function public.public_cv_obter(p_token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c contratos_venda_equipamentos%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into c from contratos_venda_equipamentos where token = p_token;
  if not found then return null; end if;
  return to_jsonb(c);
end $$;

create or replace function public.public_cv_visualizado(p_token text, p_audit jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c contratos_venda_equipamentos%rowtype; ip text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into c from contratos_venda_equipamentos where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if c.status not in ('enviado', 'rascunho') then return jsonb_build_object('ok', true, 'rec', to_jsonb(c), 'mudou', false); end if;
  ip := public._pp_ip(p_audit->>'viewIp');
  update contratos_venda_equipamentos set status = 'visualizado', viewed_at = now(), atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('viewedAt', now(), 'viewIp', ip),
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'visualizado', 'at', now(), 'meta', jsonb_build_object('ip', ip, 'ua', p_audit->>'viewUa')))
   where id = c.id returning * into c;
  perform public._cv_efeitos(c, 'visualizado', jsonb_build_object('ip', ip));
  return jsonb_build_object('ok', true, 'rec', to_jsonb(c), 'mudou', true);
end $$;

create or replace function public.public_cv_assinar(p_token text, p_audit jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c contratos_venda_equipamentos%rowtype; ip text; pend int; eh_final boolean;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into c from contratos_venda_equipamentos where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if c.status not in ('enviado', 'visualizado', 'rascunho') or coalesce(c.audit->>'signedAt', '') <> '' then
    return jsonb_build_object('ok', false, 'erro', 'status_' || coalesce(c.status, 'desconhecido'));
  end if;
  if c.expires_at is not null and c.expires_at < now() then return jsonb_build_object('ok', false, 'erro', 'expirada'); end if;
  if coalesce(trim(p_audit->>'signerName'), '') = '' then return jsonb_build_object('ok', false, 'erro', 'nome_obrigatorio'); end if;
  ip := public._pp_ip(p_audit->>'signIp');
  pend := public._cv_pendentes(c.id);
  eh_final := (pend = 0);
  update contratos_venda_equipamentos set
         status = case when eh_final then 'assinado' else 'aguardando_signatarios' end,
         signed_at = case when eh_final then now() else signed_at end, atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('signedAt', now(), 'signIp', ip, 'consent', true),
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'assinado', 'at', now(), 'meta', jsonb_build_object('ip', ip, 'ua', p_audit->>'signUa', 'hash', p_audit->>'hash')))
   where id = c.id returning * into c;
  perform public._cv_efeitos(c, case when eh_final then 'assinado' else 'assinado_representante' end, jsonb_build_object('ip', ip, 'signerName', p_audit->>'signerName'));
  return jsonb_build_object('ok', true, 'rec', to_jsonb(c));
end $$;

create or replace function public.public_cv_recusar(p_token text, p_nome text, p_motivo text, p_audit jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c contratos_venda_equipamentos%rowtype; ip text; n text; m text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into c from contratos_venda_equipamentos where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if c.status not in ('enviado', 'visualizado', 'rascunho') then return jsonb_build_object('ok', false, 'erro', 'status_' || coalesce(c.status, 'desconhecido')); end if;
  n := nullif(left(trim(coalesce(p_nome, '')), 200), '');
  m := nullif(left(trim(coalesce(p_motivo, '')), 2000), '');
  ip := public._pp_ip(p_audit->>'refuseIp');
  update contratos_venda_equipamentos set status = 'recusado', atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('refusedAt', now(), 'refusedBy', n, 'refusedReason', m, 'refuseIp', ip),
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'recusado', 'at', now(), 'meta', jsonb_build_object('nome', n, 'motivo', m, 'ip', ip)))
   where id = c.id returning * into c;
  perform public._cv_efeitos(c, 'recusado', jsonb_build_object('ip', ip, 'nome', n, 'motivo', m));
  return jsonb_build_object('ok', true, 'rec', to_jsonb(c));
end $$;

-- ---------- signatários (sócio/jurídico = contrato_venda_signatarios; lista "Deve assinar" = documento_signatarios) ----------
-- origem: 'cvs' | 'doc'. Devolve a linha do signatário e o contrato-pai (para renderizar o documento).
create or replace function public.public_cvs_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s1 contrato_venda_signatarios%rowtype; s2 documento_signatarios%rowtype; c contratos_venda_equipamentos%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into s1 from contrato_venda_signatarios where token = p_token;
  if found then
    select * into c from contratos_venda_equipamentos where id = s1.contrato_venda_id;
    return jsonb_build_object('origem', 'cvs', 'sig', to_jsonb(s1), 'contrato', case when c.id is null then null else to_jsonb(c) end);
  end if;
  select * into s2 from documento_signatarios where token = p_token;
  if found then
    if s2.documento_tipo = 'contrato_venda' then select * into c from contratos_venda_equipamentos where id = s2.documento_id; end if;
    return jsonb_build_object('origem', 'doc', 'sig', to_jsonb(s2), 'contrato', case when c.id is null then null else to_jsonb(c) end);
  end if;
  return null;
end $$;

create or replace function public.public_cvs_visualizado(p_token text, p_audit jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
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
    if s2.status in ('enviado', 'pendente') then
      ip := public._pp_ip(p_audit->>'viewIp');
      update documento_signatarios set status = 'visualizado', viewed_at = now(), atualizado_em = now(),
             audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('viewedAt', now(), 'viewIp', ip)
       where id = s2.id returning * into s2;
    end if;
    return jsonb_build_object('ok', true, 'rec', to_jsonb(s2));
  end if;
  return jsonb_build_object('ok', false, 'erro', 'link_invalido');
end $$;

create or replace function public.public_cvs_assinar(p_token text, p_audit jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
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
    if s2.status not in ('pendente', 'enviado', 'visualizado') then return jsonb_build_object('ok', false, 'erro', 'status_' || s2.status); end if;
    lg := jsonb_build_array(jsonb_build_object('status', 'assinado', 'at', now(), 'meta', jsonb_build_object('ip', ip, 'ua', p_audit->>'signUa', 'hash', p_audit->>'hash')));
    update documento_signatarios set status = 'assinado', signed_at = now(), atualizado_em = now(),
           audit = coalesce(audit, '{}'::jsonb) || ag, log = coalesce(log, '[]'::jsonb) || lg where id = s2.id returning * into s2;
    begin
      insert into vp_logs (ator_nome, ator_setor, modulo, acao, alvo_id)
        values (s2.nome, 'externo', 'Assinatura de Documento', case when s2.papel is not null then s2.papel || ' — ' else '' end || s2.nome || ' assinou (' || s2.documento_tipo || ')', s2.documento_id);
    exception when others then raise warning '[public_cvs_assinar] log falhou: %', sqlerrm; end;
    if s2.documento_tipo = 'contrato_venda' then perform public._cv_finalizar(s2.documento_id); end if;
    return jsonb_build_object('ok', true, 'rec', to_jsonb(s2));
  end if;
  return jsonb_build_object('ok', false, 'erro', 'link_invalido');
end $$;

create or replace function public.public_cvs_recusar(p_token text, p_nome text, p_motivo text, p_audit jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
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
    return jsonb_build_object('ok', true, 'rec', to_jsonb(s2));
  end if;
  return jsonb_build_object('ok', false, 'erro', 'link_invalido');
end $$;

revoke execute on function public.public_cv_obter(text), public.public_cv_visualizado(text, jsonb), public.public_cv_assinar(text, jsonb),
  public.public_cv_recusar(text, text, text, jsonb), public.public_cvs_obter(text), public.public_cvs_visualizado(text, jsonb),
  public.public_cvs_assinar(text, jsonb), public.public_cvs_recusar(text, text, text, jsonb) from public;
grant execute on function public.public_cv_obter(text), public.public_cv_visualizado(text, jsonb), public.public_cv_assinar(text, jsonb),
  public.public_cv_recusar(text, text, text, jsonb), public.public_cvs_obter(text), public.public_cvs_visualizado(text, jsonb),
  public.public_cvs_assinar(text, jsonb), public.public_cvs_recusar(text, text, text, jsonb) to anon, authenticated;
