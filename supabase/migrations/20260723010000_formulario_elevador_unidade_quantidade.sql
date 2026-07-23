-- Quantidade de elevadores idênticos por Unidade — se o cliente quer 9
-- elevadores VP-200 idênticos, é 1 card de especificação com quantidade=9,
-- em vez de 9 cards repetidos. "+ Adicionar elevador" na UI passa a
-- significar "adicionar uma especificação DIFERENTE" (ex.: 3x VP-200 +
-- 1x Cargueiro = 2 cards). Reflete o campo "Lift Units" que já existe no
-- Inquiry Form real da Glarie (1 spec, N unidades).
alter table public.formularios_elevador_unidades
  add column if not exists quantidade integer not null default 1;

alter table public.formularios_elevador_unidades
  drop constraint if exists formularios_elevador_unidades_quantidade_check;
alter table public.formularios_elevador_unidades
  add constraint formularios_elevador_unidades_quantidade_check check (quantidade >= 1);
