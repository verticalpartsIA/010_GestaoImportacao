-- Expedição — 2ª rodada (06/10/2026)
-- A: nº da NF e nome da transportadora do Omie; F: comprovante em bucket privado (link com validade);
-- D: alerta diário de pedido despachado sem entrega confirmada.

alter table public.pcp_pedidos add column if not exists numero_nf text;
alter table public.pcp_pedidos add column if not exists transportadora_nome text;

-- F: bucket privado. As políticas valem para o bucket novo apenas; o app usa a chave pública (issue #571 trata o isolamento real).
insert into storage.buckets (id, name, public) values ('expedicao-comprovantes', 'expedicao-comprovantes', false)
  on conflict (id) do nothing;
drop policy if exists exp_comprov_insert on storage.objects;
create policy exp_comprov_insert on storage.objects for insert to anon, authenticated with check (bucket_id = 'expedicao-comprovantes');
drop policy if exists exp_comprov_select on storage.objects;
create policy exp_comprov_select on storage.objects for select to anon, authenticated using (bucket_id = 'expedicao-comprovantes');

-- D
create or replace function public.exp_dias_uteis(p_de date) returns int
language sql stable as $$
  select count(*)::int from generate_series(p_de + 1, (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') d
   where extract(isodow from d) < 6
$$;

create or replace function public.pcp_expedicao_alertar_sem_entrega(simular boolean default false, p_dias int default 5) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lista jsonb; v_n int; v_txt text; v_id text; r record; v_criados int := 0;
  v_semana text := to_char(now() at time zone 'America/Sao_Paulo', 'IYYY-IW');
begin
  select coalesce(jsonb_agg(jsonb_build_object('ped', p.numero_pedido, 'cli', coalesce(p.cliente_fantasia, p.cliente_nome, '—'), 'dias', public.exp_dias_uteis(e.data_saida)) order by e.data_saida), '[]'::jsonb)
    into v_lista
    from public.pcp_expedicoes e join public.pcp_pedidos p on p.codigo_pedido = e.pedido_codigo
   where e.status = 'despachado' and not coalesce(e.retirada, false) and e.data_saida is not null
     and public.exp_dias_uteis(e.data_saida) >= p_dias;
  v_n := jsonb_array_length(v_lista);
  if v_n = 0 then
    if not simular then update public.alertas set resolved = true where starts_with(id, 'exp-transito-') and not resolved; end if;
    return jsonb_build_object('sem_entrega', 0);
  end if;
  select string_agg('Ped. ' || (e->>'ped') || ' · ' || (e->>'cli') || ' (' || (e->>'dias') || ' dias úteis)', ' · ') into v_txt from (select e from jsonb_array_elements(v_lista) e limit 4) s;
  if v_n > 4 then v_txt := v_txt || ' · +' || (v_n - 4) || ' outros'; end if;
  v_id := 'exp-transito-' || v_semana || '-' || left(md5((select string_agg(e->>'ped', ',' order by e->>'ped') from jsonb_array_elements(v_lista) e)), 8);
  if simular then return jsonb_build_object('sem_entrega', v_lista, 'id', v_id); end if;
  update public.alertas set resolved = true where starts_with(id, 'exp-transito-') and not starts_with(id, v_id) and not resolved;
  for r in select distinct lower(trim(email)) em from public.colaboradores_vpsistema
            where is_department_lead and is_active and departamento ilike any (array['%Almoxarifado%', '%Log_stica%']) and email like '%@%' loop
    insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
    values (v_id || '-' || left(md5(r.em), 6), 'warning', v_n || ' pedido(s) despachado(s) sem entrega confirmada há ' || p_dias || '+ dias úteis',
            left(v_txt, 480), 'Expedição', false, r.em, '/logistica/expedicao')
    on conflict (id) do nothing;
    v_criados := v_criados + 1;
  end loop;
  if v_criados = 0 then
    insert into public.alertas (id, level, title, sub, module, resolved, rota)
    values (v_id, 'warning', v_n || ' pedido(s) despachado(s) sem entrega confirmada há ' || p_dias || '+ dias úteis', left(v_txt, 480), 'Expedição', false, '/logistica/expedicao')
    on conflict (id) do nothing;
  end if;
  return jsonb_build_object('sem_entrega', v_n, 'id', v_id);
end $$;
revoke all on function public.pcp_expedicao_alertar_sem_entrega(boolean, int) from public, anon, authenticated;
revoke all on function public.exp_dias_uteis(date) from public, anon, authenticated;

select cron.schedule('pcp-expedicao-alerta-sem-entrega', '10 10 * * 1-5', $$ select public.pcp_expedicao_alertar_sem_entrega(false, 5) $$);
