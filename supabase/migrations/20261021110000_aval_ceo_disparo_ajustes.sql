-- 21/10/2026 — ajustes da revisão do PR #1017 (Codex):
--  1) Cotação com mais de um contrato de instalador: o aval aprovado do 1º contrato vale para o 2º (regra por cotação), mas o disparo
--     usava só o contrato citado na decisão — o 2º ficava em rascunho e a tela dizia "enviado". Agora o disparo recebe o contrato
--     pedido explicitamente e `ci_pedir_envio` só diz "enviado" se o contrato realmente saiu de rascunho.
--  2) Com as 3 assinaturas internas liberadas juntas, duas podiam assinar ao mesmo tempo e nenhuma enxergar a outra: o contrato
--     ficava sem `assinaturas_completas_em`. A conferência agora trava a linha do contrato antes de contar (a 2ª espera a 1ª).

create or replace function public._ci_verificar_completo(p_id uuid, p_ultimo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c contratos_instalador%rowtype; ultima documento_signatarios%rowtype;
begin
  select * into c from contratos_instalador where id = p_id for update;      -- serializa: quem chega depois vê a assinatura já confirmada da outra
  if not found or c.status <> 'assinado' or c.assinaturas_completas_em is not null then return; end if;
  if not exists (select 1 from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = p_id::text) then return; end if;
  if exists (select 1 from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = p_id::text and status not in ('assinado', 'expirado')) then return; end if;
  update contratos_instalador set assinaturas_completas_em = now() where id = p_id;
  select * into ultima from documento_signatarios where documento_tipo = 'contrato_instalador' and documento_id = p_id::text order by signed_at desc nulls last limit 1;
  perform public._ci_aviso('concluida', c, ultima, coalesce(p_ultimo, ultima.nome), 'hub.aviso:assinatura:' || p_id || ':concluida');
end $$;
revoke execute on function public._ci_verificar_completo(uuid, text) from public, anon, authenticated;

drop function if exists public._ci_disparar(decisoes_gerenciais);
create or replace function public._ci_disparar(d decisoes_gerenciais, p_contrato uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare cid text; c contratos_instalador%rowtype; s documento_signatarios%rowtype; link text; contato text; texto text; sol text;
begin
  cid := coalesce(p_contrato::text, d.contexto->>'contratoInstaladorId', case when d.referencia_tabela = 'contratos_instalador' then d.referencia_id end);
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
revoke execute on function public._ci_disparar(decisoes_gerenciais, uuid) from public, anon, authenticated;

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
    perform public._ci_disparar(d, c.id);                     -- o contrato PEDIDO (a aprovação pode ser a de outro contrato da mesma cotação)
    select * into c from contratos_instalador where id = p_id;
    if c.status = 'rascunho' then return jsonb_build_object('ok', false, 'erro', 'nao_enviou'); end if;
    return jsonb_build_object('ok', true, 'estado', 'enviado');
  end if;
  return jsonb_build_object('ok', true, 'estado', 'aguardando_aval');
end $$;
revoke execute on function public.ci_pedir_envio(uuid, text, text) from public, anon;
grant execute on function public.ci_pedir_envio(uuid, text, text) to authenticated, service_role;
