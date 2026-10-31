-- Importação Varejo — fornecedor/preço/data da ÚLTIMA COMPRA lidos das notas fiscais
-- de ENTRADA DE IMPORTAÇÃO do Omie (16/10/2026, pedido do usuário).
--
-- Achado: as importações da China não passam por Pedido de Compra nem por
-- Recebimento de NF-e do fornecedor (só CT-e de frete). O lançamento de estoque
-- de origem "IMP" aponta para uma NF-e de entrada emitida pela própria
-- VerticalParts (CFOP 3.xxx) — produtos/nfconsultar ListarNF, tpNF = "0".
-- Nessa nota: nfDestInt.cRazao = fornecedor estrangeiro, det[].prod.cProd =
-- nosso código, qCom, vUnCom (preço da nota), ide.dEmi, ide.nNF.
--
-- Tabela com o histórico de itens dessas notas + cursor de paginação (mesmo
-- padrão de importacao_varejo_fornecedor_cursor). A função
-- sync-importacao-varejo-nf-importacao grava aqui e, no fim, atualiza
-- importacao_varejo_fornecedor (fonte 'nf_importacao').

create table if not exists public.importacao_varejo_nf_import (
  nf_id bigint not null,
  cod_item bigint not null,
  nf_numero text,
  data_emissao date,
  codigo text not null,
  fornecedor_cod_omie bigint,
  fornecedor_nome text,
  qtd numeric,
  preco_unitario numeric,
  valor_item numeric,
  cfop text,
  updated_at timestamptz not null default now(),
  primary key (nf_id, cod_item)
);
create index if not exists importacao_varejo_nf_import_codigo_data
  on public.importacao_varejo_nf_import (codigo, data_emissao desc);

alter table public.importacao_varejo_nf_import enable row level security;
create policy "iv_nf_import_select" on public.importacao_varejo_nf_import for select using (true);

create table if not exists public.importacao_varejo_nf_cursor (
  id boolean primary key default true,
  fase text not null default 'nfs',
  next_pagina integer not null default 1,
  total_paginas integer,
  desde text not null default '01/01/2024',
  started_at timestamptz not null default now(),
  constraint importacao_varejo_nf_cursor_singleton check (id)
);
alter table public.importacao_varejo_nf_cursor enable row level security;
create policy "iv_nf_cursor_select" on public.importacao_varejo_nf_cursor for select using (true);

-- 1x/dia às 04:00 UTC (01h BRT): depois da sync de fornecedor (02:00 UTC) e longe
-- de catálogo (12:00), estoque (10/14/18/22:00), vendas/prazo/sugestão (03:xx).
-- O segredo vem de public.app_secrets e nunca entra no git.
select cron.schedule(
  'sync-importacao-varejo-nf-importacao-diario',
  '0 4 * * *',
  format($cmd$
  select net.http_post(
    url := 'https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/sync-importacao-varejo-nf-importacao',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'Authorization', 'Bearer sb_publishable_aPe0GZxLn9orlrNYFr8U1g_xnMfNgcP',
      'x-cron-secret', %L
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cmd$, (select valor from public.app_secrets where nome = 'cron_secret'))
);
