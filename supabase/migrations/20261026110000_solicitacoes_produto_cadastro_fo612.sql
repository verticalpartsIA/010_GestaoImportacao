-- Solicitações de Produto: campos do formulário FO-612 (tipo de cadastro + dados complementares).
-- Aditiva: nenhuma coluna existente muda. "dados_cadastro" guarda marca, modelo, unidade, família,
-- função, material, lead time, WhatsApp do cliente etc. (chaves opcionais).
alter table public.solicitacoes_produto
  add column if not exists tipo_cadastro text not null default 'pecas'
    check (tipo_cadastro in ('pecas','insumo')),
  add column if not exists dados_cadastro jsonb not null default '{}'::jsonb;
