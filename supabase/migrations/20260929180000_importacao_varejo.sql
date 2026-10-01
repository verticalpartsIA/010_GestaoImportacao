-- Importação Varejo — módulo real de estoque/sugestão de compra pra
-- produtos importados vendidos avulsos ("varejo"). Pedido do usuário
-- (mesmo dia da limpeza/rename do PR #496/#507): reaproveitar a lógica do
-- Estoque Omie (repo verticalpartsIA/003_requisicoes, /estoque-omie) mas
-- adaptado — estoque AO VIVO (não cache), giro/Curva ABC-D calculado
-- desde 01/01/2024 (não janela móvel de 4 meses), escopo = só produtos
-- com origem_mercadoria='1' (fiscal, "Estrangeira - Importação direta"),
-- confirmado ao vivo no Omie que bate em VPER/VPMP/VPB (não só VPEL) e
-- fica vazio em item legado sem essa classificação.
--
-- Por que SEM tabela de cache de estoque (diferente do 003_requisicoes):
-- o Omie tem um endpoint em lote (`estoque/resumo`, ListarPosEstoque)
-- que devolve físico/reservado/disponível/mínimo/pendente/CMC de TODOS
-- os produtos em poucas chamadas paginadas (confirmado: 1946 produtos
-- com registro de estoque, ~4 páginas de 500) — dá pra consultar ao vivo
-- a cada carregamento da tela sem re-cair no problema de rate limit que
-- fez o sistema original migrar pra cache horário. Só o que muda devagar
-- (classificação fiscal do produto + giro/curva de vendas) fica cacheado
-- aqui, sincronizado 1x por dia.

-- ---------------------------------------------------------------------
-- Catálogo: produtos ativos com origem_mercadoria='1' (importado).
-- Sincronizado 1x/dia por sync-importacao-varejo (paginando geral/produtos
-- ListarProdutos, que já traz recomendacoes_fiscais.origem_mercadoria e
-- inativo sem precisar de 1 chamada por produto).
-- ---------------------------------------------------------------------
create table if not exists public.importacao_varejo_produtos (
  codigo text primary key,
  codigo_produto_omie bigint not null,
  descricao text not null,
  unidade text,
  ncm text,
  lead_time_dias integer not null default 0,
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.importacao_varejo_produtos enable row level security;
create policy "iv_produtos_select" on public.importacao_varejo_produtos for select using (true);
create policy "iv_produtos_insert" on public.importacao_varejo_produtos for insert with check (true);
create policy "iv_produtos_update" on public.importacao_varejo_produtos for update using (true) with check (true);
create policy "iv_produtos_delete" on public.importacao_varejo_produtos for delete using (true);

-- ---------------------------------------------------------------------
-- Giro de vendas / Curva ABC-D, calculado desde 01/01/2024 (pedido
-- explícito do usuário — substitui a janela móvel de 4 meses do sistema
-- original). Curva ABC pelo volume faturado no período acumulado
-- (A <=80%, B <=95%, C <=100%); Curva D = baixo giro/sem histórico
-- suficiente no período — é também o sinal usado pro "conselho de não
-- comprar mais" (ver Edge Function list-importacao-varejo): Curva D +
-- estoque disponível > 0 = produto que demora demais pra vender.
-- ---------------------------------------------------------------------
create table if not exists public.importacao_varejo_giro (
  codigo text primary key references public.importacao_varejo_produtos(codigo) on delete cascade,
  media_mensal_vendas numeric not null default 0,
  curva text not null default 'D' check (curva in ('A', 'B', 'C', 'D')),
  estoque_minimo_calculado numeric not null default 0,
  ultima_venda_em date,
  janela_desde date not null default '2024-01-01',
  updated_at timestamptz not null default now()
);

alter table public.importacao_varejo_giro enable row level security;
create policy "iv_giro_select" on public.importacao_varejo_giro for select using (true);
create policy "iv_giro_insert" on public.importacao_varejo_giro for insert with check (true);
create policy "iv_giro_update" on public.importacao_varejo_giro for update using (true) with check (true);
create policy "iv_giro_delete" on public.importacao_varejo_giro for delete using (true);

-- ---------------------------------------------------------------------
-- Lançamentos de "Comprado": quantidade já encomendada + previsão de
-- chegada, lançada manualmente pelo comprador/almoxarife. Abate a
-- Sugestão de Compra enquanto a previsão não passa (mesmo padrão do
-- Estoque Omie original).
-- ---------------------------------------------------------------------
create table if not exists public.importacao_varejo_comprado (
  id uuid primary key default gen_random_uuid(),
  codigo text not null references public.importacao_varejo_produtos(codigo) on delete cascade,
  quantidade numeric not null check (quantidade > 0),
  previsao_chegada date not null,
  recebido boolean not null default false,
  criado_por text,
  criado_por_nome text,
  criado_em timestamptz not null default now()
);

create index if not exists importacao_varejo_comprado_codigo_idx on public.importacao_varejo_comprado (codigo);

alter table public.importacao_varejo_comprado enable row level security;
create policy "iv_comprado_select" on public.importacao_varejo_comprado for select using (true);
create policy "iv_comprado_insert" on public.importacao_varejo_comprado for insert with check (true);
create policy "iv_comprado_update" on public.importacao_varejo_comprado for update using (true) with check (true);
create policy "iv_comprado_delete" on public.importacao_varejo_comprado for delete using (true);

-- ---------------------------------------------------------------------
-- Configuração de lote por produto (múltiplo de compra / lote mínimo),
-- revisada manualmente pelo comprador na tela — sem pré-preenchimento
-- por histórico de pedidos nesta primeira entrega (simplificação
-- deliberada; o sistema original tinha isso, ver docs/estoque-omie.md
-- do repo 003_requisicoes se quiser portar depois).
-- ---------------------------------------------------------------------
create table if not exists public.importacao_varejo_lote_config (
  codigo text primary key references public.importacao_varejo_produtos(codigo) on delete cascade,
  multiplo_compra numeric,
  lote_minimo numeric,
  atualizado_por text,
  atualizado_por_nome text,
  atualizado_em timestamptz not null default now()
);

alter table public.importacao_varejo_lote_config enable row level security;
create policy "iv_lote_select" on public.importacao_varejo_lote_config for select using (true);
create policy "iv_lote_insert" on public.importacao_varejo_lote_config for insert with check (true);
create policy "iv_lote_update" on public.importacao_varejo_lote_config for update using (true) with check (true);
create policy "iv_lote_delete" on public.importacao_varejo_lote_config for delete using (true);

-- ---------------------------------------------------------------------
-- Cursor + staging da sincronização diária (mesmo padrão de
-- omie_velocity_cursor/omie_velocity_staging do sistema original) — a
-- sincronização encadeia várias invocações da Edge Function (via
-- EdgeRuntime.waitUntil) pra não estourar o timeout de uma invocação só,
-- já que o histórico de faturamento desde 01/01/2024 pode ter muitas
-- páginas.
-- ---------------------------------------------------------------------
create table if not exists public.importacao_varejo_sync_cursor (
  id boolean primary key default true,
  phase text not null default 'catalogo',
  next_pagina integer not null default 1,
  total_paginas integer,
  started_at timestamptz not null default now(),
  constraint importacao_varejo_sync_cursor_singleton check (id)
);

alter table public.importacao_varejo_sync_cursor enable row level security;
create policy "iv_cursor_select" on public.importacao_varejo_sync_cursor for select using (true);
create policy "iv_cursor_insert" on public.importacao_varejo_sync_cursor for insert with check (true);
create policy "iv_cursor_update" on public.importacao_varejo_sync_cursor for update using (true) with check (true);
create policy "iv_cursor_delete" on public.importacao_varejo_sync_cursor for delete using (true);

create table if not exists public.importacao_varejo_giro_staging (
  codigo text primary key,
  qtd_faturada numeric not null default 0
);

alter table public.importacao_varejo_giro_staging enable row level security;
create policy "iv_girostg_select" on public.importacao_varejo_giro_staging for select using (true);
create policy "iv_girostg_insert" on public.importacao_varejo_giro_staging for insert with check (true);
create policy "iv_girostg_update" on public.importacao_varejo_giro_staging for update using (true) with check (true);
create policy "iv_girostg_delete" on public.importacao_varejo_giro_staging for delete using (true);

-- ---------------------------------------------------------------------
-- Log de sincronização (mesmo padrão de omie_pagamentos_sync_log) — pra
-- diagnosticar se o cron diário está rodando/falhando sem precisar ler
-- os logs brutos da Edge Function.
-- ---------------------------------------------------------------------
create table if not exists public.importacao_varejo_sync_log (
  id uuid primary key default gen_random_uuid(),
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  produtos_sincronizados integer,
  giro_calculado integer,
  erro text
);

alter table public.importacao_varejo_sync_log enable row level security;
create policy "iv_synclog_select" on public.importacao_varejo_sync_log for select using (true);
create policy "iv_synclog_insert" on public.importacao_varejo_sync_log for insert with check (true);
create policy "iv_synclog_update" on public.importacao_varejo_sync_log for update using (true) with check (true);

-- ---------------------------------------------------------------------
-- Cron diário (9h BRT = 12h UTC, mesmo horário do sistema original) —
-- mesma chave publishable usada pelos outros crons deste projeto (ver
-- 20260928120000_cron_jobs_publishable_key.sql). timeout_milliseconds
-- em 120000 (2min) — a Edge Function roda até 100s (TEMPO_MAXIMO_MS)
-- antes de responder, então um timeout mais curto aqui repetiria o bug
-- real já documentado no cron read-inbox-poll (pg_net cortando antes da
-- função terminar de responder).
-- ---------------------------------------------------------------------
select cron.schedule(
  'sync-importacao-varejo-daily',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-importacao-varejo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
