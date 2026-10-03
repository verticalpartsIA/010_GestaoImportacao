-- PCP · Reposição de materiais (consumo real × prazo de chegada, em vez de estoque mínimo).
-- Parâmetros editáveis + consumo vindo das SAÍDAS do estoque do Omie (estoque/movestoque ListarMovimentos)
-- + posição de compra (pendente / reservado / disponível) do Omie. Tudo é cache de leitura do Omie; nada é escrito lá.

-- 1) Parâmetros (linha única)
create table if not exists public.pcp_reposicao_config (
  id boolean primary key default true check (id),
  prazo_importado_dias int not null default 90 check (prazo_importado_dias between 1 and 365),
  prazo_nacional_dias  int not null default 15 check (prazo_nacional_dias between 1 and 365),   -- código terminado em "n" minúsculo
  folga_dias           int not null default 30 check (folga_dias between 0 and 365),
  ciclo_dias           int not null default 60 check (ciclo_dias between 0 and 365),            -- quanto de consumo a mais comprar por lote/container
  origens_excluidas    text not null default '',                                                 -- códigos de origem (codOrigem) fora do consumo, separados por vírgula
  janela_desde         date not null default date '2024-01-01',
  atualizado_em        timestamptz not null default now(),
  atualizado_por       text
);
insert into public.pcp_reposicao_config (id) values (true) on conflict (id) do nothing;

-- 2) Movimentos de saída/entrada dos itens do PCP (idempotente por id do movimento no Omie)
create table if not exists public.pcp_consumo_mov (
  id_mov bigint primary key,
  codigo text not null,
  dt_mov date not null,
  qtde numeric not null,            -- sinal do Omie: saída negativa, entrada positiva
  tipo text,                        -- 'saida' | 'entrada'
  cod_origem text,
  des_origem text,
  cancelamento text,
  devolucao text,
  atualizado_em timestamptz not null default now()
);
create index if not exists pcp_consumo_mov_codigo_dt on public.pcp_consumo_mov (codigo, dt_mov);

-- 3) Cursor da leitura histórica (linha única)
create table if not exists public.pcp_consumo_cursor (
  id boolean primary key default true check (id),
  proxima_data date,                -- início da próxima janela (mês) a ler
  pagina int not null default 1,
  concluido_ate date,               -- último dia lido por completo
  atualizado_em timestamptz not null default now()
);
insert into public.pcp_consumo_cursor (id) values (true) on conflict (id) do nothing;

-- 4) Posição de compra do Omie (ListarPosEstoque): o que já está a caminho
create table if not exists public.pcp_posicao_compra (
  codigo text primary key,
  fisico numeric not null default 0,
  reservado numeric not null default 0,
  disponivel numeric not null default 0,
  pendente numeric not null default 0,   -- comprado e ainda não recebido
  atualizado_em timestamptz not null default now()
);

-- RLS: leitura aberta (como o resto do PCP); gravação do consumo/posição só pela função (service role).
alter table public.pcp_reposicao_config enable row level security;
alter table public.pcp_consumo_mov enable row level security;
alter table public.pcp_consumo_cursor enable row level security;
alter table public.pcp_posicao_compra enable row level security;

drop policy if exists pcp_reposicao_config_sel on public.pcp_reposicao_config;
create policy pcp_reposicao_config_sel on public.pcp_reposicao_config for select to anon, authenticated using (true);
drop policy if exists pcp_reposicao_config_upd on public.pcp_reposicao_config;
create policy pcp_reposicao_config_upd on public.pcp_reposicao_config for update to anon, authenticated using (true) with check (true);
drop policy if exists pcp_consumo_mov_sel on public.pcp_consumo_mov;
create policy pcp_consumo_mov_sel on public.pcp_consumo_mov for select to anon, authenticated using (true);
drop policy if exists pcp_consumo_cursor_sel on public.pcp_consumo_cursor;
create policy pcp_consumo_cursor_sel on public.pcp_consumo_cursor for select to anon, authenticated using (true);
drop policy if exists pcp_posicao_compra_sel on public.pcp_posicao_compra;
create policy pcp_posicao_compra_sel on public.pcp_posicao_compra for select to anon, authenticated using (true);

-- 5) Rotina diária (madrugada, longe dos outros crons do Omie): relê os últimos dias e a posição de compra.
--    Escalonados de propósito: duas leituras simultâneas do mesmo método são recusadas pelo Omie.
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('sync-pcp-consumo-recente', 'sync-pcp-consumo-posicao');
end $$;

select cron.schedule('sync-pcp-consumo-recente', '30 4 * * *', $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-pcp-consumo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{"modo":"recente","dias":45}'::jsonb,
    timeout_milliseconds := 150000
  );
$$);

select cron.schedule('sync-pcp-consumo-posicao', '50 4 * * *', $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-pcp-consumo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{"modo":"posicao"}'::jsonb,
    timeout_milliseconds := 150000
  );
$$);
