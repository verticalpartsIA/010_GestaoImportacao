-- Importação Varejo · movimentos de estoque do Omie (vendas, devoluções, ajustes) só dos produtos importados.
-- Alimenta a sugestão de estoque mínimo/máximo (próxima migration). Gravada pela Edge Function
-- sync-importacao-varejo-vendas (service role); sem policy = o navegador não lê nem grava.
create table if not exists public.importacao_varejo_mov (
  id_mov bigint primary key,                 -- idMov do Omie
  codigo text not null,
  dt_mov date not null,
  qtde numeric not null,                     -- negativo = saída
  tipo text,
  cod_origem text,                           -- VEN, CVP, DVP, REM, AJU…
  des_origem text,
  cancelamento text,
  devolucao text,
  atualizado_em timestamptz not null default now()
);
create index if not exists importacao_varejo_mov_codigo_dt_idx on public.importacao_varejo_mov (codigo, dt_mov);
create index if not exists importacao_varejo_mov_dt_idx on public.importacao_varejo_mov (dt_mov);
alter table public.importacao_varejo_mov enable row level security;
