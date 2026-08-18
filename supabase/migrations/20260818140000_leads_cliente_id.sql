-- Promoção Lead → Cliente: quando o Lead converte (Análise Técnica
-- aprovada), vira um cadastro real em `clientes`. Esta coluna guarda o
-- vínculo e torna a promoção idempotente (repetir não duplica).
alter table public.leads add column if not exists cliente_id uuid references public.clientes(id);
create index if not exists idx_leads_cliente_id on public.leads(cliente_id);
