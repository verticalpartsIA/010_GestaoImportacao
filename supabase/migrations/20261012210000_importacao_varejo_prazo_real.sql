-- Importação Varejo · prazo REAL de reposição, calculado do histórico do Omie.
-- Pedido de Compra (data de inclusão = data do pedido) × entrada no estoque (movimentos IMP/RRE/COM, data real da chegada),
-- casados por produto, em ordem de chegada (primeiro pedido atende a primeira entrada, por quantidade).
-- Gravado pela Edge Function sync-importacao-varejo-prazo (service role); o navegador não lê nem grava (sem policy).
create table if not exists public.importacao_varejo_pedidos_hist (
  pedido text not null,                       -- cNumero do Pedido de Compra no Omie
  codigo text not null,                       -- sempre em maiúsculas
  data_pedido date not null,                  -- dIncData
  data_previsao date,                         -- dDtPrevisao
  qtde numeric not null default 0,
  qtde_recebida numeric not null default 0,
  fornecedor_codigo_omie bigint,
  etapa text,
  atualizado_em timestamptz not null default now(),
  primary key (pedido, codigo)
);
create index if not exists importacao_varejo_pedidos_hist_codigo_idx on public.importacao_varejo_pedidos_hist (codigo, data_pedido);
alter table public.importacao_varejo_pedidos_hist enable row level security;

-- Uma linha por (pedido, entrada) casados: quantidade em comum e prazo em dias.
create table if not exists public.importacao_varejo_prazo_amostras (
  codigo text not null,
  pedido text not null,
  data_pedido date not null,
  data_entrada date not null,
  origem_entrada text,
  quantidade numeric not null,
  dias int not null,
  fornecedor_exterior boolean,
  primary key (codigo, pedido, data_entrada)
);
alter table public.importacao_varejo_prazo_amostras enable row level security;

-- Resumo por produto e por categoria (exterior/nacional), lido pela função de sugestão e pela tela.
create table if not exists public.importacao_varejo_prazo_real (
  chave text primary key,                     -- código do produto, ou 'cat:exterior' / 'cat:nacional' / 'cat:geral'
  amostras int not null,
  dias_mediano numeric not null,
  dias_p80 numeric not null,
  dias_min int not null,
  dias_max int not null,
  ultima_entrada date,
  calculado_em timestamptz not null default now()
);
alter table public.importacao_varejo_prazo_real enable row level security;
create policy iv_prazo_real_select on public.importacao_varejo_prazo_real for select using (true);
notify pgrst, 'reload schema';
