-- Esqueleto dos avais + alertas e a versão ATUAL (produção, antes da Etapa 2.2) do gatilho de abertura de avais.
create table public.alertas (id text primary key, level text, title text, sub text, module text, resolved boolean default false, created_at timestamptz default now());
create table public.avais_financeiros (
  id uuid primary key default gen_random_uuid(), numero_cotacao int, proposta_id uuid, numero_documento text, cliente_nome text,
  valor_total numeric, status text not null default 'pendente_consulta', consulta jsonb, aval jsonb, sinal_pago boolean not null default false,
  sinal jsonb, contrato_venda_id text, criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  aval_pagamento jsonb, aval_pagamento_confirmado boolean default false, aprovacao_ceo_em timestamptz, aprovacao_ceo_por text,
  aprovacao_owner_em timestamptz, aprovacao_owner_por text, custo_teto numeric, margem_aceita numeric);
create unique index avais_financeiros_proposta_id_uniq on public.avais_financeiros (proposta_id) where proposta_id is not null;
create table public.avais_juridicos (
  id uuid primary key default gen_random_uuid(), contrato_venda_id text, numero_cotacao int, cliente_nome text, numero_documento text,
  status text not null default 'pendente', aval jsonb, criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), proposta_id uuid);
create unique index avais_juridicos_proposta_id_uniq on public.avais_juridicos (proposta_id) where proposta_id is not null;
create unique index avais_juridicos_contrato_venda_id_key on public.avais_juridicos (contrato_venda_id);
create or replace function public.fn_avais_abrir_na_proposta() returns trigger language plpgsql security definer set search_path = public as $$
declare v_cliente text; v_ref text;
begin
  if new.status is distinct from 'aprovada' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'aprovada' then return new; end if;
  v_cliente := coalesce(new.data_json->'cliente'->>'nome', new.titulo);
  v_ref := coalesce('Cotação Nº ' || new.numero_cotacao::text, 'Proposta ' || new.numero_documento, 'Proposta');
  insert into avais_financeiros (numero_cotacao, proposta_id, numero_documento, cliente_nome, valor_total, status)
  values (new.numero_cotacao, new.id, new.numero_documento, v_cliente, new.valor_total, 'pendente_consulta')
  on conflict (proposta_id) where proposta_id is not null do nothing;
  insert into avais_juridicos (proposta_id, numero_cotacao, numero_documento, cliente_nome, status)
  values (new.id, new.numero_cotacao, new.numero_documento, v_cliente, 'pendente')
  on conflict (proposta_id) where proposta_id is not null do nothing;
  insert into alertas (id, level, title, sub, module, resolved)
  values ('avais-abertos-' || new.id::text, 'info', v_ref || ' — Avais Financeiro e Jurídico iniciados', 'x', 'Financeiro', false) on conflict (id) do nothing;
  return new;
end; $$;
create trigger trg_avais_abrir_na_proposta after insert or update of status on public.propostas for each row execute function public.fn_avais_abrir_na_proposta();
