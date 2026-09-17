-- Registra quem pediu a decisão (e-mail de quem estava logado ao criar),
-- pré-requisito para avisar o solicitante por WhatsApp quando a decisão for
-- aprovada/reprovada. Decisões já existentes ficam com o campo nulo — não há
-- como reconstruir retroativamente quem pediu.
alter table decisoes_gerenciais
  add column if not exists solicitado_por text;
