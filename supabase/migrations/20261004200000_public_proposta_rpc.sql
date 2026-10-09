-- Segurança real (#571) · Fase 3 / Task 9 — Proposta pública (/assinar/:token) fala por RPC, não por tabela (04/10/2026).
-- ADITIVA: só cria funções. O caminho antigo (update direto em `propostas` pelo navegador) continua funcionando até a Fase 4.
-- Cada RPC recebe o TOKEN do documento e só toca aquele registro. As regras de transição de status e a troca da modalidade
-- de entrega (120×90 dias) passam a ser decididas NO SERVIDOR; o IP e a hora da assinatura vêm do servidor (não do navegador).
-- A cascata pós-assinatura (dossiê, eventos, lead→cliente…) AINDA roda no navegador (é a Task 10) — não está aqui.

-- ---------- auxiliares (nunca chamáveis de fora) ----------
create or replace function public._pp_num(s text) returns numeric language plpgsql immutable as $$
begin
  return coalesce(nullif(regexp_replace(replace(replace(coalesce(s,'0'),'.',''),',','.'), '[^0-9.\-]', '', 'g'), '')::numeric, 0);
exception when others then return 0;
end $$;

create or replace function public._pp_ip(p_fallback text) returns text language plpgsql stable as $$
declare h json;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  return coalesce(nullif(trim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''), nullif(p_fallback, ''));
end $$;

-- Espelho de PropostaOpcoes.temOpcao90 / temOpcoes (elevador)
create or replace function public._pp_tem_opcao90(d jsonb) returns boolean language sql immutable as $$
  select coalesce(public._pp_num(d->'elevador'->'valores'->'opcao90'->>'valorUnit') > 0, false)
$$;
create or replace function public._pp_tem_opcoes(d jsonb) returns boolean language sql immutable as $$
  select public._pp_tem_opcao90(d) and coalesce(d->'elevador'->'valores'->>'escolhaEntrega', '') = ''
$$;

-- Espelho de PropostaOpcoes.aplicarEscolha(d, escolha) (chave 'elevador'); idempotente
create or replace function public._pp_aplicar_escolha(d jsonb, escolha text) returns jsonb language plpgsql immutable as $$
declare v jsonb; o jsonb;
begin
  if d is null or d->'elevador' is null or not public._pp_tem_opcao90(d) then return d; end if;
  if escolha not in ('120', '90') then return d; end if;
  v := coalesce(d->'elevador'->'valores', '{}'::jsonb);
  if coalesce(v->>'escolhaEntrega', '') <> '' then return d; end if;
  v := v || jsonb_build_object('escolhaEntrega', escolha);
  if escolha = '90' then
    o := v->'opcao90';
    v := v || jsonb_build_object('valorUnit', o->'valorUnit', 'difal', o->'difal', 'formaTipo', o->'formaTipo',
                                 'qtdParcelas', o->'qtdParcelas', 'forma', o->'forma', 'parcelas', o->'parcelas');
  end if;
  return jsonb_set(d, '{elevador,valores}', v);
end $$;

-- Espelho de PropostaOpcoes.totalOficial(d) (equipamentos, sem DIFAL)
create or replace function public._pp_total_oficial(d jsonb) returns numeric language plpgsql immutable as $$
declare v jsonb; t numeric;
begin
  v := coalesce(d->'elevador'->'valores', '{}'::jsonb);
  if jsonb_typeof(v->'itens') = 'array' and jsonb_array_length(v->'itens') > 0 then
    select coalesce(sum(public._pp_num(it->>'valorUnit') * coalesce(nullif(public._pp_num(it->>'quantidade'), 0), 1)), 0) into t
      from jsonb_array_elements(v->'itens') it;
    return t;
  end if;
  return public._pp_num(v->>'valorUnit') * coalesce(nullif(public._pp_num(v->>'quantidade'), 0), 1);
end $$;

-- só chaves conhecidas entram na auditoria vinda do navegador (nunca status/valores)
create or replace function public._pp_audit_permitido(p jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each(coalesce(p, '{}'::jsonb)) as t(k, v)
   where k in ('viewUa','viewDevice','signUa','signDevice','signerName','signatureType','signatureData','hash',
               'versaoAssinada','assinouRascunho','refuseUa','refuseDevice')
     and length(v::text) < 600000
$$;

revoke execute on function public._pp_num(text), public._pp_ip(text), public._pp_tem_opcao90(jsonb), public._pp_tem_opcoes(jsonb),
  public._pp_aplicar_escolha(jsonb, text), public._pp_total_oficial(jsonb), public._pp_audit_permitido(jsonb)
  from public, anon, authenticated;

-- ---------- RPCs públicas ----------
create or replace function public.public_proposta_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r propostas%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into r from propostas where token = p_token;
  if not found then return null; end if;
  return to_jsonb(r);
end $$;

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
  return jsonb_build_object('ok', true, 'rec', to_jsonb(r));
end $$;

revoke execute on function public.public_proposta_obter(text), public.public_proposta_visualizada(text, jsonb),
  public.public_proposta_assinar(text, jsonb, text), public.public_proposta_recusar(text, text, text, jsonb),
  public.public_proposta_revisao(text, text) from public;
grant execute on function public.public_proposta_obter(text), public.public_proposta_visualizada(text, jsonb),
  public.public_proposta_assinar(text, jsonb, text), public.public_proposta_recusar(text, text, text, jsonb),
  public.public_proposta_revisao(text, text) to anon, authenticated;
