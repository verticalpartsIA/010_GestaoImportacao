-- "VLR Sugerido CEO" (10/10/2026): preço que a diretoria quer por equipamento, ao lado do "VLR por Equip." calculado.
-- Chave = "<unidadeId>:<nº do equipamento dentro da unidade>" (estável mesmo se os códigos corridos forem renumerados).
-- (já aplicado em produção via MCP; arquivo mantido para o histórico do repositório)
alter table public.precificacoes_elevador add column if not exists valores_sugeridos_ceo jsonb not null default '{}'::jsonb;
