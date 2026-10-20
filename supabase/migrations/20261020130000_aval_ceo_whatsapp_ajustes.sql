-- 20/10/2026 — ajustes da revisão do PR #997 (Codex):
--  1) Um "SIM M009" atrasado/repetido não pode aprovar OUTRO contrato que virou o único aval aberto: o código informado é conferido
--     também quando só resta um aval (antes só valia com 2+).
--  2) Decisões `contratacao_mao_obra_ceo` que já existiam (papel 'ceo') passam ao papel 'ceo_diego', para o Gelson/delegados 'ceo'
--     deixarem de poder aprová-las pela tela (regra: esse aval é sempre do Diego).

create or replace function public._aval_ref_confere(info jsonb, p_id uuid, filtro text) returns boolean
language sql immutable as $$
  select coalesce(filtro, '') <> '' and (
    replace(lower(p_id::text), '-', ' ') = filtro
    or exists (
      select 1 from regexp_split_to_table(filtro, ' ') tk
       where tk <> '' and (
         tk = lower(coalesce(info->>'codigo', '')) or tk = lower(coalesce(info->>'contrato', ''))
         or (length(tk) >= 3 and lower(coalesce(info->>'contrato', '')) like '%' || tk)
       )
    )
  )
$$;
revoke execute on function public._aval_ref_confere(jsonb, uuid, text) from public, anon, authenticated;

create or replace function public.decisao_whatsapp_responder(p_telefone text, p_texto text, p_ref text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  tel text := right(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 11);
  ap decisao_whatsapp_numeros%rowtype;
  t text; primeira text; resto text; novo text; filtro text; exige_ref boolean;
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

-- decisões que já existiam passam ao papel "só o Diego" (o snapshot de aprovadores só muda nas que ainda estão em aberto; as decididas guardam o histórico)
update public.decisoes_gerenciais set papel_requerido = 'ceo_diego'
 where tipo = 'contratacao_mao_obra_ceo' and papel_requerido is distinct from 'ceo_diego';
update public.decisoes_gerenciais set aprovadores_esperados = array['diego@verticalparts.com.br'], aprovador_esperado_email = 'diego@verticalparts.com.br'
 where tipo = 'contratacao_mao_obra_ceo' and status in ('pendente', 'bloqueada_por_dependencia');
