-- Cotação a Fornecedor — decisão interna de compra (pós-resposta do fornecedor).
-- Fecha o ciclo de status que a tela de Cotações a Fornecedor precisa mostrar:
-- rascunho/enviado/visualizado (aguardando) → respondido (recebida) →
-- em_analise (time decidiu seguir com a compra, revisão interna) →
-- aprovada (confirmação final de compra).
alter table public.cotacoes_elevador_fornecedor drop constraint if exists cotacoes_elevador_fornecedor_status_check;
alter table public.cotacoes_elevador_fornecedor
  add constraint cotacoes_elevador_fornecedor_status_check
  check (status in ('rascunho', 'enviado', 'visualizado', 'respondido', 'em_analise', 'aprovada', 'expirado'));

alter table public.cotacoes_elevador_fornecedor
  add column if not exists decidido_em timestamptz,
  add column if not exists aprovado_em timestamptz;
