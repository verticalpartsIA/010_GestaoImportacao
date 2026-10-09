-- Formulário público de intake técnico (ex.: Quadro de Comando) alimentando Leads.
-- Coluna genérica (não exclusiva de quadro de comando) para guardar o payload
-- bruto enviado por qualquer formulário público de levantamento técnico que
-- crie um Lead — a especificação completa fica disponível pro vendedor,
-- sem precisar modelar cada campo técnico como coluna própria em `leads`.
alter table public.leads
  add column if not exists especificacao_tecnica jsonb;

comment on column public.leads.especificacao_tecnica is
  'Payload bruto enviado por um formulário público de intake técnico (ex.: formulário de Quadro de Comando). Informativo — não substitui o cadastro real do cliente em `clientes`, resolvido manualmente pelo vendedor via CNPJ.';
