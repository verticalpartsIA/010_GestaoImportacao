-- Boletos Avisos: títulos SEM boleto também entram (12/11/2026, pedido do Gelson: há clientes que pagam por
-- depósito/transferência e estão no Contas a Receber do Omie, como a Escamax). tem_boleto=false marca esses.
-- Os que já existem são todos com boleto (padrão true). A função boletos-avisos só traz sem-boleto com até
-- 180 dias de atraso (constante LIMITE_SEM_BOLETO_DIAS na função).
-- Rollback: alter table public.boletos_avisos_boletos drop column tem_boleto; e recriar a visão sem qtd_sem_boleto
--           (a visão depende da coluna: derrubar a visão antes, com drop view, e recriar pela migration 20261111100000).

alter table public.boletos_avisos_boletos add column if not exists tem_boleto boolean not null default true;

create or replace view public.boletos_avisos_resumo_v with (security_invoker = true) as
with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
agg as (
  select b.codigo_cliente_omie,
         count(*)                                              as qtd_boletos,
         sum(b.valor)                                          as valor_total,
         min(b.data_vencimento)                                as primeiro_vencimento,
         max(greatest((select d from hoje) - b.data_vencimento, 0)) as dias_atraso,
         bool_or(b.data_vencimento < (select d from hoje))     as tem_atrasado,
         bool_or(b.data_vencimento = (select d from hoje))     as vence_hoje,
         count(*) filter (where not b.tem_boleto)              as qtd_sem_boleto
    from public.boletos_avisos_boletos b
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
