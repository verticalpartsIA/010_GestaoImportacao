-- Revisões comerciais de proposta (VP-SPEC-990-REV-001) — Etapa 1.
-- ADITIVA: nenhuma coluna existente é alterada/removida; com zero revisões criadas o sistema
-- se comporta como antes (tudo 'vigente', índice 0). NÃO altera public_proposta_* (área blindada
-- de assinatura), avais, Central de Decisões nem e-mail.
-- Desenho: docs/revisoes/01-etapa1-desenho-banco.md e 02-etapa2-vigencia-avais-gates.md.
-- Testes: supabase/tests/revisoes/etapa1.sql

-- ───────────────────────── 0. Pré-checagem (aborta se houver duplicidade) ─────────────────────────
create or replace function public.proposta_tipo_norm(t text) returns text
language sql immutable as $$
  select case when lower(coalesce(t, '')) like '%escada%' then 'escada'
              when lower(coalesce(t, '')) like '%esteira%' then 'esteira'
              else 'elevador' end
$$;

do $$
begin
  if exists (
    select 1 from public.propostas where numero_cotacao is not null
    group by numero_cotacao, public.proposta_tipo_norm(proposal_type) having count(*) > 1
  ) then
    raise exception 'Existem propostas duplicadas por (numero_cotacao, tipo); resolva antes de aplicar esta migration.';
  end if;
end $$;

-- ───────────────────────── 1. Colunas em propostas ─────────────────────────
alter table public.propostas
  add column if not exists revisao_indice      int  not null default 0,
  add column if not exists revisao_codigo      text,
  add column if not exists proposta_raiz_id    uuid references public.propostas(id) on delete restrict,
  add column if not exists proposta_base_id    uuid references public.propostas(id) on delete restrict,
  add column if not exists revisao_motivo      text,
  add column if not exists vigencia            text not null default 'vigente',
  add column if not exists substituida_em      timestamptz,
  add column if not exists substituida_por_id  uuid references public.propostas(id) on delete set null,
  add column if not exists reativada_em        timestamptz,
  add column if not exists reativada_por       text,
  add column if not exists reativacao_motivo   text,
  add column if not exists criada_por          text,
  add column if not exists idempotency_key     text,
  add column if not exists snapshot_origens    jsonb not null default '{}'::jsonb;

alter table public.propostas drop constraint if exists propostas_vigencia_chk;
alter table public.propostas add constraint propostas_vigencia_chk
  check (vigencia in ('vigente', 'em_negociacao', 'historica', 'pendente_aditivo'));

create unique index if not exists propostas_idem_key_uq
  on public.propostas (idempotency_key) where idempotency_key is not null;
create unique index if not exists propostas_familia_rev_uq
  on public.propostas (numero_cotacao, public.proposta_tipo_norm(proposal_type), revisao_indice)
  where numero_cotacao is not null;
create unique index if not exists propostas_familia_vigente_uq
  on public.propostas (numero_cotacao, public.proposta_tipo_norm(proposal_type))
  where numero_cotacao is not null and vigencia = 'vigente';
create index if not exists propostas_raiz_idx on public.propostas (proposta_raiz_id) where proposta_raiz_id is not null;
create index if not exists propostas_base_idx on public.propostas (proposta_base_id) where proposta_base_id is not null;

-- ───────────────────────── 2. Letras (A…Z, AA…) ─────────────────────────
create or replace function public.proposta_proxima_letra(atual text) returns text
language plpgsql immutable as $$
declare chars text[]; i int;
begin
  if atual is null or atual = '' then return 'A'; end if;
  chars := string_to_array(upper(atual), null);
  i := array_length(chars, 1);
  while i >= 1 loop
    if chars[i] <> 'Z' then
      chars[i] := chr(ascii(chars[i]) + 1);
      return array_to_string(chars, '');
    end if;
    chars[i] := 'A';
    i := i - 1;
  end loop;
  return 'A' || array_to_string(chars, '');
end $$;

-- ───────────────────────── 3. Tabelas novas (nascem FECHADAS: leitura por usuário ativo; escrita só por RPC) ─────────────────────────
create table if not exists public.proposta_eventos (
  id              uuid primary key default gen_random_uuid(),
  numero_cotacao  int,
  proposta_id     uuid,                       -- sem FK de propósito: a trilha de auditoria não some com a linha
  evento          text not null,
  ator_email      text,
  ator_papel      text,
  origem          text not null default 'rpc',
  payload         jsonb not null default '{}'::jsonb,
  correlation_id  uuid,
  idempotency_key text unique,
  at              timestamptz not null default now()
);
create index if not exists proposta_eventos_prop_idx on public.proposta_eventos (proposta_id, at);
create index if not exists proposta_eventos_cot_idx  on public.proposta_eventos (numero_cotacao, at);

create or replace function public.proposta_eventos_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'proposta_eventos é append-only (sem UPDATE/DELETE)';
end $$;
drop trigger if exists trg_proposta_eventos_imutavel on public.proposta_eventos;
create trigger trg_proposta_eventos_imutavel before update or delete on public.proposta_eventos
  for each row execute function public.proposta_eventos_imutavel();

create table if not exists public.proposta_tokens (
  token       text primary key,
  proposta_id uuid not null references public.propostas(id) on delete cascade,
  emitido_em  timestamptz not null default now(),
  emitido_por text,
  motivo      text not null default 'original' check (motivo in ('original', 'reenvio', 'reativacao')),
  assinavel   boolean not null default true
);
create index if not exists proposta_tokens_prop_idx on public.proposta_tokens (proposta_id);

create table if not exists public.proposta_solicitacoes_revisao (
  id                     uuid primary key default gen_random_uuid(),
  proposta_id            uuid not null references public.propostas(id) on delete restrict,
  numero_cotacao         int,
  trilha                 text not null check (trilha in ('comercial', 'financeira', 'tecnica', 'juridica', 'outra')),
  origem                 text not null check (origem in ('link_publico', 'email', 'whatsapp', 'reuniao', 'manual')),
  solicitante_nome       text,
  solicitante_papel      text,
  solicitante_contato    text,
  texto                  text not null,
  anexos                 jsonb not null default '[]'::jsonb,
  versao_vista           int,
  status                 text not null default 'aberta'
                         check (status in ('aberta', 'em_analise', 'precisa_informacao', 'aceita', 'recusada', 'atendida')),
  decidida_em            timestamptz,
  decidida_por           text,
  motivo_decisao         text,
  proposta_resultante_id uuid references public.propostas(id) on delete set null,
  registrada_por         text,
  created_at             timestamptz not null default now()
);
create index if not exists prop_solic_prop_idx on public.proposta_solicitacoes_revisao (proposta_id);
create index if not exists prop_solic_cot_idx  on public.proposta_solicitacoes_revisao (numero_cotacao, status);

create table if not exists public.proposta_revisao_validacoes (
  id            uuid primary key default gen_random_uuid(),
  proposta_id   uuid not null references public.propostas(id) on delete cascade,
  trilha        text not null check (trilha in ('comercial', 'financeira', 'tecnica', 'juridica')),
  status        text not null default 'pendente' check (status in ('pendente', 'validada', 'dispensada')),
  por           text,
  em            timestamptz,
  justificativa text,
  unique (proposta_id, trilha)
);

create table if not exists public.proposta_envios (
  id             uuid primary key default gen_random_uuid(),
  proposta_id    uuid not null references public.propostas(id) on delete cascade,
  canal          text,
  destinatario   text,
  enviado_por    text,
  enviado_em     timestamptz not null default now(),
  resultado      text,
  hash_publicado text,
  reenvio        boolean not null default false,
  reativacao     boolean not null default false
);
create index if not exists proposta_envios_prop_idx on public.proposta_envios (proposta_id, enviado_em);

create table if not exists public.proposta_alinhamentos (
  id                      uuid primary key default gen_random_uuid(),
  proposta_id             uuid not null references public.propostas(id) on delete cascade,
  trilha                  text not null check (trilha in ('comercial', 'financeira', 'tecnica', 'juridica')),
  estado                  text not null default 'pendente'
                          check (estado in ('pendente', 'de_acordo', 'pediu_revisao', 'sem_resposta')),
  por_nome                text,
  por_papel               text,
  por_contato             text,
  origem                  text check (origem in ('link_publico', 'email', 'whatsapp', 'reuniao', 'manual', 'sistema')),
  solicitacao_id          uuid references public.proposta_solicitacoes_revisao(id) on delete set null,
  prova                   jsonb,
  em                      timestamptz not null default now(),
  herdado_de_proposta_id  uuid references public.propostas(id) on delete set null,
  unique (proposta_id, trilha)
);

do $$
declare t text;
begin
  foreach t in array array['proposta_eventos', 'proposta_tokens', 'proposta_solicitacoes_revisao',
                           'proposta_revisao_validacoes', 'proposta_envios', 'proposta_alinhamentos']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.vp_usuario_ativo())', t || '_sel', t);
  end loop;
end $$;

-- ───────────────────────── 4. Backfill (idempotente) ─────────────────────────
insert into public.proposta_tokens (token, proposta_id, emitido_em, emitido_por, motivo)
select p.token, p.id, coalesce(p.criado_em, now()), 'backfill', 'original'
from public.propostas p where p.token is not null
on conflict (token) do nothing;

insert into public.proposta_solicitacoes_revisao
  (proposta_id, numero_cotacao, trilha, origem, solicitante_nome, texto, versao_vista, status, decidida_em, decidida_por, created_at)
select p.id, p.numero_cotacao, 'outra', 'link_publico', 'cliente (legado)', p.revisao_texto, p.version,
       case p.revisao_decisao when 'aceita' then 'aceita' when 'recusada' then 'recusada' else 'aberta' end,
       p.revisao_decidida_em, p.revisao_decidida_por, p.revisao_solicitada_em
from public.propostas p
where p.revisao_solicitada_em is not null and p.revisao_texto is not null
  and not exists (select 1 from public.proposta_solicitacoes_revisao s where s.proposta_id = p.id);

-- Mantém proposta_tokens em dia com o que o app grava em propostas.token (criação e troca de token).
create or replace function public.propostas_token_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.token is null then return null; end if;
  if tg_op = 'UPDATE' and old.token is not distinct from new.token then return null; end if;
  insert into public.proposta_tokens (token, proposta_id, emitido_por, motivo)
  values (new.token, new.id, nullif(public.vp_email(), ''),
          case when tg_op = 'UPDATE' and old.token is not null then 'reenvio' else 'original' end)
  on conflict (token) do nothing;
  return null;
end $$;
drop trigger if exists trg_propostas_token_sync on public.propostas;
create trigger trg_propostas_token_sync after insert or update of token on public.propostas
  for each row execute function public.propostas_token_sync();

-- ───────────────────────── 5. Auxiliares internas ─────────────────────────
create or replace function public._prev_evento(p_num int, p_prop uuid, p_evento text, p_payload jsonb, p_key text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.proposta_eventos (numero_cotacao, proposta_id, evento, ator_email, ator_papel, payload, idempotency_key)
  values (p_num, p_prop, p_evento, nullif(public.vp_email(), ''), (public.vp_perfil()).nivel, coalesce(p_payload, '{}'::jsonb), p_key)
  on conflict (idempotency_key) do nothing;
end $$;

-- ───────────────────────── 6. Vigência ─────────────────────────
create or replace function public.proposta_aplicar_vigencia(p_numero int, p_tipo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tipo     text := public.proposta_tipo_norm(p_tipo);
  v_alvo     uuid;
  v_contrato uuid;
  v_antigo   uuid;
  v_alvo_apr timestamptz;
  v_alvo_st  text;
  v_alvo_idx int;
begin
  if p_numero is null then return; end if;
  perform pg_advisory_xact_lock(hashtext('proposta_familia:' || p_numero || ':' || v_tipo));

  select id into v_antigo from public.propostas
   where numero_cotacao = p_numero and public.proposta_tipo_norm(proposal_type) = v_tipo and vigencia = 'vigente' limit 1;

  -- 1) revisão que originou Contrato de Venda assinado
  select p.id into v_contrato
    from public.propostas p join public.contratos_venda_equipamentos c on c.proposta_id = p.id
   where p.numero_cotacao = p_numero and public.proposta_tipo_norm(p.proposal_type) = v_tipo
     and c.signed_at is not null and coalesce(c.status, '') <> 'em_preenchimento'
   order by c.signed_at desc limit 1;
  v_alvo := v_contrato;

  -- 2) reativação mais recente que qualquer outro evento comercial
  if v_alvo is null then
    select r.id into v_alvo from public.propostas r
     where r.numero_cotacao = p_numero and public.proposta_tipo_norm(r.proposal_type) = v_tipo
       and r.reativada_em is not null
       and r.reativada_em >= coalesce((
             select max(greatest(coalesce(o.aprovada_em, '-infinity'), coalesce(o.sent_at, '-infinity')))
               from public.propostas o
              where o.numero_cotacao = p_numero and public.proposta_tipo_norm(o.proposal_type) = v_tipo and o.id <> r.id
           ), '-infinity')
     order by r.reativada_em desc limit 1;
  end if;

  -- 3) última aprovada pelo cliente
  if v_alvo is null then
    select id into v_alvo from public.propostas
     where numero_cotacao = p_numero and public.proposta_tipo_norm(proposal_type) = v_tipo and status = 'aprovada'
     order by aprovada_em desc nulls last, revisao_indice desc limit 1;
  end if;

  -- 4) última enviada (ainda em decisão do cliente)
  if v_alvo is null then
    select id into v_alvo from public.propostas
     where numero_cotacao = p_numero and public.proposta_tipo_norm(proposal_type) = v_tipo
       and sent_at is not null and status in ('enviada', 'visualizada', 'revisao_solicitada')
     order by revisao_indice desc limit 1;
  end if;

  -- 5) a original
  if v_alvo is null then
    select id into v_alvo from public.propostas
     where numero_cotacao = p_numero and public.proposta_tipo_norm(proposal_type) = v_tipo
     order by revisao_indice limit 1;
  end if;
  if v_alvo is null then return; end if;

  select aprovada_em, status, revisao_indice into v_alvo_apr, v_alvo_st, v_alvo_idx from public.propostas where id = v_alvo;

  -- fase 1: tira a vigência dos demais (antes de dar ao alvo — índice único parcial)
  update public.propostas p set
    vigencia = case
      when p.status = 'rascunho' then 'em_negociacao'
      when p.status = 'aprovada' and v_contrato is not null
           and coalesce(p.aprovada_em, '-infinity') > coalesce(v_alvo_apr, '-infinity') then 'pendente_aditivo'
      when p.status in ('enviada', 'visualizada', 'revisao_solicitada')
           and v_alvo_st = 'aprovada' and p.revisao_indice > v_alvo_idx then 'em_negociacao'
      else 'historica' end,
    substituida_em     = case when p.vigencia = 'vigente' then now() else p.substituida_em end,
    substituida_por_id = case when p.vigencia = 'vigente' then v_alvo else p.substituida_por_id end
  where p.numero_cotacao = p_numero and public.proposta_tipo_norm(p.proposal_type) = v_tipo and p.id <> v_alvo;

  -- fase 2: o alvo
  update public.propostas set vigencia = 'vigente', substituida_em = null, substituida_por_id = null
   where id = v_alvo and vigencia <> 'vigente';

  if v_antigo is distinct from v_alvo then
    perform public._prev_evento(p_numero, v_alvo, 'PROPOSTA_VIGENCIA_ALTERADA',
      jsonb_build_object('anterior', v_antigo, 'nova', v_alvo, 'tipo', v_tipo));
  end if;
end $$;

create or replace function public.trg_propostas_vigencia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.proposta_aplicar_vigencia(new.numero_cotacao, new.proposal_type);
  return null;
end $$;
drop trigger if exists trg_propostas_vigencia on public.propostas;
create trigger trg_propostas_vigencia after update of status, reativada_em on public.propostas
  for each row when (old.status is distinct from new.status or old.reativada_em is distinct from new.reativada_em)
  execute function public.trg_propostas_vigencia();

-- Guarda de exclusão: revisão/proposta enviada não some por ação usual (RN-022). Administrador pode.
create or replace function public.propostas_guarda_exclusao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.propostas where proposta_base_id = old.id or proposta_raiz_id = old.id) then
    raise exception 'Esta proposta tem revisões e não pode ser excluída.' using errcode = '23503';
  end if;
  if old.sent_at is not null and not public.vp_eh_admin() then
    raise exception 'Proposta já enviada ao cliente não pode ser excluída (peça a um Administrador).' using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists trg_propostas_guarda_exclusao on public.propostas;
create trigger trg_propostas_guarda_exclusao before delete on public.propostas
  for each row execute function public.propostas_guarda_exclusao();

create or replace view public.propostas_vigentes with (security_invoker = true) as
  select * from public.propostas where vigencia = 'vigente';
grant select on public.propostas_vigentes to authenticated;

-- ───────────────────────── 7. RPCs ─────────────────────────
-- Criar revisão (novo documento, nunca sobrescreve)
create or replace function public.proposta_criar_revisao(
  p_base_id uuid, p_motivo text, p_solicitacoes uuid[] default null, p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b public.propostas; raiz public.propostas; v_tipo text; v_idx int; v_cod text; v_doc text;
  v_novo uuid := gen_random_uuid(); v_token text; v_dj jsonb; v_existe public.propostas;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); end if;
  if coalesce(length(trim(p_motivo)), 0) < 10 then return jsonb_build_object('ok', false, 'erro', 'motivo_curto'); end if;

  if p_idempotency_key is not null then
    select * into v_existe from public.propostas where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('ok', true, 'repetido', true, 'id', v_existe.id,
                                'numero_documento', v_existe.numero_documento, 'revisao_codigo', v_existe.revisao_codigo);
    end if;
  end if;

  select * into b from public.propostas where id = p_base_id;
  if not found then return jsonb_build_object('ok', false, 'erro', 'base_inexistente'); end if;
  if b.numero_cotacao is null then return jsonb_build_object('ok', false, 'erro', 'sem_numero_cotacao'); end if;
  if b.status = 'rascunho' then return jsonb_build_object('ok', false, 'erro', 'base_em_rascunho'); end if;
  if not (public.vp_eh_admin() or public.vp_tem_capacidade('propostas', 'criar_revisao')
          or b.vendedor_id = (public.vp_perfil()).id) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;

  v_tipo := public.proposta_tipo_norm(b.proposal_type);
  perform pg_advisory_xact_lock(hashtext('proposta_familia:' || b.numero_cotacao || ':' || v_tipo));

  -- retry que esperou o lock: a chave pode ter sido usada enquanto aguardava
  if p_idempotency_key is not null then
    select * into v_existe from public.propostas where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('ok', true, 'repetido', true, 'id', v_existe.id,
                                'numero_documento', v_existe.numero_documento, 'revisao_codigo', v_existe.revisao_codigo);
    end if;
  end if;

  select * into raiz from public.propostas where id = coalesce(b.proposta_raiz_id, b.id);
  select coalesce(max(revisao_indice), 0) + 1 into v_idx from public.propostas
   where numero_cotacao = b.numero_cotacao and public.proposta_tipo_norm(proposal_type) = v_tipo;
  select public.proposta_proxima_letra((
    select revisao_codigo from public.propostas
     where numero_cotacao = b.numero_cotacao and public.proposta_tipo_norm(proposal_type) = v_tipo
     order by revisao_indice desc limit 1)) into v_cod;
  v_doc := raiz.numero_documento || '-' || v_cod;
  v_token := left(replace(gen_random_uuid()::text, '-', ''), 16);

  v_dj := coalesce(b.versao_publicada, b.data_json, '{}'::jsonb);
  if v_dj ? 'numero' then v_dj := jsonb_set(v_dj, '{numero}', to_jsonb(v_doc)); end if;

  insert into public.propostas (
    id, numero_documento, cliente_id, vendedor_id, titulo, status, validade_dias, condicao_pagamento, prazo_entrega,
    observacoes, desconto_geral, valor_total, proposal_type, data_json, version, master_id, precificacao_id, token,
    recipient, audit, log, numero_cotacao, revisao_indice, revisao_codigo, proposta_raiz_id, proposta_base_id,
    revisao_motivo, vigencia, criada_por, idempotency_key, snapshot_origens, criado_em, atualizado_em
  ) values (
    v_novo, v_doc, b.cliente_id, b.vendedor_id, b.titulo, 'rascunho', b.validade_dias, b.condicao_pagamento, b.prazo_entrega,
    b.observacoes, b.desconto_geral, b.valor_total, b.proposal_type, v_dj, 1, b.master_id, b.precificacao_id, v_token,
    b.recipient, '{}'::jsonb,
    jsonb_build_array(jsonb_build_object('status', 'revisao_criada', 'at', now(),
      'meta', jsonb_build_object('base', b.numero_documento, 'motivo', trim(p_motivo)))),
    b.numero_cotacao, v_idx, v_cod, raiz.id, b.id, trim(p_motivo), 'em_negociacao',
    nullif(public.vp_email(), ''), p_idempotency_key,
    jsonb_build_object('base_id', b.id, 'base_numero_documento', b.numero_documento, 'base_version', b.version,
                       'precificacao_id', b.precificacao_id, 'hash_base', md5(coalesce(v_dj::text, ''))),
    now(), now()
  );

  if p_solicitacoes is not null and array_length(p_solicitacoes, 1) > 0 then
    update public.proposta_solicitacoes_revisao s set proposta_resultante_id = v_novo
     where s.id = any(p_solicitacoes) and s.numero_cotacao = b.numero_cotacao;
  end if;

  perform public._prev_evento(b.numero_cotacao, v_novo, 'PROPOSTA_REVISAO_CRIADA',
    jsonb_build_object('base', b.id, 'codigo', v_cod, 'motivo', trim(p_motivo), 'solicitacoes', coalesce(to_jsonb(p_solicitacoes), '[]'::jsonb)),
    p_idempotency_key);

  return jsonb_build_object('ok', true, 'id', v_novo, 'numero_documento', v_doc, 'revisao_codigo', v_cod,
                            'revisao_indice', v_idx, 'token', v_token);
end $$;

-- Reativar revisão histórica (liberação do Gestor; não libera edição de conteúdo)
create or replace function public.proposta_reativar_revisao(p_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.propostas; v_token text; v_contrato boolean;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); end if;
  if not (public.vp_eh_admin() or public.vp_tem_capacidade('propostas', 'reativar_revisao')) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 10 then return jsonb_build_object('ok', false, 'erro', 'motivo_curto'); end if;

  select * into t from public.propostas where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'inexistente'); end if;
  if t.status = 'rascunho' then return jsonb_build_object('ok', false, 'erro', 'rascunho_nao_reativa'); end if;
  if t.vigencia = 'vigente' then return jsonb_build_object('ok', false, 'erro', 'ja_vigente'); end if;

  select exists (
    select 1 from public.propostas p join public.contratos_venda_equipamentos c on c.proposta_id = p.id
     where p.numero_cotacao = t.numero_cotacao and public.proposta_tipo_norm(p.proposal_type) = public.proposta_tipo_norm(t.proposal_type)
       and p.id <> t.id and c.signed_at is not null and coalesce(c.status, '') <> 'em_preenchimento'
  ) into v_contrato;
  if v_contrato then return jsonb_build_object('ok', false, 'erro', 'contrato_assinado_em_outra_revisao'); end if;

  v_token := left(replace(gen_random_uuid()::text, '-', ''), 16);
  update public.proposta_tokens set assinavel = false where proposta_id = t.id;
  insert into public.proposta_tokens (token, proposta_id, emitido_por, motivo)
  values (v_token, t.id, nullif(public.vp_email(), ''), 'reativacao');

  update public.propostas set
    token = v_token,
    reativada_em = now(), reativada_por = nullif(public.vp_email(), ''), reativacao_motivo = trim(p_motivo),
    expires_at = case when status in ('expirada', 'recusada', 'cancelada', 'enviada', 'visualizada', 'revisao_solicitada')
                      then now() + make_interval(days => coalesce(validade_dias, 30)) else expires_at end,
    status = case when status in ('expirada', 'recusada', 'cancelada') then 'enviada' else status end,
    log = coalesce(log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'reativada', 'at', now(),
            'meta', jsonb_build_object('por', public.vp_email(), 'motivo', trim(p_motivo))))
   where id = t.id;

  perform public._prev_evento(t.numero_cotacao, t.id, 'PROPOSTA_REATIVADA', jsonb_build_object('motivo', trim(p_motivo)));
  return jsonb_build_object('ok', true, 'token', v_token);
end $$;

-- Pedido de revisão registrado à mão (e-mail, WhatsApp, reunião). Nunca simula visualização do cliente.
create or replace function public.proposta_registrar_solicitacao(
  p_proposta_id uuid, p_trilha text, p_origem text, p_nome text, p_papel text, p_contato text, p_texto text,
  p_anexos jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.propostas; v_id uuid;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); end if;
  if p_origem not in ('email', 'whatsapp', 'reuniao', 'manual') then return jsonb_build_object('ok', false, 'erro', 'origem_invalida'); end if;
  if p_trilha not in ('comercial', 'financeira', 'tecnica', 'juridica', 'outra') then return jsonb_build_object('ok', false, 'erro', 'trilha_invalida'); end if;
  if coalesce(length(trim(p_texto)), 0) < 5 then return jsonb_build_object('ok', false, 'erro', 'texto_curto'); end if;
  select * into p from public.propostas where id = p_proposta_id;
  if not found then return jsonb_build_object('ok', false, 'erro', 'inexistente'); end if;
  if not (public.vp_eh_admin() or public.vp_tem_capacidade('propostas', 'criar_revisao') or p.vendedor_id = (public.vp_perfil()).id) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  insert into public.proposta_solicitacoes_revisao
    (proposta_id, numero_cotacao, trilha, origem, solicitante_nome, solicitante_papel, solicitante_contato, texto, anexos, versao_vista, registrada_por)
  values (p.id, p.numero_cotacao, p_trilha, p_origem, nullif(trim(p_nome), ''), nullif(trim(p_papel), ''), nullif(trim(p_contato), ''),
          trim(p_texto), coalesce(p_anexos, '[]'::jsonb), p.version, nullif(public.vp_email(), ''))
  returning id into v_id;
  if p_trilha <> 'outra' then
    insert into public.proposta_alinhamentos (proposta_id, trilha, estado, por_nome, por_papel, por_contato, origem, solicitacao_id)
    values (p.id, p_trilha, 'pediu_revisao', nullif(trim(p_nome), ''), nullif(trim(p_papel), ''), nullif(trim(p_contato), ''), p_origem, v_id)
    on conflict (proposta_id, trilha) do update set estado = 'pediu_revisao', solicitacao_id = excluded.solicitacao_id, em = now(),
      por_nome = excluded.por_nome, por_papel = excluded.por_papel, por_contato = excluded.por_contato, origem = excluded.origem;
  end if;
  perform public._prev_evento(p.numero_cotacao, p.id, 'PROPOSTA_REVISAO_SOLICITADA',
    jsonb_build_object('solicitacao', v_id, 'trilha', p_trilha, 'origem', p_origem));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.proposta_decidir_solicitacao(p_id uuid, p_decisao text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.proposta_solicitacoes_revisao; p public.propostas;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); end if;
  if p_decisao not in ('em_analise', 'precisa_informacao', 'aceita', 'recusada') then return jsonb_build_object('ok', false, 'erro', 'decisao_invalida'); end if;
  if p_decisao in ('recusada', 'precisa_informacao') and coalesce(length(trim(p_motivo)), 0) < 5 then
    return jsonb_build_object('ok', false, 'erro', 'motivo_obrigatorio');
  end if;
  select * into s from public.proposta_solicitacoes_revisao where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'inexistente'); end if;
  select * into p from public.propostas where id = s.proposta_id;
  if not (public.vp_eh_admin() or public.vp_tem_capacidade('propostas', 'criar_revisao') or p.vendedor_id = (public.vp_perfil()).id) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  update public.proposta_solicitacoes_revisao set status = p_decisao, decidida_em = now(),
         decidida_por = nullif(public.vp_email(), ''), motivo_decisao = nullif(trim(p_motivo), '') where id = p_id;
  perform public._prev_evento(s.numero_cotacao, s.proposta_id, 'PROPOSTA_REVISAO_DECIDIDA',
    jsonb_build_object('solicitacao', p_id, 'decisao', p_decisao));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.proposta_validar_trilha(p_proposta_id uuid, p_trilha text, p_status text, p_justificativa text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.propostas;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); end if;
  if p_trilha not in ('comercial', 'financeira', 'tecnica', 'juridica') then return jsonb_build_object('ok', false, 'erro', 'trilha_invalida'); end if;
  if p_status not in ('pendente', 'validada', 'dispensada') then return jsonb_build_object('ok', false, 'erro', 'status_invalido'); end if;
  if p_status = 'dispensada' and coalesce(length(trim(p_justificativa)), 0) < 10 then return jsonb_build_object('ok', false, 'erro', 'justificativa_obrigatoria'); end if;
  if not (public.vp_eh_admin() or public.vp_tem_capacidade('propostas', 'validar_' || p_trilha)) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  select * into p from public.propostas where id = p_proposta_id;
  if not found then return jsonb_build_object('ok', false, 'erro', 'inexistente'); end if;
  insert into public.proposta_revisao_validacoes (proposta_id, trilha, status, por, em, justificativa)
  values (p.id, p_trilha, p_status, nullif(public.vp_email(), ''), now(), nullif(trim(p_justificativa), ''))
  on conflict (proposta_id, trilha) do update set status = excluded.status, por = excluded.por, em = excluded.em, justificativa = excluded.justificativa;
  perform public._prev_evento(p.numero_cotacao, p.id, 'PROPOSTA_REVISAO_VALIDADA', jsonb_build_object('trilha', p_trilha, 'status', p_status));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.proposta_alinhar(
  p_proposta_id uuid, p_trilha text, p_estado text, p_nome text, p_papel text, p_contato text, p_origem text, p_prova jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.propostas;
begin
  if not public.vp_usuario_ativo() then return jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); end if;
  if p_trilha not in ('comercial', 'financeira', 'tecnica', 'juridica') then return jsonb_build_object('ok', false, 'erro', 'trilha_invalida'); end if;
  if p_estado not in ('pendente', 'de_acordo', 'sem_resposta') then return jsonb_build_object('ok', false, 'erro', 'estado_invalido'); end if;
  if p_origem not in ('email', 'whatsapp', 'reuniao', 'manual') then return jsonb_build_object('ok', false, 'erro', 'origem_invalida'); end if;
  select * into p from public.propostas where id = p_proposta_id;
  if not found then return jsonb_build_object('ok', false, 'erro', 'inexistente'); end if;
  if not (public.vp_eh_admin() or public.vp_tem_capacidade('propostas', 'criar_revisao') or p.vendedor_id = (public.vp_perfil()).id) then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  insert into public.proposta_alinhamentos (proposta_id, trilha, estado, por_nome, por_papel, por_contato, origem, prova)
  values (p.id, p_trilha, p_estado, nullif(trim(p_nome), ''), nullif(trim(p_papel), ''), nullif(trim(p_contato), ''), p_origem, p_prova)
  on conflict (proposta_id, trilha) do update set estado = excluded.estado, por_nome = excluded.por_nome, por_papel = excluded.por_papel,
    por_contato = excluded.por_contato, origem = excluded.origem, prova = excluded.prova, em = now(), solicitacao_id = null;
  perform public._prev_evento(p.numero_cotacao, p.id, 'PROPOSTA_ALINHAMENTO', jsonb_build_object('trilha', p_trilha, 'estado', p_estado));
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── 8. Permissões de execução ─────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.proposta_criar_revisao(uuid,text,uuid[],text)',
    'public.proposta_reativar_revisao(uuid,text)',
    'public.proposta_registrar_solicitacao(uuid,text,text,text,text,text,text,jsonb)',
    'public.proposta_decidir_solicitacao(uuid,text,text)',
    'public.proposta_validar_trilha(uuid,text,text,text)',
    'public.proposta_alinhar(uuid,text,text,text,text,text,text,jsonb)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- internas: só o próprio banco (triggers/RPCs definer)
  revoke execute on function public.proposta_aplicar_vigencia(int, text) from public, anon, authenticated;
  revoke execute on function public._prev_evento(int, uuid, text, jsonb, text) from public, anon, authenticated;
  revoke execute on function public.trg_propostas_vigencia() from public, anon, authenticated;
  revoke execute on function public.propostas_token_sync() from public, anon, authenticated;
  revoke execute on function public.propostas_guarda_exclusao() from public, anon, authenticated;
end $$;

notify pgrst, 'reload schema';
