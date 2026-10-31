-- Dólar da Precificação: qual PTAX vale (do dia da cotação ou de agora) e o % somado a ela.
-- tx_cambial = PTAX escolhida × (1 + cambio_spread_pct) — continua sendo o único câmbio que o motor usa.
alter table public.precificacoes_elevador
  add column if not exists cambio_base text check (cambio_base in ('cotacao', 'agora')),
  add column if not exists cambio_spread_pct numeric;
