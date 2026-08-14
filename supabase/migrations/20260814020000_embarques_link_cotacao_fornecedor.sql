-- Rastreabilidade Cotação a Fornecedor -> Embarque (Importação).
-- Ate agora embarques nasciam soltos (so manual), sem ligacao com a compra
-- que os originou. Isto permite a fila "Compras aguardando embarque" no modulo
-- Importacao e o vinculo do embarque a cotacao/numero da cotacao que originou
-- a compra ao fornecedor (achado E2E reteste D).

alter table public.embarques
  add column if not exists cotacao_fornecedor_id uuid,
  add column if not exists numero_cotacao integer;

create index if not exists idx_embarques_cotacao_fornecedor
  on public.embarques (cotacao_fornecedor_id);
