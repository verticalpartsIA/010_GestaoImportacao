-- Prazos & Pendências · aviso diário de etapa com prazo vencido (03/10/2026).
-- Antes: o prazo estourava e ninguém era avisado — só aparecia se alguém abrisse a tela. Agora um resumo único por dia
-- (seg–sex 07:20 Brasília) entra na Central de Notificações com link para /adm-financeiro/financeiro.
-- Regras (iguais às da tela, src/gatilhos-engine.js): só etapas automáticas abertas, fora as opcionais (score/aval de venda/
-- responsável) e as encerradas; etapa antiga sem prazo gravado usa o SLA atual (hoje só PROPOSTA_PREP = 24h).
-- Sem spam: id = semana ISO + assinatura da lista; mesma lista na mesma semana = nada novo; lista mudou = aviso novo e os
-- anteriores viram resolvidos; sem atraso = resolve tudo. {simular:true} devolve o que criaria sem gravar.
create or replace function public.gatilhos_alertar_prazos(simular boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lista jsonb; v_n int; v_id text; v_sub text; v_itens text[];
begin
  select coalesce(jsonb_agg(x order by (x->>'atraso_h')::int desc), '[]'::jsonb) into v_lista from (
    select jsonb_build_object('cot', g.numero_cotacao, 'etapa', g.evento_key, 'nome', g.trigger_name,
             'atraso_h', round(extract(epoch from (now() - coalesce(g.prazo_em, g.nascido_em + interval '24 hours'))) / 3600)::int) x
      from public.gatilhos g
     where g.origem = 'automatico' and g.concluido_em is null and coalesce(g.status, '') <> 'encerrado'
       and g.evento_key not like 'LEMBRETE\_\_%' and g.evento_key not in ('FIN_SCORE', 'FIN_AVAL_VENDA', 'OWNER_APROVOU')
       and coalesce(g.prazo_em, case when g.evento_key = 'PROPOSTA_PREP' then g.nascido_em + interval '24 hours' end) < now()
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

do $$ begin perform cron.unschedule(jobid) from cron.job where jobname = 'gatilhos-alerta-prazos-diario'; end $$;
select cron.schedule('gatilhos-alerta-prazos-diario', '20 10 * * 1-5', $$ select public.gatilhos_alertar_prazos(false) $$);

-- Link padrão por prefixo também para `gat-prazos-` (caso algum produtor futuro não informe a rota).
create or replace function public.alertas_rota_por_id(p_id text) returns text
language sql immutable as $$
  select case
    when p_id like 'prop-%'      then '/comercial/propostas'
    when p_id like 'cv-%'        then '/juridico/contrato-venda-equipamentos'
    when p_id like 'ci-%'        then '/juridico/contrato-instalador'
    when p_id like 'dec\_%'      then '/geral/decisoes'
    when p_id like 'estouro-%'   then '/adm-financeiro/aval-financeiro'
    when p_id like 'avais-%'     then '/adm-financeiro/aval-financeiro'
    when p_id like 'fw-%'        then '/engenharia/ficha-tecnica'
    when p_id like 'sol-%'       then '/engenharia/solicitacoes-produto'
    when p_id like 'vist%'       then '/engenharia/dossier-obra'
    when p_id like 'pf-%'        then '/adm-financeiro/cotacoes-fornecedor'
    when p_id like 'inbox-%'     then '/geral/inbox'
    when p_id like 'gat-prazos-%' then '/adm-financeiro/financeiro'
    else null
  end
$$;
