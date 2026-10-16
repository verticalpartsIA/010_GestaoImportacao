-- 16/10/2026 (Gelson) — assinaturas em SEQUÊNCIA no Contrato do Instalador.
-- Ordem: 1 Contratado (já existe, é o contratos_instalador) -> 2 Diego Maeno (Contratante — CEO) -> 3 Juliana (Testemunha 1) -> 4 Maurício (Testemunha 2).
-- Cada pessoa só recebe o link quando a anterior assina. contratos_instalador.status NÃO muda ('assinado' = o Contratado assinou);
-- "todas as assinaturas" = assinaturas_completas_em. Reaproveita documento_signatarios (documento_tipo = 'contrato_instalador').
-- Cada passo vira um aviso em eventos_outbox (tipo hub.aviso_fluxo) para o gi-avisos mandar pelo WhatsApp (o envio NÃO é daqui).

alter table public.documento_signatarios add column if not exists liberada_em timestamptz;
alter table public.contratos_instalador add column if not exists assinaturas_completas_em timestamptz;

-- ---------- helpers internos ----------
create or replace function public._ci_obra(c contratos_instalador) returns text language sql immutable as $$
  select coalesce(nullif(c.form_state->>'clienteObraNome', ''), nullif(c.form_state->>'localServico', ''), c.titulo, 'obra')
$$;

-- Bianca (Jurídico) + quem gerou o contrato (instalador_acordos.criado_por é o NOME; casa com perfis).
create or replace function public._ci_dest_gestao(c contratos_instalador) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb := jsonb_build_array(jsonb_build_object('nome', 'Bianca Mayumi', 'email', 'bianca@verticalparts.com.br')); p record;
begin
  for p in
    select pf.nome, pf.email from perfis pf
     where pf.email is not null and lower(pf.email) <> 'bianca@verticalparts.com.br'
       and lower(pf.nome) in (select lower(a.criado_por) from instalador_acordos a where a.contrato_id = c.id and a.criado_por is not null)
     limit 1
  loop r := r || jsonb_build_array(jsonb_build_object('nome', p.nome, 'email', p.email)); end loop;
  return r;
end $$;

create or replace function public._ci_aviso(p_momento text, c contratos_instalador, s documento_signatarios, p_antes text, p_chave text, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare dest jsonb; link text; pl jsonb;
begin
  if p_momento = 'pendente' then
    dest := jsonb_build_array(jsonb_build_object('nome', s.nome, 'email', s.email));
    link := 'https://hub.vpsistema.com/assinar/' || s.token;
  else
    dest := public._ci_dest_gestao(c);
  end if;
  pl := jsonb_strip_nulls(jsonb_build_object(
    'origem_aviso', 'assinatura', 'momento', p_momento,
    'titulo', case p_momento when 'pendente' then 'Assinatura pendente — ' when 'recusada' then 'Assinatura recusada — ' else 'Assinaturas concluídas — ' end || c.numero_documento,
    'contrato', c.numero_documento, 'instalador', c.contratada_nome, 'obra', public._ci_obra(c),
    'papel', s.papel, 'ordem', s.ordem + 1, 'total', 4,
    'assinou_antes', jsonb_build_object('nome', p_antes),
    'destinatarios', dest, 'link_assinatura', link, 'motivo', p_motivo));
  perform evento_enfileirar('hub.aviso_fluxo', p_chave, 'contrato_instalador', c.id::text, c.numero_documento, pl, jsonb_build_object('nome', p_antes));
end $$;

-- Libera a próxima linha (só se todas as anteriores já assinaram) e publica o aviso dela. Devolve true se liberou alguém.
create or replace function public._ci_liberar_proxima(p_id uuid, p_antes text) returns boolean
language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype; s documento_signatarios%rowtype;
begin
  select * into c from contratos_instalador where id = p_id;
  if not found then return false; end if;
  select * into s from documento_signatarios
   where documento_tipo = 'contrato_instalador' and documento_id = p_id::text and status = 'pendente' and liberada_em is null
   order by ordem limit 1;
  if not found then return false; end if;
  if exists (select 1 from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = p_id::text
               and ordem < s.ordem and status not in ('assinado', 'expirado')) then return false; end if;
  update documento_signatarios set liberada_em = now(), status = 'enviado', sent_at = now(), atualizado_em = now() where id = s.id returning * into s;
  perform public._ci_aviso('pendente', c, s, p_antes, 'hub.aviso:assinatura:' || s.id || ':pendente');
  return true;
end $$;

create or replace function public._ci_assinaturas_criar(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype;
begin
  select * into c from contratos_instalador where id = p_id;
  if not found or c.status <> 'assinado' then return; end if;
  if exists (select 1 from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = p_id::text and status <> 'expirado') then return; end if;
  insert into documento_signatarios (documento_tipo, documento_id, papel, nome, email, ordem, token, status)
  values ('contrato_instalador', p_id::text, 'Contratante — CEO', 'Diego Maeno', 'diego@verticalparts.com.br', 1, replace(gen_random_uuid()::text, '-', ''), 'pendente'),
         ('contrato_instalador', p_id::text, 'Testemunha 1', 'Juliana', 'juliana@verticalparts.com.br', 2, replace(gen_random_uuid()::text, '-', ''), 'pendente'),
         ('contrato_instalador', p_id::text, 'Testemunha 2', 'Maurício', 'mauricio.araujo@verticalparts.com.br', 3, replace(gen_random_uuid()::text, '-', ''), 'pendente');
  update contratos_instalador set assinaturas_completas_em = null where id = p_id and assinaturas_completas_em is not null;
  perform public._ci_liberar_proxima(p_id, coalesce(nullif(c.audit->>'signerName', ''), c.contratada_nome));
end $$;

create or replace function public._ci_apos_assinatura(s documento_signatarios) returns void
language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype; ultima documento_signatarios%rowtype;
begin
  select * into c from contratos_instalador where id = s.documento_id::uuid;
  if not found then return; end if;
  if public._ci_liberar_proxima(c.id, s.nome) then return; end if;
  if exists (select 1 from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = s.documento_id and status not in ('assinado', 'expirado')) then return; end if;
  update contratos_instalador set assinaturas_completas_em = now() where id = c.id;
  select * into ultima from documento_signatarios where id = s.id;
  perform public._ci_aviso('concluida', c, ultima, s.nome, 'hub.aviso:assinatura:' || c.id || ':concluida');
end $$;

create or replace function public._ci_apos_recusa(s documento_signatarios, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype;
begin
  select * into c from contratos_instalador where id = s.documento_id::uuid;
  if not found then return; end if;
  perform public._ci_aviso('recusada', c, s, s.nome, 'hub.aviso:assinatura:' || s.id || ':recusada', p_motivo);
end $$;

revoke execute on function public._ci_obra(contratos_instalador), public._ci_dest_gestao(contratos_instalador),
  public._ci_aviso(text, contratos_instalador, documento_signatarios, text, text, text), public._ci_liberar_proxima(uuid, text),
  public._ci_assinaturas_criar(uuid), public._ci_apos_assinatura(documento_signatarios), public._ci_apos_recusa(documento_signatarios, text)
  from public, anon, authenticated;

-- ---------- gatilho: Contratado assinou -> nasce a fila ----------
create or replace function public.trg_ci_assinaturas_sequencia() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'assinado' and old.status is distinct from 'assinado' then
    begin perform public._ci_assinaturas_criar(new.id);
    exception when others then raise warning '[trg_ci_assinaturas_sequencia] %', sqlerrm; end;
  end if;
  return new;
end $$;
drop trigger if exists trg_ci_assinaturas_sequencia on public.contratos_instalador;
create trigger trg_ci_assinaturas_sequencia after update on public.contratos_instalador for each row execute function public.trg_ci_assinaturas_sequencia();

-- ---------- RPCs públicas (token) — só muda o ramo documento_signatarios ----------
create or replace function public.public_cvs_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s1 contrato_venda_signatarios%rowtype; s2 documento_signatarios%rowtype; c contratos_venda_equipamentos%rowtype; ci contratos_instalador%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into s1 from contrato_venda_signatarios where token = p_token;
  if found then
    select * into c from contratos_venda_equipamentos where id = s1.contrato_venda_id;
    return jsonb_build_object('origem', 'cvs', 'sig', to_jsonb(s1),
      'contrato', case when c.id is null then null else to_jsonb(c) - 'token' - 'log' - 'recipient' end);
  end if;
  select * into s2 from documento_signatarios where token = p_token;
  if found then
    if s2.documento_tipo = 'contrato_venda' then select * into c from contratos_venda_equipamentos where id = s2.documento_id; end if;
    if s2.documento_tipo = 'contrato_instalador' then select * into ci from contratos_instalador where id = s2.documento_id::uuid; end if;
    return jsonb_build_object('origem', 'doc', 'sig', to_jsonb(s2),
      'contrato', case when c.id is not null then to_jsonb(c) - 'token' - 'log' - 'recipient'
                       when ci.id is not null then to_jsonb(ci) - 'token' - 'log' - 'recipient' else null end);
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
    if s2.documento_tipo = 'contrato_instalador' and s2.liberada_em is null and s2.status = 'pendente' then
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
    if s2.documento_tipo = 'contrato_instalador' and s2.liberada_em is null and s2.status = 'pendente' then
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
    if s2.documento_tipo = 'contrato_instalador' and s2.liberada_em is null and s2.status = 'pendente' then
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
    return jsonb_build_object('ok', true, 'rec', to_jsonb(s2));
  end if;
  return jsonb_build_object('ok', false, 'erro', 'link_invalido');
end $$;

-- Fila de assinaturas do contrato (para o documento mostrar quem já assinou). Aceita o token do contrato OU de qualquer signatário da fila.
create or replace function public.public_ci_fila(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cid text;
begin
  if coalesce(length(p_token), 0) < 8 then return '[]'::jsonb; end if;
  select id::text into cid from contratos_instalador where token = p_token;
  if cid is null then select documento_id into cid from documento_signatarios where token = p_token and documento_tipo = 'contrato_instalador'; end if;
  if cid is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('ordem', ordem, 'papel', papel, 'nome', nome, 'status', status, 'liberada', liberada_em is not null, 'signed_at', signed_at,
            'audit', jsonb_strip_nulls(jsonb_build_object('signerName', audit->>'signerName', 'signedAt', audit->>'signedAt', 'signDevice', audit->>'signDevice',
              'signIp', audit->>'signIp', 'hash', audit->>'hash', 'signatureType', audit->>'signatureType',
              'signatureData', case when (audit->>'signatureData') like 'data:image/%' then audit->>'signatureData' else null end))) order by ordem)
     from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = cid and status <> 'expirado'), '[]'::jsonb);
end $$;
grant execute on function public.public_ci_fila(text) to anon, authenticated;

-- Reenviar o aviso da vez (painel do HUB). Chave nova a cada reenvio (a original ficaria descartada pela idempotência).
create or replace function public.ci_reenviar_aviso_vez(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype; s documento_signatarios%rowtype;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'sem_sessao'); end if;
  if not public.vp_tem_capacidade('contrato-instalador', 'editar') then return jsonb_build_object('ok', false, 'erro', 'sem_permissao'); end if;
  select * into c from contratos_instalador where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_encontrado'); end if;
  select * into s from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = p_id::text
     and liberada_em is not null and status in ('enviado', 'visualizado') order by ordem limit 1;
  if not found then return jsonb_build_object('ok', false, 'erro', 'ninguem_na_vez'); end if;
  perform public._ci_aviso('pendente', c, s, coalesce(nullif(c.audit->>'signerName', ''), c.contratada_nome),
    'hub.aviso:assinatura:' || s.id || ':pendente:r' || floor(extract(epoch from clock_timestamp()))::bigint);
  return jsonb_build_object('ok', true, 'para', s.nome);
end $$;
revoke execute on function public.ci_reenviar_aviso_vez(uuid) from public, anon;
grant execute on function public.ci_reenviar_aviso_vez(uuid) to authenticated, service_role;

-- ---------- anulação: a fila do contrato é cancelada ----------
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
  update contratos_instalador set status = 'expirado', signed_at = null, expires_at = v_now, assinaturas_completas_em = null,
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
  -- fila de assinaturas (Diego/Juliana/Maurício): cancelada; as assinaturas já dadas ficam no audit da própria linha
  update documento_signatarios set status = 'expirado', atualizado_em = v_now,
         audit = coalesce(audit, '{}'::jsonb) || jsonb_build_object('cancelada_por_anulacao_em', v_now)
   where documento_tipo = 'contrato_instalador' and documento_id = p_id::text and status <> 'expirado';
  return jsonb_build_object('ok', true, 'parcelas_removidas', v_parc);
end $$;
revoke execute on function public.anular_contrato_instalador(uuid, text, text) from public, anon;
grant execute on function public.anular_contrato_instalador(uuid, text, text) to authenticated, service_role;

-- ---------- contratos que já têm a assinatura do Contratado ----------
do $$
declare c record;
begin
  for c in select id from contratos_instalador where numero_documento in ('VPNI-DOS-M013', 'VPNI-DOS-M014') and status = 'assinado' loop
    perform public._ci_assinaturas_criar(c.id);
  end loop;
end $$;

notify pgrst, 'reload schema';
