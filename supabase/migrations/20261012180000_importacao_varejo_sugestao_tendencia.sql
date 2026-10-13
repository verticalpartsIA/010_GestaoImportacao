-- Importação Varejo · tendência de vendas (alta/baixa) e série dos últimos 12 meses por produto,
-- guardadas junto da sugestão de estoque (iv_calcular_sugestao_estoque, recalculada todo dia).
--   serie_12m  = vendas líquidas mês a mês (12 meses completos, do mais antigo ao mais recente) — alimenta o gráfico de linha
--   tendencia  = últimos 3 meses × 3 meses anteriores: 'alta' (≥ +20%), 'baixa' (≤ −20%), 'estavel', 'nova' (voltou a vender) ou 'sem_venda'
--   mes_pico / mes_vale = mês de maior e de menor venda da janela (vale só com venda em ≥ 3 meses; senão nulo)
alter table public.importacao_varejo_sugestao_estoque
  add column if not exists serie_12m jsonb,
  add column if not exists serie_inicio date,
  add column if not exists tendencia text,
  add column if not exists tendencia_pct numeric,
  add column if not exists mes_pico date,
  add column if not exists mes_vale date;

create or replace function public.iv_calcular_sugestao_estoque()
returns integer language plpgsql security definer set search_path = public as $$
declare cfg record; ini date; ini12 date; fim date; n integer;
begin
  select * into cfg from importacao_varejo_sugestao_config where id;
  fim := (date_trunc('month', now()) - interval '1 month')::date;
  ini := (date_trunc('month', now()) - make_interval(months => cfg.janela_meses))::date;
  ini12 := (date_trunc('month', now()) - interval '12 months')::date;
  with prods as (
    select p.codigo, coalesce(g.curva, 'D') curva,
           case when p.codigo ~ '[Nn]$' then cfg.prazo_nacional_dias else cfg.prazo_importado_dias end prazo
    from importacao_varejo_produtos p left join importacao_varejo_giro g on g.codigo = p.codigo
    where p.ativo
  ),
  venda as (
    select upper(codigo) codigo, date_trunc('month', dt_mov)::date m, -sum(qtde) q
    from importacao_varejo_mov
    where cod_origem in ('VEN','CVP','DVP','CDV') and dt_mov >= ini12 and dt_mov < date_trunc('month', now())
    group by 1, 2
  ),
  meses12 as (select generate_series(ini12, fim, interval '1 month')::date m),
  serie12 as (
    select upper(p.codigo) codigo, me.m, greatest(0, coalesce(v.q, 0)) q,
           row_number() over (partition by p.codigo order by me.m desc) rn
    from prods p cross join meses12 me left join venda v on v.codigo = upper(p.codigo) and v.m = me.m
  ),
  s12 as (
    select codigo,
      jsonb_agg(round(q, 2) order by m) serie,
      coalesce(avg(q) filter (where rn <= 3), 0) m3r,
      coalesce(avg(q) filter (where rn between 4 and 6), 0) p3r,
      count(*) filter (where q > 0) mv12,
      max(q) pico_q,
      (array_agg(m order by q desc, m desc))[1] mes_pico,
      (array_agg(m order by q asc, m desc))[1] mes_vale
    from serie12 group by codigo
  ),
  serie as (
    select codigo, m, q from serie12 where m >= ini
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
      case pr.curva when 'A' then 1.65 when 'B' then 1.28 when 'C' then 1.04 else 0 end z,
      t.serie, t.m3r, t.p3r, t.mv12, t.mes_pico, t.mes_vale, t.pico_q
    from prods pr join agg a on a.codigo = upper(pr.codigo) join s12 t on t.codigo = upper(pr.codigo)
  ),
  final as (
    select *, case when dem <= 0 then 0 else z * dp * sqrt(prazo / 30.0) end seg from calc
  )
  insert into importacao_varejo_sugestao_estoque
    (codigo, demanda_mensal, media_6m, media_3m, desvio_mensal, meses_com_venda, prazo_dias, ciclo_dias, seguranca,
     minimo_sugerido, maximo_sugerido, confianca, curva, vendas_ult_6m, calculado_em,
     serie_12m, serie_inicio, tendencia, tendencia_pct, mes_pico, mes_vale)
  select codigo, round(dem, 2), round(m6, 2), round(m3, 2), round(dp, 2), meses_venda, prazo, cfg.ciclo_compra_dias, round(seg, 2),
    case when dem <= 0 then 0 else ceil(dem / 30.0 * prazo + seg) end,
    case when dem <= 0 then 0 else ceil(dem / 30.0 * prazo + seg + dem / 30.0 * cfg.ciclo_compra_dias) end,
    case when meses_venda >= 5 then 'alta' when meses_venda >= 3 then 'media' else 'baixa' end,
    curva, vendas, now(),
    serie, ini12,
    case when m3r = 0 and p3r = 0 then 'sem_venda'
         when p3r = 0 then 'nova'
         when (m3r - p3r) / p3r >= 0.20 then 'alta'
         when (m3r - p3r) / p3r <= -0.20 then 'baixa'
         else 'estavel' end,
    case when p3r > 0 then round((m3r - p3r) / p3r * 100, 1) else null end,
    case when pico_q > 0 then mes_pico else null end,
    case when mv12 >= 3 then mes_vale else null end
  from final
  on conflict (codigo) do update set
    demanda_mensal = excluded.demanda_mensal, media_6m = excluded.media_6m, media_3m = excluded.media_3m,
    desvio_mensal = excluded.desvio_mensal, meses_com_venda = excluded.meses_com_venda, prazo_dias = excluded.prazo_dias,
    ciclo_dias = excluded.ciclo_dias, seguranca = excluded.seguranca, minimo_sugerido = excluded.minimo_sugerido,
    maximo_sugerido = excluded.maximo_sugerido, confianca = excluded.confianca, curva = excluded.curva,
    vendas_ult_6m = excluded.vendas_ult_6m, calculado_em = excluded.calculado_em,
    serie_12m = excluded.serie_12m, serie_inicio = excluded.serie_inicio, tendencia = excluded.tendencia,
    tendencia_pct = excluded.tendencia_pct, mes_pico = excluded.mes_pico, mes_vale = excluded.mes_vale;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.iv_calcular_sugestao_estoque() from public, anon, authenticated;
grant execute on function public.iv_calcular_sugestao_estoque() to service_role;
notify pgrst, 'reload schema';
