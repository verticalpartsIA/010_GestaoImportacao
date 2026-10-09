-- Ramo B do Quadro de Comando (comprar pronto de fornecedor) — guarda qual
-- cotacoes_elevador_fornecedor (categoria_produto='quadro_comando') está
-- vinculada a este quadro, pra não precisar buscar por unidade_ids.
alter table public.quadros_comando
  add column if not exists cotacao_fornecedor_id uuid references public.cotacoes_elevador_fornecedor(id) on delete set null;
