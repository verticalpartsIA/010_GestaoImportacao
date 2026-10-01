-- Limpeza (Financeiro, 01/10/2026): colunas que ficaram sem uso na Precificação de Elevadores.
-- frete_seguro_capatazia_usd_expresso: o campo de frete do card 90d saiu da tela (container/capatazia vêm do cadastro).
-- containers_compartilhados_120d: o divisor do card 120d virou constante (2) no cálculo.
-- Os preços calculados continuam guardados em resultado_v2 / resultado_v2_expresso.
alter table public.precificacoes_elevador drop column if exists frete_seguro_capatazia_usd_expresso, drop column if exists containers_compartilhados_120d;
notify pgrst, 'reload schema';
