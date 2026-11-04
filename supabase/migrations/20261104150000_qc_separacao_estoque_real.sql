-- Quadros de Comando › Separação: ESTOQUE REAL informado pelo usuário (pedido do Gelson, 04/11/2026).
-- O sistema pode mostrar 15 em estoque e na prateleira não ter nada. O almoxarife digita o estoque real conferido por item de cada pedido;
-- a "falta" da tela passa a usar o real quando ele existir (senão o do sistema). A observação já existia (obs) e ganha coluna própria na tela.
-- Mesmas travas da migration anterior: tabelas fechadas, só por função com alçada quadros-separacao (ver/editar), histórico imutável.

alter table public.qc_separacao_previsao      add column if not exists estoque_real numeric(14,3);
alter table public.qc_separacao_previsao_hist add column if not exists estoque_real numeric(14,3);
alter table public.qc_separacao_previsao drop constraint if exists qc_previsao_estoque_real_nao_negativo;
alter table public.qc_separacao_previsao add constraint qc_previsao_estoque_real_nao_negativo check (estoque_real is null or estoque_real >= 0);

-- as funções mudam de assinatura: saem as antigas e entram as novas (a tabela está vazia, nada a migrar)
drop function if exists public.qc_separacao_previsao_listar(bigint[]);
drop function if exists public.qc_separacao_previsao_gravar(bigint, text, date, text);

create or replace function public.qc_separacao_previsao_listar(p_pedidos bigint[])
returns table (codigo_pedido bigint, codigo text, previsao date, obs text, estoque_real numeric, atualizado_por text, atualizado_em timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.vp_usuario_ativo() then raise exception 'separação QC: sem sessão ativa'; end if;
  if not public.vp_tem_capacidade('quadros-separacao', 'ver') then raise exception 'separação QC: sem alçada "ver"'; end if;
  return query
    select p.codigo_pedido, p.codigo, p.previsao, p.obs, p.estoque_real, p.atualizado_por, p.atualizado_em
      from public.qc_separacao_previsao p
     where p.codigo_pedido = any (coalesce(p_pedidos, '{}'::bigint[]));
end $$;

-- Define, altera ou limpa (tudo vazio) as anotações de um item: previsão de entrega, observação e estoque real.
-- Idempotente: repetir o mesmo valor não gera histórico.
create or replace function public.qc_separacao_previsao_gravar(p_codigo_pedido bigint, p_codigo text, p_previsao date, p_obs text, p_estoque_real numeric)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := public.vp_email();
  v_cod   text := upper(btrim(coalesce(p_codigo, '')));
  v_obs   text := nullif(btrim(coalesce(p_obs, '')), '');
  v_base  text;
  v_idx   int;
  v_ant   public.qc_separacao_previsao%rowtype;
  v_tem   boolean;
begin
  if not public.vp_usuario_ativo() or coalesce(v_email, '') = '' then raise exception 'separação QC: sem sessão ativa'; end if;
  if not public.vp_tem_capacidade('quadros-separacao', 'editar') then raise exception 'separação QC: sem alçada "editar"'; end if;
  if p_codigo_pedido is null or v_cod = '' then raise exception 'separação QC: informe pedido e item'; end if;
  if v_obs is not null and char_length(v_obs) > 300 then raise exception 'separação QC: a observação passa de 300 caracteres'; end if;
  if p_estoque_real is not null and (p_estoque_real < 0 or p_estoque_real > 100000000) then
    raise exception 'separação QC: estoque real inválido (use um número de 0 em diante)';
  end if;
  if p_previsao is not null and (p_previsao < date '2020-01-01' or p_previsao > current_date + 1095) then
    raise exception 'separação QC: previsão fora do intervalo aceito (2020 até 3 anos à frente)';
  end if;

  -- o item (ou a linha de componente "<ITEM>#<n>") precisa existir no pedido do Omie
  if position('#' in v_cod) > 0 then
    if v_cod !~ '^[^#]+#[0-9]+$' then raise exception 'separação QC: código de componente inválido: %', v_cod; end if;
    v_base := split_part(v_cod, '#', 1);
    v_idx  := split_part(v_cod, '#', 2)::int;
    if not exists (
      select 1 from public.pcp_pedido_itens i
       where i.codigo_pedido = p_codigo_pedido and upper(i.codigo) = v_base and i.obs_item is not null
         and v_idx between 1 and array_length(string_to_array(i.obs_item, '|'), 1)
    ) then raise exception 'separação QC: o componente % não existe no pedido %', v_cod, p_codigo_pedido; end if;
  elsif not exists (select 1 from public.pcp_pedido_itens i where i.codigo_pedido = p_codigo_pedido and upper(i.codigo) = v_cod) then
    raise exception 'separação QC: o item % não pertence ao pedido %', v_cod, p_codigo_pedido;
  end if;

  select * into v_ant from public.qc_separacao_previsao where codigo_pedido = p_codigo_pedido and codigo = v_cod;
  v_tem := found;

  if p_previsao is null and v_obs is null and p_estoque_real is null then
    if v_tem then
      delete from public.qc_separacao_previsao where codigo_pedido = p_codigo_pedido and codigo = v_cod;
      insert into public.qc_separacao_previsao_hist (codigo_pedido, codigo, previsao, obs, estoque_real, acao, por) values (p_codigo_pedido, v_cod, null, null, null, 'limpou', v_email);
    end if;
    return jsonb_build_object('ok', true, 'mudou', v_tem, 'por', v_email);
  end if;

  if v_tem and v_ant.previsao is not distinct from p_previsao and v_ant.obs is not distinct from v_obs and v_ant.estoque_real is not distinct from p_estoque_real then
    return jsonb_build_object('ok', true, 'mudou', false, 'por', v_email);
  end if;

  insert into public.qc_separacao_previsao (codigo_pedido, codigo, previsao, obs, estoque_real, atualizado_por, atualizado_em)
    values (p_codigo_pedido, v_cod, p_previsao, v_obs, p_estoque_real, v_email, now())
    on conflict (codigo_pedido, codigo) do update
      set previsao = excluded.previsao, obs = excluded.obs, estoque_real = excluded.estoque_real,
          atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em;
  insert into public.qc_separacao_previsao_hist (codigo_pedido, codigo, previsao, obs, estoque_real, acao, por)
    values (p_codigo_pedido, v_cod, p_previsao, v_obs, p_estoque_real, case when v_tem then 'alterou' else 'definiu' end, v_email);
  return jsonb_build_object('ok', true, 'mudou', true, 'por', v_email);
end $$;

revoke all on function public.qc_separacao_previsao_listar(bigint[])                            from public, anon, authenticated;
revoke all on function public.qc_separacao_previsao_gravar(bigint, text, date, text, numeric)  from public, anon, authenticated;
grant execute on function public.qc_separacao_previsao_listar(bigint[])                         to authenticated;
grant execute on function public.qc_separacao_previsao_gravar(bigint, text, date, text, numeric) to authenticated;
