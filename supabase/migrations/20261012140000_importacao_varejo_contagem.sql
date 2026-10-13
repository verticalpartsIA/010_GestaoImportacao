-- Importação Varejo · contagem física (acuracidade), endereço do produto e quem contou.
-- O saldo do Omie continua sendo a referência "sistêmica"; aqui se guarda o que existe de fato na prateleira.
-- A sugestão de compra passa a usar o físico contado quando a contagem é recente (ver importacao-varejo-store.js).
-- Tabela própria (não pcp_estoque_fisico): aquela tem FK para pcp_produtos (152 itens) e a Importação Varejo tem ~1.770.
create table if not exists public.importacao_varejo_contagem (
  codigo text primary key,                     -- sempre em maiúsculas
  quantidade numeric check (quantidade is null or quantidade >= 0),   -- físico contado (nulo = só endereço, nunca contado)
  saldo_sistemico numeric,                     -- saldo do sistema (Omie) no momento da contagem
  contado_em date,
  contado_por text,
  endereco text,
  observacao text,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
create table if not exists public.importacao_varejo_contagem_hist (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  quantidade numeric not null,
  saldo_sistemico numeric,
  diferenca numeric,                           -- físico − sistêmico
  contado_em date,
  contado_por text,
  endereco text,
  observacao text,
  origem text not null default 'tela',         -- 'tela' | 'planilha'
  registrado_em timestamptz not null default now(),
  registrado_por text
);
create index if not exists importacao_varejo_contagem_hist_codigo_idx on public.importacao_varejo_contagem_hist (codigo, registrado_em desc);

alter table public.importacao_varejo_contagem enable row level security;
alter table public.importacao_varejo_contagem_hist enable row level security;
-- mesmo padrão das demais tabelas editáveis do módulo (iv_lote_*, iv_comprado_*); histórico sem update/delete
create policy iv_contagem_select on public.importacao_varejo_contagem for select using (true);
create policy iv_contagem_insert on public.importacao_varejo_contagem for insert with check (true);
create policy iv_contagem_update on public.importacao_varejo_contagem for update using (true) with check (true);
create policy iv_contagem_hist_select on public.importacao_varejo_contagem_hist for select using (true);
create policy iv_contagem_hist_insert on public.importacao_varejo_contagem_hist for insert with check (true);
notify pgrst, 'reload schema';
