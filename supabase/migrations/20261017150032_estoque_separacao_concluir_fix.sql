-- Aplicada direto no banco em 17/10/2026 (versão 20261017150032) sem arquivo no repo.
-- Trazida para o git na issue #965 com o SQL EXATO de supabase_migrations.schema_migrations.
-- Já está em produção: NÃO reaplicar. Fica entre estoque_separacao_ajustes (20261017140000) e
-- pcp_pedidos_so_separacao (20261017170000), que redefine esta mesma função depois.

create or replace function public.estoque_separacao_chamar(p_email text, p_acao text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_ped bigint; v_ped_row public.pcp_pedidos%rowtype; v_sep public.estoque_separacoes%rowtype;
  v_cod text; v_end text; v_qtd numeric; v_pedida numeric; v_sep_cod numeric; v_atual numeric;
  v_out jsonb; v_faltas jsonb; v_forcar boolean;
begin
  if v_email = '' then raise exception 'estoque: e-mail não informado'; end if;
  if not public.estoque_cap_email(v_email, 'saida') then
    raise exception 'estoque: % não tem alçada "saida" (ou está inativo)', v_email;
  end if;
  p_args := coalesce(p_args, '{}'::jsonb);
  v_ped := nullif(p_args->>'codigo_pedido', '')::bigint;
  v_cod := upper(btrim(coalesce(p_args->>'codigo', '')));

  if p_acao = 'fila' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.data_previsao nulls last, x.numero_pedido), '[]'::jsonb) into v_out from (
      select p.codigo_pedido, p.numero_pedido,
             coalesce(nullif(btrim(p.cliente_fantasia), ''), p.cliente_nome) as cliente, p.data_previsao,
             (select count(distinct upper(i.codigo)) from public.pcp_pedido_itens i where i.codigo_pedido = p.codigo_pedido) as itens,
             (select count(*) from (
                select upper(i.codigo) c, sum(i.quantidade) pedida from public.pcp_pedido_itens i
                 where i.codigo_pedido = p.codigo_pedido group by upper(i.codigo)) t
               where coalesce((select sum(si.qtd_separada) from public.estoque_separacao_itens si
                                where si.codigo_pedido = p.codigo_pedido and si.codigo = t.c), 0) >= t.pedida) as separados,
             case when s.codigo_pedido is null then 'livre' when s.status = 'separado' then 'separado'
                  when s.pego_por is null then 'livre' else 'em_separacao' end as status,
             s.pego_por, s.pego_em, s.separado_em
        from public.pcp_pedidos p
        left join public.estoque_separacoes s on s.codigo_pedido = p.codigo_pedido
       where p.etapa = '20' and not p.cancelado and not p.faturado
         and not coalesce((select a.historico from public.pcp_pedido_acompanhamento a where a.numero_pedido = p.numero_pedido), false)
         and exists (select 1 from public.pcp_pedido_itens i where i.codigo_pedido = p.codigo_pedido)) x;
    return jsonb_build_object('pedidos', v_out);
  end if;

  if v_ped is null then raise exception 'estoque: informe codigo_pedido'; end if;
  select * into v_ped_row from public.pcp_pedidos where codigo_pedido = v_ped;
  if not found then raise exception 'estoque: pedido não encontrado'; end if;
  select * into v_sep from public.estoque_separacoes where codigo_pedido = v_ped for update;
  if p_acao in ('assumir', 'separar', 'concluir') and (v_ped_row.etapa <> '20' or v_ped_row.cancelado or v_ped_row.faturado) then
    raise exception 'estoque: este pedido não está mais para separar (etapa %)', v_ped_row.etapa;
  end if;

  case p_acao
    when 'itens' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.codigo), '[]'::jsonb) into v_out from (
        select t.codigo, max(t.descricao) as descricao, max(t.unidade) as unidade, sum(t.quantidade) as qtd_pedida,
               coalesce((select sum(si.qtd_separada) from public.estoque_separacao_itens si
                          where si.codigo_pedido = v_ped and si.codigo = t.codigo), 0) as qtd_separada,
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
                   'status', case when v_sep.codigo_pedido is null or (v_sep.status = 'em_separacao' and v_sep.pego_por is null) then 'livre' else v_sep.status end,
                   'pego_por', v_sep.pego_por, 'pego_em', v_sep.pego_em),
        'itens', v_out);

    when 'pegar' then
      if v_ped_row.etapa <> '20' or v_ped_row.cancelado or v_ped_row.faturado then
        raise exception 'estoque: este pedido não está mais para separar (etapa %)', v_ped_row.etapa;
      end if;
      if v_sep.codigo_pedido is null then
        insert into public.estoque_separacoes (codigo_pedido, numero_pedido, status, pego_por, pego_em)
        values (v_ped, v_ped_row.numero_pedido, 'em_separacao', v_email, now());
      elsif v_sep.status = 'separado' then
        raise exception 'estoque: este pedido já foi separado por %', coalesce(v_sep.separado_por, 'outra pessoa');
      elsif v_sep.pego_por is not null and v_sep.pego_por <> v_email then
        raise exception 'estoque: este pedido já está com % — use "assumir" para tomar o pedido', v_sep.pego_por;
      elsif v_sep.pego_por is null then
        update public.estoque_separacoes set pego_por = v_email, pego_em = now(), atualizado_em = now() where codigo_pedido = v_ped;
      else
        return jsonb_build_object('ok', true, 'ja_era_seu', true);
      end if;
      insert into public.estoque_separacao_hist (codigo_pedido, acao, por) values (v_ped, 'pegou', v_email);
      return jsonb_build_object('ok', true);

    when 'assumir' then
      if v_sep.codigo_pedido is null then raise exception 'estoque: ninguém pegou este pedido — use "pegar"'; end if;
      if v_sep.status = 'separado' then raise exception 'estoque: este pedido já foi separado'; end if;
      if v_sep.pego_por = v_email then return jsonb_build_object('ok', true, 'ja_era_seu', true); end if;
      update public.estoque_separacoes set pego_por = v_email, pego_em = now(), atualizado_em = now() where codigo_pedido = v_ped;
      insert into public.estoque_separacao_hist (codigo_pedido, acao, por, de_quem) values (v_ped, 'assumiu', v_email, v_sep.pego_por);
      return jsonb_build_object('ok', true, 'de_quem', v_sep.pego_por);

    when 'soltar' then
      if v_sep.codigo_pedido is null or v_sep.pego_por is null then return jsonb_build_object('ok', true, 'ja_estava_livre', true); end if;
      if v_sep.status = 'separado' then raise exception 'estoque: este pedido já foi separado'; end if;
      if v_sep.pego_por <> v_email and not public.estoque_cap_email(v_email, 'revisar') then
        raise exception 'estoque: só % (ou quem tem a alçada "revisar") solta este pedido', v_sep.pego_por;
      end if;
      update public.estoque_separacoes set pego_por = null, pego_em = null, atualizado_em = now() where codigo_pedido = v_ped;
      insert into public.estoque_separacao_hist (codigo_pedido, acao, por, de_quem) values (v_ped, 'soltou', v_email, v_sep.pego_por);
      return jsonb_build_object('ok', true);

    when 'separar' then
      if v_sep.codigo_pedido is null or v_sep.status <> 'em_separacao' or v_sep.pego_por is distinct from v_email then
        raise exception 'estoque: pegue o pedido antes de separar (ou ele já foi concluído/está com outra pessoa)';
      end if;
      v_qtd := (p_args->>'quantidade')::numeric;
      if v_qtd is null or v_qtd = 0 then raise exception 'estoque: informe a quantidade'; end if;
      if v_cod = '' then raise exception 'estoque: informe o codigo do item'; end if;
      v_end := public.estoque_endereco_normalizar(p_args->>'endereco');
      if v_end is null or v_end = 'EXP' then
        raise exception 'estoque: endereço "%" não existe (ou é a expedição) — bipe um endereço de porta-palete', coalesce(p_args->>'endereco', '');
      end if;
      select sum(i.quantidade) into v_pedida from public.pcp_pedido_itens i where i.codigo_pedido = v_ped and upper(i.codigo) = v_cod;
      if v_pedida is null then raise exception 'estoque: o item % não faz parte deste pedido', v_cod; end if;
      select coalesce(sum(si.qtd_separada), 0) into v_sep_cod from public.estoque_separacao_itens si where si.codigo_pedido = v_ped and si.codigo = v_cod;
      select coalesce(max(si.qtd_separada), 0) into v_atual from public.estoque_separacao_itens si
       where si.codigo_pedido = v_ped and si.codigo = v_cod and si.endereco = v_end;
      if v_atual + v_qtd < 0 then raise exception 'estoque: não há % separado de % em %', abs(v_qtd), v_cod, v_end; end if;
      if v_sep_cod + v_qtd > v_pedida then
        raise exception 'estoque: o pedido tem % de % e já foram separados % (não separe mais que o pedido)', v_pedida, v_cod, v_sep_cod;
      end if;
      insert into public.estoque_separacao_itens (codigo_pedido, codigo, endereco, qtd_separada, atualizado_por)
      values (v_ped, v_cod, v_end, v_atual + v_qtd, v_email)
      on conflict (codigo_pedido, codigo, endereco)
      do update set qtd_separada = excluded.qtd_separada, atualizado_por = v_email, atualizado_em = now();
      update public.estoque_separacoes set atualizado_em = now() where codigo_pedido = v_ped;
      insert into public.estoque_separacao_hist (codigo_pedido, acao, por, detalhe)
      values (v_ped, 'separou', v_email, jsonb_build_object('codigo', v_cod, 'endereco', v_end, 'quantidade', v_qtd));
      return jsonb_build_object('ok', true, 'codigo', v_cod, 'endereco', v_end, 'qtd_pedida', v_pedida, 'qtd_separada', v_sep_cod + v_qtd);

    when 'concluir' then
      if v_sep.codigo_pedido is null or v_sep.status <> 'em_separacao' or v_sep.pego_por is distinct from v_email then
        raise exception 'estoque: só quem pegou o pedido pode concluir (ou ele já foi concluído)';
      end if;
      v_forcar := coalesce((p_args->>'forcar')::boolean, false);
      select coalesce(jsonb_agg(jsonb_build_object('codigo', t.c, 'pedida', t.pedida, 'separada', t.sep)), '[]'::jsonb) into v_faltas from (
        select g.c, g.pedida,
               coalesce((select sum(si.qtd_separada) from public.estoque_separacao_itens si
                          where si.codigo_pedido = v_ped and si.codigo = g.c), 0) sep
          from (select upper(i.codigo) c, sum(i.quantidade) pedida from public.pcp_pedido_itens i
                 where i.codigo_pedido = v_ped group by upper(i.codigo)) g) t
       where t.sep < t.pedida;
      if jsonb_array_length(v_faltas) > 0 and not v_forcar then
        raise exception 'estoque: faltam % item(ns) para separar — confirme para concluir com falta', jsonb_array_length(v_faltas);
      end if;
      update public.estoque_separacoes set status = 'separado', separado_por = v_email, separado_em = now(), atualizado_em = now()
       where codigo_pedido = v_ped;
      insert into public.estoque_separacao_hist (codigo_pedido, acao, por, detalhe)
      values (v_ped, 'concluiu', v_email, jsonb_build_object('faltas', v_faltas));
      return jsonb_build_object('ok', true, 'faltas', v_faltas);

    else
      raise exception 'estoque: ação de separação desconhecida: %', p_acao;
  end case;
end $$;
revoke all on function public.estoque_separacao_chamar(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.estoque_separacao_chamar(text, text, jsonb) to service_role;
