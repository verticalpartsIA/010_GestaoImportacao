-- PCP · sincronização Omie → PCP (etapa 1, só leitura do Omie).
-- `origem` separa linha de estrutura vinda do Omie (o sync pode apagar/atualizar)
-- de linha criada só no PCP (o sync nunca apaga) — ex.: VPMP-918 ainda não consta no Omie.
alter table public.pcp_estrutura add column if not exists origem text not null default 'omie'
  check (origem in ('omie', 'pcp'));

update public.pcp_estrutura set origem = 'pcp' where codigo_filho = 'VPMP-918';

-- Log de cada sincronização (a tela mostra "sincronizado em …").
create table if not exists public.pcp_sync_log (
  id uuid primary key default gen_random_uuid(),
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  escopo text not null,
  ok boolean,
  resumo jsonb
);
create index if not exists pcp_sync_log_iniciado_idx on public.pcp_sync_log (iniciado_em desc);

alter table public.pcp_sync_log enable row level security;
create policy "pcp_sync_log_leitura" on public.pcp_sync_log for select using (true);
-- Escrita só pelo service_role (a Edge Function); sem policy de insert/update pra anon.
