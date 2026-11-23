-- Coluna "Alterar valor" da Precificação (Gelson, 06/11/2026): diferença em R$ por equipamento, digitada pelo
-- Financeiro; preço do equipamento = rateio + diferença; o mark-up efetivo é recalculado ao Calcular.
-- Chave = "<unidadeId>:<equipamentoIndice>" (a mesma de valores_sugeridos_ceo). Aditiva: default '{}'.
alter table public.precificacoes_elevador
  add column if not exists ajustes_valor jsonb not null default '{}'::jsonb;

comment on column public.precificacoes_elevador.ajustes_valor is
  'Diferença em R$ por equipamento (chave unidadeId:equipamentoIndice), somada ao rateio do preço de venda. Pode ser negativa.';
