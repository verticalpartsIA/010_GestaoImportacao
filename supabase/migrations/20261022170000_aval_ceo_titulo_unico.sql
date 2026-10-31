-- Task 6 (Jurídico): o aviso do aval do CEO só chegava ao WhatsApp do Diego na 1ª vez do dia.
-- O gi-avisos agrupa avisos "do mesmo tipo" por pessoa em 24 h (mesma etapa/título/módulo, sem nº de cotação) e descarta os seguintes
-- ("agrupado"). Como todo aval tinha o MESMO título, o 2º aval (outro contrato) e todo reenvio não eram entregues.
-- Correção: o título passa a levar o código do contrato e, no reenvio, a hora do reenvio — cada aval/reenvio vira um aviso distinto.
-- Só muda o texto do título do alerta; id, destinatário, rota e resolução continuam iguais.
create or replace function public._aval_enfileirar_pendente(d decisoes_gerenciais, p_key text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare i jsonb; ap record; msg text; idalerta text; titulo text; reenvio boolean;
begin
  i := _aval_info(d);
  select * into ap from decisao_whatsapp_numeros where papel = 'aprovador' and ativo order by email limit 1;
  reenvio := p_key like '%:reenvio:%';
  msg := 'Diego, a obra ' || coalesce(i->>'obra', 'obra') || ' precisa do seu aval para a contratação do montador '
      || coalesce(i->>'instalador', '—') || ' (contrato ' || coalesce(i->>'contrato', '—') || '), valor ' || coalesce(i->>'valor_fmt', '—')
      || '. Você autoriza? Responda SIM ou NÃO'
      || case when i->>'codigo' is not null then ' (se houver mais de um aval aberto, acrescente o código: SIM ' || (i->>'codigo') || ').' else '.' end;
  titulo := 'Aval do CEO — ' || coalesce(i->>'contrato', 'contratação de montador')
         || case when reenvio then ' (reenvio ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || ')' else '' end;
  idalerta := 'dec_nova_' || d.id::text || '_' || lower(coalesce(ap.email, 'diego@verticalparts.com.br'))
              || case when reenvio then '_r' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint else '' end;
  insert into alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
  values (idalerta, 'warning', titulo, left(msg, 900), 'Central de Decisões', false,
          lower(coalesce(ap.email, 'diego@verticalparts.com.br')), '/geral/decisoes')
  on conflict (id) do update set resolved = false, created_at = now(), sub = excluded.sub, title = excluded.title;
exception when others then null;
end $function$;
