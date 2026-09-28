-- Formulário de Solicitação de Produto: campos pra deixar o pedido simples
-- pra um leigo preencher — cliente deixa de ser obrigatório (só se aplica
-- quando é de fato um pedido vindo de cliente) e ganhamos contato de
-- fornecedor, link do produto, contato do cliente e anexos reais
-- (imagem/PDF via Storage, bucket "engenharia" já existente).
alter table public.solicitacoes_produto
  alter column cliente_nome drop not null;

alter table public.solicitacoes_produto
  add column if not exists fornecedor_contato text,
  add column if not exists cliente_contato text,
  add column if not exists link_produto text,
  add column if not exists anexos jsonb not null default '[]'::jsonb;

comment on column public.solicitacoes_produto.cliente_nome is 'Preenchido só quando a solicitação nasce de um pedido de cliente específico (opcional).';
comment on column public.solicitacoes_produto.fornecedor_contato is 'Contato do fornecedor em texto livre (nome/telefone/e-mail), se o solicitante já souber.';
comment on column public.solicitacoes_produto.cliente_contato is 'Contato do cliente (telefone/e-mail), quando a solicitação vem de um pedido de cliente.';
comment on column public.solicitacoes_produto.link_produto is 'Link do produto (site do fabricante, marketplace, catálogo do fornecedor etc.).';
comment on column public.solicitacoes_produto.anexos is 'Array jsonb de anexos [{nome, url, tipo, path}] — imagem(ns) e/ou PDF do produto, upload real no bucket Storage "engenharia".';
