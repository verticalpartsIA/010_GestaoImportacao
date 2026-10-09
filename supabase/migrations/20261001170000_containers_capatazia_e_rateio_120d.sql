-- Frete/container na Precificação de Elevadores (Financeiro, 01/10/2026):
-- container e capatazia viram Despesa Operacional herdada do cadastro (Atualização de Custos › Containers).
alter table public.custos_containers add column if not exists capatazia_usd numeric, add column if not exists capatazia_rs numeric;
comment on column public.custos_containers.capatazia_usd is 'Capatazia por container (USD). Herdada pela Precificação como Despesa Operacional.';
comment on column public.custos_containers.capatazia_rs is 'Capatazia por container (R$ = USD x câmbio do dia, editável).';
-- Card 120d com 1 equipamento: quantos equipamentos dividem o container. Null = 2 (padrão da planilha do Financeiro).
alter table public.precificacoes_elevador add column if not exists containers_compartilhados_120d integer;
comment on column public.precificacoes_elevador.containers_compartilhados_120d is 'Card 120d com 1 equipamento: quantos equipamentos dividem o container. Null = 2 (padrão da planilha do Financeiro).';
notify pgrst, 'reload schema';
