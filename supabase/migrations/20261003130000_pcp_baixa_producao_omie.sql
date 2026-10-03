-- PCP · baixa de produção no estoque do Omie ao concluir a OP (matéria-prima sai, produto acabado entra).
-- Marca na OP que a baixa já foi lançada (impede lançar duas vezes).
alter table public.pcp_ordens add column if not exists baixa_omie_em timestamptz;
alter table public.pcp_ordens add column if not exists baixa_omie_por text;
alter table public.pcp_ordens add column if not exists baixa_omie_resumo jsonb;
