-- Contrato de Venda: "Salvar rascunho" do assistente.
-- Novo status 'em_preenchimento' (contrato ainda sem número/token, não enviável).
-- Aproveita pra incluir 'aguardando_signatarios', que o código já usa (signatários
-- adicionais) mas o CHECK original não listava.
alter table public.contratos_venda_equipamentos drop constraint if exists contratos_venda_equipamentos_status_check;
alter table public.contratos_venda_equipamentos
  add constraint contratos_venda_equipamentos_status_check
  check (status is null or status = any (array[
    'rascunho','enviado','visualizado','assinado','recusado','expirado',
    'em_preenchimento','aguardando_signatarios',
    'Em redação','Em assinatura digital','Assinado','Aguardando assinatura'
  ]));
