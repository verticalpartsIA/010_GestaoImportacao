-- 22/09 — pedido do usuário: botão de lixeira no Inbox pra excluir
-- e-mails, sempre com confirmação antes. Soft-delete (nunca apaga a
-- linha de verdade, nunca mexe na caixa real via IMAP) — mesmo padrão
-- já usado em cotacoes_elevador_fornecedor.excluido_em/excluido_por.
alter table emails_projeto
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por text;
