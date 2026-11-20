-- Boletos Avisos: dia sem expediente (17/11/2026, decisão do Gelson).
-- Nenhum aviso sai em sábado, domingo ou feriado, e o vencimento que vale é o próximo dia útil (regra bancária:
-- boleto que vence em dia sem expediente pode ser pago no dia útil seguinte sem encargos).
-- Dia sem expediente = fim de semana + calendario_feriados ativo que bloqueia envio (nacionais, estaduais de SP e
-- municipais de Guarulhos) + Carnaval (segunda e terça: banco fechado, mesmo sendo ponto facultativo para os avisos
-- do gi-avisos). Mesma regra de BoletosAvisosCalc.conjuntoSemExpediente (src/boletos-avisos-calc.js).
-- A visão da lista passa a usar o vencimento efetivo no semáforo e nos dias de atraso.
-- Rollback: recriar a visão pela migration 20261112100000 e
--           drop function public.boletos_avisos_venc_efetivo(date); drop function public.boletos_avisos_sem_expediente(date);

create or replace function public.boletos_avisos_sem_expediente(p_dia date)
returns boolean language sql stable set search_path = '' as $$
  select extract(isodow from p_dia) >= 6
      or exists (select 1 from public.calendario_feriados f
                  where f.data = p_dia and f.ativo and (f.bloqueia_envio or f.descricao ilike 'Carnaval%'));
$$;

create or replace function public.boletos_avisos_venc_efetivo(p_venc date)
returns date language sql stable set search_path = '' as $$
  select min(g::date) from generate_series(p_venc, p_venc + 60, interval '1 day') g
   where not public.boletos_avisos_sem_expediente(g::date);
$$;

revoke all on function public.boletos_avisos_sem_expediente(date) from public, anon;
revoke all on function public.boletos_avisos_venc_efetivo(date) from public, anon;
grant execute on function public.boletos_avisos_sem_expediente(date) to authenticated, service_role;
grant execute on function public.boletos_avisos_venc_efetivo(date) to authenticated, service_role;

create or replace view public.boletos_avisos_resumo_v with (security_invoker = true) as
with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
agg as (
  select b.codigo_cliente_omie,
         count(*)                                              as qtd_boletos,
         sum(b.valor)                                          as valor_total,
         min(b.data_vencimento)                                as primeiro_vencimento,
         max(greatest((select d from hoje) - e.venc, 0))       as dias_atraso,
         bool_or(e.venc < (select d from hoje))                as tem_atrasado,
         bool_or(e.venc = (select d from hoje))                as vence_hoje,
         count(*) filter (where not b.tem_boleto)              as qtd_sem_boleto
    from public.boletos_avisos_boletos b
    cross join lateral (select public.boletos_avisos_venc_efetivo(b.data_vencimento) as venc) e
   where b.aberto
   group by b.codigo_cliente_omie
)
select a.codigo_cliente_omie,
       coalesce(c.razao_social, 'Cliente ' || a.codigo_cliente_omie) as razao_social,
       c.cnpj,
       coalesce(c.emails, '{}') as emails,
       coalesce(c.email_origem, 'nenhum') as email_origem,
       a.qtd_boletos, a.valor_total, a.primeiro_vencimento, a.dias_atraso,
       case when a.tem_atrasado then 'atrasado' when a.vence_hoje then 'vence_hoje' else 'em_dia' end as situacao,
       u.criado_em as ultimo_aviso_em, u.etapa as ultimo_aviso_etapa, u.status as ultimo_aviso_status,
       a.qtd_sem_boleto
  from agg a
  left join public.boletos_avisos_clientes c on c.codigo_cliente_omie = a.codigo_cliente_omie
  left join lateral (
    select e.criado_em, e.etapa, e.status
      from public.boletos_avisos_envios e
     where e.codigo_cliente_omie = a.codigo_cliente_omie
     order by e.criado_em desc limit 1
  ) u on true;
revoke all on public.boletos_avisos_resumo_v from anon, authenticated;
grant select on public.boletos_avisos_resumo_v to authenticated;
grant select on public.boletos_avisos_resumo_v to service_role;
