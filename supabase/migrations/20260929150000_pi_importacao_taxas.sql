-- Adiciona taxas adicionais à P.I. (Proforma Invoice) — ex.: Frete Local,
-- Seguro, Taxa administrativa etc. Cada taxa tem um tipo de valor (% sobre o
-- valor dos itens, BRL ou USD) e uma descrição livre. Mesmo padrão jsonb já
-- usado por `itens`/`pagamentos_adicionais` nesta tabela (Fase 1, sem tabela
-- satélite).
alter table public.pi_importacao
  add column if not exists taxas jsonb not null default '[]'::jsonb;

comment on column public.pi_importacao.taxas is
  'Taxas adicionais da P.I. — array de {tipo: "%"|"BRL"|"USD", descricao, valor}.';
