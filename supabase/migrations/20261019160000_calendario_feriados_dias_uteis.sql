-- Calendário de feriados + contagem de dias úteis (base do SLA por fase do Acompanhamento de Obra).
-- A gordura do SLA NÃO cobre calendário: o mês com mais feriados fica mais longo por conta daqui.
create table if not exists public.calendario_feriados (
  data date primary key,
  descricao text not null,
  abrangencia text not null default 'nacional' check (abrangencia in ('nacional', 'sp_estado', 'sp_cidade', 'outro')),
  conta_no_sla boolean not null default true,   -- false = feriado local que não para todas as obras
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
comment on table public.calendario_feriados is 'Feriados e pontos facultativos que não contam como dia útil no SLA. Admin edita; ponte/feriado local entra como linha manual.';

alter table public.calendario_feriados enable row level security;
drop policy if exists vp_cal_sel on public.calendario_feriados;
drop policy if exists vp_cal_ins on public.calendario_feriados;
drop policy if exists vp_cal_upd on public.calendario_feriados;
drop policy if exists vp_cal_del on public.calendario_feriados;
create policy vp_cal_sel on public.calendario_feriados for select to authenticated using ((select public.vp_usuario_ativo()));
create policy vp_cal_ins on public.calendario_feriados for insert to authenticated with check ((select public.vp_eh_admin()));
create policy vp_cal_upd on public.calendario_feriados for update to authenticated using ((select public.vp_eh_admin())) with check ((select public.vp_eh_admin()));
create policy vp_cal_del on public.calendario_feriados for delete to authenticated using ((select public.vp_eh_admin()));

insert into public.calendario_feriados (data, descricao, abrangencia, conta_no_sla) values
 -- 2026
 ('2026-01-01','Confraternização Universal','nacional',true),
 ('2026-01-25','Aniversário de São Paulo (cidade)','sp_cidade',false),
 ('2026-02-16','Carnaval (segunda)','nacional',true),
 ('2026-02-17','Carnaval (terça)','nacional',true),
 ('2026-04-03','Sexta-feira Santa','nacional',true),
 ('2026-04-21','Tiradentes','nacional',true),
 ('2026-05-01','Dia do Trabalho','nacional',true),
 ('2026-06-04','Corpus Christi','nacional',true),
 ('2026-07-09','Revolução Constitucionalista (SP)','sp_estado',true),
 ('2026-09-07','Independência do Brasil','nacional',true),
 ('2026-10-12','Nossa Senhora Aparecida','nacional',true),
 ('2026-11-02','Finados','nacional',true),
 ('2026-11-15','Proclamação da República','nacional',true),
 ('2026-11-20','Consciência Negra','nacional',true),
 ('2026-12-25','Natal','nacional',true),
 -- 2027
 ('2027-01-01','Confraternização Universal','nacional',true),
 ('2027-01-25','Aniversário de São Paulo (cidade)','sp_cidade',false),
 ('2027-02-08','Carnaval (segunda)','nacional',true),
 ('2027-02-09','Carnaval (terça)','nacional',true),
 ('2027-03-26','Sexta-feira Santa','nacional',true),
 ('2027-04-21','Tiradentes','nacional',true),
 ('2027-05-01','Dia do Trabalho','nacional',true),
 ('2027-05-27','Corpus Christi','nacional',true),
 ('2027-07-09','Revolução Constitucionalista (SP)','sp_estado',true),
 ('2027-09-07','Independência do Brasil','nacional',true),
 ('2027-10-12','Nossa Senhora Aparecida','nacional',true),
 ('2027-11-02','Finados','nacional',true),
 ('2027-11-15','Proclamação da República','nacional',true),
 ('2027-11-20','Consciência Negra','nacional',true),
 ('2027-12-25','Natal','nacional',true),
 -- 2028
 ('2028-01-01','Confraternização Universal','nacional',true),
 ('2028-01-25','Aniversário de São Paulo (cidade)','sp_cidade',false),
 ('2028-02-28','Carnaval (segunda)','nacional',true),
 ('2028-02-29','Carnaval (terça)','nacional',true),
 ('2028-04-14','Sexta-feira Santa','nacional',true),
 ('2028-04-21','Tiradentes','nacional',true),
 ('2028-05-01','Dia do Trabalho','nacional',true),
 ('2028-06-15','Corpus Christi','nacional',true),
 ('2028-07-09','Revolução Constitucionalista (SP)','sp_estado',true),
 ('2028-09-07','Independência do Brasil','nacional',true),
 ('2028-10-12','Nossa Senhora Aparecida','nacional',true),
 ('2028-11-02','Finados','nacional',true),
 ('2028-11-15','Proclamação da República','nacional',true),
 ('2028-11-20','Consciência Negra','nacional',true),
 ('2028-12-25','Natal','nacional',true)
on conflict (data) do nothing;

-- Dias úteis entre duas datas, contando as DUAS pontas (seg 05/10 a sex 09/10 = 5). Fora fim de semana e feriado ativo que conta no SLA.
create or replace function public.dias_uteis(p_ini date, p_fim date)
returns integer language sql stable as $$
  select case when p_fim < p_ini then 0 else (
    select count(*)::int from generate_series(p_ini, p_fim, interval '1 day') g
     where extract(isodow from g) < 6
       and not exists (select 1 from public.calendario_feriados f where f.data = g::date and f.ativo and f.conta_no_sla)
  ) end
$$;

-- Data que fica p_n dias úteis depois de p_ini (p_ini não conta: sexta + 1 = segunda). p_n = 0 devolve p_ini.
create or replace function public.somar_dias_uteis(p_ini date, p_n integer)
returns date language plpgsql stable as $$
declare r date;
begin
  if p_n is null or p_n < 0 then raise exception 'p_n precisa ser >= 0'; end if;
  if p_n = 0 then return p_ini; end if;
  select d into r from (
    select g::date d, row_number() over (order by g) rn
      from generate_series(p_ini + 1, p_ini + (p_n * 2 + 30), interval '1 day') g
     where extract(isodow from g) < 6
       and not exists (select 1 from public.calendario_feriados f where f.data = g::date and f.ativo and f.conta_no_sla)
  ) t where rn = p_n;
  return r;
end $$;

revoke all on function public.dias_uteis(date, date) from public, anon;
revoke all on function public.somar_dias_uteis(date, integer) from public, anon;
grant execute on function public.dias_uteis(date, date) to authenticated, service_role;
grant execute on function public.somar_dias_uteis(date, integer) to authenticated, service_role;
