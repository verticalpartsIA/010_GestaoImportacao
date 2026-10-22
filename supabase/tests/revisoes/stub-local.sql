-- Esqueleto MÍNIMO do que a migration de revisões comerciais precisa, para testar num Postgres local descartável.
-- NÃO é o schema de produção; só as tabelas/funções que a migration usa. Funções vp_* copiadas de produção.
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;

create table public.perfis (id uuid primary key default gen_random_uuid(), email text, nome text, nivel text, ativo boolean not null default true);
create table public.alcadas_capacidade (perfil_id uuid, modulo text, capacidade text);

create or replace function public.vp_email() returns text language sql stable as $$ select lower(coalesce(auth.jwt()->>'email','')) $$;
create or replace function public.vp_email_ativo(p text) returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.perfis where lower(email) = lower(p) and ativo) $$;
create or replace function public.vp_usuario_ativo() returns boolean language sql stable security definer set search_path = public as
  $$ select public.vp_email_ativo(public.vp_email()) $$;
create or replace function public.vp_eh_admin() returns boolean language sql stable security definer set search_path = public as
  $$ select coalesce((select nivel = 'Administrador' from public.perfis where lower(email) = public.vp_email() and ativo limit 1), false) $$;
create or replace function public.vp_perfil() returns public.perfis language sql stable security definer set search_path = public as
  $$ select p.* from public.perfis p where lower(p.email) = public.vp_email() and p.ativo limit 1 $$;
create or replace function public.vp_tem_capacidade(p_modulo text, p_cap text) returns boolean language sql stable security definer set search_path = public as
  $$ select public.vp_eh_admin() or exists (select 1 from public.alcadas_capacidade a join public.perfis p on p.id = a.perfil_id
       where lower(p.email) = public.vp_email() and p.ativo and a.modulo = p_modulo and a.capacidade = p_cap) $$;

create table public.propostas (
  id uuid primary key default gen_random_uuid(), numero serial unique, numero_documento text unique,
  cliente_id uuid, vendedor_id uuid, titulo text,
  status text not null default 'rascunho' check (status in ('rascunho','enviada','visualizada','aprovada','recusada','expirada','cancelada','revisao_solicitada')),
  validade_dias int not null default 30, condicao_pagamento text, prazo_entrega text, observacoes text,
  desconto_geral numeric default 0, valor_total numeric default 0, proposal_type text, data_json jsonb,
  version int default 1, criado_em timestamptz default now(), atualizado_em timestamptz default now(),
  enviada_em timestamptz, aprovada_em timestamptz, master_id text, precificacao_id uuid, token text unique, channel text,
  recipient jsonb, audit jsonb not null default '{}', log jsonb not null default '[]',
  sent_at timestamptz, viewed_at timestamptz, signed_at timestamptz, expires_at timestamptz, numero_cotacao int,
  versao_publicada jsonb, publicado_em timestamptz, publicado_por text,
  revisao_texto text, revisao_solicitada_em timestamptz, destravada_em timestamptz, destravada_por text,
  revisao_decisao text, revisao_decidida_em timestamptz, revisao_decidida_por text, motivo_recusa_interna text
);
create table public.contratos_venda_equipamentos (id text primary key, proposta_id uuid references public.propostas(id), status text, signed_at timestamptz);
grant select, insert, update, delete on public.propostas, public.contratos_venda_equipamentos to anon, authenticated;
