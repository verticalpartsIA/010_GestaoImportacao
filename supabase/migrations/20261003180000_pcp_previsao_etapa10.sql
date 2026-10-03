-- PCP · pedidos em etapa 10 ("Pedido", antes de "Separar Estoque / Produção") = SÓ PREVISÃO.
-- Ficam em tabelas PRÓPRIAS, que nenhuma tela de produção/NF/expedição/relatório lê (só a aba Necessidade). Assim a etapa 10
-- nunca vira venda firme por engano, não entra no SLA e não altera Emissão de NF, Expedição nem os relatórios.
-- A função sync-pcp-pedidos (body {"etapa":"10"}) grava aqui; quando o pedido chega à etapa 20, o job da etapa 20 o grava em
-- pcp_pedidos e a limpeza da própria função o remove da previsão. Só LÊ do Omie.
create table if not exists public.pcp_previsao_pedidos (
  codigo_pedido bigint primary key,
  numero_pedido text not null,
  cliente_nome text,
  cliente_fantasia text,
  data_pedido date,
  data_previsao date,
  valor_total numeric,
  atualizado_em timestamptz not null default now()
);
create table if not exists public.pcp_previsao_itens (
  id uuid primary key default gen_random_uuid(),
  codigo_pedido bigint not null references public.pcp_previsao_pedidos (codigo_pedido) on delete cascade,
  seq int not null,
  codigo text not null,
  descricao text,
  unidade text,
  quantidade numeric not null default 0
);
create index if not exists pcp_previsao_itens_pedido on public.pcp_previsao_itens (codigo_pedido);

-- RLS: leitura aberta (como o resto do PCP); gravação só pela função (service role).
alter table public.pcp_previsao_pedidos enable row level security;
alter table public.pcp_previsao_itens enable row level security;
drop policy if exists pcp_previsao_pedidos_sel on public.pcp_previsao_pedidos;
create policy pcp_previsao_pedidos_sel on public.pcp_previsao_pedidos for select to anon, authenticated using (true);
drop policy if exists pcp_previsao_itens_sel on public.pcp_previsao_itens;
create policy pcp_previsao_itens_sel on public.pcp_previsao_itens for select to anon, authenticated using (true);

-- Leitura da etapa 10 a cada hora, seg–sex, 7h–19h (Brasília = 10–22 UTC), no minuto :20 — escalonada dos jobs de pedidos
-- (:00/:30 etapa 20, :10/:40 abertos): o Omie recusa chamadas simultâneas do mesmo método.
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'sync-pcp-pedidos-previsao-etapa10';
end $$;

select cron.schedule('sync-pcp-pedidos-previsao-etapa10', '20 10-22 * * 1-5', $$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-pcp-pedidos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP'
    ),
    body := '{"etapa":"10"}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
