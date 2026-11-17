-- Boletos Avisos › Índice de inadimplência e Consulta de cliente (score) (17/11/2026, pedido do Gelson).
-- Hoje o banco só guarda boleto em aberto; para dizer se um cliente é bom pagador e medir a inadimplência do
-- passado é preciso o histórico de títulos a receber com data de vencimento e de pagamento (desde 01/01/2024).
-- Quem lê: boletos_avisos_pode() (os 3 fixos + alçada boletos-avisos/ver). Quem grava: só a Edge Function
-- `boletos-score-sync` (chave de serviço). Limites do score: só os 3 fixos alteram (boletos_avisos_pode_gerir()).
-- Tudo nasce com RLS fechada (Art. 26). Nada escreve no Omie.
-- Rollback: drop function public.boletos_avisos_indice(date, date);
--           drop view public.boletos_avisos_score_v;
--           drop table public.boletos_avisos_historico, public.boletos_avisos_score_config, public.boletos_avisos_score_cursor;

-- 1) Histórico de títulos a receber (pagos e abertos; cancelado fica marcado e fora das contas)
create table if not exists public.boletos_avisos_historico (
  codigo_lancamento_omie bigint primary key,
  codigo_cliente_omie bigint not null,
  numero_documento text,
  numero_parcela text,
  data_vencimento date not null,
  data_pagamento date,
  valor numeric(14, 2),
  valor_pago numeric(14, 2),
  status_omie text,
  pago boolean not null default false,
  cancelado boolean not null default false,
  tem_boleto boolean,
  atualizado_em timestamptz not null default now()
);
create index if not exists boletos_avisos_historico_cliente_idx on public.boletos_avisos_historico (codigo_cliente_omie, data_vencimento);
create index if not exists boletos_avisos_historico_venc_idx on public.boletos_avisos_historico (data_vencimento) where not cancelado;

-- 2) Limites do score (uma linha). Padrão proposto em 17/11/2026; o Gelson ajusta aqui.
create table if not exists public.boletos_avisos_score_config (
  id boolean primary key default true check (id),
  tolerancia_dias integer not null default 0 check (tolerancia_dias between 0 and 30),
  minimo_titulos integer not null default 3 check (minimo_titulos between 1 and 50),
  pontualidade_a numeric(5, 2) not null default 90 check (pontualidade_a between 0 and 100),
  pontualidade_b numeric(5, 2) not null default 75 check (pontualidade_b between 0 and 100),
  pontualidade_c numeric(5, 2) not null default 50 check (pontualidade_c between 0 and 100),
  atraso_max_a integer not null default 15 check (atraso_max_a >= 0),
  atraso_medio_b integer not null default 10 check (atraso_medio_b >= 0),
  atraso_max_b integer not null default 30 check (atraso_max_b >= 0),
  aberto_vencido_d integer not null default 30 check (aberto_vencido_d >= 0),
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
insert into public.boletos_avisos_score_config (id) values (true) on conflict (id) do nothing;

-- 3) Cursor da carga em fases (só a função de sincronização usa; sem política = ninguém mais enxerga)
create table if not exists public.boletos_avisos_score_cursor (
  id boolean primary key default true check (id),
  fase text not null default 'ocioso' check (fase in ('ocioso', 'carga', 'incremental')),
  etapa text not null default 'titulos' check (etapa in ('titulos', 'clientes')),
  janela_idx integer not null default 0,
  proxima_pagina integer not null default 1,
  titulos_lidos integer not null default 0,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  ultimo_resultado jsonb,
  atualizado_em timestamptz not null default now()
);
insert into public.boletos_avisos_score_cursor (id) values (true) on conflict (id) do nothing;

-- 4) RLS fechada
alter table public.boletos_avisos_historico    enable row level security;
alter table public.boletos_avisos_score_config enable row level security;
alter table public.boletos_avisos_score_cursor enable row level security;

revoke all on public.boletos_avisos_historico, public.boletos_avisos_score_config, public.boletos_avisos_score_cursor from anon, authenticated;
grant select on public.boletos_avisos_historico, public.boletos_avisos_score_config to authenticated;
grant update (tolerancia_dias, minimo_titulos, pontualidade_a, pontualidade_b, pontualidade_c, atraso_max_a, atraso_medio_b,
              atraso_max_b, aberto_vencido_d, atualizado_em, atualizado_por) on public.boletos_avisos_score_config to authenticated;
grant all on public.boletos_avisos_historico, public.boletos_avisos_score_config, public.boletos_avisos_score_cursor to service_role;

drop policy if exists boletos_avisos_historico_sel on public.boletos_avisos_historico;
create policy boletos_avisos_historico_sel on public.boletos_avisos_historico for select to authenticated
  using ((select public.boletos_avisos_pode()));
drop policy if exists boletos_avisos_score_config_sel on public.boletos_avisos_score_config;
create policy boletos_avisos_score_config_sel on public.boletos_avisos_score_config for select to authenticated
  using ((select public.boletos_avisos_pode()));
drop policy if exists boletos_avisos_score_config_upd on public.boletos_avisos_score_config;
create policy boletos_avisos_score_config_upd on public.boletos_avisos_score_config for update to authenticated
  using ((select public.boletos_avisos_pode_gerir())) with check ((select public.boletos_avisos_pode_gerir()));

-- 5) Visão por cliente. "Vencido" = vencimento anterior a hoje (data de Brasília); vence hoje ainda não é atraso.
--    Em dia = pago até vencimento + tolerância. Título pago sem data de pagamento não entra em nenhuma conta
--    (aparece em pagos_sem_data) para não inventar pontualidade.
create or replace view public.boletos_avisos_score_v with (security_invoker = true) as
with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
cfg as (select tolerancia_dias as tol from public.boletos_avisos_score_config where id),
t as (
  select h.*, hoje.d as hoje, cfg.tol
  from public.boletos_avisos_historico h cross join hoje cross join cfg
  where not h.cancelado and h.data_vencimento < hoje.d
)
select
  t.codigo_cliente_omie,
  c.razao_social,
  c.cnpj,
  count(*) filter (where t.pago and t.data_pagamento is not null and t.data_pagamento <= t.data_vencimento + t.tol)::int as pagos_em_dia,
  count(*) filter (where t.pago and t.data_pagamento is not null and t.data_pagamento >  t.data_vencimento + t.tol)::int as pagos_atrasados,
  count(*) filter (where not t.pago)::int as abertos_vencidos,
  count(*) filter (where t.pago and t.data_pagamento is null)::int as pagos_sem_data,
  coalesce(round(avg(t.data_pagamento - t.data_vencimento) filter (where t.pago and t.data_pagamento is not null and t.data_pagamento > t.data_vencimento + t.tol), 1), 0) as atraso_medio_dias,
  coalesce(max(t.data_pagamento - t.data_vencimento) filter (where t.pago and t.data_pagamento is not null and t.data_pagamento > t.data_vencimento + t.tol), 0)::int as maior_atraso_dias,
  coalesce(max(t.hoje - t.data_vencimento) filter (where not t.pago), 0)::int as aberto_vencido_dias_max,
  coalesce(sum(t.valor) filter (where not t.pago), 0) as aberto_vencido_valor,
  coalesce(sum(t.valor_pago) filter (where t.pago), 0) as valor_pago_total,
  max(t.data_pagamento) filter (where t.pago) as ultimo_pagamento,
  min(t.data_vencimento) as primeiro_vencimento,
  count(*)::int as titulos_total
from t
left join public.boletos_avisos_clientes c on c.codigo_cliente_omie = t.codigo_cliente_omie
group by t.codigo_cliente_omie, c.razao_social, c.cnpj;
grant select on public.boletos_avisos_score_v to authenticated;

-- 6) Índice de inadimplência de um período de VENCIMENTO (inclusive nas duas pontas). Security invoker:
--    quem não passa em boletos_avisos_pode() recebe zeros (a RLS esconde as linhas).
create or replace function public.boletos_avisos_indice(p_de date, p_ate date)
returns jsonb language sql stable set search_path = public as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  cfg as (select tolerancia_dias as tol from public.boletos_avisos_score_config where id),
  t as (
    select h.*, hoje.d as hoje, cfg.tol
    from public.boletos_avisos_historico h cross join hoje cross join cfg
    where not h.cancelado and h.data_vencimento between p_de and p_ate
  )
  select jsonb_build_object(
    'de', p_de, 'ate', p_ate,
    'vencido_valor',        coalesce(sum(valor) filter (where data_vencimento < hoje), 0),
    'vencido_aberto_valor', coalesce(sum(valor) filter (where data_vencimento < hoje and not pago), 0),
    'pago_em_dia_valor',    coalesce(sum(valor) filter (where data_vencimento < hoje and pago and data_pagamento is not null and data_pagamento <= data_vencimento + tol), 0),
    'pago_atrasado_valor',  coalesce(sum(valor) filter (where data_vencimento < hoje and pago and data_pagamento is not null and data_pagamento >  data_vencimento + tol), 0),
    'titulos',              count(*) filter (where data_vencimento < hoje),
    'clientes',             count(distinct codigo_cliente_omie) filter (where data_vencimento < hoje),
    'a_vencer_valor',       coalesce(sum(valor) filter (where data_vencimento >= hoje and not pago), 0),
    'a_vencer_titulos',     count(*) filter (where data_vencimento >= hoje and not pago),
    'a_vencer_clientes',    count(distinct codigo_cliente_omie) filter (where data_vencimento >= hoje and not pago)
  ) from t;
$$;
revoke all on function public.boletos_avisos_indice(date, date) from public, anon;
grant execute on function public.boletos_avisos_indice(date, date) to authenticated, service_role;
