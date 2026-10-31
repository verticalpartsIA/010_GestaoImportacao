-- 31/10/2026 (Gelson): o aval de contratação do montador é da JULIANA (docs/modulos/01_geral.md 1.3.8), não do CEO.
-- Só troca 2 textos de decisao_whatsapp_responder que ainda diziam "CEO":
--   1) a ação gravada em vp_logs: "(CEO)" -> "(aval da Juliana)";
--   2) o título do aviso a quem pediu: "Aval do CEO aprovado/recusado" -> "Aval do montador aprovado/recusado por <quem respondeu>".
-- O resto do corpo é a cópia exata da versão de produção lida em 31/10/2026 (pg_get_functiondef). CREATE OR REPLACE
-- mantém os privilégios atuais (EXECUTE só para postgres e service_role). Nenhuma regra muda.
CREATE OR REPLACE FUNCTION public.decisao_whatsapp_responder(p_telefone text, p_texto text, p_ref text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    values ('Central de Decisões', case when novo = 'aprovada' then 'Aprovou por WhatsApp — Contratação de mão de obra (aval da Juliana)' else 'Recusou por WhatsApp — Contratação de mão de obra (aval da Juliana)' end,
            coalesce(i->>'contrato', d.id::text), d.id::text, jsonb_build_object('canal', 'whatsapp', 'resposta', left(coalesce(p_texto, ''), 80)), ap.nome);
  exception when others then null; end;

  begin
    insert into alertas (id, level, title, sub, module, destinatario_email, rota)
    values ('aval-resp-' || d.id || '-' || to_char(now(), 'YYYYMMDDHH24MISS'),
            case when novo = 'aprovada' then 'info' else 'warning' end,
            case when novo = 'aprovada' then 'Aval do montador aprovado por ' else 'Aval do montador recusado por ' end
              || coalesce(nullif(split_part(ap.nome, ' ', 1), ''), 'Juliana'),
            'Contrato ' || coalesce(i->>'contrato', '—') || ' · ' || coalesce(i->>'obra', 'obra') || ' · ' || coalesce(i->>'valor_fmt', '') ||
              case when novo = 'aprovada' then ' — os links de assinatura saem automaticamente.' else ' — fale com ' || split_part(ap.nome, ' ', 1) || '.' end,
            'Decisões', d.solicitado_por, '/geral/decisoes');
  exception when others then null; end;

  return jsonb_build_object('ok', true, 'resultado', novo, 'decisao_id', d.id, 'contrato', i->>'contrato',
    'resposta', case when novo = 'aprovada'
        then '✅ Aval registrado: contratação do montador ' || coalesce(i->>'instalador', '—') || ' (' || coalesce(i->>'contrato', '—') || ') APROVADA. Os links de assinatura saem agora.'
        else '❌ Aval registrado: contratação do montador ' || coalesce(i->>'instalador', '—') || ' (' || coalesce(i->>'contrato', '—') || ') RECUSADA. Nada foi enviado e o Maurício foi avisado.' end);
end $function$;
