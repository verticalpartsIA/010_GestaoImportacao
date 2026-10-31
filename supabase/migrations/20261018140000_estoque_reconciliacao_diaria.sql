-- Estoque — fase 4: reconciliação diária do livro-razão (estoque_movimentos). SÓ LÊ o banco: não chama o Omie, não envia nada.
-- Antes de o envio real ao Omie existir (etapa 3), o risco a vigiar é ajuste parado ou repetido na fila de confirmação:
--  (a) ajuste pendente de decisão há 2+ dias úteis (a contagem envelhece e o número deixa de refletir a prateleira);
--  (b) item com 2+ ajustes pendentes ao mesmo tempo (contagens repetidas sem decisão: confirmar todos seria baixar/dar entrada em dobro).
-- Avisa os líderes de Almoxarifado/Logística (sem líder cadastrado, vira alerta global); o alerta resolve sozinho quando a lista esvazia.
-- Usa public.exp_dias_uteis(date) (migration 20261006140000). Mesmo desenho de pcp_varejo_alertar_parados.

create or replace function public.estoque_reconciliar(simular boolean default false, p_dias int default 2) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pend jsonb; v_dup jsonb; v_n1 int; v_n2 int; v_t1 text; v_t2 text; v_id1 text; v_id2 text; v_em text; v_criados int; v_lideres text[];
  v_conf int; v_semana text := to_char(now() at time zone 'America/Sao_Paulo', 'IYYY-IW');
begin
  select coalesce(jsonb_agg(jsonb_build_object('codigo', m.codigo, 'qtd', m.quantidade, 'dias', public.exp_dias_uteis(m.criado_em::date)) order by m.criado_em), '[]'::jsonb)
    into v_pend
    from public.estoque_movimentos m
   where m.status_omie = 'pendente_confirmacao' and public.exp_dias_uteis(m.criado_em::date) >= p_dias;
  select coalesce(jsonb_agg(jsonb_build_object('codigo', x.codigo, 'n', x.n, 'soma', x.soma) order by x.codigo), '[]'::jsonb)
    into v_dup
    from (select codigo, count(*) n, sum(quantidade) soma from public.estoque_movimentos
           where status_omie = 'pendente_confirmacao' group by codigo having count(*) > 1) x;
  select count(*) into v_conf from public.estoque_movimentos where status_omie = 'confirmado';   -- só informativo: aguardam o envio (etapa 3)
  v_n1 := jsonb_array_length(v_pend); v_n2 := jsonb_array_length(v_dup);
  select string_agg((e->>'codigo') || ' ' || (e->>'qtd') || ' (' || (e->>'dias') || 'd)', ' · ') into v_t1 from (select e from jsonb_array_elements(v_pend) e limit 4) s;
  select string_agg((e->>'codigo') || ' ×' || (e->>'n') || ' (soma ' || (e->>'soma') || ')', ' · ') into v_t2 from (select e from jsonb_array_elements(v_dup) e limit 4) s;
  v_id1 := 'estoque-ajuste-pend-' || v_semana || '-' || left(md5(coalesce(v_t1, '')), 8);
  v_id2 := 'estoque-ajuste-dup-' || v_semana || '-' || left(md5(coalesce(v_t2, '')), 8);
  if simular then
    return jsonb_build_object('pendentes_antigos', v_pend, 'itens_com_ajustes_repetidos', v_dup, 'confirmados_aguardando_envio', v_conf);
  end if;

  update public.alertas set resolved = true where starts_with(id, 'estoque-ajuste-pend-') and (v_n1 = 0 or not starts_with(id, v_id1)) and not resolved;
  update public.alertas set resolved = true where starts_with(id, 'estoque-ajuste-dup-') and (v_n2 = 0 or not starts_with(id, v_id2)) and not resolved;
  select array_agg(distinct lower(trim(email))) into v_lideres from public.colaboradores_vpsistema
   where is_department_lead and is_active and departamento ilike any (array['%Almoxarifado%', '%Log_stica%']) and email like '%@%';

  if v_n1 > 0 then
    v_criados := 0;
    foreach v_em in array coalesce(v_lideres, array[]::text[]) loop
      insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
      values (v_id1 || '-' || left(md5(v_em), 6), 'warning', v_n1 || ' ajuste(s) de estoque aguardando decisão há ' || p_dias || '+ dias úteis', left(v_t1, 480), 'Almoxarifado', false, v_em, '/logistica/almoxarifado/ajustes')
      on conflict (id) do nothing;
      v_criados := v_criados + 1;
    end loop;
    if v_criados = 0 then
      insert into public.alertas (id, level, title, sub, module, resolved, rota)
      values (v_id1, 'warning', v_n1 || ' ajuste(s) de estoque aguardando decisão há ' || p_dias || '+ dias úteis', left(v_t1, 480), 'Almoxarifado', false, '/logistica/almoxarifado/ajustes')
      on conflict (id) do nothing;
    end if;
  end if;
  if v_n2 > 0 then
    v_criados := 0;
    foreach v_em in array coalesce(v_lideres, array[]::text[]) loop
      insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
      values (v_id2 || '-' || left(md5(v_em), 6), 'warning', v_n2 || ' item(ns) com mais de um ajuste pendente (risco de ajuste em dobro)', left(v_t2, 480), 'Almoxarifado', false, v_em, '/logistica/almoxarifado/ajustes')
      on conflict (id) do nothing;
      v_criados := v_criados + 1;
    end loop;
    if v_criados = 0 then
      insert into public.alertas (id, level, title, sub, module, resolved, rota)
      values (v_id2, 'warning', v_n2 || ' item(ns) com mais de um ajuste pendente (risco de ajuste em dobro)', left(v_t2, 480), 'Almoxarifado', false, '/logistica/almoxarifado/ajustes')
      on conflict (id) do nothing;
    end if;
  end if;
  return jsonb_build_object('pendentes_antigos', v_n1, 'itens_com_ajustes_repetidos', v_n2, 'confirmados_aguardando_envio', v_conf);
end $$;
revoke all on function public.estoque_reconciliar(boolean, int) from public, anon, authenticated;

-- seg–sex 10:35 UTC (07:35 Brasília), depois dos syncs de estoque da madrugada e longe dos outros alertas do PCP.
select cron.schedule('estoque-reconciliacao-diaria', '35 10 * * 1-5', $$ select public.estoque_reconciliar(false, 2) $$);
