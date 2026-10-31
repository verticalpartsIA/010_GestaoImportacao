-- Importação Varejo · prazo REAL de reposição calculado do histórico (substitui os 90 d / 15 d assumidos quando há amostras).
-- Fontes (iv_calcular_prazo_real):
--   1) 'pedido_omie': Pedido de Compra do Omie (dIncData) → 1ª entrada de estoque (IMP/RRE/COM) do mesmo produto entre o pedido e o próximo pedido dele
--   2) 'pi': P.I. (data_abertura) → 1ª entrada IMP/RRE/COM do produto entre a P.I. e a próxima P.I. dele
--   Só entram prazos de 0 a 365 dias (pedido lançado depois da entrada = dado retroativo, descartado).
-- Resumo (importacao_varejo_prazo_real):
--   'cat:exterior' = P.I.s (mediana por P.I., depois mediana e p80 entre P.I.s — cada carga conta 1 vez, não 1 por item)
--   'cat:nacional' = pedidos do Omie (mesma lógica, 1 por pedido)
--   <código>       = por produto (a sugestão só usa com ≥ 2 amostras)
-- A sugestão usa o p80 (cobre 8 de cada 10 entregas): produto (≥ 2 amostras) > categoria (≥ 3) > padrão de importacao_varejo_sugestao_config.
alter table public.importacao_varejo_prazo_amostras add column if not exists fonte text;

create or replace function public.iv_calcular_prazo_real()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from importacao_varejo_prazo_amostras;

  insert into importacao_varejo_prazo_amostras (codigo, pedido, data_pedido, data_entrada, origem_entrada, quantidade, dias, fornecedor_exterior, fonte)
  with ped as (
    select pedido, codigo, data_pedido, lead(data_pedido) over (partition by codigo order by data_pedido, pedido) prox
    from importacao_varejo_pedidos_hist where qtde > 0 and data_pedido >= date '2025-01-01'
  )
  select p.codigo, p.pedido, p.data_pedido, e.dt_mov, e.cod_origem, e.qtde, e.dt_mov - p.data_pedido, false, 'pedido_omie'
  from ped p cross join lateral (
    select m.dt_mov, m.cod_origem, m.qtde from importacao_varejo_mov m
    where upper(m.codigo) = p.codigo and m.qtde > 0 and m.cod_origem in ('IMP','RRE','COM')
      and m.dt_mov >= p.data_pedido and (p.prox is null or m.dt_mov < p.prox)
    order by m.dt_mov limit 1) e
  where e.dt_mov - p.data_pedido between 0 and 365
  on conflict do nothing;

  insert into importacao_varejo_prazo_amostras (codigo, pedido, data_pedido, data_entrada, origem_entrada, quantidade, dias, fornecedor_exterior, fonte)
  with pi as (
    select trim(p.numero_pi) pedido, p.data_abertura::date dt, upper(trim(i->>'codigo_produto')) codigo
    from pi_importacao p, jsonb_array_elements(coalesce(p.itens, '[]'::jsonb)) i
    where p.data_abertura is not null and trim(coalesce(i->>'codigo_produto', '')) <> ''
  ), x as (
    select pi.*, lead(dt) over (partition by codigo order by dt, pedido) prox from pi
  )
  select x.codigo, x.pedido, x.dt, e.dt_mov, e.cod_origem, e.qtde, e.dt_mov - x.dt, true, 'pi'
  from x cross join lateral (
    select m.dt_mov, m.cod_origem, m.qtde from importacao_varejo_mov m
    where upper(m.codigo) = x.codigo and m.qtde > 0 and m.cod_origem in ('IMP','RRE','COM')
      and m.dt_mov >= x.dt and (x.prox is null or m.dt_mov < x.prox)
    order by m.dt_mov limit 1) e
  where e.dt_mov - x.dt between 0 and 365
  on conflict do nothing;

  delete from importacao_varejo_prazo_real;
  insert into importacao_varejo_prazo_real (chave, amostras, dias_mediano, dias_p80, dias_min, dias_max, ultima_entrada)
  select codigo, count(*), percentile_cont(0.5) within group (order by dias), percentile_cont(0.8) within group (order by dias),
         min(dias), max(dias), max(data_entrada)
  from importacao_varejo_prazo_amostras group by codigo;

  insert into importacao_varejo_prazo_real (chave, amostras, dias_mediano, dias_p80, dias_min, dias_max, ultima_entrada)
  with por_origem as (
    select fonte, pedido, percentile_cont(0.5) within group (order by dias) d, max(data_entrada) ult
    from importacao_varejo_prazo_amostras group by fonte, pedido
  )
  select case fonte when 'pi' then 'cat:exterior' else 'cat:nacional' end, count(*),
         percentile_cont(0.5) within group (order by d), percentile_cont(0.8) within group (order by d),
         floor(min(d)), ceil(max(d)), max(ult)
  from por_origem group by fonte;

  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.iv_calcular_prazo_real() from public, anon, authenticated;
grant execute on function public.iv_calcular_prazo_real() to service_role;
notify pgrst, 'reload schema';
