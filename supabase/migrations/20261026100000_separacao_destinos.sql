-- Separação distribui cada item ao seu destino (26/10/2026).
-- Spec: docs/superpowers/specs/2026-10-26-separacao-distribuicao/
-- Registra o envio de um item a "Quadro de Comando" ou "Expedição" (histórico, só insere). Corrimão/Corte continuam
-- sendo OPs (pcp_ordens). NÃO mexe em pcp_expedicoes, estoque_separacao_chamar nem separacao_hub.

create table if not exists public.separacao_destinos (
  id uuid primary key default gen_random_uuid(),
  codigo_pedido bigint not null,
  codigo text not null,
  destino text not null check (destino in ('quadro', 'expedicao')),
  ordem_id uuid references public.pcp_ordens(id) on delete set null,   -- OP de Corte que originou o envio (nulo = enviado pela Separação)
  por text,
  em timestamptz not null default now()
);
create unique index if not exists uq_separacao_destinos
  on public.separacao_destinos (codigo_pedido, codigo, destino, coalesce(ordem_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists idx_separacao_destinos_pedido on public.separacao_destinos (codigo_pedido);

-- Tabela FECHADA: só as funções abaixo (security definer) leem/gravam.
alter table public.separacao_destinos enable row level security;
revoke all on public.separacao_destinos from anon, authenticated;
grant all on public.separacao_destinos to service_role;

-- ---------- envio ----------
create or replace function public.separacao_enviar_destino(p_codigo_pedido bigint, p_codigo text, p_destino text, p_ordem_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := public.vp_email(); v_cod text := upper(btrim(coalesce(p_codigo, '')));
  v_ped public.pcp_pedidos%rowtype; v_it record; v_op public.pcp_ordens%rowtype;
  v_qtd int; v_ja int; v_falta int; v_quadros jsonb := '[]'::jsonb; v_prev record;
begin
  if not public.vp_usuario_ativo() or coalesce(v_email, '') = '' then raise exception 'destino: sem sessão ativa'; end if;
  if p_destino not in ('quadro', 'expedicao') then raise exception 'destino: destino inválido'; end if;
  if not public.vp_tem_capacidade('separacao', 'enviar_fabricacao') then
    raise exception 'destino: sem a alçada "Separação › Enviar para fabricação"';
  end if;
  select * into v_ped from public.pcp_pedidos where codigo_pedido = p_codigo_pedido;
  if not found then raise exception 'destino: pedido não encontrado'; end if;
  select upper(codigo) codigo, max(descricao) descricao, sum(quantidade) quantidade into v_it
    from public.pcp_pedido_itens where codigo_pedido = p_codigo_pedido and upper(codigo) = v_cod group by upper(codigo);
  if not found then raise exception 'destino: o item % não faz parte do pedido', v_cod; end if;

  if p_ordem_id is null then
    -- origem Separação: o item precisa estar marcado "Na operação"
    if not exists (select 1 from public.estoque_separacao_pendencias where codigo_pedido = p_codigo_pedido and codigo = v_cod and resolvido_em is null and situacao = 'na_operacao') then
      raise exception 'destino: marque primeiro o item como "Na operação" na separação';
    end if;
  else
    -- origem Corte: a OP de corte do mesmo pedido/item precisa estar concluída
    select * into v_op from public.pcp_ordens where id = p_ordem_id;
    if not found or v_op.frente <> 'corte' or v_op.pedido_codigo is distinct from p_codigo_pedido then
      raise exception 'destino: a OP informada não é uma OP de Corte deste pedido';
    end if;
    if upper(coalesce(v_op.item_codigo, '')) <> v_cod
       and not exists (select 1 from public.pcp_ordem_materiais m where m.ordem_id = p_ordem_id and upper(m.codigo) = v_cod) then
      raise exception 'destino: o item % não pertence a esta OP', v_cod;
    end if;
    if v_op.status <> 'concluida' then raise exception 'destino: conclua o corte antes de encaminhar'; end if;
  end if;

  -- já enviado a este destino?
  select * into v_prev from public.separacao_destinos
   where codigo_pedido = p_codigo_pedido and codigo = v_cod and destino = p_destino
     and coalesce(ordem_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_ordem_id, '00000000-0000-0000-0000-000000000000'::uuid);
  if found then
    raise exception 'destino: este item já foi enviado (% em %)', split_part(coalesce(v_prev.por, '—'), '@', 1), to_char(v_prev.em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI');
  end if;

  -- Quadro de Comando: se o item É um quadro (variante cadastrada) e vem da Separação, cria os pedidos de quadro (1 por unidade),
  -- com a MESMA chave origem_omie do botão do PCP (não duplica). Qualquer outro item (ex.: cabo de manobra) só registra o destino.
  if p_destino = 'quadro' and p_ordem_id is null
     and exists (select 1 from public.pcp_quadro_variante where upper(codigo_produto) = v_cod) then
    v_qtd := greatest(1, round(v_it.quantidade)::int);
    select count(*) into v_ja from public.quadros_comando
     where excluido_em is null and configuracao #>> '{origem_omie,codigo_pedido}' = p_codigo_pedido::text and upper(configuracao #>> '{origem_omie,item_codigo}') = v_cod;
    v_falta := v_qtd - v_ja;
    if v_falta <= 0 then raise exception 'destino: este item já foi enviado para Pedidos de Quadro'; end if;
    with novos as (
      insert into public.quadros_comando (origem_fabricacao, criado_por, escopo_fornecimento, configuracao)
      select 'interno', v_email, '{"quadro_comando": {"decisao": "fornecer"}}'::jsonb,
             jsonb_build_object('origem_omie', jsonb_build_object('codigo_pedido', p_codigo_pedido, 'numero_pedido', v_ped.numero_pedido,
               'item_codigo', v_cod, 'item_descricao', v_it.descricao, 'cliente_nome', v_ped.cliente_nome, 'unidade', v_ja + g, 'total', v_qtd, 'prazo', v_ped.data_previsao))
        from generate_series(1, v_falta) g
      returning id, numero_pedido)
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'numero_pedido', numero_pedido)), '[]'::jsonb) into v_quadros from novos;
  end if;

  insert into public.separacao_destinos (codigo_pedido, codigo, destino, ordem_id, por) values (p_codigo_pedido, v_cod, p_destino, p_ordem_id, v_email);
  return jsonb_build_object('ok', true, 'destino', p_destino, 'quadros', v_quadros);
end $$;
revoke all on function public.separacao_enviar_destino(bigint, text, text, uuid) from public, anon;
grant execute on function public.separacao_enviar_destino(bigint, text, text, uuid) to authenticated;

-- ---------- leitura ("onde está") ----------
create or replace function public.separacao_destinos_listar(p_codigo_pedido bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.vp_usuario_ativo() then raise exception 'destino: sem sessão ativa'; end if;
  return jsonb_build_object(
    'enviados', coalesce((select jsonb_agg(jsonb_build_object('codigo_pedido', d.codigo_pedido, 'codigo', d.codigo, 'destino', d.destino, 'ordem_id', d.ordem_id, 'por', d.por, 'em', d.em) order by d.em desc)
                            from (select * from public.separacao_destinos where p_codigo_pedido is null or codigo_pedido = p_codigo_pedido order by em desc limit 2000) d), '[]'::jsonb),
    'ops', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'numero', o.numero, 'pedido_codigo', o.pedido_codigo, 'item_codigo', o.item_codigo, 'frente', o.frente, 'status', o.status))
                       from (select * from public.pcp_ordens where frente in ('corrimao', 'corte') and item_codigo is not null and status <> 'cancelada'
                               and (p_codigo_pedido is null or pedido_codigo = p_codigo_pedido) limit 2000) o), '[]'::jsonb));
end $$;
revoke all on function public.separacao_destinos_listar(bigint) from public, anon;
grant execute on function public.separacao_destinos_listar(bigint) to authenticated;
