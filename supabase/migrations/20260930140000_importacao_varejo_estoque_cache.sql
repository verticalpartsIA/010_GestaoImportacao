-- Importação Varejo — cache de estoque (30/09/2026)
-- Pedido do usuário: a tela estava lenta porque list-importacao-varejo
-- consultava o estoque AO VIVO no Omie (até ~60 páginas de
-- estoque/consulta ListarPosEstoque) a cada carregamento. Decisão anterior
-- ("se saiu, aparece", ver CLAUDE.md) foi conscientemente revertida pelo
-- próprio usuário em favor de velocidade: "não seria legal se isso morasse
-- no Supabase e lá dentro atualizasse tipo 4 vezes por dia? assim o site
-- apareceria quase instantâneo?" — exatamente o que esta migration faz.
--
-- importacao_varejo_estoque = cache do estoque, sincronizado 4x/dia pela
-- Edge Function sync-importacao-varejo-estoque. list-importacao-varejo
-- passa a ler só esta tabela (+ produtos/giro, já cacheados) — sem
-- nenhuma chamada ao Omie no caminho crítico da tela.
create table if not exists public.importacao_varejo_estoque (
  codigo text primary key references public.importacao_varejo_produtos(codigo) on delete cascade,
  codigo_produto_omie bigint,
  descricao text,
  fisico numeric not null default 0,
  reservado numeric not null default 0,
  disponivel numeric not null default 0,
  minimo_omie numeric not null default 0,
  pendente numeric not null default 0,
  cmc numeric not null default 0,
  preco_unitario numeric not null default 0,
  atualizado_em timestamptz not null default now()
);

alter table public.importacao_varejo_estoque enable row level security;
create policy "iv_estoque_select" on public.importacao_varejo_estoque for select using (true);
create policy "iv_estoque_insert" on public.importacao_varejo_estoque for insert with check (true);
create policy "iv_estoque_update" on public.importacao_varejo_estoque for update using (true) with check (true);
create policy "iv_estoque_delete" on public.importacao_varejo_estoque for delete using (true);

-- 4x/dia em horário comercial (BRT = UTC-3): 7h, 11h, 15h, 19h BRT =
-- 10h, 14h, 18h, 22h UTC. timeout_milliseconds em 60000 — a consulta em
-- lote ao Omie (confirmado ao vivo: ~1946 produtos, ~20 páginas de 100)
-- historicamente terminou em poucos segundos, bem dentro desse teto.
select cron.schedule(
  'sync-importacao-varejo-estoque-4x-dia',
  '0 10,14,18,22 * * *',
  $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-importacao-varejo-estoque',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
