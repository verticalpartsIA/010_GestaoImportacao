-- Rastreabilidade: toda OP carrega o nº do pedido do Omie (raiz) e os códigos do pedido que ela cobre.
alter table public.pcp_ordens add column if not exists numero_pedido_omie text;
alter table public.pcp_ordens add column if not exists itens_pedido jsonb not null default '[]'::jsonb;

create or replace function public.pcp_ordens_raiz_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cods jsonb;
begin
  if new.pedido_codigo is null then return new; end if;
  if new.numero_pedido_omie is null or tg_op = 'INSERT' or new.pedido_codigo is distinct from old.pedido_codigo then
    select numero_pedido into new.numero_pedido_omie from public.pcp_pedidos where codigo_pedido = new.pedido_codigo limit 1;
  end if;
  if coalesce(jsonb_array_length(new.itens_pedido), 0) = 0 then
    if new.item_codigo is not null then
      v_cods := jsonb_build_array(new.item_codigo);
    elsif new.frente = 'pedido' then
      select coalesce(jsonb_agg(c order by c), '[]') into v_cods from (select distinct upper(codigo) c from public.pcp_pedido_itens where codigo_pedido = new.pedido_codigo) t;
    elsif new.frente = 'quadro' then
      select coalesce(jsonb_agg(c order by c), '[]') into v_cods from (select distinct upper(i.codigo) c from public.pcp_pedido_itens i
        where i.codigo_pedido = new.pedido_codigo and i.item_pcp and upper(i.codigo) in (select upper(codigo_produto) from public.pcp_quadro_variante where codigo_produto is not null)) t;
    else
      select coalesce(jsonb_agg(c order by c), '[]') into v_cods from (select distinct upper(i.codigo) c from public.pcp_pedido_itens i
        where i.codigo_pedido = new.pedido_codigo and i.item_pcp and upper(i.codigo) not in (select upper(codigo_produto) from public.pcp_quadro_variante where codigo_produto is not null)) t;
    end if;
    new.itens_pedido := coalesce(v_cods, '[]'::jsonb);
  end if;
  return new;
end $$;

drop trigger if exists trg_pcp_ordens_raiz_pedido on public.pcp_ordens;
create trigger trg_pcp_ordens_raiz_pedido before insert or update of pedido_codigo on public.pcp_ordens
  for each row execute function public.pcp_ordens_raiz_pedido();

-- carga das OPs existentes (dispara o gatilho pelo UPDATE de pedido_codigo)
update public.pcp_ordens set pedido_codigo = pedido_codigo where pedido_codigo is not null;

-- página pública do chão de fábrica passa a mostrar a raiz
create or replace function public.public_fab_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_l public.fab_links%rowtype; v_o public.pcp_ordens%rowtype;
begin
  select * into v_l from public.fab_links where token = p_token;
  if not found then return null; end if;
  select * into v_o from public.pcp_ordens where id = v_l.ordem_id;
  return jsonb_build_object(
    'destino', v_l.destino,
    'ordem', jsonb_build_object('id', v_o.id, 'numero', v_o.numero, 'titulo', v_o.titulo, 'quantidade', v_o.quantidade,
             'cliente', v_o.cliente, 'prazo_entrega', v_o.prazo_entrega, 'status', v_o.status, 'pedido_codigo', v_o.pedido_codigo, 'item_codigo', v_o.item_codigo,
             'numero_pedido_omie', v_o.numero_pedido_omie, 'itens_pedido', v_o.itens_pedido),
    'etapas', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'ordem', e.ordem, 'texto', e.texto, 'peso', e.peso,
                'flegado', coalesce(s.flegado, false), 'flegado_em', s.flegado_em, 'flegado_por', s.flegado_por) order by e.ordem)
              from public.fab_etapas e left join public.fab_status s on s.etapa_id = e.id and s.ordem_id = v_l.ordem_id
              where e.destino = v_l.destino), '[]'::jsonb),
    'ocorrencias', coalesce((select jsonb_agg(to_jsonb(o) order by o.aberta_em desc) from public.fab_ocorrencias o where o.ordem_id = v_l.ordem_id), '[]'::jsonb),
    'sobra', (select to_jsonb(b) from public.fab_sobras b where b.ordem_id = v_l.ordem_id));
end $$;
