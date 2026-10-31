-- Auditoria 12/10: o botão Excluir do Contrato de Venda (rascunho em preenchimento / rascunho) nunca apagava nada:
-- a tabela não tinha policy de DELETE e o front ignorava o resultado. Só rascunhos NÃO enviados podem ser apagados;
-- contrato enviado/assinado/recusado continua intocável.
create policy delete_rascunho_anon on public.contratos_venda_equipamentos
  for delete to anon, authenticated
  using (status in ('em_preenchimento','rascunho'));
notify pgrst, 'reload schema';
