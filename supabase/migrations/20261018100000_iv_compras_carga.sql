-- Importação Varejo (/logistica/compras) — carga da tela em UMA chamada ao banco.
-- Antes: 1 Edge Function (list-importacao-varejo, ~1,5–1,9 s, 1,5 MB) + 5 consultas em fila (contagens, sugestões, revisões,
-- mínimo do Omie, "a caminho"), ~9 viagens ao banco uma esperando a outra. Agora: iv_compras_carga() devolve tudo junto.
--
-- `items` é a MESMA conta da Edge Function list-importacao-varejo (catálogo + giro + estoque + lote + comprado + último
-- fornecedor), só que em SQL; as demais listas vêm cruas, no formato que o store já espera. A regra de contagem/sugestão/Dia D
-- continua no navegador (aplicarContagem em importacao-varejo-store.js) — não foi movida de propósito. A Edge Function e as
-- consultas antigas continuam existindo como reserva (o store cai nelas se esta função falhar).
-- SECURITY INVOKER: respeita a RLS de cada tabela, igual às consultas diretas que a tela já fazia.

create or replace function public.iv_compras_carga() returns jsonb
language sql stable security invoker set search_path = public as $$
with
comp as (
  select c.codigo,
         sum(coalesce(c.quantidade, 0)) as total,
         jsonb_agg(jsonb_build_object('quantidade', coalesce(c.quantidade, 0), 'previsao', c.previsao_chegada::text)
                   order by c.previsao_chegada, c.id) as pedidos
    from importacao_varejo_comprado c
   where c.recebido = false
     and c.previsao_chegada >= (now() at time zone 'utc')::date      -- previsão já passou: não conta mais como "a caminho"
   group by c.codigo
),
base as (
  select p.codigo, p.codigo_produto_omie as p_omie, p.descricao as p_desc, p.unidade,
         e.codigo_produto_omie as e_omie, e.descricao as e_desc, (e.codigo is null) as sem_estoque,
         coalesce(e.fisico, 0) as fisico, coalesce(e.reservado, 0) as reservado, coalesce(e.disponivel, 0) as disponivel,
         coalesce(e.pendente, 0) as pendente, coalesce(e.cmc, 0) as cmc, coalesce(e.preco_unitario, 0) as preco_unitario,
         e.minimo_omie, e.atualizado_em as estoque_em,
         coalesce(g.curva, 'D') as curva, coalesce(g.media_mensal_vendas, 0) as media, g.estoque_minimo_calculado, g.updated_at as giro_em,
         l.multiplo_compra, l.lote_minimo,
         coalesce(cp.total, 0) as comprado, coalesce(cp.pedidos, '[]'::jsonb) as pedidos,
         f.fornecedor_nome, f.fornecedor_cnpj, coalesce(f.fornecedor_exterior, false) as forn_exterior,
         f.preco_unitario as forn_preco, f.numero_pedido, f.data_pedido, f.fonte
    from importacao_varejo_produtos p
    left join importacao_varejo_estoque e on e.codigo = p.codigo
    left join importacao_varejo_giro g on g.codigo = p.codigo
    left join importacao_varejo_lote_config l on l.codigo = p.codigo
    left join comp cp on cp.codigo = p.codigo
    left join importacao_varejo_fornecedor f on f.codigo = p.codigo
   where p.ativo = true
),
calc as (
  select b.*,
         coalesce(b.estoque_minimo_calculado, b.minimo_omie, 0) as minimo,
         ceil(greatest(0, coalesce(b.estoque_minimo_calculado, b.minimo_omie, 0) - b.disponivel + b.pendente - b.comprado)) as bruta
    from base b
),
fin as (
  select c.*,
         case
           when c.bruta > 0 and (coalesce(c.multiplo_compra, 0) > 0 or coalesce(c.lote_minimo, 0) > 0) then
             case when coalesce(c.multiplo_compra, 0) > 0
                  then ceil(greatest(c.bruta, coalesce(c.lote_minimo, 0)) / c.multiplo_compra) * c.multiplo_compra
                  else greatest(c.bruta, coalesce(c.lote_minimo, 0)) end
           else c.bruta
         end as sugestao
    from calc c
),
itens as (
  select f.codigo,
         jsonb_build_object(
           'codigo', f.codigo,
           'codigoProdutoOmie', coalesce(f.e_omie, f.p_omie),
           'descricao', coalesce(nullif(f.e_desc, ''), f.p_desc),
           'unidade', f.unidade,
           'curva', f.curva,
           'mediaMensalVendas', f.media,
           'estoqueFisico', f.fisico,
           'estoqueReservado', f.reservado,
           'estoqueDisponivel', f.disponivel,
           'estoqueMinimo', f.minimo,
           'pendenteOmie', f.pendente,
           'comprado', f.comprado,
           'pedidosComprado', f.pedidos,
           'cmc', f.cmc,
           'precoUnitario', f.preco_unitario,
           'ultimoFornecedorNome', f.fornecedor_nome,
           'ultimoFornecedorCnpj', f.fornecedor_cnpj,
           'ultimoFornecedorExterior', f.forn_exterior,
           'ultimoPrecoUnitario', f.forn_preco,
           'ultimoPedidoNumero', f.numero_pedido,
           'ultimoPedidoData', f.data_pedido,
           'ultimoFornecedorFonte', f.fonte,
           'multiploCompra', f.multiplo_compra,
           'loteMinimo', f.lote_minimo,
           'sugestaoBruta', f.bruta,
           'sugestaoCompra', f.sugestao,
           'conselho', case when f.curva = 'D' and f.disponivel > 0
                            then 'Curva D — baixo giro (sem venda registrada desde 01/01/2024 o suficiente pra sair de D). Considere não comprar mais até vender o estoque parado.'
                            end,
           'semRegistroEstoque', f.sem_estoque,
           'giroCalculadoEm', f.giro_em,
           'estoqueAtualizadoEm', f.estoque_em
         ) as item,
         f.giro_em, f.estoque_em
    from fin f
)
select jsonb_build_object(
  'items',               coalesce((select jsonb_agg(i.item order by i.codigo) from itens i), '[]'::jsonb),
  'lastEstoqueSyncAt',   (select max(i.estoque_em) from itens i),
  'lastGiroSyncAt',      (select max(i.giro_em) from itens i),
  'contagens',           coalesce((select jsonb_agg(jsonb_build_object('codigo', c.codigo, 'quantidade', c.quantidade, 'saldo_sistemico', c.saldo_sistemico,
                                   'contado_em', c.contado_em, 'contado_por', c.contado_por, 'endereco', c.endereco, 'observacao', c.observacao))
                                   from importacao_varejo_contagem c), '[]'::jsonb),
  'sugestoes',           coalesce((select jsonb_agg(jsonb_build_object('codigo', s.codigo, 'demanda_mensal', s.demanda_mensal, 'meses_com_venda', s.meses_com_venda,
                                   'prazo_dias', s.prazo_dias, 'ciclo_dias', s.ciclo_dias, 'seguranca', s.seguranca, 'minimo_sugerido', s.minimo_sugerido,
                                   'maximo_sugerido', s.maximo_sugerido, 'confianca', s.confianca, 'serie_12m', s.serie_12m, 'serie_inicio', s.serie_inicio,
                                   'tendencia', s.tendencia, 'tendencia_pct', s.tendencia_pct, 'mes_pico', s.mes_pico, 'mes_vale', s.mes_vale,
                                   'custo_unitario', s.custo_unitario, 'custo_origem', s.custo_origem, 'margem_unitaria', s.margem_unitaria,
                                   'margem_origem', s.margem_origem, 'prazo_origem', s.prazo_origem, 'demanda_12m', s.demanda_12m, 'motivo', s.motivo,
                                   'valor_max_estoque', s.valor_max_estoque, 'atraso_dias', s.atraso_dias, 'meses_ruptura', s.meses_ruptura,
                                   'ruptura_12m', s.ruptura_12m))
                                   from importacao_varejo_sugestao_estoque s), '[]'::jsonb),
  'revisoes',            coalesce((select jsonb_agg(jsonb_build_object('codigo', r.codigo, 'status', r.status, 'minimo_manual', r.minimo_manual,
                                   'maximo_manual', r.maximo_manual, 'observacao', r.observacao, 'revisado_por', r.revisado_por, 'revisado_em', r.revisado_em))
                                   from importacao_varejo_revisao r), '[]'::jsonb),
  'caminho',             coalesce((select jsonb_agg(jsonb_build_object('codigo', a.codigo, 'a_caminho', a.a_caminho, 'chegou_sem_nota', a.chegou_sem_nota,
                                   'comprado_pi', a.comprado_pi, 'detalhes', a.detalhes))
                                   from importacao_varejo_a_caminho a), '[]'::jsonb),
  'minimoOmie',          coalesce((select jsonb_agg(jsonb_build_object('codigo', e.codigo, 'minimo_omie', e.minimo_omie)) from importacao_varejo_estoque e), '[]'::jsonb)
);
$$;

revoke all on function public.iv_compras_carga() from public;
grant execute on function public.iv_compras_carga() to anon, authenticated, service_role;
