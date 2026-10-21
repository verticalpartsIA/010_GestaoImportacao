-- 20/10/2026 (Gelson) — Aval do CEO (contratação de montador) por WhatsApp: o Diego responde SIM ou NÃO e a decisão anda.
--
-- Fluxo:
--  1) Nasce a decisão `contratacao_mao_obra_ceo` -> o evento `instalador.aval_pendente` já ia para a Central de Eventos; agora o
--     payload leva a mensagem pronta (`mensagem`), os destinatários (Diego) e o código curto do contrato (`codigo`).
--  2) O Diego responde SIM/NÃO no WhatsApp -> a Central (vpsistema) chama a Edge Function `decisao-resposta-whatsapp`, que chama
--     `decisao_whatsapp_responder()` (só service_role). Só o número cadastrado como aprovador vale.
--  3) SIM: decisão aprovada, quem pediu é avisado. NÃO: decisão reprovada; o Maurício recebe o aviso (evento
--     `instalador.aval_respondido`) para falar com o Diego. Em ambos os casos o Maurício é avisado do resultado.
--  4) `decisao_aval_reenviar()` reenvia a mensagem (e, se a decisão foi reprovada, reabre para o Diego poder dar o SIM depois).
-- Falha ao enfileirar aviso nunca impede a decisão (exception when others).

-- ---------- números de WhatsApp (só o servidor lê) ----------
create table if not exists public.decisao_whatsapp_numeros (
  email text primary key,
  nome text not null,
  telefone text not null,                         -- DDI+DDD+número, só dígitos
  papel text not null check (papel in ('aprovador', 'ciente')),
  ativo boolean not null default true
);
alter table public.decisao_whatsapp_numeros enable row level security;
revoke all on public.decisao_whatsapp_numeros from anon, authenticated;     -- sem política: só service_role

insert into public.decisao_whatsapp_numeros (email, nome, telefone, papel) values
  ('diego@verticalparts.com.br',            'Diego Maeno',     '5511994621946', 'aprovador'),
  ('mauricio.araujo@verticalparts.com.br',  'Maurício Araujo', '5511916220666', 'ciente')
on conflict (email) do update set nome = excluded.nome, telefone = excluded.telefone, papel = excluded.papel, ativo = true;

-- ---------- dados do contrato de uma decisão ----------
create or replace function public._aval_info(d decisoes_gerenciais) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cid text; c contratos_instalador%rowtype; qtd int; obra text; valor numeric; cod text;
begin
  cid := coalesce(d.contexto->>'contratoInstaladorId', case when d.referencia_tabela = 'contratos_instalador' then d.referencia_id end);
  if cid is not null then select * into c from contratos_instalador where id::text = cid; end if;
  qtd := greatest(coalesce(array_length(c.dossier_ids, 1), 0),
                  coalesce(jsonb_array_length(c.form_state->'equipamentosManuais'), 0) + coalesce(jsonb_array_length(c.ativos_indices), 0), 1);
  obra := coalesce(nullif(c.form_state->>'clienteObraNome', ''), nullif(c.form_state->>'localServico', ''), c.titulo, 'obra');
  valor := coalesce(c.valor_total, nullif(d.contexto->>'valor', '')::numeric);
  cod := regexp_replace(coalesce(c.numero_documento, ''), '^.*-', '');
  return jsonb_build_object('obra', obra, 'quantidade_elevadores', qtd, 'valor', valor, 'valor_fmt', _evt_brl(valor),
    'instalador', coalesce(c.contratada_nome, d.contexto->>'contratada'), 'contrato', c.numero_documento, 'codigo', nullif(cod, ''),
    'cotacao', d.numero_cotacao);
end $$;
revoke execute on function public._aval_info(decisoes_gerenciais) from public, anon, authenticated;

-- ---------- enfileira o pedido de aval (usado na criação e no reenvio) ----------
create or replace function public._aval_enfileirar_pendente(d decisoes_gerenciais, p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare i jsonb; ap record; msg text;
begin
  i := _aval_info(d);
  select * into ap from decisao_whatsapp_numeros where papel = 'aprovador' and ativo order by email limit 1;
  msg := 'Diego, a obra ' || coalesce(i->>'obra', 'obra') || ' precisa do seu aval para a contratação do montador '
      || coalesce(i->>'instalador', '—') || ' (contrato ' || coalesce(i->>'contrato', '—') || '), valor ' || coalesce(i->>'valor_fmt', '—')
      || '. Você autoriza? Responda SIM ou NÃO'
      || case when i->>'codigo' is not null then ' (se houver mais de um aval aberto, acrescente o código: SIM ' || (i->>'codigo') || ').' else '.' end;
  perform evento_enfileirar('instalador.aval_pendente', p_key, 'decisao', d.id::text, i->>'contrato',
    i || jsonb_build_object('mensagem', msg, 'responder_com', 'SIM ou NÃO', 'decisao_id', d.id,
      'destinatarios', jsonb_build_array(jsonb_build_object('nome', coalesce(ap.nome, 'Diego Maeno'), 'email', coalesce(ap.email, 'diego@verticalparts.com.br'), 'telefone', ap.telefone))),
    jsonb_build_object('email', d.solicitado_por));
exception when others then null;
end $$;
revoke execute on function public._aval_enfileirar_pendente(decisoes_gerenciais, text) from public, anon, authenticated;

-- ---------- gatilho de criação: agora usa o helper (a mensagem pronta vai no payload) ----------
create or replace function public.trg_evt_aval_instalador() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo <> 'contratacao_mao_obra_ceo' then return new; end if;
  begin
    perform _aval_enfileirar_pendente(new, 'instalador.aval_pendente:' || new.id);
  exception when others then null;
  end;
  return new;
end $$;

-- ---------- resposta do Diego pelo WhatsApp ----------
create or replace function public.decisao_whatsapp_responder(p_telefone text, p_texto text, p_ref text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  tel text := right(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 11);
  ap decisao_whatsapp_numeros%rowtype;
  t text; primeira text; resto text; novo text; filtro text;
  pend jsonb := '[]'::jsonb; n int; d decisoes_gerenciais%rowtype; ult decisoes_gerenciais%rowtype; i jsonb;
  r record; dd decisoes_gerenciais%rowtype; achou boolean; ciente record; msgm text; ref text;
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

  -- avais em aberto (um por vez; com mais de um, o código do contrato desempata)
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
  if n > 1 and filtro <> '' then
    achou := false;
    for r in select (e->>'id')::uuid as id, e->'info' as info from jsonb_array_elements(pend) e loop
      if lower(coalesce(r.info->>'codigo', '')) = filtro or lower(coalesce(r.info->>'contrato', '')) like '%' || filtro || '%' or r.id::text = filtro then
        select * into d from decisoes_gerenciais where id = r.id; achou := true; exit;
      end if;
    end loop;
    if not achou then n := 2; end if;      -- código não bateu: continua ambíguo
    if achou then n := 1; end if;
  elsif n = 1 then
    select * into d from decisoes_gerenciais where id = ((pend->0)->>'id')::uuid;
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

  -- avisa quem pediu (dentro do sistema) — o resultado vai para a Central de Notificações dele
  begin
    insert into alertas (id, level, title, sub, module, destinatario_email, rota)
    values ('aval-resp-' || d.id || '-' || to_char(now(), 'YYYYMMDDHH24MISS'),
            case when novo = 'aprovada' then 'info' else 'warning' end,
            case when novo = 'aprovada' then 'Aval do CEO aprovado' else 'Aval do CEO recusado' end,
            'Contrato ' || coalesce(i->>'contrato', '—') || ' · ' || coalesce(i->>'obra', 'obra') || ' · ' || coalesce(i->>'valor_fmt', '') ||
              case when novo = 'aprovada' then ' — pode enviar ao montador.' else ' — fale com o Diego.' end,
            'Decisões', d.solicitado_por, '/geral/decisoes');
  exception when others then null; end;

  -- avisa o Maurício (e quem a Central definir) por WhatsApp
  begin
    select * into ciente from decisao_whatsapp_numeros where papel = 'ciente' and ativo order by email limit 1;
    perform evento_enfileirar('instalador.aval_respondido', 'instalador.aval_respondido:' || d.id || ':' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
      'decisao', d.id::text, i->>'contrato',
      i || jsonb_build_object('resultado', novo, 'respondido_por', ap.nome, 'canal', 'whatsapp',
        'mensagem', case when novo = 'aprovada'
            then 'O Diego APROVOU o aval da contratação do montador ' || coalesce(i->>'instalador', '—') || ' (contrato ' || coalesce(i->>'contrato', '—') || ', obra ' || coalesce(i->>'obra', '—') || ', ' || coalesce(i->>'valor_fmt', '') || '). O contrato já pode ser enviado.'
            else 'O Diego RECUSOU o aval da contratação do montador ' || coalesce(i->>'instalador', '—') || ' (contrato ' || coalesce(i->>'contrato', '—') || ', obra ' || coalesce(i->>'obra', '—') || ', ' || coalesce(i->>'valor_fmt', '') || '). Fale com o Diego sobre o assunto; o aval pode ser reenviado.' end,
        'destinatarios', jsonb_build_array(jsonb_build_object('nome', coalesce(ciente.nome, 'Maurício Araujo'), 'email', coalesce(ciente.email, 'mauricio.araujo@verticalparts.com.br'), 'telefone', ciente.telefone))),
      jsonb_build_object('nome', ap.nome, 'email', ap.email));
  exception when others then null; end;

  return jsonb_build_object('ok', true, 'resultado', novo, 'decisao_id', d.id, 'contrato', i->>'contrato',
    'resposta', case when novo = 'aprovada'
        then '✅ Aval registrado: contratação do montador ' || coalesce(i->>'instalador', '—') || ' (' || coalesce(i->>'contrato', '—') || ') APROVADA. O contrato já pode ser enviado.'
        else '❌ Aval registrado: contratação do montador ' || coalesce(i->>'instalador', '—') || ' (' || coalesce(i->>'contrato', '—') || ') RECUSADA. O Maurício foi avisado.' end);
end $$;
revoke execute on function public.decisao_whatsapp_responder(text, text, text) from public, anon, authenticated;
grant execute on function public.decisao_whatsapp_responder(text, text, text) to service_role;

-- ---------- reenvio do pedido de aval (botão na Central) ----------
create or replace function public.decisao_aval_reenviar(p_decisao_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
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
           contexto = coalesce(contexto, '{}'::jsonb) || jsonb_build_object('reaberturas', reab)
     where id = d.id returning * into d;
  elsif d.status <> 'pendente' then
    return jsonb_build_object('ok', false, 'erro', 'status_' || d.status);
  end if;
  perform _aval_enfileirar_pendente(d, 'instalador.aval_pendente:' || d.id || ':reenvio:' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
  begin
    insert into vp_logs (modulo, acao, alvo, alvo_id, detalhe)
    values ('Central de Decisões', 'Reenviou o pedido de aval do CEO por WhatsApp', coalesce(_aval_info(d)->>'contrato', d.id::text), d.id::text, jsonb_build_object('reaberta', d.status = 'pendente'));
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'status', d.status);
end $$;
revoke execute on function public.decisao_aval_reenviar(uuid) from public, anon;
grant execute on function public.decisao_aval_reenviar(uuid) to authenticated, service_role;
