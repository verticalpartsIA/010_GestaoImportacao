-- Importação Varejo (/logistica/compras) — "Buscar no Omie".
-- O catálogo da tela é montado pelo sync diário (origem_mercadoria = '1' e ativo). Produto que o sync não traz
-- (ex.: origem 6) pode ser puxado do Omie à mão, pelo campo "Buscar no Omie". Esses produtos ficam marcados
-- com manual = true: o sync diário NÃO os desativa (ver sync-importacao-varejo, fase catálogo).
alter table public.importacao_varejo_produtos
  add column if not exists manual boolean not null default false,
  add column if not exists manual_por text,
  add column if not exists manual_em timestamptz;

comment on column public.importacao_varejo_produtos.manual is 'true = incluído à mão pelo "Buscar no Omie"; o sync diário não desativa.';
