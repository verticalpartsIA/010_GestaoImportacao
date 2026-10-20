-- Separação no HUB (computador): a mesma fila e as mesmas regras do celular (VP Estoque), para o operador separar sem o app.
-- Decisão do Gelson (20/10/2026): /logistica/separacao passa a ter duas abas — "Pedidos a separar" (primeira) e "Painel TV" (links, SLA).
--   * NÃO duplica regra: as ações de escrita (pegar, assumir, soltar, separar, concluir) chamam estoque_separacao_chamar, a MESMA função do celular,
--     com o e-mail do usuário logado (vp_email()). Ela já valida alçada estoque.saida, etapa 20, não separar mais que o pedido, endereço existente.
--   * Leitura (fila, itens) exige separacao.ver e é própria (inclui cliente, quem pegou, SLA — o hub é interno; o painel TV público continua sem cliente).
--   * Escrita exige estoque.saida (a mesma alçada do celular). Administrador passa em tudo (vp_tem_capacidade).
-- Nada aqui escreve no Omie nem em estoque_eventos (separar não baixa estoque: a NF de saída baixa).

create or replace function public.separacao_hub(p_acao text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := public.vp_email();
  v_ped bigint; v_ped_row public.pcp_pedidos%rowtype; v_sep public.estoque_separacoes%rowtype;
  v_out jsonb; v_sla numeric;
begin
  if not public.vp_usuario_ativo() or coalesce(v_email, '') = '' then raise exception 'separação: sem sessão ativa'; end if;
  p_args := coalesce(p_args, '{}'::jsonb);
  v_ped := nullif(p_args->>'codigo_pedido', '')::bigint;

  if p_acao = 'fila' then
    if not public.vp_tem_capacidade('separacao', 'ver') then raise exception 'separação: sem alçada "ver"'; end if;
    select sla_horas into v_sla from public.separacao_tv_config where id;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.ordem, x.data_previsao nulls last, x.numero_pedido), '[]'::jsonb) into v_out from (
      select p.codigo_pedido, p.numero_pedido,
             coalesce(nullif(btrim(p.cliente_fantasia), ''), p.cliente_nome) as cliente, p.data_previsao,
             coalesce(p.entrada_em, p.atualizado_em) as entrada_em,
             (select count(distinct upper(i.codigo)) from public.pcp_pedido_itens i where i.codigo_pedido = p.codigo_pedido) as itens,
             (select count(*) from (
                select upper(i.codigo) c, sum(i.quantidade) pedida from public.pcp_pedido_itens i
                 where i.codigo_pedido = p.codigo_pedido group by upper(i.codigo)) t
               where coalesce((select sum(si.qtd_separada) from public.estoque_separacao_itens si
                                where si.codigo_pedido = p.codigo_pedido and si.codigo = t.c), 0) >= t.pedida) as separados,
             case when s.codigo_pedido is null then 'livre' when s.status = 'separado' then 'separado'
                  when s.pego_por is null then 'livre' else 'em_separacao' end as status,
             case when s.status = 'separado' then 2 when s.pego_por is not null then 1 else 0 end as ordem,
             s.pego_por, s.pego_em, s.separado_por, s.separado_em,
             round(public.inbox_horas_comerciais(coalesce(p.entrada_em, p.atualizado_em), coalesce(s.separado_em, now())) * 60)::int as decorrido_min
        from public.pcp_pedidos p
        left join public.estoque_separacoes s on s.codigo_pedido = p.codigo_pedido
       where not p.cancelado
         and exists (select 1 from public.pcp_pedido_itens i where i.codigo_pedido = p.codigo_pedido)
         and ( (s.status = 'separado' and s.separado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
            or (p.etapa = '20' and not p.faturado and coalesce(s.status, 'em_separacao') <> 'separado'
                and not coalesce((select a.historico from public.pcp_pedido_acompanhamento a where a.numero_pedido = p.numero_pedido), false)) )) x;
    return jsonb_build_object('sla_min', round(v_sla * 60)::int, 'eu', v_email, 'pedidos', v_out);
  end if;

  if v_ped is null then raise exception 'separação: informe codigo_pedido'; end if;

  if p_acao = 'itens' then
    if not public.vp_tem_capacidade('separacao', 'ver') then raise exception 'separação: sem alçada "ver"'; end if;
    select * into v_ped_row from public.pcp_pedidos where codigo_pedido = v_ped;
    if not found then raise exception 'separação: pedido não encontrado'; end if;
    select * into v_sep from public.estoque_separacoes where codigo_pedido = v_ped;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.codigo), '[]'::jsonb) into v_out from (
      select t.codigo, max(t.descricao) as descricao, max(t.unidade) as unidade, sum(t.quantidade) as qtd_pedida,
             coalesce((select sum(si.qtd_separada) from public.estoque_separacao_itens si
                        where si.codigo_pedido = v_ped and si.codigo = t.codigo), 0) as qtd_separada,
             coalesce((select jsonb_agg(jsonb_build_object('endereco', si.endereco, 'qtd', si.qtd_separada) order by si.endereco)
                         from public.estoque_separacao_itens si
                        where si.codigo_pedido = v_ped and si.codigo = t.codigo and si.qtd_separada > 0), '[]'::jsonb) as separacoes,
             (select coalesce(jsonb_agg(distinct z.e), '[]'::jsonb) from (
                select public.estoque_endereco_normalizar(pp.endereco) e from public.pcp_produtos pp where upper(pp.codigo) = t.codigo
                union
                select si.endereco from public.estoque_separacao_itens si where si.codigo_pedido = v_ped and si.codigo = t.codigo) z
              where z.e is not null) as enderecos
        from (select upper(i.codigo) codigo, i.descricao, i.unidade, i.quantidade
                from public.pcp_pedido_itens i where i.codigo_pedido = v_ped) t
       group by t.codigo) x;
    return jsonb_build_object(
      'pedido', jsonb_build_object('codigo_pedido', v_ped, 'numero_pedido', v_ped_row.numero_pedido,
                 'cliente', coalesce(nullif(btrim(v_ped_row.cliente_fantasia), ''), v_ped_row.cliente_nome),
                 'etapa', v_ped_row.etapa,
                 'status', case when v_sep.codigo_pedido is null or (v_sep.status = 'em_separacao' and v_sep.pego_por is null) then 'livre' else v_sep.status end,
                 'pego_por', v_sep.pego_por, 'pego_em', v_sep.pego_em, 'separado_por', v_sep.separado_por, 'separado_em', v_sep.separado_em),
      'itens', v_out);
  end if;

  if p_acao in ('pegar', 'assumir', 'soltar', 'separar', 'concluir') then
    if not public.vp_tem_capacidade('estoque', 'saida') then
      raise exception 'separação: para separar é preciso a alçada "VP Estoque › Saída" (a mesma do celular)';
    end if;
    return public.estoque_separacao_chamar(v_email, p_acao, p_args);
  end if;

  raise exception 'separação: ação desconhecida: %', p_acao;
end $$;

revoke execute on function public.separacao_hub(text, jsonb) from public, anon, authenticated;
grant execute on function public.separacao_hub(text, jsonb) to authenticated;
