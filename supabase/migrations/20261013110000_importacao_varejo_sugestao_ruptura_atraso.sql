-- Importação Varejo · sugestão com RUPTURA e ATRASO DE DECISÃO (Dia D).
-- 1) Mês com ≥ ruptura_limite (30%) dos dias sem estoque NÃO é "baixa venda": a venda do mês é corrigida (mediana dos meses com estoque; sem ela, venda ÷ dias com estoque).
-- 2) Prazo total para o ponto de pedido = chegada (prazo real) + atraso_decisao_dias (45 criar pedido + 5 decidir) — só para importados.
alter table public.importacao_varejo_sugestao_estoque
  add column if not exists atraso_dias integer, add column if not exists meses_ruptura integer, add column if not exists ruptura_12m jsonb;
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
           coalesce(nullif(f.preco_unitario, 0), nullif(e.cmc, 0))::numeric custo,
           case when nullif(f.preco_unitario, 0) is not null then 'ultimo_preco' when nullif(e.cmc, 0) is not null then 'cmc' end custo_origem,
           nullif(e.preco_unitario, 0)::numeric venda,
           case when hp.chave is not null then ceil(hp.dias_p80)
                when hc.chave is not null then ceil(hc.dias_p80)
                when f.fornecedor_exterior is true then cfg.prazo_importado_dias
                when f.fornecedor_exterior is false then cfg.prazo_nacional_dias
                when p.codigo ~ '[Nn]$' then cfg.prazo_nacional_dias
                else cfg.prazo_importado_dias end::int prazo,
           case when (case when f.fornecedor_exterior is not null then f.fornecedor_exterior when p.codigo ~ '[Nn]$' then false else true end)
                then cfg.atraso_decisao_dias else 0 end atraso,
           case when hp.chave is not null then 'historico_produto'
                when hc.chave is not null then (case when hc.chave = 'cat:exterior' then 'historico_exterior' else 'historico_nacional' end)
                when f.fornecedor_exterior is true then 'fornecedor_exterior'
                when f.fornecedor_exterior is false then 'fornecedor_nacional'
                when p.codigo ~ '[Nn]$' then 'codigo_n'
                else 'padrao_importado' end prazo_origem
    from importacao_varejo_produtos p
    left join importacao_varejo_giro g on g.codigo = p.codigo
    left join importacao_varejo_estoque e on e.codigo = p.codigo
    left join importacao_varejo_fornecedor f on f.codigo = p.codigo
    left join importacao_varejo_prazo_real hp on hp.chave = upper(p.codigo) and hp.amostras >= 2
    left join importacao_varejo_prazo_real hc on hc.amostras >= 3 and hc.chave =
         (case when f.fornecedor_exterior is true then 'cat:exterior'
               when f.fornecedor_exterior is false then 'cat:nacional'
               when p.codigo ~ '[Nn]$' then 'cat:nacional'
               else 'cat:exterior' end)
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
           coalesce(rp.dias_sem_estoque::numeric / nullif(rp.dias_mes, 0), 0) pct,
           row_number() over (partition by p.codigo order by me.m desc) rn
    from prods p cross join meses12 me left join venda v on v.codigo = upper(p.codigo) and v.m = me.m
         left join importacao_varejo_ruptura rp on rp.codigo = upper(p.codigo) and rp.mes = me.m
  ),
  s12 as (
    select codigo,
      jsonb_agg(round(q, 2) order by m) serie,
      jsonb_agg(round(pct, 2) order by m) rup12,
      coalesce(avg(q) filter (where rn <= 3), 0) m3r,
      coalesce(avg(q) filter (where rn between 4 and 6), 0) p3r,
      count(*) filter (where q > 0) mv12,
      avg(q) dem12,
      max(q) pico_q,
      (array_agg(m order by q desc, m desc))[1] mes_pico,
      (array_agg(m order by q asc, m desc))[1] mes_vale
    from serie12 group by codigo
  ),
  serie as (select codigo, m, q, pct from serie12 where m >= ini),
  mediana as (
    select codigo, coalesce(percentile_cont(0.5) within group (order by q) filter (where q > 0), 0)::numeric med,
           percentile_cont(0.5) within group (order by q) filter (where q > 0 and pct < cfg.ruptura_limite)::numeric med_ok
    from serie group by codigo
  ),
  limitada as (
    select s.codigo, s.m, s.pct,
           case when coalesce(md.med_ok, md.med) > 0
                then least(case when s.pct >= cfg.ruptura_limite
                                then greatest(s.q, coalesce(md.med_ok, case when s.pct < 1 then s.q / (1 - s.pct) else s.q end))
                                else s.q end, 3 * coalesce(md.med_ok, md.med))
                else 0 end q,
           s.q q_real,
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
      count(*) filter (where pct >= cfg.ruptura_limite) meses_rupt,
      (2 * coalesce(avg(q) filter (where rn <= 3), 0) + coalesce(avg(q) filter (where rn > 3), 0)) / 3 dem
    from limitada group by codigo
  ),
  calc as (
    select pr.codigo, pr.curva, pr.prazo, pr.atraso, pr.prazo_origem, pr.custo, pr.custo_origem, pr.venda,
      a.vendas, a.m6, a.m3, coalesce(a.dp, 0) dp, a.meses_venda, a.meses_rupt, a.dem,
      case when a.meses_venda < 3 then 0
           else case pr.curva when 'A' then 1.65 when 'B' then 1.28 when 'C' then 1.04 else 0 end end z,
      t.serie, t.rup12, t.m3r, t.p3r, t.mv12, t.dem12, t.mes_pico, t.mes_vale, t.pico_q
    from prods pr join agg a on a.codigo = upper(pr.codigo) join s12 t on t.codigo = upper(pr.codigo)
  ),
  valor as (
    select c.*,
      case when c.dem > 0 then c.dem when c.mv12 >= 2 then c.dem12 else 0 end dem_ref,
      case when c.custo is null then null
           when c.venda > c.custo then c.venda - c.custo
           else c.custo * cfg.margem_padrao end margem,
      case when c.custo is null then null when c.venda > c.custo then 'preco_venda' else 'estimada' end margem_origem,
      case when c.prazo > cfg.prazo_curto_dias then 1 else cfg.fator_prazo_curto end fator,
      case when c.dem > 0 then ceil(c.dem / 30.0 * (c.prazo + c.atraso) + z * c.dp * sqrt((c.prazo + c.atraso) / 30.0)) end base_mn,
      case when c.dem > 0 then ceil(c.dem / 30.0 * (c.prazo + c.atraso) + z * c.dp * sqrt((c.prazo + c.atraso) / 30.0) + c.dem / 30.0 * cfg.ciclo_compra_dias) end base_mx,
      case when c.dem > 0 then z * c.dp * sqrt((c.prazo + c.atraso) / 30.0) else 0 end seg
    from calc c
  ),
  teste as (
    select v.*,
      case when v.custo is null then true
           when v.dem_ref <= 0 then false
           else v.custo * (cfg.taxa_capital_mes + cfg.risco_obsolescencia_mes) / v.dem_ref <= v.margem * v.fator end vale
    from valor v
  ),
  decisao as (
    select t.*,
      case when t.dem > 0 and (t.meses_venda >= 3 or t.vale) then t.base_mn
           when t.dem <= 0 and t.dem_ref > 0 and t.vale then 1
           else 0 end mn,
      case when t.dem > 0 and (t.meses_venda >= 3 or t.vale) then t.base_mx
           when t.dem <= 0 and t.dem_ref > 0 and t.vale then greatest(2, ceil(1 + t.dem12 * cfg.ciclo_compra_dias / 30.0))
           else 0 end mx,
      case when t.dem > 0 and (t.meses_venda >= 3 or t.vale) then 'calculado pela demanda dos últimos 6 meses'
           when t.dem > 0 then 'sob demanda: manter estoque custaria mais que a margem do item'
           when t.dem_ref > 0 and t.vale then 'venda rara, mas rentável: manter 1 unidade'
           when t.dem_ref > 0 then 'sob demanda: venda rara e manter estoque custaria mais que a margem'
           else 'sob demanda: sem venda recente' end motivo_base
    from teste t
  )
  insert into importacao_varejo_sugestao_estoque
    (codigo, demanda_mensal, media_6m, media_3m, desvio_mensal, meses_com_venda, prazo_dias, ciclo_dias, seguranca,
     minimo_sugerido, maximo_sugerido, confianca, curva, vendas_ult_6m, calculado_em,
     serie_12m, serie_inicio, tendencia, tendencia_pct, mes_pico, mes_vale,
     custo_unitario, custo_origem, margem_unitaria, margem_origem, prazo_origem, demanda_12m, vale_manter, motivo, valor_max_estoque,
     atraso_dias, meses_ruptura, ruptura_12m)
  select d.codigo, round(d.dem, 2), round(d.m6, 2), round(d.m3, 2), round(d.dp, 2), d.meses_venda, d.prazo, cfg.ciclo_compra_dias, round(d.seg, 2),
    d.mn, d.mx,
    case when d.dem > 0 and d.meses_venda >= 5 then 'alta' when d.dem > 0 and d.meses_venda >= 3 then 'media' else 'baixa' end,
    d.curva, d.vendas, now(),
    d.serie, ini12,
    case when d.m3r = 0 and d.p3r = 0 then 'sem_venda'
         when d.p3r = 0 then 'nova'
         when (d.m3r - d.p3r) / d.p3r >= 0.20 then 'alta'
         when (d.m3r - d.p3r) / d.p3r <= -0.20 then 'baixa'
         else 'estavel' end,
    case when d.p3r > 0 then round((d.m3r - d.p3r) / d.p3r * 100, 1) else null end,
    case when d.pico_q > 0 then d.mes_pico else null end,
    case when d.mv12 >= 3 then d.mes_vale else null end,
    round(d.custo, 2), d.custo_origem, round(d.margem, 2), d.margem_origem, d.prazo_origem, round(d.dem12, 2), d.vale,
    d.motivo_base || case when d.meses_rupt > 0 then ' · ' || d.meses_rupt || ' mês(es) com ruptura (sem estoque em ≥ ' || round(cfg.ruptura_limite * 100) || '% dos dias): venda corrigida' else '' end
      || case when d.custo is null then ' (custo desconhecido: valor do item não avaliado)' else '' end,
    case when d.custo is null then null else round(d.mx * d.custo, 2) end,
    d.atraso, d.meses_rupt, d.rup12
  from decisao d
  on conflict (codigo) do update set
    demanda_mensal = excluded.demanda_mensal, media_6m = excluded.media_6m, media_3m = excluded.media_3m,
    desvio_mensal = excluded.desvio_mensal, meses_com_venda = excluded.meses_com_venda, prazo_dias = excluded.prazo_dias,
    ciclo_dias = excluded.ciclo_dias, seguranca = excluded.seguranca, minimo_sugerido = excluded.minimo_sugerido,
    maximo_sugerido = excluded.maximo_sugerido, confianca = excluded.confianca, curva = excluded.curva,
    vendas_ult_6m = excluded.vendas_ult_6m, calculado_em = excluded.calculado_em,
    serie_12m = excluded.serie_12m, serie_inicio = excluded.serie_inicio, tendencia = excluded.tendencia,
    tendencia_pct = excluded.tendencia_pct, mes_pico = excluded.mes_pico, mes_vale = excluded.mes_vale,
    custo_unitario = excluded.custo_unitario, custo_origem = excluded.custo_origem, margem_unitaria = excluded.margem_unitaria,
    margem_origem = excluded.margem_origem, prazo_origem = excluded.prazo_origem, demanda_12m = excluded.demanda_12m,
    vale_manter = excluded.vale_manter, motivo = excluded.motivo, valor_max_estoque = excluded.valor_max_estoque,
    atraso_dias = excluded.atraso_dias, meses_ruptura = excluded.meses_ruptura, ruptura_12m = excluded.ruptura_12m;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.iv_calcular_sugestao_estoque() from public, anon, authenticated;
grant execute on function public.iv_calcular_sugestao_estoque() to service_role;
