-- Rastreamento de Navios — 2ª rodada (06/10/2026)
-- D: motivo do erro da Sinay; F: marca de embarque de teste; E: status coerente com a chegada;
-- B/C: alertas diários (rastreio parado e ETA vencido).

alter table public.embarques add column if not exists tracking_erro text;
alter table public.embarques add column if not exists teste boolean not null default false;

-- F
update public.embarques set teste = true where id = 'EM-SINAYTEST';

-- E: chegada confirmada => status Entregue (qualquer caminho que grave chegada_confirmada_em)
create or replace function public.embarques_status_pela_chegada() returns trigger
language plpgsql as $$
begin
  if new.chegada_confirmada_em is not null and new.status is distinct from 'Entregue' then
    new.status := 'Entregue';
  end if;
  return new;
end $$;
drop trigger if exists trg_embarques_status_chegada on public.embarques;
create trigger trg_embarques_status_chegada before insert or update on public.embarques
  for each row execute function public.embarques_status_pela_chegada();
update public.embarques set status = 'Entregue' where chegada_confirmada_em is not null and status <> 'Entregue';

-- B + C
create or replace function public.embarques_alertar_rastreio(simular boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sem jsonb; v_venc jsonb; v_n1 int; v_n2 int; v_sem_txt text; v_venc_txt text; v_id1 text; v_id2 text;
  v_semana text := to_char(now() at time zone 'America/Sao_Paulo', 'IYYY-IW');
begin
  -- B: rastreio sem leitura real há mais de 48 h
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'navio', coalesce(vessel, id)) order by id), '[]'::jsonb) into v_sem
    from public.embarques
   where status <> 'Entregue' and chegada_confirmada_em is null and not teste
     and tracking_provider = 'sinay' and coalesce(tracking_updated_at, 'epoch') < now() - interval '48 hours';
  -- C: ETA vencido há 1 dia ou mais, sem chegada confirmada
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'navio', coalesce(vessel, id), 'dias', (current_date - eta::date)) order by eta), '[]'::jsonb) into v_venc
    from public.embarques
   where status <> 'Entregue' and chegada_confirmada_em is null and not teste
     and eta is not null and eta::date < current_date;
  v_n1 := jsonb_array_length(v_sem); v_n2 := jsonb_array_length(v_venc);

  select string_agg(e->>'id' || ' (' || (e->>'navio') || ')', ' · ') into v_sem_txt from jsonb_array_elements(v_sem) e;
  select string_agg(e->>'id' || ' (' || (e->>'navio') || ', ' || (e->>'dias') || 'd)', ' · ') into v_venc_txt from jsonb_array_elements(v_venc) e;
  v_id1 := 'emb-rastreio-' || v_semana || '-' || left(md5(coalesce(v_sem_txt, '')), 8);
  v_id2 := 'emb-eta-' || v_semana || '-' || left(md5(coalesce(v_venc_txt, '')), 8);

  if simular then
    return jsonb_build_object('rastreio_parado', v_sem, 'eta_vencido', v_venc, 'id1', v_id1, 'id2', v_id2);
  end if;

  update public.alertas set resolved = true where starts_with(id, 'emb-rastreio-') and (v_n1 = 0 or id <> v_id1) and not resolved;
  update public.alertas set resolved = true where starts_with(id, 'emb-eta-') and (v_n2 = 0 or id <> v_id2) and not resolved;
  if v_n1 > 0 then
    insert into public.alertas (id, level, title, sub, module, resolved, rota)
    values (v_id1, 'warning', 'Rastreio de navio sem leitura real há mais de 48h (' || v_n1 || ')',
            left(v_sem_txt || ' — verifique a chave/saldo da Sinay (TI) e o motivo do erro no detalhe do embarque.', 480),
            'Importação', false, '/gestao-importacao/importacao-rastreamento')
    on conflict (id) do nothing;
  end if;
  if v_n2 > 0 then
    insert into public.alertas (id, level, title, sub, module, resolved, rota)
    values (v_id2, 'warning', 'Embarque com ETA vencido e chegada não confirmada (' || v_n2 || ')',
            left(v_venc_txt, 480), 'Importação', false, '/gestao-importacao/importacao-rastreamento')
    on conflict (id) do nothing;
  end if;
  return jsonb_build_object('rastreio_parado', v_n1, 'eta_vencido', v_n2);
end $$;
revoke all on function public.embarques_alertar_rastreio(boolean) from public, anon, authenticated;

select cron.schedule('embarques-alerta-rastreio-diario', '40 10 * * *', $$ select public.embarques_alertar_rastreio(false) $$);
