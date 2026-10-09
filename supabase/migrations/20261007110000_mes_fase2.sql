-- MES · Fase 2: apontamento (pausas), bloqueios e materiais por OP.
-- Materiais reaproveitam pcp_ordem_materiais (a mesma lista de materiais da OP do PCP).
alter table public.pcp_ordem_materiais add column if not exists qtd_instalada numeric not null default 0;
alter table public.pcp_ordem_materiais add column if not exists status_mes text not null default 'pendente';
alter table public.pcp_ordem_materiais add column if not exists critico boolean not null default false;
alter table public.pcp_ordem_materiais add column if not exists lote_serie text;
alter table public.pcp_ordem_materiais drop constraint if exists pcp_ordem_materiais_status_mes_check;
alter table public.pcp_ordem_materiais add constraint pcp_ordem_materiais_status_mes_check check (status_mes in ('pendente','separado','instalado','substituido','faltante','avariado'));
alter table public.mes_execucoes add column if not exists duracao_min numeric;
alter table public.mes_execucoes add column if not exists pausa_min numeric;

create table if not exists public.mes_bloqueios (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.pcp_ordens(id),
  motivo text not null check (motivo in ('falta_material','erro_projeto','componente_incorreto','aguardando_engenharia','aguardando_compras','aguardando_decisao','equipamento_danificado','outro')),
  detalhe text,
  aberto_por text,
  inicio timestamptz not null default now(),
  fim timestamptz,
  resolvido_por text
);
create index if not exists mes_bloqueios_ordem_idx on public.mes_bloqueios (ordem_id, inicio);
create table if not exists public.mes_pausas (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references public.mes_execucoes(id),
  ordem_id uuid not null references public.pcp_ordens(id),
  motivo text not null,
  operador text,
  bloqueio_id uuid references public.mes_bloqueios(id),
  inicio timestamptz not null default now(),
  fim timestamptz
);
create index if not exists mes_pausas_exec_idx on public.mes_pausas (execucao_id);
create unique index if not exists mes_pausa_uma_aberta on public.mes_pausas (execucao_id) where fim is null;
create unique index if not exists mes_bloqueio_uma_aberta_motivo on public.mes_bloqueios (ordem_id, motivo) where fim is null;

do $$ declare t text; begin
  foreach t in array array['mes_bloqueios','mes_pausas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (true)', t||'_leitura', t);
    execute format('create policy %I on public.%I for insert with check (true)', t||'_insert', t);
    execute format('create policy %I on public.%I for update using (true) with check (true)', t||'_update', t);
  end loop;
end $$;
