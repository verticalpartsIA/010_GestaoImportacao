-- Revisão Codex (#1058): o aviso ao Maurício sobre o resultado do aval cita quem DECIDIU (Juliana, ou outra pessoa pela Central), não o Diego.
create or replace function public.trg_aval_resultado()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare i jsonb; ciente record; txt text; quem text; titulo text;
begin
  if new.tipo <> 'contratacao_mao_obra_ceo' or old.status is distinct from 'pendente' or new.status not in ('aprovada', 'reprovada') then return new; end if;
  begin
    i := _aval_info(new);
    select * into ciente from decisao_whatsapp_numeros where papel = 'ciente' and ativo order by email limit 1;
    select coalesce(nullif(split_part(n.nome, ' ', 1), ''), initcap(split_part(split_part(new.decidido_por, '@', 1), '.', 1)), 'A Juliana') into quem
      from (select 1) x left join decisao_whatsapp_numeros n on lower(n.email) = lower(new.decidido_por);
    quem := coalesce(quem, 'A Juliana');
    txt := case when new.status = 'aprovada'
        then quem || ' APROVOU o aval da contratação do montador ' || coalesce(i->>'instalador', '—') || ' (contrato ' || coalesce(i->>'contrato', '—') || ', obra ' || coalesce(i->>'obra', '—') || ', ' || coalesce(i->>'valor_fmt', '') || '). Os links de assinatura saem automaticamente.'
        else quem || ' RECUSOU o aval da contratação do montador ' || coalesce(i->>'instalador', '—') || ' (contrato ' || coalesce(i->>'contrato', '—') || ', obra ' || coalesce(i->>'obra', '—') || ', ' || coalesce(i->>'valor_fmt', '') || '). Nada foi enviado. Fale com ' || quem || ' sobre o assunto; o aval pode ser reenviado.' end;
    titulo := quem || case when new.status = 'aprovada' then ' aprovou' else ' recusou' end || ' o aval do montador';
    insert into alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
    values ('aval-ciente-' || new.id || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
            case when new.status = 'aprovada' then 'info' else 'warning' end, titulo,
            left(txt, 900), 'Central de Decisões', false, lower(coalesce(ciente.email, 'mauricio.araujo@verticalparts.com.br')), '/geral/decisoes');
  exception when others then null; end;
  if new.status = 'aprovada' then
    begin perform public._ci_disparar(new);
    exception when others then raise warning '[trg_aval_resultado] disparo falhou: %', sqlerrm; end;
  end if;
  return new;
end $function$;
