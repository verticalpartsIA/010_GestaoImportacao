-- 22/10/2026 (decisão do Jurídico/Diego): quem libera o envio do contrato do montador (aval por WhatsApp) passa a ser a JULIANA, não mais o Diego.
-- A fila de ASSINATURAS (Diego / Juliana / Maurício) não muda — só o aval que dispara o envio.

-- 1) quem responde SIM/NÃO pelo WhatsApp
insert into decisao_whatsapp_numeros (email, nome, telefone, papel, ativo)
values ('juliana@verticalparts.com.br', 'Juliana Anderson', '5511974913360', 'aprovador', true)
on conflict (email) do update set nome = excluded.nome, telefone = excluded.telefone, papel = 'aprovador', ativo = true;
update decisao_whatsapp_numeros set ativo = false where email = 'diego@verticalparts.com.br' and papel = 'aprovador';

-- 2) mensagem do pedido: chama quem aprova pelo nome e usa título sem "CEO"
create or replace function public._aval_enfileirar_pendente(d decisoes_gerenciais, p_key text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare i jsonb; ap record; msg text; idalerta text; titulo text; reenvio boolean; nome1 text; dest text;
begin
  i := _aval_info(d);
  select * into ap from decisao_whatsapp_numeros where papel = 'aprovador' and ativo order by email limit 1;
  dest := lower(coalesce(ap.email, 'juliana@verticalparts.com.br'));
  nome1 := coalesce(nullif(split_part(coalesce(ap.nome, 'Juliana'), ' ', 1), ''), 'Juliana');
  reenvio := p_key like '%:reenvio:%';
  msg := nome1 || ', a obra ' || coalesce(i->>'obra', 'obra') || ' precisa do seu aval para a contratação do montador '
      || coalesce(i->>'instalador', '—') || ' (contrato ' || coalesce(i->>'contrato', '—') || '), valor ' || coalesce(i->>'valor_fmt', '—')
      || '. Você autoriza? Responda SIM ou NÃO'
      || case when i->>'codigo' is not null then ' (se houver mais de um aval aberto, acrescente o código: SIM ' || (i->>'codigo') || ').' else '.' end;
  titulo := 'Aval da contratação — ' || coalesce(i->>'contrato', 'montador')
         || case when reenvio then ' (reenvio ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || ')' else '' end;
  idalerta := 'dec_nova_' || d.id::text || '_' || dest
              || case when reenvio then '_r' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint else '' end;
  insert into alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
  values (idalerta, 'warning', titulo, left(msg, 900), 'Central de Decisões', false, dest, '/geral/decisoes')
  on conflict (id) do update set resolved = false, created_at = now(), sub = excluded.sub, title = excluded.title;
exception when others then null;
end $function$;

-- 3) textos que citavam o Diego como aprovador (função de resposta e disparo)
do $do$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.proname = 'decisao_whatsapp_responder';
  def := replace(def, $q$' — fale com o Diego.'$q$, $q$' — fale com ' || split_part(ap.nome, ' ', 1) || '.'$q$);
  execute def;
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.proname = '_ci_disparar';
  def := replace(def, 'Aval aprovado pelo Diego — contrato ', 'Aval aprovado — contrato ');
  execute def;
end $do$;

-- 4) decisões de aval ainda abertas passam a ser da Juliana (papel novo; os avisos antigos ao Diego são encerrados)
update decisoes_gerenciais set papel_requerido = 'aval_instalador', aprovadores_esperados = array['juliana@verticalparts.com.br'], atualizado_em = now()
 where tipo = 'contratacao_mao_obra_ceo' and status = 'pendente';
update alertas set resolved = true
 where id like 'dec\_nova\_%' and destinatario_email = 'diego@verticalparts.com.br' and not resolved
   and title like 'Aval do CEO%';
