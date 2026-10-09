-- 26/09 — pedido do usuário: botão de excluir na lista de Leads, sempre
-- com confirmação antes. Soft-delete (nunca apaga a linha de verdade) —
-- mesmo padrão de emails_projeto / cotacoes_elevador_fornecedor.
-- Hard delete não serve aqui: cotacoes.lead_id e formularios_elevador.lead_id
-- têm FK ON DELETE NO ACTION (bloqueariam), dossier_obra.lead_id não tem FK
-- (ficaria órfão), e a tabela nem tem policy de DELETE pra anon (o delete
-- "funcionaria" sem erro e não apagaria nada).
alter table leads
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por text;
