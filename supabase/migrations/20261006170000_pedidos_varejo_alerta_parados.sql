-- Pedidos internos de compra (varejo) — lembrete de pedido parado (06/10/2026)
-- Pendente de decisão há 2+ dias úteis e aprovado sem compra há 3+ dias úteis avisam os líderes de Almoxarifado/Logística
-- (mesmo critério dos outros alertas do PCP; sem líder cadastrado, vira alerta global). Resolve sozinho quando a lista esvazia.
-- Usa public.exp_dias_uteis(date) (migration 20261006140000).

create or replace function public.pcp_varejo_alertar_parados(simular boolean default false, p_dias_pend int default 2, p_dias_aprov int default 3) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pend jsonb; v_aprov jsonb; v_n1 int; v_n2 int; v_t1 text; v_t2 text; v_id1 text; v_id2 text; v_em text; v_criados int; v_lideres text[];
  v_semana text := to_char(now() at time zone 'America/Sao_Paulo', 'IYYY-IW');
begin
  select coalesce(jsonb_agg(jsonb_build_object('n', p.numero_documento, 'item', left(p.item, 40), 'dias', public.exp_dias_uteis(p.criado_em::date)) order by p.criado_em), '[]'::jsonb) into v_pend
    from public.pedidos_compra_varejo p join public.decisoes_gerenciais d on d.id = p.decisao_id
   where d.status = 'pendente' and p.status not in ('cancelado', 'comprado', 'reprovado')
     and public.exp_dias_uteis(p.criado_em::date) >= p_dias_pend;
  select coalesce(jsonb_agg(jsonb_build_object('n', p.numero_documento, 'item', left(p.item, 40), 'dias', public.exp_dias_uteis(coalesce(d.decidido_em, p.atualizado_em)::date)) order by d.decidido_em), '[]'::jsonb) into v_aprov
    from public.pedidos_compra_varejo p join public.decisoes_gerenciais d on d.id = p.decisao_id
   where d.status = 'aprovada' and p.status not in ('cancelado', 'comprado')
     and public.exp_dias_uteis(coalesce(d.decidido_em, p.atualizado_em)::date) >= p_dias_aprov;
  v_n1 := jsonb_array_length(v_pend); v_n2 := jsonb_array_length(v_aprov);
  select string_agg((e->>'n') || ' ' || (e->>'item') || ' (' || (e->>'dias') || 'd)', ' · ') into v_t1 from (select e from jsonb_array_elements(v_pend) e limit 4) s;
  select string_agg((e->>'n') || ' ' || (e->>'item') || ' (' || (e->>'dias') || 'd)', ' · ') into v_t2 from (select e from jsonb_array_elements(v_aprov) e limit 4) s;
  v_id1 := 'varejo-pend-' || v_semana || '-' || left(md5(coalesce(v_t1, '')), 8);
  v_id2 := 'varejo-aprov-' || v_semana || '-' || left(md5(coalesce(v_t2, '')), 8);
  if simular then return jsonb_build_object('pendentes', v_pend, 'aprovados_sem_compra', v_aprov); end if;

  update public.alertas set resolved = true where starts_with(id, 'varejo-pend-') and (v_n1 = 0 or not starts_with(id, v_id1)) and not resolved;
  update public.alertas set resolved = true where starts_with(id, 'varejo-aprov-') and (v_n2 = 0 or not starts_with(id, v_id2)) and not resolved;
  select array_agg(distinct lower(trim(email))) into v_lideres from public.colaboradores_vpsistema
   where is_department_lead and is_active and departamento ilike any (array['%Almoxarifado%', '%Log_stica%']) and email like '%@%';

  if v_n1 > 0 then
    v_criados := 0;
    foreach v_em in array coalesce(v_lideres, array[]::text[]) loop
      insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
      values (v_id1 || '-' || left(md5(v_em), 6), 'warning', v_n1 || ' pedido(s) interno(s) aguardando decisão há ' || p_dias_pend || '+ dias úteis', left(v_t1, 480), 'Almoxarifado', false, v_em, '/logistica/almoxarifado/pedidos/internos')
      on conflict (id) do nothing;
      v_criados := v_criados + 1;
    end loop;
    if v_criados = 0 then
      insert into public.alertas (id, level, title, sub, module, resolved, rota)
      values (v_id1, 'warning', v_n1 || ' pedido(s) interno(s) aguardando decisão há ' || p_dias_pend || '+ dias úteis', left(v_t1, 480), 'Almoxarifado', false, '/logistica/almoxarifado/pedidos/internos')
      on conflict (id) do nothing;
    end if;
  end if;
  if v_n2 > 0 then
    v_criados := 0;
    foreach v_em in array coalesce(v_lideres, array[]::text[]) loop
      insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
      values (v_id2 || '-' || left(md5(v_em), 6), 'warning', v_n2 || ' pedido(s) interno(s) aprovado(s) sem compra há ' || p_dias_aprov || '+ dias úteis', left(v_t2, 480), 'Almoxarifado', false, v_em, '/logistica/almoxarifado/pedidos/internos')
      on conflict (id) do nothing;
      v_criados := v_criados + 1;
    end loop;
    if v_criados = 0 then
      insert into public.alertas (id, level, title, sub, module, resolved, rota)
      values (v_id2, 'warning', v_n2 || ' pedido(s) interno(s) aprovado(s) sem compra há ' || p_dias_aprov || '+ dias úteis', left(v_t2, 480), 'Almoxarifado', false, '/logistica/almoxarifado/pedidos/internos')
      on conflict (id) do nothing;
    end if;
  end if;
  return jsonb_build_object('pendentes', v_n1, 'aprovados_sem_compra', v_n2);
end $$;
revoke all on function public.pcp_varejo_alertar_parados(boolean, int, int) from public, anon, authenticated;

select cron.schedule('pcp-varejo-alerta-parados', '30 10 * * 1-5', $$ select public.pcp_varejo_alertar_parados(false, 2, 3) $$);
