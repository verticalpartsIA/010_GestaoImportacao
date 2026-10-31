-- VP Estoque · fila de separação: o que FALTA em estoque e o que está POR CHEGAR da importação (pedido do Gelson, 17/10/2026).
-- Um pedido de venda pode conter item de importação que ainda não chegou. O celular via o pedido como separável, mas o
-- comprador (hub › Compras) já sabe o que está a caminho. Esta função só LÊ e cruza, por item do pedido:
--   • estoque FÍSICO do Omie (cache de importacao_varejo_estoque, até ~6 h de defasagem) contra a quantidade pedida;
--   • o que está por chegar (view importacao_varejo_a_caminho: a caminho / chegou e falta a nota / P.I. aberta) e a data prevista.
-- Situação do item: em_estoque (físico >= pedido) · parcial (0 < físico < pedido) · sem_estoque (zero ou sem registro).
-- Usa o FÍSICO, não o disponível: o reservado do Omie já inclui este pedido (usar o disponível contaria a venda duas vezes).
-- Limite: não considera concorrência entre pedidos pelo mesmo estoque, e produto fora do catálogo de importação não tem
-- registro de estoque aqui (aparece como sem_estoque). Não bloqueia nada: é informação para o almoxarife decidir.
-- Sem p_codigo_pedido devolve o resumo por pedido (para a fila); com ele, o detalhe por item (para a tela do pedido).
-- Só service_role executa (a Edge Function estoque-separacao passa o e-mail validado). Alçada: estoque.saida.

create or replace function public.estoque_separacao_chegadas(p_email text, p_codigo_pedido bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_out jsonb;
begin
  if v_email = '' then raise exception 'estoque: e-mail não informado'; end if;
  if not public.estoque_cap_email(v_email, 'saida') then
    raise exception 'estoque: % não tem alçada "saida" (ou está inativo)', v_email;
  end if;

  with itens as (
    select i.codigo_pedido, upper(i.codigo) as codigo, sum(i.quantidade) as pedida
      from public.pcp_pedido_itens i
      join public.pcp_pedidos p on p.codigo_pedido = i.codigo_pedido
     where p.etapa = '20' and not p.cancelado and not p.faturado
       and (p_codigo_pedido is null or p.codigo_pedido = p_codigo_pedido)
     group by i.codigo_pedido, upper(i.codigo)
  ), det as (
    select it.codigo_pedido, it.codigo, it.pedida,
           coalesce(e.fisico, 0) as fisico, e.atualizado_em as estoque_atualizado_em,
           coalesce(c.a_caminho, 0) as a_caminho,
           coalesce(c.chegou_sem_nota, 0) as chegou_sem_nota,
           coalesce(c.comprado_pi, 0) as comprado_pi,
           (select min(coalesce(d->>'entrega', d->>'eta'))
              from jsonb_array_elements(coalesce(c.detalhes, '[]'::jsonb)) d
             where d->>'estagio' = 'a_caminho') as proxima_chegada,
           -- embarque mais próximo de chegar (a data costuma estar em branco; o nome do embarque ajuda a achar)
           (select d->>'embarque'
              from jsonb_array_elements(coalesce(c.detalhes, '[]'::jsonb)) d
             where d->>'estagio' = 'a_caminho'
             order by coalesce(d->>'entrega', d->>'eta') nulls last, d->>'embarque' limit 1) as embarque,
           case when coalesce(e.fisico, 0) >= it.pedida then 'em_estoque'
                when coalesce(e.fisico, 0) > 0 then 'parcial' else 'sem_estoque' end as situacao
      from itens it
      left join public.importacao_varejo_estoque e on upper(e.codigo) = it.codigo
      left join public.importacao_varejo_a_caminho c on upper(c.codigo) = it.codigo
  )
  select case when p_codigo_pedido is null then
    coalesce((select jsonb_agg(jsonb_build_object(
        'codigo_pedido', g.codigo_pedido,
        'itens_faltando', g.faltando,
        'aguardando_chegada', g.aguardando,
        'sem_previsao', g.faltando - g.aguardando,
        'proxima_chegada', g.proxima) order by g.codigo_pedido)
      from (select codigo_pedido,
                   count(*) filter (where situacao <> 'em_estoque') as faltando,
                   count(*) filter (where situacao <> 'em_estoque' and (a_caminho + chegou_sem_nota + comprado_pi) > 0) as aguardando,
                   min(proxima_chegada) filter (where situacao <> 'em_estoque') as proxima
              from det group by codigo_pedido) g), '[]'::jsonb)
  else
    coalesce((select jsonb_agg(jsonb_build_object(
        'codigo', d.codigo, 'pedida', d.pedida, 'fisico', d.fisico, 'situacao', d.situacao,
        'a_caminho', d.a_caminho, 'chegou_sem_nota', d.chegou_sem_nota, 'comprado_pi', d.comprado_pi,
        'proxima_chegada', d.proxima_chegada, 'embarque', d.embarque, 'estoque_atualizado_em', d.estoque_atualizado_em) order by d.codigo)
      from det d), '[]'::jsonb)
  end into v_out;

  return jsonb_build_object('chegadas', v_out);
end $$;
revoke all on function public.estoque_separacao_chegadas(text, bigint) from public, anon, authenticated;
grant execute on function public.estoque_separacao_chegadas(text, bigint) to service_role;
