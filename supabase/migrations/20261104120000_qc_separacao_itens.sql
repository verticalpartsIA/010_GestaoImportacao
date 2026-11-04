-- Quadros de Comando › Separação PV QC: marcação "Peguei" dos itens a separar de cada pedido de venda com quadro de comando.
-- Nasce FECHADA (Art. 26): anon/authenticated não leem nem gravam as tabelas; o acesso é só pelas duas funções abaixo,
-- que exigem usuário ativo + alçada do módulo 'quadros-separacao' (Administrador passa sempre).
-- O histórico (qc_separacao_hist) é imutável (Art. 27): só entra linha, ninguém atualiza nem apaga.

create table if not exists public.qc_separacao_itens (
  codigo_pedido bigint      not null,          -- pcp_pedidos.codigo_pedido (id interno do Omie)
  codigo        text        not null,          -- código do item, em MAIÚSCULAS
  peguei_por    text        not null,          -- e-mail de quem pegou
  peguei_em     timestamptz not null default now(),
  primary key (codigo_pedido, codigo)
);

create table if not exists public.qc_separacao_hist (
  id            bigint generated always as identity primary key,
  codigo_pedido bigint      not null,
  codigo        text        not null,
  acao          text        not null check (acao in ('pegou', 'devolveu')),
  por           text        not null,
  em            timestamptz not null default now()
);
create index if not exists qc_separacao_hist_pedido_idx on public.qc_separacao_hist (codigo_pedido, em desc);

alter table public.qc_separacao_itens enable row level security;
alter table public.qc_separacao_hist  enable row level security;
revoke all on public.qc_separacao_itens from public, anon, authenticated;
revoke all on public.qc_separacao_hist  from public, anon, authenticated;
grant all on public.qc_separacao_itens to service_role;
grant all on public.qc_separacao_hist  to service_role;

-- Lista o que já foi pego nos pedidos informados.
create or replace function public.qc_separacao_listar(p_pedidos bigint[])
returns table (codigo_pedido bigint, codigo text, peguei_por text, peguei_em timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.vp_usuario_ativo() then raise exception 'separação QC: sem sessão ativa'; end if;
  if not public.vp_tem_capacidade('quadros-separacao', 'ver') then raise exception 'separação QC: sem alçada "ver"'; end if;
  return query
    select s.codigo_pedido, s.codigo, s.peguei_por, s.peguei_em
      from public.qc_separacao_itens s
     where s.codigo_pedido = any (coalesce(p_pedidos, '{}'::bigint[]));
end $$;

-- Marca (p_peguei = true) ou desmarca (false) um item. Idempotente: repetir não duplica nem gera histórico à toa.
create or replace function public.qc_separacao_marcar(p_codigo_pedido bigint, p_codigo text, p_peguei boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := public.vp_email();
  v_cod   text := upper(btrim(coalesce(p_codigo, '')));
  v_n     int;
begin
  if not public.vp_usuario_ativo() or coalesce(v_email, '') = '' then raise exception 'separação QC: sem sessão ativa'; end if;
  if not public.vp_tem_capacidade('quadros-separacao', 'editar') then raise exception 'separação QC: sem alçada "editar"'; end if;
  if p_codigo_pedido is null or v_cod = '' or p_peguei is null then raise exception 'separação QC: informe pedido, item e se pegou'; end if;
  -- validação no servidor: o item precisa existir no pedido do Omie
  if not exists (select 1 from public.pcp_pedido_itens i where i.codigo_pedido = p_codigo_pedido and upper(i.codigo) = v_cod) then
    raise exception 'separação QC: o item % não pertence ao pedido %', v_cod, p_codigo_pedido;
  end if;

  if p_peguei then
    insert into public.qc_separacao_itens (codigo_pedido, codigo, peguei_por) values (p_codigo_pedido, v_cod, v_email)
      on conflict (codigo_pedido, codigo) do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      insert into public.qc_separacao_hist (codigo_pedido, codigo, acao, por) values (p_codigo_pedido, v_cod, 'pegou', v_email);
    end if;
  else
    delete from public.qc_separacao_itens where codigo_pedido = p_codigo_pedido and codigo = v_cod;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      insert into public.qc_separacao_hist (codigo_pedido, codigo, acao, por) values (p_codigo_pedido, v_cod, 'devolveu', v_email);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'peguei', p_peguei, 'mudou', v_n > 0, 'por', v_email);
end $$;

revoke all on function public.qc_separacao_listar(bigint[])              from public, anon, authenticated;
revoke all on function public.qc_separacao_marcar(bigint, text, boolean) from public, anon, authenticated;
grant execute on function public.qc_separacao_listar(bigint[])              to authenticated;
grant execute on function public.qc_separacao_marcar(bigint, text, boolean) to authenticated;
