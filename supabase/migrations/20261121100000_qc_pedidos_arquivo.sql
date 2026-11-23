-- Quadros de Comando › arquivo de pedidos (21/11/2026, pedido do Gelson; "Confirmo" dado no chat).
-- Arquiva por Nº do pedido do Omie (une os registros parciais do mesmo número) quando:
--   (a) faturado: algum registro do número tem faturado = true e não está cancelado; ou
--   (b) concluído: há OP de quadro do pedido, nenhuma ativa (aguardando/em produção), pelo menos uma concluída,
--       e TODO item de separação PV (não quadro/cabo/VPMP/VPSVC), cabo do kit e componente do quadro tem "Peguei".
-- Regra de itens espelha src/quadros-pedidos-calc.js (classificarItem/itensParaSeparar/itensDoKit/componentesDoQuadro).
-- Nasce FECHADA (Art. 26). Nada é apagado: desarquivar só preenche desarquivado_em; desarquivado à mão não volta sozinho.

create table if not exists public.qc_pedidos_arquivo (
  numero_pedido   text        primary key,
  motivo          text        not null check (motivo in ('faturado', 'concluido')),
  detalhe         text,
  arquivado_em    timestamptz not null default now(),
  arquivado_por   text        not null default 'sistema',
  desarquivado_em timestamptz,
  desarquivado_por text
);
alter table public.qc_pedidos_arquivo enable row level security;
revoke all on public.qc_pedidos_arquivo from public, anon, authenticated;
grant all on public.qc_pedidos_arquivo to service_role;

-- codigo_pedido (todos os registros) dos números hoje arquivados.
create or replace function public._qc_cod_arquivados() returns bigint[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.codigo_pedido), '{}'::bigint[])
    from public.pcp_pedidos p join public.qc_pedidos_arquivo a on a.numero_pedido = p.numero_pedido and a.desarquivado_em is null;
$$;
revoke all on function public._qc_cod_arquivados() from public, anon, authenticated;

-- O pedido (número) está 100% pego em PV, kit e componentes? Sem nenhum item a separar conta como pronto.
create or replace function public._qc_numero_tudo_pego(p_numero text) returns boolean
language sql stable security definer set search_path = public as $$
  with cod as (select upper(codigo_produto) c from public.pcp_quadro_variante where codigo_produto is not null
               union select upper(o.produto) from public.pcp_ordens o join public.pcp_pedidos p on p.codigo_pedido = o.pedido_codigo
                      where o.frente = 'quadro' and p.numero_pedido = p_numero and o.produto is not null),
  it as (select i.codigo_pedido, upper(btrim(i.codigo)) codigo, max(i.descricao) descricao, sum(i.quantidade) q, max(i.obs_item) obs
           from public.pcp_pedido_itens i join public.pcp_pedidos p on p.codigo_pedido = i.codigo_pedido
          where p.numero_pedido = p_numero and not p.cancelado group by 1, 2 having sum(i.quantidade) > 0),
  cls as (select it.*, case when codigo in (select c from cod) then 'quadro' when codigo like 'VPMP%' then 'mp' when codigo like 'VPSVC%' then 'svc'
                            when descricao ~* '^cabo\y' then 'cabo' else 'sep' end k from it),
  exigidos as (
    select codigo_pedido, codigo from cls where k in ('sep', 'cabo')
    union all
    select c.codigo_pedido, c.codigo || '#' || x.n
      from cls c, lateral unnest(string_to_array(coalesce(c.obs, ''), '|')) with ordinality as x(linha, n)
     where c.k = 'quadro' and x.linha ~ '-\s*\d+([.,]\d+)?\s*[^\s(]+\s*\([^)]+\)\s*$')
  select not exists (select 1 from exigidos e where not exists
           (select 1 from public.qc_separacao_itens s where s.codigo_pedido = e.codigo_pedido and s.codigo = e.codigo));
$$;
revoke all on function public._qc_numero_tudo_pego(text) from public, anon, authenticated;

create or replace function public.qc_arquivar_pedidos() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_f int; v_c int;
begin
  insert into public.qc_pedidos_arquivo (numero_pedido, motivo, detalhe)
  select p.numero_pedido, 'faturado', 'faturado no Omie em ' || to_char(max(p.data_faturamento), 'DD/MM/YYYY')
    from public.pcp_pedidos p
   where p.faturado and not p.cancelado and p.numero_pedido is not null
     and (exists (select 1 from public.pcp_ordens o where o.frente = 'quadro' and o.pedido_codigo in
                    (select codigo_pedido from public.pcp_pedidos x where x.numero_pedido = p.numero_pedido))
          or exists (select 1 from public.pcp_pedido_itens i where i.codigo_pedido in
                    (select codigo_pedido from public.pcp_pedidos x where x.numero_pedido = p.numero_pedido)
                    and i.codigo in (select codigo_produto from public.pcp_quadro_variante)))
   group by p.numero_pedido
  on conflict (numero_pedido) do nothing;
  get diagnostics v_f = row_count;

  insert into public.qc_pedidos_arquivo (numero_pedido, motivo, detalhe)
  select n.numero_pedido, 'concluido', 'fabricação concluída e todos os itens pegos'
    from (select distinct p.numero_pedido from public.pcp_pedidos p
           where p.numero_pedido is not null and not p.cancelado
             and exists (select 1 from public.pcp_ordens o where o.frente = 'quadro' and o.status = 'concluida' and o.pedido_codigo = p.codigo_pedido)) n
   where not exists (select 1 from public.pcp_ordens o join public.pcp_pedidos p on p.codigo_pedido = o.pedido_codigo
                      where o.frente = 'quadro' and o.status in ('aguardando', 'em_producao') and p.numero_pedido = n.numero_pedido)
     and public._qc_numero_tudo_pego(n.numero_pedido)
  on conflict (numero_pedido) do nothing;
  get diagnostics v_c = row_count;
  return jsonb_build_object('faturado', v_f, 'concluido', v_c);
end $$;
revoke all on function public.qc_arquivar_pedidos() from public, anon, authenticated;
grant execute on function public.qc_arquivar_pedidos() to service_role;

-- Lista para a aba Arquivados (alçada ver). Só os arquivados de verdade (não desarquivados).
create or replace function public.qc_arquivados_listar() returns table (numero_pedido text, cliente text, motivo text, detalhe text, arquivado_em timestamptz, arquivado_por text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.vp_usuario_ativo() then raise exception 'arquivo QC: sem sessão ativa'; end if;
  if not public.vp_tem_capacidade('quadros-pedidos', 'ver') then raise exception 'arquivo QC: sem alçada "ver"'; end if;
  return query select a.numero_pedido, (select max(p.cliente_nome) from public.pcp_pedidos p where p.numero_pedido = a.numero_pedido),
                      a.motivo, a.detalhe, a.arquivado_em, a.arquivado_por
                 from public.qc_pedidos_arquivo a where a.desarquivado_em is null order by a.arquivado_em desc;
end $$;

create or replace function public.qc_pedido_desarquivar(p_numero text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_email text := public.vp_email(); v_n int;
begin
  if not public.vp_usuario_ativo() or coalesce(v_email, '') = '' then raise exception 'arquivo QC: sem sessão ativa'; end if;
  if not public.vp_tem_capacidade('quadros-pedidos', 'editar') then raise exception 'arquivo QC: sem alçada "editar"'; end if;
  update public.qc_pedidos_arquivo set desarquivado_em = now(), desarquivado_por = v_email
   where numero_pedido = p_numero and desarquivado_em is null;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into public.vp_logs (modulo, acao, alvo, alvo_id, detalhe) values ('Quadros de Comando', 'Desarquivou pedido', 'Pedido ' || p_numero, p_numero, jsonb_build_object('por', v_email));
  end if;
  return jsonb_build_object('ok', true, 'mudou', v_n > 0);
end $$;
revoke all on function public.qc_arquivados_listar()           from public, anon, authenticated;
revoke all on function public.qc_pedido_desarquivar(text)      from public, anon, authenticated;
grant execute on function public.qc_arquivados_listar()        to authenticated;
grant execute on function public.qc_pedido_desarquivar(text)   to authenticated;

-- Páginas públicas: pedidos arquivados saem das três listas. (Mesma função de antes, com o filtro novo.)
create or replace function public._qc_dados_brutos() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cod text[]; v_ops jsonb; v_mae jsonb; v_status jsonb; v_chk jsonb; v_itq jsonb; v_ids bigint[]; v_ped jsonb; v_itens jsonb; v_fis jsonb;
  v_arq bigint[] := public._qc_cod_arquivados();
  v_opsativas uuid[];
begin
  select coalesce(array_agg(distinct codigo_produto), '{}') into v_cod from public.pcp_quadro_variante where codigo_produto is not null;

  select coalesce(array_agg(o.id), '{}') into v_opsativas from public.pcp_ordens o
   left join public.pcp_ordens m on m.id = o.ordem_mae_id
   where o.frente = 'quadro' and o.status in ('aguardando', 'em_producao')
     and not (coalesce(o.pedido_codigo, m.pedido_codigo) = any (v_arq));

  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'numero', o.numero, 'titulo', o.titulo, 'produto', o.produto, 'cliente', o.cliente,
           'status', o.status, 'prazo_entrega', o.prazo_entrega, 'data_abertura', o.data_abertura, 'pedido_codigo', o.pedido_codigo, 'ordem_mae_id', o.ordem_mae_id)), '[]'::jsonb)
    into v_ops from public.pcp_ordens o where o.id = any (v_opsativas);

  select coalesce(jsonb_object_agg(m.id::text, m.pedido_codigo), '{}'::jsonb) into v_mae
    from public.pcp_ordens m where m.id in (select ordem_mae_id from public.pcp_ordens where id = any (v_opsativas) and ordem_mae_id is not null);

  select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object('fabricacao_quadro_itens',
           (select jsonb_build_object('id', i.id, 'texto', i.texto, 'ordem', i.ordem, 'peso', i.peso) from public.fabricacao_quadro_itens i where i.id = s.item_id))), '[]'::jsonb)
    into v_status from public.fabricacao_quadro_status s where s.ordem_id = any (v_opsativas);

  select coalesce(jsonb_agg(to_jsonb(i) order by i.ordem), '[]'::jsonb) into v_chk from public.fabricacao_quadro_itens i;

  select coalesce(jsonb_agg(jsonb_build_object('codigo_pedido', x.codigo_pedido, 'codigo', x.codigo, 'quantidade', x.quantidade)), '[]'::jsonb)
    into v_itq from public.pcp_pedido_itens x where x.codigo = any (v_cod) and not (x.codigo_pedido = any (v_arq));

  select coalesce(array_agg(distinct k), '{}') into v_ids from (
    select x.codigo_pedido k from public.pcp_pedido_itens x where x.codigo = any (v_cod)
    union select o.pedido_codigo from public.pcp_ordens o where o.id = any (v_opsativas) and o.pedido_codigo is not null
    union select m.pedido_codigo from public.pcp_ordens m where m.id in (select ordem_mae_id from public.pcp_ordens where id = any (v_opsativas) and ordem_mae_id is not null) and m.pedido_codigo is not null
  ) t where k is not null and not (k = any (v_arq));

  select coalesce(jsonb_agg(jsonb_build_object('codigo_pedido', p.codigo_pedido, 'numero_pedido', p.numero_pedido, 'etapa', p.etapa, 'origem', p.origem, 'cancelado', p.cancelado,
           'so_separacao', p.so_separacao, 'cliente_nome', p.cliente_nome, 'vendedor_nome', p.vendedor_nome, 'data_pedido', p.data_pedido, 'data_previsao', p.data_previsao)), '[]'::jsonb)
    into v_ped from public.pcp_pedidos p where p.codigo_pedido = any (v_ids);

  select coalesce(jsonb_agg(jsonb_build_object('codigo_pedido', i.codigo_pedido, 'codigo', i.codigo, 'descricao', i.descricao, 'unidade', i.unidade, 'quantidade', i.quantidade, 'obs_item', i.obs_item)), '[]'::jsonb)
    into v_itens from public.pcp_pedido_itens i where i.codigo_pedido = any (v_ids);

  select coalesce(jsonb_object_agg(c, q), '{}'::jsonb) into v_fis from (
    select cod c, coalesce(
             (select e.fisico from public.importacao_varejo_estoque e where upper(e.codigo) = cod limit 1),
             (select sum(p.quantidade) from public.pcp_estoque p where upper(p.codigo) = cod)) q
      from (select distinct upper(i.codigo) cod from public.pcp_pedido_itens i where i.codigo_pedido = any (v_ids) and position('#' in i.codigo) = 0) d
  ) z where q is not null;

  return jsonb_build_object('codigosQuadro', to_jsonb(v_cod), 'ops', v_ops, 'maePedido', v_mae, 'status', v_status, 'checklist', v_chk,
                            'itensQuadro', v_itq, 'pedidos', v_ped, 'itens', v_itens, 'fisico', v_fis);
end $$;
revoke all on function public._qc_dados_brutos() from public, anon, authenticated;

select cron.schedule('qc-arquivar-pedidos', '*/15 * * * *', $$ select public.qc_arquivar_pedidos() $$);
