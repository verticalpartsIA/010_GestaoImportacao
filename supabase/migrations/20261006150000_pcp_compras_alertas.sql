-- Pedidos de compra (Almoxarifado) — alertas diários (06/10/2026)
-- C: pedido de compra com previsão de chegada REAL vencida (previsão maior que a data do pedido — o Omie preenche a previsão
--    com a data do pedido quando ninguém combinou prazo, e isso não é atraso).
-- E: requisição enviada ao Omie que não virou pedido há 3+ dias úteis.
-- Destinatários: líderes ativos de Almoxarifado/Logística (mesmo critério dos outros alertas do PCP); sem líder, alerta global.

create or replace function public.pcp_compras_alertar(simular boolean default false, p_dias_req int default 3) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_atr jsonb; v_req jsonb; v_n1 int; v_n2 int; v_t1 text; v_t2 text; v_id1 text; v_id2 text; v_em text; v_criados int;
  v_semana text := to_char(now() at time zone 'America/Sao_Paulo', 'IYYY-IW');
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_lideres text[];
begin
  select coalesce(jsonb_agg(x order by (x->>'dias')::int desc), '[]'::jsonb) into v_atr from (
    select jsonb_build_object('ped', numero_pedido, 'dias', (v_hoje - max(data_previsao))) x
      from public.pcp_compras_itens
     group by pedido_id, numero_pedido
    having bool_or(qtde_recebida < quantidade) and max(data_previsao) is not null
       and max(data_previsao) > max(data_pedido) and max(data_previsao) < v_hoje
  ) t;
  select coalesce(jsonb_agg(jsonb_build_object('cod', itens, 'dias', public.exp_dias_uteis(dia)) order by dia), '[]'::jsonb) into v_req from (
    select f.id, coalesce(f.enviado_em, f.criado_em)::date dia,
           (select string_agg(i->>'codigo', ', ') from jsonb_array_elements(f.payload->'meta'->'itens') i) itens
      from public.pcp_omie_fila f
     where f.tipo = 'requisicao_compra' and f.status = 'enviado' and jsonb_typeof(f.payload->'meta'->'itens') = 'array'
       and public.exp_dias_uteis(coalesce(f.enviado_em, f.criado_em)::date) >= p_dias_req
       and not exists (select 1 from jsonb_array_elements(f.payload->'meta'->'itens') i
                        join public.pcp_compras_itens c on c.codigo = i->>'codigo' and c.data_pedido >= coalesce(f.enviado_em, f.criado_em)::date)
  ) t;
  v_n1 := jsonb_array_length(v_atr); v_n2 := jsonb_array_length(v_req);
  select string_agg('Ped. ' || (e->>'ped') || ' (' || (e->>'dias') || 'd)', ' · ') into v_t1 from (select e from jsonb_array_elements(v_atr) e limit 5) s;
  if v_n1 > 5 then v_t1 := v_t1 || ' · +' || (v_n1 - 5) || ' outros'; end if;
  select string_agg(e->>'cod' || ' (' || (e->>'dias') || ' dias úteis)', ' · ') into v_t2 from (select e from jsonb_array_elements(v_req) e limit 5) s;
  v_id1 := 'compra-atraso-' || v_semana || '-' || left(md5(coalesce(v_t1, '')), 8);
  v_id2 := 'req-parada-' || v_semana || '-' || left(md5(coalesce(v_t2, '')), 8);
  if simular then return jsonb_build_object('pedidos_atrasados', v_atr, 'requisicoes_paradas', v_req); end if;

  update public.alertas set resolved = true where starts_with(id, 'compra-atraso-') and (v_n1 = 0 or not starts_with(id, v_id1)) and not resolved;
  update public.alertas set resolved = true where starts_with(id, 'req-parada-') and (v_n2 = 0 or not starts_with(id, v_id2)) and not resolved;

  select array_agg(distinct lower(trim(email))) into v_lideres from public.colaboradores_vpsistema
   where is_department_lead and is_active and departamento ilike any (array['%Almoxarifado%', '%Log_stica%']) and email like '%@%';
  if v_n1 > 0 then
    v_criados := 0;
    foreach v_em in array coalesce(v_lideres, array[]::text[]) loop
      insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
      values (v_id1 || '-' || left(md5(v_em), 6), 'warning', v_n1 || ' pedido(s) de compra com previsão de chegada vencida', left(v_t1, 480), 'Almoxarifado', false, v_em, '/logistica/almoxarifado/pedidos')
      on conflict (id) do nothing;
      v_criados := v_criados + 1;
    end loop;
    if v_criados = 0 then
      insert into public.alertas (id, level, title, sub, module, resolved, rota)
      values (v_id1, 'warning', v_n1 || ' pedido(s) de compra com previsão de chegada vencida', left(v_t1, 480), 'Almoxarifado', false, '/logistica/almoxarifado/pedidos')
      on conflict (id) do nothing;
    end if;
  end if;
  if v_n2 > 0 then
    v_criados := 0;
    foreach v_em in array coalesce(v_lideres, array[]::text[]) loop
      insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
      values (v_id2 || '-' || left(md5(v_em), 6), 'warning', v_n2 || ' requisição(ões) enviada(s) ao Omie sem virar pedido', left(v_t2, 480), 'Almoxarifado', false, v_em, '/logistica/almoxarifado/pedidos/requisicoes')
      on conflict (id) do nothing;
      v_criados := v_criados + 1;
    end loop;
    if v_criados = 0 then
      insert into public.alertas (id, level, title, sub, module, resolved, rota)
      values (v_id2, 'warning', v_n2 || ' requisição(ões) enviada(s) ao Omie sem virar pedido', left(v_t2, 480), 'Almoxarifado', false, '/logistica/almoxarifado/pedidos/requisicoes')
      on conflict (id) do nothing;
    end if;
  end if;
  return jsonb_build_object('pedidos_atrasados', v_n1, 'requisicoes_paradas', v_n2);
end $$;
revoke all on function public.pcp_compras_alertar(boolean, int) from public, anon, authenticated;

select cron.schedule('pcp-compras-alerta-atrasos', '20 10 * * 1-5', $$ select public.pcp_compras_alertar(false, 3) $$);
