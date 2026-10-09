alter table cotacoes_elevador_fornecedor
  add column if not exists cambio_na_resposta_usd_brl numeric;

alter table precificacoes_elevador
  add column if not exists cambio_na_cotacao_usd_brl numeric;

comment on column cotacoes_elevador_fornecedor.cambio_na_resposta_usd_brl is
  'Câmbio USD/BRL congelado no momento em que o fornecedor respondeu a cotação (AwesomeAPI). Nunca reescrito depois de setado.';
comment on column precificacoes_elevador.cambio_na_cotacao_usd_brl is
  'Câmbio USD/BRL congelado, herdado de cotacoes_elevador_fornecedor.cambio_na_resposta_usd_brl no momento da criação/ressincronização — referência para comparar com o câmbio vivo.';
