-- Segurança real (#571) · Fase 3 / Task 10 — efeitos da assinatura da Proposta saem do navegador do cliente (05/10/2026).
-- Duas partes:
--  (1) NO BANCO, na mesma transação da ação do cliente: o aviso na Central de Notificações (`alertas`) e o registro de auditoria (`vp_logs`)
--      que antes eram gravados pelo navegador do cliente. (Os 2 avais já nasciam por trigger.)
--  (2) FILA `fluxo_pendentes`: a parte que depende do motor em JavaScript (eventos_fluxo + gatilhos com SLA em horas úteis, decisão do CEO,
--      dossiê, lead→cliente) NÃO foi reescrita em SQL (risco alto de divergir). A ação do cliente só ENFILEIRA; um usuário interno logado
--      (src/fluxo-pendentes.js) reivindica e roda o MESMO código de antes. A tabela fica sem política para anon/authenticated: só as RPCs abaixo.
-- Hoje as RPCs de fila ainda aceitam `anon` (o app interno usa a chave pública); a Fase 4 restringe a `vp_usuario_ativo()`.

create table if not exists public.fluxo_pendentes (
  id bigserial primary key,
  tipo text not null,                       -- proposta_assinada | proposta_recusada | proposta_revisao
  proposta_id uuid,
  numero_cotacao integer,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pendente' check (status in ('pendente','processando','concluido','falhou')),
  tentativas integer not null default 0,
  criado_em timestamptz not null default now(),
  reivindicado_em timestamptz,
  concluido_em timestamptz,
  erro text
);
create unique index if not exists fluxo_pendentes_assinada_uq on public.fluxo_pendentes (proposta_id) where tipo = 'proposta_assinada';
create index if not exists fluxo_pendentes_status_idx on public.fluxo_pendentes (status, id);
alter table public.fluxo_pendentes enable row level security;
revoke all on public.fluxo_pendentes from anon, authenticated;

-- ---------- efeitos de uma ação do cliente (alerta + auditoria + fila) ----------
create or replace function public._pp_efeitos(r propostas, ev text, meta jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare contra text; num text; ip text; quando text; lvl text; titulo text; sub text; acao text; ator text; tipo text; pay jsonb;
begin
  contra := coalesce(nullif(r.recipient->>'name', ''), nullif(r.data_json->'cliente'->>'nome', ''), 'Cliente');
  num := coalesce(r.numero_documento, '');
  ip := nullif(meta->>'ip', '');
  quando := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
  if ev = 'visualizada' then
    lvl := 'warning'; titulo := 'Proposta ' || num || ' foi VISUALIZADA';
    sub := 'Aberta por ' || coalesce(r.recipient->>'name', '') || ' · ' || case when ip is not null then 'IP ' || ip || ' · ' else '' end || quando;
    acao := 'cliente visualizou a proposta'; ator := contra;
  elsif ev = 'aprovada' then
    lvl := 'info'; titulo := 'Proposta ' || num || ' ASSINADA';
    sub := 'Por ' || coalesce(meta->>'signerName', '') || ' · ' || case when ip is not null then 'IP ' || ip else '' end;
    acao := 'proposta assinada'; ator := coalesce(nullif(meta->>'signerName', ''), contra);
    tipo := 'proposta_assinada';
    pay := jsonb_build_object('resposta', 'aprovada', 'signerName', meta->>'signerName', 'modalidadeEntrega', meta->>'modalidade');
  elsif ev = 'recusada' then
    lvl := 'danger'; titulo := 'Proposta ' || num || ' foi RECUSADA';
    sub := 'Recusada por ' || coalesce(nullif(meta->>'nome', ''), contra) || ' em ' || quando || case when coalesce(meta->>'motivo', '') <> '' then ' — Motivo: ' || (meta->>'motivo') else '' end;
    acao := 'assinatura da proposta recusada' || case when coalesce(meta->>'motivo', '') <> '' then ' — Motivo: ' || (meta->>'motivo') else '' end;
    ator := coalesce(nullif(meta->>'nome', ''), contra);
    tipo := 'proposta_recusada';
    pay := jsonb_build_object('resposta', 'recusada', 'nome', meta->>'nome', 'motivo', meta->>'motivo');
  elsif ev = 'revisao' then
    lvl := 'warning'; titulo := 'Proposta ' || num || ' — cliente pediu revisão';
    sub := left(coalesce(meta->>'texto', ''), 140);
    acao := 'cliente pediu revisão da proposta'; ator := contra;
    tipo := 'proposta_revisao';
    pay := jsonb_build_object('resposta', 'revisao_solicitada', 'texto', meta->>'texto');
  else
    return;
  end if;

  begin
    insert into alertas (id, level, title, sub, module, resolved, rota)
      values ('prop-' || gen_random_uuid()::text, lvl, titulo, sub, 'Comercial', false, '/comercial/proposta-editor/' || r.id::text);
    insert into vp_logs (ator_nome, ator_setor, modulo, acao, alvo, alvo_id)
      values (ator, 'externo', 'Proposta Comercial', acao, r.numero_documento, r.id::text);
  exception when others then
    raise warning '[_pp_efeitos] alerta/log falhou: %', sqlerrm;   -- aviso nunca derruba a ação do cliente
  end;

  if tipo is not null then
    begin
      insert into fluxo_pendentes (tipo, proposta_id, numero_cotacao, payload)
        values (tipo, r.id, r.numero_cotacao, pay || jsonb_build_object('titulo', coalesce(r.titulo, r.numero_documento)));
    exception when unique_violation then null;
    when others then raise warning '[_pp_efeitos] fila falhou: %', sqlerrm;
    end;
  end if;
end $$;
revoke execute on function public._pp_efeitos(propostas, text, jsonb) from public, anon, authenticated;

-- ---------- RPCs públicas atualizadas (mesmo corpo da Task 9 + efeitos) ----------
create or replace function public.public_proposta_visualizada(p_token text, p_audit jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r propostas%rowtype; ip text; ag jsonb;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into r from propostas where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if r.status <> 'enviada' then return jsonb_build_object('ok', true, 'rec', to_jsonb(r), 'mudou', false); end if;
  ip := public._pp_ip(p_audit->>'viewIp');
  ag := public._pp_audit_permitido(p_audit) || jsonb_build_object('viewedAt', now(), 'viewIp', ip);
  update propostas set status = 'visualizada', viewed_at = now(), atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || ag,
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'visualizada', 'at', now(), 'meta', jsonb_build_object('ip', ip, 'ua', p_audit->>'viewUa')))
   where id = r.id returning * into r;
  perform public._pp_efeitos(r, 'visualizada', jsonb_build_object('ip', ip));
  return jsonb_build_object('ok', true, 'rec', to_jsonb(r), 'mudou', true);
end $$;

create or replace function public.public_proposta_assinar(p_token text, p_audit jsonb, p_opcao text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r propostas%rowtype; vig jsonb; esc text; ip text; ag jsonb; novo_dj jsonb; novo_vp jsonb; tot numeric;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into r from propostas where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if r.status not in ('enviada', 'visualizada') then return jsonb_build_object('ok', false, 'erro', 'status_' || r.status); end if;
  if r.expires_at is not null and r.expires_at < now() then return jsonb_build_object('ok', false, 'erro', 'expirada'); end if;
  if coalesce(trim(p_audit->>'signerName'), '') = '' then return jsonb_build_object('ok', false, 'erro', 'nome_obrigatorio'); end if;

  vig := coalesce(r.versao_publicada, r.data_json, '{}'::jsonb);
  if public._pp_tem_opcoes(vig) and coalesce(p_opcao, '') not in ('120', '90') then
    return jsonb_build_object('ok', false, 'erro', 'escolha_obrigatoria');
  end if;
  esc := case when public._pp_tem_opcao90(vig) and p_opcao in ('120', '90') then p_opcao else null end;

  ip := public._pp_ip(p_audit->>'signIp');
  ag := public._pp_audit_permitido(p_audit)
        || jsonb_build_object('signedAt', now(), 'signIp', ip, 'consent', true)
        || case when esc is not null then jsonb_build_object('opcaoEntrega', esc) else '{}'::jsonb end;

  novo_dj := r.data_json; novo_vp := r.versao_publicada;
  if esc is not null then
    novo_dj := public._pp_aplicar_escolha(r.data_json, esc);
    if r.versao_publicada is not null then novo_vp := public._pp_aplicar_escolha(r.versao_publicada, esc); end if;
    if esc = '90' then
      tot := public._pp_total_oficial(coalesce(novo_dj, novo_vp, '{}'::jsonb));
    end if;
  end if;

  update propostas set status = 'aprovada', signed_at = now(), aprovada_em = now(), atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || ag,
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'aprovada', 'at', now(),
               'meta', jsonb_build_object('ip', ip, 'ua', p_audit->>'signUa', 'hash', p_audit->>'hash'))),
         data_json = novo_dj, versao_publicada = novo_vp,
         valor_total = case when tot is not null and tot > 0 then tot else valor_total end
   where id = r.id returning * into r;
  perform public._pp_efeitos(r, 'aprovada', jsonb_build_object('ip', ip, 'signerName', p_audit->>'signerName',
          'modalidade', case when esc is not null then esc || ' dias' else null end));
  return jsonb_build_object('ok', true, 'rec', to_jsonb(r));
end $$;

create or replace function public.public_proposta_recusar(p_token text, p_nome text, p_motivo text, p_audit jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r propostas%rowtype; ip text; ag jsonb; n text; m text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into r from propostas where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if r.status not in ('enviada', 'visualizada') then return jsonb_build_object('ok', false, 'erro', 'status_' || r.status); end if;
  n := nullif(left(trim(coalesce(p_nome, '')), 200), '');
  m := nullif(left(trim(coalesce(p_motivo, '')), 2000), '');
  ip := public._pp_ip(p_audit->>'refuseIp');
  ag := public._pp_audit_permitido(p_audit) || jsonb_build_object('refusedAt', now(), 'refusedBy', n, 'refusedReason', m, 'refuseIp', ip);
  update propostas set status = 'recusada', atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || ag,
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'recusada', 'at', now(), 'meta', jsonb_build_object('nome', n, 'motivo', m, 'ip', ip)))
   where id = r.id returning * into r;
  perform public._pp_efeitos(r, 'recusada', jsonb_build_object('ip', ip, 'nome', n, 'motivo', m));
  return jsonb_build_object('ok', true, 'rec', to_jsonb(r));
end $$;

create or replace function public.public_proposta_revisao(p_token text, p_texto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r propostas%rowtype; t text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  t := left(trim(coalesce(p_texto, '')), 4000);
  if t = '' then return jsonb_build_object('ok', false, 'erro', 'texto_obrigatorio'); end if;
  select * into r from propostas where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if r.status not in ('enviada', 'visualizada') then return jsonb_build_object('ok', false, 'erro', 'status_' || r.status); end if;
  update propostas set status = 'revisao_solicitada', revisao_texto = t, revisao_solicitada_em = now(), atualizado_em = now(),
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'revisao_solicitada', 'at', now(), 'meta', jsonb_build_object('texto', t)))
   where id = r.id returning * into r;
  perform public._pp_efeitos(r, 'revisao', jsonb_build_object('texto', t));
  return jsonb_build_object('ok', true, 'rec', to_jsonb(r));
end $$;

-- ---------- fila: reivindicar e concluir (hoje anon+authenticated; Fase 4 restringe a usuário ativo) ----------
create or replace function public.fluxo_pendentes_reivindicar(p_max integer default 5) returns setof jsonb
language plpgsql security definer set search_path = public as $$
begin
  return query
  with pegos as (
    select id from fluxo_pendentes
     where (status = 'pendente' or (status = 'processando' and reivindicado_em < now() - interval '5 minutes'))
       and tentativas < 5
     order by id limit greatest(1, least(coalesce(p_max, 5), 20)) for update skip locked
  ), upd as (
    update fluxo_pendentes f set status = 'processando', reivindicado_em = now(), tentativas = f.tentativas + 1
      from pegos where f.id = pegos.id returning f.*
  )
  select jsonb_build_object('id', id, 'tipo', tipo, 'proposta_id', proposta_id, 'numero_cotacao', numero_cotacao, 'payload', payload, 'tentativas', tentativas) from upd;
end $$;

create or replace function public.fluxo_pendentes_concluir(p_id bigint, p_erro text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update fluxo_pendentes set status = case when p_erro is null then 'concluido' else 'falhou' end,
         concluido_em = now(), erro = left(p_erro, 1000)
   where id = p_id and status = 'processando';
end $$;

revoke execute on function public.public_proposta_visualizada(text, jsonb), public.public_proposta_assinar(text, jsonb, text),
  public.public_proposta_recusar(text, text, text, jsonb), public.public_proposta_revisao(text, text),
  public.fluxo_pendentes_reivindicar(integer), public.fluxo_pendentes_concluir(bigint, text) from public;
grant execute on function public.public_proposta_visualizada(text, jsonb), public.public_proposta_assinar(text, jsonb, text),
  public.public_proposta_recusar(text, text, text, jsonb), public.public_proposta_revisao(text, text),
  public.fluxo_pendentes_reivindicar(integer), public.fluxo_pendentes_concluir(bigint, text) to anon, authenticated;
