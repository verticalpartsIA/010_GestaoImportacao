-- MES · Fase 4: dados de expedição (gate da etapa Expedição).
alter table public.mes_ordens add column if not exists expedicao_transportadora text;
alter table public.mes_ordens add column if not exists expedicao_saida date;
alter table public.mes_ordens add column if not exists expedicao_responsavel text;
