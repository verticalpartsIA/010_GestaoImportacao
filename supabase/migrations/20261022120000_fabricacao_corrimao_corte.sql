-- Fabricação Corrimão + Fabricação Corte (22/10/2026).
-- Tabelas FECHADAS (só usuário ativo); o chão de fábrica fala só por RPC com token.

alter table public.pcp_ordens add column if not exists item_codigo text;
alter table public.pcp_ordens add column if not exists unidade_seq int;
create unique index if not exists uq_pcp_ordens_item_unidade
  on public.pcp_ordens (pedido_codigo, item_codigo, unidade_seq)
  where item_codigo is not null and status <> 'cancelada';

create table if not exists public.fab_etapas (
  id uuid primary key default gen_random_uuid(),
  destino text not null check (destino in ('corrimao', 'corte')),
  ordem int not null,
  texto text not null,
  peso numeric not null,
  unique (destino, ordem)
);
insert into public.fab_etapas (destino, ordem, texto, peso) values
  ('corrimao', 1, 'Mede', 17), ('corrimao', 2, 'Corta', 17), ('corrimao', 3, 'Prepara as pontas', 17),
  ('corrimao', 4, 'Aplica as camadas', 17), ('corrimao', 5, 'Vulcaniza', 16), ('corrimao', 6, 'Acabamento', 16),
  ('corte', 1, 'Separar material', 30), ('corte', 2, 'Corte', 40), ('corte', 3, 'Qualidade', 30)
on conflict (destino, ordem) do nothing;

create table if not exists public.fab_links (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null unique references public.pcp_ordens(id) on delete cascade,
  destino text not null check (destino in ('corrimao', 'corte')),
  token text not null unique,
  criado_por text,
  criado_em timestamptz not null default now()
);
create table if not exists public.fab_status (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id) on delete cascade,
  etapa_id uuid not null references public.fab_etapas(id),
  flegado boolean not null default false,
  flegado_em timestamptz,
  flegado_por text,
  unique (ordem_id, etapa_id)
);
create table if not exists public.fab_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id) on delete cascade,
  codigo_produto text not null,
  descricao_produto text,
  tem_frente_trabalho boolean not null,
  status text not null default 'aberta' check (status in ('aberta', 'resolvida')),
  aberta_em timestamptz not null default now(),
  resolvida_em timestamptz
);
create table if not exists public.fab_sobras (
  ordem_id uuid primary key references public.pcp_ordens(id) on delete cascade,
  quantidade numeric not null check (quantidade >= 0),
  obs text,
  por text,
  em timestamptz not null default now()
);
create index if not exists idx_fab_status_ordem on public.fab_status (ordem_id);
create index if not exists idx_fab_ocorr_ordem on public.fab_ocorrencias (ordem_id);

do $$ declare t text; begin
  foreach t in array array['fab_etapas','fab_links','fab_status','fab_ocorrencias','fab_sobras'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.vp_usuario_ativo()) with check (public.vp_usuario_ativo())', 'fab_interno_' || t, t);
  end loop;
end $$;

-- ---------- chão de fábrica (token) ----------
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
             'cliente', v_o.cliente, 'prazo_entrega', v_o.prazo_entrega, 'status', v_o.status, 'pedido_codigo', v_o.pedido_codigo, 'item_codigo', v_o.item_codigo),
    'etapas', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'ordem', e.ordem, 'texto', e.texto, 'peso', e.peso,
                'flegado', coalesce(s.flegado, false), 'flegado_em', s.flegado_em, 'flegado_por', s.flegado_por) order by e.ordem)
              from public.fab_etapas e left join public.fab_status s on s.etapa_id = e.id and s.ordem_id = v_l.ordem_id
              where e.destino = v_l.destino), '[]'::jsonb),
    'ocorrencias', coalesce((select jsonb_agg(to_jsonb(o) order by o.aberta_em desc) from public.fab_ocorrencias o where o.ordem_id = v_l.ordem_id), '[]'::jsonb),
    'sobra', (select to_jsonb(b) from public.fab_sobras b where b.ordem_id = v_l.ordem_id));
end $$;

-- Marca uma etapa (flegado=true). Desmarcar só usuário interno. Atualiza o status da OP.
create or replace function public.public_fab_flegar(p_token text, p_etapa uuid, p_flegado boolean, p_por text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_l public.fab_links%rowtype; v_total int; v_feitas int; v_por text; v_ord int;
begin
  select * into v_l from public.fab_links where token = p_token;
  if not found then raise exception 'fabricação: link inválido'; end if;
  if not exists (select 1 from public.fab_etapas where id = p_etapa and destino = v_l.destino) then raise exception 'fabricação: etapa inválida'; end if;
  if not p_flegado and not public.vp_usuario_ativo() then raise exception 'fabricação: só o sistema interno desmarca etapa'; end if;
  if p_flegado and exists (select 1 from public.fab_ocorrencias where ordem_id = v_l.ordem_id and status = 'aberta' and not tem_frente_trabalho) then
    raise exception 'fabricação: OP pausada por falta de material';
  end if;
  v_por := coalesce(nullif(btrim(p_por), ''), public.vp_email(), 'chão de fábrica');
  insert into public.fab_status (ordem_id, etapa_id, flegado, flegado_em, flegado_por)
  values (v_l.ordem_id, p_etapa, p_flegado, case when p_flegado then now() end, case when p_flegado then v_por end)
  on conflict (ordem_id, etapa_id) do update set flegado = excluded.flegado, flegado_em = excluded.flegado_em, flegado_por = excluded.flegado_por;
  select count(*) into v_total from public.fab_etapas where destino = v_l.destino;
  select count(*) into v_feitas from public.fab_status s join public.fab_etapas e on e.id = s.etapa_id where s.ordem_id = v_l.ordem_id and s.flegado and e.destino = v_l.destino;
  update public.pcp_ordens set
    status = case when v_feitas >= v_total then 'concluida' when v_feitas > 0 then 'em_producao' else 'aguardando' end,
    data_finalizacao = case when v_feitas >= v_total then current_date else null end,
    qtd_produzida = case when v_feitas >= v_total then quantidade else qtd_produzida end,
    updated_at = now()
  where id = v_l.ordem_id and status <> 'cancelada';
  return jsonb_build_object('ok', true, 'feitas', v_feitas, 'total', v_total);
end $$;

create or replace function public.public_fab_ocorrencia(p_token text, p_acao text, p_codigo text default null, p_descricao text default null, p_tem_frente boolean default false, p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_l public.fab_links%rowtype; v_n int;
begin
  select * into v_l from public.fab_links where token = p_token;
  if not found then raise exception 'fabricação: link inválido'; end if;
  if p_acao = 'abrir' then
    if btrim(coalesce(p_codigo, '')) = '' then raise exception 'fabricação: informe o material em falta'; end if;
    insert into public.fab_ocorrencias (ordem_id, codigo_produto, descricao_produto, tem_frente_trabalho)
    values (v_l.ordem_id, upper(btrim(p_codigo)), nullif(btrim(coalesce(p_descricao, '')), ''), coalesce(p_tem_frente, false));
    return jsonb_build_object('ok', true);
  elsif p_acao = 'resolver' then
    update public.fab_ocorrencias set status = 'resolvida', resolvida_em = now() where id = p_id and ordem_id = v_l.ordem_id and status = 'aberta';
    get diagnostics v_n = row_count;
    return jsonb_build_object('ok', true, 'resolvidas', v_n);
  end if;
  raise exception 'fabricação: ação desconhecida';
end $$;

create or replace function public.public_fab_sobra(p_token text, p_quantidade numeric, p_obs text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_l public.fab_links%rowtype;
begin
  select * into v_l from public.fab_links where token = p_token;
  if not found or v_l.destino <> 'corte' then raise exception 'fabricação: link inválido para sobra'; end if;
  if p_quantidade is null or p_quantidade < 0 then raise exception 'fabricação: quantidade inválida'; end if;
  insert into public.fab_sobras (ordem_id, quantidade, obs, por) values (v_l.ordem_id, p_quantidade, nullif(btrim(coalesce(p_obs, '')), ''), coalesce(public.vp_email(), 'chão de fábrica'))
  on conflict (ordem_id) do update set quantidade = excluded.quantidade, obs = excluded.obs, por = excluded.por, em = now();
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.public_fab_obter(text), public.public_fab_flegar(text, uuid, boolean, text),
  public.public_fab_ocorrencia(text, text, text, text, boolean, uuid), public.public_fab_sobra(text, numeric, text) to anon, authenticated;

-- ---------- envio da Separação ----------
create or replace function public.separacao_enviar_fabricacao(p_codigo_pedido bigint, p_codigo text, p_destino text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := public.vp_email(); v_cod text := upper(btrim(coalesce(p_codigo, '')));
  v_ped public.pcp_pedidos%rowtype; v_it record; v_qtd numeric; v_un int; v_i int; v_ops jsonb := '[]'::jsonb;
  v_op public.pcp_ordens%rowtype; v_tok text; v_exist text; v_titulo text;
begin
  if not public.vp_usuario_ativo() or coalesce(v_email, '') = '' then raise exception 'fabricação: sem sessão ativa'; end if;
  if p_destino not in ('corrimao', 'corte') then raise exception 'fabricação: destino inválido'; end if;
  if not public.vp_tem_capacidade('separacao', 'enviar_fabricacao') then
    raise exception 'fabricação: sem a alçada "Separação › Enviar para fabricação"';
  end if;
  select * into v_ped from public.pcp_pedidos where codigo_pedido = p_codigo_pedido;
  if not found then raise exception 'fabricação: pedido não encontrado'; end if;
  select upper(codigo) codigo, max(descricao) descricao, max(unidade) unidade, sum(quantidade) quantidade into v_it
    from public.pcp_pedido_itens where codigo_pedido = p_codigo_pedido and upper(codigo) = v_cod group by upper(codigo);
  if not found then raise exception 'fabricação: o item % não faz parte do pedido', v_cod; end if;
  if not exists (select 1 from public.estoque_separacao_pendencias where codigo_pedido = p_codigo_pedido and codigo = v_cod and resolvido_em is null and situacao = 'na_operacao') then
    raise exception 'fabricação: marque primeiro o item como "Na operação" na separação';
  end if;
  select string_agg(numero, ', ' order by numero) into v_exist from public.pcp_ordens
   where pedido_codigo = p_codigo_pedido and item_codigo = v_cod and status <> 'cancelada';
  if v_exist is not null then raise exception 'fabricação: este item já foi enviado — %', v_exist; end if;

  v_qtd := v_it.quantidade;
  if upper(coalesce(v_it.unidade, '')) in ('UN', 'PC', 'PR', 'PAR', 'KIT') then v_un := greatest(1, ceil(v_qtd)::int); else v_un := 1; end if;
  for v_i in 1..v_un loop
    v_titulo := coalesce(v_it.descricao, v_cod) || case when v_un > 1 then format(' — unidade %s/%s', v_i, v_un) else '' end;
    insert into public.pcp_ordens (titulo, frente, pedido_codigo, item_codigo, unidade_seq, quantidade, cliente, prazo_entrega, criado_por, observacao)
    values (v_titulo, p_destino, p_codigo_pedido, v_cod, v_i, case when v_un > 1 then 1 else v_qtd end, v_ped.cliente_nome, v_ped.data_previsao, v_email,
            format('Enviada da Separação (pedido %s, item %s)', v_ped.numero_pedido, v_cod))
    returning * into v_op;
    v_tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    insert into public.fab_links (ordem_id, destino, token, criado_por) values (v_op.id, p_destino, v_tok, v_email);
    v_ops := v_ops || jsonb_build_object('id', v_op.id, 'numero', v_op.numero, 'token', v_tok);
  end loop;
  return jsonb_build_object('ok', true, 'ops', v_ops);
end $$;
revoke all on function public.separacao_enviar_fabricacao(bigint, text, text) from public, anon;
grant execute on function public.separacao_enviar_fabricacao(bigint, text, text) to authenticated;
