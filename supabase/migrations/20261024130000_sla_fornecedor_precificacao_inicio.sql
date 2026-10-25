-- Prazos (24/10/2026, decisão do Gelson):
--  * Fornecedor: o tempo é só acompanhado, nunca gera atraso (sem prazo_em).
--  * Precificação: as 4h comerciais medem até o Financeiro ABRIR a cotação (existir precificação). Coluna iniciado_em marca isso.
alter table public.gatilhos add column if not exists iniciado_em timestamptz;

update public.gatilhos set prazo_em = null, due_date = null
 where evento_key = 'SLA_FORNECEDOR' and concluido_em is null and coalesce(status,'') <> 'encerrado' and prazo_em is not null;

update public.gatilhos g set iniciado_em = p.primeira
  from (select numero_cotacao, min(created_at) primeira from public.precificacoes_elevador where numero_cotacao is not null group by 1) p
 where g.evento_key = 'PRECIFICACAO' and g.concluido_em is null and g.iniciado_em is null and g.numero_cotacao = p.numero_cotacao;

create or replace function public.trg_precificacao_marca_inicio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    update public.gatilhos set iniciado_em = coalesce(iniciado_em, now())
     where evento_key = 'PRECIFICACAO' and concluido_em is null and iniciado_em is null and numero_cotacao = new.numero_cotacao;
  exception when others then null;   -- nunca impede criar a precificação
  end;
  return new;
end $$;
drop trigger if exists trg_precificacao_marca_inicio on public.precificacoes_elevador;
create trigger trg_precificacao_marca_inicio after insert on public.precificacoes_elevador
  for each row when (new.numero_cotacao is not null) execute function public.trg_precificacao_marca_inicio();
revoke all on function public.trg_precificacao_marca_inicio() from public, anon, authenticated;

-- Aviso diário de prazos: etapa já aberta pela Financeiro (iniciado_em) não conta como atrasada.
create or replace function public.gatilhos_alertar_prazos(simular boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lista jsonb; v_n int; v_id text; v_sub text; v_itens text[];
begin
  select coalesce(jsonb_agg(x order by (x->>'atraso_h')::int desc), '[]'::jsonb) into v_lista from (
    select jsonb_build_object('cot', g.numero_cotacao, 'etapa', g.evento_key, 'nome', g.trigger_name,
             'atraso_h', round(extract(epoch from (now() - g.prazo_em)) / 3600)::int) x
      from public.gatilhos g
     where g.origem = 'automatico' and g.concluido_em is null and coalesce(g.status, '') <> 'encerrado'
       and g.evento_key not like 'LEMBRETE\_\_%' and g.evento_key not in ('FIN_SCORE', 'FIN_AVAL_VENDA', 'OWNER_APROVOU')
       and g.iniciado_em is null and g.prazo_em < now()
  ) t;
  v_n := jsonb_array_length(v_lista);
  if v_n = 0 then
    if not simular then update public.alertas set resolved = true where starts_with(id, 'gat-prazos-') and not resolved; end if;
    return jsonb_build_object('atrasadas', 0, 'criado', false);
  end if;

  select array_agg('Cot. ' || (e->>'cot') || ' · ' || (e->>'nome') || ' (' || greatest(((e->>'atraso_h')::int / 24), 0) || 'd)')
    into v_itens from (select e from jsonb_array_elements(v_lista) e limit 3) s;
  v_sub := left(array_to_string(v_itens, ' · ') || case when v_n > 3 then ' · +' || (v_n - 3) || ' outras' else '' end, 480);
  v_id := 'gat-prazos-' || to_char(now() at time zone 'America/Sao_Paulo', 'IYYY-IW') || '-' ||
          left(md5((select string_agg((e->>'cot') || (e->>'etapa'), ',' order by (e->>'cot'), (e->>'etapa')) from jsonb_array_elements(v_lista) e)), 8);
  if simular then
    return jsonb_build_object('atrasadas', v_n, 'id', v_id, 'titulo', v_n || ' etapa(s) com prazo vencido', 'sub', v_sub, 'criado', false);
  end if;
  update public.alertas set resolved = true where starts_with(id, 'gat-prazos-') and id <> v_id and not resolved;
  insert into public.alertas (id, level, title, sub, module, resolved, rota)
  values (v_id, 'warning', v_n || ' etapa(s) com prazo vencido', v_sub, 'Financeiro', false, '/adm-financeiro/financeiro')
  on conflict (id) do nothing;
  return jsonb_build_object('atrasadas', v_n, 'id', v_id, 'criado', true);
end $$;

-- Só o banco (cron) executa; o navegador (anon) não.
revoke all on function public.gatilhos_alertar_prazos(boolean) from public, anon, authenticated;
