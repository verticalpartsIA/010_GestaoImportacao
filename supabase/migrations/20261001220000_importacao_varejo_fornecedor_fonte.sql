-- Melhoria pedida pelo usuário (01/10/2026): cruzar importacao_varejo_fornecedor
-- com pi_importacao (P.I. — fatura comercial real de importação) como fonte
-- adicional de fornecedor/preço, além do histórico de Pedido de Compra do Omie
-- já usado por sync-importacao-varejo-fornecedor. `fonte` registra de onde veio
-- cada linha, pra decidir qual fonte é mais recente a cada sincronização.
alter table importacao_varejo_fornecedor
  add column if not exists fonte text not null default 'omie_pedido_compra';

comment on column importacao_varejo_fornecedor.fonte is
  'omie_pedido_compra (histórico de Pedido de Compra do Omie) ou pi_importacao (P.I. do próprio site — fatura comercial real). A sincronização sempre mantém a fonte com data_pedido mais recente.';
