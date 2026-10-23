-- 23/10/2026 — Lembretes diários de assinatura pendente do Contrato do Instalador (pedido do Gelson).
-- Todo dia útil às 9h (Brasília), para cada assinatura pendente há pelo menos 1 dia corrido:
--   1) PENDENTE PESSOAL: quem deve assinar recebe de novo o aviso com o link (internos pelo e-mail do aviso "assinatura pendente";
--      montador pelo telefone). Chave idempotente por dia: reexecutar no mesmo dia não duplica.
--   2) RESUMO: Cleiton, Maurício e Felipe recebem 1 aviso único com tudo que está aguardando e de quem.
--   3) ESCALONAMENTO: com 3+ dias úteis sem assinar, o Gelson recebe 1 aviso único com a lista.
-- Para quando assina, expira (montador: link de 7 dias) ou o contrato sai de "enviado/assinado". O aviso "link vence em N dia(s)"
-- entra no resumo quando faltam 2 dias ou menos. Nada altera contrato: só grava avisos e eventos de saída.

create or replace function public._ci_pendencias_assinatura()
returns table(tipo text, quem text, email text, contrato_id uuid, assinante_id text, numero text, obra text, uteis int, vence_dias int)
language sql stable security definer set search_path to 'public' as $function$
  with base as (
    select c.id, c.numero_documento, c.status, c.expires_at, c.sent_at, trim(coalesce(public._ci_obra(c), '')) obra,
           coalesce(nullif(trim(c.recipient->>'name'), ''), nullif(trim(c.responsavel_nome), ''), c.contratada_nome) montador
      from contratos_instalador c
     where c.status in ('enviado', 'visualizado', 'assinado') and c.sent_at is not null
  ), u as (
    select 'montador'::text tipo, ('Montador ' || b.montador)::text quem, null::text email, b.id contrato_id, null::text assinante_id,
           b.numero_documento numero, b.obra, b.sent_at ts, b.expires_at, b.status
      from base b
     where b.status in ('enviado', 'visualizado') and (b.expires_at is null or b.expires_at > now())
    union all
    select 'assinante', s.nome, lower(s.email), b.id, s.id::text, b.numero_documento, b.obra,
           coalesce(s.liberada_em, s.sent_at, b.sent_at), b.expires_at, b.status
      from documento_signatarios s join base b on b.id::text = s.documento_id
     where s.documento_tipo = 'contrato_instalador' and s.status in ('enviado', 'visualizado')
       and not (b.status in ('enviado', 'visualizado') and b.expires_at is not null and b.expires_at <= now())
  )
  select u.tipo, u.quem, u.email, u.contrato_id, u.assinante_id, u.numero, nullif(u.obra, ''),
         (select count(*)::int from generate_series(((u.ts at time zone 'America/Sao_Paulo')::date)::timestamp,
                 (((now() at time zone 'America/Sao_Paulo')::date) - 1)::timestamp, interval '1 day') g
           where extract(isodow from g) < 6) uteis,
         case when u.status in ('enviado', 'visualizado') and u.expires_at is not null
              then ceil(extract(epoch from (u.expires_at - now())) / 86400)::int end vence_dias
    from u
   where (u.ts at time zone 'America/Sao_Paulo')::date < (now() at time zone 'America/Sao_Paulo')::date
$function$;

create or replace function public.ci_lembretes_assinatura(p_simular boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_ymd text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYYMMDD');
  v_regra text[] := array['cleiton.domingos@verticalparts.com.br', 'mauricio.araujo@verticalparts.com.br', 'felipe.barros@verticalparts.com.br'];
  v_gelson text := 'gelson.simoes@verticalparts.com.br';
  r record; c contratos_instalador%rowtype; s documento_signatarios%rowtype;
  v_tel text; v_nome text; v_n int := 0; v_resumo text; v_escala text; v_e text;
begin
  for r in select * from public._ci_pendencias_assinatura() loop
    v_n := v_n + 1;
    if p_simular then continue; end if;
    begin
      select * into c from contratos_instalador where id = r.contrato_id;
      if r.tipo = 'montador' then
        v_tel := regexp_replace(coalesce(c.recipient->>'contact', ''), '\D', '', 'g');
        if length(v_tel) in (10, 11) then v_tel := '55' || v_tel; end if;
        v_nome := coalesce(nullif(trim(c.recipient->>'name'), ''), nullif(trim(c.responsavel_nome), ''), c.contratada_nome, 'Montador');
        if length(v_tel) >= 12 and c.token ~ '^[A-Za-z0-9_-]{8,}$' then
          perform evento_enfileirar('hub.aviso_fluxo', 'hub.aviso:assinatura:montador:' || c.id || ':' || c.token || ':lembrete:' || v_ymd,
            'contrato_instalador', c.id::text, c.numero_documento,
            jsonb_strip_nulls(jsonb_build_object('origem_aviso', 'assinatura', 'momento', 'pendente', 'papel', 'Contratado', 'lembrete', true,
              'titulo', 'Assinatura pendente — ' || c.numero_documento, 'contrato', c.numero_documento,
              'obra', nullif(trim(public._ci_obra(c)), ''), 'instalador', c.contratada_nome,
              'link_assinatura', 'https://hub.vpsistema.com/assinar/' || c.token,
              'destinatarios', jsonb_build_array(jsonb_build_object('nome', v_nome, 'telefone', v_tel, 'externo', true)))),
            jsonb_build_object('nome', v_nome));
        end if;
      else
        select * into s from documento_signatarios where id::text = r.assinante_id;
        if found then
          perform public._ci_aviso('pendente', c, s, null, 'hub.aviso:assinatura:' || s.id || ':lembrete:' || v_ymd);
        end if;
      end if;
    exception when others then
      raise warning '[ci_lembretes_assinatura] % falhou: %', r.numero, sqlerrm;
    end;
  end loop;

  select string_agg(t.quem || ' — ' || t.lista, E'\n' order by t.quem) into v_resumo
    from (select p.quem,
                 string_agg(p.numero || ' (' || p.uteis || ' dia(s) útil(eis)'
                            || case when p.vence_dias is not null and p.vence_dias <= 2 then ', link vence em ' || greatest(p.vence_dias, 0) || ' dia(s)' else '' end || ')',
                            ', ' order by p.numero) lista
            from public._ci_pendencias_assinatura() p group by p.quem) t;
  select string_agg(p.quem || ' — ' || p.numero || ' (' || p.uteis || ' dias úteis)', E'\n' order by p.uteis desc, p.numero) into v_escala
    from public._ci_pendencias_assinatura() p where p.uteis >= 3;

  if not p_simular then
    update alertas set resolved = true where id like 'ci-lembrete-%' and id not like '%-' || v_ymd || '-%' and not resolved;
    begin
      if v_resumo is not null then
        foreach v_e in array v_regra loop
          insert into alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
          values ('ci-lembrete-resumo-' || v_ymd || '-' || v_e, 'warning', 'Resumo diário - contratos aguardando assinatura',
                  left('Aguardando assinatura:' || E'\n' || v_resumo, 900), 'Jurídico', false, v_e, '/juridico/contrato-instalador')
          on conflict (id) do update set sub = excluded.sub, resolved = false;
        end loop;
      end if;
      if v_escala is not null then
        insert into alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
        values ('ci-lembrete-escala-' || v_ymd || '-' || v_gelson, 'danger', 'Contratos parados há 3+ dias úteis sem assinatura',
                left(v_escala, 900), 'Jurídico', false, v_gelson, '/juridico/contrato-instalador')
        on conflict (id) do update set sub = excluded.sub, resolved = false;
      end if;
    exception when others then
      raise warning '[ci_lembretes_assinatura] resumo/escala falhou: %', sqlerrm;
    end;
  end if;

  return jsonb_build_object('simulado', p_simular, 'pendencias', v_n, 'resumo', v_resumo, 'escala', v_escala);
end $function$;

revoke all on function public._ci_pendencias_assinatura() from public, anon, authenticated;
revoke all on function public.ci_lembretes_assinatura(boolean) from public, anon, authenticated;

-- 9h de Brasília (12:00 UTC), segunda a sexta
select cron.schedule('ci-lembretes-assinatura', '0 12 * * 1-5', $$select public.ci_lembretes_assinatura(false)$$);
