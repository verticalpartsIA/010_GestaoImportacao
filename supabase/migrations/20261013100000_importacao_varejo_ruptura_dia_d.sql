-- Importação Varejo · (1) RUPTURA: mês em que o item ficou sem estoque em ≥ 30% dos dias não pode ser lido como "baixa venda";
--                     (2) DIA D: atraso de decisão (criar pedido + decidir) soma-se ao prazo de chegada; cobertura em dias e data-limite do pedido.
-- Saldo diário reconstruído = físico de hoje − movimentos posteriores (importacao_varejo_mov traz todas as origens, desde 01/01/2025).
alter table public.importacao_varejo_sugestao_config
  add column if not exists atraso_decisao_dias integer not null default 50,   -- 45 d para criar o pedido + 5 d para decidir (informado pelo usuário)
  add column if not exists ruptura_limite numeric not null default 0.30,
  add column if not exists dia_d_aviso_dias integer not null default 15;       -- avisa o comprador quando faltam ≤ 15 d para o Dia D

create table if not exists public.importacao_varejo_ruptura (
  codigo text not null, mes date not null, dias_mes integer not null, dias_sem_estoque integer not null,
  primary key (codigo, mes));
alter table public.importacao_varejo_ruptura enable row level security;
drop policy if exists iv_ruptura_select on public.importacao_varejo_ruptura;
create policy iv_ruptura_select on public.importacao_varejo_ruptura for select using (true);

create or replace function public.iv_calcular_ruptura()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from importacao_varejo_ruptura;
  insert into importacao_varejo_ruptura (codigo, mes, dias_mes, dias_sem_estoque)
  with base as (
    select upper(e.codigo) c, coalesce(e.fisico, 0) f from importacao_varejo_estoque e
    where upper(e.codigo) in (select upper(codigo) from importacao_varejo_mov)
  ),
  mv as (select upper(codigo) c, dt_mov t, sum(qtde) q from importacao_varejo_mov group by 1, 2),
  seg as (   -- saldo ao FIM de cada data de movimento, válido até a próxima data de movimento
    select mv.c, mv.t ini,
           coalesce(lead(mv.t) over (partition by mv.c order by mv.t), current_date + 1) fim,
           b.f - coalesce(sum(mv.q) over (partition by mv.c order by mv.t desc rows between unbounded preceding and 1 preceding), 0) s
    from mv join base b on b.c = mv.c
  ),
  seg0 as (  -- antes do 1º movimento
    select s.c, date '2025-01-01' ini, min(s.ini) fim,
           b.f - (select sum(q) from mv where mv.c = s.c) s
    from seg s join base b on b.c = s.c group by s.c, b.f
  ),
  todos as (select * from seg union all select * from seg0),
  neg as (select c, greatest(ini, date '2025-01-01') ini, fim from todos where s <= 0 and fim > ini),
  meses as (select generate_series(date '2025-01-01', date_trunc('month', current_date)::date, interval '1 month')::date m),
  por_mes as (
    select n.c, m.m,
           sum(greatest(0, least(n.fim, (m.m + interval '1 month')::date) - greatest(n.ini, m.m))) dsem
    from neg n join meses m on n.ini < (m.m + interval '1 month')::date and n.fim > m.m group by n.c, m.m
  )
  select b.c, m.m, ((m.m + interval '1 month')::date - m.m), least(coalesce(p.dsem, 0), (m.m + interval '1 month')::date - m.m)
  from base b cross join meses m left join por_mes p on p.c = b.c and p.m = m.m
  where m.m < date_trunc('month', current_date)::date and coalesce(p.dsem, 0) > 0;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.iv_calcular_ruptura() from public, anon, authenticated;
grant execute on function public.iv_calcular_ruptura() to service_role;
