-- Método da planilha (10/10/2026): terceiro modo de formação de preço, igual à planilha do Financeiro.
-- (já aplicado em produção via MCP; arquivo mantido para o histórico do repositório)
alter table public.precificacoes_elevador drop constraint if exists precificacoes_elevador_modo_formacao_preco_check;
alter table public.precificacoes_elevador add constraint precificacoes_elevador_modo_formacao_preco_check
  check (modo_formacao_preco in ('markup_sobre_custo', 'margem_sobre_venda', 'planilha'));
