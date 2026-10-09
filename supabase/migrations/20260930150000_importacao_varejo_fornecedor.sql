-- Importação Varejo — cache de "último fornecedor + último preço unitário
-- pago" por produto (30/09/2026).
-- Pedido do usuário: "consegue trazer a informação de fornecedores? isso
-- facilitaria muito por que o comprador selecionaria o fornecedor e já
-- ajuda a fazer o pedido em massa, além disso, último preço unitário".
--
-- importacao_varejo_fornecedor = cache, sincronizado 1x/dia pela Edge
-- Function sync-importacao-varejo-fornecedor, lido do histórico REAL de
-- Pedidos de Compra do Omie (produtos/pedidocompra PesquisarPedCompra,
-- só recebidos/faturados/encerrados — nunca pendente/cancelado, pra não
-- contaminar "preço pago de verdade" com uma cotação que nunca virou
-- compra real). list-importacao-varejo passa a ler também esta tabela.
create table if not exists public.importacao_varejo_fornecedor (
  codigo text primary key references public.importacao_varejo_produtos(codigo) on delete cascade,
  fornecedor_codigo_omie bigint,
  fornecedor_nome text,
  fornecedor_cnpj text,
  fornecedor_exterior boolean not null default false,
  preco_unitario numeric,
  numero_pedido text,
  data_pedido date,
  updated_at timestamptz not null default now()
);

alter table public.importacao_varejo_fornecedor enable row level security;
create policy "iv_fornecedor_select" on public.importacao_varejo_fornecedor for select using (true);
create policy "iv_fornecedor_insert" on public.importacao_varejo_fornecedor for insert with check (true);
create policy "iv_fornecedor_update" on public.importacao_varejo_fornecedor for update using (true) with check (true);
create policy "iv_fornecedor_delete" on public.importacao_varejo_fornecedor for delete using (true);

-- Cursor de retomada da sync (2 fases: 'pedidos' pagina o histórico de
-- Pedidos de Compra; 'fornecedores' resolve nome/CNPJ/exterior de cada
-- fornecedor distinto) — achado real (30/09): fazer tudo numa invocação
-- só estourava o IDLE_TIMEOUT de 150s do gateway sem salvar nada; este
-- cursor + encadeamento via EdgeRuntime.waitUntil (mesmo padrão de
-- sync-importacao-varejo) resolve isso gravando progressivamente.
create table if not exists public.importacao_varejo_fornecedor_cursor (
  id boolean primary key default true,
  fase text not null default 'pedidos',
  next_pagina integer not null default 1,
  total_paginas integer,
  started_at timestamptz not null default now(),
  constraint importacao_varejo_fornecedor_cursor_singleton check (id)
);

alter table public.importacao_varejo_fornecedor_cursor enable row level security;
create policy "iv_fornecedor_cursor_select" on public.importacao_varejo_fornecedor_cursor for select using (true);
create policy "iv_fornecedor_cursor_insert" on public.importacao_varejo_fornecedor_cursor for insert with check (true);
create policy "iv_fornecedor_cursor_update" on public.importacao_varejo_fornecedor_cursor for update using (true) with check (true);

-- 1x/dia, 9h30 BRT = 12h30 UTC — logo depois do catálogo/giro (9h BRT,
-- sync-importacao-varejo-daily) e fora das janelas de estoque (7h/11h/
-- 15h/19h BRT). Volume real confirmado ao vivo (30/09): 1770 pedidos em
-- TODA a história da conta, 18 páginas a 100/pág (máximo aceito pelo
-- endpoint) — a sync encadeia sozinha até terminar (ver cursor acima).
select cron.schedule(
  'sync-importacao-varejo-fornecedor-diario',
  '30 12 * * *',
  $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-importacao-varejo-fornecedor',
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
