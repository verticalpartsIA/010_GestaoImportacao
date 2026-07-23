-- Finalidade da compra — determina se há incidência de DIFAL (Diferencial de
-- Alíquota ICMS) na venda. Revenda nunca tem DIFAL; Uso e Consumo/Ativo
-- Imobilizado segue a árvore de decisão (ver regra de negócio tributária
-- DIFAL/VerticalParts — módulo de Precificação).
alter table public.formularios_elevador
  add column if not exists finalidade_compra text check (finalidade_compra in ('revenda', 'uso_consumo_ativo'));
