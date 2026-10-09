-- PCP · Controle: ação corretiva registrada ao concluir a OP com perda.
alter table public.pcp_ordens add column if not exists acao_corretiva text;
