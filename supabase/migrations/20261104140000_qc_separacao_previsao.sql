-- Quadros de Comando › Separação PV QC / FAB QC: PREVISÃO DE ENTREGA do que falta (pedido de 04/11/2026).
-- Exemplo do Gelson: o pedido pede 20 peças, o estoque tem 4, faltam 16: a empresa fica devendo e informa uma previsão de entrega.
-- A "falta" é calculada na tela (quantidade do pedido − estoque físico); só a PREVISÃO (data + observação) é digitada, por item de cada pedido.
-- Nasce FECHADA (Art. 26): anon/authenticated não leem nem gravam as tabelas; o acesso é só pelas duas funções abaixo, que exigem
-- usuário ativo + alçada do módulo 'quadros-separacao' (ver/editar; Administrador passa). O histórico é imutável (Art. 27).

create table if not exists public.qc_separacao_previsao (
  codigo_pedido  bigint      not null,          -- pcp_pedidos.codigo_pedido
  codigo         text        not null,          -- código do item (ou "<ITEM>#<n>" para componente do quadro), em MAIÚSCULAS
  previsao       date,                          -- data prevista de entrega do que falta
  obs            text,                          -- observação livre (fornecedor, nº do pedido de compra…), até 300 caracteres
  atualizado_por text        not null,
  atualizado_em  timestamptz not null default now(),
  primary key (codigo_pedido, codigo),
  constraint qc_previsao_obs_tam check (obs is null or char_length(obs) <= 300)
);

create table if not exists public.qc_separacao_previsao_hist (
  id            bigint generated always as identity primary key,
  codigo_pedido bigint      not null,
  codigo        text        not null,
  previsao      date,
  obs           text,
  acao          text        not null check (acao in ('definiu', 'alterou', 'limpou')),
  por           text        not null,
  em            timestamptz not null default now()
);
create index if not exists qc_separacao_previsao_hist_idx on public.qc_separacao_previsao_hist (codigo_pedido, em desc);

alter table public.qc_separacao_previsao      enable row level security;
alter table public.qc_separacao_previsao_hist enable row level security;
revoke all on public.qc_separacao_previsao      from public, anon, authenticated;
revoke all on public.qc_separacao_previsao_hist from public, anon, authenticated;
grant all on public.qc_separacao_previsao      to service_role;
grant all on public.qc_separacao_previsao_hist to service_role;

create or replace function public.qc_separacao_previsao_listar(p_pedidos bigint[])
returns table (codigo_pedido bigint, codigo text, previsao date, obs text, atualizado_por text, atualizado_em timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.vp_usuario_ativo() then raise exception 'separação QC: sem sessão ativa'; end if;
  if not public.vp_tem_capacidade('quadros-separacao', 'ver') then raise exception 'separação QC: sem alçada "ver"'; end if;
  return query
    select p.codigo_pedido, p.codigo, p.previsao, p.obs, p.atualizado_por, p.atualizado_em
      from public.qc_separacao_previsao p
     where p.codigo_pedido = any (coalesce(p_pedidos, '{}'::bigint[]));
end $$;

-- Define, altera ou limpa (data e observação vazias) a previsão de um item. Idempotente: repetir o mesmo valor não gera histórico.
create or replace function public.qc_separacao_previsao_gravar(p_codigo_pedido bigint, p_codigo text, p_previsao date, p_obs text)
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

  if p_previsao is null and v_obs is null then
    if v_tem then
      delete from public.qc_separacao_previsao where codigo_pedido = p_codigo_pedido and codigo = v_cod;
      insert into public.qc_separacao_previsao_hist (codigo_pedido, codigo, previsao, obs, acao, por) values (p_codigo_pedido, v_cod, null, null, 'limpou', v_email);
    end if;
    return jsonb_build_object('ok', true, 'mudou', v_tem, 'por', v_email);
  end if;

  if v_tem and v_ant.previsao is not distinct from p_previsao and v_ant.obs is not distinct from v_obs then
    return jsonb_build_object('ok', true, 'mudou', false, 'por', v_email);
  end if;

  insert into public.qc_separacao_previsao (codigo_pedido, codigo, previsao, obs, atualizado_por, atualizado_em)
    values (p_codigo_pedido, v_cod, p_previsao, v_obs, v_email, now())
    on conflict (codigo_pedido, codigo) do update
      set previsao = excluded.previsao, obs = excluded.obs, atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em;
  insert into public.qc_separacao_previsao_hist (codigo_pedido, codigo, previsao, obs, acao, por)
    values (p_codigo_pedido, v_cod, p_previsao, v_obs, case when v_tem then 'alterou' else 'definiu' end, v_email);
  return jsonb_build_object('ok', true, 'mudou', true, 'por', v_email);
end $$;

revoke all on function public.qc_separacao_previsao_listar(bigint[])                    from public, anon, authenticated;
revoke all on function public.qc_separacao_previsao_gravar(bigint, text, date, text)    from public, anon, authenticated;
grant execute on function public.qc_separacao_previsao_listar(bigint[])                 to authenticated;
grant execute on function public.qc_separacao_previsao_gravar(bigint, text, date, text) to authenticated;
