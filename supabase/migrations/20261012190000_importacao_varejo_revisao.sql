-- Importação Varejo · revisão do comprador sobre a sugestão de estoque mínimo/máximo.
-- Produto com venda esporádica (confiança "baixa") NÃO gera compra automática: cai na fila "Para revisar".
-- O comprador decide por produto: aprovar a sugestão, ajustar mínimo/máximo na mão ou marcar "não repor".
-- Qualquer produto (não só os de confiança baixa) pode receber ajuste manual. status:
--   'aprovado'  = vale a sugestão calculada
--   'ajustado'  = valem minimo_manual/maximo_manual (o cálculo diário não mexe)
--   'descartado'= não repor (mínimo e máximo tratados como zero)
--   'pendente'  = revisão desfeita (volta à fila se a confiança for baixa)
create table if not exists public.importacao_varejo_revisao (
  codigo text primary key,                       -- sempre em maiúsculas
  status text not null check (status in ('aprovado','ajustado','descartado','pendente')),
  minimo_manual numeric check (minimo_manual is null or minimo_manual >= 0),
  maximo_manual numeric check (maximo_manual is null or maximo_manual >= 0),
  observacao text,
  minimo_calculado numeric,                      -- o que o sistema sugeria no momento da revisão (auditoria)
  maximo_calculado numeric,
  revisado_por text,
  revisado_em timestamptz not null default now(),
  check (status <> 'ajustado' or (minimo_manual is not null and maximo_manual is not null and maximo_manual >= minimo_manual))
);
alter table public.importacao_varejo_revisao enable row level security;
-- mesmo padrão das demais tabelas editáveis do módulo
create policy iv_revisao_select on public.importacao_varejo_revisao for select using (true);
create policy iv_revisao_insert on public.importacao_varejo_revisao for insert with check (true);
create policy iv_revisao_update on public.importacao_varejo_revisao for update using (true) with check (true);
notify pgrst, 'reload schema';
