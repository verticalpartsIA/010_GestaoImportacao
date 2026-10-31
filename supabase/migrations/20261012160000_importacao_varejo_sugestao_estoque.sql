-- Importação Varejo · sugestão de estoque MÍNIMO e MÁXIMO calculada a partir das vendas reais do Omie.
-- O Omie só tem "estoque mínimo" (manual); aqui o sistema sugere os dois números e se atualiza todo dia
-- (cron: sync-importacao-varejo-vendas 03:10 UTC → iv_calcular_sugestao_estoque 03:30 UTC).
--
-- Método (explicável ao comprador):
--   venda líquida do mês = −Σ qtde dos movimentos VEN, CVP (cancelamento de venda), DVP (devolução), CDV (cancelamento de devolução)
--   janela = 6 meses COMPLETOS anteriores ao mês corrente; meses sem venda contam como zero
--   pico de mês é limitado a 3× a mediana dos meses com venda (um pedido gigante isolado não vira "normal")
--   demanda mensal = média ponderada: últimos 3 meses peso 2, 3 anteriores peso 1 (acompanha tendência sem oscilar)
--   prazo de reposição: 90 dias importado, 15 dias nacional (código terminado em "N") — decisão do PCP; o "lead time" do Omie é ignorado
--   estoque de segurança = z × desvio mensal × √(prazo/30), z = 1,65 (Curva A) · 1,28 (B) · 1,04 (C); Curva D = sem segurança
--   MÍNIMO sugerido (ponto de pedido) = demanda diária × prazo + segurança
--   MÁXIMO sugerido = mínimo + demanda diária × ciclo de compra (60 dias — editável em importacao_varejo_sugestao_config)
--   sem venda nos 6 meses → mínimo 0 e máximo 0: não repor
create table if not exists public.importacao_varejo_sugestao_config (
  id boolean primary key default true check (id),
  prazo_importado_dias int not null default 90,
  prazo_nacional_dias int not null default 15,
  ciclo_compra_dias int not null default 60,
  janela_meses int not null default 6,
  atualizado_em timestamptz not null default now()
);
insert into public.importacao_varejo_sugestao_config (id) values (true) on conflict do nothing;

create table if not exists public.importacao_varejo_sugestao_estoque (
  codigo text primary key,
  demanda_mensal numeric not null default 0,       -- unidades/mês usadas como base
  media_6m numeric not null default 0,
  media_3m numeric not null default 0,
  desvio_mensal numeric not null default 0,
  meses_com_venda int not null default 0,          -- de 6
  prazo_dias int not null,
  ciclo_dias int not null,
  seguranca numeric not null default 0,
  minimo_sugerido numeric not null default 0,
  maximo_sugerido numeric not null default 0,
  confianca text not null default 'baixa',         -- alta (≥5 meses com venda) | media (3–4) | baixa (≤2)
  curva text,
  vendas_ult_6m numeric not null default 0,
  calculado_em timestamptz not null default now()
);
alter table public.importacao_varejo_sugestao_config enable row level security;
alter table public.importacao_varejo_sugestao_estoque enable row level security;
create policy iv_sugcfg_select on public.importacao_varejo_sugestao_config for select using (true);
create policy iv_sugest_select on public.importacao_varejo_sugestao_estoque for select using (true);

create or replace function public.iv_calcular_sugestao_estoque()
returns integer language plpgsql security definer set search_path = public as $$
declare cfg record; ini date; n integer;
begin
  select * into cfg from importacao_varejo_sugestao_config where id;
  ini := (date_trunc('month', now()) - make_interval(months => cfg.janela_meses))::date;
  with prods as (
    select p.codigo, coalesce(g.curva, 'D') curva,
           case when p.codigo ~ '[Nn]$' then cfg.prazo_nacional_dias else cfg.prazo_importado_dias end prazo
    from importacao_varejo_produtos p left join importacao_varejo_giro g on g.codigo = p.codigo
    where p.ativo
  ),
  meses as (select generate_series(ini, (date_trunc('month', now()) - interval '1 month')::date, interval '1 month')::date m),
  venda as (
    select upper(codigo) codigo, date_trunc('month', dt_mov)::date m, -sum(qtde) q
    from importacao_varejo_mov
    where cod_origem in ('VEN','CVP','DVP','CDV') and dt_mov >= ini and dt_mov < date_trunc('month', now())
    group by 1, 2
  ),
  serie as (
    select upper(p.codigo) codigo, me.m, greatest(0, coalesce(v.q, 0)) q
    from prods p cross join meses me left join venda v on v.codigo = upper(p.codigo) and v.m = me.m
  ),
  mediana as (
    select codigo, coalesce(percentile_cont(0.5) within group (order by q) filter (where q > 0), 0)::numeric med from serie group by codigo
  ),
  limitada as (
    select s.codigo, s.m, case when md.med > 0 then least(s.q, 3 * md.med) else 0 end q, s.q q_real,
           row_number() over (partition by s.codigo order by s.m desc) rn
    from serie s join mediana md using (codigo)
  ),
  agg as (
    select codigo,
      sum(q_real) vendas,
      avg(q) m6,
      coalesce(avg(q) filter (where rn <= 3), 0) m3,
      stddev_samp(q) dp,
      count(*) filter (where q_real > 0) meses_venda,
      (2 * coalesce(avg(q) filter (where rn <= 3), 0) + coalesce(avg(q) filter (where rn > 3), 0)) / 3 dem
    from limitada group by codigo
  ),
  calc as (
    select pr.codigo, pr.curva, pr.prazo, a.vendas, a.m6, a.m3, coalesce(a.dp, 0) dp, a.meses_venda, a.dem,
      case pr.curva when 'A' then 1.65 when 'B' then 1.28 when 'C' then 1.04 else 0 end z
    from prods pr join agg a on a.codigo = upper(pr.codigo)
  ),
  final as (
    select *, case when dem <= 0 then 0 else z * dp * sqrt(prazo / 30.0) end seg from calc
  )
  insert into importacao_varejo_sugestao_estoque
    (codigo, demanda_mensal, media_6m, media_3m, desvio_mensal, meses_com_venda, prazo_dias, ciclo_dias, seguranca,
     minimo_sugerido, maximo_sugerido, confianca, curva, vendas_ult_6m, calculado_em)
  select codigo, round(dem, 2), round(m6, 2), round(m3, 2), round(dp, 2), meses_venda, prazo, cfg.ciclo_compra_dias, round(seg, 2),
    case when dem <= 0 then 0 else ceil(dem / 30.0 * prazo + seg) end,
    case when dem <= 0 then 0 else ceil(dem / 30.0 * prazo + seg + dem / 30.0 * cfg.ciclo_compra_dias) end,
    case when meses_venda >= 5 then 'alta' when meses_venda >= 3 then 'media' else 'baixa' end,
    curva, vendas, now()
  from final
  on conflict (codigo) do update set
    demanda_mensal = excluded.demanda_mensal, media_6m = excluded.media_6m, media_3m = excluded.media_3m,
    desvio_mensal = excluded.desvio_mensal, meses_com_venda = excluded.meses_com_venda, prazo_dias = excluded.prazo_dias,
    ciclo_dias = excluded.ciclo_dias, seguranca = excluded.seguranca, minimo_sugerido = excluded.minimo_sugerido,
    maximo_sugerido = excluded.maximo_sugerido, confianca = excluded.confianca, curva = excluded.curva,
    vendas_ult_6m = excluded.vendas_ult_6m, calculado_em = excluded.calculado_em;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.iv_calcular_sugestao_estoque() from public, anon, authenticated;
grant execute on function public.iv_calcular_sugestao_estoque() to service_role;
notify pgrst, 'reload schema';
