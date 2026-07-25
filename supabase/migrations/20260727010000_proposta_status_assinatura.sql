-- propostas_status_check só permitia rascunho/enviada/aprovada/recusada/
-- cancelada — faltava o estágio intermediário "visualizada" (cliente abriu
-- o link mas ainda não assinou) e "expirada" (link de assinatura venceu,
-- mesmo padrão de contratos_instalador/contratos_venda_equipamentos).
-- O fluxo de assinatura reaproveita 'aprovada'/'recusada' que já existiam
-- (mantendo a nomenclatura em português feminino de "proposta").
alter table public.propostas drop constraint if exists propostas_status_check;
alter table public.propostas
  add constraint propostas_status_check
  check (status in ('rascunho', 'enviada', 'visualizada', 'aprovada', 'recusada', 'expirada', 'cancelada'));
