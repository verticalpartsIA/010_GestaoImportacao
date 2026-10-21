-- Separação — fase 1 (issue #1027): tipo de cada item por CÓDIGO.
-- Cabo de aço, cabo de manobra, cabo elétrico modular e corrimão precisam de roteiros diferentes na Separação
-- (corte no Almoxarifado, envio à Produção de Quadros, liberação pelo PCP). O reconhecimento é por lista de códigos,
-- não por família do Omie: cabo de manobra e cabo modular nem estão em pcp_produtos.
-- Esta fase SÓ cadastra e mostra o tipo: nenhuma regra de pedido, de OP ou de item_pcp muda.
-- Nasce FECHADA (RLS sem política): só a função separacao_tipos lê e grava.

create table if not exists public.separacao_tipo_item (
  codigo text primary key check (codigo = upper(btrim(codigo)) and length(codigo) > 0),
  tipo text not null check (tipo in ('cabo_aco', 'cabo_manobra', 'cabo_modular', 'corrimao', 'cabo_aco_porta')),
  observacao text,
  ativo boolean not null default true,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);
alter table public.separacao_tipo_item enable row level security;
revoke all on public.separacao_tipo_item from anon, authenticated;
grant all on public.separacao_tipo_item to service_role;

-- Carga inicial (lista validada pelo Gelson em 21/10/2026)
insert into public.separacao_tipo_item (codigo, tipo, observacao, criado_por, atualizado_por)
select v.codigo, v.tipo, 'carga inicial 21/10/2026 (issue #1027)', 'sistema', 'sistema'
  from (values
    ('VPEL-046', 'cabo_aco'), ('VPEL-048', 'cabo_aco'), ('VPEL-125', 'cabo_aco'), ('VPEL-228', 'cabo_aco'),
    ('VPEL-229', 'cabo_aco'), ('VPEL-307', 'cabo_aco'), ('VPEL-484', 'cabo_aco'), ('VPEL-485', 'cabo_aco'),
    ('VPEL-692', 'cabo_aco'), ('VPEL-693', 'cabo_aco'), ('VPEL-694', 'cabo_aco'),
    ('VPEL-529N', 'cabo_manobra'), ('VPB-086', 'cabo_manobra'), ('VPEL-218N', 'cabo_manobra'),
    ('VPB-097', 'cabo_modular'), ('VPB-098', 'cabo_modular'), ('VPB-099', 'cabo_modular'), ('VPB-100', 'cabo_modular'),
    ('VPB-101', 'cabo_modular'), ('VPB-102', 'cabo_modular'), ('VPB-105', 'cabo_modular'), ('VPB-106', 'cabo_modular'),
    ('VP-1477', 'corrimao'), ('VP-1699', 'corrimao'), ('VP-1879', 'corrimao'), ('VP-1379', 'corrimao'),
    ('VPP-1477', 'corrimao'), ('VPP-1699', 'corrimao'), ('VPP-1879', 'corrimao'),
    ('VPEL-519N', 'cabo_aco_porta'), ('VPEL-520N', 'cabo_aco_porta')
  ) as v(codigo, tipo)
on conflict (codigo) do nothing;

create or replace function public.separacao_tipos(p_acao text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := public.vp_email();
  v_cod text; v_tipo text; v_obs text; v_out jsonb;
begin
  if not public.vp_usuario_ativo() or coalesce(v_email, '') = '' then raise exception 'separação: sem sessão ativa'; end if;
  p_args := coalesce(p_args, '{}'::jsonb);
  v_cod := upper(btrim(coalesce(p_args->>'codigo', '')));

  if p_acao = 'listar' then
    if not public.vp_tem_capacidade('separacao', 'ver') then raise exception 'separação: sem alçada "ver"'; end if;
    select jsonb_build_object(
      'tipos', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'codigo', t.codigo, 'tipo', t.tipo, 'observacao', t.observacao, 'ativo', t.ativo,
                 'atualizado_por', t.atualizado_por, 'atualizado_em', t.atualizado_em,
                 'descricao', coalesce(d.descricao, v.descricao, p.descricao),
                 'item_pcp', coalesce(d.item_pcp, false))
               order by t.tipo, t.codigo)
          from public.separacao_tipo_item t
          left join lateral (select i.descricao, i.item_pcp from public.pcp_pedido_itens i
                              where upper(i.codigo) = t.codigo order by i.id desc limit 1) d on true
          left join public.importacao_varejo_produtos v on upper(v.codigo) = t.codigo
          left join public.pcp_produtos p on upper(p.codigo) = t.codigo), '[]'::jsonb),
      -- candidatos: itens de pedido que citam cabo/corrimão e ainda não estão na lista (a tela filtra peças como polia/rolete)
      'itens', coalesce((
        select jsonb_agg(jsonb_build_object('codigo', x.codigo, 'descricao', x.descricao, 'linhas', x.linhas) order by x.linhas desc, x.codigo)
          from (select upper(i.codigo) codigo, max(i.descricao) descricao, count(*) linhas
                  from public.pcp_pedido_itens i
                 where i.descricao ~* '(cabo|corrim)'
                   and not exists (select 1 from public.separacao_tipo_item t where t.codigo = upper(i.codigo) and t.ativo)
                 group by upper(i.codigo)
                 order by count(*) desc, upper(i.codigo) limit 300) x), '[]'::jsonb))
      into v_out;
    return v_out;
  end if;

  if p_acao in ('salvar', 'remover') then
    if not public.vp_tem_capacidade('separacao', 'editar') then raise exception 'separação: sem alçada "editar"'; end if;
    if v_cod = '' then raise exception 'separação: informe o código'; end if;
    if length(v_cod) > 40 then raise exception 'separação: código longo demais'; end if;
    if p_acao = 'salvar' then
      v_tipo := coalesce(p_args->>'tipo', ''); v_obs := nullif(btrim(coalesce(p_args->>'observacao', '')), '');
      if v_tipo not in ('cabo_aco', 'cabo_manobra', 'cabo_modular', 'corrimao', 'cabo_aco_porta') then raise exception 'separação: tipo inválido'; end if;
      insert into public.separacao_tipo_item (codigo, tipo, observacao, ativo, criado_por, atualizado_por)
      values (v_cod, v_tipo, left(v_obs, 300), true, v_email, v_email)
      on conflict (codigo) do update
        set tipo = excluded.tipo, observacao = excluded.observacao, ativo = true, atualizado_por = v_email, atualizado_em = now();
    else
      update public.separacao_tipo_item set ativo = false, atualizado_por = v_email, atualizado_em = now() where codigo = v_cod;
      if not found then raise exception 'separação: o código % não está na lista', v_cod; end if;
    end if;
    return jsonb_build_object('ok', true);
  end if;

  raise exception 'separação: ação desconhecida: %', p_acao;
end $$;

revoke execute on function public.separacao_tipos(text, jsonb) from public, anon, authenticated;
grant execute on function public.separacao_tipos(text, jsonb) to authenticated;
