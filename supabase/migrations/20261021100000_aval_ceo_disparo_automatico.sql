-- 21/10/2026 (Gelson) — Contrato Instalador: o envio só acontece DEPOIS do SIM do Diego e é automático.
--
-- Fluxo novo: "Enviar" = pedir o aval (grava o WhatsApp do montador no contrato; contrato continua em rascunho). Quando a decisão
-- `contratacao_mao_obra_ceo` vira APROVADA (pelo WhatsApp ou pela Central de Decisões) um gatilho no banco:
--   1) marca o contrato como enviado (WhatsApp, validade de 7 dias);
--   2) cria as 3 assinaturas internas (Diego, Juliana, Maurício) TODAS liberadas ao mesmo tempo (a ordem deixou de existir)
--      e enfileira o aviso de cada uma (canal que já entrega: hub.aviso_fluxo -> gi-avisos -> WhatsApp);
--   3) avisa quem pediu com o link do montador (o montador é externo e ainda não tem destinatário automático).
-- Reprovada (NÃO): nada é enviado; o Maurício é avisado. Em ambos os casos o Maurício recebe o resultado.
-- Trava no SERVIDOR: um contrato em rascunho não pode ser assinado enquanto não houver aval aprovado (mesmo com o link na mão).
-- O contrato só fica COMPLETO quando o montador e as 3 assinaturas internas existem, em qualquer ordem.

-- ---------- aval aprovado para este contrato? ----------
create or replace function public._ci_aval_aprovado(c contratos_instalador) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from decisoes_gerenciais d
     where d.tipo = 'contratacao_mao_obra_ceo' and d.status = 'aprovada'
       and (coalesce(d.contexto->>'contratoInstaladorId', case when d.referencia_tabela = 'contratos_instalador' then d.referencia_id end) = c.id::text
            or (d.numero_cotacao is not null and d.numero_cotacao::text = nullif(c.form_state->>'numeroCotacao', '')))
  )
$$;
revoke execute on function public._ci_aval_aprovado(contratos_instalador) from public, anon, authenticated;

-- ---------- TRAVA: assinar/visualizar um rascunho exige aval aprovado ----------
create or replace function public.public_ci_assinar(p_token text, p_audit jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c contratos_instalador%rowtype; ip text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into c from contratos_instalador where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  perform public._ci_expirar_se_vencido(c.id);
  select * into c from contratos_instalador where id = c.id for update;
  if c.status = 'assinado' then return jsonb_build_object('ok', true, 'rec', to_jsonb(c), 'jaAssinado', true); end if;
  if c.status not in ('enviado', 'visualizado', 'rascunho') then return jsonb_build_object('ok', false, 'erro', 'status_' || c.status); end if;
  if c.status = 'rascunho' and not public._ci_aval_aprovado(c) then return jsonb_build_object('ok', false, 'erro', 'aguardando_aval'); end if;
  if coalesce(trim(p_audit->>'signerName'), '') = '' then return jsonb_build_object('ok', false, 'erro', 'nome_obrigatorio'); end if;
  ip := public._pp_ip(p_audit->>'signIp');
  update contratos_instalador set status = 'assinado', signed_at = now(), atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('signedAt', now(), 'signIp', ip, 'consent', true),
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'assinado', 'at', now(), 'meta', jsonb_build_object('ip', ip, 'ua', p_audit->>'signUa', 'hash', p_audit->>'hash')))
   where id = c.id returning * into c;
  perform public._ci_efeitos(c, 'assinado', jsonb_build_object('ip', ip, 'signerName', p_audit->>'signerName'));
  return jsonb_build_object('ok', true, 'rec', to_jsonb(c));
end $$;

create or replace function public.public_ci_visualizado(p_token text, p_audit jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c contratos_instalador%rowtype; ip text;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into c from contratos_instalador where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  if c.status not in ('enviado', 'rascunho') then return jsonb_build_object('ok', true, 'rec', to_jsonb(c), 'mudou', false); end if;
  if c.status = 'rascunho' and not public._ci_aval_aprovado(c) then return jsonb_build_object('ok', true, 'rec', to_jsonb(c), 'mudou', false); end if;
  ip := public._pp_ip(p_audit->>'viewIp');
  update contratos_instalador set status = 'visualizado', viewed_at = now(), atualizado_em = now(),
         audit = coalesce(audit, '{}'::jsonb) || public._pp_audit_permitido(p_audit) || jsonb_build_object('viewedAt', now(), 'viewIp', ip),
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'visualizado', 'at', now(), 'meta', jsonb_build_object('ip', ip, 'ua', p_audit->>'viewUa')))
   where id = c.id returning * into c;
  perform public._ci_efeitos(c, 'visualizado', jsonb_build_object('ip', ip));
  return jsonb_build_object('ok', true, 'rec', to_jsonb(c), 'mudou', true);
end $$;

-- ---------- o aviso do aval agora sai pelo canal que entrega (alertas -> gi-avisos -> WhatsApp) ----------
create or replace function public.decisoes_alertar_aprovadores() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_email text; v_titulo text; v_alvo text;
begin
  begin
    if new.status <> 'pendente' then
      if tg_op = 'UPDATE' and old.status = 'pendente' then
        update public.alertas set resolved = true where starts_with(id, 'dec_nova_' || new.id::text) and not resolved;
      end if;
      return new;
    end if;
    if tg_op = 'UPDATE' and old.status = 'pendente' then return new; end if;
    -- aval de contratação de montador: o aviso (com a pergunta SIM/NÃO) é montado por _aval_enfileirar_pendente
    if new.tipo = 'contratacao_mao_obra_ceo' then return new; end if;
    v_titulo := case new.tipo
      when 'envio_proposta_gestor' then 'Envio de proposta — aprovação do Gestor Comercial'
      when 'envio_proposta_ceo' then 'Envio de proposta — aprovação do CEO'
      when 'montador_entra_obra_rh' then 'Montador entra na obra — aprovação do Supervisor de Obra'
      when 'compra_equipamento_ceo' then 'Compra do equipamento — aprovação do CEO'
      when 'compra_varejo_logistica' then 'Compra de varejo — aprovação da Logística'
      when 'desconto_proposta' then 'Desconto em proposta'
      when 'pagamento_instalador_parcela' then 'Pagamento a instalador — aprovação do Gestor Comercial'
      else new.tipo end;
    v_alvo := coalesce(new.contexto->>'cliente', new.contexto->>'titulo', new.contexto->>'item', new.contexto->>'obra',
                       case when new.numero_cotacao is not null then 'Cotação Nº ' || new.numero_cotacao end, '');
    foreach v_email in array coalesce(new.aprovadores_esperados, '{}') loop
      insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
      values ('dec_nova_' || new.id::text || '_' || lower(v_email), 'warning', 'Decisão aguardando você',
              left(v_titulo || case when v_alvo <> '' then ' · ' || v_alvo else '' end, 480),
              'Central de Decisões', false, lower(v_email), '/geral/decisoes')
      on conflict (id) do update set resolved = false, created_at = now(), sub = excluded.sub;
    end loop;
  exception when others then null;
  end;
  return new;
end $$;

create or replace function public._aval_enfileirar_pendente(d decisoes_gerenciais, p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare i jsonb; ap record; msg text; idalerta text;
begin
  i := _aval_info(d);
  select * into ap from decisao_whatsapp_numeros where papel = 'aprovador' and ativo order by email limit 1;
  msg := 'Diego, a obra ' || coalesce(i->>'obra', 'obra') || ' precisa do seu aval para a contratação do montador '
      || coalesce(i->>'instalador', '—') || ' (contrato ' || coalesce(i->>'contrato', '—') || '), valor ' || coalesce(i->>'valor_fmt', '—')
      || '. Você autoriza? Responda SIM ou NÃO'
      || case when i->>'codigo' is not null then ' (se houver mais de um aval aberto, acrescente o código: SIM ' || (i->>'codigo') || ').' else '.' end;
  idalerta := 'dec_nova_' || d.id::text || '_' || lower(coalesce(ap.email, 'diego@verticalparts.com.br'))
              || case when p_key like '%:reenvio:%' then '_r' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint else '' end;
  insert into alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
  values (idalerta, 'warning', 'Aval do CEO — contratação de montador', left(msg, 900), 'Central de Decisões', false,
          lower(coalesce(ap.email, 'diego@verticalparts.com.br')), '/geral/decisoes')
  on conflict (id) do update set resolved = false, created_at = now(), sub = excluded.sub;
exception when others then null;
end $$;
revoke execute on function public._aval_enfileirar_pendente(decisoes_gerenciais, text) from public, anon, authenticated;

-- ---------- completar: montador + as 3 internas, em qualquer ordem ----------
create or replace function public._ci_verificar_completo(p_id uuid, p_ultimo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype; ultima documento_signatarios%rowtype;
begin
  select * into c from contratos_instalador where id = p_id;
  if not found or c.status <> 'assinado' or c.assinaturas_completas_em is not null then return; end if;
  if not exists (select 1 from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = p_id::text) then return; end if;
  if exists (select 1 from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = p_id::text and status not in ('assinado', 'expirado')) then return; end if;
  update contratos_instalador set assinaturas_completas_em = now() where id = p_id;
  select * into ultima from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = p_id::text order by signed_at desc nulls last limit 1;
  perform public._ci_aviso('concluida', c, ultima, coalesce(p_ultimo, ultima.nome), 'hub.aviso:assinatura:' || p_id || ':concluida');
end $$;
revoke execute on function public._ci_verificar_completo(uuid, text) from public, anon, authenticated;

create or replace function public._ci_apos_assinatura(s documento_signatarios) returns void
language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype;
begin
  select * into c from contratos_instalador where id = s.documento_id::uuid;
  if not found then return; end if;
  if public._ci_liberar_proxima(c.id, s.nome) then return; end if;
  perform public._ci_verificar_completo(c.id, s.nome);
end $$;
revoke execute on function public._ci_apos_assinatura(documento_signatarios) from public, anon, authenticated;

create or replace function public.trg_ci_assinaturas_sequencia() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'assinado' and old.status is distinct from 'assinado' then
    begin
      perform public._ci_assinaturas_criar(new.id);      -- contrato antigo (sem fila): cria a fila em sequência, como antes
      perform public._ci_verificar_completo(new.id);      -- contrato novo: o montador pode ter sido o último a assinar
    exception when others then raise warning '[trg_ci_assinaturas_sequencia] %', sqlerrm; end;
  end if;
  return new;
end $$;

-- ---------- o disparo (depois do SIM) ----------
create or replace function public._ci_disparar(d decisoes_gerenciais) returns void
language plpgsql security definer set search_path = public as $$
declare cid text; c contratos_instalador%rowtype; s documento_signatarios%rowtype; link text; contato text; texto text; sol text;
begin
  cid := coalesce(d.contexto->>'contratoInstaladorId', case when d.referencia_tabela = 'contratos_instalador' then d.referencia_id end);
  if cid is null then return; end if;
  select * into c from contratos_instalador where id::text = cid for update;
  if not found or c.status <> 'rascunho' then return; end if;

  update contratos_instalador set status = 'enviado', channel = 'whatsapp', sent_at = now(), expires_at = now() + interval '7 days', atualizado_em = now(),
         log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'enviado', 'at', now(), 'meta', jsonb_build_object('channel', 'whatsapp', 'origem', 'aval_ceo')))
   where id = c.id returning * into c;

  if not exists (select 1 from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = c.id::text and status <> 'expirado') then
    insert into documento_signatarios (documento_tipo, documento_id, papel, nome, email, ordem, token, status, liberada_em, sent_at)
    values ('contrato_instalador', c.id::text, 'Contratante — CEO', 'Diego Maeno', 'diego@verticalparts.com.br', 1, replace(gen_random_uuid()::text, '-', ''), 'enviado', now(), now()),
           ('contrato_instalador', c.id::text, 'Testemunha 1', 'Juliana', 'juliana@verticalparts.com.br', 2, replace(gen_random_uuid()::text, '-', ''), 'enviado', now(), now()),
           ('contrato_instalador', c.id::text, 'Testemunha 2', 'Maurício', 'mauricio.araujo@verticalparts.com.br', 3, replace(gen_random_uuid()::text, '-', ''), 'enviado', now(), now());
    update contratos_instalador set assinaturas_completas_em = null where id = c.id and assinaturas_completas_em is not null;
  end if;

  for s in select * from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = c.id::text and status = 'enviado' order by ordem loop
    perform public._ci_aviso('pendente', c, s, null, 'hub.aviso:assinatura:' || s.id || ':pendente');
  end loop;

  -- o montador (externo) ainda não tem destinatário automático: quem pediu recebe o link pronto para encaminhar
  sol := lower(nullif(trim(d.solicitado_por), ''));
  link := 'https://hub.vpsistema.com/assinar/' || c.token;
  contato := nullif(trim(coalesce(c.recipient->>'contact', '')), '');
  texto := 'Aval aprovado pelo Diego — contrato ' || coalesce(c.numero_documento, '—') || '. Os links do Diego, da Juliana e do Maurício já foram enviados. '
        || 'Envie ao montador ' || coalesce(nullif(c.recipient->>'name', ''), c.responsavel_nome, c.contratada_nome, '—')
        || coalesce(' (WhatsApp ' || contato || ')', '') || ': ' || link;
  begin
    insert into alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
    values ('ci-envio-' || c.id || '-' || to_char(now(), 'YYYYMMDDHH24MISS'), 'warning', 'Enviar o contrato ao montador', left(texto, 900), 'Jurídico', false, sol, '/juridico/contrato-instalador');
  exception when others then null; end;
  begin
    insert into vp_logs (modulo, acao, alvo, alvo_id, detalhe)
    values ('Contrato Instalador', 'Aval aprovado — contrato enviado às assinaturas internas', c.numero_documento, c.id::text, jsonb_build_object('decisao', d.id));
  exception when others then null; end;
end $$;
revoke execute on function public._ci_disparar(decisoes_gerenciais) from public, anon, authenticated;

-- gatilho: resultado do aval (SIM ou NÃO, de qualquer canal)
create or replace function public.trg_aval_resultado() returns trigger language plpgsql security definer set search_path = public as $$
declare i jsonb; ciente record; txt text;
begin
  if new.tipo <> 'contratacao_mao_obra_ceo' or old.status is distinct from 'pendente' or new.status not in ('aprovada', 'reprovada') then return new; end if;
  begin
    i := _aval_info(new);
    select * into ciente from decisao_whatsapp_numeros where papel = 'ciente' and ativo order by email limit 1;
    txt := case when new.status = 'aprovada'
        then 'O Diego APROVOU o aval da contratação do montador ' || coalesce(i->>'instalador', '—') || ' (contrato ' || coalesce(i->>'contrato', '—') || ', obra ' || coalesce(i->>'obra', '—') || ', ' || coalesce(i->>'valor_fmt', '') || '). Os links de assinatura saem automaticamente.'
        else 'O Diego RECUSOU o aval da contratação do montador ' || coalesce(i->>'instalador', '—') || ' (contrato ' || coalesce(i->>'contrato', '—') || ', obra ' || coalesce(i->>'obra', '—') || ', ' || coalesce(i->>'valor_fmt', '') || '). Nada foi enviado. Fale com o Diego sobre o assunto; o aval pode ser reenviado.' end;
    insert into alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
    values ('aval-ciente-' || new.id || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
            case when new.status = 'aprovada' then 'info' else 'warning' end,
            case when new.status = 'aprovada' then 'Diego aprovou o aval do montador' else 'Diego recusou o aval do montador' end,
            left(txt, 900), 'Central de Decisões', false, lower(coalesce(ciente.email, 'mauricio.araujo@verticalparts.com.br')), '/geral/decisoes');
  exception when others then null; end;
  if new.status = 'aprovada' then
    begin perform public._ci_disparar(new);
    exception when others then raise warning '[trg_aval_resultado] disparo falhou: %', sqlerrm; end;
  end if;
  return new;
end $$;
drop trigger if exists trg_aval_resultado on public.decisoes_gerenciais;
create trigger trg_aval_resultado after update of status on public.decisoes_gerenciais for each row execute function public.trg_aval_resultado();

-- ---------- chamadas da tela (usuário logado) ----------
-- grava o WhatsApp do montador no rascunho (sem marcar como enviado) e, se o aval já estava aprovado, dispara na hora
create or replace function public.ci_pedir_envio(p_id uuid, p_nome text, p_contato text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype; d decisoes_gerenciais%rowtype; digitos text := regexp_replace(coalesce(p_contato, ''), '\D', '', 'g');
begin
  if not vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'sem_sessao'); end if;
  if length(digitos) < 10 then return jsonb_build_object('ok', false, 'erro', 'contato_invalido'); end if;
  select * into c from contratos_instalador where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_encontrado'); end if;
  if c.status <> 'rascunho' then return jsonb_build_object('ok', false, 'erro', 'status_' || c.status); end if;
  update contratos_instalador set channel = 'whatsapp', recipient = jsonb_build_object('name', coalesce(nullif(trim(p_nome), ''), c.responsavel_nome), 'contact', p_contato), atualizado_em = now()
   where id = p_id returning * into c;
  if public._ci_aval_aprovado(c) then
    select * into d from decisoes_gerenciais x
     where x.tipo = 'contratacao_mao_obra_ceo' and x.status = 'aprovada'
       and (coalesce(x.contexto->>'contratoInstaladorId', case when x.referencia_tabela = 'contratos_instalador' then x.referencia_id end) = c.id::text
            or (x.numero_cotacao is not null and x.numero_cotacao::text = nullif(c.form_state->>'numeroCotacao', ''))) order by x.decidido_em desc nulls last limit 1;
    perform public._ci_disparar(d);
    return jsonb_build_object('ok', true, 'estado', 'enviado');
  end if;
  return jsonb_build_object('ok', true, 'estado', 'aguardando_aval');
end $$;
revoke execute on function public.ci_pedir_envio(uuid, text, text) from public, anon;
grant execute on function public.ci_pedir_envio(uuid, text, text) to authenticated, service_role;

-- ---------- resposta do Diego pelo WhatsApp: o aviso ao Maurício e o disparo agora vêm do gatilho trg_aval_resultado ----------
create or replace function public.decisao_whatsapp_responder(p_telefone text, p_texto text, p_ref text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  tel text := right(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 11);
  ap decisao_whatsapp_numeros%rowtype;
  t text; primeira text; resto text; novo text; filtro text; exige_ref boolean;
  pend jsonb := '[]'::jsonb; n int; d decisoes_gerenciais%rowtype; ult decisoes_gerenciais%rowtype; i jsonb;
  r record; dd decisoes_gerenciais%rowtype; achou boolean; msgm text; ref text;
begin
  if length(tel) < 10 then return jsonb_build_object('ok', false, 'erro', 'numero_desconhecido'); end if;
  select * into ap from decisao_whatsapp_numeros
   where papel = 'aprovador' and ativo and right(regexp_replace(telefone, '\D', '', 'g'), 11) = tel limit 1;
  if not found then return jsonb_build_object('ok', false, 'erro', 'numero_desconhecido'); end if;

  t := lower(public.inbox_sem_acento(coalesce(p_texto, '')));
  t := trim(regexp_replace(regexp_replace(t, '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g'));
  primeira := split_part(t, ' ', 1);
  resto := trim(substr(t, length(primeira) + 1));
  novo := case
    when primeira in ('sim', 's', 'ok', 'autorizo', 'autorizado', 'aprovo', 'aprovado', 'pode', 'liberado', 'libero') then 'aprovada'
    when primeira in ('nao', 'n', 'recuso', 'recusado', 'negado', 'reprovo', 'reprovado') then 'reprovada'
    else null end;
  if novo is null then
    return jsonb_build_object('ok', false, 'erro', 'resposta_invalida', 'resposta', 'Não entendi. Responda apenas SIM ou NÃO.');
  end if;

  -- ignora aval de contrato que já não precisa dele (já assinado/recusado/expirado): é decisão velha e só atrapalharia o "qual contrato?"
  for dd in select x.* from decisoes_gerenciais x
             where x.tipo = 'contratacao_mao_obra_ceo' and x.status = 'pendente'
               and not exists (select 1 from contratos_instalador c
                                where c.id::text = coalesce(x.contexto->>'contratoInstaladorId', case when x.referencia_tabela = 'contratos_instalador' then x.referencia_id end)
                                  and c.status in ('assinado', 'recusado', 'expirado'))
             order by x.criado_em loop
    pend := pend || jsonb_build_array(jsonb_build_object('id', dd.id, 'info', _aval_info(dd)));
  end loop;
  n := jsonb_array_length(pend);
  if n = 0 then
    return jsonb_build_object('ok', false, 'erro', 'nada_pendente', 'resposta', 'Não há nenhum aval aguardando sua resposta no momento.');
  end if;

  ref := lower(public.inbox_sem_acento(coalesce(nullif(trim(p_ref), ''), resto, '')));
  ref := trim(regexp_replace(ref, '[^a-z0-9]+', ' ', 'g'));
  filtro := ref;
  -- referência explícita (mensagem_ref) ou algo que parece código de contrato ("M009", "0955"): precisa bater, mesmo com um aval só
  exige_ref := nullif(trim(coalesce(p_ref, '')), '') is not null or ref ~ '(^| )[a-z]{0,3}[0-9]{2,}( |$)';

  if n > 1 and filtro <> '' then
    achou := false;
    for r in select (e->>'id')::uuid as id, e->'info' as info from jsonb_array_elements(pend) e loop
      if public._aval_ref_confere(r.info, r.id, filtro) then
        select * into d from decisoes_gerenciais where id = r.id; achou := true; exit;
      end if;
    end loop;
    if not achou then n := 2; end if;
    if achou then n := 1; end if;
  elsif n = 1 then
    select * into d from decisoes_gerenciais where id = ((pend->0)->>'id')::uuid;
    if exige_ref and not public._aval_ref_confere((pend->0)->'info', d.id, filtro) then
      return jsonb_build_object('ok', false, 'erro', 'codigo_nao_confere',
        'resposta', 'Não há aval aberto para "' || upper(filtro) || '". O aval aguardando agora é o ' || coalesce((pend->0->'info')->>'codigo', (pend->0->'info')->>'contrato', '—')
          || ' (' || coalesce((pend->0->'info')->>'obra', 'obra') || ', ' || coalesce((pend->0->'info')->>'valor_fmt', '') || '). Responda '
          || case novo when 'aprovada' then 'SIM ' else 'NÃO ' end || coalesce((pend->0->'info')->>'codigo', '') || ' se for esse.');
    end if;
  end if;

  if n > 1 or d.id is null then
    msgm := 'Há ' || jsonb_array_length(pend) || ' avais aguardando. Responda com o código: ';
    for r in select e->'info' as info from jsonb_array_elements(pend) e loop
      msgm := msgm || E'\n• ' || coalesce(r.info->>'codigo', r.info->>'contrato', '—') || ' — ' || coalesce(r.info->>'obra', 'obra') || ', ' || coalesce(r.info->>'valor_fmt', '');
    end loop;
    msgm := msgm || E'\nEx.: SIM ' || coalesce((pend->0->'info')->>'codigo', 'M001') || ' ou NÃO ' || coalesce((pend->0->'info')->>'codigo', 'M001');
    return jsonb_build_object('ok', false, 'erro', 'ambiguo', 'resposta', msgm, 'pendentes', pend);
  end if;

  update decisoes_gerenciais set status = novo, decidido_por = ap.email, decidido_em = now(), atualizado_em = now(),
         motivo = case when novo = 'aprovada' then 'Aprovado por WhatsApp (resposta SIM)' else 'Recusado por WhatsApp (resposta NÃO)' end
   where id = d.id and status = 'pendente' returning * into ult;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'ja_decidida', 'resposta', 'Esse aval já foi decidido por outra via.');
  end if;
  i := _aval_info(ult);

  begin
    insert into vp_logs (modulo, acao, alvo, alvo_id, detalhe, ator_nome)
    values ('Central de Decisões', case when novo = 'aprovada' then 'Aprovou por WhatsApp — Contratação de mão de obra (CEO)' else 'Recusou por WhatsApp — Contratação de mão de obra (CEO)' end,
            coalesce(i->>'contrato', d.id::text), d.id::text, jsonb_build_object('canal', 'whatsapp', 'resposta', left(coalesce(p_texto, ''), 80)), ap.nome);
  exception when others then null; end;

  begin
    insert into alertas (id, level, title, sub, module, destinatario_email, rota)
    values ('aval-resp-' || d.id || '-' || to_char(now(), 'YYYYMMDDHH24MISS'),
            case when novo = 'aprovada' then 'info' else 'warning' end,
            case when novo = 'aprovada' then 'Aval do CEO aprovado' else 'Aval do CEO recusado' end,
            'Contrato ' || coalesce(i->>'contrato', '—') || ' · ' || coalesce(i->>'obra', 'obra') || ' · ' || coalesce(i->>'valor_fmt', '') ||
              case when novo = 'aprovada' then ' — pode enviar ao montador.' else ' — fale com o Diego.' end,
            'Decisões', d.solicitado_por, '/geral/decisoes');
  exception when others then null; end;


  return jsonb_build_object('ok', true, 'resultado', novo, 'decisao_id', d.id, 'contrato', i->>'contrato',
    'resposta', case when novo = 'aprovada'
        then '✅ Aval registrado: contratação do montador ' || coalesce(i->>'instalador', '—') || ' (' || coalesce(i->>'contrato', '—') || ') APROVADA. O contrato já pode ser enviado.'
        else '❌ Aval registrado: contratação do montador ' || coalesce(i->>'instalador', '—') || ' (' || coalesce(i->>'contrato', '—') || ') RECUSADA. O Maurício foi avisado.' end);
end $$;
revoke execute on function public.decisao_whatsapp_responder(text, text, text) from public, anon, authenticated;
grant execute on function public.decisao_whatsapp_responder(text, text, text) to service_role;
