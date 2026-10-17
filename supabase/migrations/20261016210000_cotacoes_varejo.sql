-- Cotações de Varejo (16/10/2026, pedido do usuário) — "Suprimentos & Importação › Cotações de Varejo".
-- O comprador marca produtos na Importação Varejo e clica em "Pedir cotação": nasce um LOTE (rascunho) com os itens.
-- Cada fornecedor convidado recebe um link próprio (portal público) com a mesma lista de itens e responde com preço por
-- faixa de quantidade, prazo e MOQ; pode haver 2ª rodada (preço atualizado). A página mostra o mapa comparativo
-- (produto × fornecedor); o comprador escolhe vencedor(es) e quantidade por item (divisão permitida) e só ao APROVAR a
-- Requisição de Compra vai ao Omie (uma por fornecedor vencedor). Nada vai ao Omie antes do "martelo".
--
-- Segurança (#571): tabelas nascem FECHADAS para a chave pública (só `authenticated` + usuário ativo). O fornecedor fala
-- por RPC SECURITY DEFINER com o TOKEN do convite (só toca aquele convite; nunca vê outro fornecedor).

create sequence if not exists public.iv_cotacao_lote_seq;

grant usage on sequence public.iv_cotacao_lote_seq to authenticated;

create table if not exists public.iv_cotacao_lotes (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default ('COTV-' || lpad(nextval('public.iv_cotacao_lote_seq')::text, 4, '0')),
  titulo text,
  observacao text,
  status text not null default 'rascunho' check (status in ('rascunho','em_cotacao','aprovado','cancelado')),
  cambio_usd_brl numeric,
  criado_por text,
  criado_por_nome text,
  aprovado_por text,
  aprovado_em timestamptz,
  requisicoes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.iv_cotacao_itens (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.iv_cotacao_lotes(id) on delete cascade,
  codigo text not null,
  descricao text,
  unidade text,
  quantidade_pedida numeric not null default 0,
  obs_vp text,
  foto_url text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  unique (lote_id, codigo)
);
create index if not exists iv_cotacao_itens_lote_idx on public.iv_cotacao_itens (lote_id, ordem);
create index if not exists iv_cotacao_itens_codigo_idx on public.iv_cotacao_itens (codigo);

create table if not exists public.iv_cotacao_convites (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.iv_cotacao_lotes(id) on delete cascade,
  fornecedor_id uuid,
  fornecedor_nome text not null,
  email text,
  token text not null unique,
  idioma text not null default 'bilingue',
  moeda text not null default 'USD',
  status text not null default 'rascunho' check (status in ('rascunho','enviado','visualizado','respondido')),
  rodada int not null default 1,
  envios jsonb not null default '[]'::jsonb,
  enviado_em timestamptz,
  visualizado_em timestamptz,
  respondido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lote_id, fornecedor_id)
);

-- Resposta do fornecedor a UM item. `faixas` = [{min, preco}] (preço por faixa de quantidade; 1ª faixa min 1).
-- `rodada` = em que rodada de negociação este valor foi dado; ao receber valor de rodada maior, o anterior vai para `historico`.
create table if not exists public.iv_cotacao_respostas (
  id uuid primary key default gen_random_uuid(),
  convite_id uuid not null references public.iv_cotacao_convites(id) on delete cascade,
  item_id uuid not null references public.iv_cotacao_itens(id) on delete cascade,
  faixas jsonb not null default '[]'::jsonb,
  lead_time_dias int,
  moq numeric,
  obs text,
  foto_fornecedor text,
  rodada int not null default 1,
  historico jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (convite_id, item_id)
);

-- Decisão do comprador: quanto comprar de cada fornecedor em cada item (um item pode ter mais de um vencedor).
create table if not exists public.iv_cotacao_decisoes (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.iv_cotacao_lotes(id) on delete cascade,
  item_id uuid not null references public.iv_cotacao_itens(id) on delete cascade,
  convite_id uuid not null references public.iv_cotacao_convites(id) on delete cascade,
  quantidade numeric not null check (quantidade > 0),
  created_at timestamptz not null default now(),
  unique (item_id, convite_id)
);

-- Banco de fotos de produto (nome = código). Arquivo no bucket público `engenharia`, pasta produtos-fotos/.
create table if not exists public.produto_fotos (
  codigo text primary key,
  url text not null,
  path text,
  origem text not null default 'upload' check (origem in ('upload','ficha_tecnica','omie')),
  updated_by text,
  updated_at timestamptz not null default now()
);

-- RLS: só usuário autenticado e ativo (o fornecedor usa as RPCs abaixo).
do $$
declare t text;
begin
  foreach t in array array['iv_cotacao_lotes','iv_cotacao_itens','iv_cotacao_convites','iv_cotacao_respostas','iv_cotacao_decisoes','produto_fotos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists vp_int_sel on public.%I', t);
    execute format('drop policy if exists vp_int_ins on public.%I', t);
    execute format('drop policy if exists vp_int_upd on public.%I', t);
    execute format('drop policy if exists vp_int_del on public.%I', t);
    execute format('create policy vp_int_sel on public.%I for select to authenticated using ((select public.vp_usuario_ativo()))', t);
    execute format('create policy vp_int_ins on public.%I for insert to authenticated with check ((select public.vp_usuario_ativo()))', t);
    execute format('create policy vp_int_upd on public.%I for update to authenticated using ((select public.vp_usuario_ativo())) with check ((select public.vp_usuario_ativo()))', t);
    execute format('create policy vp_int_del on public.%I for delete to authenticated using ((select public.vp_usuario_ativo()))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ---------- Portal público do fornecedor ----------
-- Devolve SÓ o convite do token (nunca outros fornecedores, e-mail ou decisões).
create or replace function public.public_ivc_obter(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c iv_cotacao_convites%rowtype; l iv_cotacao_lotes%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return null; end if;
  select * into c from iv_cotacao_convites where token = p_token;
  if not found or c.status = 'rascunho' then return null; end if;
  select * into l from iv_cotacao_lotes where id = c.lote_id;
  if not found or l.status = 'rascunho' then return null; end if;
  return jsonb_build_object(
    'convite', jsonb_build_object('id', c.id, 'fornecedor_nome', c.fornecedor_nome, 'idioma', c.idioma, 'moeda', c.moeda,
                                  'status', c.status, 'rodada', c.rodada, 'respondido_em', c.respondido_em),
    'lote', jsonb_build_object('numero', l.numero, 'status', l.status, 'encerrado', l.status <> 'em_cotacao'),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'codigo', i.codigo, 'descricao', i.descricao, 'unidade', i.unidade,
                         'quantidade', i.quantidade_pedida, 'obs_vp', i.obs_vp, 'foto_url', i.foto_url) order by i.ordem, i.codigo)
                         from iv_cotacao_itens i where i.lote_id = l.id), '[]'::jsonb),
    'respostas', coalesce((select jsonb_agg(jsonb_build_object('item_id', r.item_id, 'faixas', r.faixas, 'lead_time_dias', r.lead_time_dias,
                         'moq', r.moq, 'obs', r.obs, 'foto_fornecedor', r.foto_fornecedor, 'rodada', r.rodada))
                         from iv_cotacao_respostas r where r.convite_id = c.id), '[]'::jsonb));
end $$;

create or replace function public.public_ivc_visualizado(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c iv_cotacao_convites%rowtype;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false); end if;
  select * into c from iv_cotacao_convites where token = p_token for update;
  if not found or c.status <> 'enviado' then return jsonb_build_object('ok', found); end if;
  update iv_cotacao_convites set status = 'visualizado', visualizado_em = now(), updated_at = now() where id = c.id;
  return jsonb_build_object('ok', true);
end $$;

-- Resposta: p_respostas = [{item_id, faixas:[{min,preco}], lead_time_dias, moq, obs, foto_fornecedor}].
-- Valida tudo no servidor: item precisa ser do lote, preço > 0, no máx. 6 faixas, texto cortado.
create or replace function public.public_ivc_responder(p_token text, p_respostas jsonb, p_moeda text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c iv_cotacao_convites%rowtype; l iv_cotacao_lotes%rowtype; it jsonb; fx jsonb; f jsonb; item iv_cotacao_itens%rowtype;
        ex iv_cotacao_respostas%rowtype; n int := 0; lt int; mq numeric;
begin
  if coalesce(length(p_token), 0) < 8 then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into c from iv_cotacao_convites where token = p_token for update;
  if not found or c.status = 'rascunho' then return jsonb_build_object('ok', false, 'erro', 'link_invalido'); end if;
  select * into l from iv_cotacao_lotes where id = c.lote_id;
  if not found or l.status <> 'em_cotacao' then return jsonb_build_object('ok', false, 'erro', 'cotacao_encerrada'); end if;
  if jsonb_typeof(p_respostas) <> 'array' then return jsonb_build_object('ok', false, 'erro', 'formato'); end if;
  for it in select value from jsonb_array_elements(p_respostas) limit 1000 loop
    if jsonb_typeof(it) <> 'object' then continue; end if;
    select * into item from iv_cotacao_itens where id::text = (it->>'item_id') and lote_id = c.lote_id;
    if not found then continue; end if;
    -- faixas válidas: [{min>=1, preco>0}], ordenadas por min
    select coalesce(jsonb_agg(jsonb_build_object('min', m, 'preco', p) order by m), '[]'::jsonb) into fx
      from (select greatest(1, coalesce((x->>'min')::numeric, 1)) as m, (x->>'preco')::numeric as p
              from jsonb_array_elements(case when jsonb_typeof(it->'faixas') = 'array' then it->'faixas' else '[]'::jsonb end) x
             where (x->>'preco') ~ '^[0-9]+(\.[0-9]+)?$' and (x->>'preco')::numeric > 0 limit 6) q;
    lt := case when (it->>'lead_time_dias') ~ '^[0-9]{1,4}$' then (it->>'lead_time_dias')::int else null end;
    mq := case when (it->>'moq') ~ '^[0-9]+(\.[0-9]+)?$' then (it->>'moq')::numeric else null end;
    if jsonb_array_length(fx) = 0 and lt is null and mq is null and coalesce(it->>'obs','') = '' then continue; end if;
    select * into ex from iv_cotacao_respostas where convite_id = c.id and item_id = item.id;
    if found then
      update iv_cotacao_respostas set
        historico = case when c.rodada > ex.rodada and jsonb_array_length(ex.faixas) > 0
                         then ex.historico || jsonb_build_array(jsonb_build_object('rodada', ex.rodada, 'faixas', ex.faixas,
                              'lead_time_dias', ex.lead_time_dias, 'moq', ex.moq, 'em', ex.updated_at))
                         else ex.historico end,
        faixas = fx, lead_time_dias = lt, moq = mq, obs = left(it->>'obs', 2000),
        foto_fornecedor = left(coalesce(it->>'foto_fornecedor', ex.foto_fornecedor), 500),
        rodada = c.rodada, updated_at = now()
       where id = ex.id;
    else
      insert into iv_cotacao_respostas (convite_id, item_id, faixas, lead_time_dias, moq, obs, foto_fornecedor, rodada)
      values (c.id, item.id, fx, lt, mq, left(it->>'obs', 2000), left(it->>'foto_fornecedor', 500), c.rodada);
    end if;
    n := n + 1;
  end loop;
  update iv_cotacao_convites set status = 'respondido', respondido_em = now(), updated_at = now(),
         moeda = case when upper(coalesce(p_moeda, '')) in ('USD','EUR','BRL','RMB','CNY') then upper(p_moeda) else moeda end
   where id = c.id;
  return jsonb_build_object('ok', true, 'itens', n);
end $$;

revoke execute on function public.public_ivc_obter(text), public.public_ivc_visualizado(text), public.public_ivc_responder(text, jsonb, text) from public;
grant execute on function public.public_ivc_obter(text), public.public_ivc_visualizado(text), public.public_ivc_responder(text, jsonb, text) to anon, authenticated;
