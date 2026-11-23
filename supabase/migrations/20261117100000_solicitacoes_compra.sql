-- Solicitações de compra do vendedor (17/11/2026, pedido do Gelson) — Suprimentos & Importação.
-- Vendedor escolhe produtos em /logistica/compras e ENVIA uma solicitação (não cria lote de cotação). Ela aparece em
-- /logistica/pedidos-acompanhamento › Solicitações; o comprador vê de quem veio e ALOCA os itens numa cotação (lote COTV
-- em rascunho, novo ou existente). Cada item guarda o vínculo com o lote e o vendedor de origem. Nada vai ao Omie.
--
-- Segurança (Art. 26): tabelas nascem FECHADAS. Ninguém grava direto: só as funções abaixo (SECURITY DEFINER, conferem
-- alçada). Leitura: o próprio solicitante ou quem trata solicitações. Alçadas (módulo `compras`):
--   solicitar            → vendedor (também vale `compras.criar`, que já é do comprador)
--   tratar_solicitacoes  → comprador (também vale `cotacoes-varejo.criar`); Administrador passa sempre (vp_tem_capacidade).
-- A concessão das alçadas é feita em Administração › Alçadas (esta migration NÃO concede nada).
-- Rollback: drop function iv_solicitacao_* ; alter table iv_cotacao_itens drop column solicitacao_item_id;
--           drop table iv_solicitacao_hist, iv_solicitacao_itens, iv_solicitacoes; drop sequence iv_solicitacao_seq;

create sequence if not exists public.iv_solicitacao_seq;

create table if not exists public.iv_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default ('SOL-' || lpad(nextval('public.iv_solicitacao_seq')::text, 4, '0')),
  solicitante_email text not null,
  solicitante_nome text,
  vendedor_nome text,
  pedido_venda_numero text,
  cotacao_numero text,
  justificativa text,
  urgencia text not null default 'normal' check (urgencia in ('baixa','normal','alta','urgente')),
  data_desejada date,
  status text not null default 'enviada' check (status in ('enviada','em_analise','alocada','devolvida','cancelada')),
  devolucao_motivo text,
  devolvida_por text,
  devolvida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.iv_solicitacao_itens (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.iv_solicitacoes(id) on delete cascade,
  codigo text not null,
  descricao text,
  unidade text,
  quantidade numeric not null check (quantidade > 0),
  obs text,
  foto_url text,
  ordem int not null default 0,
  lote_id uuid references public.iv_cotacao_lotes(id),
  lote_item_id uuid references public.iv_cotacao_itens(id),
  alocado_por text,
  alocado_em timestamptz,
  removido_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists iv_solicitacao_itens_sol_idx on public.iv_solicitacao_itens (solicitacao_id);
create index if not exists iv_solicitacao_itens_lote_idx on public.iv_solicitacao_itens (lote_id) where lote_id is not null;

create table if not exists public.iv_solicitacao_hist (
  id bigserial primary key,
  solicitacao_id uuid not null references public.iv_solicitacoes(id) on delete cascade,
  item_id uuid,
  acao text not null,
  por text,
  detalhe jsonb,
  em timestamptz not null default now()
);

-- origem do item dentro do lote (selo "Pedido de <vendedor>" no mapa da cotação)
alter table public.iv_cotacao_itens add column if not exists solicitacao_item_id uuid references public.iv_solicitacao_itens(id);

-- ---------- Quem pode ----------
create or replace function public.iv_solicitacao_pode_solicitar() returns boolean language sql stable security definer set search_path = public as
$$ select (select public.vp_usuario_ativo()) and (public.vp_tem_capacidade('compras','solicitar') or public.vp_tem_capacidade('compras','criar')) $$;

create or replace function public.iv_solicitacao_pode_tratar() returns boolean language sql stable security definer set search_path = public as
$$ select (select public.vp_usuario_ativo()) and (public.vp_tem_capacidade('compras','tratar_solicitacoes') or public.vp_tem_capacidade('cotacoes-varejo','criar')) $$;

-- ---------- RLS: só leitura, fechada ----------
alter table public.iv_solicitacoes enable row level security;
alter table public.iv_solicitacao_itens enable row level security;
alter table public.iv_solicitacao_hist enable row level security;

drop policy if exists vp_sol_sel on public.iv_solicitacoes;
create policy vp_sol_sel on public.iv_solicitacoes for select to authenticated
  using ((select public.vp_usuario_ativo()) and (lower(solicitante_email) = (select public.vp_email()) or public.iv_solicitacao_pode_tratar()));

drop policy if exists vp_sol_it_sel on public.iv_solicitacao_itens;
create policy vp_sol_it_sel on public.iv_solicitacao_itens for select to authenticated
  using (exists (select 1 from public.iv_solicitacoes s where s.id = solicitacao_id));

drop policy if exists vp_sol_hist_sel on public.iv_solicitacao_hist;
create policy vp_sol_hist_sel on public.iv_solicitacao_hist for select to authenticated
  using (exists (select 1 from public.iv_solicitacoes s where s.id = solicitacao_id));

revoke all on public.iv_solicitacoes, public.iv_solicitacao_itens, public.iv_solicitacao_hist from anon, authenticated, public;
grant select on public.iv_solicitacoes, public.iv_solicitacao_itens, public.iv_solicitacao_hist to authenticated;
grant usage on sequence public.iv_solicitacao_seq to authenticated;

-- ---------- Funções de escrita ----------
-- Valida e normaliza os itens recebidos: [{codigo, descricao, unidade, quantidade, obs, foto_url}] (quantidade > 0, código único).
create or replace function public._iv_sol_itens_validos(p_itens jsonb) returns jsonb language plpgsql immutable as $$
declare r jsonb; cod text; vistos text[] := '{}'; saida jsonb := '[]'::jsonb;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'sem_itens: informe ao menos um produto';
  end if;
  if jsonb_array_length(p_itens) > 200 then raise exception 'itens_demais: máximo 200 produtos por solicitação'; end if;
  for r in select * from jsonb_array_elements(p_itens) loop
    cod := upper(trim(coalesce(r->>'codigo','')));
    if cod = '' then raise exception 'codigo_vazio'; end if;
    if cod = any (vistos) then continue; end if;
    vistos := vistos || cod;
    if coalesce((r->>'quantidade')::numeric, 0) <= 0 then raise exception 'quantidade_invalida: % precisa de quantidade maior que zero', cod; end if;
    saida := saida || jsonb_build_array(jsonb_build_object(
      'codigo', cod, 'descricao', left(r->>'descricao', 300), 'unidade', left(r->>'unidade', 20),
      'quantidade', (r->>'quantidade')::numeric, 'obs', left(r->>'obs', 500), 'foto_url', left(r->>'foto_url', 500)));
  end loop;
  return saida;
end $$;

create or replace function public.iv_solicitacao_enviar(p_itens jsonb, p_dados jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_num text; v_email text := (select public.vp_email()); v_nome text; v_itens jsonb; v_urg text; i jsonb; n int := 0;
begin
  if not public.iv_solicitacao_pode_solicitar() then raise exception 'sem_alcada: você não tem a alçada para solicitar compras'; end if;
  v_itens := public._iv_sol_itens_validos(p_itens);
  v_urg := coalesce(nullif(p_dados->>'urgencia',''), 'normal');
  if v_urg not in ('baixa','normal','alta','urgente') then raise exception 'urgencia_invalida'; end if;
  select coalesce(nullif(p.nome,''), v_email) into v_nome from public.perfis p where lower(p.email) = v_email limit 1;
  insert into public.iv_solicitacoes (solicitante_email, solicitante_nome, vendedor_nome, pedido_venda_numero, cotacao_numero, justificativa, urgencia, data_desejada)
  values (v_email, coalesce(v_nome, v_email), coalesce(nullif(p_dados->>'vendedor_nome',''), v_nome, v_email),
          nullif(left(p_dados->>'pedido_venda_numero', 40), ''), nullif(left(p_dados->>'cotacao_numero', 40), ''),
          nullif(left(p_dados->>'justificativa', 1000), ''), v_urg, nullif(p_dados->>'data_desejada','')::date)
  returning id, numero into v_id, v_num;
  for i in select * from jsonb_array_elements(v_itens) loop
    insert into public.iv_solicitacao_itens (solicitacao_id, codigo, descricao, unidade, quantidade, obs, foto_url, ordem)
    values (v_id, i->>'codigo', i->>'descricao', i->>'unidade', (i->>'quantidade')::numeric, i->>'obs', i->>'foto_url', n);
    n := n + 1;
  end loop;
  insert into public.iv_solicitacao_hist (solicitacao_id, acao, por, detalhe) values (v_id, 'enviou', v_email, jsonb_build_object('itens', n));
  -- aviso ao comprador (Central de Notificações; falha nunca impede a solicitação)
  begin
    insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
    values ('sol-' || v_id, 'info', 'Nova solicitação de compra ' || v_num || ' — ' || coalesce(v_nome, v_email),
            n || ' produto(s) aguardando o comprador. Abra Pedidos › Solicitações para alocar numa cotação.', 'Compras', false, null, '/logistica/pedidos-acompanhamento')
    on conflict (id) do nothing;
  exception when others then raise warning 'iv_solicitacao_enviar: aviso falhou: %', sqlerrm; end;
  return jsonb_build_object('id', v_id, 'numero', v_num, 'itens', n);
end $$;

-- Solicitante edita enquanto nada foi alocado (status enviada/devolvida); devolvida volta para enviada.
create or replace function public.iv_solicitacao_editar(p_id uuid, p_itens jsonb, p_dados jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.iv_solicitacoes; v_email text := (select public.vp_email()); v_itens jsonb; i jsonb; n int := 0;
begin
  select * into s from public.iv_solicitacoes where id = p_id for update;
  if not found then raise exception 'nao_encontrada'; end if;
  if lower(s.solicitante_email) <> v_email and not public.iv_solicitacao_pode_tratar() then raise exception 'sem_alcada: só quem solicitou edita'; end if;
  if s.status not in ('enviada','devolvida') then raise exception 'status_invalido: solicitação % já está %', s.numero, s.status; end if;
  if exists (select 1 from public.iv_solicitacao_itens where solicitacao_id = p_id and removido_em is null and lote_id is not null) then
    raise exception 'ja_alocada: há item já alocado em cotação'; end if;
  v_itens := public._iv_sol_itens_validos(p_itens);
  update public.iv_solicitacao_itens set removido_em = now() where solicitacao_id = p_id and removido_em is null;
  for i in select * from jsonb_array_elements(v_itens) loop
    insert into public.iv_solicitacao_itens (solicitacao_id, codigo, descricao, unidade, quantidade, obs, foto_url, ordem)
    values (p_id, i->>'codigo', i->>'descricao', i->>'unidade', (i->>'quantidade')::numeric, i->>'obs', i->>'foto_url', n);
    n := n + 1;
  end loop;
  update public.iv_solicitacoes set
    justificativa = coalesce(nullif(left(p_dados->>'justificativa', 1000), ''), justificativa),
    pedido_venda_numero = case when p_dados ? 'pedido_venda_numero' then nullif(left(p_dados->>'pedido_venda_numero', 40), '') else pedido_venda_numero end,
    cotacao_numero = case when p_dados ? 'cotacao_numero' then nullif(left(p_dados->>'cotacao_numero', 40), '') else cotacao_numero end,
    urgencia = coalesce(nullif(p_dados->>'urgencia',''), urgencia),
    data_desejada = case when p_dados ? 'data_desejada' then nullif(p_dados->>'data_desejada','')::date else data_desejada end,
    status = 'enviada', devolucao_motivo = null, updated_at = now()
  where id = p_id;
  insert into public.iv_solicitacao_hist (solicitacao_id, acao, por, detalhe) values (p_id, case when s.status = 'devolvida' then 'reenviou' else 'editou' end, v_email, jsonb_build_object('itens', n));
  return jsonb_build_object('id', p_id, 'numero', s.numero, 'itens', n);
end $$;

create or replace function public.iv_solicitacao_cancelar(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare s public.iv_solicitacoes; v_email text := (select public.vp_email());
begin
  select * into s from public.iv_solicitacoes where id = p_id for update;
  if not found then raise exception 'nao_encontrada'; end if;
  if lower(s.solicitante_email) <> v_email and not public.iv_solicitacao_pode_tratar() then raise exception 'sem_alcada'; end if;
  if exists (select 1 from public.iv_solicitacao_itens where solicitacao_id = p_id and removido_em is null and lote_id is not null) then
    raise exception 'ja_alocada: há item já alocado em cotação; peça ao comprador para realocar'; end if;
  update public.iv_solicitacoes set status = 'cancelada', updated_at = now() where id = p_id;
  insert into public.iv_solicitacao_hist (solicitacao_id, acao, por) values (p_id, 'cancelou', v_email);
  update public.alertas set resolved = true where id = 'sol-' || p_id;
end $$;

create or replace function public.iv_solicitacao_devolver(p_id uuid, p_motivo text) returns void language plpgsql security definer set search_path = public as $$
declare s public.iv_solicitacoes; v_email text := (select public.vp_email());
begin
  if not public.iv_solicitacao_pode_tratar() then raise exception 'sem_alcada: só o comprador devolve'; end if;
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'motivo_curto: explique o que falta (mínimo 5 letras)'; end if;
  select * into s from public.iv_solicitacoes where id = p_id for update;
  if not found then raise exception 'nao_encontrada'; end if;
  if s.status not in ('enviada','em_analise') then raise exception 'status_invalido: solicitação % está %', s.numero, s.status; end if;
  if exists (select 1 from public.iv_solicitacao_itens where solicitacao_id = p_id and removido_em is null and lote_id is not null) then
    raise exception 'ja_alocada: há item já alocado em cotação'; end if;
  update public.iv_solicitacoes set status = 'devolvida', devolucao_motivo = trim(p_motivo), devolvida_por = v_email, devolvida_em = now(), updated_at = now() where id = p_id;
  insert into public.iv_solicitacao_hist (solicitacao_id, acao, por, detalhe) values (p_id, 'devolveu', v_email, jsonb_build_object('motivo', trim(p_motivo)));
  begin
    insert into public.alertas (id, level, title, sub, module, resolved, destinatario_email, rota)
    values ('sol-dev-' || p_id || '-' || to_char(now(), 'YYYYMMDDHH24MISS'), 'warn', 'Solicitação ' || s.numero || ' devolvida pelo comprador',
            left(trim(p_motivo), 300), 'Compras', false, s.solicitante_email, '/logistica/pedidos-acompanhamento')
    on conflict (id) do nothing;
  exception when others then raise warning 'iv_solicitacao_devolver: aviso falhou: %', sqlerrm; end;
end $$;

-- Aloca itens de solicitações num lote em rascunho (novo se p_lote_id for nulo). Realocar = chamar de novo com outro lote
-- (só se o lote anterior ainda é rascunho). Produto que já está no lote soma a quantidade (nunca duplica a linha).
create or replace function public.iv_solicitacao_alocar(p_item_ids uuid[], p_lote_id uuid default null, p_titulo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_email text := (select public.vp_email()); v_nome text; lote public.iv_cotacao_lotes; it public.iv_solicitacao_itens;
        antigo public.iv_cotacao_lotes; li public.iv_cotacao_itens; novo_li uuid; v_ordem int; adicionados int := 0; somados int := 0; sols uuid[] := '{}'; sid uuid;
begin
  if not public.iv_solicitacao_pode_tratar() then raise exception 'sem_alcada: só o comprador aloca solicitações'; end if;
  if p_item_ids is null or array_length(p_item_ids, 1) is null then raise exception 'sem_itens'; end if;
  select coalesce(nullif(p.nome,''), v_email) into v_nome from public.perfis p where lower(p.email) = v_email limit 1;
  if p_lote_id is null then
    insert into public.iv_cotacao_lotes (titulo, criado_por, criado_por_nome) values (nullif(left(p_titulo, 80), ''), v_email, coalesce(v_nome, v_email)) returning * into lote;
  else
    select * into lote from public.iv_cotacao_lotes where id = p_lote_id for update;
    if not found then raise exception 'lote_inexistente'; end if;
    if lote.status <> 'rascunho' then raise exception 'lote_fechado: o lote % já foi enviado aos fornecedores', lote.numero; end if;
  end if;
  select coalesce(max(ordem), -1) + 1 into v_ordem from public.iv_cotacao_itens where lote_id = lote.id;
  for it in select * from public.iv_solicitacao_itens where id = any (p_item_ids) and removido_em is null order by solicitacao_id, ordem for update loop
    if it.lote_id is not null and it.lote_id = lote.id then continue; end if;
    -- realocação: tira do lote anterior (só se ainda rascunho)
    if it.lote_id is not null then
      select * into antigo from public.iv_cotacao_lotes where id = it.lote_id;
      if antigo.status <> 'rascunho' then raise exception 'lote_anterior_fechado: % está em % e não aceita realocação', antigo.numero, antigo.status; end if;
      select * into li from public.iv_cotacao_itens where id = it.lote_item_id for update;
      if found then
        if li.quantidade_pedida > it.quantidade then
          update public.iv_cotacao_itens set quantidade_pedida = quantidade_pedida - it.quantidade where id = li.id;
        else
          update public.iv_cotacao_itens set removido_em = now(), removido_por = v_email where id = li.id;
        end if;
      end if;
    end if;
    select * into li from public.iv_cotacao_itens where lote_id = lote.id and codigo = it.codigo and removido_em is null limit 1 for update;
    if found then
      update public.iv_cotacao_itens set quantidade_pedida = quantidade_pedida + it.quantidade where id = li.id;
      novo_li := li.id; somados := somados + 1;
    else
      insert into public.iv_cotacao_itens (lote_id, codigo, descricao, unidade, quantidade_pedida, ordem, solicitacao_item_id)
      values (lote.id, it.codigo, it.descricao, it.unidade, it.quantidade, v_ordem, it.id) returning id into novo_li;
      v_ordem := v_ordem + 1; adicionados := adicionados + 1;
    end if;
    update public.iv_solicitacao_itens set lote_id = lote.id, lote_item_id = novo_li, alocado_por = v_email, alocado_em = now() where id = it.id;
    insert into public.iv_solicitacao_hist (solicitacao_id, item_id, acao, por, detalhe)
      values (it.solicitacao_id, it.id, case when antigo.id is not null and it.lote_id is not null then 'realocou' else 'alocou' end, v_email,
              jsonb_build_object('lote', lote.numero, 'codigo', it.codigo, 'quantidade', it.quantidade));
    if not (it.solicitacao_id = any (sols)) then sols := sols || it.solicitacao_id; end if;
    antigo := null;
  end loop;
  foreach sid in array sols loop
    update public.iv_solicitacoes s set updated_at = now(), status = case when exists (
        select 1 from public.iv_solicitacao_itens x where x.solicitacao_id = s.id and x.removido_em is null and x.lote_id is null) then 'em_analise' else 'alocada' end
      where s.id = sid;
    update public.alertas set resolved = true where id = 'sol-' || sid and exists (select 1 from public.iv_solicitacoes z where z.id = sid and z.status = 'alocada');
  end loop;
  if adicionados + somados = 0 then raise exception 'nada_a_alocar: nenhum item válido (já estão neste lote ou foram removidos)'; end if;
  return jsonb_build_object('lote_id', lote.id, 'numero', lote.numero, 'adicionados', adicionados, 'somados', somados, 'novo', p_lote_id is null);
end $$;

revoke all on function public._iv_sol_itens_validos(jsonb) from public, anon, authenticated;
revoke all on function public.iv_solicitacao_pode_solicitar(), public.iv_solicitacao_pode_tratar(),
  public.iv_solicitacao_enviar(jsonb, jsonb), public.iv_solicitacao_editar(uuid, jsonb, jsonb), public.iv_solicitacao_cancelar(uuid),
  public.iv_solicitacao_devolver(uuid, text), public.iv_solicitacao_alocar(uuid[], uuid, text) from public, anon;
grant execute on function public.iv_solicitacao_pode_solicitar(), public.iv_solicitacao_pode_tratar(),
  public.iv_solicitacao_enviar(jsonb, jsonb), public.iv_solicitacao_editar(uuid, jsonb, jsonb), public.iv_solicitacao_cancelar(uuid),
  public.iv_solicitacao_devolver(uuid, text), public.iv_solicitacao_alocar(uuid[], uuid, text) to authenticated;
