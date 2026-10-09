-- Lixeira (exclusão) na tela de Solicitações de Produto. Soft-delete, mesmo
-- padrão já usado em leads (comercial.jsx) — o registro fica no banco (com
-- data e autor da exclusão) e só sai das listagens; nada aponta de volta pra
-- solicitacoes_produto (conferido: nenhuma FK em pg_constraint), então não
-- há risco de linha órfã, mas soft-delete continua preferível a apagar de
-- verdade: permite recuperação pelo suporte e mantém o histórico se a
-- solicitação já tiver virado ficha técnica (ficha_tecnica_id).
alter table public.solicitacoes_produto
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por text;

comment on column public.solicitacoes_produto.excluido_em is 'Soft-delete: quando marcado, a solicitação some das listagens mas continua no banco.';
comment on column public.solicitacoes_produto.excluido_por is 'E-mail de quem excluiu a solicitação.';
