-- Rastreamento de Navios — aviso de chegada próxima (06/10/2026)
-- Embarque com ETA nos próximos 3 dias úteis (ainda sem chegada confirmada, fora os de teste) avisa os líderes de Engenharia e
-- Logística/Almoxarifado para prepararem o recebimento. Um aviso por embarque e ETA (não repete todo dia); resolve sozinho quando
-- a chegada é confirmada, o embarque sai da janela ou o ETA muda. Sem líder cadastrado, vira aviso global.

create or replace function public.embarques_alertar_chegada(simular boolean default false, p_dias_uteis int default 3) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lista jsonb; v_n int; r record; v_em text; v_lideres text[]; v_ids text[] := array[]::text[]; v_id text; v_criados int := 0;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'navio', coalesce(e.vessel, e.id), 'cliente', e.client, 'eta', e.eta, 'destino', e.destination) order by e.eta), '[]'::jsonb) into v_lista
    from public.embarques e
   where e.status <> 'Entregue' and e.chegada_confirmada_em is null and not e.teste and e.eta is not null
     and e.eta::date >= (now() at time zone 'America/Sao_Paulo')::date
     and (select count(*) from generate_series((now() at time zone 'America/Sao_Paulo')::date + 1, e.eta::date, interval '1 day') d where extract(isodow from d) < 6) <= p_dias_uteis;
  v_n := jsonb_array_length(v_lista);
  if simular then return jsonb_build_object('chegando', v_lista); end if;

  select array_agg(distinct lower(trim(email))) into v_lideres from public.colaboradores_vpsistema
   where is_department_lead and is_active and email like '%@%'
     and departamento ilike any (array['%Engenharia%', '%Instala%', '%Log_stica%', '%Almoxarifado%']);

  for r in select e from jsonb_array_elements(v_lista) e loop
    v_criados := 0;
    foreach v_em in array coalesce(v_lideres, array[]::text[]) loop
      v_id := 'emb-chegada-' || (r.e->>'id') || '-' || (r.e->>'eta') || '-' || left(md5(v_em), 6);
      v_ids := v_ids || v_id;
      insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
      values (v_id, 'info', 'Navio chegando em até ' || p_dias_uteis || ' dias úteis: ' || (r.e->>'navio'),
              left('Embarque ' || (r.e->>'id') || ' · ' || coalesce(r.e->>'cliente', '—') || ' · ETA ' || to_char((r.e->>'eta')::date, 'DD/MM/YYYY') || ' → ' || coalesce(r.e->>'destino', '—') || '. Prepare o recebimento e a instalação.', 480),
              'Importação', false, v_em, '/gestao-importacao/importacao-rastreamento')
      on conflict (id) do nothing;
      v_criados := v_criados + 1;
    end loop;
    if v_criados = 0 then
      v_id := 'emb-chegada-' || (r.e->>'id') || '-' || (r.e->>'eta');
      v_ids := v_ids || v_id;
      insert into public.alertas (id, level, title, sub, module, resolved, rota)
      values (v_id, 'info', 'Navio chegando em até ' || p_dias_uteis || ' dias úteis: ' || (r.e->>'navio'),
              left('Embarque ' || (r.e->>'id') || ' · ' || coalesce(r.e->>'cliente', '—') || ' · ETA ' || to_char((r.e->>'eta')::date, 'DD/MM/YYYY') || '. Prepare o recebimento e a instalação.', 480),
              'Importação', false, '/gestao-importacao/importacao-rastreamento')
      on conflict (id) do nothing;
    end if;
  end loop;
  update public.alertas set resolved = true where starts_with(id, 'emb-chegada-') and not resolved and not (id = any (v_ids));
  return jsonb_build_object('chegando', v_n);
end $$;
revoke all on function public.embarques_alertar_chegada(boolean, int) from public, anon, authenticated;

select cron.schedule('embarques-alerta-chegada', '50 10 * * 1-5', $$ select public.embarques_alertar_chegada(false, 3) $$);
