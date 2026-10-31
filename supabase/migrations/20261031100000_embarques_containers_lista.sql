-- T14 (Embarques, Onda 3): o espelho do rastreamento guardava só o 1º container.
-- Coluna nova com a lista completa {numero, tipo_tamanho, lacre}. Aditiva: nada existente muda.
alter table public.embarques
  add column if not exists containers_lista jsonb not null default '[]'::jsonb;
