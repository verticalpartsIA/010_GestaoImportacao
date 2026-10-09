/* ============================================================
   Duas modalidades de entrega — issue "Precificação real" (frete
   expresso 90 dias, container exclusivo × frete padrão 120 dias,
   container compartilhado). Só o frete internacional muda entre as
   duas — mercadoria, impostos, instalação, comissões e markup são
   idênticos; por isso basta um segundo valor de frete + um segundo
   resultado calculado, reaproveitando o mesmo motor V2. Aditiva e
   reversível.
   ============================================================ */

alter table public.precificacoes_elevador
  add column if not exists frete_seguro_capatazia_usd_expresso numeric,
  add column if not exists resultado_v2_expresso jsonb not null default '{}'::jsonb;
